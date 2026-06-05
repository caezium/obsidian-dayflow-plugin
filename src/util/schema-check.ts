/**
 * Detect drift between the plugin's expected schema and the user's actual
 * chunks.sqlite. When Dayflow.app ships new tables or columns, we want to
 * tell the user that the plugin isn't reading the new data — so they know
 * whether to update.
 *
 * Output structure separates "missing required" (plugin will break) from
 * "extra unknown" (Dayflow ships something we don't yet surface).
 */
import type { Database } from 'sql.js';
import { queryAll } from '../db.js';

interface ExpectedTable {
  name: string;
  required: boolean;
  /** Columns we explicitly read. Other columns can exist without warning. */
  columns: string[];
}

// Keep in sync with the data fetchers in src/data/.
export const EXPECTED_TABLES: ExpectedTable[] = [
  {
    name: 'timeline_cards',
    required: true,
    columns: ['id','batch_id','start','end','start_ts','end_ts','day','title','summary','detailed_summary','category','subcategory','metadata','video_summary_url','created_at','is_deleted'],
  },
  { name: 'journal_entries', required: false, columns: ['id','day','intentions','notes','goals','reflections','summary','status','created_at','updated_at'] },
  { name: 'daily_standup_entries', required: false, columns: ['standup_day','payload_json','created_at','updated_at'] },
  { name: 'day_goals', required: false, columns: ['day','focus_target_minutes','distraction_limit_minutes','is_skipped','created_at','updated_at'] },
  { name: 'day_goal_categories', required: false, columns: ['day','kind','category_id','category_name','category_color_hex','sort_order'] },
  { name: 'timeline_review_ratings', required: false, columns: ['id','start_ts','end_ts','rating'] },
];

export interface SchemaReport {
  ok: boolean;
  missingRequired: string[];      // table names we need that don't exist
  missingOptional: string[];      // table names we'd use if present but aren't critical
  missingColumns: { table: string; columns: string[] }[];
  unknownTables: string[];        // tables we don't know about — likely new features
}

interface SqliteColumnInfo {
  name: string;
}

interface SqliteMasterRow {
  name: string;
}

export function checkSchema(db: Database, presentTables: Set<string>): SchemaReport {
  const report: SchemaReport = {
    ok: true,
    missingRequired: [],
    missingOptional: [],
    missingColumns: [],
    unknownTables: [],
  };

  const knownNames = new Set(EXPECTED_TABLES.map((t) => t.name));

  for (const tab of EXPECTED_TABLES) {
    if (!presentTables.has(tab.name)) {
      if (tab.required) report.missingRequired.push(tab.name);
      else report.missingOptional.push(tab.name);
      continue;
    }
    // Inspect columns of present tables we know about.
    let cols: SqliteColumnInfo[];
    try {
      cols = queryAll<SqliteColumnInfo>(db, `PRAGMA table_info(${tab.name})`);
    } catch {
      // Couldn't introspect; skip silently.
      continue;
    }
    const presentCols = new Set(cols.map((c) => c.name));
    const missing = tab.columns.filter((c) => !presentCols.has(c));
    if (missing.length > 0) {
      report.missingColumns.push({ table: tab.name, columns: missing });
    }
  }

  // Find new tables Dayflow added that we don't know about.
  let allTables: SqliteMasterRow[] = [];
  try {
    allTables = queryAll<SqliteMasterRow>(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
  } catch {
    /* ignore */
  }
  for (const row of allTables) {
    if (!knownNames.has(row.name) && !row.name.startsWith('aw_')) {
      report.unknownTables.push(row.name);
    }
  }

  report.ok =
    report.missingRequired.length === 0 &&
    report.missingColumns.length === 0;
  return report;
}

export function reportToHumanLines(report: SchemaReport): string[] {
  const lines: string[] = [];
  if (report.missingRequired.length > 0) {
    lines.push(`Missing required tables: ${report.missingRequired.join(', ')}. Plugin cannot run.`);
  }
  for (const m of report.missingColumns) {
    lines.push(`Table ${m.table} is missing columns the plugin reads: ${m.columns.join(', ')}.`);
  }
  if (report.unknownTables.length > 0) {
    lines.push(`Dayflow has new tables the plugin doesn't read yet: ${report.unknownTables.join(', ')}. Consider updating the plugin.`);
  }
  return lines;
}
