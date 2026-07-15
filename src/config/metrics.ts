import { Feather } from '@expo/vector-icons';
import type { WaterConditions, WeatherConditions } from '@/types';

/**
 * The weather metrics shown in the main-page conditions strip, keyed so the
 * angler can reorder them (different anglers prioritise different reads). This
 * is the single source of truth for the strip's contents and default order —
 * ForecastCard renders it, HomeScreen offers the reorder UI, and
 * storage/metricOrder persists the choice.
 */
export type MetricKey = 'air' | 'wind' | 'pressure' | 'sky' | 'water' | 'rain';

/** Everything a chip needs to format its value, sourced at render time. */
export interface MetricCtx {
  w: WeatherConditions;
  water: WaterConditions;
  /** Pressure trend arrow ('↑'/'↓'/'→'/''), already resolved by the caller. */
  trend: string;
}

export interface MetricDef {
  key: MetricKey;
  /** Short label under the value (strip) and in the reorder row. */
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: (c: MetricCtx) => string;
}

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
};

/** Default order — matches the original hardcoded strip. */
export const DEFAULT_METRIC_ORDER: MetricKey[] = ['air', 'wind', 'pressure', 'sky', 'water', 'rain'];

/**
 * Reconcile a stored order against the known metrics: keep valid, de-duped keys
 * in their saved order, then append any metric missing from the list — so a
 * metric added in a later release still shows up for existing users.
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
  for (const k of DEFAULT_METRIC_ORDER) if (!seen.has(k)) order.push(k);
  return order;
}
