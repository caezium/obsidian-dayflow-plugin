/**
 * Color resolvers.
 *
 * Two tiers:
 * 1. `colorForApp(name)` — substring-match against a brand-color map so
 *    youtube.com always renders red, github.com charcoal, claude.ai orange,
 *    etc. Fall back to the hash palette below if nothing matches.
 * 2. `colorFor(name, override?)` — generic deterministic hash → 12-color
 *    palette. Used for category names where there's no canonical brand,
 *    plus as the fallback for unknown apps.
 *
 * The brand map mirrors Dayflow's `appColorHex` in WeeklyDashboardBuilder.swift
 * so apps render the same hue inside the vault as they do inside the app
 * (consistency makes the screenshots cross-reference correctly).
 */

const PALETTE = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7',
];

// Substring → brand hex. Match is case-insensitive on the LOWERCASED name.
// Order matters: more specific tokens go first to win against generic ones.
const APP_BRAND: Array<[string, string]> = [
  // AI / coding tools
  ['chatgpt', '#333333'],
  ['claude', '#D97757'],
  ['codex', '#111111'],
  ['cursor', '#111111'],
  ['xcode', '#4085FD'],
  ['vscode', '#0078D4'],
  ['visual studio', '#0078D4'],
  ['jetbrains', '#FE315D'],
  ['intellij', '#087CFA'],
  ['github', '#24292F'],
  ['gitlab', '#FC6D26'],

  // Productivity / docs
  ['obsidian', '#7C3AED'],
  ['notion', '#111111'],
  ['linear', '#5E6AD2'],
  ['figma', '#FF7262'],
  ['canva', '#00C4CC'],
  ['google docs', '#4285F4'],
  ['docs.google', '#4285F4'],
  ['sheets.google', '#0F9D58'],

  // Communication
  ['slack', '#36C5F0'],
  ['zoom', '#4085FD'],
  ['meet.google', '#34A853'],
  ['google meet', '#34A853'],
  ['discord', '#5865F2'],
  ['teams', '#4B53BC'],
  ['mail.', '#4F8EF7'],
  ['messages', '#38D06E'],

  // Data / dev
  ['kaggle', '#20BEFF'],
  ['stackoverflow', '#F58025'],
  ['stack overflow', '#F58025'],

  // Browsers
  ['safari', '#2E8BFF'],
  ['chrome', '#4285F4'],
  ['firefox', '#FF7139'],
  ['arc.', '#FA624D'],
  ['edge', '#0078D7'],

  // Media / distractions
  ['youtube', '#FF0000'],
  ['netflix', '#E50914'],
  ['spotify', '#1DB954'],
  ['twitch', '#9146FF'],
  ['reddit', '#FF613C'],
  ['twitter', '#111111'],
  ['x.com', '#111111'],
  ['substack', '#FF6E3E'],
  ['instagram', '#E1306C'],
  ['tiktok', '#000000'],

  // Games
  ['steam', '#1B2838'],
  ['minecraft', '#3F8E2C'],
  ['lichess', '#629924'],
  ['league of legends', '#C8AA6E'],
  ['lichess.org', '#629924'],

  // Calendar / system
  ['calendar', '#A29993'],
  ['dayflow', '#FF7A2F'],

  // Generic catch-alls (last so specific tokens win)
  ['other', '#9CA3AF'],
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Generic color for a name. Used for categories and as the fallback for
 * apps with no brand match. Pass an `override` hex (e.g. from Dayflow's
 * `day_goal_categories.category_color_hex`) to win over everything.
 */
export function colorFor(name: string, override: string | null = null): string {
  if (override && /^#[0-9a-fA-F]{6}$/.test(override)) return override;
  if (!name) return PALETTE[0];
  return PALETTE[hash(name) % PALETTE.length];
}

/**
 * App-aware color. Tries the brand map first (substring match), falls back
 * to the hash palette. Used by the Sankey, the nested treemap inner tiles,
 * and any other per-app coloring.
 */
export function colorForApp(name: string): string {
  if (!name) return PALETTE[0];
  const lower = name.toLowerCase();
  for (const [needle, color] of APP_BRAND) {
    if (lower.includes(needle)) return color;
  }
  return colorFor(name);
}

export function buildColorMap(
  categories: string[],
  overrides: Record<string, string> = {}
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of categories) {
    map[cat] = colorFor(cat, overrides[cat]);
  }
  return map;
}

/**
 * Pick a text color (black or white) that contrasts with the given hex
 * background. Used so inner treemap tiles get readable labels regardless
 * of brand color.
 */
export function contrastingText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Relative luminance per WCAG.
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? '#1f2937' : '#fff';
}
