import React from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, StyleSheet } from 'react-native';
import { JournalEntry } from '@/types/journal';

export interface EntryListProps {
  entries: JournalEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  allTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
}

export const EntryList: React.FC<EntryListProps> = ({ entries, activeId, onSelect, onNew, search, onSearchChange, allTags, activeTags, onToggleTag, onClearFilters }) => {
  return (
    <View style={styles.listPane}>
      <View style={styles.listHeader}>
        <TextInput placeholder="Search" value={search} onChangeText={onSearchChange} style={styles.searchInput} />
        <TouchableOpacity onPress={onNew} style={styles.newBtn}><Text style={styles.newBtnText}>＋</Text></TouchableOpacity>
      </View>
      {allTags.length > 0 && (
        <View style={styles.filterTagWrap}>
          {allTags.map(t => {
            const on = activeTags.includes(t);
            return (
              <TouchableOpacity key={t} onPress={()=> onToggleTag(t)} style={[styles.filterTag, on && styles.filterTagOn]}>
                <Text style={[styles.filterTagText, on && styles.filterTagTextOn]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
          {activeTags.length > 0 && (
            <TouchableOpacity onPress={onClearFilters} style={styles.clearFilterBtn}><Text style={styles.clearFilterText}>Clear</Text></TouchableOpacity>
          )}
        </View>
      )}
      <FlatList
        data={entries}
        keyExtractor={i=> i.id}
        contentContainerStyle={{ paddingVertical:4 }}
        renderItem={({ item }) => {
          const active = item.id === activeId;
          return (
            <TouchableOpacity onPress={()=> onSelect(item.id)} style={[styles.entryRow, active && styles.entryRowActive]}>
              <Text style={styles.entryRowTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
              <Text style={styles.entryRowDate}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ opacity:0.5, padding:12 }}>No entries</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listPane: { width:300, backgroundColor:'#F1F4F6', borderRightWidth:1, borderColor:'#E1E6EA' },
  listHeader: { flexDirection:'row', gap:8, padding:14, paddingBottom:8 },
  searchInput: { flex:1, borderWidth:1, borderColor:'#D0D7DD', backgroundColor:'#fff', borderRadius:8, paddingHorizontal:10, height:40 },
  newBtn: { width:40, height:40, backgroundColor:'#0a7ea4', borderRadius:8, alignItems:'center', justifyContent:'center' },
  newBtnText: { color:'#fff', fontSize:26, marginTop:-4 },
  filterTagWrap: { flexDirection:'row', flexWrap:'wrap', gap:6, paddingHorizontal:10, paddingBottom:6 },
  filterTag: { backgroundColor:'#EEF1F3', paddingHorizontal:10, paddingVertical:6, borderRadius:20 },
  filterTagOn: { backgroundColor:'#0a7ea4' },
  filterTagText: { fontSize:11, color:'#444', fontWeight:'600' },
  filterTagTextOn: { color:'#fff' },
  clearFilterBtn: { backgroundColor:'#d4dde2', paddingHorizontal:10, paddingVertical:6, borderRadius:16 },
  clearFilterText: { fontSize:11, color:'#333' },
  entryRow: { paddingVertical:10, paddingHorizontal:14, borderBottomWidth:1, borderColor:'#E4E9EC' },
  entryRowActive: { backgroundColor:'#E8F4F8' },
  entryRowTitle: { fontSize:14, fontWeight:'600', marginBottom:2 },
  entryRowDate: { fontSize:10, opacity:0.6 }
});

export default EntryList;
