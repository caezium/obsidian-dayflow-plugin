import { App, PluginSettingTab, Setting } from 'obsidian';
import type DayflowPlugin from './main.js';
import { DEFAULT_SETTINGS } from './types.js';

export class DayflowSettingTab extends PluginSettingTab {
  plugin: DayflowPlugin;

  constructor(app: App, plugin: DayflowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Dayflow' });
    containerEl.createEl('p', {
      text: 'Read-only export of your Dayflow data into this vault. The plugin opens chunks.sqlite in read-only mode and never makes network calls.',
      cls: 'setting-item-description',
    });

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
      .setName('Include deleted timeline cards')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.includeDeleted)
          .onChange(async (v) => {
            this.plugin.settings.includeDeleted = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Run sync now')
      .setDesc('Trigger an immediate sync. Same as the command-palette action.')
      .addButton((b) =>
        b.setButtonText('Sync now')
          .setCta()
          .onClick(() => this.plugin.runSyncNow())
      );
  }
}
