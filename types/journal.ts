export type JournalEntry = {
  id: string;            // uuid
  title: string;
  content: string;       // markdown/plain text
  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
  mood?: 'happy' | 'neutral' | 'sad' | 'angry' | 'anxious' | 'grateful';
  tags?: string[];
};

export type JournalStats = {
  total: number;
  byMood: Record<string, number>;
  lastUpdated?: string;
};
