/**
 * ActivityWatch enrichment fetcher.
 *
 * Calls AW's REST API via Obsidian's `requestUrl` (fetch/axios are
 * CORS-blocked in Obsidian's renderer). Pulls window, web, and AFK events
 * for a given day window and rolls them up.
 *
 * Reference: ActivityWatch HTTP API at http://localhost:5600/api/0/
 *   GET /api/0/buckets
 *   GET /api/0/buckets/{id}/events?start=ISO&end=ISO
 *
 * We aggregate three signals per timeline card:
 *   - Per-card app minutes (window events overlapping the card's [start,end])
 *   - Day-wide app totals
 *   - Day AFK total
 */
import { requestUrl } from 'obsidian';
import type { TimelineCard, AwEnrichment } from '../types.js';

interface AWBucket {
  id: string;
  type: string;
  client?: string;
  hostname?: string;
}

interface AWEvent {
  id?: number;
  timestamp: string;
  duration: number; // seconds
  data: Record<string, unknown>;
}

interface BucketSet {
  windowBuckets: string[];
  webBuckets: string[];
  afkBuckets: string[];
}

const BROWSER_HINTS = [
  'chrome', 'safari', 'firefox', 'arc', 'edge', 'brave', 'opera', 'vivaldi', 'zen',
];

/**
 * Discover relevant buckets from the AW server. Returns null if the server
 * is unreachable — we silently no-op on the enrichment in that case.
 */
export async function discoverBuckets(awUrl: string): Promise<BucketSet | null> {
  let res;
  try {
    res = await requestUrl({
      url: `${stripTrailingSlash(awUrl)}/api/0/buckets`,
      method: 'GET',
      throw: false,
    });
  } catch {
    return null;
  }
  if (res.status !== 200) return null;
  let buckets: Record<string, AWBucket>;
  try {
    buckets = res.json as Record<string, AWBucket>;
  } catch {
    return null;
  }
  const set: BucketSet = { windowBuckets: [], webBuckets: [], afkBuckets: [] };
  for (const b of Object.values(buckets)) {
    if (b.type === 'currentwindow' || b.id.includes('window')) set.windowBuckets.push(b.id);
    else if (b.type === 'web.tab.current' || b.id.includes('web')) set.webBuckets.push(b.id);
    else if (b.type === 'afkstatus' || b.type === 'afk' || b.id.includes('afk')) set.afkBuckets.push(b.id);
  }
  return set;
}

async function fetchEvents(awUrl: string, bucketId: string, startISO: string, endISO: string): Promise<AWEvent[]> {
  const url = `${stripTrailingSlash(awUrl)}/api/0/buckets/${encodeURIComponent(bucketId)}/events?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  const res = await requestUrl({ url, method: 'GET', throw: false });
  if (res.status !== 200) return [];
  try {
    return (res.json as AWEvent[]) || [];
  } catch {
    return [];
  }
}

/**
 * Build an AwEnrichment for a single Dayflow day given that day's cards.
 *
 * Returns null if AW is unreachable, returns an empty enrichment if AW is
 * up but has no events in the window.
 */
export async function fetchEnrichment(
  awUrl: string,
  dayString: string,
  cards: TimelineCard[],
  opts: { webBrowserOnly: boolean } = { webBrowserOnly: true }
): Promise<AwEnrichment | null> {
  const buckets = await discoverBuckets(awUrl);
  if (!buckets) return null;

  // Window: 04:00 of dayString → 04:00 of next day (Dayflow's day boundary).
  const startDate = new Date(`${dayString}T04:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const [windowEventsArr, webEventsArr, afkEventsArr] = await Promise.all([
    Promise.all(buckets.windowBuckets.map((id) => fetchEvents(awUrl, id, startISO, endISO))),
    Promise.all(buckets.webBuckets.map((id) => fetchEvents(awUrl, id, startISO, endISO))),
    Promise.all(buckets.afkBuckets.map((id) => fetchEvents(awUrl, id, startISO, endISO))),
  ]);
  const windowEvents = windowEventsArr.flat();
  const webEvents = webEventsArr.flat();
  const afkEvents = afkEventsArr.flat();

  // Day-wide app totals from window events.
  const dayAppMap = new Map<string, number>();
  for (const ev of windowEvents) {
    const app = String((ev.data?.app ?? '') as string).trim();
    if (!app) continue;
    dayAppMap.set(app, (dayAppMap.get(app) || 0) + ev.duration);
  }
  const dayApps = [...dayAppMap.entries()]
    .map(([app, seconds]) => ({ app, seconds: Math.round(seconds) }))
    .sort((a, b) => b.seconds - a.seconds);

  // Day-wide AFK total (status === 'afk').
  let afkSeconds = 0;
  for (const ev of afkEvents) {
    if ((ev.data?.status as string) === 'afk') afkSeconds += ev.duration;
  }
  afkSeconds = Math.round(afkSeconds);

  // Web noise filter: only count web events whose timestamp falls inside a window where
  // the active app is a browser.
  let filteredWebEvents = webEvents;
  if (opts.webBrowserOnly) {
    const browserIntervals = collectBrowserIntervals(windowEvents);
    filteredWebEvents = webEvents.filter((ev) => {
      const t = Date.parse(ev.timestamp);
      return inAnyInterval(browserIntervals, t);
    });
  }
  void filteredWebEvents; // currently used only for the noise-filter design — kept for future per-domain enrichment

  // Per-card: sum window events that overlap each card's [start_ts, end_ts] window.
  const byCardId = new Map<number, { app: string; seconds: number }[]>();
  for (const card of cards) {
    const cardStartMs = card.start_ts * 1000;
    const cardEndMs = card.end_ts * 1000;
    const perApp = new Map<string, number>();
    for (const ev of windowEvents) {
      const evStart = Date.parse(ev.timestamp);
      const evEnd = evStart + ev.duration * 1000;
      const overlap = Math.min(cardEndMs, evEnd) - Math.max(cardStartMs, evStart);
      if (overlap <= 0) continue;
      const app = String((ev.data?.app ?? '') as string).trim();
      if (!app) continue;
      perApp.set(app, (perApp.get(app) || 0) + overlap / 1000);
    }
    if (perApp.size > 0) {
      byCardId.set(
        card.id,
        [...perApp.entries()]
          .map(([app, seconds]) => ({ app, seconds: Math.round(seconds) }))
          .sort((a, b) => b.seconds - a.seconds)
      );
    }
  }

  const totalSeconds = Math.round(windowEvents.reduce((s, e) => s + e.duration, 0));

  return { byCardId, dayApps, afkSeconds, totalSeconds };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function isBrowserApp(app: string): boolean {
  const a = app.toLowerCase();
  return BROWSER_HINTS.some((h) => a.includes(h));
}

function collectBrowserIntervals(windowEvents: AWEvent[]): [number, number][] {
  const out: [number, number][] = [];
  for (const ev of windowEvents) {
    const app = String((ev.data?.app ?? '') as string);
    if (!isBrowserApp(app)) continue;
    const start = Date.parse(ev.timestamp);
    out.push([start, start + ev.duration * 1000]);
  }
  return out;
}

function inAnyInterval(intervals: [number, number][], t: number): boolean {
  for (const [s, e] of intervals) if (t >= s && t <= e) return true;
  return false;
}
