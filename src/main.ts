import { Notice, Plugin, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, type PluginSettings } from './types.js';
import { runSync, type SyncCounts } from './sync.js';
import { DayflowSettingTab } from './settings.js';

export default class DayflowPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private intervalHandle: number | null = null;
  private syncing = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DayflowSettingTab(this.app, this));

    this.addCommand({
      id: 'sync-now',
      name: 'Sync now',
      callback: () => this.runSyncNow(),
    });

    this.addRibbonIcon('sync', 'Dayflow: sync now', () => this.runSyncNow());

    if (this.settings.syncOnStartup) {
      // Defer briefly so vault is fully indexed before we start reading/writing.
      this.registerInterval(window.setTimeout(() => this.runSyncNow(), 5000));
    }
    this.scheduleInterval();
  }

  onunload(): void {
    if (this.intervalHandle != null) window.clearInterval(this.intervalHandle);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) || {};
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Recompute the background interval timer based on current settings. */
  scheduleInterval(): void {
    if (this.intervalHandle != null) {
      window.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    const mins = this.settings.intervalMinutes;
    if (mins > 0) {
      this.intervalHandle = window.setInterval(() => this.runSyncNow(true), mins * 60 * 1000);
      this.registerInterval(this.intervalHandle);
    }
  }

  async runSyncNow(silent = false): Promise<void> {
    if (this.syncing) {
      if (!silent) new Notice('Dayflow sync already in progress');
      return;
    }
    this.syncing = true;
    if (!silent) new Notice('Dayflow: syncing…');
    const logs: string[] = [];
    let counts: SyncCounts | null = null;
    try {
      counts = await runSync(
        this.pluginDir(),
        this.app.vault,
        this.settings,
        (msg) => {
          logs.push(msg);
          console.log('[Dayflow]', msg);
        }
      );
      const summary = `Dayflow: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped (${Math.round(counts.durationMs)}ms)`;
      if (!silent || counts.created + counts.updated > 0) new Notice(summary);
    } catch (err) {
      const msg = (err as Error).message;
      console.error('[Dayflow] sync failed:', msg, logs.join('\n'));
      new Notice(`Dayflow sync failed: ${msg}`, 8000);
    } finally {
      this.syncing = false;
    }
  }

  /** Absolute path to this plugin's folder, where main.js + sql-wasm.wasm live. */
  private pluginDir(): string {
    const vaultPath = (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? '';
    return normalizePath(`${vaultPath}/${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  }
}
