import * as Location from 'expo-location';
import type { Coordinates } from '@/types';

export interface LocationResult {
  coordinates: Coordinates;
  /** Best-effort place label, may be empty. */
  label: string;
}

/**
 * Request permission and return the device's current coordinates.
 * Throws a user-readable Error on denial or failure.
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Location permission denied. Enable it in Settings, or enter coordinates manually.',
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const coordinates: Coordinates = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };

  const label = await reverseGeocode(coordinates);
  return { coordinates, label };
}

/**
 * Best-effort place name for a coordinate. Returns '' when reverse geocoding
 * isn't available (e.g. on web) or fails — callers fall back to raw coords.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  try {
    const places = await Location.reverseGeocodeAsync(coords);
    const place = places[0];
    if (place) {
      return [place.city ?? place.subregion, place.region]
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    // Reverse geocoding is best-effort; ignore failures.
  }
  return '';
}
