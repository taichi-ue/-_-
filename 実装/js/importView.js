import { parseCsvFile } from './csvParser.js';
import { addRecord, getAll, getByIndex, deleteRecord } from './db.js';
import { applyRules } from './autoRules.js';
import { escapeHtml, formatYmHeading as formatYm } from './format.js';

let containerRef = null;
let parsedResult = null; // { cardType, transactions, fileName }

function render(container) {
  containerRef = container;
  parsedResult = null;
  renderSelectStep();
}

function cardTypeLabel(cardType) {
  return cardType === 'AMEX' ? 'AMEX' : '三井住友';
}

function renderSelectStep(errorMessage) {
  containerRef.innerHTML = `
    <h2>CSV取込</h2>
    ${errorMessage ? `<p class="error-text">${escapeHtml(errorMessage)}</p>` : ''}
    <p>三井住友またはAMEXの明細CSVファイルを選択してください。</p>
    <input type="file" id="csv-file-input" accept=".csv" />
  `;
  containerRef.querySelector('#csv-file-input').addEventListener('change', handleFileSelected);
}

async function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const { cardType, transactions } = await parseCsvFile(file);
    if (transactions.length === 0) {
      renderSelectStep('明細を読み取れませんでした。別のファイルを選択してください。');
      return;
    }
    parsedResult = { cardType, transactions, fileName: file.name };
    renderConfirmStep();
  } catch (err) {
    renderSelectStep(err.message || 'CSVの読み込みに失敗しました。');
  }
}

function computeYearMonthCounts(transactions) {
  const counts = new Map();
  for (const t of transactions) {
    const ym = t.date.slice(0, 7);
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].localeCompare(a[0]);
  });
}

function renderConfirmStep() {
  const { cardType, transactions, fileName } = parsedResult;
  const ymCounts = computeYearMonthCounts(transactions);
  const defaultYm = ymCounts[0][0];

  containerRef.innerHTML = `
    <h2>取込内容の確認</h2>
    <p>ファイル: ${escapeHtml(fileName)}</p>
    <p>カード種別: ${cardTypeLabel(cardType)}</p>
    <p>明細件数: ${transactions.length}件</p>
    <label for="target-year-month">対象年月</label><br>
    <select id="target-year-month">
      ${ymCounts.map(([ym, count]) => (
        `<option value="${ym}" ${ym === defaultYm ? 'selected' : ''}>${formatYm(ym)}（${count}件）</option>`
      )).join('')}
    </select>
    <div class="import-actions">
      <button type="button" id="confirm-import-btn">この内容で取り込む</button>
      <button type="button" id="cancel-import-btn">やり直す</button>
    </div>
  `;

  containerRef.querySelector('#confirm-import-btn').addEventListener('click', handleConfirmImport);
  containerRef.querySelector('#cancel-import-btn').addEventListener('click', () => {
    parsedResult = null;
    renderSelectStep();
  });
}

async function handleConfirmImport() {
  const targetYearMonth = containerRef.querySelector('#target-year-month').value;
  const { cardType, transactions, fileName } = parsedResult;

  const existingLogs = await getByIndex('importLogs', 'cardType_targetYearMonth', [cardType, targetYearMonth]);

  if (existingLogs.length > 0) {
    const proceed = window.confirm(
      `${formatYm(targetYearMonth)}（${cardTypeLabel(cardType)}）は既に取り込み済みです。既存データを置き換えますか？`
    );
    if (!proceed) return;

    for (const log of existingLogs) {
      const oldTransactions = await getByIndex('transactions', 'importId', log.id);
      for (const t of oldTransactions) {
        await deleteRecord('transactions', t.id);
      }
      await deleteRecord('importLogs', log.id);
    }
  }

  const importId = await addRecord('importLogs', {
    cardType,
    targetYearMonth,
    fileName,
    recordCount: transactions.length,
    importedAt: new Date().toISOString(),
  });

  const rules = await getAll('rules');
  let autoCount = 0;

  for (const t of transactions) {
    const matched = applyRules(t, rules);
    if (matched.isAuto) autoCount++;

    await addRecord('transactions', {
      date: t.date,
      yearMonth: t.date.slice(0, 7),
      cardType,
      cardHolderName: t.cardHolderName,
      description: t.description,
      amount: t.amount,
      category: matched.category,
      isAuto: matched.isAuto,
      matchedRuleId: matched.matchedRuleId,
      importId,
      createdAt: new Date().toISOString(),
    });
  }

  renderResultStep(transactions.length, autoCount);
}

function renderResultStep(count, autoCount) {
  const unassignedCount = count - autoCount;
  containerRef.innerHTML = `
    <h2>取込完了</h2>
    <p>${count}件の明細を取り込みました。</p>
    <p>自動振り分け: ${autoCount}件 / 未振り分け: ${unassignedCount}件</p>
    <button type="button" id="import-more-btn">続けて別のファイルを取り込む</button>
  `;
  containerRef.querySelector('#import-more-btn').addEventListener('click', () => {
    parsedResult = null;
    renderSelectStep();
  });
}

export { render };
