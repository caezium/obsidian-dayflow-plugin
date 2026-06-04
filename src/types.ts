/**
 * Shared types for the Dayflow plugin. These mirror the schema columns we
 * actually read so we never silently drop fields.
 */

export interface TimelineCardRow {
  id: number;
  batch_id: number | null;
  start: string;
  end: string;
  start_ts: number;
  end_ts: number;
  day: string;
  title: string;
  summary: string | null;
  detailed_summary: string | null;
  category: string;
  subcategory: string | null;
  metadata: string | null;
  video_summary_url: string | null;
  created_at: string;
  is_deleted: number;
}

export interface TimelineCard extends TimelineCardRow {
  appPrimary: string | null;
  appSecondary: string | null;
  distractions: Distraction[];
}

export interface Distraction {
  startTime?: string;
  endTime?: string;
  title?: string;
  summary?: string;
  [k: string]: unknown;
}

export interface JournalEntry {
  id: number;
  day: string;
  intentions: string | null;
  notes: string | null;
  goals: string | null;
  reflections: string | null;
  summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StandupTask {
  id?: string;
  text?: string;
  done?: boolean;
}

export interface StandupHighlight {
  id?: string;
  text?: string;
}

export interface StandupPayload {
  highlightsTitle?: string;
  highlights?: StandupHighlight[];
  tasksTitle?: string;
  tasks?: StandupTask[];
  blockersTitle?: string;
  blockersBody?: string;
  [k: string]: unknown;
}

export interface Standup {
  day: string;
  createdAt: string;
  updatedAt: string;
  payload: StandupPayload;
}

export interface DayGoalCategory {
  day: string;
  kind: 'focus' | 'distraction';
  category_id: string;
  category_name: string;
  category_color_hex: string;
  sort_order: number;
}

export interface DayGoals {
  day: string;
  focus_target_minutes: number;
  distraction_limit_minutes: number;
  is_skipped: number;
  isSkipped: boolean;
  created_at: number;
  updated_at: number;
  focusCategories: DayGoalCategory[];
  distractionCategories: DayGoalCategory[];
}

export interface Rating {
  id: number;
  start_ts: number;
  end_ts: number;
  rating: string;
}

export interface CategoryStat {
  category: string;
  minutes: number;
  cards: number;
  pct: number;
  subcategories: { name: string; minutes: number }[];
}

export interface CategoryBreakdown {
  totalMinutes: number;
  categories: CategoryStat[];
}

export interface AppStat {
  app: string;
  minutes: number;
  sessions: number;
}

export interface AppTransition {
  source: string;
  target: string;
  count: number;
}

export interface GoalProgress {
  focusTargetMinutes: number;
  focusActualMinutes: number;
  focusPct: number | null;
  distractionLimitMinutes: number;
  distractionActualMinutes: number;
  distractionPct: number | null;
  isSkipped: boolean;
}

export interface PluginSettings {
  /** Folder within the vault to write notes into. */
  outputFolder: string;
  /** Subfolder names. */
  dailySubfolder: string;
  weeklySubfolder: string;
  /** Absolute path to chunks.sqlite. Empty = default macOS location. */
  dbPath: string;
  /** Days back to sync each run. */
  syncDays: number;
  /** Minutes between background syncs (0 = disabled). */
  intervalMinutes: number;
  /** Run a sync immediately on Obsidian startup. */
  syncOnStartup: boolean;
  /** Render category names as [[wikilinks]]. */
  categoryWikilinks: boolean;
  /** Include deleted cards. */
  includeDeleted: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  outputFolder: '30_resources/Dayflow',
  dailySubfolder: 'Daily',
  weeklySubfolder: 'Weekly',
  dbPath: '',
  syncDays: 3,
  intervalMinutes: 30,
  syncOnStartup: true,
  categoryWikilinks: true,
  includeDeleted: false,
};
