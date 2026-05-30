// 用户配置
export interface UserConfig {
  apiKey: string;
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro';
  targetLang: string;
  autoTranslate: boolean;
  translateMode: 'full' | 'smart' | 'selection';
  customSelectors: string;
  useContext: boolean;
  showContextMenu: boolean;
  enableThinking: boolean;
}

// 翻译请求
export interface TranslateRequest {
  id: string;
  text: string;
  context?: string;
  sourceLang?: string;
  targetLang: string;
}

// 翻译响应
export interface TranslateResponse {
  id: string;
  translatedText?: string;
  error?: string;
}

// 批次翻译请求
export interface BatchTranslateRequest {
  batchId: string;
  items: TranslateRequest[];
}

// 批次翻译响应
export interface BatchTranslateResponse {
  batchId: string;
  results: TranslateResponse[];
}

// 消息类型
export type MessageType =
  | 'TRANSLATE_SELECTION'
  | 'TRANSLATE_PAGE'
  | 'TRANSLATE_SMART'
  | 'TOGGLE_ORIGINAL'
  | 'TRANSLATE_BATCH'
  | 'TRANSLATE_RESULT'
  | 'TRANSLATE_ERROR'
  | 'GET_CONFIG'
  | 'UPDATE_CONFIG'
  | 'GET_STATUS'
  | 'TRANSLATION_COMPLETE'
  | 'CLEAR_TRANSLATIONS';

// 消息
export interface Message {
  type: MessageType;
  payload?: any;
}

// 翻译状态
export interface TranslationStatus {
  isTranslating: boolean;
  totalElements: number;
  translatedElements: number;
  currentBatch: number;
  totalBatches: number;
}

// DOM 元素翻译信息
export interface ElementTranslationInfo {
  originalText: string;
  translatedText: string;
  isTranslated: boolean;
}

// 语言选项
export interface LanguageOption {
  code: string;
  name: string;
}