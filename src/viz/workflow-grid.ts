/**
 * "Your workflow this week" — a 7-row × N-column grid where each cell is
 * tinted by the dominant category in that time bucket. Idle / empty cells
 * stay neutral. Mirrors Dayflow's in-app workflow view.
 */
import { xml } from '../util/escape.js';
import type { DominantCell } from '../aggregators/dominant-category.js';

const CELL = 14;
const PAD_LEFT = 50;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;
const PAD_RIGHT = 12;

export function renderWorkflowGrid(
  grid: DominantCell[][],
  dayLabels: string[],
  colorMap: Record<string, string>,
  bucketMinutes: number
): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const w = PAD_LEFT + cols * CELL + PAD_RIGHT;
  const h = PAD_TOP + rows * CELL + PAD_BOTTOM;

  // Hour ticks along the bottom — show every 2 hours.
  const ticks: string[] = [];
  const tickEveryBuckets = Math.max(1, Math.round(120 / bucketMinutes));
  for (let c = 0; c <= cols; c += tickEveryBuckets) {
    const hour = Math.floor((c * bucketMinutes) / 60);
    if (hour > 24) break;
    const x = PAD_LEFT + c * CELL;
    ticks.push(
      `<text x="${x}" y="${PAD_TOP + rows * CELL + 14}" text-anchor="middle" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="10">${hour}</text>`
    );
  }

  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    cells.push(
      `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + r * CELL + CELL * 0.75}" text-anchor="end" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="10">${xml(dayLabels[r])}</text>`
    );
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const x = PAD_LEFT + c * CELL;
      const y = PAD_TOP + r * CELL;
      if (!cell.category || cell.minutes < 1) {
        cells.push(
          `<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="2" fill="currentColor" opacity="0.04"/>`
        );
      } else {
        const color = colorMap[cell.category] || '#888';
        const opacity = Math.min(1, 0.35 + (cell.minutes / 30) * 0.65);
        const hour = Math.floor((c * 30) / 60);
        const minute = (c * 30) % 60;
        const tooltip = `${dayLabels[r]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} — ${cell.category} (${Math.round(cell.minutes)}m)`;
        cells.push(
          `<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="2" fill="${color}" opacity="${opacity.toFixed(2)}"><title>${xml(tooltip)}</title></rect>`
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Workflow grid">${cells.join('')}${ticks.join('')}</svg>`;
}
