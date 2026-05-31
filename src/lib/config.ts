import { UserConfig } from './types';

const DEFAULT_CONFIG: UserConfig = {
  apiKey: '',
  model: 'deepseek-v4-flash',
  targetLang: 'zh-CN',
  autoTranslate: false,
  translateMode: 'smart',
  customSelectors: 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, span, a, label, button',
  useContext: false,
  showContextMenu: true,
  enableThinking: false,
  globalExcludeSelectors: 'code, pre, script, style, noscript, iframe, svg, math, .notranslate, [contenteditable="false"]',
  siteExcludeRules: [],
  maxCharsPerBatch: 2000,
  concurrency: 3,
  onlyTranslateVisible: true,
};

export async function getConfig(): Promise<UserConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('config', (result) => {
      resolve({ ...DEFAULT_CONFIG, ...(result.config || {}) });
    });
  });
}

export async function updateConfig(partial: Partial<UserConfig>): Promise<void> {
  const current = await getConfig();
  const newConfig = { ...current, ...partial };
  return new Promise((resolve) => {
    chrome.storage.sync.set({ config: newConfig }, resolve);
  });
}

export { DEFAULT_CONFIG };
