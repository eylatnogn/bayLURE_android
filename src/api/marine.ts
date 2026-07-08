import type { Coordinates, WaterConditions, WaterType } from '@/types';
import { distanceMiles, round } from '@/utils/format';

// NOAA CO-OPS runs ~240 coastal + Great Lakes stations that report measured
// water temperature. US-government data: free, no key, commercial use OK.
const STATIONS_URL =
  'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=watertemp';
const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

/** Beyond this, a station's reading stops being representative of the spot. */
const MAX_STATION_MILES = 60;

interface TempStation {
  id: string;
  lat: number;
  lng: number;
}

// The station list is static for practical purposes; fetch once per session.
let stationsPromise: Promise<TempStation[]> | null = null;
function loadStations(): Promise<TempStation[]> {
  if (!stationsPromise) {
    stationsPromise = (async () => {
      const res = await fetch(STATIONS_URL);
      if (!res.ok) throw new Error(`Station list failed (${res.status}).`);
      const data = (await res.json()) as {
        stations?: Array<{ id?: string; lat?: number; lng?: number }>;
      };
      return (data.stations ?? [])
        .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map((s) => ({ id: s.id as string, lat: s.lat as number, lng: s.lng as number }));
    })();
    // Let a transient failure retry on the next analysis.
    stationsPromise.catch(() => {
      stationsPromise = null;
    });
  }
  return stationsPromise;
}

/** Latest measured water temp (°F) from the nearest station, or null. */
async function fetchMeasuredWaterTempF(coords: Coordinates): Promise<number | null> {
  const stations = await loadStations();
  let best: TempStation | null = null;
  let bestMiles = Infinity;
  for (const s of stations) {
    const d = distanceMiles(coords, { latitude: s.lat, longitude: s.lng });
    if (d < bestMiles) {
      bestMiles = d;
      best = s;
    }
  }
  if (!best || bestMiles > MAX_STATION_MILES) return null;

  const params = new URLSearchParams({
    product: 'water_temperature',
    date: 'latest',
    station: best.id,
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
  });
  const res = await fetch(`${DATA_URL}?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: Array<{ v?: string }> };
  const v = Number(data.data?.[0]?.v);
  return Number.isFinite(v) ? v : null;
}

/**
 * Water-surface conditions for each day of the outlook.
 *
 * Saltwater: the latest measured reading from the nearest NOAA CO-OPS water
 * temperature station (sea-surface temp moves slowly, so one measurement
 * stands in for the whole outlook). Freshwater, or when no station is near:
 * estimates water temp from air temp, flagged as an estimate.
 *
 * `airTempByDay` aligns 1:1 with the requested days and drives the estimate.
 * `waveHeightFtByDay` comes from the NWS forecast grid (coastal grids only).
 */
export async function fetchWeekWater(
  coords: Coordinates,
  waterType: WaterType,
  airTempByDay: number[],
  waveHeightFtByDay?: Array<number | null>,
): Promise<WaterConditions[]> {
  const waveAt = (d: number) => waveHeightFtByDay?.[d] ?? null;

  if (waterType === 'saltwater') {
    try {
      const measured = await fetchMeasuredWaterTempF(coords);
      if (measured != null) {
        return airTempByDay.map((_, d) => ({
          waterTempF: round(measured),
          isEstimated: false,
          waveHeightFt: waveAt(d),
        }));
      }
    } catch {
      // Fall through to estimates below.
    }
  }

  return airTempByDay.map((airTemp, d) => ({
    ...estimate(airTemp),
    waveHeightFt: waveAt(d),
  }));
}

function estimate(airTempF: number): WaterConditions {
  return {
    waterTempF: round(estimateWaterTemp(airTempF)),
    isEstimated: true,
    waveHeightFt: null,
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
