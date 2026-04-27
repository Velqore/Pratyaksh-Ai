// Brute-force burst detection. Given a stream of timestamped failed-login
// events, identify per-IP bursts above a threshold within a sliding window.

export interface BurstEvent {
  ip: string;
  user?: string;
  /** Best-effort epoch second; 0 when not parseable. */
  epoch: number;
}

export interface Burst {
  ip: string;
  count: number;
  windowSeconds: number;
  firstAt: number;
  lastAt: number;
  users: string[];
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Best-effort parse of "Mar 12 14:55:01" syslog-style timestamps. */
export function parseSyslogTimestamp(ts: string | undefined): number {
  if (!ts) return 0;
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(ts);
  if (!m) {
    // Try ISO
    const t = Date.parse(ts);
    return isNaN(t) ? 0 : Math.floor(t / 1000);
  }
  const month = MONTHS[m[1]] ?? 0;
  const day = parseInt(m[2], 10);
  const hr = parseInt(m[3], 10);
  const mn = parseInt(m[4], 10);
  const sc = parseInt(m[5], 10);
  // Use current year — syslog format omits it.
  const year = new Date().getUTCFullYear();
  return Math.floor(Date.UTC(year, month, day, hr, mn, sc) / 1000);
}

export function detectBursts(
  events: BurstEvent[],
  threshold = 5,
  windowSeconds = 60,
): Burst[] {
  // Group by IP
  const byIp = new Map<string, BurstEvent[]>();
  for (const e of events) {
    const arr = byIp.get(e.ip) ?? [];
    arr.push(e);
    byIp.set(e.ip, arr);
  }
  const bursts: Burst[] = [];
  for (const [ip, evs] of byIp) {
    evs.sort((a, b) => a.epoch - b.epoch);
    let i = 0;
    while (i < evs.length) {
      let j = i;
      while (j < evs.length && evs[j].epoch - evs[i].epoch <= windowSeconds) j++;
      const window = evs.slice(i, j);
      if (window.length >= threshold) {
        const users = Array.from(new Set(window.map((w) => w.user).filter(Boolean) as string[]));
        bursts.push({
          ip,
          count: window.length,
          windowSeconds,
          firstAt: window[0].epoch,
          lastAt: window[window.length - 1].epoch,
          users,
        });
        i = j;
      } else {
        i++;
      }
    }
  }
  return bursts.sort((a, b) => b.count - a.count);
}
