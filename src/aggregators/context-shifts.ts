/**
 * Per-day context shifts (category transitions) and distraction counts.
 *
 * "Context shift" = adjacent timeline cards on the same day with different
 * categories. So Work → Distraction → Work counts as 2 shifts.
 *
 * Distractions = sum of `metadata.distractions[]` per card on that day.
 */
import type { TimelineCard } from '../types.js';

export interface DayCounts {
  day: string;
  shifts: number;
  distractions: number;
}

export function contextShifts(cards: TimelineCard[], days: string[]): DayCounts[] {
  const byDay = new Map<string, TimelineCard[]>();
  for (const c of cards) {
    if (!c.day) continue;
    if (!byDay.has(c.day)) byDay.set(c.day, []);
    byDay.get(c.day)!.push(c);
  }
  return days.map((day) => {
    const dayCards = (byDay.get(day) || []).slice().sort((a, b) => a.start_ts - b.start_ts);
    let shifts = 0;
    for (let i = 1; i < dayCards.length; i++) {
      if (dayCards[i].category !== dayCards[i - 1].category) shifts += 1;
    }
    let distractions = 0;
    for (const c of dayCards) distractions += c.distractions?.length ?? 0;
    return { day, shifts, distractions };
  });
}
