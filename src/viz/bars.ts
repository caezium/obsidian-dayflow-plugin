import { xml } from '../util/escape.js';
import { colorFor } from '../util/colors.js';
import { fmtDuration } from '../util/time.js';

const W = 720;
const ROW_H = 24;
const LABEL_W = 130;
const PAD = 12;
const TRAIL_W = 80;

export interface BarItem {
  name: string;
  value: number;
  color?: string;
}

export function renderBars(items: BarItem[]): string {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 56" width="100%"><text x="${W / 2}" y="32" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="13">No data</text></svg>`;
  }
  const max = sorted[0].value;
  const h = PAD + sorted.length * ROW_H + PAD;
  const trackX = LABEL_W + PAD;
  const trackW = W - trackX - PAD - TRAIL_W;
  const rows = sorted.map((it, i) => {
    const y = PAD + i * ROW_H;
    const w = max > 0 ? (it.value / max) * trackW : 0;
    const color = it.color || colorFor(it.name);
    return `<g><text x="${LABEL_W + PAD - 8}" y="${y + 16}" text-anchor="end" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="12">${xml(it.name)}</text><rect x="${trackX}" y="${y + 4}" width="${trackW}" height="${ROW_H - 10}" rx="3" fill="currentColor" opacity="0.08"></rect><rect x="${trackX}" y="${y + 4}" width="${w}" height="${ROW_H - 10}" rx="3" fill="${color}"></rect><text x="${trackX + trackW + 8}" y="${y + 16}" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(fmtDuration(it.value))}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="Category totals">${rows}</svg>`;
}
