import type { Species, WaterType } from '@/types';

/** Where in the water column a species typically holds. */
export type WaterColumn = 'top' | 'mid' | 'bottom';

export interface SpeciesInfo {
  id: Species;
  label: string;
  waterType: WaterType;
  /** Typical part of the water column to present in. */
  column: WaterColumn;
  /** Short targeting tip surfaced in the strategy when this species is chosen. */
  tip: string;
}

export const COLUMN_LABEL: Record<WaterColumn, string> = {
  top: 'Top water',
  mid: 'Mid-column',
  bottom: 'Near bottom',
};

// Ordered by popularity within each water type. `any` is handled separately.
export const SPECIES: SpeciesInfo[] = [
  // Freshwater
  {
    id: 'largemouth',
    label: 'Largemouth Bass',
    waterType: 'freshwater',
    column: 'mid',
    tip: 'Relate to cover; reaction baits when active, soft plastics when tight to cover.',
  },
  {
    id: 'smallmouth',
    label: 'Smallmouth Bass',
    waterType: 'freshwater',
    column: 'bottom',
    tip: 'Love rock and current; finesse plastics and jerkbaits shine in cooler, clearer water.',
  },
  {
    id: 'walleye',
    label: 'Walleye',
    waterType: 'freshwater',
    column: 'bottom',
    tip: 'Low-light and edges; slow presentations near bottom along drop-offs.',
  },
  {
    id: 'panfish',
    label: 'Crappie / Panfish',
    waterType: 'freshwater',
    column: 'mid',
    tip: 'Small baits around wood and brush; live minnows and tiny jigs under a float.',
  },
  {
    id: 'trout',
    label: 'Trout',
    waterType: 'freshwater',
    column: 'mid',
    tip: 'Cold, moving, oxygenated water; small spinners, drifted bait, light line.',
  },
  {
    id: 'catfish',
    label: 'Catfish',
    waterType: 'freshwater',
    column: 'bottom',
    tip: 'Scent-driven on the bottom; cut bait and nightcrawlers in current and holes.',
  },
  {
    id: 'pike',
    label: 'Pike / Musky',
    waterType: 'freshwater',
    column: 'mid',
    tip: 'Aggressive ambushers near weeds; big flashy baits and steel leaders.',
  },
  // Saltwater — inshore
  {
    id: 'redfish',
    label: 'Redfish',
    waterType: 'saltwater',
    column: 'bottom',
    tip: 'Tail on flats and oyster bars; weedless spoons, paddletails, cut bait.',
  },
  {
    id: 'seatrout',
    label: 'Speckled Trout',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Grass flats and potholes; popping cork + shrimp, twitchbaits, paddletails.',
  },
  {
    id: 'snook',
    label: 'Snook',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Ambush points: mangroves, dock lights, inlets on moving tide.',
  },
  {
    id: 'flounder',
    label: 'Flounder',
    waterType: 'saltwater',
    column: 'bottom',
    tip: 'Hug the bottom near drains and structure; bounce jigs and bucktails slowly.',
  },
  {
    id: 'striper',
    label: 'Striped Bass',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Follow moving water and bait; bucktails, twitchbaits, live/cut bait.',
  },
  {
    id: 'tarpon',
    label: 'Tarpon',
    waterType: 'saltwater',
    column: 'top',
    tip: 'Big live/cut bait on passes and beaches; heavy tackle, strong leaders.',
  },
  {
    id: 'spanish',
    label: 'Spanish Mackerel',
    waterType: 'saltwater',
    column: 'top',
    tip: 'Fast and flashy over open water; speed up spoons and jigs, use wire.',
  },
  // Saltwater — offshore
  {
    id: 'mahi',
    label: 'Mahi-Mahi (Dorado)',
    waterType: 'saltwater',
    column: 'top',
    tip: 'Surface hunter around weed lines and floating debris; fast flashy casts and rigged baits.',
  },
  {
    id: 'kingmackerel',
    label: 'King Mackerel',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Toothy speedster over reefs and bait schools; slow-troll live bait, always use wire.',
  },
  {
    id: 'cobia',
    label: 'Cobia',
    waterType: 'saltwater',
    column: 'top',
    tip: 'Curious cruiser around buoys, wrecks, and rays; sight-cast big jigs and live bait.',
  },
  {
    id: 'grouper',
    label: 'Grouper',
    waterType: 'saltwater',
    column: 'bottom',
    tip: 'Structure-hugging ambusher; drop heavy jigs and live bait to the rocks, then muscle it up.',
  },
  {
    id: 'snapper',
    label: 'Snapper',
    waterType: 'saltwater',
    column: 'bottom',
    tip: 'Wary bottom feeder on reefs and wrecks; lighter leaders and live/cut bait drifted down.',
  },
  {
    id: 'amberjack',
    label: 'Amberjack',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'The reef donkey — brutal fights over wrecks; vertical jigs and live bait on heavy tackle.',
  },
  {
    id: 'tuna',
    label: 'Tuna',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Fast open-water schools around bait; cast jigs or poppers at busting fish, jig deep otherwise.',
  },
  {
    id: 'wahoo',
    label: 'Wahoo',
    waterType: 'saltwater',
    column: 'mid',
    tip: 'Blazing strikes on high-speed presentations; wire leader, fast troll or heavy jigs.',
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

// Prime feeding water-temperature range (°F) per species — the widely
// published activity windows anglers plan around. Drives the bite score's
// temperature factor when the angler picks targets: 60–80°F is a largemouth
// assumption, and a 58°F day that's "cooling off" for bass is prime trout or
// striper water. Within ~8°F of the window still supports a moderate bite;
// beyond that the species is largely dormant (cold) or stressed (hot).
const PRIME_TEMP_F: Partial<Record<Species, [number, number]>> = {
  // Freshwater
  largemouth: [60, 80],
  smallmouth: [55, 72],
  walleye: [48, 68],
  panfish: [58, 75],
  trout: [48, 62],
  catfish: [68, 85],
  pike: [52, 68],
  // Saltwater — inshore
  redfish: [60, 80],
  seatrout: [58, 78],
  snook: [70, 88],
  flounder: [56, 75],
  striper: [50, 65],
  tarpon: [74, 88],
  spanish: [64, 80],
  // Saltwater — offshore
  mahi: [72, 82],
  kingmackerel: [68, 80],
  cobia: [68, 80],
  grouper: [62, 80],
  snapper: [60, 80],
  amberjack: [60, 78],
  tuna: [58, 75],
  wahoo: [70, 82],
};

/** Prime water-temp window for a species, or null for 'any'/unknown. */
export function speciesPrimeTempF(id: Species): [number, number] | null {
  return PRIME_TEMP_F[id] ?? null;
}

export function speciesTip(id: Species): string | null {
  return SPECIES.find((s) => s.id === id)?.tip ?? null;
}

/** Where a species typically holds in the water column, or null for `any`. */
export function speciesColumn(id: Species): WaterColumn | null {
  return SPECIES.find((s) => s.id === id)?.column ?? null;
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
  { id: 'kingmackerel', keywords: ['king mackerel', 'kingfish'] },
  { id: 'spanish', keywords: ['spanish mackerel'] },
  { id: 'mahi', keywords: ['mahi', 'dorado', 'dolphinfish'] },
  { id: 'cobia', keywords: ['cobia', 'ling cod'] },
  { id: 'grouper', keywords: ['grouper', 'gag'] },
  { id: 'snapper', keywords: ['snapper'] },
  { id: 'amberjack', keywords: ['amberjack'] },
  { id: 'tuna', keywords: ['tuna', 'blackfin', 'yellowfin', 'bluefin'] },
  { id: 'wahoo', keywords: ['wahoo'] },
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
