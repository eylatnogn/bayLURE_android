import type {
  SkyCondition,
  StructureType,
  WaterType,
} from '@/types';

/** How aggressive a presentation is — matched against the day's bite mood. */
export type Presentation = 'aggressive' | 'neutral' | 'finesse';

export interface LureEntry {
  name: string;
  category: 'lure' | 'rig' | 'bait';
  /** Suggested colors, sizes, retrieve. */
  details: string;
  waterTypes: WaterType[];
  /** Structures/cover where this shines. Empty = works anywhere. */
  structures: StructureType[];
  /** Ideal surface water-temp window (degrees F). */
  minWaterF: number;
  maxWaterF: number;
  /** Skies where this is strongest. Empty = sky-agnostic. */
  skies: SkyCondition[];
  presentation: Presentation;
  /** Intrinsic versatility 0-1; nudges ties toward proven producers. */
  baseScore: number;
  /** Short clause used when explaining the pick, e.g. "covers water fast". */
  strength: string;
}

/**
 * A compact but opinionated knowledge base. Freshwater entries are
 * bass/panhandle-centric; saltwater entries target inshore species
 * (redfish, trout, snook, flounder). Extend freely.
 */
export const LURES: LureEntry[] = [
  // ---- Freshwater: power / aggressive ----
  {
    name: 'Lipless Crankbait',
    category: 'lure',
    details: 'Rattletrap-style, 1/2 oz, red craw or chrome/blue; rip it over grass',
    waterTypes: ['freshwater'],
    structures: ['vegetation', 'open', 'dropoff'],
    minWaterF: 45,
    maxWaterF: 68,
    skies: ['overcast', 'partly_cloudy'],
    presentation: 'aggressive',
    baseScore: 0.8,
    strength: 'covers water fast and triggers reaction strikes',
  },
  {
    name: 'Squarebill Crankbait',
    category: 'lure',
    details: '1.5 size, shad or chartreuse/black back; deflect off cover',
    waterTypes: ['freshwater'],
    structures: ['rock', 'wood', 'open'],
    minWaterF: 50,
    maxWaterF: 75,
    skies: ['overcast', 'partly_cloudy'],
    presentation: 'aggressive',
    baseScore: 0.78,
    strength: 'deflects off rock and wood to draw reaction bites',
  },
  {
    name: 'Spinnerbait',
    category: 'lure',
    details: '3/8 oz, white/chartreuse, willow blades in clear water, Colorado in stain',
    waterTypes: ['freshwater'],
    structures: ['vegetation', 'wood', 'open'],
    minWaterF: 48,
    maxWaterF: 80,
    skies: ['overcast'],
    presentation: 'aggressive',
    baseScore: 0.75,
    strength: 'flash and vibration shine in wind and low light',
  },
  {
    name: 'Topwater Walking Bait',
    category: 'lure',
    details: 'Spook-style, bone or shad; walk-the-dog over flats at dawn/dusk',
    waterTypes: ['freshwater', 'saltwater'],
    structures: ['open', 'vegetation'],
    minWaterF: 62,
    maxWaterF: 88,
    skies: ['overcast', 'partly_cloudy'],
    presentation: 'aggressive',
    baseScore: 0.7,
    strength: 'calls fish up in warm water and low light',
  },
  {
    name: 'Hollow-Body Frog',
    category: 'lure',
    details: 'Black or white; walk over mats and pads, pause in holes',
    waterTypes: ['freshwater'],
    structures: ['vegetation'],
    minWaterF: 65,
    maxWaterF: 90,
    skies: [],
    presentation: 'aggressive',
    baseScore: 0.7,
    strength: 'weedless over heavy vegetation where nothing else goes',
  },

  // ---- Freshwater: neutral / versatile ----
  {
    name: 'Chatterbait (Bladed Jig)',
    category: 'lure',
    details: '3/8 oz green pumpkin or white with paddle-tail trailer',
    waterTypes: ['freshwater'],
    structures: ['vegetation', 'open', 'wood'],
    minWaterF: 50,
    maxWaterF: 80,
    skies: ['partly_cloudy', 'overcast'],
    presentation: 'neutral',
    baseScore: 0.72,
    strength: 'vibration through grass at any speed',
  },
  {
    name: 'Jerkbait',
    category: 'lure',
    details: 'Suspending, natural shad; jerk-jerk-pause, long pauses in cold water',
    waterTypes: ['freshwater'],
    structures: ['open', 'rock', 'dropoff'],
    minWaterF: 38,
    maxWaterF: 60,
    skies: ['partly_cloudy', 'clear'],
    presentation: 'neutral',
    baseScore: 0.7,
    strength: 'long pauses tempt lethargic cold-water fish',
  },
  {
    name: 'Swim Jig',
    category: 'lure',
    details: '3/8 oz with swimbait trailer; swim through and around cover',
    waterTypes: ['freshwater'],
    structures: ['vegetation', 'wood'],
    minWaterF: 52,
    maxWaterF: 82,
    skies: [],
    presentation: 'neutral',
    baseScore: 0.66,
    strength: 'compact profile through scattered cover',
  },

  // ---- Freshwater: finesse ----
  {
    name: 'Texas-Rigged Soft Plastic',
    category: 'rig',
    details: 'Creature/worm, 3/16-3/8 oz weight, EWG hook; flip to cover',
    waterTypes: ['freshwater'],
    structures: ['vegetation', 'wood'],
    minWaterF: 45,
    maxWaterF: 92,
    skies: ['clear', 'partly_cloudy'],
    presentation: 'finesse',
    baseScore: 0.74,
    strength: 'weedless presentation right in heavy cover',
  },
  {
    name: 'Wacky-Rigged Stickbait',
    category: 'rig',
    details: 'Senko-style, green pumpkin; weightless, let it shimmy down',
    waterTypes: ['freshwater'],
    structures: ['wood', 'open', 'dropoff'],
    minWaterF: 50,
    maxWaterF: 85,
    skies: ['clear', 'partly_cloudy'],
    presentation: 'finesse',
    baseScore: 0.7,
    strength: 'subtle fall that pressured, inactive fish rarely refuse',
  },
  {
    name: 'Ned Rig',
    category: 'rig',
    details: '1/10 oz mushroom head, 2.75" stick; drag and deadstick on bottom',
    waterTypes: ['freshwater'],
    structures: ['rock', 'open', 'dropoff'],
    minWaterF: 38,
    maxWaterF: 75,
    skies: ['clear'],
    presentation: 'finesse',
    baseScore: 0.7,
    strength: 'tiny profile that saves tough, high-pressure days',
  },
  {
    name: 'Drop-Shot Rig',
    category: 'rig',
    details: '1/4 oz weight, 4" finesse worm 12-18" up; shake over structure',
    waterTypes: ['freshwater', 'saltwater'],
    structures: ['dropoff', 'rock', 'open'],
    minWaterF: 40,
    maxWaterF: 78,
    skies: ['clear', 'partly_cloudy'],
    presentation: 'finesse',
    baseScore: 0.68,
    strength: 'keeps a bait in the strike zone over deep structure',
  },
  {
    name: 'Football Jig',
    category: 'lure',
    details: '1/2 oz brown/green with craw trailer; drag rock and ledges',
    waterTypes: ['freshwater'],
    structures: ['rock', 'dropoff'],
    minWaterF: 45,
    maxWaterF: 80,
    skies: [],
    presentation: 'neutral',
    baseScore: 0.68,
    strength: 'mimics crawfish along rocky bottoms',
  },

  // ---- Saltwater inshore ----
  {
    name: 'Soft Plastic Paddletail on Jighead',
    category: 'rig',
    details: '1/4-3/8 oz head, 3-4" paddletail (new penny / chartreuse)',
    waterTypes: ['saltwater'],
    structures: ['open', 'dropoff', 'current', 'vegetation'],
    minWaterF: 55,
    maxWaterF: 88,
    skies: [],
    presentation: 'neutral',
    baseScore: 0.8,
    strength: 'the inshore workhorse for reds, trout and flounder',
  },
  {
    name: 'Gold/Silver Spoon',
    category: 'lure',
    details: '1/2 oz weedless gold spoon; steady retrieve over grass flats',
    waterTypes: ['saltwater'],
    structures: ['vegetation', 'open'],
    minWaterF: 60,
    maxWaterF: 88,
    skies: ['partly_cloudy', 'clear'],
    presentation: 'aggressive',
    baseScore: 0.7,
    strength: 'flash that calls redfish across grass flats',
  },
  {
    name: 'Popping Cork + Shrimp',
    category: 'rig',
    details: 'Popping cork over 18-30" leader to live or imitation shrimp',
    waterTypes: ['saltwater'],
    structures: ['open', 'current', 'vegetation'],
    minWaterF: 55,
    maxWaterF: 90,
    skies: [],
    presentation: 'neutral',
    baseScore: 0.78,
    strength: 'the pop calls trout/reds; the cork suspends bait in the strike zone',
  },
  {
    name: 'Suspending Twitchbait',
    category: 'lure',
    details: 'MirrOlure-style, natural; twitch-pause over potholes and edges',
    waterTypes: ['saltwater'],
    structures: ['dropoff', 'open', 'current'],
    minWaterF: 50,
    maxWaterF: 75,
    skies: ['partly_cloudy', 'clear'],
    presentation: 'neutral',
    baseScore: 0.66,
    strength: 'shines on cooler-water trout that want a slow, suspending target',
  },

  // ---- Natural bait ----
  {
    name: 'Live Shrimp',
    category: 'bait',
    details: 'Free-lined or under a cork; hook through the horn',
    waterTypes: ['saltwater'],
    structures: ['current', 'open', 'dropoff', 'vegetation'],
    minWaterF: 50,
    maxWaterF: 92,
    skies: [],
    presentation: 'finesse',
    baseScore: 0.82,
    strength: 'almost nothing inshore refuses live shrimp',
  },
  {
    name: 'Cut/Live Baitfish',
    category: 'bait',
    details: 'Mullet, menhaden or shad; bottom rig in current, fresh cut on slow days',
    waterTypes: ['saltwater', 'freshwater'],
    structures: ['current', 'dropoff', 'open'],
    minWaterF: 40,
    maxWaterF: 92,
    skies: [],
    presentation: 'finesse',
    baseScore: 0.72,
    strength: 'scent does the work when fish are inactive or water is cold/stained',
  },
  {
    name: 'Nightcrawlers',
    category: 'bait',
    details: 'Split-shot or slip-bobber; classic for panfish, walleye, trout, cats',
    waterTypes: ['freshwater'],
    structures: ['open', 'dropoff', 'wood'],
    minWaterF: 38,
    maxWaterF: 85,
    skies: [],
    presentation: 'finesse',
    baseScore: 0.68,
    strength: 'universal confidence bait when the bite is slow',
  },
];
