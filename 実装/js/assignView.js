import { getAll, putRecord } from './db.js';
import { bindArrowKeys } from './keyboardNav.js';
import { escapeHtml, formatDateWithWeekday, formatYmHeading, formatAmount, groupByYearMonth } from './format.js';

let containerRef = null;
let currentList = [];
let focusedId = null;
let unbindKeys = null;

function render(container) {
  containerRef = container;
  focusedId = null;

  if (unbindKeys) unbindKeys();
  unbindKeys = bindArrowKeys({
    onLeft: () => assignFocused('A'),
    onRight: () => assignFocused('BOTH'),
    onDown: () => assignFocused('B'),
  });

  loadAndRender();
}

function destroy() {
  if (unbindKeys) {
    unbindKeys();
    unbindKeys = null;
  }
}

async function loadAndRender() {
  const all = await getAll('transactions');
  currentList = all.filter((t) => t.category === null);
  currentList.sort((a, b) => {
    if (a.yearMonth !== b.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
    return b.date.localeCompare(a.date);
  });
  renderList();
}

function renderTxRow(tx) {
  return `
    <div class="tx-row" data-id="${tx.id}">
      <div class="tx-date">${formatDateWithWeekday(tx.date)}</div>
      <div class="tx-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-amount">${formatAmount(tx.amount)}</div>
      <div class="tx-actions">
        <button type="button" class="cat-A" data-id="${tx.id}" data-category="A">Aの支払い</button>
        <button type="button" class="cat-B" data-id="${tx.id}" data-category="B">Bの支払い</button>
        <button type="button" class="cat-BOTH" data-id="${tx.id}" data-category="BOTH">二人で支払い</button>
      </div>
    </div>
  `;
}

function renderList() {
  if (currentList.length === 0) {
    containerRef.innerHTML = '<p class="view-title">振り分け</p><div class="empty-state">未振り分けの明細はありません</div>';
    return;
  }

  const groups = groupByYearMonth(currentList);

  containerRef.innerHTML = `
    <p class="view-title">振り分け（${currentList.length}件）</p>
    ${groups.map((g) => `
      <section class="month-group">
        <h2>${formatYmHeading(g.yearMonth)}</h2>
        ${g.items.map(renderTxRow).join('')}
      </section>
    `).join('')}
  `;

  attachHandlers();

  if (!currentList.some((t) => t.id === focusedId)) {
    focusedId = currentList[0].id;
  }
  updateFocusHighlight();
}

function attachHandlers() {
  containerRef.querySelectorAll('.tx-actions button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      handleAssign(id, btn.dataset.category);
    });
  });

  containerRef.querySelectorAll('.tx-row').forEach((row) => {
    row.addEventListener('click', () => {
      focusedId = Number(row.dataset.id);
      updateFocusHighlight();
    });
  });
}

function updateFocusHighlight() {
  containerRef.querySelectorAll('.tx-row').forEach((row) => {
    row.classList.toggle('focused', Number(row.dataset.id) === focusedId);
  });
}

function assignFocused(category) {
  if (focusedId == null) return;
  handleAssign(focusedId, category);
}

async function handleAssign(id, category) {
  const tx = currentList.find((t) => t.id === id);
  if (!tx) return;

  await putRecord('transactions', { ...tx, category, isAuto: false, matchedRuleId: null });

  const idx = currentList.findIndex((t) => t.id === id);
  const next = currentList[idx + 1] || currentList[idx - 1] || null;
  focusedId = next ? next.id : null;

  await loadAndRender();
}

export { render, destroy };
