import type { Coordinates, WaterConditions, WaterType } from '@/types';
import { round } from '@/utils/format';
import { addDays, localDateStr } from '@/utils/dates';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

interface OpenMeteoMarineWeek {
  hourly?: {
    time: string[];
    sea_surface_temperature: number[];
    wave_height: number[];
  };
}

/**
 * Water-surface conditions for each day of the outlook.
 *
 * Saltwater: pulls measured sea-surface temperature and wave height from the
 * Open-Meteo Marine API (no key), sampled at midday per day. Freshwater (or
 * when the marine grid has no coverage): estimates water temp from air temp.
 *
 * `airTempByDay` aligns 1:1 with the requested days and drives the freshwater
 * estimate / fallback.
 */
export async function fetchWeekWater(
  coords: Coordinates,
  waterType: WaterType,
  airTempByDay: number[],
): Promise<WaterConditions[]> {
  const days = airTempByDay.length;

  if (waterType === 'saltwater') {
    try {
      const marine = await fetchMarineWeek(coords, days);
      return airTempByDay.map((airTemp, d) => {
        const m = marine[d];
        if (m && m.waterTempF != null) {
          return {
            waterTempF: round(m.waterTempF),
            isEstimated: false,
            waveHeightFt: m.waveHeightFt,
          };
        }
        return estimate(airTemp);
      });
    } catch {
      // Fall through to estimates below.
    }
  }

  return airTempByDay.map((airTemp) => estimate(airTemp));
}

function estimate(airTempF: number): WaterConditions {
  return {
    waterTempF: round(estimateWaterTemp(airTempF)),
    isEstimated: true,
    waveHeightFt: null,
  };
}

async function fetchMarineWeek(
  coords: Coordinates,
  days: number,
): Promise<Array<{ waterTempF: number | null; waveHeightFt: number | null }>> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    hourly: 'sea_surface_temperature,wave_height',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: String(Math.min(days, 7)),
  });
  const res = await fetch(`${MARINE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Marine request failed (${res.status}).`);
  const data = (await res.json()) as OpenMeteoMarineWeek;
  const h = data.hourly;
  if (!h) throw new Error('Marine response missing hourly data.');

  const base = new Date(`${h.time[0]?.slice(0, 10)}T00:00`);
  const result: Array<{ waterTempF: number | null; waveHeightFt: number | null }> = [];
  for (let d = 0; d < days; d += 1) {
    const dateStr = localDateStr(addDays(base, d));
    const idx = h.time.findIndex((t) => t === `${dateStr}T12:00`);
    const sst = idx >= 0 ? h.sea_surface_temperature[idx] : undefined;
    const wave = idx >= 0 ? h.wave_height[idx] : undefined;
    result.push({
      waterTempF: sst == null ? null : sst,
      waveHeightFt: wave == null ? null : round(wave * 3.28084, 1),
    });
  }
  return result;
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
