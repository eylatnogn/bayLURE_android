import type { Coordinates, WaterConditions, WaterType } from '@/types';
import { round } from '@/utils/format';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

interface OpenMeteoMarine {
  current?: {
    sea_surface_temperature?: number;
    wave_height?: number;
  };
}

/**
 * Water-surface conditions.
 *
 * Saltwater: pulls measured sea-surface temperature and wave height from the
 * Open-Meteo Marine API (no key). Freshwater (or when the marine grid has no
 * coverage): estimates water temperature from air temperature.
 */
export async function fetchWater(
  coords: Coordinates,
  waterType: WaterType,
  airTempF: number,
): Promise<WaterConditions> {
  if (waterType === 'saltwater') {
    try {
      const marine = await fetchMarine(coords);
      if (marine.waterTempF != null) {
        return {
          waterTempF: round(marine.waterTempF),
          isEstimated: false,
          waveHeightFt: marine.waveHeightFt,
        };
      }
    } catch {
      // Fall through to estimate below.
    }
  }

  return {
    waterTempF: round(estimateWaterTemp(airTempF)),
    isEstimated: true,
    waveHeightFt: null,
  };
}

async function fetchMarine(
  coords: Coordinates,
): Promise<{ waterTempF: number | null; waveHeightFt: number | null }> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: 'sea_surface_temperature,wave_height',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  });
  const res = await fetch(`${MARINE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Marine request failed (${res.status}).`);
  const data = (await res.json()) as OpenMeteoMarine;
  const sst = data.current?.sea_surface_temperature;
  const wave = data.current?.wave_height;
  return {
    waterTempF: sst == null ? null : sst,
    // Open-Meteo returns wave height in meters; convert to feet.
    waveHeightFt: wave == null ? null : round(wave * 3.28084, 1),
  };
}

/**
 * Rough freshwater surface-temp estimate. Surface water lags and dampens air
 * temperature: it sits closer to the daily mean and swings less than the air.
 * This is a usable approximation, not a measurement, and is flagged as such.
 */
function estimateWaterTemp(airTempF: number): number {
  const reference = 60; // seasonal anchor
  return reference + (airTempF - reference) * 0.6;
}
