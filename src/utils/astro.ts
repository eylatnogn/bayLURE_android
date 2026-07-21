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

/** Solunar feeding periods: majors = moon overhead/underfoot, minors = rise/set. */
export interface SolunarTimes {
  /** Epoch ms of lunar transits (upper and lower) near the given day. */
  majors: number[];
  /** Epoch ms of approximate moonrise/moonset (transit ± a quarter lunar day). */
  minors: number[];
}

// The moon crosses the same meridian every ~24h50m (it falls behind the sun
// by ~50 min/day as it orbits).
const LUNAR_DAY_MS = 24.8412 * 3600000;

/**
 * Approximate solunar major/minor times around a date at a longitude.
 *
 * Model: at new moon the moon travels with the sun, so its upper transit is
 * local solar noon; each day into the cycle it lags by ~1/29.5 of a lunar day,
 * putting the full-moon transit at solar midnight. Mean solar noon ignores the
 * equation of time (±16 min) and mean lunar motion ignores orbital
 * eccentricity (±40 min), so windows land within about an hour — in family
 * with the phase math above ("accurate to ~1 day, plenty for fishing") since
 * the windows they anchor are 1.5-2.5 h wide.
 *
 * Returns every major/minor within ±1.5 days so hour-by-hour scoring can
 * measure distance to the nearest one without day-boundary edge cases.
 */
export function solunarTimes(date: Date, longitude: number): SolunarTimes {
  const synodic = 29.53058867;
  const refNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const dayUtcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const solarNoon = dayUtcMidnight + (12 - longitude / 15) * 3600000;

  let frac = (((solarNoon - refNewMoon) / 86400000) % synodic) / synodic;
  if (frac < 0) frac += 1;

  const upperTransit = solarNoon + frac * LUNAR_DAY_MS;
  const majors: number[] = [];
  const minors: number[] = [];
  const windowLo = dayUtcMidnight - 1.5 * 86400000;
  const windowHi = dayUtcMidnight + 2.5 * 86400000;
  for (let k = -3; k <= 3; k += 1) {
    // Upper and lower transits, a half lunar day apart.
    for (const major of [upperTransit + k * LUNAR_DAY_MS, upperTransit + (k - 0.5) * LUNAR_DAY_MS]) {
      if (major >= windowLo && major <= windowHi) majors.push(major);
      // Rise/set sit roughly midway between consecutive transits.
      const minor = major + LUNAR_DAY_MS / 4;
      if (minor >= windowLo && minor <= windowHi) minors.push(minor);
    }
  }
  return { majors, minors };
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

export interface SunTimes {
  /** "HH:MM" device-local, or '—' for polar day/night. */
  sunrise: string;
  sunset: string;
  /** Epoch ms, null when the sun never rises/sets that day. */
  sunriseMs: number | null;
  sunsetMs: number | null;
}

/**
 * Local sunrise/sunset for a date and location (classic Almanac algorithm,
 * accurate to a minute or two — plenty for feeding windows). Computed locally
 * because the NWS forecast grid doesn't include sun times. Pass the spot's
 * IANA `timeZone` (from the NWS point lookup) so the clock times read in the
 * spot's zone even when the angler plans from another one.
 */
export function sunTimes(
  date: Date,
  latitude: number,
  longitude: number,
  timeZone?: string,
): SunTimes {
  const rise = sunEvent(date, latitude, longitude, true);
  const set = sunEvent(date, latitude, longitude, false);
  return {
    sunrise: fmtLocal(rise, timeZone),
    sunset: fmtLocal(set, timeZone),
    sunriseMs: rise ? rise.getTime() : null,
    sunsetMs: set ? set.getTime() : null,
  };
}

function fmtLocal(d: Date | null, timeZone?: string): string {
  if (!d) return '—';
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone,
      }).format(d);
    } catch {
      // Unknown zone / no Intl data — fall through to device-local.
    }
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function sunEvent(date: Date, lat: number, lon: number, rising: boolean): Date | null {
  const rad = Math.PI / 180;
  const zenith = 90.833; // official sunrise/sunset incl. refraction

  // Day of year.
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const n = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;

  const lngHour = lon / 15;
  const t = rising ? n + (6 - lngHour) / 24 : n + (18 - lngHour) / 24;

  // Sun's mean anomaly, then true longitude.
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
  L = ((L % 360) + 360) % 360;

  // Right ascension, aligned to L's quadrant, converted to hours.
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;

  // Declination and local hour angle.
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) /
    (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null; // sun never rises/sets today

  const H = (rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = (((T - lngHour) % 24) + 24) % 24;

  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(utcMidnight + UT * 3600000);
}
