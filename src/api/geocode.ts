import type { Coordinates } from '@/types';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
// FCC Area API (point -> US state): US-government data, free, no key,
// commercial OK, and CORS-enabled so it also works in the web build (the
// Census geocoder blocks browser requests).
const FCC_AREA_URL = 'https://geo.fcc.gov/api/census/area';

export interface GeocodeResult {
  coordinates: Coordinates;
  label: string;
}

export interface Region {
  /** Full state/region name, e.g. "Florida". May be empty. */
  state: string;
  /** ISO country code, e.g. "us". May be empty. */
  countryCode: string;
}

// A point's state/country doesn't change, so cache it indefinitely (for the
// session); auto-analyze would otherwise call this on every re-run.
const regionCache = new Map<string, Region>();

/**
 * Reverse-geocode coordinates to a US state (for the regulations lookup) via
 * the FCC Area API. Regulations only exist for US states, so a point outside
 * the US simply resolves to an empty region.
 */
export async function reverseRegion(coords: Coordinates): Promise<Region> {
  const key = `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
  const cached = regionCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    format: 'json',
  });
  const res = await fetch(`${FCC_AREA_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Region lookup failed (${res.status}).`);
  const data = (await res.json()) as {
    results?: Array<{ state_name?: string }>;
  };
  const stateName = data.results?.[0]?.state_name ?? '';
  const region: Region = {
    state: stateName,
    countryCode: stateName ? 'us' : '',
  };
  regionCache.set(key, region);
  return region;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

/**
 * Turn a free-text address or ZIP/postal code into coordinates using the
 * OpenStreetMap Nominatim service (free, no API key). Handles full street
 * addresses, "City, State", and bare postal codes alike.
 *
 * Returns null when nothing matches. Throws on network/HTTP failure so the
 * caller can show a message.
 *
 * Note: Nominatim's usage policy asks for <= 1 request/sec and a valid
 * identifier. For a shipping app, run your own geocoder or a keyed provider.
 */
export async function geocodeQuery(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    // The app's data sources (NWS, NOAA, state regs) are US-only; without this
    // a bare ZIP like "32960" can match a European postal code.
    countrycodes: 'us',
    q,
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      // Honored on native; browsers drop this and send Origin/Referer instead.
      'User-Agent': 'bayLURE/0.3 (fishing app)',
    },
  });
  if (!res.ok) {
    throw new Error(`Address lookup failed (${res.status}).`);
  }

  const data = (await res.json()) as NominatimHit[];
  const top = data[0];
  if (!top) return null;

  const latitude = Number(top.lat);
  const longitude = Number(top.lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return {
    coordinates: { latitude, longitude },
    label: shortLabel(top),
  };
}

/** Build a concise "City, ST 00000" style label from the address parts. */
function shortLabel(hit: NominatimHit): string {
  const a = hit.address;
  if (a) {
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.county;
    const region = a.state ?? a.region;
    const parts = [city, region, a.postcode].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  // Fall back to the first couple of segments of the full display name.
  return hit.display_name.split(',').slice(0, 2).join(',').trim();
}
