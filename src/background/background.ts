import { translateBatch, translateSingle } from './translator';
import { setupContextMenus, handleContextMenuClick } from './menu';
import { callDeepSeekAPI, buildTranslationPrompt } from './api';
import { getConfig } from '../lib/config';
import { Message, BatchTranslateRequest } from '../lib/types';

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
      translateBatch(request).then(sendResponse);
      return true;
    }

    case 'TRANSLATE_SELECTION': {
      const { text, targetLang } = message.payload;
      getConfig().then(async (config) => {
        if (!config.apiKey) {
          sendResponse({ error: '请先在设置中配置 DeepSeek API Key' });
          return;
        }
        try {
          const messages = buildTranslationPrompt(text, targetLang);
          const translated = await callDeepSeekAPI(config.apiKey, config.model, messages, config.enableThinking);
          sendResponse({ translatedText: translated });
        } catch (error) {
          sendResponse({ error: error instanceof Error ? error.message : '翻译失败' });
        }
      });
      return true;
    }

    case 'TRANSLATE_SINGLE': {
      const { text, targetLang, context } = message.payload;
      translateSingle(text, targetLang, context)
        .then((translatedText) => sendResponse({ translatedText }))
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : '翻译失败' }));
      return true;
    }

    case 'GET_CONFIG': {
      getConfig().then(sendResponse);
      return true;
    }

    default:
      return false;
  }
});
