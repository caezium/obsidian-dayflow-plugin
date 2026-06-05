/**
 * Compare a week's totals to the previous week. Used for the
 * "vs last week" block in the weekly note.
 */
import type { Database } from 'sql.js';
import { fetchTimelineCardsRange } from '../data/timeline.js';
import { fetchDayGoals } from '../data/goals.js';
import { categoryBreakdown } from './category.js';
import { goalProgress } from './goals.js';
import { appBreakdown } from './apps.js';
import { daysInWeek } from '../boundary.js';

export interface WeekTotals {
  weekKey: string;
  totalMinutes: number;
  focusMinutes: number;
  distractionMinutes: number;
  activeDays: number;
  topAppMinutes: number;
  topAppName: string | null;
}

export interface WeekDelta {
  current: WeekTotals;
  previous: WeekTotals | null;
  totalDelta: number;
  focusDelta: number;
  distractionDelta: number;
}

export function weekTotals(
  db: Database,
  tables: Set<string>,
  weekKey: string,
  includeDeleted: boolean
): WeekTotals {
  const days = daysInWeek(weekKey);
  const fromDay = days[0];
  const toDay = days[days.length - 1];
  const cards = fetchTimelineCardsRange(db, fromDay, toDay, { includeDeleted });

  const breakdown = categoryBreakdown(cards);
  const apps = appBreakdown(cards);
  // Day-level focus/distraction is goal-defined, so sum per-day progress.
  let focusMins = 0;
  let distractionMins = 0;
  for (const day of days) {
    const dayCards = cards.filter((c) => c.day === day);
    if (dayCards.length === 0) continue;
    const goals = fetchDayGoals(db, tables, day);
    const gp = goalProgress(dayCards, goals);
    if (gp && !gp.isSkipped) {
      focusMins += gp.focusActualMinutes;
      distractionMins += gp.distractionActualMinutes;
    }
  }
  const activeDays = days.filter((d) => cards.some((c) => c.day === d)).length;

  return {
    weekKey,
    totalMinutes: breakdown.totalMinutes,
    focusMinutes: focusMins,
    distractionMinutes: distractionMins,
    activeDays,
    topAppMinutes: apps[0]?.minutes ?? 0,
    topAppName: apps[0]?.app ?? null,
  };
}

export function previousWeekKey(weekKey: string): string {
  const days = daysInWeek(weekKey);
  // Previous week = the ISO week containing the day before this week's Monday.
  const monday = new Date(`${days[0]}T12:00:00`);
  monday.setDate(monday.getDate() - 7);
  // Reuse boundary.ts via inline impl to avoid circular concerns.
  const target = new Date(monday.valueOf());
  const dayNum = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weekComparison(
  db: Database,
  tables: Set<string>,
  weekKey: string,
  includeDeleted: boolean
): WeekDelta {
  const current = weekTotals(db, tables, weekKey, includeDeleted);
  let previous: WeekTotals | null = null;
  try {
    const prevKey = previousWeekKey(weekKey);
    previous = weekTotals(db, tables, prevKey, includeDeleted);
    // If previous week has no data, treat as null so we don't show -100% deltas.
    if (previous.totalMinutes === 0) previous = null;
  } catch {
    previous = null;
  }
  return {
    current,
    previous,
    totalDelta: previous ? current.totalMinutes - previous.totalMinutes : 0,
    focusDelta: previous ? current.focusMinutes - previous.focusMinutes : 0,
    distractionDelta: previous ? current.distractionMinutes - previous.distractionMinutes : 0,
  };
}
