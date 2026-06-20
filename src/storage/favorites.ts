import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinates, FavoriteLocation } from '@/types';

const KEY = 'balure.favorites.v1';

export async function loadFavorites(): Promise<FavoriteLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteLocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => a.label.localeCompare(b.label));
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
  return next.sort((a, b) => a.label.localeCompare(b.label));
}

export async function deleteFavorite(id: string): Promise<FavoriteLocation[]> {
  const existing = await loadFavorites();
  const next = existing.filter((f) => f.id !== id);
  await persist(next);
  return next;
}

async function persist(list: FavoriteLocation[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
