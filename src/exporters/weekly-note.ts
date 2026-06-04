import type { Database } from 'sql.js';
import type { Vault } from 'obsidian';
import { fetchTimelineCardsRange } from '../data/timeline.js';
import { fetchDayGoals } from '../data/goals.js';
import { categoryBreakdown } from '../aggregators/category.js';
import { appBreakdown, appTransitions } from '../aggregators/apps.js';
import { focusHeatmap } from '../aggregators/heatmap.js';
import { renderTreemap } from '../viz/treemap.js';
import { renderHeatmap } from '../viz/heatmap.js';
import { renderSankey } from '../viz/sankey.js';
import { renderBars } from '../viz/bars.js';
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

  const fm = frontmatter({
    dayflow_week: weekKey,
    from: fromDay,
    to: toDay,
    total_minutes: breakdown.totalMinutes,
    total_cards: cards.length,
    categories: breakdown.categories.map((c) => c.category),
    top_apps: apps.slice(0, 5).map((a) => a.app),
    created_at: (await readCreatedAt(vault, filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['dayflow', 'weekly', ...breakdown.categories.map((c) => slugify(c.category))],
  });

  const treemap = renderTreemap(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] }))
  );
  const bars = renderBars(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] }))
  );
  const heatmapSvg = renderHeatmap(heatmap, dayLabels);
  const sankeySvg = renderSankey(transitions);

  const activeDays = days.filter((d) => cards.some((c) => c.day === d)).length;
  const body = `
# Week ${weekKey}

> [!info] Week at a glance
> **${fmtHours(breakdown.totalMinutes)}h** tracked across ${activeDays} active days · ${breakdown.categories.length} categories
> Top app: **${apps[0]?.app || '—'}** (${fmtDuration(apps[0]?.minutes || 0)})

## Treemap

<div class="dayflow-treemap">
${treemap}
</div>

## Category totals

<div class="dayflow-bars">
${bars}
</div>

## Focus heatmap

<div class="dayflow-heatmap">
${heatmapSvg}
</div>

## App transitions

<div class="dayflow-sankey">
${sankeySvg}
</div>

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
