import { xml } from '../util/escape.js';
import { colorFor, colorForApp, contrastingText } from '../util/colors.js';
import { fmtDuration } from '../util/time.js';

const W = 720;
const H = 420;
const PAD = 2;
const NESTED_INNER_PAD = 8;
const NESTED_HEADER_H = 22;

export interface TreemapItem {
  name: string;
  value: number;
  color?: string;
  /** Optional sub-items for nested treemap (e.g. apps inside a category). */
  children?: TreemapItem[];
}

/**
 * Flat treemap — one tile per top-level item.
 */
export function renderTreemap(items: TreemapItem[]): string {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (total === 0) return emptyChart('No data for this period');
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const rects = squarify(sorted, total, { x: 0, y: 0, w: W, h: H });
  return wrap(rects.map((r) => flatTile(r, total)).join(''));
}

/**
 * Nested treemap — outer tiles are categories, each holds inner tiles
 * for its `children` (apps). Categories with children get a header row +
 * inner squarified layout. Mirrors Dayflow's "Most used per category".
 */
export function renderNestedTreemap(items: TreemapItem[]): string {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (total === 0) return emptyChart('No data for this period');
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const rects = squarify(sorted, total, { x: 0, y: 0, w: W, h: H });
  const tiles = rects.map((r) => nestedTile(r, total)).join('');
  return wrap(tiles);
}

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Dayflow treemap">${inner}</svg>`;
}

interface Rect { x: number; y: number; w: number; h: number; item: TreemapItem }

function flatTile(r: Rect, total: number): string {
  const w = Math.max(0, r.w - PAD);
  const h = Math.max(0, r.h - PAD);
  const color = r.item.color || colorFor(r.item.name);
  const pct = total > 0 ? (r.item.value / total) * 100 : 0;
  const labelOk = w > 60 && h > 26;
  const subOk = w > 60 && h > 44;
  const label = labelOk
    ? `<text x="${r.x + 8}" y="${r.y + 18}" fill="#fff" font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="600">${xml(truncate(r.item.name, Math.max(4, Math.floor(w / 7))))}</text>`
    : '';
  const sub = subOk
    ? `<text x="${r.x + 8}" y="${r.y + 34}" fill="rgba(255,255,255,0.85)" font-family="-apple-system, system-ui, sans-serif" font-size="11">${fmtDuration(r.item.value)} · ${pct.toFixed(0)}%</text>`
    : '';
  return `<g><rect x="${r.x}" y="${r.y}" width="${w}" height="${h}" rx="6" ry="6" fill="${color}"><title>${xml(r.item.name)} — ${fmtDuration(r.item.value)} (${pct.toFixed(1)}%)</title></rect>${label}${sub}</g>`;
}

function nestedTile(r: Rect, total: number): string {
  const outerColor = r.item.color || colorFor(r.item.name);
  const w = Math.max(0, r.w - PAD);
  const h = Math.max(0, r.h - PAD);
  const pct = total > 0 ? (r.item.value / total) * 100 : 0;

  // Outer rect — soft tint of the category color so inner white tiles stand out.
  const outerRect = `<rect x="${r.x}" y="${r.y}" width="${w}" height="${h}" rx="8" ry="8" fill="${outerColor}" fill-opacity="0.18"><title>${xml(r.item.name)} — ${fmtDuration(r.item.value)} (${pct.toFixed(1)}%)</title></rect>`;
  // Header label inside the outer rect (top-left).
  const header = w > 80 && h > 30
    ? `<text x="${r.x + NESTED_INNER_PAD}" y="${r.y + 16}" fill="${outerColor}" font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="600">${xml(truncate(r.item.name, Math.max(4, Math.floor(w / 7))))}</text><text x="${r.x + w - NESTED_INNER_PAD}" y="${r.y + 16}" text-anchor="end" fill="${outerColor}" opacity="0.7" font-family="-apple-system, system-ui, sans-serif" font-size="11">${fmtDuration(r.item.value)}</text>`
    : '';

  // Inner area for children — below the header, padded.
  const children = (r.item.children || []).filter((c) => c.value > 0);
  if (children.length === 0 || w < 100 || h < 80) {
    return `<g>${outerRect}${header}</g>`;
  }
  const innerBox = {
    x: r.x + NESTED_INNER_PAD,
    y: r.y + NESTED_HEADER_H + NESTED_INNER_PAD,
    w: Math.max(0, w - NESTED_INNER_PAD * 2),
    h: Math.max(0, h - NESTED_HEADER_H - NESTED_INNER_PAD * 2),
  };
  if (innerBox.w <= 0 || innerBox.h <= 0) {
    return `<g>${outerRect}${header}</g>`;
  }
  const childTotal = children.reduce((s, c) => s + c.value, 0);
  const sorted = [...children].sort((a, b) => b.value - a.value);
  const inner = squarify(sorted, childTotal, innerBox);
  const innerTiles = inner.map((ir) => {
    const iw = Math.max(0, ir.w - 3);
    const ih = Math.max(0, ir.h - 3);
    // Each inner tile takes its app's brand color (e.g. youtube red,
    // github charcoal). Unknown apps fall back to the hash palette.
    const appColor = colorForApp(ir.item.name);
    const textColor = contrastingText(appColor);
    const subTextColor = textColor === '#fff' ? 'rgba(255,255,255,0.78)' : 'rgba(31,41,55,0.65)';
    const tile = `<rect x="${ir.x}" y="${ir.y}" width="${iw}" height="${ih}" rx="4" ry="4" fill="${appColor}" stroke="${outerColor}" stroke-opacity="0.25"/>`;
    const labelOk = iw > 40 && ih > 22;
    const label = labelOk
      ? `<text x="${ir.x + 6}" y="${ir.y + 14}" fill="${textColor}" font-family="-apple-system, system-ui, sans-serif" font-size="11" font-weight="600">${xml(truncate(ir.item.name, Math.max(3, Math.floor(iw / 6))))}</text>`
      : '';
    const sub = iw > 50 && ih > 32
      ? `<text x="${ir.x + 6}" y="${ir.y + 28}" fill="${subTextColor}" font-family="-apple-system, system-ui, sans-serif" font-size="10">${fmtDuration(ir.item.value)}</text>`
      : '';
    return `<g><title>${xml(ir.item.name)} — ${fmtDuration(ir.item.value)}</title>${tile}${label}${sub}</g>`;
  }).join('');

  return `<g>${outerRect}${header}${innerTiles}</g>`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}

function emptyChart(msg: string): string {
  return wrap(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="14">${xml(msg)}</text>`);
}

interface Box { x: number; y: number; w: number; h: number }

function squarify(items: TreemapItem[], total: number, rect: Box): Rect[] {
  const out: Rect[] = [];
  let remaining = items.slice();
  let box: Box = { ...rect };
  let totalLeft = total;

  while (remaining.length > 0) {
    const row: TreemapItem[] = [];
    let rowSum = 0;
    const shortSide = Math.min(box.w, box.h);
    while (remaining.length > 0) {
      const next = remaining[0];
      const candidate = row.concat([next]);
      const worstCurrent = row.length === 0 ? Infinity : worstRatio(row, rowSum, shortSide, box.w * box.h, totalLeft);
      const worstNext = worstRatio(candidate, rowSum + next.value, shortSide, box.w * box.h, totalLeft);
      if (row.length > 0 && worstCurrent < worstNext) break;
      row.push(next);
      rowSum += next.value;
      remaining.shift();
    }
    const area = box.w * box.h;
    const rowArea = (rowSum / totalLeft) * area;
    if (box.w <= box.h) {
      const rowH = rowArea / box.w;
      let cursorX = box.x;
      for (const it of row) {
        const w = (it.value / rowSum) * box.w;
        out.push({ x: cursorX, y: box.y, w, h: rowH, item: it });
        cursorX += w;
      }
      box = { x: box.x, y: box.y + rowH, w: box.w, h: box.h - rowH };
    } else {
      const rowW = rowArea / box.h;
      let cursorY = box.y;
      for (const it of row) {
        const h = (it.value / rowSum) * box.h;
        out.push({ x: box.x, y: cursorY, w: rowW, h, item: it });
        cursorY += h;
      }
      box = { x: box.x + rowW, y: box.y, w: box.w - rowW, h: box.h };
    }
    totalLeft -= rowSum;
    if (box.w <= 0 || box.h <= 0) break;
  }
  return out;
}

function worstRatio(row: TreemapItem[], sum: number, shortSide: number, area: number, totalLeft: number): number {
  if (sum === 0) return Infinity;
  const rowArea = (sum / totalLeft) * area;
  const s2 = shortSide * shortSide;
  let worst = 0;
  for (const r of row) {
    const ratioA = (s2 * r.value) / (rowArea * rowArea / sum) / sum;
    const ratioB = (rowArea * rowArea / sum) / (s2 * r.value) * sum;
    worst = Math.max(worst, ratioA, ratioB);
  }
  return worst;
}
