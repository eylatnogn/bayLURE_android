import type { Coordinates } from '@/types';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

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

/** Reverse-geocode coordinates to a state/region (for regulations lookup). */
export async function reverseRegion(coords: Coordinates): Promise<Region> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    zoom: '8',
    addressdetails: '1',
  });
  const res = await fetch(`${REVERSE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'bayLURE/0.3 (fishing app)' },
  });
  if (!res.ok) throw new Error(`Region lookup failed (${res.status}).`);
  const data = (await res.json()) as {
    address?: { state?: string; region?: string; country_code?: string };
  };
  return {
    state: data.address?.state ?? data.address?.region ?? '',
    countryCode: data.address?.country_code ?? '',
  };
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
