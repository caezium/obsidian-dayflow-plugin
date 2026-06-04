import type { Database } from 'sql.js';
import { queryOne } from '../db.js';
import type { JournalEntry } from '../types.js';

export function fetchJournalEntry(db: Database, dayString: string): JournalEntry | null {
  return queryOne<JournalEntry>(
    db,
    `SELECT id, day, intentions, notes, goals, reflections, summary, status,
            created_at, updated_at
       FROM journal_entries WHERE day = ?`,
    [dayString]
  );
}
