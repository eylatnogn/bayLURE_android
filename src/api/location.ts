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

  let label = '';
  try {
    const places = await Location.reverseGeocodeAsync(coordinates);
    const place = places[0];
    if (place) {
      label = [place.city ?? place.subregion, place.region]
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    // Reverse geocoding is best-effort; ignore failures.
  }

  return { coordinates, label };
}
