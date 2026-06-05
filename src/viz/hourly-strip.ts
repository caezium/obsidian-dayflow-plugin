/**
 * Single-row hourly strip for daily notes — 24 cells, each tinted by the
 * dominant category in that hour. At-a-glance "when did I work today"
 * without needing a full chart.
 */
import { xml } from '../util/escape.js';
import type { DominantCell } from '../aggregators/dominant-category.js';

const CELL_W = 30;
const CELL_H = 28;
const PAD_LEFT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const PAD_RIGHT = 8;

/**
 * Expects a single day's dominantCategoryGrid row with 48 buckets (30-min).
 * Collapses pairs of 30-min buckets into one 1-hour cell.
 */
export function renderHourlyStrip(
  bucketsHalfHour: DominantCell[],
  colorMap: Record<string, string>
): string {
  const hours = 24;
  const w = PAD_LEFT + hours * CELL_W + PAD_RIGHT;
  const h = PAD_TOP + CELL_H + PAD_BOTTOM;

  const cells: string[] = [];
  for (let hour = 0; hour < hours; hour++) {
    const a = bucketsHalfHour[hour * 2] ?? { category: null, minutes: 0 };
    const b = bucketsHalfHour[hour * 2 + 1] ?? { category: null, minutes: 0 };
    // Combine the two halves' minutes per category and pick winner.
    const merged = new Map<string, number>();
    for (const cell of [a, b]) {
      if (cell.category) merged.set(cell.category, (merged.get(cell.category) ?? 0) + cell.minutes);
    }
    let winner: { category: string | null; minutes: number } = { category: null, minutes: 0 };
    for (const [cat, mins] of merged.entries()) {
      if (mins > winner.minutes) winner = { category: cat, minutes: mins };
    }
    const x = PAD_LEFT + hour * CELL_W;
    if (!winner.category) {
      cells.push(
        `<rect x="${x + 1}" y="${PAD_TOP + 1}" width="${CELL_W - 2}" height="${CELL_H - 2}" rx="3" fill="currentColor" opacity="0.04"/>`
      );
    } else {
      const color = colorMap[winner.category] || '#888';
      const opacity = Math.min(1, 0.4 + (winner.minutes / 60) * 0.6);
      const tooltip = `${String(hour).padStart(2, '0')}:00 — ${winner.category} (${Math.round(winner.minutes)}m)`;
      cells.push(
        `<rect x="${x + 1}" y="${PAD_TOP + 1}" width="${CELL_W - 2}" height="${CELL_H - 2}" rx="3" fill="${color}" opacity="${opacity.toFixed(2)}"><title>${xml(tooltip)}</title></rect>`
      );
    }
    if (hour % 3 === 0 || hour === 23) {
      cells.push(
        `<text x="${x + CELL_W / 2}" y="${PAD_TOP + CELL_H + 14}" text-anchor="middle" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="10">${hour}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Hourly strip">${cells.join('')}</svg>`;
}
