import { Feather } from '@expo/vector-icons';
import type { WaterConditions, WeatherConditions } from '@/types';

/**
 * The weather metrics available for the main-page conditions strip, keyed so
 * the angler can both REORDER them and CHOOSE which ones show (different anglers
 * prioritise different reads). The strip shows a chosen subset in a chosen
 * order; the rest live behind "More" and can be added from the reorder UI.
 * This is the single source of truth — ForecastCard renders it, the reorder UI
 * adds/removes/reorders, and storage/metricOrder persists the choice.
 */
export type MetricKey =
  | 'air'
  | 'wind'
  | 'pressure'
  | 'sky'
  | 'water'
  | 'rain'
  | 'clarity'
  | 'humidity'
  | 'sunrise'
  | 'sunset'
  | 'moon'
  | 'depth'
  | 'waves'
  | 'tide';

/** Everything a chip needs to format its value, sourced at render time. */
export interface MetricCtx {
  w: WeatherConditions;
  water: WaterConditions;
  /** Pressure trend arrow ('↑'/'↓'/'→'/''), already resolved by the caller. */
  trend: string;
  /** Water clarity label (raw, e.g. 'stained'). */
  clarity: string;
  /** Charted bottom depth in ft, or null when there's no chart data here. */
  chartedDepthFt: number | null;
  /** Resolved tide state ('incoming'…), or null at freshwater / no station. */
  tideState: string | null;
}

export interface MetricDef {
  key: MetricKey;
  /** Short label under the value (strip) and on the reorder/add chips. */
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: (c: MetricCtx) => string;
  /** True only when this metric's data is present for the current spot. The
   * conditional ones (depth/waves/tide) mirror what "More" shows. */
  available?: (c: MetricCtx) => boolean;
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const METRICS: Record<MetricKey, MetricDef> = {
  air: { key: 'air', label: 'Air', icon: 'thermometer', value: (c) => `${c.w.airTempF}°` },
  wind: {
    key: 'wind',
    label: 'Wind',
    icon: 'wind',
    value: (c) => `${c.w.windMph} ${c.w.windDirectionLabel}`,
  },
  pressure: {
    key: 'pressure',
    label: 'Press',
    icon: 'activity',
    value: (c) => `${c.w.pressureInHg}${c.trend ? ` ${c.trend}` : ''}`,
  },
  sky: { key: 'sky', label: 'Sky', icon: 'cloud', value: (c) => `${c.w.cloudCoverPct}%` },
  water: { key: 'water', label: 'Water', icon: 'droplet', value: (c) => `${c.water.waterTempF}°` },
  rain: { key: 'rain', label: 'Rain', icon: 'umbrella', value: (c) => `${c.w.precipChancePct}%` },
  clarity: { key: 'clarity', label: 'Clarity', icon: 'eye', value: (c) => cap(c.clarity) },
  humidity: { key: 'humidity', label: 'Humid', icon: 'percent', value: (c) => `${c.w.humidityPct}%` },
  sunrise: { key: 'sunrise', label: 'Sunrise', icon: 'sunrise', value: (c) => c.w.sunrise },
  sunset: { key: 'sunset', label: 'Sunset', icon: 'sunset', value: (c) => c.w.sunset },
  moon: { key: 'moon', label: 'Moon', icon: 'moon', value: (c) => `${c.w.moonIllumPct}%` },
  depth: {
    key: 'depth',
    label: 'Depth',
    icon: 'anchor',
    value: (c) => (c.chartedDepthFt != null ? `≈${c.chartedDepthFt} ft` : '—'),
    available: (c) => c.chartedDepthFt != null,
  },
  waves: {
    key: 'waves',
    label: 'Waves',
    icon: 'trending-up',
    value: (c) => (c.water.waveHeightFt != null ? `${c.water.waveHeightFt} ft` : '—'),
    available: (c) => c.water.waveHeightFt != null,
  },
  tide: {
    key: 'tide',
    label: 'Tide',
    icon: 'repeat',
    value: (c) => (c.tideState ? cap(c.tideState) : '—'),
    available: (c) => c.tideState != null,
  },
};

/** Every metric, in the order they're offered in the "add" list. */
export const ALL_METRIC_KEYS: MetricKey[] = [
  'air',
  'wind',
  'pressure',
  'sky',
  'water',
  'rain',
  'clarity',
  'humidity',
  'sunrise',
  'sunset',
  'moon',
  'depth',
  'waves',
  'tide',
];

/** Default strip — the six original quick reads. */
export const DEFAULT_METRIC_ORDER: MetricKey[] = ['air', 'wind', 'pressure', 'sky', 'water', 'rain'];

/** Is this metric's data present for the current spot? (Always-on metrics have
 * no `available` guard and are considered present.) */
export function isMetricAvailable(key: MetricKey, ctx: MetricCtx): boolean {
  return METRICS[key].available?.(ctx) ?? true;
}

/**
 * Reconcile a stored order against the known metrics: keep valid, de-duped keys
 * in their saved order. Unlike the old behaviour it does NOT force-append the
 * defaults — the saved list is the angler's chosen subset, so removals stick.
 * Falls back to the default set only when nothing valid was stored.
 */
export function reconcileMetricOrder(stored: unknown): MetricKey[] {
  const order: MetricKey[] = [];
  const seen = new Set<MetricKey>();
  if (Array.isArray(stored)) {
    for (const k of stored) {
      if (typeof k === 'string' && k in METRICS && !seen.has(k as MetricKey)) {
        order.push(k as MetricKey);
        seen.add(k as MetricKey);
      }
    }
  }
  return order.length ? order : [...DEFAULT_METRIC_ORDER];
}
