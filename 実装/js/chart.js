import { formatAmount } from './format.js';

function buildLineChartSvg(points, options = {}) {
  const width = options.width || 640;
  const height = options.height || 220;
  const paddingLeft = 64;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 32;

  if (points.length === 0) {
    return '<p class="empty-state">表示できるデータがありません</p>';
  }

  const values = points.map((p) => p.value);
  const maxValue = Math.max(1, ...values);
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const xFor = (i) => paddingLeft + stepX * i;
  const yFor = (v) => paddingTop + innerHeight - (v / maxValue) * innerHeight;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(' ');

  const circles = points
    .map((p, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(p.value).toFixed(1)}" r="4" fill="var(--color-both)" />`)
    .join('');

  const xLabels = points
    .map((p, i) => `<text x="${xFor(i).toFixed(1)}" y="${height - 10}" font-size="11" text-anchor="middle" fill="var(--color-muted)">${p.label}</text>`)
    .join('');

  const baselineY = (paddingTop + innerHeight).toFixed(1);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="二人の合計の月次推移グラフ">
      <line x1="${paddingLeft}" y1="${baselineY}" x2="${width - paddingRight}" y2="${baselineY}" stroke="var(--color-border)" />
      <text x="${paddingLeft - 8}" y="${paddingTop + 4}" font-size="11" text-anchor="end" fill="var(--color-muted)">${formatAmount(maxValue)}</text>
      <text x="${paddingLeft - 8}" y="${baselineY}" font-size="11" text-anchor="end" fill="var(--color-muted)">¥0</text>
      <path d="${pathD}" fill="none" stroke="var(--color-both)" stroke-width="2" />
      ${circles}
      ${xLabels}
    </svg>
  `;
}

export { buildLineChartSvg };
