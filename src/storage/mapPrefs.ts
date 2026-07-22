import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'balure.mapprefs.v1';

/** The map's overlay/base-layer choices, restored on the next app open. */
export interface MapPrefs {
  wind: boolean;
  depth: boolean;
  contour: boolean;
  sat: boolean;
  radar: boolean;
}

/** First-launch defaults — match the map's original hardcoded state. */
export const DEFAULT_MAP_PREFS: MapPrefs = {
  wind: true,
  depth: false,
  contour: false,
  sat: true,
  radar: false,
};

export async function loadMapPrefs(): Promise<MapPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_MAP_PREFS;
    const parsed = JSON.parse(raw) as Partial<MapPrefs>;
    return {
      wind: typeof parsed.wind === 'boolean' ? parsed.wind : DEFAULT_MAP_PREFS.wind,
      depth: typeof parsed.depth === 'boolean' ? parsed.depth : DEFAULT_MAP_PREFS.depth,
      contour: typeof parsed.contour === 'boolean' ? parsed.contour : DEFAULT_MAP_PREFS.contour,
      sat: typeof parsed.sat === 'boolean' ? parsed.sat : DEFAULT_MAP_PREFS.sat,
      radar: typeof parsed.radar === 'boolean' ? parsed.radar : DEFAULT_MAP_PREFS.radar,
    };
  } catch {
    return DEFAULT_MAP_PREFS;
  }
}

export function saveMapPrefs(prefs: MapPrefs): void {
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}
