// Catch-log reporting: mine the conditions saved with logged catches for the
// angler's personal patterns, and flag upcoming forecast days that look like
// days they've caught fish before. Pure functions — no storage or UI.
import type { CatchConditions, CatchRecord, Conditions } from '@/types';
import { hourOf } from '@/utils/dates';

/** Catches (with conditions attached) needed before patterns are shown. */
export const REPORT_MIN_CATCHES = 3;

/** One "you catch fish when…" line, e.g. "Falling pressure — 5 of 8". */
export interface PatternRow {
  key: string;
  /** Feather icon name for the row. */
  icon: string;
  /** Human value, e.g. "Falling pressure" or "Water 60–64°F". */
  text: string;
  /** Catches in this bucket vs. catches that had this dimension recorded. */
  count: number;
  total: number;
}

export interface CatchReport {
  /** All logged catches. */
  total: number;
  /** Catches with a conditions snapshot attached. */
  tagged: number;
  needed: number;
  /** Empty until `tagged >= needed`. */
  patterns: PatternRow[];
}

/** An upcoming day that resembles conditions the angler has caught fish in. */
export interface DayMatch {
  date: string;
  dayOffset: number;
  /** "Today" / "Thu · Jul 16". */
  label: string;
  /** How many logged catches this day resembles. */
  matches: number;
  /** Best per-catch similarity, 0–1 (for sorting). */
  score: number;
  /** Shared conditions, e.g. ["falling pressure", "water ~64°F"]. */
  reasons: string[];
  /** Average planner bite score of the matched catches, if they had one. */
  avgBite: number | null;
}

// ---- shared bucketing ----

const WIND_BANDS = [
  { max: 5, label: 'Calm wind (under 5 mph)' },
  { max: 10, label: 'Light wind (5–10 mph)' },
  { max: 15, label: 'Breezy (10–15 mph)' },
  { max: Infinity, label: 'Windy (15+ mph)' },
] as const;

function windBand(mph: number): number {
  return WIND_BANDS.findIndex((b) => mph <= b.max);
}

function tempBin(f: number): string {
  const lo = Math.floor(f / 5) * 5;
  return `${lo}–${lo + 4}°F`;
}

function timeBlock(iso: string): string | null {
  const h = hourOf(iso);
  if (Number.isNaN(h)) return null;
  if (h >= 4 && h < 8) return 'Dawn (4–8 AM)';
  if (h >= 8 && h < 11) return 'Morning (8–11 AM)';
  if (h >= 11 && h < 15) return 'Midday (11 AM–3 PM)';
  if (h >= 15 && h < 19) return 'Evening (3–7 PM)';
  return 'Night';
}

const SKY_LABEL = {
  clear: 'Clear skies',
  partly_cloudy: 'Partly cloudy skies',
  overcast: 'Overcast skies',
} as const;

const TREND_LABEL = {
  falling: 'Falling pressure',
  rising: 'Rising pressure',
  steady: 'Steady pressure',
} as const;

// ---- trailing report ----

/** Count values of one dimension and return its most common bucket. */
function topBucket(
  values: Array<string | null>,
): { value: string; count: number; total: number } | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    if (v == null) continue;
    total++;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  // A "pattern" needs at least 2 catches agreeing, or it's just one good day.
  if (best === null || bestCount < 2) return null;
  return { value: best, count: bestCount, total };
}

export function buildCatchReport(catches: CatchRecord[]): CatchReport {
  const tagged = catches.filter((c) => c.conditions) as Array<
    CatchRecord & { conditions: CatchConditions }
  >;
  const report: CatchReport = {
    total: catches.length,
    tagged: tagged.length,
    needed: REPORT_MIN_CATCHES,
    patterns: [],
  };
  if (tagged.length < REPORT_MIN_CATCHES) return report;

  const cs = tagged.map((c) => c.conditions);
  const push = (
    key: string,
    icon: string,
    bucket: { value: string; count: number; total: number } | null,
  ) => {
    if (bucket) {
      report.patterns.push({ key, icon, text: bucket.value, ...bucket });
    }
  };

  push(
    'trend',
    'trending-down',
    topBucket(cs.map((c) => (c.pressureTrend === 'unknown' ? null : TREND_LABEL[c.pressureTrend]))),
  );
  push('sky', 'cloud', topBucket(cs.map((c) => SKY_LABEL[c.sky] ?? null)));
  push(
    'wind',
    'wind',
    topBucket(cs.map((c) => WIND_BANDS[windBand(c.windMph)]?.label ?? null)),
  );
  push(
    'watertemp',
    'thermometer',
    topBucket(cs.map((c) => `Water ${tempBin(c.waterTempF)}`)),
  );
  push('time', 'sunrise', topBucket(cs.map((c) => timeBlock(c.capturedAt))));
  push(
    'tide',
    'repeat',
    topBucket(
      cs.map((c) =>
        c.tideState && c.tideState !== 'unknown' ? `${c.tideState === 'incoming' ? 'Incoming' : c.tideState === 'outgoing' ? 'Outgoing' : 'Slack'} tide` : null,
      ),
    ),
  );
  push(
    'clarity',
    'droplet',
    topBucket(cs.map((c) => `${c.clarity[0]?.toUpperCase()}${c.clarity.slice(1)} water`)),
  );

  // Gear works on every catch — no conditions snapshot required.
  push(
    'gear',
    'anchor',
    topBucket(catches.map((c) => c.lure ?? c.rig ?? c.bait ?? c.gearOther ?? null)),
  );
  push('species', 'award', topBucket(catches.map((c) => c.species || null)));

  return report;
}

// ---- upcoming-day matching ----

interface DimScore {
  earned: number;
  possible: number;
  /** Reason chip when this dimension fully matched. */
  reason: string | null;
}

function scoreDim(earned: number, possible: number, reason: string | null): DimScore {
  return { earned, possible, reason: earned === possible ? reason : null };
}

/** Similarity of one logged catch to one forecast day, 0–1 with reasons. */
function similarity(
  c: CatchConditions,
  day: Conditions,
): { score: number; reasons: string[] } {
  if (c.waterType !== day.waterType) return { score: 0, reasons: [] };

  const dims: DimScore[] = [];
  const w = day.weather;

  if (c.pressureTrend !== 'unknown' && w.pressureTrend !== 'unknown') {
    dims.push(
      scoreDim(c.pressureTrend === w.pressureTrend ? 2 : 0, 2, `${c.pressureTrend} pressure`),
    );
  }
  dims.push(scoreDim(c.sky === w.sky ? 1 : 0, 1, SKY_LABEL[c.sky]?.toLowerCase() ?? null));

  const bandDiff = Math.abs(windBand(c.windMph) - windBand(w.windMph));
  dims.push(
    scoreDim(bandDiff === 0 ? 1 : bandDiff === 1 ? 0.5 : 0, 1, `wind ~${Math.round(w.windMph)} mph`),
  );

  const airDiff = Math.abs(c.airTempF - w.airTempF);
  dims.push(
    scoreDim(airDiff <= 6 ? 1 : airDiff <= 12 ? 0.5 : 0, 1, `air ~${Math.round(w.airTempF)}°F`),
  );

  const waterDiff = Math.abs(c.waterTempF - day.water.waterTempF);
  dims.push(
    scoreDim(
      waterDiff <= 4 ? 2 : waterDiff <= 8 ? 1 : 0,
      2,
      `water ~${Math.round(day.water.waterTempF)}°F`,
    ),
  );

  const possible = dims.reduce((s, d) => s + d.possible, 0);
  const earned = dims.reduce((s, d) => s + d.earned, 0);
  return {
    score: possible > 0 ? earned / possible : 0,
    reasons: dims.map((d) => d.reason).filter((r): r is string => !!r),
  };
}

/** A day "resembles" a catch at or above this similarity. */
const MATCH_THRESHOLD = 0.6;

/** The personal-history nudge fed into the bite score. */
export interface PersonalBias {
  /** Score points to add (0 or positive — absence of catches is not a signal). */
  delta: number;
  /** How many logged catches today's conditions resemble. */
  matches: number;
  /** "Why" line for the factors list, when there's a bias. */
  factor: string | null;
}

/**
 * The poor-man's Fishbrain: bias the bite score with the angler's OWN logged
 * catches. Days resembling conditions they've actually caught fish in get a
 * small boost (+2 per matching catch, capped at +6). One-sided on purpose —
 * having no similar catches means nothing (they may just not have fished such
 * a day yet), so there is never a penalty.
 */
export function personalBias(catches: CatchRecord[], day: Conditions): PersonalBias {
  const tagged = catches
    .map((c) => c.conditions)
    .filter((c): c is CatchConditions => !!c);
  let matches = 0;
  for (const c of tagged) {
    if (similarity(c, day).score >= MATCH_THRESHOLD) matches += 1;
  }
  if (matches === 0) return { delta: 0, matches: 0, factor: null };
  return {
    delta: Math.min(6, matches * 2),
    matches,
    factor:
      matches === 1
        ? 'Conditions resemble a day you logged a catch — days like this have produced for you.'
        : `Conditions resemble ${matches} of your logged catches — days like this have produced for you.`,
  };
}

function matchLabel(date: string, dayOffset: number): string {
  if (dayOffset === 0) return 'Today';
  if (dayOffset === 1) return 'Tomorrow';
  const d = new Date(`${date}T12:00`);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${weekday} · ${month} ${d.getDate()}`;
}

/**
 * Score each forecast day against every condition-tagged catch. Returns the
 * days that resemble at least one catch, best first, at most `limit`.
 */
export function matchUpcomingDays(
  catches: CatchRecord[],
  forecast: Conditions[],
  limit = 3,
): DayMatch[] {
  const tagged = catches
    .map((c) => c.conditions)
    .filter((c): c is CatchConditions => !!c);
  if (!tagged.length) return [];

  const out: DayMatch[] = [];
  for (const day of forecast) {
    let matches = 0;
    let best = 0;
    const reasonCounts = new Map<string, number>();
    const bites: number[] = [];
    for (const c of tagged) {
      const { score, reasons } = similarity(c, day);
      if (score < MATCH_THRESHOLD) continue;
      matches++;
      best = Math.max(best, score);
      for (const r of reasons) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      if (typeof c.biteScore === 'number') bites.push(c.biteScore);
    }
    if (!matches) continue;
    const reasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([r]) => r);
    out.push({
      date: day.date,
      dayOffset: day.dayOffset,
      label: matchLabel(day.date, day.dayOffset),
      matches,
      score: best,
      reasons,
      avgBite: bites.length
        ? Math.round(bites.reduce((s, b) => s + b, 0) / bites.length)
        : null,
    });
  }
  return out
    .sort((a, b) => b.matches - a.matches || b.score - a.score || a.dayOffset - b.dayOffset)
    .slice(0, limit);
}
