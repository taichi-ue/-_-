function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDateWithWeekday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const [y, m, day] = dateStr.split('-');
  return `${y}/${m}/${day}（${weekday}）`;
}

function formatYmHeading(ym) {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

function formatAmount(amount) {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

const CATEGORY_LABELS = { A: 'Aの支払い', B: 'Bの支払い', BOTH: '二人で支払い' };

function formatTimestampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function groupByYearMonth(list) {
  const groups = [];
  let lastYm = null;
  for (const item of list) {
    if (item.yearMonth !== lastYm) {
      groups.push({ yearMonth: item.yearMonth, items: [] });
      lastYm = item.yearMonth;
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

export {
  escapeHtml,
  formatDateWithWeekday,
  formatYmHeading,
  formatAmount,
  formatTimestampForFilename,
  groupByYearMonth,
  CATEGORY_LABELS,
};
