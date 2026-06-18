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

async function persist(list: CatchRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
