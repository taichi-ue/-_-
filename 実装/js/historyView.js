import { getAll, putRecord } from './db.js';
import { escapeHtml, formatDateWithWeekday, formatYmHeading, formatAmount, groupByYearMonth, buildCategoryLabels } from './format.js';
import { getPersonNames } from './personNames.js';

let containerRef = null;
let currentList = [];
let editingId = null;
let filterYearMonth = null;
let categoryLabels = buildCategoryLabels({ A: 'A', B: 'B' });

function render(container, params) {
  containerRef = container;
  editingId = null;
  filterYearMonth = (params && params.yearMonth) || null;
  loadAndRender();
}

function destroy() {}

async function loadAndRender() {
  categoryLabels = buildCategoryLabels(await getPersonNames());

  const all = await getAll('transactions');
  let list = all.filter((t) => t.category !== null);
  if (filterYearMonth) {
    list = list.filter((t) => t.yearMonth === filterYearMonth);
  }
  currentList = list;
  currentList.sort((a, b) => {
    if (a.yearMonth !== b.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
    return b.date.localeCompare(a.date);
  });
  renderList();
}

function renderTxRow(tx) {
  const isEditing = tx.id === editingId;
  return `
    <div class="tx-row history-row" data-id="${tx.id}">
      <div class="tx-date">${formatDateWithWeekday(tx.date)}</div>
      <div class="tx-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-amount">${formatAmount(tx.amount)}</div>
      <div class="tx-category-label">
        <span class="cat-tag cat-tag-${tx.category}">${categoryLabels[tx.category]}</span>
        ${tx.isAuto ? '<span class="badge-auto">自動</span>' : ''}
      </div>
      ${isEditing ? `
        <div class="tx-actions">
          <button type="button" class="cat-A" data-id="${tx.id}" data-category="A">${categoryLabels.A}</button>
          <button type="button" class="cat-B" data-id="${tx.id}" data-category="B">${categoryLabels.B}</button>
          <button type="button" class="cat-BOTH" data-id="${tx.id}" data-category="BOTH">${categoryLabels.BOTH}</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderFilterBanner() {
  if (!filterYearMonth) return '';
  return `
    <div class="filter-banner">
      <span>${formatYmHeading(filterYearMonth)} の明細のみ表示中</span>
      <button type="button" id="clear-filter-btn">すべて表示</button>
    </div>
  `;
}

function renderList() {
  const filterBanner = renderFilterBanner();

  if (currentList.length === 0) {
    containerRef.innerHTML = `<p class="view-title">履歴</p>${filterBanner}<div class="empty-state">振り分け済みの明細はありません</div>`;
    attachFilterHandler();
    return;
  }

  const groups = groupByYearMonth(currentList);

  containerRef.innerHTML = `
    <p class="view-title">履歴（${currentList.length}件）</p>
    ${filterBanner}
    ${groups.map((g) => `
      <section class="month-group">
        <h2>${formatYmHeading(g.yearMonth)}</h2>
        ${g.items.map(renderTxRow).join('')}
      </section>
    `).join('')}
  `;

  attachHandlers();
  attachFilterHandler();
}

function attachFilterHandler() {
  const btn = containerRef.querySelector('#clear-filter-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      filterYearMonth = null;
      loadAndRender();
    });
  }
}

function attachHandlers() {
  containerRef.querySelectorAll('.tx-row.history-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = Number(row.dataset.id);
      editingId = editingId === id ? null : id;
      renderList();
    });
  });

  containerRef.querySelectorAll('.tx-actions button').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = Number(btn.dataset.id);
      handleReassign(id, btn.dataset.category);
    });
  });
}

async function handleReassign(id, category) {
  const tx = currentList.find((t) => t.id === id);
  if (!tx) return;

  await putRecord('transactions', { ...tx, category, isAuto: false, matchedRuleId: null });
  editingId = null;
  await loadAndRender();
}

export { render, destroy };
