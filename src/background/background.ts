import { translateBatch, translateSingle } from './translator';
import { setupContextMenus, handleContextMenuClick } from './menu';
import { callDeepSeekAPI, buildTranslationPrompt, buildPageSummaryPrompt } from './api';
import { getConfig } from '../lib/config';
import { Message, BatchTranslateRequest } from '../lib/types';

async function getOrGeneratePageSummary(url: string, pageText: string): Promise<string | null> {
  const cacheKey = `summary_${new URL(url).hostname}_${simpleHash(url)}`;
  const cached = await new Promise<string | null>((resolve) => {
    chrome.storage.local.get(cacheKey, (result) => {
      const entry = result[cacheKey];
      if (entry && entry.summary && Date.now() - entry.timestamp < 3600000) {
        resolve(entry.summary);
      } else {
        resolve(null);
      }
    });
  });

  if (cached) return cached;

  const config = await getConfig();
  if (!config.apiKey) return null;

  const truncatedText = pageText.slice(0, 1500);
  const messages = buildPageSummaryPrompt(truncatedText);

  try {
    const summary = await callDeepSeekAPI(config.apiKey, config.model, messages, false);
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({
        [cacheKey]: { summary, timestamp: Date.now() },
      }, resolve);
    });
    return summary;
  } catch {
    return null;
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.config) {
    setupContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_OR_TOGGLE' });
    }
  }
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'TRANSLATE_BATCH': {
      const request: BatchTranslateRequest = {
        batchId: Math.random().toString(36).substring(2, 15),
        items: message.payload.items,
      };
      const pageSummary: string | undefined = message.payload.pageSummary;
      translateBatch(request, pageSummary).then(sendResponse);
      return true;
    }

    case 'TRANSLATE_SELECTION': {
      const { text, targetLang, pageSummary } = message.payload;
      getConfig().then(async (config) => {
        if (!config.apiKey) {
          sendResponse({ error: '请先在设置中配置 DeepSeek API Key' });
          return;
        }
        try {
          const messages = buildTranslationPrompt(text, targetLang, undefined, pageSummary);
          const translated = await callDeepSeekAPI(config.apiKey, config.model, messages, config.enableThinking);
          sendResponse({ translatedText: translated });
        } catch (error) {
          sendResponse({ error: error instanceof Error ? error.message : '翻译失败' });
        }
      });
      return true;
    }

    case 'TRANSLATE_SINGLE': {
      const { text, targetLang, context, pageSummary } = message.payload;
      translateSingle(text, targetLang, context, pageSummary)
        .then((translatedText) => sendResponse({ translatedText }))
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : '翻译失败' }));
      return true;
    }

    case 'GET_CONFIG': {
      getConfig().then(sendResponse);
      return true;
    }

    case 'GET_PAGE_SUMMARY': {
      const { url, pageText } = message.payload;
      getOrGeneratePageSummary(url, pageText).then((summary) => {
        sendResponse({ summary });
      });
      return true;
    }

    default:
      return false;
  }
});
