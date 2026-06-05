import type { Database } from 'sql.js';
import type { Vault } from 'obsidian';
import { fetchTimelineCardsRange } from '../data/timeline.js';
import { fetchDayGoals } from '../data/goals.js';
import { categoryBreakdown } from '../aggregators/category.js';
import { appBreakdown, appTransitions } from '../aggregators/apps.js';
import { appsByCategory } from '../aggregators/apps-by-category.js';
import { focusHeatmap } from '../aggregators/heatmap.js';
import { contextShifts } from '../aggregators/context-shifts.js';
import { dominantCategoryGrid } from '../aggregators/dominant-category.js';
import { weekComparison, previousWeekKey } from '../aggregators/week-comparison.js';
import { renderTreemap, renderNestedTreemap } from '../viz/treemap.js';
import { renderHeatmap } from '../viz/heatmap.js';
import { renderSankey } from '../viz/sankey.js';
import { renderBars } from '../viz/bars.js';
import { renderDonut } from '../viz/donut.js';
import { renderLines } from '../viz/lines.js';
import { renderWorkflowGrid } from '../viz/workflow-grid.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { dayLink, wikilink } from '../formatters/wikilinks.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours, slugify } from '../util/time.js';
import { tableCell } from '../util/escape.js';
import { daysInWeek, fmtShortDay } from '../boundary.js';
import { buildColorMap } from '../util/colors.js';
import type { PluginSettings } from '../types.js';
import type { ExportResult } from './daily-note.js';

export async function exportWeeklyNote(
  db: Database,
  tables: Set<string>,
  vault: Vault,
  weekKey: string,
  settings: PluginSettings
): Promise<ExportResult> {
  const dir = settings.outputFolder.replace(/\/+$/, '') + '/' + settings.weeklySubfolder;
  const filename = `Dayflow_${weekKey}.md`;
  const filePath = `${dir}/${filename}`;

  const days = daysInWeek(weekKey);
  const fromDay = days[0];
  const toDay = days[days.length - 1];
  const cards = fetchTimelineCardsRange(db, fromDay, toDay, { includeDeleted: settings.includeDeleted });
  if (cards.length === 0) return { path: filePath, status: 'no-data' };

  const breakdown = categoryBreakdown(cards);
  const apps = appBreakdown(cards);
  const transitions = appTransitions(cards);
  const heatmap = focusHeatmap(cards, days);
  const shifts = contextShifts(cards, days);
  const dominantGrid = dominantCategoryGrid(cards, days, 30);
  const catApps = appsByCategory(cards);
  const comparison = weekComparison(db, tables, weekKey, settings.includeDeleted);

  // Color map: explicit hex from day_goal_categories overrides the hash-based palette.
  const colorOverrides: Record<string, string> = {};
  for (const d of days) {
    const g = fetchDayGoals(db, tables, d);
    if (!g) continue;
    for (const c of [...g.focusCategories, ...g.distractionCategories]) {
      colorOverrides[c.category_name] = c.category_color_hex;
    }
  }
  const colorMap = buildColorMap(breakdown.categories.map((c) => c.category), colorOverrides);

  const dayLabels = days.map((d) => fmtShortDay(d));
  const activeDays = days.filter((d) => cards.some((c) => c.day === d)).length;

  const fm = frontmatter({
    dayflow_week: weekKey,
    from: fromDay,
    to: toDay,
    total_minutes: breakdown.totalMinutes,
    total_cards: cards.length,
    categories: breakdown.categories.map((c) => c.category),
    top_apps: apps.slice(0, 5).map((a) => a.app),
    active_days: activeDays,
    focus_minutes: comparison.current.focusMinutes,
    distraction_minutes: comparison.current.distractionMinutes,
    total_minutes_delta_vs_prev: comparison.previous ? comparison.totalDelta : null,
    focus_minutes_delta_vs_prev: comparison.previous ? comparison.focusDelta : null,
    distraction_minutes_delta_vs_prev: comparison.previous ? comparison.distractionDelta : null,
    created_at: (await readCreatedAt(vault, filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['dayflow', 'weekly', ...breakdown.categories.map((c) => slugify(c.category))],
  });

  // ----- Charts (built once for clarity) -----
  const donutSvg = renderDonut(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] }))
  );
  const flatTreemapSvg = renderTreemap(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] }))
  );
  const nestedTreemapSvg = renderNestedTreemap(
    catApps.map((c) => ({
      name: c.category,
      value: c.totalMinutes,
      color: colorMap[c.category],
      children: c.apps.map((a) => ({ name: a.app, value: a.minutes })),
    }))
  );
  const barsSvg = renderBars(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] }))
  );
  const heatmapSvg = renderHeatmap(heatmap, dayLabels);
  const workflowSvg = renderWorkflowGrid(dominantGrid, dayLabels, colorMap, 30);
  const sankeySvg = renderSankey(transitions);
  const linesSvg = renderLines(
    dayLabels,
    [
      { name: 'Context shifts', values: shifts.map((s) => s.shifts), color: '#8B5CF6' },
      { name: 'Distractions', values: shifts.map((s) => s.distractions), color: '#EF4444' },
    ]
  );

  // ----- "vs last week" comparison block -----
  let comparisonBlock = '';
  if (comparison.previous) {
    const fmt = (delta: number) => {
      if (delta === 0) return '—';
      const sign = delta > 0 ? '▲' : '▼';
      return `${sign} ${fmtDuration(Math.abs(delta))}`;
    };
    const prevWeek = previousWeekKey(weekKey);
    comparisonBlock = `
## Compared to last week

> [!info] vs [[Dayflow_${prevWeek}|${prevWeek}]]
> Total tracked: **${fmtHours(comparison.current.totalMinutes)}h** (${fmt(comparison.totalDelta)})
> Focus: **${fmtDuration(comparison.current.focusMinutes)}** (${fmt(comparison.focusDelta)})
> Distraction: **${fmtDuration(comparison.current.distractionMinutes)}** (${fmt(comparison.distractionDelta)})
`;
  }

  const body = `
# Week ${weekKey}

> [!info] Week at a glance
> **${fmtHours(breakdown.totalMinutes)}h** tracked across ${activeDays} active days · ${breakdown.categories.length} categories
> Top app: **${apps[0]?.app || '—'}** (${fmtDuration(apps[0]?.minutes || 0)})
${comparisonBlock}
## Weekly distribution

<div class="dayflow-donut">
${donutSvg}
</div>

## Category totals

<div class="dayflow-bars">
${barsSvg}
</div>

## Most used per category

<div class="dayflow-treemap">
${nestedTreemapSvg}
</div>

## Your workflow this week

<div class="dayflow-workflow">
${workflowSvg}
</div>

## Focus heatmap (intensity)

<div class="dayflow-heatmap">
${heatmapSvg}
</div>

## Context shifts vs distractions

<div class="dayflow-lines">
${linesSvg}
</div>

## App transitions

<div class="dayflow-sankey">
${sankeySvg}
</div>

## Categories (flat)

<details>
<summary>Flat treemap</summary>

<div class="dayflow-treemap">
${flatTreemapSvg}
</div>
</details>

## Top apps

| App | Sessions | Minutes |
| --- | --- | --- |
${apps.slice(0, 15).map((a) => `| ${tableCell(a.app)} | ${a.sessions} | ${a.minutes} |`).join('\n')}

## Categories

${breakdown.categories.map((c) => `- ${wikilink(c.category, { enabled: settings.categoryWikilinks })} — ${fmtDuration(c.minutes)} (${Math.round(c.pct * 100)}%, ${c.cards} cards)`).join('\n')}

## Days

${days.map((d) => `- ${dayLink(d)}`).join('\n')}
`;

  const md = fm + body;
  const res = await writeIfChanged(vault, filePath, md);
  return { path: filePath, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}
