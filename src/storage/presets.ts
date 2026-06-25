import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnglerSettings } from '@/storage/settings';

const KEY = 'balure.presets.v1';

/** A user-named, saved condition configuration (a full settings snapshot). */
export interface ConditionPreset extends AnglerSettings {
  id: string;
  label: string;
}

export async function loadPresets(): Promise<ConditionPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConditionPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPreset(
  label: string,
  settings: AnglerSettings,
): Promise<ConditionPreset[]> {
  const existing = await loadPresets();
  const entry: ConditionPreset = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || 'My setup',
    ...settings,
  };
  const next = [...existing, entry];
  await persist(next);
  return next;
}

export async function deletePreset(id: string): Promise<ConditionPreset[]> {
  const existing = await loadPresets();
  const next = existing.filter((p) => p.id !== id);
  await persist(next);
  return next;
}

async function persist(list: ConditionPreset[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
