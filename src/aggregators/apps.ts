import { minutesBetween } from '../util/time.js';
import type { AppStat, AppTransition, TimelineCard } from '../types.js';

export function appBreakdown(cards: TimelineCard[]): AppStat[] {
  const byApp = new Map<string, AppStat>();
  for (const c of cards) {
    const mins = minutesBetween(c.start_ts, c.end_ts);
    for (const app of [c.appPrimary, c.appSecondary]) {
      if (!app) continue;
      if (!byApp.has(app)) byApp.set(app, { app, minutes: 0, sessions: 0 });
      const a = byApp.get(app)!;
      a.minutes += mins;
      a.sessions += 1;
    }
  }
  return [...byApp.values()].sort((a, b) => b.minutes - a.minutes);
}

export function appTransitions(cards: TimelineCard[]): AppTransition[] {
  const ordered = cards
    .filter((c) => c.appPrimary)
    .sort((a, b) => a.start_ts - b.start_ts);
  const pairs = new Map<string, AppTransition>();
  for (let i = 1; i < ordered.length; i++) {
    const source = ordered[i - 1].appPrimary!;
    const target = ordered[i].appPrimary!;
    if (source === target) continue;
    const key = `${source}␟${target}`;
    const existing = pairs.get(key);
    if (existing) existing.count += 1;
    else pairs.set(key, { source, target, count: 1 });
  }
  return [...pairs.values()].sort((a, b) => b.count - a.count);
}
