const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  'zh': /[\u4e00-\u9fff]/,
  'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
  'ko': /[\uac00-\ud7af\u1100-\u11ff]/,
  'ar': /[\u0600-\u06ff]/,
  'ru': /[\u0400-\u04ff]/,
  'th': /[\u0e00-\u0e7f]/,
};

export function detectTextLanguage(text: string): string | null {
  const cleanText = text.replace(/[\s\d\p{P}]/gu, '');
  if (cleanText.length < 10) return null;

  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    const matches = cleanText.match(new RegExp(pattern.source, 'g'));
    if (matches && matches.length / cleanText.length > 0.3) {
      return lang;
    }
  }

  if (/^[a-zA-Z\s]+$/.test(cleanText)) {
    return 'en';
  }

  return null;
}

export function detectPageLanguage(): string | null {
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    return htmlLang.split('-')[0].toLowerCase();
  }

  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang) {
    const content = metaLang.getAttribute('content');
    if (content) return content.split('-')[0].toLowerCase();
  }

  const bodyText = document.body.innerText.substring(0, 2000);
  return detectTextLanguage(bodyText);
}

export function shouldAutoTranslate(targetLang: string): boolean {
  const pageLang = detectPageLanguage();
  if (!pageLang) return false;

  const targetBase = targetLang.split('-')[0].toLowerCase();
  return pageLang !== targetBase;
}
