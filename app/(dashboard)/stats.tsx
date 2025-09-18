import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useJournal } from '@/context/JournalContext';
import { ThemedText } from '@/components/ThemedText';
import { useSubscription } from '@/context/SubscriptionContext';
import { UpgradeRequired } from '@/components/subscription/UpgradeRequired';

// Simple donut chart for mood distribution
export default function StatsScreen(){
  const { entries } = useJournal();
  const { entitlements } = useSubscription();
  const moods = useMemo(() => ['happy','neutral','sad','angry','anxious','grateful'] as const, []);
  const counts = useMemo(()=> {
    const m: Record<string, number> = {};
    moods.forEach(x=> m[x]=0);
    entries.forEach(e => { if (e.mood && m[e.mood] !== undefined) m[e.mood]!++; });
    return m;
  }, [entries, moods]);
  if(!entitlements?.capabilities.canStats){
    return (
      <View style={styles.container}>
        <UpgradeRequired requiredCapability="stats" />
      </View>
    );
  }
  const total = Object.values(counts).reduce((a,b)=> a+b, 0) || 1;

  const size = 220;
  const stroke = 34;
  const r = (size - stroke)/2;
  const cx = size/2; const cy = size/2;
  const circumference = 2 * Math.PI * r;

  let offsetCursor = 0;
  const segments = moods.map(m => {
    const value = counts[m];
    const ratio = value/total;
    const length = ratio * circumference;
    const seg = { mood:m, value, ratio, offset: offsetCursor, length };
    offsetCursor += length;
    return seg;
  });

  const colors: Record<string,string> = {
    happy:'#FFCC4D', neutral:'#9EADB7', sad:'#5DA9E9', angry:'#F45B69', anxious:'#B784E6', grateful:'#6BCB77'
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={{ marginBottom:20 }}>Statistics</ThemedText>
      <View style={styles.chartRow}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${cx}, ${cy}`}> {/* start at top */}
            {segments.map(seg => (
              <Circle
                key={seg.mood}
                cx={cx}
                cy={cy}
                r={r}
                stroke={colors[seg.mood]}
                strokeWidth={stroke}
                strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                strokeDashoffset={seg.offset}
                fill="transparent"
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View style={styles.legend}> 
          {segments.map(s => (
            <View style={styles.legendRow} key={s.mood}>
              <View style={[styles.colorBox,{ backgroundColor: colors[s.mood] }]} />
              <Text style={styles.legendLabel}>{s.mood}</Text>
              <Text style={styles.legendValue}>{counts[s.mood]} ({Math.round(s.ratio*100)}%)</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.note}>Mood distribution across all entries.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:28 },
  chartRow:{ flexDirection:'row', gap:30, alignItems:'center', flexWrap:'wrap' },
  legend:{ gap:6 },
  legendRow:{ flexDirection:'row', alignItems:'center', gap:8 },
  colorBox:{ width:14, height:14, borderRadius:3 },
  legendLabel:{ fontSize:14, fontWeight:'600', width:80, textTransform:'capitalize', color:'#1f2d34' },
  legendValue:{ fontSize:13, color:'#4A5965' },
  note:{ marginTop:24, fontSize:12, opacity:0.6 }
});
