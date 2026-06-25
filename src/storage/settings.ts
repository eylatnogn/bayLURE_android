import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PressureLevel,
  Species,
  StructureType,
  WaterClarity,
  WaterDepth,
  WaterType,
} from '@/types';

const KEY = 'balure.settings.v1';

/** The angler's last-used preferences, remembered across sessions. */
export interface AnglerSettings {
  waterType: WaterType;
  species: Species[];
  structures: StructureType[];
  clarity: WaterClarity;
  depth: WaterDepth;
  pressureLevel: PressureLevel;
}

export async function loadSettings(): Promise<AnglerSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnglerSettings>;
    // Tolerate a partial/old shape — only return fields that look valid.
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      waterType: parsed.waterType === 'saltwater' ? 'saltwater' : 'freshwater',
      species: Array.isArray(parsed.species) ? parsed.species : [],
      structures: Array.isArray(parsed.structures) ? parsed.structures : [],
      clarity: parsed.clarity ?? 'stained',
      depth: parsed.depth ?? 'any',
      pressureLevel: parsed.pressureLevel ?? 'none',
    };
  } catch {
    return null;
  }
}

export async function saveSettings(settings: AnglerSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal: remembering settings is a convenience, not a requirement.
  }
}
