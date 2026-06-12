import { extractPageElements, buildTranslateRequests } from './extractor';
import { replaceWithTranslation, toggleOriginalTranslation, reapplyTranslation, showError, showLoading, hideLoading, hideAllSpinners, clearAllTranslations, getTranslatedCount, resetUnclaimedElements } from './replacer';
import { shouldAutoTranslate } from './detector';
import { Message } from '../lib/types';
import { getConfig } from '../lib/config';

interface QueueItem {
  id: string;
  text: string;
  context?: string;
  element: HTMLElement;
  childMap?: Element[];
}

let isTranslating = false;
let translationQueue: QueueItem[] = [];
let queuedIds = new Set<string>();
let scrollTimer: number | null = null;
let currentConfig: any = null;
let isProcessingQueue = false;
let showOriginalMode = false;
let translationGeneration = 0;
let currentPageSummary: string | null = null;

function extractPageTextForSummary(): string {
  const parts: string[] = [];
  if (document.title) parts.push(`[标题] ${document.title}`);
  const headings = document.querySelectorAll('h1, h2');
  headings.forEach((h) => {
    const t = h.textContent?.trim();
    if (t) parts.push(`[${h.tagName.toLowerCase()}] ${t}`);
  });
  const source = document.querySelector('article, main, [role="main"], .content, .post') || document.body;
  const paragraphs = source.querySelectorAll('p');
  let count = 0;
  paragraphs.forEach((p) => {
    if (count >= 5) return;
    const t = p.textContent?.trim();
    if (t && t.length > 10) {
      parts.push(t);
      count++;
    }
  });
  return parts.join('\n').slice(0, 1500);
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getCacheKey(text: string): string {
  const domain = window.location.hostname;
  return `cache_${domain}_${hashText(text)}`;
}

async function getCachedTranslation(text: string): Promise<string | null> {
  return new Promise((resolve) => {
    const key = getCacheKey(text);
    chrome.storage.local.get(key, (result) => {
      const entry = result[key];
      if (entry && entry.translatedText) {
        resolve(entry.translatedText);
      } else {
        resolve(null);
      }
    });
  });
}

async function getCachedTranslationsBatch(texts: string[]): Promise<Map<string, string | null>> {
  const keys = texts.map(t => getCacheKey(t));
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      const map = new Map<string, string | null>();
      for (let i = 0; i < texts.length; i++) {
        const entry = result[keys[i]];
        map.set(texts[i], entry && entry.translatedText ? entry.translatedText : null);
      }
      resolve(map);
    });
  });
}

async function setCachedTranslation(text: string, translatedText: string): Promise<void> {
  const key = getCacheKey(text);
  const entry = {
    text,
    translatedText,
    timestamp: Date.now(),
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: entry }, resolve);
  });
}

function collectVisibleElements(): void {
  if (!currentConfig) return;

  const elements = extractPageElements(
    currentConfig.customSelectors,
    currentConfig.globalExcludeSelectors,
    currentConfig.siteExcludeRules,
    currentConfig.onlyTranslateVisible,
    currentConfig.targetLang
  );

  const requests = buildTranslateRequests(elements, currentConfig.useContext);

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (queuedIds.has(req.id)) continue;

    queuedIds.add(req.id);
    translationQueue.push({
      id: req.id,
      text: req.text,
      context: req.context,
      element: elements[i].element,
      childMap: elements[i].childMap,
    });
  }
}

function buildBatches(items: QueueItem[], maxChars: number): QueueItem[][] {
  const batches: QueueItem[][] = [];
  let current: QueueItem[] = [];
  let currentChars = 0;

  for (const item of items) {
    if (item.text.length >= maxChars) {
      if (current.length > 0) {
        batches.push(current);
        current = [];
        currentChars = 0;
      }
      batches.push([item]);
      continue;
    }

    if (current.length > 0 && currentChars + item.text.length > maxChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += item.text.length;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function cancelTranslation(): void {
  translationGeneration++;
  translationQueue = [];
  queuedIds.clear();
  isTranslating = false;
  isProcessingQueue = false;
  hideAllSpinners();
  resetUnclaimedElements();
  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
  window.removeEventListener('scroll', handleScroll);
}

async function processQueue(generation: number): Promise<void> {
  isProcessingQueue = true;

  const maxChars = currentConfig?.maxCharsPerBatch || 2000;
  const concurrency = currentConfig?.concurrency || 3;

  while (translationQueue.length > 0) {
    if (translationGeneration !== generation) break;

    const pending = translationQueue.splice(0, translationQueue.length);
    const validItems: QueueItem[] = [];

    for (const item of pending) {
      const element = document.querySelector(`[data-dst-original="${item.id}"]`) as HTMLElement;
      if (!element) continue;
      if (element.hasAttribute('data-dst-translated')) continue;
      validItems.push(item);
    }

    if (validItems.length === 0) continue;

    const cacheMap = await getCachedTranslationsBatch(validItems.map(item => item.text));
    if (translationGeneration !== generation) break;

    const uncached: QueueItem[] = [];

    for (const item of validItems) {
      const cached = cacheMap.get(item.text);
      if (cached) {
        if (!showOriginalMode) {
          replaceWithTranslation(item.id, cached, item.childMap);
        }
        continue;
      }
      showLoading(item.id);
      uncached.push(item);
    }

    if (uncached.length === 0) continue;
    if (translationGeneration !== generation) break;

    const batches = buildBatches(uncached, maxChars);

    for (let i = 0; i < batches.length; i += concurrency) {
      if (translationGeneration !== generation) break;

      const group = batches.slice(i, i + concurrency);

      const promises = group.map((batch) => {
        const batchId = Math.random().toString(36).substring(2, 15);
        return chrome.runtime.sendMessage({
          type: 'TRANSLATE_BATCH',
          payload: {
            batchId,
            items: batch.map((item) => ({
              id: item.id,
              text: item.text,
              targetLang: currentConfig.targetLang,
              context: item.context,
            })),
            pageSummary: currentPageSummary,
          },
        }).then((response: any) => ({ batch, response }));
      });

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;

        const { batch, response } = result.value;

        if (response.error) {
          for (const item of batch) {
            hideLoading(item.id);
            if (translationGeneration === generation && !showOriginalMode) {
              showError(response.error);
            }
          }
          continue;
        }

        const translatedItems: Array<{ id: string; translatedText?: string; error?: string }> = response.results || [];
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const tr = translatedItems[j];
          hideLoading(item.id);
          if (tr?.translatedText) {
            await setCachedTranslation(item.text, tr.translatedText);
            if (generation === translationGeneration && !showOriginalMode) {
              replaceWithTranslation(item.id, tr.translatedText, item.childMap);
            }
          }
        }
      }
    }
  }

  if (translationGeneration === generation) {
    isProcessingQueue = false;
  }
}

function handleScroll(): void {
  if (scrollTimer) {
    clearTimeout(scrollTimer);
  }
  scrollTimer = window.setTimeout(() => {
    collectVisibleElements();
    processQueue(translationGeneration);
  }, 300);
}

async function fetchPageSummary(config: any): Promise<string | null> {
  if (!config.pageSummary) return null;

  if (currentPageSummary) return currentPageSummary;

  const pageText = extractPageTextForSummary();
  if (!pageText) return null;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PAGE_SUMMARY',
      payload: { url: window.location.href, pageText },
    });
    if (response?.summary) {
      currentPageSummary = response.summary;
      return currentPageSummary;
    }
  } catch {}

  return null;
}

async function handleTranslatePage(): Promise<void> {
  if (isTranslating) {
    showError('正在翻译中，请稍候...');
    return;
  }

  const config = await getConfig();
  if (!config.apiKey) {
    showError('请先在设置中配置 DeepSeek API Key');
    return;
  }

  if (showOriginalMode) {
    showOriginalMode = false;
    reapplyTranslation();
  }

  const generation = ++translationGeneration;
  isTranslating = true;
  currentConfig = config;

  try {
    translationQueue = [];
    queuedIds.clear();

    currentPageSummary = await fetchPageSummary(config);

    collectVisibleElements();

    if (translationQueue.length === 0 && getTranslatedCount() === 0) {
      showError('未找到可翻译的文本');
      return;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    await processQueue(generation);
  } catch (error) {
    showError(error instanceof Error ? error.message : '翻译失败');
  } finally {
    if (translationGeneration === generation) {
      isTranslating = false;
    }
  }
}

async function handleTranslateOrToggle(): Promise<void> {
  if (isTranslating && !showOriginalMode) {
    showOriginalMode = true;
    cancelTranslation();
    toggleOriginalTranslation();
    return;
  }

  if (showOriginalMode) {
    showOriginalMode = false;
    reapplyTranslation();
    resetUnclaimedElements();
    await handleTranslatePage();
    return;
  }

  if (getTranslatedCount() > 0) {
    toggleOriginalTranslation();
    showOriginalMode = !showOriginalMode;
    return;
  }

  await handleTranslatePage();
}

async function handleTranslateSelection(): Promise<void> {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    showError('请先选中要翻译的文本');
    return;
  }
  const text = selection.toString().trim();
  if (!text || text.length < 2) {
    showError('请先选中要翻译的文本');
    return;
  }

  const config = await getConfig();
  if (!config.apiKey) {
    showError('请先在设置中配置 DeepSeek API Key');
    return;
  }

  if (!currentPageSummary && config.pageSummary) {
    currentPageSummary = await fetchPageSummary(config);
  }

  try {
    const cached = await getCachedTranslation(text);
    if (cached) {
      showTranslationPopup(text, cached);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_SELECTION',
      payload: { text, targetLang: config.targetLang, pageSummary: currentPageSummary },
    });

    if (response.error) {
      showError(response.error);
    } else if (response.translatedText) {
      await setCachedTranslation(text, response.translatedText);
      showTranslationPopup(text, response.translatedText);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : '翻译失败');
  }
}

function showTranslationPopup(original: string, translated: string): void {
  const existing = document.getElementById('dst-selection-popup');
  if (existing) existing.remove();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const popup = document.createElement('div');
  popup.id = 'dst-selection-popup';
  popup.className = 'dst-popup';
  popup.innerHTML = `
    <div class="dst-popup-header">
      <span class="dst-popup-title">翻译结果</span>
      <button class="dst-popup-close">&times;</button>
    </div>
    <div class="dst-popup-content">
      <div class="dst-popup-original">${original}</div>
      <div class="dst-popup-divider"></div>
      <div class="dst-popup-translated">${translated}</div>
    </div>
  `;

  popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(popup);

  popup.querySelector('.dst-popup-close')?.addEventListener('click', () => {
    popup.remove();
  });

  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
    }
  }, { once: true });
}

async function handleAutoTranslate(): Promise<void> {
  const config = await getConfig();
  if (!config.autoTranslate || !config.apiKey) return;

  if (shouldAutoTranslate(config.targetLang)) {
    await handleTranslatePage();
  }
}

async function handleClearSiteCache(): Promise<void> {
  const domain = window.location.hostname;
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      const keysToRemove: string[] = [];
      for (const key of Object.keys(all)) {
        if (key.startsWith(`cache_${domain}_`)) {
          keysToRemove.push(key);
        }
      }
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, resolve);
      } else {
        resolve();
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'TRANSLATE_PAGE':
      handleTranslatePage().then(() => sendResponse({ success: true }));
      return true;

    case 'TRANSLATE_OR_TOGGLE':
      handleTranslateOrToggle().then(() => sendResponse({ success: true }));
      return true;

    case 'TRANSLATE_SELECTION':
      handleTranslateSelection().then(() => sendResponse({ success: true }));
      return true;

    case 'TOGGLE_ORIGINAL':
      if (isTranslating && !showOriginalMode) {
        showOriginalMode = true;
        cancelTranslation();
        toggleOriginalTranslation();
      } else if (showOriginalMode) {
        showOriginalMode = false;
        reapplyTranslation();
        resetUnclaimedElements();
        handleTranslatePage();
      } else if (getTranslatedCount() > 0) {
        toggleOriginalTranslation();
        showOriginalMode = !showOriginalMode;
      }
      sendResponse({ success: true });
      return false;

    case 'CLEAR_TRANSLATIONS':
      cancelTranslation();
      showOriginalMode = false;
      clearAllTranslations();
      sendResponse({ success: true });
      return false;

    case 'CLEAR_SITE_CACHE':
      handleClearSiteCache().then(() => sendResponse({ success: true }));
      return true;

    case 'START_PICKER':
      enterPickerMode();
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
});

async function prefetchAllPageSummary(): Promise<void> {
  const config = await getConfig();
  if (!config.pageSummary || !config.apiKey) return;
  currentPageSummary = await fetchPageSummary(config);
}

handleAutoTranslate();
prefetchAllPageSummary();

function matchUrlPattern(url: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexStr}$`, 'i');
  return regex.test(url);
}

let pickerActive = false;
let pickerOverlay: HTMLElement | null = null;
let pickerHoverEl: HTMLElement | null = null;
let highlightedElements: Element[] = [];

function generateSelector(el: Element): { precise: string; broad: string } {
  if (el.id) return { precise: `#${CSS.escape(el.id)}`, broad: `#${CSS.escape(el.id)}` };

  const preciseParts: string[] = [];
  const broadParts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement && current !== document.body) {
    let part = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('dst-'));
      if (classes.length > 0) {
        part += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    preciseParts.unshift(part);
    broadParts.unshift(part.replace(/:nth-of-type\(\d+\)/g, ''));

    const testSelector = preciseParts.join(' > ');
    try {
      if (document.querySelectorAll(testSelector).length === 1) {
        return { precise: testSelector, broad: broadParts.join(' > ') };
      }
    } catch {}

    current = current.parentElement;
  }

  return { precise: preciseParts.join(' > '), broad: broadParts.join(' > ') };
}

function clearPickerHighlight(): void {
  if (pickerHoverEl) {
    pickerHoverEl.classList.remove('dst-picker-hover');
    pickerHoverEl = null;
  }
}

function clearSelectorHighlight(): void {
  for (const el of highlightedElements) {
    el.classList.remove('dst-selector-highlight');
  }
  highlightedElements = [];
}

function updateSelectorHighlight(selector: string): number {
  clearSelectorHighlight();
  try {
    const els = document.querySelectorAll(selector);
    els.forEach(el => el.classList.add('dst-selector-highlight'));
    highlightedElements = Array.from(els);
    return els.length;
  } catch {
    return 0;
  }
}

function showSelectorEditor(preciseSelector: string, broadSelector: string, clickedEl: Element): void {
  if (pickerOverlay) pickerOverlay.remove();
  document.body.classList.remove('dst-picker-active');

  const overlay = document.createElement('div');
  overlay.id = 'dst-picker-overlay';
  overlay.className = 'dst-picker-overlay';

  const rect = clickedEl.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const spaceBelow = viewportH - rect.bottom;
  const positionTop = spaceBelow > 200 ? rect.bottom + window.scrollY + 10 : Math.max(rect.top + window.scrollY - 260, 10);

  overlay.style.top = `${positionTop}px`;
  overlay.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 340 + window.scrollX)}px`;

  const matchCount = updateSelectorHighlight(preciseSelector);
  const currentHostname = window.location.hostname;

  overlay.innerHTML = `
    <div class="dst-picker-overlay-title">选择器编辑器</div>
    <div class="dst-picker-overlay-hint">点击元素生成了以下 CSS 选择器，您可以手动编辑：</div>
    <label class="dst-picker-overlay-checkbox-label">
      <input type="checkbox" class="dst-picker-overlay-broad" />
      <span>选择相似元素（去除索引选择器）</span>
    </label>
    <input type="text" class="dst-picker-overlay-input" />
    <div class="dst-picker-overlay-count">匹配到 <span class="dst-picker-overlay-count-num">${matchCount}</span> 个元素</div>
    <div class="dst-picker-overlay-scope">
      <div class="dst-picker-overlay-scope-label">应用范围：</div>
      <label class="dst-picker-overlay-radio-label">
        <input type="radio" name="dst-scope" value="site" checked />
        <span>当前网站 (${currentHostname})</span>
      </label>
      <label class="dst-picker-overlay-radio-label">
        <input type="radio" name="dst-scope" value="global" />
        <span>所有网站（全局）</span>
      </label>
    </div>
    <div class="dst-picker-overlay-actions">
      <button class="dst-picker-overlay-btn dst-picker-overlay-cancel">取消</button>
      <button class="dst-picker-overlay-btn dst-picker-overlay-confirm">确认</button>
    </div>
  `;

  const input = overlay.querySelector('.dst-picker-overlay-input') as HTMLInputElement;
  input.value = preciseSelector;

  const broadCheckbox = overlay.querySelector('.dst-picker-overlay-broad') as HTMLInputElement;

  document.body.appendChild(overlay);
  pickerOverlay = overlay;

  const countNum = overlay.querySelector('.dst-picker-overlay-count-num') as HTMLSpanElement;
  const confirmBtn = overlay.querySelector('.dst-picker-overlay-confirm') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('.dst-picker-overlay-cancel') as HTMLButtonElement;

  broadCheckbox.addEventListener('change', () => {
    if (broadCheckbox.checked) {
      input.value = broadSelector;
    } else {
      input.value = preciseSelector;
    }
    const count = updateSelectorHighlight(input.value);
    countNum.textContent = String(count);
  });

  input.addEventListener('input', () => {
    const count = updateSelectorHighlight(input.value);
    countNum.textContent = String(count);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelBtn.click();
    }
  });

  confirmBtn.addEventListener('click', async () => {
    const finalSelector = input.value.trim();
    if (!finalSelector) {
      exitPickerMode();
      return;
    }
    const config = await getConfig();
    const scopeRadio = overlay.querySelector('input[name="dst-scope"]:checked') as HTMLInputElement;
    const scope = scopeRadio?.value || 'site';

    if (scope === 'global') {
      const existing = config.globalExcludeSelectors ? config.globalExcludeSelectors.trim() : '';
      const updated = existing ? `${existing}, ${finalSelector}` : finalSelector;
      await chrome.storage.sync.set({ config: { ...config, globalExcludeSelectors: updated } });
    } else {
      const currentUrl = window.location.href;
      const siteRules = config.siteExcludeRules ? [...config.siteExcludeRules] : [];
      const existingRuleIndex = siteRules.findIndex(rule => matchUrlPattern(currentUrl, rule.pattern));

      if (existingRuleIndex >= 0) {
        const existingSelectors = siteRules[existingRuleIndex].selectors ? siteRules[existingRuleIndex].selectors.trim() : '';
        siteRules[existingRuleIndex].selectors = existingSelectors ? `${existingSelectors}, ${finalSelector}` : finalSelector;
      } else {
        siteRules.push({ pattern: currentUrl, selectors: finalSelector });
      }

      await chrome.storage.sync.set({ config: { ...config, siteExcludeRules: siteRules } });
    }
    exitPickerMode();
  });

  cancelBtn.addEventListener('click', () => {
    exitPickerMode();
  });

  input.focus();
  input.select();
}

function exitPickerMode(): void {
  pickerActive = false;
  clearPickerHighlight();
  clearSelectorHighlight();
  if (pickerOverlay) {
    pickerOverlay.remove();
    pickerOverlay = null;
  }
  document.body.classList.remove('dst-picker-active');
  document.removeEventListener('mousemove', pickerMouseMoveHandler);
  document.removeEventListener('click', pickerClickHandler, true);
  document.removeEventListener('keydown', pickerKeyDownHandler);
}

function pickerMouseMoveHandler(e: MouseEvent): void {
  if (!pickerActive) return;
  const target = e.target as HTMLElement;
  if (target === document.body || target === document.documentElement) return;
  if (target.closest('#dst-picker-overlay')) return;

  clearPickerHighlight();
  pickerHoverEl = target;
  target.classList.add('dst-picker-hover');
}

function pickerClickHandler(e: MouseEvent): void {
  if (!pickerActive) return;
  e.preventDefault();
  e.stopPropagation();

  const target = e.target as HTMLElement;
  if (target.closest('#dst-picker-overlay')) return;

  clearPickerHighlight();
  document.removeEventListener('mousemove', pickerMouseMoveHandler);
  document.removeEventListener('click', pickerClickHandler, true);

  const selector = generateSelector(target);
  showSelectorEditor(selector.precise, selector.broad, target);
}

function pickerKeyDownHandler(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    exitPickerMode();
  }
}

function enterPickerMode(): void {
  if (pickerActive) {
    exitPickerMode();
    return;
  }
  pickerActive = true;
  document.body.classList.add('dst-picker-active');
  document.addEventListener('mousemove', pickerMouseMoveHandler);
  document.addEventListener('click', pickerClickHandler, true);
  document.addEventListener('keydown', pickerKeyDownHandler);
}
