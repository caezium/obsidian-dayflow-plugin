/**
 * Tiny start-page dashboard. One screen, one purpose: "what's going on
 * right now?" Big number for today's hours, one sentence about focus
 * progress, three buttons to navigate. No charts, no grids, no five
 * sections of duplicated info.
 *
 * Data source: today's daily note frontmatter (via metadataCache). No DB
 * access — stays in lockstep with whatever the last sync produced.
 */
import { ItemView, WorkspaceLeaf, setIcon, parseYaml } from 'obsidian';
import type DayflowPlugin from '../main.js';
import { getDayString, isoWeekKey } from './../boundary.js';

export const DASHBOARD_VIEW_TYPE = 'dayflow-dashboard-view';

interface DailyFrontmatter {
  total_minutes?: number;
  total_cards?: number;
  focus_target_minutes?: number;
  focus_actual_minutes?: number;
  focus_pct?: number;
  distraction_limit_minutes?: number;
  distraction_actual_minutes?: number;
}

export class DashboardView extends ItemView {
  private plugin: DayflowPlugin;
  private bodyEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: DayflowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return DASHBOARD_VIEW_TYPE; }
  getDisplayText(): string { return 'Dayflow'; }
  getIcon(): string { return 'layout-dashboard'; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('dayflow-dashboard');
    this.bodyEl = container;
    await this.refresh();
  }

  async onClose(): Promise<void> {
    /* no resources to release */
  }

  async refresh(): Promise<void> {
    if (!this.bodyEl) return;
    this.bodyEl.empty();

    const settings = this.plugin.settings;
    const today = getDayString(new Date());
    const weekKey = isoWeekKey(today);
    const fm = await this.readTodayFrontmatter(today);

    // ----- Header: title + sync indicator + refresh -----
    const header = this.bodyEl.createDiv({ cls: 'dayflow-start-header' });
    header.createEl('div', { text: 'Dayflow', cls: 'dayflow-start-title' });
    const right = header.createDiv({ cls: 'dayflow-start-header-right' });
    const lastSync = settings.lastSyncAt;
    right.createEl('span', {
      text: lastSync ? `Synced ${formatAgo(lastSync)}` : 'Not synced',
      cls: 'dayflow-start-sync-label',
    });
    const syncBtn = right.createEl('button', {
      cls: 'dayflow-start-icon-btn',
      attr: { 'aria-label': 'Sync now' },
    });
    setIcon(syncBtn, 'refresh-cw');
    syncBtn.addEventListener('click', () => { void this.plugin.runSyncNow(); });

    // ----- Hero: today's tracked hours -----
    const hero = this.bodyEl.createDiv({ cls: 'dayflow-start-hero' });
    const todayMinutes = fm?.total_minutes ?? 0;
    if (todayMinutes === 0) {
      hero.createEl('div', { text: '—', cls: 'dayflow-start-hero-value' });
      hero.createEl('div', {
        text: 'No tracked activity yet today.',
        cls: 'dayflow-start-hero-sub',
      });
    } else {
      hero.createEl('div', {
        text: `${(todayMinutes / 60).toFixed(1)}h`,
        cls: 'dayflow-start-hero-value',
      });
      hero.createEl('div', {
        text: `tracked today · ${fm?.total_cards ?? 0} cards`,
        cls: 'dayflow-start-hero-sub',
      });
    }

    // ----- Status sentence: focus progress -----
    const status = this.bodyEl.createDiv({ cls: 'dayflow-start-status' });
    status.setText(buildStatusSentence(fm));

    // ----- Three buttons -----
    const actions = this.bodyEl.createDiv({ cls: 'dayflow-start-actions' });
    this.button(actions, "Open today's note", 'file-text', () => { void this.plugin.openDayflowNote(today); });
    this.button(actions, "Open this week's note", 'calendar-days', () => { void this.plugin.openWeekNote(weekKey); });
    this.button(actions, 'Sync now', 'refresh-cw', () => { void this.plugin.runSyncNow(); });
  }

  private button(parent: HTMLElement, label: string, icon: string, onClick: () => void): void {
    const btn = parent.createEl('button', { cls: 'dayflow-start-action' });
    const iconEl = btn.createSpan({ cls: 'dayflow-start-action-icon' });
    setIcon(iconEl, icon);
    btn.createSpan({ text: label, cls: 'dayflow-start-action-label' });
    btn.addEventListener('click', onClick);
  }

  /** Read today's daily note frontmatter from the vault. Returns null if absent. */
  private async readTodayFrontmatter(today: string): Promise<DailyFrontmatter | null> {
    const settings = this.plugin.settings;
    const path = `${settings.outputFolder.replace(/\/+$/, '')}/${settings.dailySubfolder}/Dayflow_${today}.md`;
    const file = this.plugin.app.vault.getFileByPath(path);
    if (!file) return null;
    const cached = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter as DailyFrontmatter | undefined;
    if (cached) return cached;
    // Fallback: parse the YAML ourselves if metadataCache hasn't caught up yet.
    try {
      const raw = await this.plugin.app.vault.read(file);
      const m = raw.match(/^---\n([\s\S]*?)\n---/);
      if (m) return parseYaml(m[1]) as DailyFrontmatter;
    } catch {
      /* ignore */
    }
    return null;
  }
}

function buildStatusSentence(fm: DailyFrontmatter | null): string {
  if (!fm || (fm.total_minutes ?? 0) === 0) {
    return 'Trigger a sync to refresh — your timeline cards land here as Dayflow processes them.';
  }
  const focusTarget = fm.focus_target_minutes;
  const focusActual = fm.focus_actual_minutes ?? 0;
  if (focusTarget && focusTarget > 0) {
    const pct = Math.round(((fm.focus_pct ?? 0)));
    if (pct >= 100) {
      const over = focusActual - focusTarget;
      return `🎯 Focus goal hit — ${formatDuration(focusActual)} focused, ${formatDuration(over)} over target.`;
    }
    const remaining = Math.max(0, focusTarget - focusActual);
    return `🎯 ${pct}% of focus goal. ${formatDuration(remaining)} to go.`;
  }
  // No focus goal — fall back to distraction commentary if set.
  const distractionLimit = fm.distraction_limit_minutes;
  const distractionActual = fm.distraction_actual_minutes ?? 0;
  if (distractionLimit && distractionLimit > 0) {
    if (distractionActual > distractionLimit) {
      const over = distractionActual - distractionLimit;
      return `⚠️ Over your distraction limit by ${formatDuration(over)}.`;
    }
    const remaining = Math.max(0, distractionLimit - distractionActual);
    return `🚫 ${formatDuration(distractionActual)} on distractions today — ${formatDuration(remaining)} of slack left.`;
  }
  return 'No focus goal set today. Add one in Dayflow to see progress here.';
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
