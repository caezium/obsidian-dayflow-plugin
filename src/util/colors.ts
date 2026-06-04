const PALETTE = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7',
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorFor(name: string, override: string | null = null): string {
  if (override && /^#[0-9a-fA-F]{6}$/.test(override)) return override;
  if (!name) return PALETTE[0];
  return PALETTE[hash(name) % PALETTE.length];
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
