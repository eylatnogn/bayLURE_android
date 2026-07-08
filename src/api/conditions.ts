import type {
  ChartedDepth,
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

// The network results depend only on coordinates + waterType — never on the
// angler's species/cover/clarity/depth/pressure picks. We cache them so that
// re-analyzing after a refinement tweak (now automatic) doesn't re-hit the
// NWS/NOAA services needlessly. Short TTL keeps the weather fresh enough.
interface CachedFetch {
  at: number;
  fetchedAt: string;
  week: Awaited<ReturnType<typeof fetchWeekWeather>>;
  water: Awaited<ReturnType<typeof fetchWeekWater>>;
  tides: Conditions['tide'][];
  chartedDepth: ChartedDepth | null;
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
  const [water, tides, chartedDepth] = await Promise.all([
    fetchWeekWater(
      req.coordinates,
      req.waterType,
      week.days.map((w) => w.airTempF),
      week.waveHeightFtByDay,
    ),
    req.waterType === 'saltwater'
      ? fetchWeekTides(req.coordinates, days).catch(() => new Array(days).fill(null))
      : Promise.resolve(new Array(days).fill(null)),
    // A location attribute, not per-day; fetched once and shared across days.
    fetchChartedDepth(req.coordinates).catch(() => null),
  ]);

  const entry: CachedFetch = {
    at: Date.now(),
    fetchedAt: new Date().toISOString(),
    week,
    water,
    tides,
    chartedDepth,
  };
  fetchCache.set(key, entry);
  // Keep the cache from growing without bound across many spots.
  if (fetchCache.size > MAX_CACHE_ENTRIES) {
    const oldest = fetchCache.keys().next().value;
    if (oldest !== undefined) fetchCache.delete(oldest);
  }
  return entry;
}

/**
 * Gather a 7-day outlook: one Conditions per day (index 0 = today). Weather is
 * required; water and tides degrade gracefully (estimated water temp, null
 * tides) so a single upstream hiccup never blanks the screen. Network results
 * are cached by location so refinement-only re-runs don't re-fetch.
 */
export async function gatherForecast(
  req: ConditionsRequest,
): Promise<Conditions[]> {
  const { week, water, tides, chartedDepth, fetchedAt } = await getFetched(req);

  const base = new Date();

  return week.days.map((weather, d) => ({
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
  }));
}

export { FORECAST_DAYS };
