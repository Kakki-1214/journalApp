import { useState, useCallback, useEffect } from 'react';
import { useJournal } from '@/context/JournalContext';
import type { JournalEntry } from '@/types/journal';

export interface UseJournalEditorOptions {
  entryId?: string | null;
}

export interface JournalEditorState {
  id: string | null;
  title: string;
  content: string;
  mood?: JournalEntry['mood'];
  tags: string[];
  mode: 'edit' | 'preview';
  loading: boolean;
  isNew: boolean;
}

export interface JournalEditorApi extends JournalEditorState {
  setTitle(v: string): void;
  setContent(v: string): void;
  setMood(v: JournalEntry['mood'] | undefined): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  toggleMode(): void;
  reset(): void;
  select(id: string): void;
  save(): Promise<JournalEntry>;
  deleteEntry(): Promise<void>;
}

export function useJournalEditor(opts: UseJournalEditorOptions = {}): JournalEditorApi {
  const { create, update, remove, get } = useJournal();
  const [id, setId] = useState<string | null>(opts.entryId || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood'] | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(false);

  // load if initial id provided
  useEffect(() => {
    if (opts.entryId) {
      const e = get(opts.entryId);
      if (e) {
        setId(e.id); setTitle(e.title); setContent(e.content); setMood(e.mood); setTags(e.tags || []);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.entryId]);

  const reset = useCallback(() => {
    setId(null); setTitle(''); setContent(''); setMood(undefined); setTags([]); setMode('edit');
  }, []);

  const select = useCallback((entryId: string) => {
    const e = get(entryId);
    if (!e) return;
    setId(e.id); setTitle(e.title); setContent(e.content); setMood(e.mood); setTags(e.tags || []); setMode('edit');
  }, [get]);

  const addTag = useCallback((tag: string) => {
    const t = tag.trim(); if(!t) return; setTags(prev => prev.includes(t) ? prev : [...prev, t]);
  }, []);
  const removeTag = useCallback((tag: string) => setTags(prev => prev.filter(x => x !== tag)), []);
  const toggleMode = useCallback(() => setMode(m => m === 'edit' ? 'preview' : 'edit'), []);

  const save = useCallback(async () => {
    setLoading(true);
    try {
      if (id) {
        await update(id, { title, content, mood, tags });
        const updated = get(id)!; // after update
        return updated;
      } else {
        const created = await create({ title, content, mood, tags });
        setId(created.id);
        return created;
      }
    } finally {
      setLoading(false);
    }
  }, [id, title, content, mood, tags, update, create, get]);

  const deleteEntry = useCallback(async () => {
    if(!id) return; await remove(id); reset();
  }, [id, remove, reset]);

  return {
    id, title, content, mood, tags, mode, loading, isNew: !id,
    setTitle, setContent, setMood,
    addTag, removeTag, toggleMode, reset, select, save, deleteEntry
  };
}
