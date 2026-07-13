import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinates, FavoriteLocation } from '@/types';

const KEY = 'balure.favorites.v1';

export async function loadFavorites(): Promise<FavoriteLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteLocation[];
    if (!Array.isArray(parsed)) return [];
    // Stored order is the shown order so the angler's manual reordering sticks
    // (older builds alphabetized on read; the persisted array is insertion
    // order, which becomes the starting point they can now drag to reorder).
    return parsed;
  } catch {
    return [];
  }
}

export async function addFavorite(
  label: string,
  coords: Coordinates,
): Promise<FavoriteLocation[]> {
  const existing = await loadFavorites();
  const entry: FavoriteLocation = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || 'Unnamed spot',
    latitude: coords.latitude,
    longitude: coords.longitude,
    savedAt: new Date().toISOString(),
  };
  const next = [...existing, entry];
  await persist(next);
  return next;
}

export async function deleteFavorite(id: string): Promise<FavoriteLocation[]> {
  const existing = await loadFavorites();
  const next = existing.filter((f) => f.id !== id);
  await persist(next);
  return next;
}

/** Persist a hand-reordered spot list (stored order is the shown order). */
export async function reorderFavorites(list: FavoriteLocation[]): Promise<FavoriteLocation[]> {
  await persist(list);
  return list;
}

/** Same spot saved twice (label + ~10m coordinates) counts as a duplicate. */
function favKey(f: { label: string; latitude: number; longitude: number }): string {
  return `${f.label.trim().toLowerCase()}|${f.latitude.toFixed(4)},${f.longitude.toFixed(4)}`;
}

/**
 * Merge backup entries into the saved spots. Invalid entries are skipped,
 * existing spots are never modified, and duplicates are ignored.
 * Returns how many were actually added.
 */
export async function importFavorites(entries: unknown[]): Promise<number> {
  const existing = await loadFavorites();
  const seen = new Set(existing.map(favKey));
  const next = [...existing];
  let added = 0;
  for (const raw of entries) {
    const e = raw as Partial<FavoriteLocation>;
    if (
      !e ||
      typeof e.label !== 'string' ||
      typeof e.latitude !== 'number' ||
      typeof e.longitude !== 'number' ||
      Math.abs(e.latitude) > 90 ||
      Math.abs(e.longitude) > 180
    ) {
      continue;
    }
    const entry: FavoriteLocation = {
      // Fresh id: backup ids may collide with entries already on this device.
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label: e.label.trim() || 'Unnamed spot',
      latitude: e.latitude,
      longitude: e.longitude,
      savedAt: typeof e.savedAt === 'string' ? e.savedAt : new Date().toISOString(),
    };
    if (seen.has(favKey(entry))) continue;
    seen.add(favKey(entry));
    next.push(entry);
    added += 1;
  }
  if (added > 0) await persist(next);
  return added;
}

async function persist(list: FavoriteLocation[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
