// Core domain types for bayLURE.

export type WaterType = 'saltwater' | 'freshwater';

/**
 * Target species. `any` means "not sure / no preference" and applies no
 * species bias. Freshwater and saltwater species are namespaced so a trout in
 * a lake and a trout on the flats stay distinct.
 */
export type Species =
  | 'any'
  // freshwater
  | 'largemouth'
  | 'smallmouth'
  | 'walleye'
  | 'panfish'
  | 'trout'
  | 'catfish'
  | 'pike'
  // saltwater
  | 'redfish'
  | 'seatrout'
  | 'snook'
  | 'flounder'
  | 'striper'
  | 'tarpon'
  | 'spanish';

/** Structure / cover the user reports at their spot. */
export type StructureType =
  | 'vegetation' // submerged/emergent grass & weeds, grass flats
  | 'pads' // lily pads / matted vegetation (freshwater)
  | 'wood' // laydowns, timber, docks, pilings
  | 'rock' // rip-rap, rocky points, jetties
  | 'oyster' // oyster bars / shell (saltwater)
  | 'mangrove' // mangrove shorelines (saltwater)
  | 'dropoff' // ledges, channel edges, depth breaks
  | 'current' // river current, inlets, passes
  | 'open'; // open water / flats / no obvious cover

export type PressureTrend = 'rising' | 'falling' | 'steady' | 'unknown';

export type SkyCondition = 'clear' | 'partly_cloudy' | 'overcast';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherConditions {
  /** Air temperature in degrees Fahrenheit. */
  airTempF: number;
  /** Sea-level / surface pressure in inches of mercury. */
  pressureInHg: number;
  /** Raw surface pressure in hectopascals (for reference). */
  pressureHpa: number;
  /** Change in pressure over the last ~3 hours, in inHg. */
  pressureChangeInHg: number;
  pressureTrend: PressureTrend;
  /** Wind speed in mph. */
  windMph: number;
  windGustMph: number;
  /** Wind direction in degrees (meteorological: where wind comes FROM). */
  windDirectionDeg: number;
  /** Compass label, e.g. "NW". */
  windDirectionLabel: string;
  cloudCoverPct: number;
  sky: SkyCondition;
  humidityPct: number;
  isDay: boolean;
  weatherCode: number;
  weatherLabel: string;
}

export interface WaterConditions {
  /** Surface water temperature in degrees Fahrenheit. */
  waterTempF: number;
  /** True when waterTempF is estimated rather than measured. */
  isEstimated: boolean;
  /** Wave height in feet (saltwater / large water only). */
  waveHeightFt: number | null;
}

export interface TideEvent {
  /** ISO-ish time string returned by NOAA (local station time). */
  time: string;
  type: 'high' | 'low';
  heightFt: number;
}

export interface TideConditions {
  stationId: string;
  stationName: string;
  stationDistanceMi: number;
  events: TideEvent[];
  /** Derived state right now. */
  state: 'incoming' | 'outgoing' | 'slack' | 'unknown';
  nextEvent: TideEvent | null;
}

/** How heavily fished the water is. Drives the finesse playbook. */
export type PressureLevel = 'none' | 'moderate' | 'high';

/** Water clarity at the spot. Drives color, vibration, and behavior advice. */
export type WaterClarity = 'clear' | 'stained' | 'muddy';

export interface Conditions {
  coordinates: Coordinates;
  waterType: WaterType;
  species: Species;
  structures: StructureType[];
  /** How heavily fished / educated the fish are. */
  pressureLevel: PressureLevel;
  /** Visibility of the water. */
  clarity: WaterClarity;
  fetchedAt: string;
  weather: WeatherConditions;
  water: WaterConditions;
  tide: TideConditions | null;
}

export interface LurePick {
  name: string;
  category: 'lure' | 'rig' | 'bait';
  /** Why the engine picked this, given current conditions. */
  reason: string;
  /** Suggested colors / sizes. */
  details: string;
  /** 0-100 confidence the engine assigns this pick right now. */
  score: number;
}

export interface Strategy {
  /** 0-100 overall bite forecast. */
  biteScore: number;
  biteLabel: string;
  /** One-paragraph human summary. */
  summary: string;
  /** Bullet-point factors driving the recommendation. */
  factors: string[];
  picks: LurePick[];
  /** What the fish are likely doing, given the conditions. */
  behavior: string[];
  /** Color/vibration/location advice tuned to the water clarity. */
  clarityPlaybook: PlaybookSection[];
  /** Categorized finesse playbook, present only for pressured water. */
  pressurePlaybook?: PlaybookSection[];
  /** Present only when the optional Claude AI layer ran. */
  aiNarrative?: string;
}

export interface PlaybookSection {
  title: string;
  tips: string[];
}

/** A compact, serializable snapshot of conditions saved alongside a catch. */
export interface CatchConditions {
  capturedAt: string;
  place?: string;
  latitude?: number;
  longitude?: number;
  waterType: WaterType;
  targetSpecies: Species;
  structures: StructureType[];
  pressureLevel: PressureLevel;
  clarity: WaterClarity;
  airTempF: number;
  waterTempF: number;
  waterTempEstimated: boolean;
  pressureInHg: number;
  pressureTrend: PressureTrend;
  windMph: number;
  windDirectionLabel: string;
  sky: SkyCondition;
  tideState?: 'incoming' | 'outgoing' | 'slack' | 'unknown';
  biteScore?: number;
}

/** A logged catch. Photos and data are stored on-device. */
export interface CatchRecord {
  id: string;
  dateISO: string;
  /** Species label (free-form; chosen from a list including "Other"). */
  species: string;
  /** Lure/rig/bait name, chosen from the bayLURE list (never free text). */
  lure: string;
  lureCategory?: 'lure' | 'rig' | 'bait';
  waterType?: WaterType;
  /** Free text, e.g. "18 in" or "3.5 lb". */
  size?: string;
  notes?: string;
  /** File URI (native) or data URL (web) for the catch photo. */
  photoUri?: string;
  /** Conditions captured from the planner at log time, if available. */
  conditions?: CatchConditions;
}
