import type { ChartedDepth, Coordinates } from '@/types';
import { fetchDemMeters } from '@/api/depth';
import { round } from '@/utils/format';

// Charted depth reads from the same NOAA NCEI "DEM global mosaic" the map's
// depth overlay already uses (see api/depth.ts) — one source instead of two.
// It replaced Open-Topo-Data's public GEBCO instance here: that community
// server caps usage (1000 calls/day, 1/sec) and doesn't clearly permit
// commercial use, while the NCEI mosaic is US-government public domain with
// no key or throttle, and resolves ~3 m near US coasts (surveyed coastal
// DEMs) vs GEBCO's ~450 m grid — a sharper reading exactly where anglers are.
const METERS_TO_FEET = 3.28084;

/**
 * Charted bottom depth at a point, or null when the grid has no below-surface
 * reading there. Coastal water and deeper bays resolve well; shorelines and
 * most inland lakes sit at/above sea level and return null — for those the
 * user's manually selected depth zone is the only depth signal.
 *
 * Throws on a network/HTTP failure so the caller can degrade gracefully, the
 * same way water temp and tides do.
 */
export async function fetchChartedDepth(
  coords: Coordinates,
): Promise<ChartedDepth | null> {
  const [elevationM] = await fetchDemMeters([
    [coords.latitude, coords.longitude],
  ]);

  // Missing reading, or at/above sea level: no charted bottom depth here.
  if (elevationM == null || elevationM >= 0) return null;

  return {
    depthFt: round(-elevationM * METERS_TO_FEET, 0),
    source: 'NOAA NCEI DEM',
  };
}
