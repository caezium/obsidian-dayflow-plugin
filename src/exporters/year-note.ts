/**
 * Per-year overview note. Currently writes the year activity heatmap and
 * a small at-a-glance block. One file per calendar year: Dayflow_YYYY.md.
 */
import type { Database } from 'sql.js';
import type { Vault } from 'obsidian';
import { yearActivity } from '../aggregators/year-activity.js';
import { renderYearHeatmap } from '../viz/year-heatmap.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours } from '../util/time.js';
import type { PluginSettings } from '../types.js';
import type { ExportResult } from './daily-note.js';

export async function exportYearNote(
  db: Database,
  vault: Vault,
  year: number,
  settings: PluginSettings
): Promise<ExportResult> {
  const dir = settings.outputFolder.replace(/\/+$/, '');
  const filePath = `${dir}/Dayflow_${year}.md`;

  const today = new Date();
  const todayYear = today.getFullYear();
  const fromDay = `${year}-01-01`;
  const toDay = year === todayYear
    ? `${todayYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    : `${year}-12-31`;

  const activity = yearActivity(db, fromDay, toDay, settings.includeDeleted);
  if (activity.every((a) => a.minutes === 0)) return { path: filePath, status: 'no-data' };

  const totalMinutes = activity.reduce((s, a) => s + a.minutes, 0);
  const activeDays = activity.filter((a) => a.minutes > 0).length;
  const bestDay = activity.reduce((best, a) => (a.minutes > best.minutes ? a : best), activity[0]);

  const fm = frontmatter({
    dayflow_year: year,
    from: fromDay,
    to: toDay,
    total_minutes: totalMinutes,
    active_days: activeDays,
    best_day: bestDay.day,
    best_day_minutes: bestDay.minutes,
    created_at: (await readCreatedAt(vault, filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['dayflow', 'yearly'],
  });

  const heatmapSvg = renderYearHeatmap(activity);

  const body = `
# Dayflow ${year}

> [!info] Year at a glance
> **${fmtHours(totalMinutes)}h** tracked across **${activeDays} active days**
> Best day: ${bestDay.day} with **${fmtDuration(bestDay.minutes)}**

## Activity heatmap

<div class="dayflow-year-heatmap">
${heatmapSvg}
</div>
`;

  const res = await writeIfChanged(vault, filePath, fm + body);
  return { path: filePath, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}
