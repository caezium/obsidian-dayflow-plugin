import type { TimelineCard } from '../types.js';

export function focusHeatmap(cards: TimelineCard[], days: string[]): number[][] {
  const dayIdx = new Map(days.map((d, i) => [d, i] as const));
  const grid = days.map(() => new Array<number>(24).fill(0));
  for (const c of cards) {
    if (!c.day || !dayIdx.has(c.day)) continue;
    const row = dayIdx.get(c.day)!;
    const s = new Date(c.start_ts * 1000);
    const e = new Date(c.end_ts * 1000);
    let cursor = new Date(s);
    while (cursor < e) {
      const hour = cursor.getHours();
      const nextHour = new Date(cursor);
      nextHour.setHours(hour + 1, 0, 0, 0);
      const segmentEnd = nextHour < e ? nextHour : e;
      const minutes = Math.max(0, (segmentEnd.valueOf() - cursor.valueOf()) / 60000);
      grid[row][hour] += minutes;
      cursor = nextHour;
    }
  }
  return grid.map((row) => row.map((v) => Math.round(v)));
}
