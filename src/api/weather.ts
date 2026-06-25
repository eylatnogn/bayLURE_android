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

/**
 * Open-Meteo shares a per-IP rate limit with the map's wind overlay, so a burst
 * of map panning can briefly use up the quota. Retry a 429 (or transient 5xx) a
 * couple of times with backoff before surfacing a friendly error.
 */
async function fetchForecastWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url);
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i === attempts - 1) {
      if (res.status === 429) {
        throw new Error(
          'Weather service is busy right now (rate limited). Wait a minute and try again.',
        );
      }
      throw new Error(`Weather request failed (${res.status}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
  }
  // Unreachable — the loop either returns a response or throws.
  throw new Error('Weather request failed.');
}

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

export interface WeekWeather {
  /** One representative snapshot per day (index 0 = today). */
  days: WeatherConditions[];
  /** Per-day hourly snapshots (hourly[d] aligns with days[d]). */
  hourly: WeatherConditions[][];
}

/**
 * Fetch a 7-day weather outlook from Open-Meteo (no API key). Returns one
 * representative WeatherConditions per day plus the per-hour snapshots used to
 * grade the bite by the hour. Today's representative snapshot anchors on "now";
 * future days anchor on midday.
 */
export async function fetchWeekWeather(
  coords: Coordinates,
): Promise<WeekWeather> {
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

  const res = await fetchForecastWithRetry(`${FORECAST_URL}?${params.toString()}`);
  const data = (await res.json()) as OpenMeteoForecast;
  const hourly = data.hourly;
  const nowTime = data.current?.time;
  if (!hourly || !nowTime) {
    throw new Error('Weather response was missing hourly data.');
  }

  const base = new Date(nowTime);
  const nowMs = base.getTime();
  const days: WeatherConditions[] = [];
  const hourlyByDay: WeatherConditions[][] = [];

  for (let d = 0; d < FORECAST_DAYS; d += 1) {
    const date = addDays(base, d);
    const dateStr = localDateStr(date);
    // Representative snapshot: today anchors on "now", future days on noon.
    const anchorKey = d === 0 ? nowTime : `${dateStr}T12:00`;
    const idx = nearestTimeIndex(hourly.time, anchorKey);
    if (idx < 0) continue;
    days.push(buildDay(hourly, idx, date, dateStr, data.daily));

    // Per-hour snapshots for this date (today: from the current hour onward).
    const hours: WeatherConditions[] = [];
    for (let i = 0; i < hourly.time.length; i += 1) {
      const t = hourly.time[i];
      if (!t || t.slice(0, 10) !== dateStr) continue;
      if (d === 0 && new Date(t).getTime() < nowMs - 30 * 60 * 1000) continue;
      hours.push(buildDay(hourly, i, date, dateStr, data.daily));
    }
    hourlyByDay.push(hours);
  }
  return { days, hourly: hourlyByDay };
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
    timeISO: h.time[idx] ?? dateStr,
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
