import type { Coordinates, Species } from '@/types';
import { matchSpecies } from '@/engine/species';

const URL = 'https://api.inaturalist.org/v1/observations/species_counts';

export interface AreaFish {
  commonName: string;
  scientificName: string;
  /** Number of nearby observations — a rough "how common is it here" signal. */
  count: number;
  taxonId: number;
  /** Mapped bayLURE target species when the name matches one we plan for. */
  target: Species | null;
}

// Nearby fish barely change, so cache by location to spare the API on repeat
// (now automatic) analyses.
const AREA_TTL_MS = 30 * 60 * 1000;
const areaCache = new Map<string, { at: number; fish: AreaFish[] }>();

/**
 * What fish are actually observed near a location, via the free iNaturalist
 * species-counts API (no key). Filtered to ray-finned fishes (Actinopterygii)
 * and ranked by how often they've been logged nearby.
 *
 * This is citizen-science observation data: it reflects what people have
 * photographed and reported, so it's biased toward visible, popular, and
 * accessible species — a useful "what swims here", not a stocking survey.
 */
export async function fetchAreaFish(
  coords: Coordinates,
  radiusKm = 50,
): Promise<AreaFish[]> {
  const key = `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)},${radiusKm}`;
  const hit = areaCache.get(key);
  if (hit && Date.now() - hit.at < AREA_TTL_MS) return hit.fish;

  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lng: String(coords.longitude),
    radius: String(radiusKm),
    iconic_taxa: 'Actinopterygii',
    verifiable: 'true',
    per_page: '50',
    locale: 'en',
  });

  const res = await fetch(`${URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Nearby-fish request failed (${res.status}).`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      count: number;
      taxon?: { id: number; name?: string; preferred_common_name?: string };
    }>;
  };

  const fish = (data.results ?? [])
    .map((r) => {
      const scientificName = r.taxon?.name ?? '';
      const commonName = r.taxon?.preferred_common_name || scientificName;
      return {
        count: r.count,
        taxonId: r.taxon?.id ?? 0,
        scientificName,
        commonName: titleCase(commonName),
        target: matchSpecies(commonName),
      };
    })
    .filter((f) => f.scientificName.length > 0);

  areaCache.set(key, { at: Date.now(), fish });
  return fish;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
