import { ATTR_ORIGINAL, ATTR_TRANSLATED, DEFAULT_SELECTORS } from '../lib/constants';
import { TranslateRequest } from '../lib/types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetHeight > 0 &&
    element.offsetWidth > 0
  );
}

function isMeaninglessText(text: string): boolean {
  if (!text || text.trim().length < 2) return true;
  const trimmed = text.trim();
  if (/^[\d\s\p{P}\p{S}\p{Z}]+$/u.test(trimmed)) return true;
  if (/^[.,;:!?，。；：！？\s]+$/.test(trimmed)) return true;
  return false;
}

function hasTranslatableText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isMeaninglessText(trimmed)) return false;
  if (/^[\x00-\x7F]+$/.test(trimmed) && !/[a-zA-Z]{3,}/.test(trimmed)) return false;
  return true;
}

function hasChildTranslatableElements(element: HTMLElement, selectors: string): boolean {
  const childElements = Array.from(element.querySelectorAll(selectors));
  for (const child of childElements) {
    if (child === element) continue;
    const childText = child.textContent?.trim();
    if (childText && hasTranslatableText(childText)) {
      return true;
    }
  }
  return false;
}

function getElementContext(element: Element, contextSize: number = 2): string {
  const contextParts: string[] = [];
  let sibling = element.previousElementSibling;
  for (let i = 0; i < contextSize && sibling; i++) {
    const text = sibling.textContent?.trim();
    if (text && text.length > 0) {
      contextParts.unshift(text);
    }
    sibling = sibling.previousElementSibling;
  }

  sibling = element.nextElementSibling;
  for (let i = 0; i < contextSize && sibling; i++) {
    const text = sibling.textContent?.trim();
    if (text && text.length > 0) {
      contextParts.push(text);
    }
    sibling = sibling.nextElementSibling;
  }

  return contextParts.join(' | ');
}

export function extractPageElements(selectors?: string): Array<{ element: HTMLElement; text: string; id: string }> {
  const selector = selectors || DEFAULT_SELECTORS;
  const elements = document.querySelectorAll(selector);
  const results: Array<{ element: HTMLElement; text: string; id: string }> = [];

  elements.forEach((element) => {
    const htmlElement = element as HTMLElement;

    if (!isElementVisible(htmlElement)) return;
    if (htmlElement.hasAttribute(ATTR_TRANSLATED)) return;
    if (htmlElement.hasAttribute(ATTR_ORIGINAL)) return;
    if (htmlElement.closest(`[${ATTR_TRANSLATED}]`)) return;
    if (htmlElement.closest(`[${ATTR_ORIGINAL}]`)) return;

    if (hasChildTranslatableElements(htmlElement, selector)) return;

    const walker = document.createTreeWalker(
      htmlElement,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let fullText = '';
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      if (text && !isMeaninglessText(text)) {
        fullText += text.trim() + ' ';
      }
    }

    fullText = fullText.trim();

    if (hasTranslatableText(fullText)) {
      const id = generateId();
      htmlElement.setAttribute(ATTR_ORIGINAL, id);
      results.push({
        element: htmlElement,
        text: fullText,
        id,
      });
    }
  });

  return results;
}

export function extractSelection(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text || text.length < 2) {
    return null;
  }
  return text;
}

export function extractWithCustomSelectors(selectors: string): Array<{ element: HTMLElement; text: string; id: string }> {
  return extractPageElements(selectors);
}

export function buildTranslateRequests(
  elements: Array<{ element: HTMLElement; text: string; id: string }>,
  useContext: boolean
): TranslateRequest[] {
  return elements.map(({ text, id, element }) => ({
    id,
    text,
    context: useContext ? getElementContext(element) : undefined,
    targetLang: '',
  }));
}
