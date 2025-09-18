import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useJournal } from '@/context/JournalContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSubscription } from '@/context/SubscriptionContext';
import { UpgradeRequired } from '@/components/subscription/UpgradeRequired';

export default function TagsScreen() {
  const { entries } = useJournal();
  const { entitlements } = useSubscription();
  const canTag = entitlements?.capabilities.canTag;
  const tags = useMemo(()=>{
    const map: Record<string, number> = {};
    entries.forEach(e => (e.tags||[]).forEach(t => { map[t] = (map[t]||0)+1; }));
    return Object.entries(map).sort((a,b)=> b[1]-a[1]);
  }, [entries]);
  if(!canTag) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding:24 }}>
        <UpgradeRequired requiredCapability="tags" />
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:24 }}>
      <ThemedText type="title" style={{ marginBottom:20 }}>Tags</ThemedText>
      <View style={styles.wrap}>
        {tags.length === 0 && <ThemedText style={{opacity:0.6}}>No tags yet</ThemedText>}
        {tags.map(([tag,count]) => (
          <ThemedView key={tag} style={styles.tagCard}>
            <ThemedText style={styles.tagName}>{tag}</ThemedText>
            <ThemedText style={styles.tagCount}>{count}</ThemedText>
          </ThemedView>
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container:{ flex:1 },
  wrap: { flexDirection:'row', flexWrap:'wrap', gap:14 },
  tagCard: { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, borderRadius:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, elevation:2, minWidth:100, alignItems:'center' },
  tagName: { fontWeight:'600', marginBottom:4 },
  tagCount: { fontSize:12, opacity:0.6 }
});
