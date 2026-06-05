/**
 * Multi-series line chart. Used for "context shifts vs distractions"
 * across the days of a week.
 */
import { xml } from '../util/escape.js';
import { colorFor } from '../util/colors.js';

const W = 720;
const H = 280;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 60;
const PAD_BOTTOM = 40;

export interface LineSeries {
  name: string;
  values: number[];
  color?: string;
}

export function renderLines(xLabels: string[], series: LineSeries[]): string {
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const allValues = series.flatMap((s) => s.values);
  const maxRaw = Math.max(1, ...allValues);
  // Round max up to a nicer number for grid lines.
  const max = niceCeil(maxRaw);

  // X positions evenly spaced.
  const n = xLabels.length;
  const xAt = (i: number) =>
    n > 1 ? PAD_LEFT + (i / (n - 1)) * innerW : PAD_LEFT + innerW / 2;
  const yAt = (v: number) => PAD_TOP + innerH - (v / max) * innerH;

  // Y-axis grid (4 lines incl. baseline).
  const gridLines: string[] = [];
  for (let g = 0; g <= 4; g++) {
    const yVal = (max * g) / 4;
    const y = yAt(yVal);
    gridLines.push(
      `<line x1="${PAD_LEFT}" y1="${y}" x2="${W - PAD_RIGHT}" y2="${y}" stroke="currentColor" stroke-opacity="0.08"/>`
    );
    gridLines.push(
      `<text x="${PAD_LEFT - 6}" y="${y + 3}" text-anchor="end" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="10">${Math.round(yVal)}</text>`
    );
  }

  // X-axis labels.
  const xAxis = xLabels.map((label, i) => {
    return `<text x="${xAt(i)}" y="${H - PAD_BOTTOM + 16}" text-anchor="middle" fill="currentColor" opacity="0.7" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(label)}</text>`;
  }).join('');

  // Series paths + points.
  const seriesSvg = series.map((s, sIdx) => {
    const color = s.color || colorFor(s.name, null);
    void sIdx;
    const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    const dots = s.values.map((v, i) => {
      const tooltip = `${s.name}: ${v} on ${xLabels[i]}`;
      return `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="4" fill="${color}"><title>${xml(tooltip)}</title></circle>`;
    }).join('');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');

  // Legend at top.
  const legendItems = series.map((s, i) => {
    const color = s.color || colorFor(s.name, null);
    const x = PAD_LEFT + i * 200;
    return `<g><circle cx="${x}" cy="20" r="5" fill="${color}"/><text x="${x + 12}" y="24" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="12">${xml(s.name)}</text></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Series over time">${gridLines.join('')}${xAxis}${seriesSvg}${legendItems}</svg>`;
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = pow / 2;
  return Math.ceil(n / step) * step;
}
