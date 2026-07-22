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
  // saltwater — inshore
  | 'redfish'
  | 'seatrout'
  | 'snook'
  | 'flounder'
  | 'striper'
  | 'tarpon'
  | 'spanish'
  // saltwater — offshore
  | 'mahi'
  | 'kingmackerel'
  | 'cobia'
  | 'grouper'
  | 'snapper'
  | 'amberjack'
  | 'tuna'
  | 'wahoo';

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
  /** Chance of precipitation, 0-100. */
  precipChancePct: number;
  /** True when NWS forecasts thunderstorms for this hour — lightning risk. */
  thunder: boolean;
  isDay: boolean;
  weatherCode: number;
  weatherLabel: string;
  /** ISO local time this snapshot represents (the hour, or "now"). */
  timeISO: string;
  /** Local "HH:MM" sunrise / sunset for the day. */
  sunrise: string;
  sunset: string;
  /** Moon phase name and illuminated percentage. */
  moonPhase: string;
  moonIllumPct: number;
  /** True near a new/full moon — stronger feeding & tides. */
  moonMajor: boolean;
}

export interface WaterConditions {
  /** Surface water temperature in degrees Fahrenheit. */
  waterTempF: number;
  /** True when waterTempF is estimated rather than measured. */
  isEstimated: boolean;
  /** Wave height in feet (saltwater / large water only). */
  waveHeightFt: number | null;
}

/**
 * Charted bottom depth at the spot, read from a global bathymetry grid. Present
 * only where the grid actually maps a below-surface bottom — reliable offshore
 * and in deeper saltwater bays, sparse on shallow flats and most inland lakes
 * (which sit above sea level and read as uncharted). The manual depth zone
 * still applies wherever this is absent.
 */
export interface ChartedDepth {
  /** Depth of the bottom below the surface, in feet. */
  depthFt: number;
  /** Attribution for the reading, e.g. "NOAA NCEI DEM". */
  source: string;
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

/** Depth zone being fished. Biases lure choice and behavior advice. */
export type WaterDepth = 'any' | 'shallow' | 'mid' | 'deep';

export interface Conditions {
  coordinates: Coordinates;
  waterType: WaterType;
  /** Target species (0 = no preference / any). */
  species: Species[];
  structures: StructureType[];
  /** How heavily fished / educated the fish are. */
  pressureLevel: PressureLevel;
  /** Visibility of the water. */
  clarity: WaterClarity;
  /** Depth zone being fished. */
  depth: WaterDepth;
  /** The day this forecast is for (YYYY-MM-DD, local). */
  date: string;
  /** 0 = today, 1 = tomorrow, … up to 6. */
  dayOffset: number;
  fetchedAt: string;
  weather: WeatherConditions;
  /** Per-hour weather for this day, used to grade the bite by the hour. */
  hourlyWeather: WeatherConditions[];
  water: WaterConditions;
  /**
   * Charted bottom depth at the coordinates, where global bathymetry maps it.
   * A property of the location, copied onto each day; absent where uncharted.
   */
  chartedDepth?: ChartedDepth | null;
  tide: TideConditions | null;
  /**
   * Nearest USGS gauge's river flow (freshwater only) — a location attribute
   * like chartedDepth, copied onto each day. Scored only when the angler says
   * they're fishing current; null when no gauge is near or the fetch failed.
   */
  flow?: RiverFlow | null;
}

/** Streamflow at the nearest USGS gauge, for the river-bite factor. */
export interface RiverFlow {
  /** Latest discharge in cubic feet per second. */
  cfs: number;
  /** Change vs ~24 h ago as a percentage, null when the series is too short. */
  changePct: number | null;
  /** Gauge name, e.g. "CHATTAHOOCHEE RIVER NEAR NORCROSS, GA". */
  siteName: string;
  /** Miles from the spot to the gauge. */
  distanceMi: number;
}

export interface LurePick {
  name: string;
  category: 'lure' | 'rig' | 'bait';
  /** Why the engine picked this, given current conditions. */
  reason: string;
  /** Suggested colors / sizes. */
  details: string;
  /** Plain-language "how to actually fish it" for a new angler. */
  howTo: string;
  /** Illustration key for the in-app vector art. */
  art: string;
  /** Recommended tackle for this bait. */
  gear?: GearSpec;
  /** 0-100 confidence the engine assigns this pick right now. */
  score: number;
}

/** Tackle recommendation for a lure/rig/bait. */
export interface GearSpec {
  /** Rod power & action, e.g. "Medium-heavy, fast". */
  rod: string;
  /** Line / leader, e.g. "15-20 lb fluoro". */
  line: string;
  /** Hook type & size, e.g. "3/0-4/0 EWG worm". */
  hook: string;
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
  /** Bite score by hour for the day, for the hourly chart. */
  hourly: HourBite[];
  /** Highlighted best feeding windows of the day. */
  bestWindows: BestWindow[];
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

export interface HourBite {
  timeISO: string;
  /** "6 AM", "1 PM", … */
  label: string;
  score: number;
  isDay: boolean;
}

export interface BestWindow {
  /** "5–8 AM" */
  range: string;
  /** "Excellent", "Good", … */
  biteLabel: string;
  score: number;
}

/** A saved, user-labeled fishing spot. Stored on-device. */
export interface FavoriteLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  savedAt: string;
}

/** A compact, serializable snapshot of conditions saved alongside a catch. */
export interface CatchConditions {
  capturedAt: string;
  place?: string;
  latitude?: number;
  longitude?: number;
  waterType: WaterType;
  targetSpecies: Species[];
  structures: StructureType[];
  pressureLevel: PressureLevel;
  clarity: WaterClarity;
  depth: WaterDepth;
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
  /** Species label (free-form; chosen from a list or typed when "Other"). */
  species: string;
  /** Lure / rig / bait used, each chosen from its own list (optional). */
  lure?: string;
  rig?: string;
  bait?: string;
  /** Free-typed gear that isn't in the built-in lists (optional). */
  gearOther?: string;
  waterType?: WaterType;
  /** Fish length in inches (optional). */
  lengthIn?: number;
  /** Fish weight in pounds (optional). */
  weightLb?: number;
  /** Legacy free-text size, e.g. "18 in / 3.5 lb". Superseded by lengthIn /
   * weightLb for new catches; kept so older entries and imports still show. */
  size?: string;
  notes?: string;
  /** File URI (native) or data URL (web) for the catch photo. */
  photoUri?: string;
  /** Conditions captured from the planner at log time, if available. */
  conditions?: CatchConditions;
}
