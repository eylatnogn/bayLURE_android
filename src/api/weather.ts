import type { Coordinates, SkyCondition, WeatherConditions } from '@/types';
import {
  degreesToCompass,
  hpaToInHg,
  pressureTrendFromChange,
  round,
  weatherCodeLabel,
} from '@/utils/format';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoForecast {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    is_day: number;
    surface_pressure: number;
    cloud_cover: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    weather_code: number;
  };
  hourly?: {
    time: string[];
    surface_pressure: number[];
  };
}

function skyFromCloudCover(pct: number): SkyCondition {
  if (pct < 30) return 'clear';
  if (pct < 70) return 'partly_cloudy';
  return 'overcast';
}

/**
 * Fetch current weather from Open-Meteo (no API key required).
 * Pressure trend is derived from the hourly surface_pressure series.
 */
export async function fetchWeather(
  coords: Coordinates,
): Promise<WeatherConditions> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current:
      'temperature_2m,relative_humidity_2m,is_day,surface_pressure,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code',
    hourly: 'surface_pressure',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '1',
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Weather request failed (${res.status}).`);
  }
  const data = (await res.json()) as OpenMeteoForecast;
  const current = data.current;
  if (!current) {
    throw new Error('Weather response was missing current conditions.');
  }

  const pressureChangeHpa = computePressureChange(data.hourly, current.time);
  const pressureChangeInHg = hpaToInHg(pressureChangeHpa);

  return {
    airTempF: round(current.temperature_2m),
    pressureHpa: round(current.surface_pressure, 1),
    pressureInHg: round(hpaToInHg(current.surface_pressure), 2),
    pressureChangeInHg: round(pressureChangeInHg, 2),
    pressureTrend: pressureTrendFromChange(pressureChangeInHg),
    windMph: round(current.wind_speed_10m),
    windGustMph: round(current.wind_gusts_10m),
    windDirectionDeg: round(current.wind_direction_10m),
    windDirectionLabel: degreesToCompass(current.wind_direction_10m),
    cloudCoverPct: round(current.cloud_cover),
    sky: skyFromCloudCover(current.cloud_cover),
    humidityPct: round(current.relative_humidity_2m),
    isDay: current.is_day === 1,
    weatherCode: current.weather_code,
    weatherLabel: weatherCodeLabel(current.weather_code),
  };
}

/** Change in pressure (hPa) over the ~3 hours leading up to `currentTime`. */
function computePressureChange(
  hourly: OpenMeteoForecast['hourly'],
  currentTime: string,
): number {
  if (!hourly || hourly.time.length === 0) return NaN;
  const nowIdx = nearestTimeIndex(hourly.time, currentTime);
  if (nowIdx < 0) return NaN;
  const pastIdx = Math.max(0, nowIdx - 3);
  const now = hourly.surface_pressure[nowIdx];
  const past = hourly.surface_pressure[pastIdx];
  if (now == null || past == null) return NaN;
  return now - past;
}

function nearestTimeIndex(times: string[], target: string): number {
  const targetMs = new Date(target).getTime();
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (!t) continue;
    const diff = Math.abs(new Date(t).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
