import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinates } from '@/types';

const KEY = 'balure.lastspot.v1';

/** The last spot the angler analyzed/viewed, restored at next launch. */
export interface LastSpot {
  coordinates: Coordinates;
  /** Human label shown in the location card ("" when unknown). */
  place: string;
}

export async function loadLastSpot(): Promise<LastSpot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSpot>;
    const c = parsed?.coordinates;
    if (
      !c ||
      typeof c.latitude !== 'number' ||
      typeof c.longitude !== 'number' ||
      Math.abs(c.latitude) > 90 ||
      Math.abs(c.longitude) > 180
    ) {
      return null;
    }
    return {
      coordinates: { latitude: c.latitude, longitude: c.longitude },
      place: typeof parsed.place === 'string' ? parsed.place : '',
    };
  } catch {
    return null;
  }
}

export async function saveLastSpot(coordinates: Coordinates, place: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ coordinates, place }));
  } catch {
    // Remembering the spot is a convenience — never block on it.
  }
}
