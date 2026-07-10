import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatchRecord } from '@/types';

const KEY = 'balure.catches.v1';

/** Load all logged catches, newest first. */
export async function loadCatches(): Promise<CatchRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CatchRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  } catch {
    return [];
  }
}

/** Add a catch and return the updated list (newest first). */
export async function addCatch(
  record: Omit<CatchRecord, 'id' | 'dateISO'> & { dateISO?: string },
): Promise<CatchRecord[]> {
  const existing = await loadCatches();
  const full: CatchRecord = {
    ...record,
    id: makeId(),
    dateISO: record.dateISO ?? new Date().toISOString(),
  };
  const next = [full, ...existing];
  await persist(next);
  return next;
}

/** Delete a catch by id and return the updated list. */
export async function deleteCatch(id: string): Promise<CatchRecord[]> {
  const existing = await loadCatches();
  const next = existing.filter((c) => c.id !== id);
  await persist(next);
  return next;
}

/**
 * Replace a catch's editable fields by id, keeping its original id and date.
 * Returns the updated list (newest first).
 */
export async function updateCatch(
  id: string,
  fields: Omit<CatchRecord, 'id' | 'dateISO'>,
): Promise<CatchRecord[]> {
  const existing = await loadCatches();
  const next = existing.map((c) =>
    c.id === id ? { ...c, ...fields, id: c.id, dateISO: c.dateISO } : c,
  );
  await persist(next);
  return next.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

/**
 * Merge backup entries into the catch log. Invalid entries are skipped,
 * existing catches are never modified, and duplicates (same date + species +
 * gear) are ignored. Returns how many were actually added.
 */
export async function importCatches(entries: unknown[]): Promise<number> {
  const existing = await loadCatches();
  const key = (c: CatchRecord) =>
    [c.dateISO, c.species, c.lure ?? '', c.rig ?? '', c.bait ?? '', c.gearOther ?? ''].join('|');
  const seen = new Set(existing.map(key));
  const next = [...existing];
  let added = 0;
  for (const raw of entries) {
    const e = raw as Partial<CatchRecord>;
    if (!e || typeof e.species !== 'string' || typeof e.dateISO !== 'string') continue;
    const entry: CatchRecord = {
      // Fresh id: backup ids may collide with entries already on this device.
      id: makeId(),
      dateISO: e.dateISO,
      species: e.species.trim() || 'Unknown',
      lure: typeof e.lure === 'string' ? e.lure : undefined,
      rig: typeof e.rig === 'string' ? e.rig : undefined,
      bait: typeof e.bait === 'string' ? e.bait : undefined,
      gearOther: typeof e.gearOther === 'string' ? e.gearOther : undefined,
      waterType: e.waterType === 'saltwater' || e.waterType === 'freshwater' ? e.waterType : undefined,
      size: typeof e.size === 'string' ? e.size : undefined,
      notes: typeof e.notes === 'string' ? e.notes : undefined,
      // Only data-URL photos survive a device move; file URIs point into the
      // old device's sandbox and would render as broken images.
      photoUri:
        typeof e.photoUri === 'string' && e.photoUri.startsWith('data:')
          ? e.photoUri
          : undefined,
      conditions:
        e.conditions && typeof e.conditions === 'object' ? e.conditions : undefined,
    };
    if (seen.has(key(entry))) continue;
    seen.add(key(entry));
    next.push(entry);
    added += 1;
  }
  if (added > 0) {
    next.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    await persist(next);
  }
  return added;
}

async function persist(list: CatchRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
