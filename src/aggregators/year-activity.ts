/**
 * Walk N days back from a reference day and roll up minutes-per-day from
 * the DB. Used by the year activity heatmap.
 */
import type { Database } from 'sql.js';
import { fetchTimelineCardsRange } from '../data/timeline.js';
import { minutesBetween } from '../util/time.js';

export interface DayActivity {
  day: string; // YYYY-MM-DD
  minutes: number;
}

export function yearActivity(
  db: Database,
  fromDay: string,
  toDay: string,
  includeDeleted: boolean
): DayActivity[] {
  const cards = fetchTimelineCardsRange(db, fromDay, toDay, { includeDeleted });
  const byDay = new Map<string, number>();
  for (const c of cards) {
    if (!c.day) continue;
    byDay.set(c.day, (byDay.get(c.day) ?? 0) + minutesBetween(c.start_ts, c.end_ts));
  }
  // Walk every calendar day from fromDay to toDay so empty days appear too.
  const out: DayActivity[] = [];
  const cursor = new Date(`${fromDay}T12:00:00`);
  const end = new Date(`${toDay}T12:00:00`);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const day = `${y}-${m}-${d}`;
    out.push({ day, minutes: byDay.get(day) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
