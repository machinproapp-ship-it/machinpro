/**
 * Work-duration display for clock-in flows (traffic-light thresholds, i18n tokens).
 */

export function elapsedMinutesSinceClockStart(params: {
  dateYmd: string;
  clockInHm: string;
  clockInAtIso?: string | null;
}): number {
  let startMs: number;
  if (params.clockInAtIso) {
    startMs = new Date(params.clockInAtIso).getTime();
  } else {
    const raw = String(params.clockInHm).trim();
    const [hh, mm] = raw.split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    const d = new Date(`${params.dateYmd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
    startMs = d.getTime();
  }
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / 60_000));
}

/** Green &lt; 8h, amber 8h–10h inclusive, red &gt; 10h */
export function trafficLightClassFromElapsedHours(hours: number): string {
  if (hours < 8) return "text-emerald-600 dark:text-emerald-400";
  if (hours <= 10) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function formatWorkDurationCompact(totalMinutes: number, lx: Record<string, string>): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  const hoursTpl = lx.clock_hours_short ?? "{h}h {m}min";
  const minTpl = lx.clock_minutes_short ?? "{m}min";
  if (h < 1) return minTpl.replace(/\{m\}/g, String(min));
  return hoursTpl.replace(/\{h\}/g, String(h)).replace(/\{m\}/g, String(min));
}

/** Minutes between scheduled shift start/end (handles overnight). Min 30. Default 8h if unparsable. */
export function shiftGoalMinutesFromSchedule(entry: { startTime: string; endTime: string }): number {
  const parseHm = (raw: string) => {
    const s = String(raw ?? "").trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    const hh = parseInt(m[1]!, 10);
    const mm = parseInt(m[2]!, 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };
  const s = parseHm(entry.startTime);
  const e = parseHm(entry.endTime);
  if (s == null || e == null) return 8 * 60;
  let delta = e - s;
  if (delta <= 0) delta += 24 * 60;
  return Math.max(30, delta);
}

export function formatCompletedWorkFromHmPair(
  clockIn: string,
  clockOut: string,
  lx: Record<string, string>
): string {
  const [ih, im] = clockIn.split(":").map((x) => parseInt(x, 10));
  const [oh, om] = clockOut.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(ih) || !Number.isFinite(im) || !Number.isFinite(oh) || !Number.isFinite(om)) return "";
  let start = ih * 60 + im;
  let end = oh * 60 + om;
  if (end < start) end += 24 * 60;
  return formatWorkDurationCompact(end - start, lx);
}
