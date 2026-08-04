import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DayflowPlugin from './main.js';
import { DEFAULT_SETTINGS } from './types.js';
import type { CardSummaryMode } from './types.js';
import { installBases } from './exporters/bases.js';

export class DayflowSettingTab extends PluginSettingTab {
  plugin: DayflowPlugin;

  constructor(app: App, plugin: DayflowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('p', {
      text: 'Read-only export of your Dayflow data into this vault. Opens chunks.sqlite in read-only mode and never makes network calls except to localhost (when ActivityWatch enrichment is enabled).',
      cls: 'setting-item-description',
    });

    // ---- Output ---------------------------------------------------------
    new Setting(containerEl).setName('Output').setHeading();

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc('Where notes are written within the vault.')
      .addText((t) =>
        t.setValue(this.plugin.settings.outputFolder)
          .setPlaceholder(DEFAULT_SETTINGS.outputFolder)
          .onChange(async (v) => {
            this.plugin.settings.outputFolder = v.trim() || DEFAULT_SETTINGS.outputFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Daily subfolder')
      .addText((t) =>
        t.setValue(this.plugin.settings.dailySubfolder)
          .setPlaceholder(DEFAULT_SETTINGS.dailySubfolder)
          .onChange(async (v) => {
            this.plugin.settings.dailySubfolder = v.trim() || DEFAULT_SETTINGS.dailySubfolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Weekly subfolder')
      .addText((t) =>
        t.setValue(this.plugin.settings.weeklySubfolder)
          .setPlaceholder(DEFAULT_SETTINGS.weeklySubfolder)
          .onChange(async (v) => {
            this.plugin.settings.weeklySubfolder = v.trim() || DEFAULT_SETTINGS.weeklySubfolder;
            await this.plugin.saveSettings();
          })
      );

    // ---- Sync schedule --------------------------------------------------
    new Setting(containerEl).setName('Sync').setHeading();

    new Setting(containerEl)
      .setName('Days to sync')
      .setDesc('How many days back each sync covers.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.syncDays))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 1 && n <= 365) {
              this.plugin.settings.syncDays = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Skip days before')
      .setDesc('YYYY-MM-DD lower bound. Days before this are never synced even on --force. Leave blank for no bound.')
      .addText((t) =>
        t.setValue(this.plugin.settings.skipDaysBefore)
          .setPlaceholder('e.g. 2026-01-01')
          .onChange(async (v) => {
            const s = v.trim();
            if (s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
              this.plugin.settings.skipDaysBefore = s;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Sync on Obsidian startup')
      .setDesc('Run a sync ~5 seconds after the plugin loads.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.syncOnStartup)
          .onChange(async (v) => {
            this.plugin.settings.syncOnStartup = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Background sync interval (minutes)')
      .setDesc('While Obsidian is open, run a sync every N minutes. Set to 0 to disable.')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.intervalMinutes))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 0) {
              this.plugin.settings.intervalMinutes = n;
              await this.plugin.saveSettings();
              this.plugin.scheduleInterval();
            }
          })
      );

    new Setting(containerEl)
      .setName('Database path')
      .setDesc('Path to Dayflow chunks.sqlite. Leave blank for the default macOS location.')
      .addText((t) =>
        t.setValue(this.plugin.settings.dbPath)
          .setPlaceholder('~/Library/Application Support/Dayflow/chunks.sqlite')
          .onChange(async (v) => {
            this.plugin.settings.dbPath = v.trim();
            await this.plugin.saveSettings();
          })
      );

    // ---- Output formatting ----------------------------------------------
    new Setting(containerEl).setName('Formatting').setHeading();

    new Setting(containerEl)
      .setName('Category wikilinks')
      .setDesc('Render categories as [[wikilinks]] for the graph view.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.categoryWikilinks)
          .onChange(async (v) => {
            this.plugin.settings.categoryWikilinks = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Timeline card summaries')
      .setDesc('Dayflow stores a one-line summary and a longer detailed summary per card. Choose which ones land in the daily note. "Detailed" and "Short" fall back to the other field when the preferred one is empty.')
      .addDropdown((d) =>
        d.addOptions({
          detailed: 'Detailed summary only',
          summary: 'Short summary only',
          both: 'Both',
          none: 'Neither',
        })
          .setValue(this.plugin.settings.cardSummaryMode)
          .onChange(async (v) => {
            this.plugin.settings.cardSummaryMode = v as CardSummaryMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Include deleted timeline cards')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.includeDeleted)
          .onChange(async (v) => {
            this.plugin.settings.includeDeleted = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Append to Obsidian daily note')
      .setDesc('Stamp a small Dayflow callout into the existing Daily Notes file (if any) for each synced day.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.appendToDailyNote)
          .onChange(async (v) => {
            this.plugin.settings.appendToDailyNote = v;
            await this.plugin.saveSettings();
          })
      );

    // ---- ActivityWatch --------------------------------------------------
    new Setting(containerEl).setName('ActivityWatch enrichment').setHeading();
    containerEl.createEl('p', {
      text: 'When enabled, the plugin queries your local ActivityWatch server to add precise per-app minutes to each timeline card. Queries hit localhost only.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Enable ActivityWatch sync')
      .setDesc('Off by default. Requires ActivityWatch running locally.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.awEnabled)
          .onChange(async (v) => {
            this.plugin.settings.awEnabled = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('ActivityWatch URL')
      .addText((t) =>
        t.setValue(this.plugin.settings.awUrl)
          .setPlaceholder(DEFAULT_SETTINGS.awUrl)
          .onChange(async (v) => {
            this.plugin.settings.awUrl = v.trim() || DEFAULT_SETTINGS.awUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Filter web events to browsers only')
      .setDesc('Ignore browser-tab events when the active window is not a browser. Recommended.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.awWebBrowserOnly)
          .onChange(async (v) => {
            this.plugin.settings.awWebBrowserOnly = v;
            await this.plugin.saveSettings();
          })
      );

    // ---- Dashboards & actions -------------------------------------------
    new Setting(containerEl).setName('Dashboards').setHeading();

    new Setting(containerEl)
      .setName('Install Bases dashboards')
      .setDesc('Drop "Recent days", "Weekly review", and "Focus performance" .base files into your output folder. Skips files that already exist.')
      .addButton((b) =>
        b.setButtonText('Install')
          .setCta()
          .onClick(async () => {
            const folder = this.plugin.getOutputFolder();
            const res = await installBases(this.plugin.app.vault, folder, false);
            new Notice(`Installed ${res.written.length} dashboards, skipped ${res.skipped.length} existing.`, 6000);
          })
      )
      .addButton((b) =>
        b.setButtonText('Reinstall')
          .setClass('mod-warning')
          .onClick(async () => {
            const folder = this.plugin.getOutputFolder();
            const res = await installBases(this.plugin.app.vault, folder, true);
            new Notice(`Reinstalled ${res.written.length} dashboards (overwrote ${res.skipped.length}).`, 6000);
          })
      );

    new Setting(containerEl)
      .setName('Run sync now')
      .setDesc('Trigger an immediate sync.')
      .addButton((b) =>
        b.setButtonText('Sync now')
          .setCta()
          .onClick(() => this.plugin.runSyncNow())
      );

    new Setting(containerEl)
      .setName('Rebuild notes')
      .setDesc('Normal syncs leave finished days alone, so formatting changes only affect new notes. This rewrites every day in the sync window (last "Days to sync" days) with the current settings.')
      .addButton((b) =>
        b.setButtonText('Rebuild')
          .setClass('mod-warning')
          .onClick(() => this.plugin.runSyncNow(false, true))
      );
  }
}
