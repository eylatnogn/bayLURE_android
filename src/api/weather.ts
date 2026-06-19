import type { Coordinates, SkyCondition, WeatherConditions } from '@/types';
import {
  degreesToCompass,
  hpaToInHg,
  pressureTrendFromChange,
  round,
  weatherCodeLabel,
} from '@/utils/format';
import { moonInfo, timeOfDay } from '@/utils/astro';
import { addDays, localDateStr } from '@/utils/dates';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 7;

interface Hourly {
  time: string[];
  temperature_2m: number[];
  surface_pressure: number[];
  relative_humidity_2m: number[];
  cloud_cover: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  wind_direction_10m: number[];
  weather_code: number[];
  is_day: number[];
}

interface OpenMeteoForecast {
  current?: { time: string };
  hourly?: Hourly;
  daily?: { time: string[]; sunrise: string[]; sunset: string[] };
}

function skyFromCloudCover(pct: number): SkyCondition {
  if (pct < 30) return 'clear';
  if (pct < 70) return 'partly_cloudy';
  return 'overcast';
}

/**
 * Fetch a 7-day weather outlook from Open-Meteo (no API key). Returns one
 * WeatherConditions per day (index 0 = today). Today uses the live "current"
 * reading; future days use that day's midday (noon) snapshot, which is a
 * reasonable single-number stand-in for a day's fishing outlook.
 */
export async function fetchWeekWeather(
  coords: Coordinates,
): Promise<WeatherConditions[]> {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    // We only need current.time as the "now" anchor; the value is unused.
    current: 'temperature_2m',
    hourly:
      'temperature_2m,relative_humidity_2m,is_day,surface_pressure,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code',
    daily: 'sunrise,sunset',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    past_days: '1',
    forecast_days: String(FORECAST_DAYS),
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status}).`);
  const data = (await res.json()) as OpenMeteoForecast;
  const hourly = data.hourly;
  const nowTime = data.current?.time;
  if (!hourly || !nowTime) {
    throw new Error('Weather response was missing hourly data.');
  }

  const base = new Date(nowTime);
  const out: WeatherConditions[] = [];
  for (let d = 0; d < FORECAST_DAYS; d += 1) {
    const date = addDays(base, d);
    const dateStr = localDateStr(date);
    // Today: anchor on "now"; future days: anchor on noon.
    const anchorKey = d === 0 ? nowTime : `${dateStr}T12:00`;
    const idx = nearestTimeIndex(hourly.time, anchorKey);
    if (idx < 0) continue;
    out.push(buildDay(hourly, idx, date, dateStr, data.daily));
  }
  return out;
}

function buildDay(
  h: Hourly,
  idx: number,
  date: Date,
  dateStr: string,
  daily: OpenMeteoForecast['daily'],
): WeatherConditions {
  const pastIdx = Math.max(0, idx - 3);
  const pressureNow = h.surface_pressure[idx] ?? 1013;
  const pressurePast = h.surface_pressure[pastIdx] ?? pressureNow;
  const pressureChangeInHg = hpaToInHg(pressureNow - pressurePast);

  const cloud = h.cloud_cover[idx] ?? 0;
  const windDir = h.wind_direction_10m[idx] ?? 0;
  const moon = moonInfo(date);

  const dayIdx = daily?.time.findIndex((t) => t === dateStr) ?? -1;
  const sunrise = timeOfDay(daily?.sunrise[dayIdx >= 0 ? dayIdx : 0]);
  const sunset = timeOfDay(daily?.sunset[dayIdx >= 0 ? dayIdx : 0]);

  return {
    airTempF: round(h.temperature_2m[idx] ?? 0),
    pressureHpa: round(pressureNow, 1),
    pressureInHg: round(hpaToInHg(pressureNow), 2),
    pressureChangeInHg: round(pressureChangeInHg, 2),
    pressureTrend: pressureTrendFromChange(pressureChangeInHg),
    windMph: round(h.wind_speed_10m[idx] ?? 0),
    windGustMph: round(h.wind_gusts_10m[idx] ?? 0),
    windDirectionDeg: round(windDir),
    windDirectionLabel: degreesToCompass(windDir),
    cloudCoverPct: round(cloud),
    sky: skyFromCloudCover(cloud),
    humidityPct: round(h.relative_humidity_2m[idx] ?? 0),
    isDay: (h.is_day[idx] ?? 1) === 1,
    weatherCode: h.weather_code[idx] ?? 0,
    weatherLabel: weatherCodeLabel(h.weather_code[idx] ?? 0),
    sunrise,
    sunset,
    moonPhase: moon.phase,
    moonIllumPct: moon.illuminationPct,
    moonMajor: moon.major,
  };
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
