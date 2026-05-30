import { DEEPSEEK_API_URL, MAX_RETRIES, RETRY_BASE_DELAY } from '../lib/constants';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callDeepSeekAPI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  enableThinking: boolean = false,
  retries: number = MAX_RETRIES
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const body: any = {
        model,
        messages,
        stream: false,
      };

      if (enableThinking) {
        body.thinking = { type: 'enabled' };
      } else {
        body.thinking = { type: 'disabled' };
      }

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API 请求失败 (${response.status}): ${errorBody}`);
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.error) {
        throw new Error(`API 错误: ${data.error.message}`);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error('API 返回为空');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      console.warn(`API 调用失败，${delay}ms 后重试 (${attempt + 1}/${retries}):`, error);
      await sleep(delay);
    }
  }

  throw new Error('翻译失败：超过最大重试次数');
}

export function buildTranslationPrompt(
  text: string,
  targetLang: string,
  context?: string
): ChatMessage[] {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `你是一个专业的翻译引擎。请将用户提供的文本翻译成${targetLang}。规则：
1. 只输出翻译结果，不要添加任何解释、注释或原文
2. 保持原文的格式（如换行、标点等）
3. 如果原文是代码、URL、数字等不需要翻译的内容，直接原样输出
4. 如果文本太短或无法翻译，直接原样输出`
  };

  let userContent = text;
  if (context) {
    userContent = `上下文信息：\n${context}\n\n待翻译文本：\n${text}`;
  }

  return [
    systemMessage,
    { role: 'user', content: userContent }
  ];
}
