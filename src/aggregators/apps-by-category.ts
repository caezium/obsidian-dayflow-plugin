/**
 * Per-category app breakdown: which apps (and how many minutes) make up
 * each category. Used as the children for the nested treemap.
 */
import { minutesBetween } from '../util/time.js';
import type { TimelineCard } from '../types.js';

export interface CategoryApps {
  category: string;
  totalMinutes: number;
  apps: { app: string; minutes: number }[];
}

export function appsByCategory(cards: TimelineCard[]): CategoryApps[] {
  const byCat = new Map<string, { total: number; apps: Map<string, number> }>();
  for (const c of cards) {
    const cat = c.category || 'Uncategorized';
    const mins = minutesBetween(c.start_ts, c.end_ts);
    if (!byCat.has(cat)) byCat.set(cat, { total: 0, apps: new Map() });
    const bucket = byCat.get(cat)!;
    bucket.total += mins;
    // Charge the card's minutes to its primary app (or "Other" if missing).
    const app = c.appPrimary || 'Other';
    bucket.apps.set(app, (bucket.apps.get(app) ?? 0) + mins);
  }
  return [...byCat.entries()]
    .map(([category, { total, apps }]) => ({
      category,
      totalMinutes: total,
      apps: [...apps.entries()]
        .map(([app, minutes]) => ({ app, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}
