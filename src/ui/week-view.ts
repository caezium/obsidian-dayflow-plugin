/**
 * Side-pane "This Week" view. Mirrors TodayView but reads the current
 * weekly note instead of the daily one. Refreshes after every sync.
 */
import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component, setIcon, Notice } from 'obsidian';
import type DayflowPlugin from '../main.js';
import { getDayString, isoWeekKey } from '../boundary.js';

export const WEEK_VIEW_TYPE = 'dayflow-week-view';

export class WeekView extends ItemView {
  private plugin: DayflowPlugin;
  private rendererComponent: Component;
  private bodyEl!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: DayflowPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.rendererComponent = new Component();
  }

  getViewType(): string { return WEEK_VIEW_TYPE; }
  getDisplayText(): string { return 'Dayflow · This week'; }
  getIcon(): string { return 'calendar-days'; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('dayflow-today-view');

    const header = container.createDiv({ cls: 'dayflow-today-header' });
    header.createEl('h3', { text: 'Dayflow · This week', cls: 'dayflow-today-title' });
    const refreshBtn = header.createEl('button', { cls: 'dayflow-today-refresh', attr: { 'aria-label': 'Sync now' } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => { void this.plugin.runSyncNow(); });

    this.statusEl = container.createDiv({ cls: 'dayflow-today-status' });
    this.bodyEl = container.createDiv({ cls: 'dayflow-today-body' });

    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.rendererComponent.unload();
  }

  async refresh(): Promise<void> {
    if (!this.bodyEl) return;
    this.bodyEl.empty();
    this.rendererComponent.unload();
    this.rendererComponent = new Component();
    this.rendererComponent.load();

    const weekKey = isoWeekKey(getDayString(new Date()));
    const path = `${this.plugin.settings.outputFolder.replace(/\/+$/, '')}/${this.plugin.settings.weeklySubfolder}/Dayflow_${weekKey}.md`;
    const file = this.plugin.app.vault.getFileByPath(path);

    if (this.statusEl) {
      const last = this.plugin.settings.lastSyncAt;
      this.statusEl.setText(last ? `Last sync: ${formatAgo(last)}` : 'Not synced yet');
    }

    if (!file) {
      const empty = this.bodyEl.createDiv({ cls: 'dayflow-today-empty' });
      empty.createEl('p', { text: `No note yet for ${weekKey}.` });
      const tryBtn = empty.createEl('button', { text: 'Sync now', cls: 'mod-cta' });
      tryBtn.addEventListener('click', () => {
        void (async () => {
          await this.plugin.runSyncNow();
          await this.refresh();
        })();
      });
      return;
    }
    try {
      const content = await this.plugin.app.vault.read(file);
      const stripped = content.replace(/^---[\s\S]*?---\n+/, '');
      await MarkdownRenderer.render(this.plugin.app, stripped, this.bodyEl, path, this.rendererComponent);
    } catch (err) {
      this.bodyEl.createEl('p', { text: `Failed to render: ${(err as Error).message}` });
      new Notice('Dayflow: failed to render week view');
    }
  }
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
