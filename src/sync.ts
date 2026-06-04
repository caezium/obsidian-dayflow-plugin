/**
 * Orchestrates a single sync run: open the DB, walk recent days, write each
 * note, then walk the ISO weeks those days touch and write each weekly note.
 */
import type { Vault } from 'obsidian';
import { openReadOnly, defaultDbPath } from './db.js';
import { lastNDays, isoWeekKey } from './boundary.js';
import { exportDailyNote } from './exporters/daily-note.js';
import { exportWeeklyNote } from './exporters/weekly-note.js';
import type { PluginSettings } from './types.js';

export interface SyncCounts {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  noData: number;
  errors: number;
  durationMs: number;
  startedAt: string;
}

export async function runSync(
  pluginDir: string,
  vault: Vault,
  settings: PluginSettings,
  onLog: (msg: string) => void = () => undefined
): Promise<SyncCounts> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const counts: SyncCounts = {
    created: 0, updated: 0, unchanged: 0, skipped: 0, noData: 0, errors: 0,
    durationMs: 0, startedAt,
  };

  const dbPath = settings.dbPath || defaultDbPath();
  let dbHandle;
  try {
    dbHandle = await openReadOnly(pluginDir, dbPath);
  } catch (err) {
    const e = err as Error & { code?: string };
    onLog(`Failed to open DB at ${dbPath}: ${e.message}`);
    counts.errors += 1;
    counts.durationMs = performance.now() - t0;
    throw err;
  }

  const { db, tables } = dbHandle;
  try {
    const days = lastNDays(settings.syncDays);
    const weeks = new Set(days.map((d) => isoWeekKey(d)));
    onLog(`Syncing ${days.length} days (${days[days.length - 1]} → ${days[0]})`);

    for (const day of days) {
      try {
        const r = await exportDailyNote(db, tables, vault, day, settings);
        bumpCount(counts, r.status);
        onLog(`  ${day}  daily  ${r.status}`);
      } catch (err) {
        counts.errors += 1;
        onLog(`  ${day}  daily  ERROR: ${(err as Error).message}`);
      }
    }

    for (const week of [...weeks].sort()) {
      try {
        const r = await exportWeeklyNote(db, tables, vault, week, settings);
        bumpCount(counts, r.status);
        onLog(`  ${week}  weekly  ${r.status}`);
      } catch (err) {
        counts.errors += 1;
        onLog(`  ${week}  weekly  ERROR: ${(err as Error).message}`);
      }
    }
  } finally {
    db.close();
  }

  counts.durationMs = performance.now() - t0;
  onLog(`Done in ${Math.round(counts.durationMs)}ms — ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.skipped} skipped, ${counts.noData} no-data, ${counts.errors} errors`);
  return counts;
}

function bumpCount(counts: SyncCounts, status: string): void {
  if (status === 'created') counts.created += 1;
  else if (status === 'updated') counts.updated += 1;
  else if (status === 'unchanged') counts.unchanged += 1;
  else if (status === 'skipped-complete') counts.skipped += 1;
  else if (status === 'no-data') counts.noData += 1;
}
