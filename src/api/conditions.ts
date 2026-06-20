import type {
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
import { addDays, localDateStr } from '@/utils/dates';

export interface ConditionsRequest {
  coordinates: Coordinates;
  waterType: WaterType;
  species: Species;
  structures: StructureType[];
  pressureLevel: PressureLevel;
  clarity: WaterClarity;
  depth: WaterDepth;
}

/**
 * Gather a 7-day outlook: one Conditions per day (index 0 = today). Weather is
 * required; water and tides degrade gracefully (estimated water temp, null
 * tides) so a single upstream hiccup never blanks the screen.
 */
export async function gatherForecast(
  req: ConditionsRequest,
): Promise<Conditions[]> {
  const week = await fetchWeekWeather(req.coordinates);
  const days = week.days.length;

  const [water, tides] = await Promise.all([
    fetchWeekWater(req.coordinates, req.waterType, week.days.map((w) => w.airTempF)),
    req.waterType === 'saltwater'
      ? fetchWeekTides(req.coordinates, days).catch(() =>
          new Array(days).fill(null),
        )
      : Promise.resolve(new Array(days).fill(null)),
  ]);

  const base = new Date();
  const fetchedAt = base.toISOString();

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
    tide: tides[d] ?? null,
  }));
}

export { FORECAST_DAYS };
