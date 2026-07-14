import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinates, SkyCondition, WeatherConditions } from '@/types';
import {
  degreesToCompass,
  pressureTrendFromChange,
  round,
  weatherCodeLabel,
} from '@/utils/format';
import { moonInfo, sunTimes } from '@/utils/astro';
import { addDays, localDateStr } from '@/utils/dates';

const POINTS_URL = 'https://api.weather.gov/points';
export const FORECAST_DAYS = 7;

// The National Weather Service API (api.weather.gov) is US-government data:
// free, no key, commercial use OK. It asks callers to identify themselves via
// User-Agent; native fetch sends it, browsers strip it and send Origin, which
// NWS also accepts. Coverage is US + territories only.
const NWS_HEADERS = {
  Accept: 'application/geo+json',
  'User-Agent': 'bayLURE/1.0 (eybusiness@outlook.com)',
};

/** NWS occasionally 500s or rate-limits; retry briefly before surfacing. */
async function fetchNwsWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, { headers: NWS_HEADERS });
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i === attempts - 1) {
      throw new Error(`Weather request failed (${res.status}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
  }
  // Unreachable — the loop either returns a response or throws.
  throw new Error('Weather request failed.');
}

// The forecast grid run-length-encodes each field as {validTime, value} where
// validTime is "ISO/duration" (e.g. "2026-07-07T12:00:00+00:00/PT3H").
interface GridValue {
  validTime: string;
  value: number | null;
}
interface GridSeriesJson {
  uom?: string;
  values?: GridValue[];
}
interface GridProperties {
  temperature?: GridSeriesJson;
  pressure?: GridSeriesJson;
  skyCover?: GridSeriesJson;
  relativeHumidity?: GridSeriesJson;
  windSpeed?: GridSeriesJson;
  windGust?: GridSeriesJson;
  windDirection?: GridSeriesJson;
  probabilityOfPrecipitation?: GridSeriesJson;
  waveHeight?: GridSeriesJson;
  /** Categorical weather periods — the source for thunderstorm warnings. */
  weather?: {
    values?: Array<{
      validTime: string;
      value?: Array<{ weather?: string | null; coverage?: string | null }>;
    }>;
  };
}

/** A field expanded into a step function over epoch-ms intervals. */
interface Series {
  points: Array<{ start: number; end: number; value: number }>;
}

/** Parse the duration half of a validTime, e.g. "P1DT6H", "PT3H". */
function durationMs(validTime: string): number {
  const dur = validTime.split('/')[1] ?? 'PT1H';
  const m = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(dur);
  if (!m) return 3600000;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const minutes = Number(m[3] ?? 0);
  const ms = (days * 24 + hours) * 3600000 + minutes * 60000;
  return ms > 0 ? ms : 3600000;
}

function parseSeries(
  json: GridSeriesJson | undefined,
  convert: (v: number, uom: string) => number,
): Series {
  const uom = json?.uom ?? '';
  const points: Series['points'] = [];
  for (const entry of json?.values ?? []) {
    if (entry.value == null) continue;
    const start = new Date(entry.validTime.split('/')[0] ?? '').getTime();
    if (Number.isNaN(start)) continue;
    points.push({ start, end: start + durationMs(entry.validTime), value: convert(entry.value, uom) });
  }
  points.sort((a, b) => a.start - b.start);
  return { points };
}

/**
 * Sample the step function at a moment. Between entries (or past the field's
 * forecast horizon — pressure only extends ~3 days) the last known value
 * carries forward, which also gives a neutral "steady" trend out there.
 */
function valueAt(s: Series, ms: number): number | null {
  let carried: number | null = null;
  for (const p of s.points) {
    if (ms >= p.start && ms < p.end) return p.value;
    if (p.start <= ms) carried = p.value;
    else break;
  }
  if (carried != null) return carried;
  return s.points[0]?.value ?? null;
}

// Unit conversions keyed off the grid's `uom` strings.
function toF(v: number, uom: string): number {
  return uom.includes('degC') ? (v * 9) / 5 + 32 : v;
}
function toMph(v: number, uom: string): number {
  if (uom.includes('km_h')) return v * 0.621371;
  if (uom.includes('m_s')) return v * 2.23694;
  return v;
}
/** Pressure arrives with no uom; detect Pa / hPa / inHg by magnitude. */
function toInHg(v: number): number {
  if (v > 5000) return v * 0.0002953; // Pa
  if (v > 300) return v * 0.02953; // hPa
  return v; // already inHg
}
function toFt(v: number, uom: string): number {
  return uom.includes(':m') ? v * 3.28084 : v;
}
function asIs(v: number): number {
  return v;
}

/**
 * Expand the categorical `weather` grid into thunderstorm intervals. NWS lists
 * one or more phenomena per period; any mention of thunderstorms (unless the
 * coverage is explicitly "none") flags the whole period as a lightning risk.
 */
function parseThunder(
  json: GridProperties['weather'],
): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const entry of json?.values ?? []) {
    const hasThunder = (entry.value ?? []).some(
      (v) =>
        (v.weather ?? '').toLowerCase().includes('thunder') &&
        (v.coverage ?? '') !== 'none',
    );
    if (!hasThunder) continue;
    const start = new Date(entry.validTime.split('/')[0] ?? '').getTime();
    if (Number.isNaN(start)) continue;
    out.push({ start, end: start + durationMs(entry.validTime) });
  }
  return out;
}

function skyFromCloudCover(pct: number): SkyCondition {
  if (pct < 30) return 'clear';
  if (pct < 70) return 'partly_cloudy';
  return 'overcast';
}

/**
 * Hourly sea-level pressure FORECAST (converted to inHg) from MET Norway's
 * free Locationforecast API — keyless, global, CC-BY 4.0 (commercial use OK
 * with attribution; credited in the Guide tab + API_LICENSING.md). NWS grids
 * ship no pressure forecast at all, so this is what lets the pressure value
 * and trend look ahead across the whole week instead of holding "steady".
 * Hourly for ~2-3 days, then 6-hourly steps to ~9 days; each value carries to
 * the next entry. Best-effort: an empty series on any failure.
 */
const MET_NO_CACHE_PREFIX = 'balure.metno.v1.';
const MET_NO_CACHE_TTL_MS = 6 * 3600000;

function parseMetNoSeries(json: unknown): Series['points'] {
  const ts =
    (json as {
      properties?: {
        timeseries?: Array<{
          time?: string;
          data?: { instant?: { details?: { air_pressure_at_sea_level?: number | null } } };
        }>;
      };
    }).properties?.timeseries ?? [];
  const raw = ts
    .map((t) => ({
      ms: new Date(t.time ?? '').getTime(),
      hPa: t.data?.instant?.details?.air_pressure_at_sea_level,
    }))
    .filter((p): p is { ms: number; hPa: number } => !Number.isNaN(p.ms) && p.hPa != null)
    .sort((a, b) => a.ms - b.ms);
  return raw.map((p, i) => ({
    start: p.ms,
    end: raw[i + 1]?.ms ?? p.ms + 6 * 3600000,
    value: p.hPa * 0.02953,
  }));
}

async function fetchMetNoPressure(coords: Coordinates): Promise<Series> {
  // met.no asks for max 4 decimals and an identifying User-Agent.
  const lat = coords.latitude.toFixed(4);
  const lon = coords.longitude.toFixed(4);
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const cacheKey = `${MET_NO_CACHE_PREFIX}${lat},${lon}`;

  // Two attempts. The second drops our custom headers entirely — some native
  // HTTP stacks reject a fetch that sets User-Agent, and met.no answers 200
  // without one, so this recovers the whole feature on those devices.
  const headersFor = (attempt: number): Record<string, string> | undefined =>
    attempt === 0 ? { 'User-Agent': NWS_HEADERS['User-Agent'], Accept: 'application/json' } : undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, { headers: headersFor(attempt), signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const points = parseMetNoSeries(await res.json());
      if (points.length) {
        // Persist the good forecast so a later fetch that fails (flaky network,
        // transient block) reuses it instead of collapsing to one flat value.
        void AsyncStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), points })).catch(() => {});
        return { points };
      }
    } catch {
      // Fall through to the next attempt / the cache.
    }
  }

  // Every fetch failed — reuse a recent cached forecast if we have one.
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as { at?: number; points?: Series['points'] };
      if (
        cached?.points?.length &&
        typeof cached.at === 'number' &&
        Date.now() - cached.at < MET_NO_CACHE_TTL_MS
      ) {
        return { points: cached.points };
      }
    }
  } catch {
    // No usable cache.
  }
  return { points: [] };
}

/**
 * Latest real barometric reading (inHg) + ~3h change from the nearest NWS
 * observation station. NWS *forecast* grids usually ship an empty pressure
 * series (it isn't a standard forecast element), so without this the app
 * would show the 29.92 standard-atmosphere placeholder forever. Tries the
 * first few stations (some don't report pressure); null on any failure.
 */
async function fetchObservedPressure(
  stationsUrl: string | undefined,
): Promise<{ inHg: number; changeInHg: number } | null> {
  if (!stationsUrl) return null;
  try {
    const sRes = await fetchNwsWithRetry(stationsUrl);
    const sJson = (await sRes.json()) as { observationStations?: string[] };
    const stations = (sJson.observationStations ?? []).slice(0, 3);
    const nowMs = Date.now();
    for (const stationUrl of stations) {
      try {
        const readAt = async (query: string): Promise<{ ms: number; inHg: number } | null> => {
          const res = await fetchNwsWithRetry(`${stationUrl}/observations?${query}`);
          const json = (await res.json()) as {
            features?: Array<{
              properties?: {
                timestamp?: string;
                barometricPressure?: { value: number | null };
                seaLevelPressure?: { value: number | null };
              };
            }>;
          };
          for (const f of json.features ?? []) {
            const pa =
              f.properties?.seaLevelPressure?.value ??
              f.properties?.barometricPressure?.value;
            const ms = new Date(f.properties?.timestamp ?? '').getTime();
            if (pa != null && !Number.isNaN(ms)) return { ms, inHg: toInHg(pa) };
          }
          return null;
        };
        const latest = await readAt('limit=4');
        if (!latest) continue; // station without pressure — try the next one
        // A reading ~3h before the latest, for the rising/falling trend.
        const from = new Date(latest.ms - 4 * 3600000).toISOString();
        const to = new Date(latest.ms - 2.5 * 3600000).toISOString();
        const past = await readAt(
          `start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}&limit=4`,
        );
        // Stale stations (no reading in the last 3h) shouldn't pass as "now".
        if (nowMs - latest.ms > 3 * 3600000) continue;
        return { inHg: latest.inHg, changeInHg: past ? latest.inHg - past.inHg : 0 };
      } catch {
        // Try the next station.
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface WeekWeather {
  /** One representative snapshot per day (index 0 = today). */
  days: WeatherConditions[];
  /** Per-day hourly snapshots (hourly[d] aligns with days[d]). */
  hourly: WeatherConditions[][];
  /** Midday wave height per day, feet; null inland (no marine grid). */
  waveHeightFtByDay: Array<number | null>;
}

function isoHour(dateStr: string, hour: number): string {
  return `${dateStr}T${String(hour).padStart(2, '0')}:00`;
}

/**
 * Fetch a 7-day weather outlook from the National Weather Service forecast
 * grid (two requests: points -> gridpoints). Returns one representative
 * WeatherConditions per day plus the per-hour snapshots used to grade the bite
 * by the hour. Today's representative snapshot anchors on "now"; future days
 * anchor on midday. Sunrise/sunset and moon phase are computed locally.
 */
export async function fetchWeekWeather(coords: Coordinates): Promise<WeekWeather> {
  // NWS wants at most 4 decimal places on the point lookup.
  const lat = coords.latitude.toFixed(4);
  const lon = coords.longitude.toFixed(4);
  const pointsRes = await fetchNwsWithRetry(`${POINTS_URL}/${lat},${lon}`);
  const points = (await pointsRes.json()) as {
    properties?: { forecastGridData?: string; timeZone?: string; observationStations?: string };
  };
  const gridUrl = points.properties?.forecastGridData;
  const spotTimeZone = points.properties?.timeZone;
  if (!gridUrl) {
    throw new Error('This spot is outside NWS forecast coverage (US only).');
  }

  // Pressure rides along in parallel: the NWS grid's own pressure series is
  // usually empty, so met.no supplies the week's forecast curve and a real
  // station reading anchors "now" if that fails too.
  const [gridRes, metNoPressure, obsPressure] = await Promise.all([
    fetchNwsWithRetry(gridUrl),
    fetchMetNoPressure(coords),
    fetchObservedPressure(points.properties?.observationStations),
  ]);
  const grid = ((await gridRes.json()) as { properties?: GridProperties }).properties;
  if (!grid) throw new Error('Weather response was missing forecast data.');

  const temp = parseSeries(grid.temperature, toF);
  if (temp.points.length === 0) {
    throw new Error('Weather response was missing temperature data.');
  }
  const pressure = parseSeries(grid.pressure, toInHg);
  const sky = parseSeries(grid.skyCover, asIs);
  const humidity = parseSeries(grid.relativeHumidity, asIs);
  const wind = parseSeries(grid.windSpeed, toMph);
  const gust = parseSeries(grid.windGust, toMph);
  const windDir = parseSeries(grid.windDirection, asIs);
  const precipProb = parseSeries(grid.probabilityOfPrecipitation, asIs);
  const wave = parseSeries(grid.waveHeight, toFt);
  const thunderPeriods = parseThunder(grid.weather);
  const thunderAt = (ms: number) =>
    thunderPeriods.some((p) => ms >= p.start && ms < p.end);

  const base = new Date();
  const nowMs = base.getTime();

  function snap(ms: number, date: Date, timeISO: string): WeatherConditions {
    // Pressure source order: NWS grid (usually empty) -> met.no's hourly
    // forecast (whole week, real trend everywhere) -> the nearest station's
    // live reading (true ~3h trend near now, steady further out) -> 29.92.
    // The trend always pairs now/past from the SAME source, so a mixed read
    // never fabricates a rise or fall.
    // 6h tendency window: forecast pressure curves are smoother than live
    // barograph traces, so a 3h delta on a calm week rounds to "steady" every
    // day. Six hours (a standard barometric-tendency period) surfaces the real
    // slope without inventing movement.
    const TREND_MS = 6 * 3600000;
    const gridNow = valueAt(pressure, ms);
    const gridPast = valueAt(pressure, ms - TREND_MS);
    const metNow = valueAt(metNoPressure, ms);
    const metPast = valueAt(metNoPressure, ms - TREND_MS);
    const pInHg = gridNow ?? metNow ?? obsPressure?.inHg ?? 29.92;
    const change =
      gridNow != null && gridPast != null
        ? gridNow - gridPast
        : metNow != null && metPast != null
          ? metNow - metPast
          : obsPressure && Math.abs(ms - nowMs) < 6 * 3600000
            ? obsPressure.changeInHg
            : 0;

    const cloud = valueAt(sky, ms) ?? 0;
    const dir = valueAt(windDir, ms) ?? 0;
    const moon = moonInfo(date);
    const sun = sunTimes(date, coords.latitude, coords.longitude, spotTimeZone);
    const isDay =
      sun.sunriseMs != null && sun.sunsetMs != null
        ? ms >= sun.sunriseMs && ms < sun.sunsetMs
        : new Date(ms).getHours() >= 6 && new Date(ms).getHours() < 20;

    // Synthesize a WMO-style code (the labels the UI shows) from the
    // thunderstorm flag, precip probability, and cloud cover.
    const pop = valueAt(precipProb, ms) ?? 0;
    const thunder = thunderAt(ms);
    const code = thunder
      ? 95
      : pop >= 60 ? 63 : pop >= 35 ? 61 : cloud < 30 ? 0 : cloud < 70 ? 2 : 3;

    return {
      airTempF: round(valueAt(temp, ms) ?? 0),
      pressureHpa: round(pInHg / 0.02953, 1),
      pressureInHg: round(pInHg, 2),
      pressureChangeInHg: round(change, 2),
      pressureTrend: pressureTrendFromChange(change),
      windMph: round(valueAt(wind, ms) ?? 0),
      windGustMph: round(valueAt(gust, ms) ?? valueAt(wind, ms) ?? 0),
      windDirectionDeg: round(dir),
      windDirectionLabel: degreesToCompass(dir),
      cloudCoverPct: round(cloud),
      sky: skyFromCloudCover(cloud),
      humidityPct: round(valueAt(humidity, ms) ?? 0),
      precipChancePct: round(pop),
      thunder,
      isDay,
      weatherCode: code,
      weatherLabel: weatherCodeLabel(code),
      timeISO,
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      moonPhase: moon.phase,
      moonIllumPct: moon.illuminationPct,
      moonMajor: moon.major,
    };
  }

  const days: WeatherConditions[] = [];
  const hourlyByDay: WeatherConditions[][] = [];
  const waveHeightFtByDay: Array<number | null> = [];

  for (let d = 0; d < FORECAST_DAYS; d += 1) {
    const date = addDays(base, d);
    const dateStr = localDateStr(date);
    // Representative snapshot: today anchors on "now", future days on noon.
    const anchorISO = d === 0 ? isoHour(dateStr, base.getHours()) : isoHour(dateStr, 12);
    const anchorMs = d === 0 ? nowMs : new Date(anchorISO).getTime();
    days.push(snap(anchorMs, date, anchorISO));

    // Per-hour snapshots for this date (today: from the current hour onward).
    const hours: WeatherConditions[] = [];
    for (let h = 0; h < 24; h += 1) {
      const iso = isoHour(dateStr, h);
      const ms = new Date(iso).getTime();
      if (d === 0 && ms < nowMs - 30 * 60 * 1000) continue;
      hours.push(snap(ms, date, iso));
    }
    hourlyByDay.push(hours);

    const noonMs = new Date(isoHour(dateStr, 12)).getTime();
    const waveFt = wave.points.length > 0 ? valueAt(wave, noonMs) : null;
    waveHeightFtByDay.push(waveFt == null ? null : round(waveFt, 1));
  }

  return { days, hourly: hourlyByDay, waveHeightFtByDay };
}
