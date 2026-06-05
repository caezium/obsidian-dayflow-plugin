/**
 * Orchestrates a single sync run: open the DB, walk recent days, write each
 * note, then walk the ISO weeks those days touch and write each weekly note.
 *
 * Now respects:
 *   - settings.skipDaysBefore (YYYY-MM-DD lower bound)
 *   - settings.awEnabled (per-day enrichment via ActivityWatch)
 *   - settings.appendToDailyNote (stamp the user's daily note with a link)
 */
import { Notice, type App, type Vault } from 'obsidian';
import { openReadOnly, defaultDbPath } from './db.js';
import { lastNDays, isoWeekKey } from './boundary.js';
import { exportDailyNote } from './exporters/daily-note.js';
import { exportWeeklyNote } from './exporters/weekly-note.js';
import { exportYearNote } from './exporters/year-note.js';
import { fetchEnrichment } from './data/activitywatch.js';
import { fetchTimelineCards } from './data/timeline.js';
import { categoryBreakdown } from './aggregators/category.js';
import { goalProgress } from './aggregators/goals.js';
import { fetchDayGoals } from './data/goals.js';
import { stampDailyNote } from './exporters/daily-note-stamp.js';
import { checkSchema, reportToHumanLines } from './util/schema-check.js';
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

export interface SyncContext {
  app: App;
  vault: Vault;
  settings: PluginSettings;
  onLog?: (msg: string) => void;
}

export async function runSync(ctx: SyncContext): Promise<SyncCounts> {
  const { app, vault, settings } = ctx;
  const onLog = ctx.onLog ?? (() => undefined);
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const counts: SyncCounts = {
    created: 0, updated: 0, unchanged: 0, skipped: 0, noData: 0, errors: 0,
    durationMs: 0, startedAt,
  };

  const dbPath = settings.dbPath || defaultDbPath();
  let dbHandle;
  try {
    dbHandle = await openReadOnly(dbPath);
  } catch (err) {
    onLog(`Failed to open DB at ${dbPath}: ${(err as Error).message}`);
    counts.errors += 1;
    counts.durationMs = performance.now() - t0;
    throw err;
  }

  const { db, tables } = dbHandle;
  try {
    // Schema drift check — fires once per sync. Critical issues throw; non-critical surface as a Notice.
    const report = checkSchema(db, tables);
    if (!report.ok) {
      const lines = reportToHumanLines(report);
      onLog(`Schema check: ${lines.join(' | ')}`);
      if (report.missingRequired.length > 0) {
        throw new Error(`Schema incompatible: missing required tables ${report.missingRequired.join(', ')}`);
      }
      new Notice(`Dayflow schema drift: ${lines[0]}`, 8000);
    } else if (report.unknownTables.length > 0) {
      onLog(`Schema: Dayflow has new tables we don't read yet: ${report.unknownTables.join(', ')}`);
    }

    let days = lastNDays(settings.syncDays);
    if (settings.skipDaysBefore) {
      const skipBefore = settings.skipDaysBefore;
      const before = days.length;
      days = days.filter((d) => d >= skipBefore);
      const dropped = before - days.length;
      if (dropped > 0) onLog(`Skipped ${dropped} days before ${skipBefore}`);
    }
    const weeks = new Set(days.map((d) => isoWeekKey(d)));
    onLog(`Syncing ${days.length} days${days.length ? ` (${days[days.length - 1]} → ${days[0]})` : ''}`);

    for (const day of days) {
      try {
        // Pre-fetch cards once so we can both enrich and pass into the exporter.
        const cards = fetchTimelineCards(db, day, { includeDeleted: settings.includeDeleted });
        let enrichment = null;
        if (settings.awEnabled && cards.length > 0) {
          enrichment = await fetchEnrichment(settings.awUrl, day, cards, {
            webBrowserOnly: settings.awWebBrowserOnly,
          });
          if (enrichment) onLog(`  ${day}  AW ${Math.round(enrichment.totalSeconds / 60)}m observed, ${enrichment.dayApps.length} apps`);
        }
        const r = await exportDailyNote(db, tables, vault, day, settings, enrichment);
        bumpCount(counts, r.status);
        onLog(`  ${day}  daily  ${r.status}`);

        // Optionally stamp the user's daily note with a link to ours.
        if (settings.appendToDailyNote && r.status !== 'no-data') {
          const breakdown = categoryBreakdown(cards);
          const gp = goalProgress(cards, fetchDayGoals(db, tables, day));
          const noteBasename = `Dayflow_${day}`;
          const stamped = await stampDailyNote(app, vault, day, noteBasename, breakdown.totalMinutes, gp?.focusPct != null ? gp.focusPct * 100 : null);
          if (stamped) onLog(`  ${day}  stamped ${stamped}`);
        }
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

    // Year note — only the current year. Cheap (DB range read + one SVG).
    try {
      const currentYear = new Date(`${days[0] ?? new Date().toISOString().slice(0,10)}T12:00:00`).getFullYear();
      const r = await exportYearNote(db, vault, currentYear, settings);
      bumpCount(counts, r.status);
      onLog(`  ${currentYear}  yearly  ${r.status}`);
    } catch (err) {
      counts.errors += 1;
      onLog(`  yearly  ERROR: ${(err as Error).message}`);
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
