import type {
  Conditions,
  Coordinates,
  StructureType,
  WaterType,
} from '@/types';
import { fetchWeather } from '@/api/weather';
import { fetchWater } from '@/api/marine';
import { fetchTides } from '@/api/tides';

export interface ConditionsRequest {
  coordinates: Coordinates;
  waterType: WaterType;
  structures: StructureType[];
}

/**
 * Gather every input the strategy engine needs. Weather is required; water and
 * tides degrade gracefully (estimated water temp, null tides) so a single
 * upstream hiccup never blanks the whole screen.
 */
export async function gatherConditions(
  req: ConditionsRequest,
): Promise<Conditions> {
  const weather = await fetchWeather(req.coordinates);

  const [water, tide] = await Promise.all([
    fetchWater(req.coordinates, req.waterType, weather.airTempF),
    req.waterType === 'saltwater'
      ? fetchTides(req.coordinates).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    coordinates: req.coordinates,
    waterType: req.waterType,
    structures: req.structures,
    fetchedAt: new Date().toISOString(),
    weather,
    water,
    tide,
  };
}
