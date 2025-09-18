import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { JournalEntry } from '@/types/journal';
import { loadEntries, upsertEntry, deleteEntry, migrateBaseToUser } from '@/lib/journalStorage';
import { useAuth } from '@/context/AuthContext';
import { nanoid } from 'nanoid/non-secure';

/*
Tiny non-secure id to avoid adding heavy uuid. For production security-critical IDs consider uuid.
If bundler complains, swap to 'react-native-uuid'.
*/

export type JournalContextType = {
  entries: JournalEntry[];
  loading: boolean;
  create: (data: { title: string; content: string; mood?: JournalEntry['mood']; tags?: string[] }) => Promise<JournalEntry>;
  update: (id: string, data: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => Promise<JournalEntry | undefined>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => JournalEntry | undefined;
  search: (q: string) => JournalEntry[];
  refresh: () => Promise<void>;
};

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export const JournalProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      if (user?.id) await migrateBaseToUser(user.id);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadEntries(user?.id);
    setEntries(list);
    setLoading(false);
  }, [user?.id]);

  const create: JournalContextType['create'] = useCallback(async (data) => {
    const now = new Date().toISOString();
    const entry: JournalEntry = { id: nanoid(12), title: data.title || 'Untitled', content: data.content || '', mood: data.mood, tags: data.tags, createdAt: now, updatedAt: now };
    const list = await upsertEntry(entry, user?.id);
    setEntries(list);
    return entry;
  }, [user?.id]);

  const update: JournalContextType['update'] = useCallback(async (id, data) => {
    const current = entries.find(e => e.id === id);
    if (!current) return undefined;
    const updated: JournalEntry = { ...current, ...data, updatedAt: new Date().toISOString() };
    const list = await upsertEntry(updated, user?.id);
    setEntries(list);
    return updated;
  }, [entries, user?.id]);

  const remove: JournalContextType['remove'] = useCallback(async (id) => {
    const list = await deleteEntry(id, user?.id);
    setEntries(list);
  }, [user?.id]);

  const get = useCallback((id: string) => entries.find(e => e.id === id), [entries]);

  const search = useCallback((q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(e => (e.title + ' ' + e.content + ' ' + (e.tags || []).join(' ')).toLowerCase().includes(query));
  }, [entries]);

  const value: JournalContextType = { entries, loading, create, update, remove, get, search, refresh };
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
};

export const useJournal = () => {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used within JournalProvider');
  return ctx;
};
