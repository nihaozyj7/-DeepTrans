import { getConfig, updateConfig, DEFAULT_CONFIG } from '../lib/config';
import { UserConfig } from '../lib/types';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form') as HTMLFormElement;
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const toggleKeyBtn = document.getElementById('toggle-key')!;
  const modelSelect = document.getElementById('model') as HTMLSelectElement;
  const targetLangSelect = document.getElementById('targetLang') as HTMLSelectElement;
  const translateModeSelect = document.getElementById('translateMode') as HTMLSelectElement;
  const customSelectorsInput = document.getElementById('customSelectors') as HTMLInputElement;
  const autoTranslateCheckbox = document.getElementById('autoTranslate') as HTMLInputElement;
  const useContextCheckbox = document.getElementById('useContext') as HTMLInputElement;
  const showContextMenuCheckbox = document.getElementById('showContextMenu') as HTMLInputElement;
  const enableThinkingCheckbox = document.getElementById('enableThinking') as HTMLInputElement;
  const resetBtn = document.getElementById('btn-reset')!;
  const toast = document.getElementById('toast')!;

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }

  async function loadConfig() {
    const config = await getConfig();
    apiKeyInput.value = config.apiKey;
    modelSelect.value = config.model;
    targetLangSelect.value = config.targetLang;
    translateModeSelect.value = config.translateMode;
    customSelectorsInput.value = config.customSelectors;
    autoTranslateCheckbox.checked = config.autoTranslate;
    useContextCheckbox.checked = config.useContext;
    showContextMenuCheckbox.checked = config.showContextMenu;
    enableThinkingCheckbox.checked = config.enableThinking;
  }

  function getFormConfig(): Partial<UserConfig> {
    return {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value as UserConfig['model'],
      targetLang: targetLangSelect.value,
      translateMode: translateModeSelect.value as UserConfig['translateMode'],
      customSelectors: customSelectorsInput.value.trim(),
      autoTranslate: autoTranslateCheckbox.checked,
      useContext: useContextCheckbox.checked,
      showContextMenu: showContextMenuCheckbox.checked,
      enableThinking: enableThinkingCheckbox.checked,
    };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await updateConfig(getFormConfig());
      showToast('设置已保存');
    } catch (error) {
      showToast('保存失败', 'error');
    }
  });

  toggleKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleKeyBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  resetBtn.addEventListener('click', async () => {
    if (confirm('确定要恢复默认设置吗？')) {
      await updateConfig(DEFAULT_CONFIG);
      await loadConfig();
      showToast('已恢复默认设置');
    }
  });

  await loadConfig();
});
