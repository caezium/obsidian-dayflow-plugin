/**
 * For each (day, time-bucket) compute the dominant category — the
 * category that owns the most minutes inside that bucket. Used by the
 * "Your workflow this week" colored grid where cells are tinted by what
 * you were mostly doing in that 30-minute (or N-minute) window.
 */
import type { TimelineCard } from '../types.js';

export interface DominantCell {
  category: string | null;
  minutes: number;
}

/**
 * Returns a [dayIdx][bucketIdx] matrix. bucketMinutes defaults to 30,
 * giving 48 columns per day.
 */
export function dominantCategoryGrid(
  cards: TimelineCard[],
  days: string[],
  bucketMinutes = 30
): DominantCell[][] {
  const bucketsPerDay = Math.floor((24 * 60) / bucketMinutes);
  const dayIdx = new Map(days.map((d, i) => [d, i] as const));
  // accum[day][bucket] = Map<category, minutes>
  const accum: Map<string, number>[][] = days.map(() =>
    Array.from({ length: bucketsPerDay }, () => new Map<string, number>())
  );

  for (const c of cards) {
    if (!c.day || !dayIdx.has(c.day)) continue;
    const row = dayIdx.get(c.day)!;
    const cat = c.category || 'Uncategorized';
    const startMs = c.start_ts * 1000;
    const endMs = c.end_ts * 1000;
    let cursor = new Date(startMs);
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    while (cursor < new Date(endMs)) {
      const nextBoundary = new Date(cursor);
      nextBoundary.setMinutes(
        Math.floor(nextBoundary.getMinutes() / bucketMinutes) * bucketMinutes + bucketMinutes,
        0,
        0
      );
      const segmentEnd = nextBoundary.valueOf() < endMs ? nextBoundary : new Date(endMs);
      const segmentMins = Math.max(0, (segmentEnd.valueOf() - cursor.valueOf()) / 60000);
      const minutesIntoDay = (cursor.valueOf() - dayStart.valueOf()) / 60000;
      const bucketIdx = Math.floor(minutesIntoDay / bucketMinutes);
      if (bucketIdx >= 0 && bucketIdx < bucketsPerDay) {
        const m = accum[row][bucketIdx];
        m.set(cat, (m.get(cat) ?? 0) + segmentMins);
      }
      cursor = nextBoundary;
    }
  }

  return accum.map((dayRow) =>
    dayRow.map((bucketMap) => {
      let best: { category: string | null; minutes: number } = { category: null, minutes: 0 };
      for (const [cat, mins] of bucketMap.entries()) {
        if (mins > best.minutes) best = { category: cat, minutes: mins };
      }
      return best;
    })
  );
}
