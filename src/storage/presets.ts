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

/** Persist a hand-reordered preset list (stored order is the shown order). */
export async function reorderPresets(list: ConditionPreset[]): Promise<ConditionPreset[]> {
  await persist(list);
  return list;
}

/** The same named setup counts as a duplicate (label + all settings). */
function presetKey(p: ConditionPreset): string {
  return [
    p.label.trim().toLowerCase(),
    p.waterType,
    [...p.species].sort().join(','),
    [...p.structures].sort().join(','),
    p.clarity,
    p.depth,
    p.pressureLevel,
  ].join('|');
}

/**
 * Merge backup entries into the saved presets. Field values are coerced the
 * same tolerant way loadSettings does, invalid entries are skipped, and
 * duplicates are ignored. Returns how many were actually added.
 */
export async function importPresets(entries: unknown[]): Promise<number> {
  const existing = await loadPresets();
  const seen = new Set(existing.map(presetKey));
  const next = [...existing];
  let added = 0;
  for (const raw of entries) {
    const e = raw as Partial<ConditionPreset>;
    if (!e || typeof e !== 'object' || typeof e.label !== 'string') continue;
    const entry: ConditionPreset = {
      // Fresh id: backup ids may collide with entries already on this device.
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label: e.label.trim() || 'My setup',
      waterType: e.waterType === 'saltwater' ? 'saltwater' : 'freshwater',
      species: Array.isArray(e.species) ? e.species : [],
      structures: Array.isArray(e.structures) ? e.structures : [],
      clarity: e.clarity ?? 'stained',
      depth: e.depth ?? 'any',
      pressureLevel: e.pressureLevel ?? 'none',
    };
    if (seen.has(presetKey(entry))) continue;
    seen.add(presetKey(entry));
    next.push(entry);
    added += 1;
  }
  if (added > 0) await persist(next);
  return added;
}

async function persist(list: ConditionPreset[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
