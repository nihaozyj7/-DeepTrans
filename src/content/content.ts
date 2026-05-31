import { extractPageElements, buildTranslateRequests } from './extractor';
import { replaceWithTranslation, toggleOriginalTranslation, showError, showLoading, hideLoading, clearAllTranslations, getTranslatedCount } from './replacer';
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
    currentConfig.onlyTranslateVisible
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

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  const maxChars = currentConfig?.maxCharsPerBatch || 100;
  const concurrency = currentConfig?.concurrency || 5;

  while (translationQueue.length > 0) {
    const pending = translationQueue.splice(0, translationQueue.length);
    const uncached: QueueItem[] = [];

    for (const item of pending) {
      const element = document.querySelector(`[data-dst-original="${item.id}"]`) as HTMLElement;
      if (!element) continue;
      if (element.hasAttribute('data-dst-translated')) continue;

      const cached = await getCachedTranslation(item.text);
      if (cached) {
        replaceWithTranslation(item.id, cached, item.childMap);
        continue;
      }

      showLoading(item.id);
      uncached.push(item);
    }

    if (uncached.length === 0) continue;

    const batches = buildBatches(uncached, maxChars);

    for (let i = 0; i < batches.length; i += concurrency) {
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
            showError(response.error);
          }
          continue;
        }

        const translatedItems: Array<{ id: string; translatedText?: string; error?: string }> = response.results || [];
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const tr = translatedItems[j];
          hideLoading(item.id);
          if (tr?.error) {
            showError(tr.error);
          } else if (tr?.translatedText) {
            await setCachedTranslation(item.text, tr.translatedText);
            replaceWithTranslation(item.id, tr.translatedText, item.childMap);
          }
        }
      }
    }
  }

  isProcessingQueue = false;
}

function handleScroll(): void {
  if (scrollTimer) {
    clearTimeout(scrollTimer);
  }
  scrollTimer = window.setTimeout(() => {
    collectVisibleElements();
    processQueue();
  }, 300);
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

  isTranslating = true;
  currentConfig = config;

  try {
    translationQueue = [];
    queuedIds.clear();

    collectVisibleElements();

    if (translationQueue.length === 0) {
      showError('未找到可翻译的文本');
      return;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    await processQueue();
  } catch (error) {
    showError(error instanceof Error ? error.message : '翻译失败');
  } finally {
    isTranslating = false;
  }
}

async function handleTranslateOrToggle(): Promise<void> {
  if (isTranslating) {
    return;
  }

  if (getTranslatedCount() > 0) {
    toggleOriginalTranslation();
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

  try {
    const cached = await getCachedTranslation(text);
    if (cached) {
      showTranslationPopup(text, cached);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_SELECTION',
      payload: { text, targetLang: config.targetLang },
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
      toggleOriginalTranslation();
      sendResponse({ success: true });
      return false;

    case 'CLEAR_TRANSLATIONS':
      window.removeEventListener('scroll', handleScroll);
      translationQueue = [];
      queuedIds.clear();
      isTranslating = false;
      isProcessingQueue = false;
      clearAllTranslations();
      sendResponse({ success: true });
      return false;

    case 'CLEAR_SITE_CACHE':
      handleClearSiteCache().then(() => sendResponse({ success: true }));
      return true;

    default:
      return false;
  }
});

handleAutoTranslate();
