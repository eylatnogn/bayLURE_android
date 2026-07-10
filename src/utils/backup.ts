import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { importCatches, loadCatches } from '@/storage/catchLog';
import { importFavorites, loadFavorites } from '@/storage/favorites';
import { importPresets, loadPresets } from '@/storage/presets';

// Backup file format: a plain JSON snapshot of saved spots, presets, and the
// catch log. The shape is versioned so a future format change can still read
// old files (and v1 files without catches still import).
const BACKUP_KIND = 'baylure-backup';

export interface BackupCounts {
  spots: number;
  presets: number;
  catches: number;
}

// Screens that keep spots/presets in state (Home stays mounted across tabs)
// subscribe here to reload after an import adds entries behind their back.
type Listener = () => void;
const importListeners = new Set<Listener>();
export function onBackupImported(listener: Listener): () => void {
  importListeners.add(listener);
  return () => {
    importListeners.delete(listener);
  };
}

/**
 * Write everything saved on this device to a JSON file the user keeps:
 * a download on web, the system share sheet (save to Files/Drive, AirDrop,
 * email…) on iOS/Android. Returns what was exported, or null when there is
 * nothing saved yet.
 */
export async function exportBackup(): Promise<BackupCounts | null> {
  const [favorites, presets, allCatches] = await Promise.all([
    loadFavorites(),
    loadPresets(),
    loadCatches(),
  ]);
  if (favorites.length === 0 && presets.length === 0 && allCatches.length === 0) {
    return null;
  }

  // Native photo URIs point into this device's app sandbox — dead on any
  // other device (or after a reinstall), so they don't belong in a backup.
  // Web data-URL photos are self-contained and travel fine.
  const catches = allCatches.map((c) =>
    c.photoUri && !c.photoUri.startsWith('data:') ? { ...c, photoUri: undefined } : c,
  );

  const payload = {
    app: 'bayLURE',
    kind: BACKUP_KIND,
    version: 2,
    exportedAt: new Date().toISOString(),
    favorites,
    presets,
    catches,
  };
  const json = JSON.stringify(payload, null, 2);
  const name = `baylure-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } else {
    const file = new File(Paths.cache, name);
    try {
      file.create();
    } catch {
      // Already exists from an earlier export today — write() overwrites.
    }
    file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your bayLURE backup',
    });
  }
  return { spots: favorites.length, presets: presets.length, catches: catches.length };
}

/**
 * Pick a backup file and merge it in. Existing entries are never modified;
 * duplicates are skipped. Returns how many entries were actually added, or
 * null when the user cancels the picker. Throws (with a friendly message)
 * when the file isn't a bayLURE backup.
 */
export async function importBackup(): Promise<BackupCounts | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;

  let text: string;
  if (Platform.OS === 'web') {
    text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  } else {
    text = await new File(asset.uri).text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file could not be read as a bayLURE backup.');
  }
  const data = parsed as { favorites?: unknown; presets?: unknown; catches?: unknown };
  const hasSpots = Array.isArray(data?.favorites);
  const hasPresets = Array.isArray(data?.presets);
  const hasCatches = Array.isArray(data?.catches);
  if (!hasSpots && !hasPresets && !hasCatches) {
    throw new Error('That file is not a bayLURE backup.');
  }

  const spots = hasSpots ? await importFavorites(data.favorites as unknown[]) : 0;
  const presets = hasPresets ? await importPresets(data.presets as unknown[]) : 0;
  const catches = hasCatches ? await importCatches(data.catches as unknown[]) : 0;
  if (spots > 0 || presets > 0 || catches > 0) {
    importListeners.forEach((l) => l());
  }
  return { spots, presets, catches };
}
