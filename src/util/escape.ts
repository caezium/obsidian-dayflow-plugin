const XML_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function xml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => XML_MAP[c]);
}

export function tableCell(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function wikilinkSafe(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[\[\]|#^]/g, '');
}
