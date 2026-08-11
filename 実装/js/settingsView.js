import { getAll, addRecord, putRecord, deleteRecord, clearStore } from './db.js';
import { reapplyToUnassigned } from './autoRules.js';
import { escapeHtml, formatTimestampForFilename, CATEGORY_LABELS } from './format.js';

let containerRef = null;
let message = null; // { text, type }

function render(container) {
  containerRef = container;
  message = null;
  renderSettings();
}

function destroy() {}

function showMessage(text, type) {
  message = { text, type };
}

function formatTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function renderSettings() {
  const [rules, settings] = await Promise.all([getAll('rules'), getAll('settings')]);
  rules.sort((a, b) => (a.priority - b.priority) || (a.id - b.id));

  const lastBackup = settings.find((s) => s.key === 'lastBackupAt');

  containerRef.innerHTML = `
    <p class="view-title">設定</p>

    ${message ? `<p class="${message.type === 'error' ? 'error-text' : 'success-text'}">${escapeHtml(message.text)}</p>` : ''}

    <section class="settings-section">
      <h2>自動振り分けルール</h2>
      <form id="rule-form" class="rule-form">
        <input type="text" id="rule-keyword" placeholder="キーワード（例: セブン）" required>
        <select id="rule-category">
          <option value="A">Aの支払い</option>
          <option value="B">Bの支払い</option>
          <option value="BOTH">二人で支払い</option>
        </select>
        <button type="submit">追加</button>
      </form>

      ${rules.length === 0 ? '<p class="empty-state">ルールはまだ登録されていません</p>' : `
        <ul class="rule-list">
          ${rules.map((r, i) => `
            <li class="rule-item ${r.enabled ? '' : 'rule-disabled'}">
              <div class="rule-info">
                <span class="cat-tag cat-tag-${r.category}">${CATEGORY_LABELS[r.category]}</span>
                <span class="rule-keyword">${escapeHtml(r.keyword)}</span>
              </div>
              <div class="rule-actions">
                <button type="button" data-action="up" data-id="${r.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" data-action="down" data-id="${r.id}" ${i === rules.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" data-action="toggle" data-id="${r.id}">${r.enabled ? '無効化' : '有効化'}</button>
                <button type="button" data-action="delete" data-id="${r.id}">削除</button>
              </div>
            </li>
          `).join('')}
        </ul>
      `}

      <button type="button" id="reapply-btn">未振り分け明細に再適用</button>
    </section>

    <section class="settings-section">
      <h2>データ管理</h2>
      <p class="backup-status">${lastBackup ? `最終バックアップ: ${formatTimestamp(lastBackup.value)}` : 'まだバックアップしていません'}</p>
      <div class="settings-actions">
        <button type="button" id="export-btn">JSONをエクスポート</button>
        <label class="file-btn">
          JSONをインポート
          <input type="file" id="import-file-input" accept="application/json,.json">
        </label>
        <button type="button" id="delete-all-btn" class="danger-btn">全データ削除</button>
      </div>
    </section>
  `;

  attachHandlers();
}

function attachHandlers() {
  containerRef.querySelector('#rule-form').addEventListener('submit', handleAddRule);

  containerRef.querySelectorAll('.rule-actions button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === 'up') handleMoveRule(id, -1);
      else if (action === 'down') handleMoveRule(id, 1);
      else if (action === 'toggle') handleToggleRule(id);
      else if (action === 'delete') handleDeleteRule(id);
    });
  });

  containerRef.querySelector('#reapply-btn').addEventListener('click', handleReapply);
  containerRef.querySelector('#export-btn').addEventListener('click', handleExport);
  containerRef.querySelector('#import-file-input').addEventListener('change', handleImportFile);
  containerRef.querySelector('#delete-all-btn').addEventListener('click', handleDeleteAll);
}

async function handleAddRule(event) {
  event.preventDefault();
  const keywordInput = containerRef.querySelector('#rule-keyword');
  const categorySelect = containerRef.querySelector('#rule-category');
  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  const rules = await getAll('rules');
  const maxPriority = rules.reduce((max, r) => Math.max(max, r.priority), -1);

  await addRecord('rules', {
    keyword,
    category: categorySelect.value,
    priority: maxPriority + 1,
    enabled: true,
    createdAt: new Date().toISOString(),
  });

  message = null;
  renderSettings();
}

async function handleMoveRule(id, direction) {
  const rules = await getAll('rules');
  rules.sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  const idx = rules.findIndex((r) => r.id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= rules.length) return;

  const a = rules[idx];
  const b = rules[swapIdx];
  await putRecord('rules', { ...a, priority: b.priority });
  await putRecord('rules', { ...b, priority: a.priority });
  renderSettings();
}

async function handleToggleRule(id) {
  const rules = await getAll('rules');
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;
  await putRecord('rules', { ...rule, enabled: !rule.enabled });
  renderSettings();
}

async function handleDeleteRule(id) {
  await deleteRecord('rules', id);
  renderSettings();
}

async function handleReapply() {
  const count = await reapplyToUnassigned();
  showMessage(`${count}件を自動振り分けしました。`, 'success');
  renderSettings();
}

async function handleExport() {
  const [transactions, importLogs, rules] = await Promise.all([
    getAll('transactions'),
    getAll('importLogs'),
    getAll('rules'),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    importLogs,
    rules,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kureka-split-backup-${formatTimestampForFilename(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await putRecord('settings', { key: 'lastBackupAt', value: new Date().toISOString() });

  showMessage('エクスポートしました。', 'success');
  renderSettings();
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (err) {
    showMessage('JSONの読み込みに失敗しました。ファイルが壊れている可能性があります。', 'error');
    renderSettings();
    return;
  }

  if (!data || data.version !== 1) {
    showMessage('対応していないバージョンのファイルです。', 'error');
    renderSettings();
    return;
  }

  const proceed = window.confirm('現在のデータをすべて削除し、選択したファイルの内容で復元します。よろしいですか？');
  if (!proceed) {
    event.target.value = '';
    return;
  }

  await clearStore('transactions');
  await clearStore('importLogs');
  await clearStore('rules');

  for (const r of data.rules || []) await addRecord('rules', r);
  for (const log of data.importLogs || []) await addRecord('importLogs', log);
  for (const t of data.transactions || []) await addRecord('transactions', t);

  showMessage(
    `復元しました（明細${(data.transactions || []).length}件、取込履歴${(data.importLogs || []).length}件、ルール${(data.rules || []).length}件）。`,
    'success'
  );
  renderSettings();
}

async function handleDeleteAll() {
  const proceed = window.confirm('すべてのデータ（明細・取込履歴・ルール）を削除します。元に戻せません。よろしいですか？');
  if (!proceed) return;

  await clearStore('transactions');
  await clearStore('importLogs');
  await clearStore('rules');

  showMessage('すべてのデータを削除しました。', 'success');
  renderSettings();
}

export { render, destroy };
