import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_METRIC_ORDER, reconcileMetricOrder, type MetricKey } from '@/config/metrics';

const KEY = 'balure.metricOrder.v1';

/**
 * Load the saved conditions-strip order, reconciled against the known metrics.
 * Returns the default order when nothing is saved or on any error.
 */
export async function loadMetricOrder(): Promise<MetricKey[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_METRIC_ORDER];
    return reconcileMetricOrder(JSON.parse(raw));
  } catch {
    return [...DEFAULT_METRIC_ORDER];
  }
}

/** Persist a hand-reordered strip order (the stored order is the shown order). */
export async function saveMetricOrder(order: MetricKey[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* non-fatal */
  }
}
