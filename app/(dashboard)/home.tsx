import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useJournal } from '@/context/JournalContext';
import { StorageWarningBanner } from '@/components/subscription/StorageWarningBanner';

export default function HomeDashboard() {
  const { entries } = useJournal();
  const stats = useMemo(() => {
    const total = entries.length;
    const byMood: Record<string, number> = {};
    let latest = '';
    entries.forEach(e => { if (e.mood) byMood[e.mood] = (byMood[e.mood] || 0) + 1; if (!latest || e.updatedAt > latest) latest = e.updatedAt; });
    return { total, byMood, latest };
  }, [entries]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:24 }}>
      <StorageWarningBanner />
      <ThemedText type="title" style={{ marginBottom: 20 }}>Home</ThemedText>
      <View style={styles.row}>
        <Card title="Entries" value={String(stats.total)} />
        <Card title="Last Update" value={stats.latest ? new Date(stats.latest).toLocaleDateString(): '-'} />
      </View>
      <ThemedText type="subtitle" style={{ marginTop: 24, marginBottom:12 }}>Mood</ThemedText>
      <View style={styles.moodRow}>
        {Object.keys(stats.byMood).length === 0 && <ThemedText style={{opacity:0.6}}>No mood data</ThemedText>}
        {Object.entries(stats.byMood).map(([m,c]) => <Pill key={m} label={m} count={c} />)}
      </View>
    </ScrollView>
  );
}

function Card({ title, value }: { title:string; value:string }) {
  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.cardValue}>{value}</ThemedText>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
    </ThemedView>
  );
}
function Pill({ label, count }: { label:string; count:number }) {
  return (
    <ThemedView style={styles.pill}>
      <ThemedText style={styles.pillLabel}>{label}</ThemedText>
      <ThemedText style={styles.pillCount}>{count}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1 },
  row: { flexDirection:'row', gap:16 },
  card: { flex:1, backgroundColor:'#fff', paddingVertical:24, paddingHorizontal:18, borderRadius:18, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, elevation:2 },
  cardValue: { fontSize:30, fontWeight:'700', marginBottom:4 },
  cardTitle: { fontSize:12, opacity:0.65 },
  moodRow: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  pill: { flexDirection:'row', backgroundColor:'#F2F5F8', paddingHorizontal:14, paddingVertical:8, borderRadius:999, gap:8 },
  pillLabel: { fontSize:14, fontWeight:'600' },
  pillCount: { fontSize:12, opacity:0.6 }
});
