import { Notice, Plugin, normalizePath, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, type PluginSettings } from './types.js';
import { runSync, type SyncCounts } from './sync.js';
import { DayflowSettingTab } from './settings.js';
import { TodayView, TODAY_VIEW_TYPE } from './ui/today-view.js';
import { isMobile } from './util/mobile.js';
import { getDayString, isoWeekKey } from './boundary.js';

export default class DayflowPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private intervalHandle: number | null = null;
  private syncing = false;
  private statusBarEl: HTMLElement | null = null;
  private statusTickHandle: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DayflowSettingTab(this.app, this));

    // ---- Mobile guard ----------------------------------------------------
    if (isMobile()) {
      this.addCommand({
        id: 'sync-now',
        name: 'Sync now (desktop only)',
        callback: () => new Notice('Dayflow is desktop-only — Dayflow.app and its SQLite database are macOS-only.', 6000),
      });
      console.log('[Dayflow] Mobile detected — sync features disabled');
      return;
    }

    // ---- Side pane view --------------------------------------------------
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayView(leaf, this));

    // ---- Status bar ------------------------------------------------------
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('dayflow-status');
    this.statusBarEl.addEventListener('click', () => this.runSyncNow());
    this.updateStatusBar();
    // Tick the "X min ago" text every minute.
    this.statusTickHandle = window.setInterval(() => this.updateStatusBar(), 60_000);
    this.registerInterval(this.statusTickHandle);

    // ---- Commands --------------------------------------------------------
    this.addCommand({
      id: 'sync-now',
      name: 'Sync now',
      callback: () => this.runSyncNow(),
    });
    this.addCommand({
      id: 'open-today',
      name: "Open today's note",
      callback: () => this.openDayflowNote(getDayString(new Date())),
    });
    this.addCommand({
      id: 'open-week',
      name: "Open this week's note",
      callback: () => this.openWeekNote(isoWeekKey(getDayString(new Date()))),
    });
    this.addCommand({
      id: 'open-today-view',
      name: "Open Today side pane",
      callback: () => this.activateTodayView(),
    });

    // ---- Ribbon icons ----------------------------------------------------
    this.addRibbonIcon('sync', 'Dayflow: sync now', () => this.runSyncNow());
    this.addRibbonIcon('activity', 'Dayflow: open Today view', () => this.activateTodayView());

    // ---- Auto-sync triggers ---------------------------------------------
    if (this.settings.syncOnStartup) {
      this.registerInterval(window.setTimeout(() => this.runSyncNow(true), 5000));
    }
    this.scheduleInterval();
  }

  onunload(): void {
    if (this.intervalHandle != null) window.clearInterval(this.intervalHandle);
    if (this.statusTickHandle != null) window.clearInterval(this.statusTickHandle);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) || {};
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateStatusBar();
  }

  scheduleInterval(): void {
    if (this.intervalHandle != null) {
      window.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (isMobile()) return;
    const mins = this.settings.intervalMinutes;
    if (mins > 0) {
      this.intervalHandle = window.setInterval(() => this.runSyncNow(true), mins * 60 * 1000);
      this.registerInterval(this.intervalHandle);
    }
  }

  async runSyncNow(silent = false): Promise<void> {
    if (isMobile()) {
      if (!silent) new Notice('Dayflow is desktop-only — sync skipped.');
      return;
    }
    if (this.syncing) {
      if (!silent) new Notice('Dayflow sync already in progress');
      return;
    }
    this.syncing = true;
    this.updateStatusBar('syncing');
    if (!silent) new Notice('Dayflow: syncing…');
    let counts: SyncCounts | null = null;
    try {
      counts = await runSync({
        pluginDir: this.pluginDir(),
        app: this.app,
        vault: this.app.vault,
        settings: this.settings,
        onLog: (msg) => console.log('[Dayflow]', msg),
      });
      this.settings.lastSyncAt = new Date().toISOString();
      await this.saveSettings();
      const summary = `Dayflow: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped (${Math.round(counts.durationMs)}ms)`;
      if (!silent || counts.created + counts.updated > 0) new Notice(summary);
      this.refreshTodayViews();
    } catch (err) {
      const msg = (err as Error).message;
      console.error('[Dayflow] sync failed:', msg);
      new Notice(`Dayflow sync failed: ${msg}. Check the console (Cmd+Opt+I) for details.`, 10_000);
    } finally {
      this.syncing = false;
      this.updateStatusBar();
    }
  }

  // ---- View management ---------------------------------------------------
  async activateTodayView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TODAY_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: TODAY_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshTodayViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TODAY_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof TodayView) {
        view.refresh().catch((err) => console.error('[Dayflow] Today view refresh failed:', err));
      }
    }
  }

  // ---- Note open helpers -------------------------------------------------
  async openDayflowNote(dayString: string): Promise<void> {
    const path = `${this.settings.outputFolder.replace(/\/+$/, '')}/${this.settings.dailySubfolder}/Dayflow_${dayString}.md`;
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      new Notice(`No Dayflow note yet for ${dayString}. Try syncing first.`);
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async openWeekNote(weekKey: string): Promise<void> {
    const path = `${this.settings.outputFolder.replace(/\/+$/, '')}/${this.settings.weeklySubfolder}/Dayflow_${weekKey}.md`;
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      new Notice(`No Dayflow note yet for ${weekKey}. Try syncing first.`);
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  // ---- Status bar --------------------------------------------------------
  private updateStatusBar(state?: 'syncing'): void {
    if (!this.statusBarEl) return;
    if (state === 'syncing') {
      this.statusBarEl.setText('Dayflow · syncing…');
      return;
    }
    const last = this.settings.lastSyncAt;
    if (!last) {
      this.statusBarEl.setText('Dayflow · never');
      return;
    }
    this.statusBarEl.setText(`Dayflow · ${formatAgo(last)}`);
    this.statusBarEl.setAttr('aria-label', `Last sync: ${last}`);
  }

  pluginDir(): string {
    const vaultPath = (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? '';
    return normalizePath(`${vaultPath}/${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  }

  // Expose for the settings tab to call after the user clicks "Install dashboards".
  getOutputFolder(): string {
    return this.settings.outputFolder.replace(/\/+$/, '');
  }
}

function formatAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `synced ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `synced ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `synced ${days}d ago`;
}
