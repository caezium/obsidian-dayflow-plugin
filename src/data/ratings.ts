import type { Database } from 'sql.js';
import { queryAll } from '../db.js';
import type { Rating } from '../types.js';

export function fetchRatings(
  db: Database,
  tables: Set<string>,
  dayString: string
): Rating[] {
  if (!tables.has('timeline_review_ratings')) return [];
  const start = Math.floor(new Date(`${dayString}T04:00:00`).getTime() / 1000);
  const end = start + 24 * 60 * 60;
  return queryAll<Rating>(
    db,
    `SELECT id, start_ts, end_ts, rating
       FROM timeline_review_ratings
      WHERE start_ts >= ? AND start_ts < ?
      ORDER BY start_ts ASC`,
    [start, end]
  );
}
