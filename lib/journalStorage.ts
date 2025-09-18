import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from '@/types/journal';

const BASE_KEY = 'journalEntries:v1';

function keyForUser(userId?: string | null) {
  return userId ? `${BASE_KEY}:user:${userId}` : BASE_KEY;
}

export async function migrateBaseToUser(userId: string) {
  if (!userId) return;
  try {
    const userKey = keyForUser(userId);
    const existingUser = await AsyncStorage.getItem(userKey);
    if (existingUser) return; // already migrated
    const legacy = await AsyncStorage.getItem(BASE_KEY);
    if (!legacy) return;
    await AsyncStorage.setItem(userKey, legacy);
  } catch (e) {
    console.warn('Migration failed', e);
  }
}

export async function loadEntries(userId?: string | null): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyForUser(userId));
    if (!raw) return [];
    const parsed: JournalEntry[] = JSON.parse(raw);
    return parsed.sort((a,b)=> new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (e) {
    console.warn('Failed to load journal entries', e);
    return [];
  }
}

export async function saveEntries(entries: JournalEntry[], userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(keyForUser(userId), JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save journal entries', e);
  }
}

export async function upsertEntry(entry: JournalEntry, userId?: string | null): Promise<JournalEntry[]> {
  const entries = await loadEntries(userId);
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.unshift(entry); // newest first
  }
  await saveEntries(entries, userId);
  return entries;
}

export async function deleteEntry(id: string, userId?: string | null): Promise<JournalEntry[]> {
  const entries = await loadEntries(userId);
  const filtered = entries.filter(e => e.id !== id);
  await saveEntries(filtered, userId);
  return filtered;
}
