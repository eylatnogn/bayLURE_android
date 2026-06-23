import type { ChartedDepth, Coordinates } from '@/types';
import { round } from '@/utils/format';

// Open-Topo-Data's public instance serves the GEBCO 2020 global grid (ocean
// bathymetry plus land/lake-surface topography) with no API key. Elevation is
// in meters; points below sea level come back negative, and that magnitude is
// the charted water depth at the location. Works the same for saltwater and
// freshwater requests — the grid simply has more below-surface coverage at sea.
const DEPTH_URL = 'https://api.opentopodata.org/v1/gebco2020';
const METERS_TO_FEET = 3.28084;

interface OpenTopoResponse {
  status: string;
  results?: Array<{ elevation: number | null }>;
}

/**
 * Charted bottom depth at a point, or null when the grid has no below-surface
 * reading there. GEBCO resolves open water and deeper bays well; shallow flats,
 * shorelines, and most inland lakes sit at/above sea level and return null —
 * for those the user's manually selected depth zone is the only depth signal.
 *
 * Throws on a network/HTTP failure so the caller can degrade gracefully, the
 * same way water temp and tides do.
 */
export async function fetchChartedDepth(
  coords: Coordinates,
): Promise<ChartedDepth | null> {
  const params = new URLSearchParams({
    locations: `${coords.latitude},${coords.longitude}`,
    interpolation: 'bilinear',
  });
  const res = await fetch(`${DEPTH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Depth lookup failed (${res.status}).`);
  const data = (await res.json()) as OpenTopoResponse;

  const elevationM = data.results?.[0]?.elevation;
  // Missing reading, or at/above sea level: no charted bottom depth here.
  if (elevationM == null || elevationM >= 0) return null;

  return {
    depthFt: round(-elevationM * METERS_TO_FEET, 0),
    source: 'GEBCO 2020',
  };
}
