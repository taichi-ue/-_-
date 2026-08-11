import { getAll } from './db.js';
import { formatAmount, formatYmHeading, formatTimestampForFilename, buildCategoryLabels } from './format.js';
import { buildLineChartSvg } from './chart.js';
import { navigateTo } from './router.js';
import { buildCsv, downloadCsv } from './csvExport.js';
import { getPersonNames } from './personNames.js';

let containerRef = null;
let monthlyData = new Map();
let monthsAsc = [];
let assignedList = [];
let personNames = { A: 'A', B: 'B' };
let categoryLabels = buildCategoryLabels(personNames);

function render(container) {
  containerRef = container;
  loadAndRender();
}

function destroy() {}

function formatYmShort(ym) {
  const [, m] = ym.split('-');
  return `${Number(m)}月`;
}

async function loadAndRender() {
  personNames = await getPersonNames();
  categoryLabels = buildCategoryLabels(personNames);

  const all = await getAll('transactions');
  assignedList = all.filter((t) => t.category !== null);

  monthlyData = new Map();
  for (const t of assignedList) {
    if (!monthlyData.has(t.yearMonth)) {
      monthlyData.set(t.yearMonth, { A: 0, B: 0, BOTH: 0 });
    }
    monthlyData.get(t.yearMonth)[t.category] += t.amount;
  }

  monthsAsc = [...monthlyData.keys()].sort();

  if (monthsAsc.length === 0) {
    containerRef.innerHTML = '<p class="view-title">集計</p><div class="empty-state">振り分け済みのデータがありません</div>';
    return;
  }

  const latestYm = monthsAsc[monthsAsc.length - 1];
  const latest = monthlyData.get(latestYm);
  const last12 = monthsAsc.slice(-12);

  const chartSvg = buildLineChartSvg(
    last12.map((ym) => ({ label: formatYmShort(ym), value: monthlyData.get(ym).BOTH }))
  );

  const tableRows = [...monthsAsc]
    .reverse()
    .map((ym) => {
      const m = monthlyData.get(ym);
      return `
        <tr class="report-row" data-ym="${ym}">
          <td>${formatYmHeading(ym)}</td>
          <td>${formatAmount(m.BOTH)}</td>
          <td>${formatAmount(m.A)}</td>
          <td>${formatAmount(m.B)}</td>
        </tr>
      `;
    })
    .join('');

  containerRef.innerHTML = `
    <p class="view-title">集計</p>

    <section class="highlight-section">
      <h2>${formatYmHeading(latestYm)}（最新月）</h2>
      <div class="highlight-cards">
        <div class="highlight-card highlight-both">
          <div class="highlight-label">二人の合計</div>
          <div class="highlight-value">${formatAmount(latest.BOTH)}</div>
          <div class="highlight-sub">一人当たり ${formatAmount(Math.round(latest.BOTH / 2))}</div>
        </div>
        <div class="highlight-card highlight-a">
          <div class="highlight-label">${personNames.A}の合計</div>
          <div class="highlight-value">${formatAmount(latest.A)}</div>
        </div>
        <div class="highlight-card highlight-b">
          <div class="highlight-label">${personNames.B}の合計</div>
          <div class="highlight-value">${formatAmount(latest.B)}</div>
        </div>
      </div>
    </section>

    <section class="chart-section">
      <h2>二人の合計 月次推移</h2>
      ${chartSvg}
    </section>

    <section class="report-table-section">
      <h2>月別一覧（タップでその月の履歴を表示）</h2>
      <table class="report-table">
        <thead>
          <tr><th>月</th><th>二人</th><th>${personNames.A}</th><th>${personNames.B}</th></tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </section>

    <section class="csv-export-section">
      <h2>CSV出力</h2>
      <div class="settings-actions">
        <button type="button" id="export-monthly-csv-btn">月別集計をCSVでダウンロード</button>
        <button type="button" id="export-detail-csv-btn">明細をCSVでダウンロード</button>
      </div>
    </section>
  `;

  containerRef.querySelectorAll('.report-row').forEach((row) => {
    row.addEventListener('click', () => {
      navigateTo('history', { yearMonth: row.dataset.ym });
    });
  });

  containerRef.querySelector('#export-monthly-csv-btn').addEventListener('click', handleExportMonthlyCsv);
  containerRef.querySelector('#export-detail-csv-btn').addEventListener('click', handleExportDetailCsv);
}

function handleExportMonthlyCsv() {
  const headers = ['年月', '二人の合計', '一人当たり', `${personNames.A}の合計`, `${personNames.B}の合計`];
  const rows = monthsAsc.map((ym) => {
    const m = monthlyData.get(ym);
    return [ym, m.BOTH, Math.round(m.BOTH / 2), m.A, m.B];
  });
  const csv = buildCsv(headers, rows);
  downloadCsv(`kureka-monthly-summary-${formatTimestampForFilename(new Date())}.csv`, csv);
}

function handleExportDetailCsv() {
  const headers = ['年月', '利用日', '項目名', '金額', '区分', 'カード種別', 'カード会員名', '自動振り分け'];
  const sorted = [...assignedList].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((t) => [
    t.yearMonth,
    t.date,
    t.description,
    t.amount,
    categoryLabels[t.category],
    t.cardType,
    t.cardHolderName,
    t.isAuto ? '自動' : '手動',
  ]);
  const csv = buildCsv(headers, rows);
  downloadCsv(`kureka-detail-${formatTimestampForFilename(new Date())}.csv`, csv);
}

export { render, destroy };
