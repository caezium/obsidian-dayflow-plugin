/**
 * Append a small callout block into the user's Daily Notes file (the one
 * managed by Obsidian's core Daily Notes plugin or Periodic Notes) linking
 * the Dayflow daily note for that day.
 *
 * We honor either plugin if present and fall back to a sensible default
 * filename if neither is active.
 */
import type { App, Vault } from 'obsidian';
import { writeIfChanged } from '../util/io.js';

const STAMP_BEGIN = '<!-- dayflow-stamp:begin -->';
const STAMP_END = '<!-- dayflow-stamp:end -->';

interface DailyNotesConfig {
  folder: string;
  format: string;
}

function readDailyNotesConfig(app: App): DailyNotesConfig {
  // Core Daily Notes plugin
  const core = (app as unknown as {
    internalPlugins: { plugins: Record<string, { instance?: { options?: { folder?: string; format?: string } } }> };
  }).internalPlugins?.plugins?.['daily-notes'];
  const coreOpts = core?.instance?.options;
  if (coreOpts) {
    return {
      folder: (coreOpts.folder ?? '').replace(/\/+$/, ''),
      format: coreOpts.format ?? 'YYYY-MM-DD',
    };
  }
  return { folder: '', format: 'YYYY-MM-DD' };
}

/** Render the day part of the YYYY-MM-DD into the user's daily-notes format. */
function dailyNoteFilename(dayString: string, format: string): string {
  // We support the common tokens: YYYY, MM, DD. Anything fancier we fall
  // back to YYYY-MM-DD so we never produce a broken filename.
  const [y, m, d] = dayString.split('-');
  if (!y || !m || !d) return dayString;
  if (/[^YMDyymdh:\-_/. ]/.test(format)) return dayString;
  return format
    .replace(/YYYY/g, y)
    .replace(/YY/g, y.slice(2))
    .replace(/MM/g, m)
    .replace(/DD/g, d);
}

function buildStamp(dayflowNotePath: string, totalMinutes: number, focusPct: number | null): string {
  const hours = (totalMinutes / 60).toFixed(1);
  const focusLine = focusPct != null ? ` · 🎯 ${Math.round(focusPct)}%` : '';
  return [
    STAMP_BEGIN,
    `> [!info]+ Dayflow`,
    `> **${hours}h** tracked${focusLine} · [[${dayflowNotePath}|See full timeline →]]`,
    STAMP_END,
  ].join('\n');
}

/**
 * Insert or update the Dayflow stamp inside the user's daily note for `dayString`.
 * Returns the path written, or null if the user's daily note doesn't exist
 * (we don't create one — that's the user's daily-notes plugin's job).
 */
export async function stampDailyNote(
  app: App,
  vault: Vault,
  dayString: string,
  dayflowNoteBasename: string,
  totalMinutes: number,
  focusPct: number | null
): Promise<string | null> {
  const cfg = readDailyNotesConfig(app);
  const filename = dailyNoteFilename(dayString, cfg.format);
  const path = cfg.folder ? `${cfg.folder}/${filename}.md` : `${filename}.md`;
  const file = vault.getFileByPath(path);
  if (!file) return null;

  const existing = await vault.read(file);
  const stampBlock = buildStamp(dayflowNoteBasename, totalMinutes, focusPct);

  let next: string;
  if (existing.includes(STAMP_BEGIN) && existing.includes(STAMP_END)) {
    next = existing.replace(
      new RegExp(`${escapeRegex(STAMP_BEGIN)}[\\s\\S]*?${escapeRegex(STAMP_END)}`),
      stampBlock
    );
  } else {
    // Append with a leading blank line if not already empty.
    next = existing.trimEnd() + (existing.trim() ? '\n\n' : '') + stampBlock + '\n';
  }
  await writeIfChanged(vault, path, next);
  return path;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
