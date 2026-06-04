export function minutesBetween(startTs: number, endTs: number): number {
  return Math.max(0, Math.round((endTs - startTs) / 60));
}

export function fmtDuration(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
