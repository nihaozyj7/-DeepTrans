import { ATTR_ORIGINAL, ATTR_TRANSLATED } from '../lib/constants';

interface TranslatedElement {
  element: HTMLElement;
  originalHTML: string;
  translatedText: string;
  isShowingTranslation: boolean;
  childMap?: Element[];
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

function replaceMixedContent(
  element: HTMLElement,
  translatedText: string,
  childMap: Element[]
): boolean {
  const directTextNodes: Text[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent || '';
      if (t.trim().length > 0) {
        directTextNodes.push(child as Text);
      }
    }
  }
  if (directTextNodes.length === 0) return true;

  const markerRegex = /\[(\d+)\]/g;
  const matches = [...translatedText.matchAll(markerRegex)];

  if (matches.length > 0) {
    const segments: string[] = [];
    let lastIndex = 0;
    for (const match of matches) {
      const idx = parseInt(match[1]);
      if (idx >= 0 && idx < childMap.length) {
        segments.push(translatedText.substring(lastIndex, match.index).trim());
        lastIndex = match.index! + match[0].length;
      }
    }
    segments.push(translatedText.substring(lastIndex).trim());

    const textSegments = segments.filter(s => s.length > 0);
    let segIndex = 0;
    for (const tn of directTextNodes) {
      if (segIndex < textSegments.length) {
        tn.textContent = textSegments[segIndex];
        segIndex++;
      } else {
        tn.textContent = '';
      }
    }
    return true;
  }

  const originalLengths = directTextNodes.map(n => (n.textContent || '').length);
  const totalLength = originalLengths.reduce((sum, l) => sum + l, 0);
  if (totalLength === 0) return true;

  let remaining = translatedText;
  for (let i = 0; i < directTextNodes.length; i++) {
    if (i === directTextNodes.length - 1) {
      directTextNodes[i].textContent = remaining;
    } else {
      const ratio = originalLengths[i] / totalLength;
      const partLength = Math.round(translatedText.length * ratio);
      const part = remaining.substring(0, partLength);
      directTextNodes[i].textContent = part;
      remaining = remaining.substring(partLength);
    }
  }

  return true;
}

function isInlineChild(el: Element): boolean {
  return el.matches('a, span, b, strong, i, em, u, mark, small, sub, sup, abbr, cite, code, img, ruby, rt, rp');
}

export function replaceWithTranslation(
  elementId: string,
  translatedText: string,
  childMap?: Element[]
): void {
  const element = document.querySelector(`[${ATTR_ORIGINAL}="${elementId}"]`) as HTMLElement;
  if (!element) return;

  const originalHTML = element.innerHTML;

  translatedElements.set(elementId, {
    element,
    originalHTML,
    translatedText,
    isShowingTranslation: true,
    childMap,
  });

  element.setAttribute(ATTR_TRANSLATED, elementId);

  if (childMap && childMap.length > 0) {
    const success = replaceMixedContent(element, translatedText, childMap);
    if (!success) {
      replaceTextNodes(element, translatedText);
    }
  } else {
    replaceTextNodes(element, translatedText);
  }
}

export function toggleOriginalTranslation(): void {
  translatedElements.forEach((info, id) => {
    if (info.isShowingTranslation) {
      info.element.innerHTML = info.originalHTML;
      info.isShowingTranslation = false;
    } else {
      if (info.childMap && info.childMap.length > 0) {
        const success = replaceMixedContent(info.element, info.translatedText, info.childMap);
        if (!success) {
          replaceTextNodes(info.element, info.translatedText);
        }
      } else {
        replaceTextNodes(info.element, info.translatedText);
      }
      info.isShowingTranslation = true;
    }
  });
}

export function reapplyTranslation(): void {
  translatedElements.forEach((info) => {
    if (!info.isShowingTranslation) {
      if (info.childMap && info.childMap.length > 0) {
        const success = replaceMixedContent(info.element, info.translatedText, info.childMap);
        if (!success) {
          replaceTextNodes(info.element, info.translatedText);
        }
      } else {
        replaceTextNodes(info.element, info.translatedText);
      }
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

export function hideAllSpinners(): void {
  const spinners = document.querySelectorAll('[data-dst-spinner]');
  spinners.forEach(s => s.remove());
}

export function resetUnclaimedElements(): void {
  const claimed = document.querySelectorAll(`[${ATTR_ORIGINAL}]`);
  claimed.forEach(el => {
    const id = el.getAttribute(ATTR_ORIGINAL);
    if (id && !translatedElements.has(id)) {
      el.removeAttribute(ATTR_ORIGINAL);
    }
  });
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
