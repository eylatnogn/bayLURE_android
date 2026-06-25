import type { Coordinates, TideConditions, TideEvent } from '@/types';
import { distanceMiles, round } from '@/utils/format';
import { addDays, localDateStr, yyyymmdd } from '@/utils/dates';

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

/**
 * Best-effort guess of whether a spot is saltwater: NOAA tide-prediction
 * stations sit on coasts and tidal rivers, so a station within ~12 mi means
 * the water is tidal (salt/brackish). Lakes and inland rivers have none nearby.
 * Great Lakes have no tide predictions, so they correctly read as freshwater.
 * Falls back to false (freshwater) on any error or outside the US.
 */
export async function isLikelySaltwater(coords: Coordinates): Promise<boolean> {
  try {
    const stations = await loadStations();
    const nearest = nearestStation(coords, stations);
    return !!nearest && nearest.distanceMi <= 12;
  } catch {
    return false;
  }
}

/**
 * Nearest-station high/low tide predictions for each of the next `days` days.
 * Each entry's `state` is derived relative to that day's reference time (now
 * for today, midday for future days). Returns an array of nulls when no usable
 * station is within range (e.g. far inland).
 */
export async function fetchWeekTides(
  coords: Coordinates,
  days: number,
): Promise<(TideConditions | null)[]> {
  const empty = new Array<TideConditions | null>(days).fill(null);
  const stations = await loadStations();
  const nearest = nearestStation(coords, stations);
  if (!nearest || nearest.distanceMi > 75) return empty;

  const base = new Date();
  const params = new URLSearchParams({
    product: 'predictions',
    application: 'bayLURE',
    begin_date: yyyymmdd(base),
    end_date: yyyymmdd(addDays(base, days - 1)),
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
  if (data.error || !data.predictions) return empty;

  const events: TideEvent[] = data.predictions.map((p) => ({
    time: p.t,
    type: p.type === 'H' ? 'high' : 'low',
    heightFt: round(Number(p.v), 1),
  }));

  const meta = {
    stationId: nearest.station.id,
    stationName: nearest.station.name,
    stationDistanceMi: round(nearest.distanceMi, 1),
  };

  const out: (TideConditions | null)[] = [];
  for (let d = 0; d < days; d += 1) {
    const dateStr = localDateStr(addDays(base, d));
    const dayEvents = events.filter((e) => e.time.slice(0, 10) === dateStr);
    // Reference: "now" for today, this day's noon for future days.
    const refMs = d === 0 ? Date.now() : new Date(`${dateStr}T12:00`).getTime();
    const { state, nextEvent } = deriveTideState(events, refMs);
    out.push({ ...meta, events: dayEvents, state, nextEvent });
  }
  return out;
}

/** Tide state at an arbitrary moment, from a day's hi/lo events. */
export function tideStateAt(
  events: TideEvent[],
  refMs: number,
): TideConditions['state'] {
  return deriveTideState(events, refMs).state;
}

/**
 * Tide state plus the next hi/lo at an arbitrary moment — used to recompute the
 * displayed tide when the user scrubs to a specific hour of the day.
 */
export function tideAt(
  events: TideEvent[],
  refMs: number,
): { state: TideConditions['state']; nextEvent: TideEvent | null } {
  return deriveTideState(events, refMs);
}

function deriveTideState(
  events: TideEvent[],
  refMs: number,
): { state: TideConditions['state']; nextEvent: TideEvent | null } {
  const upcoming = events.find((e) => new Date(e.time).getTime() > refMs) ?? null;
  if (!upcoming) return { state: 'unknown', nextEvent: null };

  const minutesToNext = (new Date(upcoming.time).getTime() - refMs) / 60000;
  // Within ~45 minutes of a high or low, water is effectively slack.
  if (minutesToNext < 45) return { state: 'slack', nextEvent: upcoming };

  // Heading toward a high = water rising (incoming); toward a low = outgoing.
  return {
    state: upcoming.type === 'high' ? 'incoming' : 'outgoing',
    nextEvent: upcoming,
  };
}
