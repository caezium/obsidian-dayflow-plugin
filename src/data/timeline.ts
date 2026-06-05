import type { Database } from 'sql.js';
import { queryAll } from '../db.js';
import type { TimelineCard, TimelineCardRow } from '../types.js';

export function fetchTimelineCards(
  db: Database,
  dayString: string,
  opts: { includeDeleted?: boolean } = {}
): TimelineCard[] {
  const includeDeleted = opts.includeDeleted ?? false;
  const sql = `
    SELECT id, batch_id, start, end, start_ts, end_ts, day,
           title, summary, detailed_summary, category, subcategory,
           metadata, video_summary_url, created_at, is_deleted
      FROM timeline_cards
     WHERE day = ? ${includeDeleted ? '' : 'AND is_deleted = 0'}
     ORDER BY start_ts ASC`;
  return queryAll<TimelineCardRow>(db, sql, [dayString]).map(parseCard).filter(notFailed);
}

export function fetchTimelineCardsRange(
  db: Database,
  fromDay: string,
  toDay: string,
  opts: { includeDeleted?: boolean } = {}
): TimelineCard[] {
  const includeDeleted = opts.includeDeleted ?? false;
  const sql = `
    SELECT id, batch_id, start, end, start_ts, end_ts, day,
           title, summary, detailed_summary, category, subcategory,
           metadata, video_summary_url, created_at, is_deleted
      FROM timeline_cards
     WHERE day >= ? AND day <= ? ${includeDeleted ? '' : 'AND is_deleted = 0'}
     ORDER BY start_ts ASC`;
  return queryAll<TimelineCardRow>(db, sql, [fromDay, toDay]).map(parseCard).filter(notFailed);
}

interface CardMetadata {
  appSites?: {
    primary?: string;
    secondary?: string;
  };
  distractions?: TimelineCard['distractions'];
}

function parseCard(row: TimelineCardRow): TimelineCard {
  let appPrimary: string | null = null;
  let appSecondary: string | null = null;
  let distractions: TimelineCard['distractions'] = [];
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata) as CardMetadata;
      appPrimary = parsed.appSites?.primary ?? null;
      appSecondary = parsed.appSites?.secondary ?? null;
      if (Array.isArray(parsed.distractions)) distractions = parsed.distractions;
    } catch {
      /* ignore malformed metadata */
    }
  }
  return { ...row, appPrimary, appSecondary, distractions };
}

function notFailed(card: TimelineCard): boolean {
  if (card.category !== 'System') return true;
  const t = card.title || '';
  return !(t.includes('Processing failed') || t.includes('Error') || card.subcategory === 'Error');
}
