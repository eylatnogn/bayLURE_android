// Core domain types for BALURE.

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

export interface Conditions {
  coordinates: Coordinates;
  waterType: WaterType;
  species: Species;
  structures: StructureType[];
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
  /** Present only when the optional Claude AI layer ran. */
  aiNarrative?: string;
}
