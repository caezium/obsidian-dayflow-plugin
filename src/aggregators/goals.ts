import { minutesBetween } from '../util/time.js';
import type { DayGoals, GoalProgress, TimelineCard } from '../types.js';

export function goalProgress(cards: TimelineCard[], goals: DayGoals | null): GoalProgress | null {
  if (!goals) return null;
  const focusCats = new Set(goals.focusCategories.map((c) => c.category_name));
  const distractionCats = new Set(goals.distractionCategories.map((c) => c.category_name));
  let focusMins = 0;
  let distractionMins = 0;
  for (const c of cards) {
    const mins = minutesBetween(c.start_ts, c.end_ts);
    if (focusCats.has(c.category)) focusMins += mins;
    if (distractionCats.has(c.category)) distractionMins += mins;
  }
  return {
    focusTargetMinutes: goals.focus_target_minutes,
    focusActualMinutes: focusMins,
    focusPct: goals.focus_target_minutes ? focusMins / goals.focus_target_minutes : null,
    distractionLimitMinutes: goals.distraction_limit_minutes,
    distractionActualMinutes: distractionMins,
    distractionPct: goals.distraction_limit_minutes
      ? distractionMins / goals.distraction_limit_minutes
      : null,
    isSkipped: goals.isSkipped,
  };
}
