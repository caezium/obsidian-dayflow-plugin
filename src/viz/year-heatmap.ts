/**
 * GitHub-style year-in-cells heatmap. 53 weeks × 7 days. Color intensity
 * scales with minutes tracked that day. Month labels along the top.
 *
 * Layout: cols = weeks (Mon-anchored), rows = day of week (Sun..Sat).
 */
import { xml } from '../util/escape.js';
import type { DayActivity } from '../aggregators/year-activity.js';

const CELL = 12;
const GAP = 2;
const PAD_LEFT = 30;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const PAD_RIGHT = 8;
const COLOR_LOW: [number, number, number] = [241, 245, 249];   // slate-100
const COLOR_HIGH: [number, number, number] = [79, 70, 229];    // indigo-600
const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function renderYearHeatmap(activity: DayActivity[]): string {
  if (activity.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" width="100%"><text x="300" y="60" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="14">No data</text></svg>`;
  }

  // Determine the grid origin: start at the Sunday on or before the first day.
  const first = new Date(`${activity[0].day}T12:00:00`);
  const startSunday = new Date(first);
  startSunday.setDate(first.getDate() - first.getDay());

  // Index activity by day-string for fast lookup.
  const idx = new Map(activity.map((a) => [a.day, a.minutes] as const));
  const max = Math.max(60, ...activity.map((a) => a.minutes)); // floor at 60min so quiet days don't oversaturate

  // Compute number of weeks: enough to cover the last activity day.
  const lastDay = new Date(`${activity[activity.length - 1].day}T12:00:00`);
  const totalDays = Math.ceil((lastDay.valueOf() - startSunday.valueOf()) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const w = PAD_LEFT + weeks * (CELL + GAP) + PAD_RIGHT;
  const h = PAD_TOP + 7 * (CELL + GAP) + PAD_BOTTOM + 14;

  // Month labels — emit when the month changes AND we have at least 24px
  // since the previous label (otherwise consecutive months collide visually,
  // e.g. "Dec" at col 0 and "Jan" at col 1 render as "Dedan").
  const monthLabels: string[] = [];
  let lastMonth = -1;
  let lastLabelX = -Infinity;
  const MIN_LABEL_DX = 24;
  for (let wi = 0; wi < weeks; wi++) {
    const d = new Date(startSunday);
    d.setDate(startSunday.getDate() + wi * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      const x = PAD_LEFT + wi * (CELL + GAP);
      if (x - lastLabelX >= MIN_LABEL_DX) {
        monthLabels.push(
          `<text x="${x}" y="${PAD_TOP - 4}" fill="currentColor" opacity="0.65" font-family="-apple-system, system-ui, sans-serif" font-size="10">${MONTH_NAMES[m]}</text>`
        );
        lastLabelX = x;
      }
      lastMonth = m;
    }
  }

  // Day-of-week labels on the left.
  const dowLabels = DAY_LABELS.map((lbl, row) =>
    lbl ? `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + row * (CELL + GAP) + CELL - 2}" text-anchor="end" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="10">${lbl}</text>` : ''
  ).join('');

  // Cells.
  const cells: string[] = [];
  for (let wi = 0; wi < weeks; wi++) {
    for (let row = 0; row < 7; row++) {
      const date = new Date(startSunday);
      date.setDate(startSunday.getDate() + wi * 7 + row);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dayString = `${y}-${m}-${d}`;
      const minutes = idx.get(dayString);
      // Skip cells outside the actual range so the heatmap doesn't show empties beyond data.
      if (minutes == null) continue;
      const x = PAD_LEFT + wi * (CELL + GAP);
      const ypx = PAD_TOP + row * (CELL + GAP);
      const intensity = Math.min(1, minutes / max);
      const color = lerp(COLOR_LOW, COLOR_HIGH, intensity);
      const tooltip = `${dayString} — ${Math.round(minutes)} min`;
      cells.push(
        `<rect x="${x}" y="${ypx}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"><title>${xml(tooltip)}</title></rect>`
      );
    }
  }

  // Legend strip at the bottom.
  const legendY = PAD_TOP + 7 * (CELL + GAP) + 12;
  const legendCells = Array.from({ length: 5 }, (_, i) => {
    const intensity = i / 4;
    const color = lerp(COLOR_LOW, COLOR_HIGH, intensity);
    return `<rect x="${PAD_LEFT + i * (CELL + GAP)}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`;
  }).join('');
  const legend = `<g><text x="${PAD_LEFT - 6}" y="${legendY + CELL - 2}" text-anchor="end" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="10">Less</text>${legendCells}<text x="${PAD_LEFT + 5 * (CELL + GAP) + 4}" y="${legendY + CELL - 2}" fill="currentColor" opacity="0.55" font-family="-apple-system, system-ui, sans-serif" font-size="10">More</text></g>`;

  // Render at natural pixel size. `width="100%"` would scale the SVG up to
  // fill any container (Obsidian dashboards can be ~1900px wide) which
  // explodes 12px cells into 70px monsters. Natural size + CSS max-width
  // gives the best of both worlds: small by default, shrinks on narrow
  // viewports via the stylesheet.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Year activity heatmap">${monthLabels.join('')}${dowLabels}${cells.join('')}${legend}</svg>`;
}

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
