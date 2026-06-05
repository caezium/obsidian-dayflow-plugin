import { xml } from '../util/escape.js';
import { colorForApp } from '../util/colors.js';
import type { AppTransition } from '../types.js';

const W = 760;
const H = 460;
const PAD = 24;
const LABEL_W = 110;
const NODE_W = 12;
const MAX_NODES = 10;
const MAX_LABEL = 14;

export function renderSankey(transitions: AppTransition[]): string {
  if (!transitions || transitions.length === 0) return empty('No transitions recorded');

  const sources = new Map<string, number>();
  const targets = new Map<string, number>();
  for (const t of transitions) {
    sources.set(t.source, (sources.get(t.source) || 0) + t.count);
    targets.set(t.target, (targets.get(t.target) || 0) + t.count);
  }
  const topSources = topKeys(sources, MAX_NODES);
  const topTargets = topKeys(targets, MAX_NODES);
  const filtered = transitions.filter(
    (t) => topSources.includes(t.source) && topTargets.includes(t.target)
  );
  if (filtered.length === 0) return empty('No transitions in top apps');

  const leftX = PAD + LABEL_W;
  const rightX = W - PAD - LABEL_W - NODE_W;
  const totalLeft = topSources.reduce((s, k) => s + sources.get(k)!, 0);
  const totalRight = topTargets.reduce((s, k) => s + targets.get(k)!, 0);
  const leftYs = layoutColumn(topSources, sources, totalLeft);
  const rightYs = layoutColumn(topTargets, targets, totalRight);

  const links = filtered.map((t) => {
    const sy = leftYs.get(t.source)!;
    const ty = rightYs.get(t.target)!;
    const w = Math.max(1, (t.count / Math.max(totalLeft, totalRight)) * (H - 2 * PAD));
    const sMid = sy.y + sy.h / 2;
    const tMid = ty.y + ty.h / 2;
    const c1x = leftX + NODE_W + (rightX - leftX - NODE_W) * 0.4;
    const c2x = leftX + NODE_W + (rightX - leftX - NODE_W) * 0.6;
    const color = colorForApp(t.source);
    return `<path d="M ${leftX + NODE_W} ${sMid} C ${c1x} ${sMid}, ${c2x} ${tMid}, ${rightX} ${tMid}" stroke="${color}" stroke-opacity="0.35" stroke-width="${w}" fill="none"><title>${xml(t.source)} → ${xml(t.target)} (${t.count})</title></path>`;
  }).join('');

  const leftNodes = topSources.map((k) => {
    const { y, h } = leftYs.get(k)!;
    const color = colorForApp(k);
    return `<g><rect x="${leftX}" y="${y}" width="${NODE_W}" height="${h}" rx="2" fill="${color}"></rect><text x="${leftX - 6}" y="${y + h / 2 + 4}" text-anchor="end" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(truncate(k, MAX_LABEL))} (${sources.get(k)})</text></g>`;
  }).join('');

  const rightNodes = topTargets.map((k) => {
    const { y, h } = rightYs.get(k)!;
    const color = colorForApp(k);
    return `<g><rect x="${rightX}" y="${y}" width="${NODE_W}" height="${h}" rx="2" fill="${color}"></rect><text x="${rightX + NODE_W + 6}" y="${y + h / 2 + 4}" text-anchor="start" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(truncate(k, MAX_LABEL))} (${targets.get(k)})</text></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="App transitions Sankey">${links}${leftNodes}${rightNodes}</svg>`;
}

function topKeys(map: Map<string, number>, n: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function layoutColumn(keys: string[], totals: Map<string, number>, total: number): Map<string, { y: number; h: number }> {
  const avail = H - 2 * PAD;
  const gap = 4;
  const usable = avail - gap * (keys.length - 1);
  const positions = new Map<string, { y: number; h: number }>();
  let y = PAD;
  for (const k of keys) {
    const h = Math.max(8, (totals.get(k)! / total) * usable);
    positions.set(k, { y, h });
    y += h + gap;
  }
  return positions;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}

function empty(msg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 60" width="100%"><text x="${W / 2}" y="34" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="-apple-system, system-ui, sans-serif" font-size="13">${xml(msg)}</text></svg>`;
}
