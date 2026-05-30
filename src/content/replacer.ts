import { ATTR_ORIGINAL, ATTR_TRANSLATED } from '../lib/constants';

interface TranslatedElement {
  element: HTMLElement;
  originalHTML: string;
  translatedText: string;
  isShowingTranslation: boolean;
}

const translatedElements = new Map<string, TranslatedElement>();

function replaceTextNodes(element: HTMLElement, translatedText: string): void {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
  );

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && node.textContent.trim().length > 0) {
      textNodes.push(node as Text);
    }
  }

  if (textNodes.length === 0) return;

  if (textNodes.length === 1) {
    textNodes[0].textContent = translatedText;
    return;
  }

  const originalTexts = textNodes.map(n => n.textContent || '');
  const totalLength = originalTexts.reduce((sum, t) => sum + t.length, 0);

  let translatedParts: string[];
  if (totalLength <= translatedText.length) {
    translatedParts = [];
    let remaining = translatedText;
    for (let i = 0; i < textNodes.length - 1; i++) {
      const ratio = originalTexts[i].length / totalLength;
      const partLength = Math.round(translatedText.length * ratio);
      translatedParts.push(remaining.substring(0, partLength));
      remaining = remaining.substring(partLength);
    }
    translatedParts.push(remaining);
  } else {
    translatedParts = [translatedText];
    for (let i = 1; i < textNodes.length; i++) {
      translatedParts.push('');
    }
  }

  for (let i = 0; i < textNodes.length; i++) {
    textNodes[i].textContent = translatedParts[i] || '';
  }
}

export function replaceWithTranslation(
  elementId: string,
  translatedText: string
): void {
  const element = document.querySelector(`[${ATTR_ORIGINAL}="${elementId}"]`) as HTMLElement;
  if (!element) return;

  const originalHTML = element.innerHTML;

  translatedElements.set(elementId, {
    element,
    originalHTML,
    translatedText,
    isShowingTranslation: true,
  });

  element.setAttribute(ATTR_TRANSLATED, elementId);

  replaceTextNodes(element, translatedText);
}

export function toggleOriginalTranslation(): void {
  translatedElements.forEach((info, id) => {
    if (info.isShowingTranslation) {
      info.element.innerHTML = info.originalHTML;
      info.isShowingTranslation = false;
    } else {
      replaceTextNodes(info.element, info.translatedText);
      info.isShowingTranslation = true;
    }
  });
}

export function showError(message: string): void {
  const existing = document.getElementById('dst-error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'dst-error-toast';
  toast.className = 'dst-toast dst-error';
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('dst-show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('dst-show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

export function showLoading(elementId: string): void {
  const element = document.querySelector(`[${ATTR_ORIGINAL}="${elementId}"]`) as HTMLElement;
  if (!element) return;

  const spinner = document.createElement('span');
  spinner.className = 'dst-spinner';
  spinner.setAttribute('data-dst-spinner', elementId);
  element.appendChild(spinner);
}

export function hideLoading(elementId: string): void {
  const spinner = document.querySelector(`[data-dst-spinner="${elementId}"]`);
  if (spinner) spinner.remove();
}

export function getTranslatedCount(): number {
  return translatedElements.size;
}

export function clearAllTranslations(): void {
  translatedElements.forEach((info) => {
    if (info.isShowingTranslation) {
      info.element.innerHTML = info.originalHTML;
    }
    info.element.removeAttribute(ATTR_ORIGINAL);
    info.element.removeAttribute(ATTR_TRANSLATED);
  });
  translatedElements.clear();
}