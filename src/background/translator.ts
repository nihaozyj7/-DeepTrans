import { callDeepSeekAPI, buildTranslationPrompt } from './api';
import { MAX_BATCH_CHARS, MAX_BATCH_ELEMENTS } from '../lib/constants';
import { TranslateRequest, TranslateResponse, BatchTranslateRequest, BatchTranslateResponse } from '../lib/types';
import { getConfig } from '../lib/config';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function splitIntoBatches(items: TranslateRequest[]): TranslateRequest[][] {
  const batches: TranslateRequest[][] = [];
  let currentBatch: TranslateRequest[] = [];
  let currentChars = 0;

  for (const item of items) {
    if (
      currentBatch.length >= MAX_BATCH_ELEMENTS ||
      (currentBatch.length > 0 && currentChars + item.text.length > MAX_BATCH_CHARS)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(item);
    currentChars += item.text.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function mergeBatchTexts(items: TranslateRequest[]): string {
  return items.map((item, index) => `[${index + 1}] ${item.text}`).join('\n\n');
}

function splitTranslatedText(translated: string, count: number): string[] {
  const results: string[] = [];
  const regex = /\[(\d+)\]\s*/g;
  let match;

  const matches: Array<{ index: number; end: number }> = [];
  while ((match = regex.exec(translated)) !== null) {
    matches.push({ index: parseInt(match[1]) - 1, end: match.index + match[0].length });
  }

  if (matches.length === 0) {
    const parts = translated.split(/\n\n+/);
    for (let i = 0; i < count; i++) {
      results.push(parts[i] || '');
    }
    return results;
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? translated.lastIndexOf('\n\n', matches[i + 1].end - 5) || matches[i + 1].end : translated.length;
    results[matches[i].index] = translated.substring(start, end).trim();
  }

  for (let i = 0; i < count; i++) {
    if (!results[i]) {
      results[i] = '';
    }
  }

  return results;
}

export async function translateBatch(
  request: BatchTranslateRequest
): Promise<BatchTranslateResponse> {
  const config = await getConfig();

  if (!config.apiKey) {
    return {
      batchId: request.batchId,
      results: request.items.map(item => ({
        id: item.id,
        error: '请先在设置中配置 DeepSeek API Key',
      })),
    };
  }

  const items = request.items;
  const mergedText = mergeBatchTexts(items);
  const context = items[0]?.context;

  const messages = buildTranslationPrompt(mergedText, config.targetLang, context);

  try {
    const translated = await callDeepSeekAPI(config.apiKey, config.model, messages, config.enableThinking);
    const parts = splitTranslatedText(translated, items.length);

    return {
      batchId: request.batchId,
      results: items.map((item, index) => ({
        id: item.id,
        translatedText: parts[index] || item.text,
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '翻译失败';
    return {
      batchId: request.batchId,
      results: items.map(item => ({
        id: item.id,
        error: errorMessage,
      })),
    };
  }
}

export async function translateAll(items: TranslateRequest[]): Promise<TranslateResponse[]> {
  const batches = splitIntoBatches(items);
  const allResults: TranslateResponse[] = [];

  for (const batch of batches) {
    const batchRequest: BatchTranslateRequest = {
      batchId: generateId(),
      items: batch,
    };

    const batchResponse = await translateBatch(batchRequest);
    allResults.push(...batchResponse.results);
  }

  return allResults;
}

export { splitIntoBatches, generateId };
