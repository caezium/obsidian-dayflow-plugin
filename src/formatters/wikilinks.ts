import { wikilinkSafe } from '../util/escape.js';

export function wikilink(name: string, opts: { enabled?: boolean } = {}): string {
  const enabled = opts.enabled ?? true;
  if (!name) return '';
  if (!enabled) return String(name);
  return `[[${wikilinkSafe(name)}]]`;
}

export function dayLink(dayString: string): string {
  return `[[Dayflow_${dayString}|${dayString}]]`;
}

export function weekLink(weekKey: string): string {
  return `[[Dayflow_${weekKey}|${weekKey}]]`;
}
