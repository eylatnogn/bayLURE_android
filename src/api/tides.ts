import type { Coordinates, TideConditions, TideEvent } from '@/types';
import { distanceMiles, round } from '@/utils/format';

const STATIONS_URL =
  'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions';
const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

interface StationMeta {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface StationsResponse {
  stations?: Array<{ id: string; name: string; lat: number; lng: number }>;
}

interface PredictionsResponse {
  predictions?: Array<{ t: string; v: string; type: 'H' | 'L' }>;
  error?: { message: string };
}

// NOAA's full tide-prediction station list is large and static; cache per session.
let stationCache: StationMeta[] | null = null;

async function loadStations(): Promise<StationMeta[]> {
  if (stationCache) return stationCache;
  const res = await fetch(STATIONS_URL);
  if (!res.ok) throw new Error(`Tide station list failed (${res.status}).`);
  const data = (await res.json()) as StationsResponse;
  stationCache = (data.stations ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));
  return stationCache;
}

function nearestStation(
  coords: Coordinates,
  stations: StationMeta[],
): { station: StationMeta; distanceMi: number } | null {
  let best: StationMeta | null = null;
  let bestDist = Infinity;
  for (const s of stations) {
    const d = distanceMiles(coords, { latitude: s.lat, longitude: s.lng });
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best ? { station: best, distanceMi: bestDist } : null;
}

function yyyymmdd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Nearest-station high/low tide predictions for today and derived tide state.
 * Returns null when no usable station is within range (e.g. far inland).
 */
export async function fetchTides(
  coords: Coordinates,
): Promise<TideConditions | null> {
  const stations = await loadStations();
  const nearest = nearestStation(coords, stations);
  if (!nearest) return null;
  // If the closest tide station is very far, the location is effectively inland.
  if (nearest.distanceMi > 75) return null;

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    product: 'predictions',
    application: 'bayLURE',
    // Fetch through tomorrow so there's always an upcoming high/low to derive
    // the tide state from, even late in the day.
    begin_date: yyyymmdd(today),
    end_date: yyyymmdd(tomorrow),
    datum: 'MLLW',
    station: nearest.station.id,
    time_zone: 'lst_ldt',
    units: 'english',
    interval: 'hilo',
    format: 'json',
  });

  const res = await fetch(`${DATA_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Tide predictions failed (${res.status}).`);
  const data = (await res.json()) as PredictionsResponse;
  if (data.error || !data.predictions) {
    return null;
  }

  const events: TideEvent[] = data.predictions.map((p) => ({
    time: p.t,
    type: p.type === 'H' ? 'high' : 'low',
    heightFt: round(Number(p.v), 1),
  }));

  const { state, nextEvent } = deriveTideState(events);

  return {
    stationId: nearest.station.id,
    stationName: nearest.station.name,
    stationDistanceMi: round(nearest.distanceMi, 1),
    events,
    state,
    nextEvent,
  };
}

function deriveTideState(events: TideEvent[]): {
  state: TideConditions['state'];
  nextEvent: TideEvent | null;
} {
  const now = Date.now();
  const upcoming = events.find((e) => new Date(e.time).getTime() > now) ?? null;
  if (!upcoming) return { state: 'unknown', nextEvent: null };

  const minutesToNext =
    (new Date(upcoming.time).getTime() - now) / 60000;
  // Within ~45 minutes of a high or low, water is effectively slack.
  if (minutesToNext < 45) return { state: 'slack', nextEvent: upcoming };

  // Heading toward a high = water rising (incoming); toward a low = outgoing.
  return {
    state: upcoming.type === 'high' ? 'incoming' : 'outgoing',
    nextEvent: upcoming,
  };
}
