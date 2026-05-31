import { callDeepSeekAPI, buildTranslationPrompt, buildBatchTranslationPrompt } from './api';
import { TranslateRequest, TranslateResponse, BatchTranslateRequest, BatchTranslateResponse } from '../lib/types';
import { getConfig } from '../lib/config';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function splitIntoBatches(items: TranslateRequest[], maxChars: number): TranslateRequest[][] {
  const batches: TranslateRequest[][] = [];
  let currentBatch: TranslateRequest[] = [];
  let currentChars = 0;

  for (const item of items) {
    if (item.text.length >= maxChars) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentChars = 0;
      }
      batches.push([item]);
      continue;
    }

    if (currentBatch.length > 0 && currentChars + item.text.length > maxChars) {
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

function splitTranslatedText(translated: string, count: number): string[] {
  const parts = translated.split(/\n\n+/);
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push((parts[i] || '').trim());
  }
  return results;
}

export async function translateSingle(
  text: string,
  targetLang: string,
  context?: string
): Promise<string> {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key');
  }

  const messages = buildTranslationPrompt(text, targetLang, context);
  return callDeepSeekAPI(config.apiKey, config.model, messages, config.enableThinking);
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
  const texts = items.map(item => item.text);
  const context = items[0]?.context;

  const messages = buildBatchTranslationPrompt(texts, config.targetLang, context);

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

export async function translateAll(
  items: TranslateRequest[],
  onProgress?: (translated: number, total: number) => void
): Promise<TranslateResponse[]> {
  const config = await getConfig();
  const maxChars = config.maxCharsPerBatch || 100;
  const concurrency = config.concurrency || 3;

  const batches = splitIntoBatches(items, maxChars);
  const allResults: TranslateResponse[] = [];
  let completedBatches = 0;

  for (let i = 0; i < batches.length; i += concurrency) {
    const batchGroup = batches.slice(i, i + concurrency);
    const batchPromises = batchGroup.map(batch => {
      const batchRequest: BatchTranslateRequest = {
        batchId: generateId(),
        items: batch,
      };
      return translateBatch(batchRequest);
    });

    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      allResults.push(...result.results);
      completedBatches++;
      if (onProgress) {
        onProgress(completedBatches, batches.length);
      }
    }
  }

  return allResults;
}

export { splitIntoBatches, generateId };
