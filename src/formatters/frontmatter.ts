/**
 * Minimal YAML frontmatter emitter — supports primitives + string arrays.
 * We avoid the js-yaml dependency to keep the plugin bundle small.
 */
type FmValue = string | number | boolean | null | undefined | string[] | number[];

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function emitValue(v: FmValue): string | null {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return needsQuoting(v) ? `'${v.replace(/'/g, "''")}'` : v;
  if (isStringArray(v) || isNumberArray(v)) {
    return v.map((x) => (typeof x === 'string' && needsQuoting(x) ? `'${x.replace(/'/g, "''")}'` : String(x))).join(', ');
  }
  return null;
}

function needsQuoting(s: string): boolean {
  if (s === '') return true;
  if (/^[\s\-:#&*!|>%@`]/.test(s)) return true;
  if (/[:#]\s/.test(s)) return true;
  if (/^(true|false|null|yes|no|on|off)$/i.test(s)) return true;
  if (/^\d/.test(s) && /^[\d.\-+eE]+$/.test(s)) return true;
  return false;
}

export function frontmatter(obj: Record<string, FmValue>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    const formatted = emitValue(v);
    if (formatted == null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${formatted}]`);
    } else {
      lines.push(`${k}: ${formatted}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}
