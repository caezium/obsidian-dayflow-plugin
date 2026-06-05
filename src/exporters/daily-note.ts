import type { Database } from 'sql.js';
import type { Vault } from 'obsidian';
import { fetchTimelineCards } from '../data/timeline.js';
import { fetchJournalEntry } from '../data/journal.js';
import { fetchStandup } from '../data/standup.js';
import { fetchDayGoals } from '../data/goals.js';
import { fetchRatings } from '../data/ratings.js';
import { categoryBreakdown } from '../aggregators/category.js';
import { appBreakdown } from '../aggregators/apps.js';
import { goalProgress } from '../aggregators/goals.js';
import { dominantCategoryGrid } from '../aggregators/dominant-category.js';
import { focusStreak } from '../aggregators/streak.js';
import { renderHourlyStrip } from '../viz/hourly-strip.js';
import { buildColorMap } from '../util/colors.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { wikilink, weekLink } from '../formatters/wikilinks.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours, slugify } from '../util/time.js';
import { tableCell } from '../util/escape.js';
import { isoWeekKey, isDayComplete, fmtLongDate } from '../boundary.js';
import type { PluginSettings, JournalEntry, Standup, DayGoals, GoalProgress, TimelineCard, Rating, CategoryBreakdown, AppStat, AwEnrichment } from '../types.js';

export interface ExportResult {
  path: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped-complete' | 'no-data';
}

export async function exportDailyNote(
  db: Database,
  tables: Set<string>,
  vault: Vault,
  dayString: string,
  settings: PluginSettings,
  awEnrichment: AwEnrichment | null = null
): Promise<ExportResult> {
  const dir = settings.outputFolder.replace(/\/+$/, '') + '/' + settings.dailySubfolder;
  const filename = `Dayflow_${dayString}.md`;
  const filePath = `${dir}/${filename}`;

  if (isDayComplete(dayString)) {
    const existingCreated = await readCreatedAt(vault, filePath);
    if (existingCreated) return { path: filePath, status: 'skipped-complete' };
  }

  const cards = fetchTimelineCards(db, dayString, { includeDeleted: settings.includeDeleted });
  const journal = fetchJournalEntry(db, dayString);
  const standup = fetchStandup(db, tables, dayString);
  const goals = fetchDayGoals(db, tables, dayString);
  const ratings = fetchRatings(db, tables, dayString);

  if (cards.length === 0 && !journal && !standup && !goals) {
    return { path: filePath, status: 'no-data' };
  }

  const breakdown = categoryBreakdown(cards);
  const apps = appBreakdown(cards);
  const goalProg = goalProgress(cards, goals);

  // Color map seeded with explicit hex from day_goal_categories.
  const colorOverrides: Record<string, string> = {};
  if (goals) {
    for (const c of [...goals.focusCategories, ...goals.distractionCategories]) {
      colorOverrides[c.category_name] = c.category_color_hex;
    }
  }
  const colorMap = buildColorMap(breakdown.categories.map((c) => c.category), colorOverrides);

  // Hourly strip data: dominantCategoryGrid over a single day, then renderHourlyStrip collapses halves to hours.
  const dayGrid = dominantCategoryGrid(cards, [dayString], 30);
  const hourlyStripSvg = cards.length > 0 ? renderHourlyStrip(dayGrid[0], colorMap) : '';

  // Focus streak — read from existing daily notes' frontmatter. Cheap (file metadata only).
  const dailyFolder = settings.outputFolder.replace(/\/+$/, '') + '/' + settings.dailySubfolder;
  const streak = await focusStreak(vault, dailyFolder, dayString);

  const fm = frontmatter({
    dayflow_day: dayString,
    week: isoWeekKey(dayString),
    day_boundary: '4am',
    total_minutes: breakdown.totalMinutes,
    total_cards: cards.length,
    categories: breakdown.categories.map((c) => c.category),
    top_apps: apps.slice(0, 5).map((a) => a.app),
    focus_target_minutes: goalProg?.focusTargetMinutes ?? null,
    focus_actual_minutes: goalProg?.focusActualMinutes ?? null,
    focus_pct: goalProg?.focusPct != null ? Number((goalProg.focusPct * 100).toFixed(0)) : null,
    distraction_limit_minutes: goalProg?.distractionLimitMinutes ?? null,
    distraction_actual_minutes: goalProg?.distractionActualMinutes ?? null,
    has_journal: Boolean(journal),
    journal_status: journal?.status ?? null,
    has_standup: Boolean(standup),
    ratings_count: ratings.length,
    created_at: (await readCreatedAt(vault, filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['dayflow', 'timeline', ...breakdown.categories.map((c) => slugify(c.category))],
  });

  const sections = [
    headerSection(dayString, breakdown, goalProg, streak.days),
    hourlyStripSection(hourlyStripSvg),
    standupSection(standup),
    journalIntentionsSection(journal),
    timelineSection(cards, ratings, settings, awEnrichment),
    journalReflectionsSection(journal),
    distractionsSection(cards),
    appsSection(apps, awEnrichment),
    goalCategoriesSection(goals, settings),
    relatedSection(dayString),
  ].filter(Boolean);

  const md = fm + '\n' + sections.join('\n');
  const res = await writeIfChanged(vault, filePath, md);
  return { path: filePath, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}

function headerSection(dayString: string, breakdown: CategoryBreakdown, goalProg: GoalProgress | null, streakDays: number): string {
  const lines = [`# ${fmtLongDate(dayString)}`, '', '> [!info] Day at a glance'];

  if (breakdown.totalMinutes === 0) {
    lines.push('> *No tracked activity for this day.*', '');
    return lines.join('\n');
  }

  const { totalMinutes, categories } = breakdown;
  lines.push(`> **${fmtHours(totalMinutes)}h** tracked · ${categories.reduce((s, c) => s + c.cards, 0)} cards · ${categories.length} categories`);
  const pcts = categories.slice(0, 5).map((c) => `\`${c.category} ${Math.round(c.pct * 100)}%\``).join(' ');
  if (pcts) lines.push(`> ${pcts}`);

  if (goalProg && !goalProg.isSkipped) {
    if (goalProg.focusTargetMinutes) {
      const pct = Math.round((goalProg.focusPct ?? 0) * 100);
      const hit = pct >= 100 ? ' ✅' : '';
      lines.push(`> 🎯 Focus: **${fmtDuration(goalProg.focusActualMinutes)}** / ${fmtDuration(goalProg.focusTargetMinutes)} (${pct}%)${hit}`);
    }
    if (goalProg.distractionLimitMinutes) {
      const pct = Math.round((goalProg.distractionPct ?? 0) * 100);
      const over = goalProg.distractionActualMinutes > goalProg.distractionLimitMinutes ? ' ⚠️' : '';
      lines.push(`> 🚫 Distractions: **${fmtDuration(goalProg.distractionActualMinutes)}** / ${fmtDuration(goalProg.distractionLimitMinutes)} limit (${pct}%)${over}`);
    }
  }
  if (streakDays > 0) {
    lines.push(`> 🔥 ${streakDays}-day focus streak going into today`);
  }
  lines.push('');
  return lines.join('\n');
}

function hourlyStripSection(svg: string): string {
  if (!svg) return '';
  return `## Today's hourly strip\n\n<div class="dayflow-hourly-strip">\n${svg}\n</div>\n`;
}

function standupSection(standup: Standup | null): string {
  if (!standup) return '';
  const p = standup.payload || {};
  const hasHighlights = Array.isArray(p.highlights) && p.highlights.length > 0;
  const hasTasks = Array.isArray(p.tasks) && p.tasks.length > 0;
  const hasBlockers = Boolean(p.blockersBody && p.blockersBody.trim());
  if (!hasHighlights && !hasTasks && !hasBlockers) return '';
  const out = ['## Standup'];
  if (hasHighlights) {
    out.push(`### ${p.highlightsTitle || "Yesterday's highlights"}`);
    out.push(...p.highlights!.map((h) => `- ${h.text || ''}`));
  }
  if (hasTasks) {
    out.push(`\n### ${p.tasksTitle || "Today's tasks"}`);
    out.push(...p.tasks!.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text || ''}`));
  }
  if (hasBlockers) out.push(`\n### ${p.blockersTitle || 'Blockers'}\n${p.blockersBody}`);
  out.push('');
  return out.join('\n');
}

function journalIntentionsSection(journal: JournalEntry | null): string {
  if (!journal) return '';
  const parts: string[] = [];
  if (journal.intentions) parts.push(`### Intentions\n${journal.intentions}`);
  if (journal.goals) parts.push(`### Goals\n${journal.goals}`);
  if (journal.notes) parts.push(`### Notes\n${journal.notes}`);
  return parts.length ? `## Journal\n\n${parts.join('\n\n')}\n` : '';
}

function timelineSection(cards: TimelineCard[], ratings: Rating[], settings: PluginSettings, aw: AwEnrichment | null): string {
  if (cards.length === 0) return '## Timeline\n\n*No timeline cards.*\n';
  const ratingByCard = new Map<number, string>();
  for (const r of ratings) {
    for (const c of cards) {
      if (r.start_ts < c.end_ts && r.end_ts > c.start_ts) ratingByCard.set(c.id, r.rating);
    }
  }
  const out = ['## Timeline'];
  for (const c of cards) {
    const cat = wikilink(c.category, { enabled: settings.categoryWikilinks });
    const sub = c.subcategory ? ` · ${c.subcategory}` : '';
    const rating = ratingByCard.get(c.id);
    const badge = rating === 'up' ? ' 👍' : rating === 'down' ? ' 👎' : '';
    out.push(`\n### ${c.start} – ${c.end} · ${cat}${sub}${badge}`);
    out.push(`**${c.title}**`);
    if (c.detailed_summary) out.push(`\n${c.detailed_summary}`);
    else if (c.summary) out.push(`\n${c.summary}`);
    const apps = [c.appPrimary, c.appSecondary].filter(Boolean) as string[];
    const meta: string[] = [];
    if (apps.length) meta.push(`*Apps:* ${apps.join(', ')}`);
    meta.push(`*Duration:* ${Math.round((c.end_ts - c.start_ts) / 60)} min`);
    if (c.video_summary_url) {
      const url = 'file://' + c.video_summary_url.replace(/ /g, '%20');
      meta.push(`[Video summary](${url})`);
    }
    out.push(`\n${meta.join(' · ')}`);
    // ActivityWatch precise app breakdown, if available for this card.
    const awForCard = aw?.byCardId.get(c.id);
    if (awForCard && awForCard.length > 0) {
      const parts = awForCard.slice(0, 4).map((a) => `${a.app} ${Math.round(a.seconds / 60)}m`);
      const rest = awForCard.length - 4;
      const trailer = rest > 0 ? ` · +${rest} more` : '';
      out.push(`*AW:* ${parts.join(' · ')}${trailer}`);
    }
  }
  out.push('');
  return out.join('\n');
}

function distractionsSection(cards: TimelineCard[]): string {
  const all: { startTime?: string; endTime?: string; title?: string; summary?: string }[] = [];
  for (const c of cards) {
    for (const d of c.distractions || []) all.push(d);
  }
  if (all.length === 0) return '';
  const items = all.map((d) => `- **${d.startTime || ''} – ${d.endTime || ''}** ${d.title || ''}${d.summary ? `\n  ${d.summary}` : ''}`).join('\n');
  return `## Distractions\n\n${items}\n`;
}

function appsSection(apps: AppStat[], aw: AwEnrichment | null): string {
  let dayflowSection = '';
  if (apps.length > 0) {
    const top = apps.slice(0, 8);
    const rest = apps.length - top.length;
    const rows = top.map((a) => `| ${tableCell(a.app)} | ${a.sessions} | ${a.minutes} |`).join('\n');
    const trailer = rest > 0 ? `\n*… and ${rest} more apps*\n` : '';
    dayflowSection = `## Top apps (Dayflow)\n\n| App | Sessions | Minutes |\n| --- | --- | --- |\n${rows}\n${trailer}`;
  }
  if (!aw || aw.dayApps.length === 0) return dayflowSection;

  const top = aw.dayApps.slice(0, 10);
  const rest = aw.dayApps.length - top.length;
  const awRows = top
    .map((a) => `| ${tableCell(a.app)} | ${Math.round(a.seconds / 60)} |`)
    .join('\n');
  const afkLine = aw.afkSeconds > 0
    ? `\n\n*AFK total:* ${Math.round(aw.afkSeconds / 60)} min`
    : '';
  const awTrailer = rest > 0 ? `\n*… and ${rest} more apps*` : '';
  const awSection = `## Top apps (ActivityWatch)\n\n| App | Minutes |\n| --- | --- |\n${awRows}${awTrailer}${afkLine}\n`;
  return dayflowSection + '\n' + awSection;
}

function journalReflectionsSection(journal: JournalEntry | null): string {
  if (!journal) return '';
  const parts: string[] = [];
  if (journal.reflections) parts.push(`### Reflections\n${journal.reflections}`);
  if (journal.summary) parts.push(`### AI summary\n${journal.summary}`);
  return parts.length ? `## Reflection\n\n${parts.join('\n\n')}\n` : '';
}

function goalCategoriesSection(goals: DayGoals | null, settings: PluginSettings): string {
  if (!goals || goals.isSkipped) return '';
  if (goals.focusCategories.length === 0 && goals.distractionCategories.length === 0) return '';
  const focus = goals.focusCategories.map((c) => wikilink(c.category_name, { enabled: settings.categoryWikilinks })).join(', ');
  const distr = goals.distractionCategories.map((c) => wikilink(c.category_name, { enabled: settings.categoryWikilinks })).join(', ');
  const lines = ['## Goal categories', ''];
  if (focus) lines.push(`- 🎯 Focus: ${focus}`);
  if (distr) lines.push(`- 🚫 Distraction: ${distr}`);
  lines.push('');
  return lines.join('\n');
}

function relatedSection(dayString: string): string {
  return `---\n\n*Week:* ${weekLink(isoWeekKey(dayString))}\n`;
}
