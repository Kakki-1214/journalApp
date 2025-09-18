import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useJournal } from '@/context/JournalContext';

export default function MyPageScreen() {
  const { entries } = useJournal();
  const stats = useMemo(() => {
    const total = entries.length;
    const byMood: Record<string, number> = {};
    let latest = '';
    entries.forEach(e => {
      if (e.mood) byMood[e.mood] = (byMood[e.mood] || 0) + 1;
      if (!latest || e.updatedAt > latest) latest = e.updatedAt;
    });
    return { total, byMood, latest };
  }, [entries]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <ThemedText type="title" style={styles.heading}>マイページ</ThemedText>
      <View style={styles.cardRow}>
        <StatsCard label="エントリ" value={String(stats.total)} />
        <StatsCard label="最終更新" value={stats.latest ? new Date(stats.latest).toLocaleDateString() : '-'} />
      </View>
      <ThemedText type="subtitle" style={styles.sectionTitle}>ムード別</ThemedText>
      <View style={styles.moodGrid}>
        {Object.keys(stats.byMood).length === 0 && <ThemedText style={{opacity:0.6}}>まだムードデータがありません</ThemedText>}
        {Object.entries(stats.byMood).map(([mood,count]) => (
          <MoodPill key={mood} mood={mood} count={count} />
        ))}
      </View>
    </ScrollView>
  );
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.statsCard}>
      <ThemedText style={styles.statsValue}>{value}</ThemedText>
      <ThemedText style={styles.statsLabel}>{label}</ThemedText>
    </ThemedView>
  );
}

function MoodPill({ mood, count }: { mood: string; count: number }) {
  return (
    <ThemedView style={styles.moodPill}>
      <ThemedText style={styles.moodText}>{mood}</ThemedText>
      <ThemedText style={styles.moodCount}>{count}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { marginBottom: 16 },
  cardRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statsCard: { flex:1, backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 16, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  statsValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statsLabel: { fontSize: 12, opacity: 0.7 },
  sectionTitle: { marginBottom: 12 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodPill: { flexDirection:'row', alignItems:'center', backgroundColor:'#F5F7FA', paddingHorizontal:14, paddingVertical:8, borderRadius:999 },
  moodText: { fontSize:14, fontWeight:'600', marginRight:6 },
  moodCount: { fontSize:12, opacity:0.7 }
});
