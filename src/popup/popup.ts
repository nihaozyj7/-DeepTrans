document.addEventListener('DOMContentLoaded', () => {
  const btnTranslatePage = document.getElementById('btn-translate-page')!;
  const btnTranslateSelection = document.getElementById('btn-translate-selection')!;
  const btnToggle = document.getElementById('btn-toggle')!;
  const btnClear = document.getElementById('btn-clear')!;
  const btnOptions = document.getElementById('btn-options')!;
  const statusEl = document.getElementById('status')!;
  const statusText = statusEl.querySelector('.status-text')!;

  function setStatus(text: string, type: 'ready' | 'translating' | 'error' = 'ready') {
    statusEl.className = `status ${type}`;
    statusText.textContent = text;
  }

  async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function sendToContent(type: string): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('无法获取当前标签页', 'error');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type });
      if (response?.error) {
        setStatus(response.error, 'error');
      }
    } catch (error) {
      setStatus('无法连接到页面，请刷新后重试', 'error');
    }
  }

  btnTranslatePage.addEventListener('click', async () => {
    setStatus('正在翻译...', 'translating');
    await sendToContent('TRANSLATE_PAGE');
    setTimeout(() => setStatus('翻译完成'), 500);
  });

  btnTranslateSelection.addEventListener('click', async () => {
    await sendToContent('TRANSLATE_SELECTION');
  });

  btnToggle.addEventListener('click', async () => {
    await sendToContent('TOGGLE_ORIGINAL');
    setStatus('已切换');
  });

  btnClear.addEventListener('click', async () => {
    await sendToContent('CLEAR_TRANSLATIONS');
    setStatus('已清除翻译');
  });

  btnOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
