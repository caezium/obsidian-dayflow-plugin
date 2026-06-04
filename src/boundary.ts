/**
 * Dayflow's 4 AM day boundary. Activity at 02:00 on Mar 15 belongs to Mar 14.
 */
const BOUNDARY_HOUR = 4;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getDayString(date: Date, boundaryHour = BOUNDARY_HOUR): string {
  const ref = new Date(date);
  const boundary = new Date(ref);
  boundary.setHours(boundaryHour, 0, 0, 0);
  if (ref < boundary) {
    const prev = new Date(boundary);
    prev.setDate(prev.getDate() - 1);
    return fmtDate(prev);
  }
  return fmtDate(boundary);
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const s = getDayString(d);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function isDayComplete(dayString: string, boundaryHour = BOUNDARY_HOUR): boolean {
  const day = new Date(`${dayString}T${pad2(boundaryHour)}:00:00`);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return new Date() >= next;
}

export function isoWeekKey(dayString: string): string {
  const d = new Date(`${dayString}T12:00:00`);
  const target = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${pad2(week)}`;
}

export function daysInWeek(weekKey: string): string[] {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Invalid week key: ${weekKey}`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day);
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(target);
    d.setUTCDate(target.getUTCDate() + i);
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  return out;
}

export function fmtLongDate(dayString: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date(`${dayString}T12:00:00`);
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtShortDay(dayString: string): string {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const d = new Date(`${dayString}T12:00:00`);
  return `${days[d.getDay()]} ${d.getDate()}`;
}
