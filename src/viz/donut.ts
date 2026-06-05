/**
 * Donut chart of category distribution. Center label shows total hours.
 *
 * Pure SVG arc math — no external chart libraries. Tooltips on each slice
 * show the category, duration, and percent.
 */
import { xml } from '../util/escape.js';
import { colorFor } from '../util/colors.js';
import { fmtDuration } from '../util/time.js';

const SIZE = 320;
const STROKE = 36;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

export interface DonutItem {
  name: string;
  value: number;
  color?: string;
}

export function renderDonut(items: DonutItem[]): string {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (total === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="100%" role="img" aria-label="Category distribution"><text x="${CX}" y="${CY}" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="14">No data</text></svg>`;
  }
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  let cursorAngle = -Math.PI / 2; // start at 12 o'clock
  const arcs = sorted.map((it) => {
    const fraction = it.value / total;
    const angle = fraction * 2 * Math.PI;
    const arc = arcPath(cursorAngle, cursorAngle + angle, R);
    cursorAngle += angle;
    const pct = (fraction * 100).toFixed(0);
    const color = it.color || colorFor(it.name);
    return `<path d="${arc}" stroke="${color}" stroke-width="${STROKE}" fill="none" stroke-linecap="butt"><title>${xml(it.name)} — ${fmtDuration(it.value)} (${pct}%)</title></path>`;
  }).join('');

  const totalHours = (total / 60).toFixed(1);
  const center = `<text x="${CX}" y="${CY - 8}" text-anchor="middle" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="11" font-weight="500" letter-spacing="0.05em">TOTAL</text><text x="${CX}" y="${CY + 18}" text-anchor="middle" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="22" font-weight="600">${totalHours}h</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="100%" role="img" aria-label="Category distribution donut">${arcs}${center}</svg>`;
}

function arcPath(startAngle: number, endAngle: number, radius: number): string {
  const x1 = CX + radius * Math.cos(startAngle);
  const y1 = CY + radius * Math.sin(startAngle);
  const x2 = CX + radius * Math.cos(endAngle);
  const y2 = CY + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  // For a full-circle single arc, split into two halves to avoid degenerate paths.
  if (Math.abs(endAngle - startAngle - 2 * Math.PI) < 1e-6) {
    const mid = startAngle + Math.PI;
    const xm = CX + radius * Math.cos(mid);
    const ym = CY + radius * Math.sin(mid);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${xm} ${ym} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}
