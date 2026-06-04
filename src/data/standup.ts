import type { Database } from 'sql.js';
import { queryOne } from '../db.js';
import type { Standup, StandupPayload } from '../types.js';

interface StandupRow {
  standup_day: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
}

export function fetchStandup(
  db: Database,
  tables: Set<string>,
  dayString: string
): Standup | null {
  if (!tables.has('daily_standup_entries')) return null;
  const row = queryOne<StandupRow>(
    db,
    'SELECT standup_day, payload_json, created_at, updated_at FROM daily_standup_entries WHERE standup_day = ?',
    [dayString]
  );
  if (!row) return null;
  let payload: StandupPayload = {};
  try {
    payload = JSON.parse(row.payload_json) as StandupPayload;
  } catch {
    /* keep payload empty if unparseable */
  }
  return {
    day: row.standup_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload,
  };
}
