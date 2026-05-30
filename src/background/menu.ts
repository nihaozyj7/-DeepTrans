import { getConfig } from '../lib/config';

const MENU_ID_TRANSLATE_SELECTION = 'dst-translate-selection';
const MENU_ID_TRANSLATE_PAGE = 'dst-translate-page';

export async function setupContextMenus(): Promise<void> {
  const config = await getConfig();

  if (!config.showContextMenu) {
    chrome.contextMenus.removeAll();
    return;
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID_TRANSLATE_SELECTION,
      title: '用 DeepSeek 翻译选中文本',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: MENU_ID_TRANSLATE_PAGE,
      title: '用 DeepSeek 翻译整个页面',
      contexts: ['page', 'frame'],
    });
  });
}

export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case MENU_ID_TRANSLATE_SELECTION:
      chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_SELECTION' });
      break;

    case MENU_ID_TRANSLATE_PAGE:
      chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_PAGE' });
      break;
  }
}
