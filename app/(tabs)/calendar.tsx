import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useJournal } from '@/context/JournalContext';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/context/SubscriptionContext';
import { UpgradeRequired } from '@/components/subscription/UpgradeRequired';

// Simple month calendar (no external lib) focusing on journal days highlight

function getMonthMatrix(base: Date) {
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const firstDay = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let current = 1 - firstDay; // start from Sunday grid
  while (current <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      if (current < 1 || current > daysInMonth) week.push(null); else week.push(current);
      current++;
    }
    weeks.push(week);
  }
  return weeks;
}

export default function CalendarScreen() {
  const [cursor, setCursor] = useState(() => new Date());
  const base = cursor;
  const { entries } = useJournal();
  const router = useRouter();
  const { entitlements } = useSubscription();

  // Hooks must run unconditionally; compute entryDays first.
  const entryDays = useMemo(()=> {
    const set = new Set<string>();
    entries.forEach(e => {
      const d = new Date(e.createdAt); // group by created date
      const key = d.toISOString().slice(0,10);
      set.add(key);
    });
    return set;
  }, [entries]);

  // Capability gating: return early AFTER hooks.
  if(entitlements && !entitlements.capabilities.canCalendarExtras){
    return (
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding: 16 }}>
        <ThemedText type="title" style={{ marginBottom: 12 }}>カレンダー</ThemedText>
        <UpgradeRequired requiredCapability="Calendar Extras" />
      </ScrollView>
    );
  }

  const weeks = getMonthMatrix(base);

  return (
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding: 16 }}>
      <ThemedText type="title" style={{ marginBottom: 12 }}>カレンダー</ThemedText>
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8, gap:12 }}>
        <TouchableOpacity onPress={()=> setCursor(new Date(base.getFullYear(), base.getMonth()-1, 1))} style={styles.navBtn}><Text style={styles.navBtnText}>{'<'}</Text></TouchableOpacity>
        <ThemedText style={{ fontSize:16, fontWeight:'600' }}>{base.getFullYear()}年 {base.getMonth()+1}月</ThemedText>
        <TouchableOpacity onPress={()=> setCursor(new Date(base.getFullYear(), base.getMonth()+1, 1))} style={styles.navBtn}><Text style={styles.navBtnText}>{'>'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=> setCursor(new Date())} style={styles.todayBtn}><Text style={styles.todayText}>Today</Text></TouchableOpacity>
      </View>
      <View style={styles.weekHeader}>
        {['日','月','火','水','木','金','土'].map(d => <Text key={d} style={styles.weekHeaderText}>{d}</Text>)}
      </View>
      {weeks.map((w,i)=>(
        <View key={i} style={styles.weekRow}>
          {w.map((day,idx)=>{
            if (!day) return <View key={idx} style={[styles.dayCell, { backgroundColor:'transparent' }]} />;
            const dateStr = new Date(base.getFullYear(), base.getMonth(), day).toISOString().slice(0,10);
            const has = entryDays.has(dateStr);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.dayCell, has && styles.dayCellHas]}
                onPress={()=> router.push({ pathname: '/journal' as any, params: { date: dateStr } })}
              >
                <Text style={[styles.dayText, has && styles.dayTextHas]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <ThemedView style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor:'#0a7ea4'}]} />
        <ThemedText style={{ fontSize:12 }}>エントリあり日付</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const CELL_SIZE = 42;

const styles = StyleSheet.create({
  navBtn: { backgroundColor:'#fff', paddingHorizontal:12, paddingVertical:6, borderRadius:8, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:1 },
  navBtnText: { fontSize:16, fontWeight:'600', color:'#0a7ea4' },
  todayBtn: { backgroundColor:'#0a7ea4', paddingHorizontal:14, paddingVertical:6, borderRadius:8 },
  todayText: { color:'#fff', fontWeight:'600' },
  weekHeader: { flexDirection:'row', marginBottom:4 },
  weekHeaderText: { width: CELL_SIZE, textAlign:'center', fontWeight:'600', fontSize:12 },
  weekRow: { flexDirection:'row', marginBottom:4 },
  dayCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 12, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:1, marginRight:2 },
  dayCellHas: { backgroundColor:'#0a7ea4'},
  dayText: { fontSize:14, color:'#222' },
  dayTextHas: { color:'#fff', fontWeight:'700' },
  legendRow: { flexDirection:'row', alignItems:'center', gap:8, marginTop:16 },
  legendDot: { width:14, height:14, borderRadius:7 }
});
