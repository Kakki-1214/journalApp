import React, { useMemo, useState } from 'react';
import { View, Dimensions, Platform, Text, StyleSheet } from 'react-native';
import { useJournal } from '@/context/JournalContext';
import { useJournalEditor } from '@/hooks/journal/useJournalEditor';
import EntryList from '@/components/journal/EntryList';
import EntryEditor from '@/components/journal/EntryEditor';

export default function EntriesScreen() {
  const { entries } = useJournal();
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const editor = useJournalEditor({ entryId: currentId || undefined });
  const isWide = Dimensions.get('window').width > 900;

  const allTags = useMemo(()=> {
    const s = new Set<string>();
    entries.forEach(e => (e.tags||[]).forEach(t=> s.add(t)));
    return Array.from(s).sort();
  }, [entries]);

  const filtered = useMemo(()=> {
    const q = search.trim().toLowerCase();
    let list = entries;
    if (q) list = list.filter(e => (e.title + e.content + (e.tags||[]).join(' ')).toLowerCase().includes(q));
    if (activeTags.length) list = list.filter(e => activeTags.every(tag => (e.tags||[]).includes(tag)));
    return list;
  }, [entries, search, activeTags]);

  const handleSelect = (id: string) => { setCurrentId(id); editor.select(id); };
  const handleNew = () => { setCurrentId(null); editor.reset(); };
  const toggleTag = (t: string) => setActiveTags(prev => prev.includes(t)? prev.filter(x=> x!==t): [...prev, t]);

  return (
    <View style={{ flex:1, flexDirection: isWide? 'row':'column' }}>
      {Platform.OS === 'web' && (
        <View style={styles.webNavStrip}>
          <Text style={styles.webNavLabel}>Quick Links:</Text>
          {[{ label:'Calendar', href:'/(dashboard)/calendar' },{ label:'Tags', href:'/(dashboard)/tags' },{ label:'Stats', href:'/(dashboard)/stats' },{ label:'Settings', href:'/(dashboard)/settings' }].map(l => (
            <Text key={l.href} onPress={()=> (require('expo-router').router.replace(l.href as any))} style={styles.webNavLink}>{l.label}</Text>
          ))}
        </View>
      )}
      <View style={!isWide ? { maxHeight:260 }: undefined}>
        <EntryList
          entries={filtered}
          activeId={currentId}
            onSelect={handleSelect}
            onNew={handleNew}
            search={search}
            onSearchChange={setSearch}
            allTags={allTags}
            activeTags={activeTags}
            onToggleTag={toggleTag}
            onClearFilters={()=> setActiveTags([])}
        />
      </View>
      <EntryEditor editor={editor} isEditingExisting={!!editor.id} wide={isWide} />
    </View>
  );
}

const styles = StyleSheet.create({
  webNavStrip: { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:8, backgroundColor:'#FFFFFF', borderBottomWidth:1, borderColor:'#E5E9EC' },
  webNavLabel: { fontSize:12, fontWeight:'600', color:'#4A5965', opacity:0.7 },
  webNavLink: { fontSize:12, color:'#0a7ea4', textDecorationLine:'underline' }
});

// Basic markdown style overrides
// markdown styles moved into EntryEditor component
