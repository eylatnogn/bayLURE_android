import type { PressureTrend } from '@/types';

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Convert wind direction in degrees to a 16-point compass label. */
export function degreesToCompass(deg: number): string {
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return COMPASS[idx] ?? 'N';
}

/** hPa -> inHg. */
export function hpaToInHg(hpa: number): number {
  return hpa * 0.02953;
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function pressureTrendFromChange(changeInHg: number): PressureTrend {
  if (Number.isNaN(changeInHg)) return 'unknown';
  if (changeInHg <= -0.04) return 'falling';
  if (changeInHg >= 0.04) return 'rising';
  return 'steady';
}

/** Haversine distance in miles between two coordinates. */
export function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 3958.8; // earth radius in miles
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** WMO weather interpretation codes -> short label. */
export function weatherCodeLabel(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ hail',
    99: 'Thunderstorm w/ hail',
  };
  return map[code] ?? 'Unknown';
}
