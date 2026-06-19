// Lightweight astronomy helpers (no dependencies).

export interface MoonInfo {
  /** Phase name, e.g. "Waxing gibbous". */
  phase: string;
  /** Illuminated fraction 0-100. */
  illuminationPct: number;
  /** True near a new or full moon — classically the strongest feeding/tides. */
  major: boolean;
}

/**
 * Approximate moon phase for a date. Based on the mean synodic month measured
 * from a known new moon; accurate to ~1 day, which is plenty for fishing.
 */
export function moonInfo(date: Date): MoonInfo {
  const synodic = 29.53058867;
  const refNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0); // 2000-01-06 new moon
  const days = (date.getTime() - refNewMoon) / 86400000;
  let frac = (days % synodic) / synodic;
  if (frac < 0) frac += 1;

  const illuminationPct = Math.round(((1 - Math.cos(2 * Math.PI * frac)) / 2) * 100);

  const phase = phaseName(frac);
  // "Major" feeding influence near new (frac~0/1) and full (frac~0.5) moons.
  const major = frac < 0.06 || frac > 0.94 || Math.abs(frac - 0.5) < 0.06;

  return { phase, illuminationPct, major };
}

function phaseName(frac: number): string {
  if (frac < 0.03 || frac > 0.97) return 'New moon';
  if (frac < 0.22) return 'Waxing crescent';
  if (frac < 0.28) return 'First quarter';
  if (frac < 0.47) return 'Waxing gibbous';
  if (frac < 0.53) return 'Full moon';
  if (frac < 0.72) return 'Waning gibbous';
  if (frac < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

/** Extract "HH:MM" from an ISO-ish local datetime string like "2026-06-19T05:54". */
export function timeOfDay(iso: string | undefined): string {
  if (!iso) return '—';
  const t = iso.split('T')[1];
  return t ? t.slice(0, 5) : '—';
}
