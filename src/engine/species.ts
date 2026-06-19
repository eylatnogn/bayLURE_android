import type { Species, WaterType } from '@/types';

export interface SpeciesInfo {
  id: Species;
  label: string;
  waterType: WaterType;
  /** Short targeting tip surfaced in the strategy when this species is chosen. */
  tip: string;
}

// Ordered by popularity within each water type. `any` is handled separately.
export const SPECIES: SpeciesInfo[] = [
  // Freshwater
  {
    id: 'largemouth',
    label: 'Largemouth Bass',
    waterType: 'freshwater',
    tip: 'Relate to cover; reaction baits when active, soft plastics when tight to cover.',
  },
  {
    id: 'smallmouth',
    label: 'Smallmouth Bass',
    waterType: 'freshwater',
    tip: 'Love rock and current; finesse plastics and jerkbaits shine in cooler, clearer water.',
  },
  {
    id: 'walleye',
    label: 'Walleye',
    waterType: 'freshwater',
    tip: 'Low-light and edges; slow presentations near bottom along drop-offs.',
  },
  {
    id: 'panfish',
    label: 'Crappie / Panfish',
    waterType: 'freshwater',
    tip: 'Small baits around wood and brush; live minnows and tiny jigs under a float.',
  },
  {
    id: 'trout',
    label: 'Trout',
    waterType: 'freshwater',
    tip: 'Cold, moving, oxygenated water; small spinners, drifted bait, light line.',
  },
  {
    id: 'catfish',
    label: 'Catfish',
    waterType: 'freshwater',
    tip: 'Scent-driven on the bottom; cut bait and nightcrawlers in current and holes.',
  },
  {
    id: 'pike',
    label: 'Pike / Musky',
    waterType: 'freshwater',
    tip: 'Aggressive ambushers near weeds; big flashy baits and steel leaders.',
  },
  // Saltwater
  {
    id: 'redfish',
    label: 'Redfish',
    waterType: 'saltwater',
    tip: 'Tail on flats and oyster bars; weedless spoons, paddletails, cut bait.',
  },
  {
    id: 'seatrout',
    label: 'Speckled Trout',
    waterType: 'saltwater',
    tip: 'Grass flats and potholes; popping cork + shrimp, twitchbaits, paddletails.',
  },
  {
    id: 'snook',
    label: 'Snook',
    waterType: 'saltwater',
    tip: 'Ambush points: mangroves, dock lights, inlets on moving tide.',
  },
  {
    id: 'flounder',
    label: 'Flounder',
    waterType: 'saltwater',
    tip: 'Hug the bottom near drains and structure; bounce jigs and bucktails slowly.',
  },
  {
    id: 'striper',
    label: 'Striped Bass',
    waterType: 'saltwater',
    tip: 'Follow moving water and bait; bucktails, twitchbaits, live/cut bait.',
  },
  {
    id: 'tarpon',
    label: 'Tarpon',
    waterType: 'saltwater',
    tip: 'Big live/cut bait on passes and beaches; heavy tackle, strong leaders.',
  },
  {
    id: 'spanish',
    label: 'Spanish Mackerel',
    waterType: 'saltwater',
    tip: 'Fast and flashy over open water; speed up spoons and jigs, use wire.',
  },
];

const LABELS: Record<Species, string> = SPECIES.reduce(
  (acc, s) => {
    acc[s.id] = s.label;
    return acc;
  },
  { any: 'Any species' } as Record<Species, string>,
);

export function speciesForWaterType(waterType: WaterType): SpeciesInfo[] {
  return SPECIES.filter((s) => s.waterType === waterType);
}

export function speciesLabel(id: Species): string {
  return LABELS[id] ?? 'Any species';
}

export function speciesTip(id: Species): string | null {
  return SPECIES.find((s) => s.id === id)?.tip ?? null;
}

// Ordered keyword rules: more specific names first (e.g. "sea trout" before
// the generic "trout"). Used to flag locally-observed fish that map to a
// bayLURE target species.
const MATCHERS: { id: Species; keywords: string[] }[] = [
  { id: 'seatrout', keywords: ['spotted seatrout', 'sea trout', 'seatrout', 'speckled trout', 'spotted weakfish'] },
  { id: 'largemouth', keywords: ['largemouth'] },
  { id: 'smallmouth', keywords: ['smallmouth'] },
  { id: 'striper', keywords: ['striped bass', 'striper', 'rockfish'] },
  { id: 'redfish', keywords: ['red drum', 'redfish'] },
  { id: 'snook', keywords: ['snook'] },
  { id: 'flounder', keywords: ['flounder', 'fluke'] },
  { id: 'tarpon', keywords: ['tarpon'] },
  { id: 'spanish', keywords: ['spanish mackerel'] },
  { id: 'walleye', keywords: ['walleye', 'sauger'] },
  { id: 'pike', keywords: ['northern pike', 'pike', 'muskellunge', 'muskie', 'musky'] },
  { id: 'catfish', keywords: ['catfish', 'bullhead'] },
  { id: 'panfish', keywords: ['crappie', 'bluegill', 'sunfish', 'perch', 'pumpkinseed'] },
  { id: 'trout', keywords: ['rainbow trout', 'brown trout', 'brook trout', 'cutthroat', 'trout'] },
];

/** Map a fish common name to a bayLURE target species, or null if unsupported. */
export function matchSpecies(commonName: string): Species | null {
  const name = commonName.toLowerCase();
  for (const m of MATCHERS) {
    if (m.keywords.some((k) => name.includes(k))) return m.id;
  }
  return null;
}
