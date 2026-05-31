import { getConfig, updateConfig, DEFAULT_CONFIG } from '../lib/config';
import { SiteExcludeRule, UserConfig } from '../lib/types';

interface CacheDomainInfo {
  domain: string;
  count: number;
  sizeKB: string;
  keys: string[];
}

function getCacheDomainFromKey(key: string): string | null {
  const match = key.match(/^cache_(.+)_([a-z0-9]+)$/);
  return match ? match[1] : null;
}

function calculateEntrySize(key: string, value: any): number {
  return new Blob([key + JSON.stringify(value)]).size;
}

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

  const cacheList = document.getElementById('cache-list')!;
  const cacheTotalSize = document.getElementById('cache-total-size')!;
  const cacheTotalCount = document.getElementById('cache-total-count')!;
  const btnClearAllCache = document.getElementById('btn-clear-all-cache') as HTMLButtonElement;

  async function loadCacheStats() {
    const all = await chrome.storage.local.get(null);
    const domainMap = new Map<string, CacheDomainInfo>();

    let totalCount = 0;
    let totalBytes = 0;

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('cache_')) continue;
      const domain = getCacheDomainFromKey(key);
      if (!domain) continue;

      const size = calculateEntrySize(key, value);
      totalCount++;
      totalBytes += size;

      const existing = domainMap.get(domain);
      if (existing) {
        existing.count++;
        existing.keys.push(key);
        existing.sizeKB = ((parseFloat(existing.sizeKB) * 1024 + size) / 1024).toFixed(1);
      } else {
        domainMap.set(domain, { domain, count: 1, sizeKB: (size / 1024).toFixed(1), keys: [key] });
      }
    }

    const totalKB = (totalBytes / 1024).toFixed(1);
    cacheTotalSize.innerHTML = `总缓存: <strong>${totalKB} KB</strong>`;
    cacheTotalCount.textContent = totalCount > 0 ? `(${totalCount} 条记录)` : '';
    btnClearAllCache.style.display = totalCount > 0 ? '' : 'none';

    renderCacheList(Array.from(domainMap.values()));
  }

  function renderCacheList(domains: CacheDomainInfo[]) {
    cacheList.innerHTML = '';

    if (domains.length === 0) {
      cacheList.innerHTML = '<div class="cache-empty">暂无翻译缓存</div>';
      return;
    }

    domains.sort((a, b) => parseFloat(b.sizeKB) - parseFloat(a.sizeKB));

    for (const info of domains) {
      const item = document.createElement('div');
      item.className = 'cache-item';
      item.innerHTML = `
        <div class="cache-item-info">
          <span class="cache-item-domain">${info.domain}</span>
          <span class="cache-item-meta">${info.count} 条记录</span>
        </div>
        <div style="display:flex;align-items:center">
          <span class="cache-item-size">${info.sizeKB} KB</span>
          <button type="button" class="btn-clear-site">清除</button>
        </div>
      `;

      item.querySelector('.btn-clear-site')!.addEventListener('click', async () => {
        await chrome.storage.local.remove(info.keys);
        await loadCacheStats();
        showToast(`已清除 ${info.domain} 的缓存`);
      });

      cacheList.appendChild(item);
    }
  }

  btnClearAllCache.addEventListener('click', async () => {
    if (!confirm('确定要清除全部翻译缓存吗？此操作不可撤销。')) return;
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter(k => k.startsWith('cache_'));
    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
    }
    await loadCacheStats();
    showToast('已清除全部缓存');
  });

  await loadConfig();
  await loadCacheStats();
});