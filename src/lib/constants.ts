export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY = 1000;

export const ATTR_ORIGINAL = 'data-dst-original';
export const ATTR_TRANSLATED = 'data-dst-translated';

export const DEFAULT_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption';

export const LANGUAGE_OPTIONS = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
  { code: 'it', name: 'Italiano' },
];

export const MODEL_OPTIONS = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (快速)' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (高质量)' },
];