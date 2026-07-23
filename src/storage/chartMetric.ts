import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'balure.chartmetric.v1';

/**
 * The angler's preferred curve for the Tides & Bite chart, persisted across
 * app opens. `preferred` is what the chart shows by default ('tide' or a
 * forecast metric key); `fallback` is the last non-tide metric they chose,
 * used to fill the chart when a spot has no tide data (freshwater, or a NOAA
 * outage) so the graph never opens blank. Values are validated by the caller
 * against its metric list — unknown strings just fall back to defaults there.
 */
export interface ChartMetricPref {
  preferred: string;
  fallback: string;
}

export async function loadChartMetric(): Promise<ChartMetricPref | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChartMetricPref>;
    if (typeof parsed.preferred !== 'string' || typeof parsed.fallback !== 'string') {
      return null;
    }
    return { preferred: parsed.preferred, fallback: parsed.fallback };
  } catch {
    return null;
  }
}

export function saveChartMetric(pref: ChartMetricPref): void {
  AsyncStorage.setItem(KEY, JSON.stringify(pref)).catch(() => {});
}
