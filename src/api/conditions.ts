import type {
  ChartedDepth,
  RiverFlow,
  Conditions,
  Coordinates,
  PressureLevel,
  Species,
  StructureType,
  WaterClarity,
  WaterDepth,
  WaterType,
} from '@/types';
import { fetchWeekWeather, FORECAST_DAYS } from '@/api/weather';
import { fetchWeekWater } from '@/api/marine';
import { fetchWeekTides } from '@/api/tides';
import { fetchChartedDepth } from '@/api/bathymetry';
import { fetchRiverFlow } from '@/api/flow';
import { addDays, localDateStr } from '@/utils/dates';

export interface ConditionsRequest {
  coordinates: Coordinates;
  waterType: WaterType;
  species: Species[];
  structures: StructureType[];
  pressureLevel: PressureLevel;
  clarity: WaterClarity;
  depth: WaterDepth;
}

/**
 * A live data source that failed this fetch, so the reading it feeds is now
 * estimated or missing. Surfaced to the angler as a calm "some data is
 * temporarily unavailable" notice (see HomeScreen). Weather is intentionally
 * excluded: it's required, so its failure aborts the whole analysis as a hard
 * error rather than a degraded read.
 */
export interface SourceOutage {
  key: 'tides' | 'waterTemp' | 'depth';
  /** What the angler loses, in their terms. */
  label: string;
  /** Who provides it — so "is it them or my connection?" is answered up front. */
  source: string;
}

const TIDES_OUTAGE: SourceOutage = {
  key: 'tides',
  label: 'Tide predictions',
  source: 'NOAA Tides & Currents',
};
const WATER_TEMP_OUTAGE: SourceOutage = {
  key: 'waterTemp',
  label: 'Measured water temperature',
  source: 'NOAA Tides & Currents',
};
const DEPTH_OUTAGE: SourceOutage = {
  key: 'depth',
  label: 'Charted water depth',
  source: 'NOAA NCEI',
};

// The network results depend only on coordinates + waterType — never on the
// angler's species/cover/clarity/depth/pressure picks. We cache them so that
// re-analyzing after a refinement tweak (now automatic) doesn't re-hit the
// NWS/NOAA services needlessly. Short TTL keeps the weather fresh enough.
interface CachedFetch {
  at: number;
  fetchedAt: string;
  week: Awaited<ReturnType<typeof fetchWeekWeather>>;
  water: Awaited<ReturnType<typeof fetchWeekWater>>['days'];
  tides: Conditions['tide'][];
  chartedDepth: ChartedDepth | null;
  flow: RiverFlow | null;
  outages: SourceOutage[];
}

const FETCH_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 24;
const fetchCache = new Map<string, CachedFetch>();

function cacheKey(c: Coordinates, waterType: WaterType): string {
  return `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)},${waterType}`;
}

async function getFetched(req: ConditionsRequest): Promise<CachedFetch> {
  const key = cacheKey(req.coordinates, req.waterType);
  const hit = fetchCache.get(key);
  if (hit && Date.now() - hit.at < FETCH_TTL_MS) return hit;

  const week = await fetchWeekWeather(req.coordinates);
  const days = week.days.length;
  const emptyTides = () => new Array<Conditions['tide']>(days).fill(null);
  const [water, tidesRes, depthRes, flow] = await Promise.all([
    fetchWeekWater(
      req.coordinates,
      req.waterType,
      week.days.map((w) => w.airTempF),
      week.waveHeightFtByDay,
    ),
    req.waterType === 'saltwater'
      ? fetchWeekTides(req.coordinates, days)
          .then((tides) => ({ tides, failed: false }))
          .catch(() => ({ tides: emptyTides(), failed: true }))
      : Promise.resolve({ tides: emptyTides(), failed: false }),
    // A location attribute, not per-day; fetched once and shared across days.
    fetchChartedDepth(req.coordinates)
      .then((chartedDepth) => ({ chartedDepth, failed: false }))
      .catch(() => ({ chartedDepth: null as ChartedDepth | null, failed: true })),
    // River flow (freshwater only): best-effort — most spots have no gauge in
    // range, and the score only reads it when the angler is fishing current.
    req.waterType === 'freshwater'
      ? fetchRiverFlow(req.coordinates).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Record which sources came up short so the UI can tell the angler why a read
  // is estimated or missing — and reassure them it isn't their connection.
  const outages: SourceOutage[] = [];
  if (req.waterType === 'saltwater' && water.measuredUnavailable) {
    outages.push(WATER_TEMP_OUTAGE);
  }
  if (tidesRes.failed) outages.push(TIDES_OUTAGE);
  if (depthRes.failed) outages.push(DEPTH_OUTAGE);

  const entry: CachedFetch = {
    at: Date.now(),
    fetchedAt: new Date().toISOString(),
    week,
    water: water.days,
    tides: tidesRes.tides,
    chartedDepth: depthRes.chartedDepth,
    flow,
    outages,
  };
  fetchCache.set(key, entry);
  // Keep the cache from growing without bound across many spots.
  if (fetchCache.size > MAX_CACHE_ENTRIES) {
    const oldest = fetchCache.keys().next().value;
    if (oldest !== undefined) fetchCache.delete(oldest);
  }
  return entry;
}

export interface ForecastResult {
  /** One Conditions per day (index 0 = today). */
  days: Conditions[];
  /** Live sources that failed this run; empty when everything came through. */
  outages: SourceOutage[];
}

/**
 * Gather a 7-day outlook: one Conditions per day (index 0 = today). Weather is
 * required; water and tides degrade gracefully (estimated water temp, null
 * tides) so a single upstream hiccup never blanks the screen — and any source
 * that failed is reported in `outages` so the UI can say so. Network results
 * are cached by location so refinement-only re-runs don't re-fetch.
 */
export async function gatherForecast(
  req: ConditionsRequest,
): Promise<ForecastResult> {
  const { week, water, tides, chartedDepth, flow, fetchedAt, outages } =
    await getFetched(req);

  const base = new Date();

  const days = week.days.map((weather, d) => ({
    coordinates: req.coordinates,
    waterType: req.waterType,
    species: req.species,
    structures: req.structures,
    pressureLevel: req.pressureLevel,
    clarity: req.clarity,
    depth: req.depth,
    date: localDateStr(addDays(base, d)),
    dayOffset: d,
    fetchedAt,
    weather,
    hourlyWeather: week.hourly[d] ?? [],
    water: water[d] ?? { waterTempF: 0, isEstimated: true, waveHeightFt: null },
    chartedDepth,
    tide: tides[d] ?? null,
    flow,
  }));

  return { days, outages };
}

export { FORECAST_DAYS };
