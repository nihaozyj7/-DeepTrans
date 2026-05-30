import { extractPageElements, extractSelection, buildTranslateRequests } from './extractor';
import { replaceWithTranslation, toggleOriginalTranslation, showError, showLoading, hideLoading, clearAllTranslations } from './replacer';
import { shouldAutoTranslate } from './detector';
import { TranslateRequest, TranslateResponse, Message } from '../lib/types';
import { getConfig } from '../lib/config';

let isTranslating = false;

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

  try {
    const elements = extractPageElements(config.customSelectors);
    if (elements.length === 0) {
      showError('未找到可翻译的文本');
      return;
    }

    const requests = buildTranslateRequests(elements, config.useContext);
    for (const req of requests) {
      req.targetLang = config.targetLang;
      showLoading(req.id);
    }

    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      payload: { items: requests },
    });

    if (response.error) {
      showError(response.error);
      return;
    }

    const results: TranslateResponse[] = response.results;
    for (const result of results) {
      hideLoading(result.id);
      if (result.error) {
        showError(result.error);
      } else if (result.translatedText) {
        replaceWithTranslation(result.id, result.translatedText);
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : '翻译失败');
  } finally {
    isTranslating = false;
  }
}

async function handleTranslateSelection(): Promise<void> {
  const text = extractSelection();
  if (!text) {
    showError('请先选中要翻译的文本');
    return;
  }

  const config = await getConfig();
  if (!config.apiKey) {
    showError('请先在设置中配置 DeepSeek API Key');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_SELECTION',
      payload: { text, targetLang: config.targetLang },
    });

    if (response.error) {
      showError(response.error);
    } else if (response.translatedText) {
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

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'TRANSLATE_PAGE':
      handleTranslatePage().then(() => sendResponse({ success: true }));
      return true;

    case 'TRANSLATE_SELECTION':
      handleTranslateSelection().then(() => sendResponse({ success: true }));
      return true;

    case 'TOGGLE_ORIGINAL':
      toggleOriginalTranslation();
      sendResponse({ success: true });
      return false;

    case 'CLEAR_TRANSLATIONS':
      clearAllTranslations();
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
});

handleAutoTranslate();
