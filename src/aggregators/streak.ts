/**
 * Walk back from a reference day through the daily notes already in the
 * vault and count consecutive days where focus_pct hit the target. Reads
 * frontmatter only — no DB queries. Returns 0 if the vault is empty or
 * yesterday didn't hit.
 *
 * We allow today to NOT have a note yet (or to be in progress) without
 * breaking the streak — the streak measures days CLOSED with the focus
 * goal met, so today is excluded.
 */
import type { Vault } from 'obsidian';

export interface StreakResult {
  days: number;
  lastHitDay: string | null;
}

const MAX_LOOKBACK = 90;

export async function focusStreak(
  vault: Vault,
  dailyFolder: string,
  referenceDay: string
): Promise<StreakResult> {
  let days = 0;
  let lastHit: string | null = null;
  let cursor = previousDay(referenceDay);
  for (let i = 0; i < MAX_LOOKBACK; i++) {
    const path = `${dailyFolder.replace(/\/+$/, '')}/Dayflow_${cursor}.md`;
    const file = vault.getFileByPath(path);
    if (!file) break;
    const content = await vault.read(file);
    const pct = parseFocusPct(content);
    if (pct == null) break;
    if (pct < 100) break;
    days += 1;
    lastHit = cursor;
    cursor = previousDay(cursor);
  }
  return { days, lastHitDay: lastHit };
}

function parseFocusPct(noteContent: string): number | null {
  const m = noteContent.match(/^focus_pct:\s*(-?\d+(?:\.\d+)?)/m);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function previousDay(dayString: string): string {
  const d = new Date(`${dayString}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
