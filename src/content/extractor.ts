import { ATTR_ORIGINAL, ATTR_TRANSLATED, DEFAULT_SELECTORS } from '../lib/constants';
import { SiteExcludeRule, TranslateRequest } from '../lib/types';

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

function isInViewport(element: HTMLElement, bufferRatio: number = 0.5): boolean {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const buffer = viewportHeight * bufferRatio;

  return (
    rect.top < viewportHeight + buffer &&
    rect.bottom > -buffer &&
    rect.left < window.innerWidth + buffer &&
    rect.right > -buffer
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

const INLINE_CHILD_SELECTOR = 'a, span, b, strong, i, em, u, mark, small, sub, sup, abbr, cite, code, img, ruby, rt, rp';

function isInlineChildElement(element: Element): boolean {
  return element.matches(INLINE_CHILD_SELECTOR);
}

function hasOwnDirectText(element: HTMLElement, selectors: string): boolean {
  const childElements = Array.from(element.querySelectorAll(selectors));
  let childTextLength = 0;
  for (const child of childElements) {
    if (child === element) continue;
    childTextLength += (child.textContent || '').length;
  }
  const ownTextLength = (element.textContent || '').length - childTextLength;
  return ownTextLength > 2;
}

function hasChildTranslatableElements(element: HTMLElement, selectors: string): boolean {
  if (hasOwnDirectText(element, selectors)) return false;

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

function isExcludedByGlobalSelectors(element: HTMLElement, globalSelectors: string): boolean {
  if (!globalSelectors) return false;
  try {
    return element.matches(globalSelectors) || element.closest(globalSelectors) !== null;
  } catch {
    return false;
  }
}

function matchUrlPattern(url: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexStr}$`, 'i');
  return regex.test(url);
}

function isExcludedBySiteRules(element: HTMLElement, siteRules: SiteExcludeRule[]): boolean {
  if (!siteRules || siteRules.length === 0) return false;
  const currentUrl = window.location.href;

  for (const rule of siteRules) {
    if (matchUrlPattern(currentUrl, rule.pattern)) {
      if (rule.selectors) {
        try {
          if (element.matches(rule.selectors) || element.closest(rule.selectors) !== null) {
            return true;
          }
        } catch {
          continue;
        }
      }
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

function isMixedContentElement(element: HTMLElement, selectors: string): boolean {
  const childElements = Array.from(element.querySelectorAll(selectors));
  for (const child of childElements) {
    if (child === element) continue;
    if (isInlineChildElement(child)) {
      const childText = child.textContent?.trim();
      if (childText && hasTranslatableText(childText)) {
        return true;
      }
    }
  }
  return false;
}

function buildTextWithPlaceholders(element: HTMLElement): { text: string; childMap: Element[] } {
  const childMap: Element[] = [];
  let text = '';
  let markerIndex = 0;

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || '';
      if (t.trim()) {
        text += t.trim() + ' ';
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (isInlineChildElement(el)) {
        childMap.push(el);
        text += `[${markerIndex}] `;
        markerIndex++;
      }
    }
  }

  return { text: text.trim(), childMap };
}

export function extractPageElements(
  selectors?: string,
  globalExcludeSelectors?: string,
  siteExcludeRules?: SiteExcludeRule[],
  onlyVisible: boolean = false
): Array<{ element: HTMLElement; text: string; id: string; childMap?: Element[] }> {
  const selector = selectors || DEFAULT_SELECTORS;
  const elements = document.querySelectorAll(selector);
  const results: Array<{ element: HTMLElement; text: string; id: string; childMap?: Element[] }> = [];

  elements.forEach((element) => {
    const htmlElement = element as HTMLElement;

    if (!isElementVisible(htmlElement)) return;
    if (onlyVisible && !isInViewport(htmlElement)) return;
    if (htmlElement.hasAttribute(ATTR_TRANSLATED)) return;
    if (htmlElement.hasAttribute(ATTR_ORIGINAL)) return;
    if (htmlElement.closest(`[${ATTR_TRANSLATED}]`)) return;
    if (htmlElement.closest(`[${ATTR_ORIGINAL}]`)) return;
    if (globalExcludeSelectors && isExcludedByGlobalSelectors(htmlElement, globalExcludeSelectors)) return;
    if (siteExcludeRules && isExcludedBySiteRules(htmlElement, siteExcludeRules)) return;

    if (isMixedContentElement(htmlElement, selector)) {
      const { text, childMap } = buildTextWithPlaceholders(htmlElement);
      if (hasTranslatableText(text.replace(/\[\d+\]/g, '').trim())) {
        const id = generateId();
        htmlElement.setAttribute(ATTR_ORIGINAL, id);
        results.push({ element: htmlElement, text, id, childMap });
      }
      return;
    }

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
      results.push({ element: htmlElement, text: fullText, id });
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

export function extractWithCustomSelectors(
  selectors: string,
  globalExcludeSelectors?: string,
  siteExcludeRules?: SiteExcludeRule[],
  onlyVisible?: boolean
): Array<{ element: HTMLElement; text: string; id: string; childMap?: Element[] }> {
  return extractPageElements(selectors, globalExcludeSelectors, siteExcludeRules, onlyVisible);
}

export function buildTranslateRequests(
  elements: Array<{ element: HTMLElement; text: string; id: string; childMap?: Element[] }>,
  useContext: boolean
): TranslateRequest[] {
  return elements.map(({ text, id, element }) => ({
    id,
    text,
    context: useContext ? getElementContext(element) : undefined,
    targetLang: '',
  }));
}
