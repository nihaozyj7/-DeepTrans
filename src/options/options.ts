import { getConfig, updateConfig, DEFAULT_CONFIG } from '../lib/config';
import { SiteExcludeRule, UserConfig } from '../lib/types';

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
  const onlyTranslateVisibleCheckbox = document.getElementById('onlyTranslateVisible') as HTMLInputElement;
  const pageSummaryCheckbox = document.getElementById('pageSummary') as HTMLInputElement;
  const globalExcludeSelectorsInput = document.getElementById('globalExcludeSelectors') as HTMLInputElement;
  const maxCharsPerBatchInput = document.getElementById('maxCharsPerBatch') as HTMLInputElement;
  const concurrencyInput = document.getElementById('concurrency') as HTMLInputElement;
  const siteRulesList = document.getElementById('site-rules-list')!;
  const btnAddSiteRule = document.getElementById('btn-add-site-rule')!;
  const resetBtn = document.getElementById('btn-reset')!;
  const toast = document.getElementById('toast')!;

  let siteRules: SiteExcludeRule[] = [];

  document.querySelectorAll<HTMLButtonElement>('.tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tabBtn.classList.add('active');
      const tabName = tabBtn.dataset.tab!;
      document.querySelector(`.tab-content[data-tab="${tabName}"]`)!.classList.add('active');
    });
  });

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }

  function renderSiteRules() {
    siteRulesList.innerHTML = '';
    siteRules.forEach((rule, index) => {
      const ruleItem = document.createElement('div');
      ruleItem.className = 'site-rule-item';
      ruleItem.innerHTML = `
        <div class="site-rule-header">
          <label>规则 ${index + 1}</label>
          <button type="button" class="btn-remove-rule" data-index="${index}">&times;</button>
        </div>
        <input type="text" class="site-rule-pattern" placeholder="URL 匹配模式，如 *://*.example.com/*" value="${rule.pattern}">
        <input type="text" class="site-rule-selectors" placeholder="排除的 CSS 选择器，如 .sidebar, .comments" value="${rule.selectors}">
      `;
      siteRulesList.appendChild(ruleItem);
    });

    document.querySelectorAll('.btn-remove-rule').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.index!);
        siteRules.splice(index, 1);
        renderSiteRules();
      });
    });

    document.querySelectorAll('.site-rule-pattern').forEach((input, index) => {
      input.addEventListener('change', (e) => {
        siteRules[index].pattern = (e.target as HTMLInputElement).value;
      });
    });

    document.querySelectorAll('.site-rule-selectors').forEach((input, index) => {
      input.addEventListener('change', (e) => {
        siteRules[index].selectors = (e.target as HTMLInputElement).value;
      });
    });
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
    onlyTranslateVisibleCheckbox.checked = config.onlyTranslateVisible;
    pageSummaryCheckbox.checked = config.pageSummary;
    globalExcludeSelectorsInput.value = config.globalExcludeSelectors;
    maxCharsPerBatchInput.value = config.maxCharsPerBatch.toString();
    concurrencyInput.value = config.concurrency.toString();
    siteRules = config.siteExcludeRules || [];
    renderSiteRules();
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
      onlyTranslateVisible: onlyTranslateVisibleCheckbox.checked,
      pageSummary: pageSummaryCheckbox.checked,
      globalExcludeSelectors: globalExcludeSelectorsInput.value.trim(),
      siteExcludeRules: siteRules,
      maxCharsPerBatch: parseInt(maxCharsPerBatchInput.value) || 100,
      concurrency: parseInt(concurrencyInput.value) || 3,
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

  btnAddSiteRule.addEventListener('click', () => {
    siteRules.push({ pattern: '', selectors: '' });
    renderSiteRules();
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