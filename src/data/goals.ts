import type { Database } from 'sql.js';
import { queryAll, queryOne } from '../db.js';
import type { DayGoals, DayGoalCategory } from '../types.js';

interface DayGoalRow {
  day: string;
  focus_target_minutes: number;
  distraction_limit_minutes: number;
  is_skipped: number;
  created_at: number;
  updated_at: number;
}

export function fetchDayGoals(
  db: Database,
  tables: Set<string>,
  dayString: string
): DayGoals | null {
  if (!tables.has('day_goals')) return null;
  const goal = queryOne<DayGoalRow>(
    db,
    `SELECT day, focus_target_minutes, distraction_limit_minutes, is_skipped,
            created_at, updated_at
       FROM day_goals WHERE day = ?`,
    [dayString]
  );
  if (!goal) return null;
  let categories: DayGoalCategory[] = [];
  if (tables.has('day_goal_categories')) {
    categories = queryAll<DayGoalCategory>(
      db,
      `SELECT day, kind, category_id, category_name, category_color_hex, sort_order
         FROM day_goal_categories
        WHERE day = ?
        ORDER BY kind, sort_order`,
      [dayString]
    );
  }
  return {
    ...goal,
    isSkipped: Boolean(goal.is_skipped),
    focusCategories: categories.filter((c) => c.kind === 'focus'),
    distractionCategories: categories.filter((c) => c.kind === 'distraction'),
  };
}
