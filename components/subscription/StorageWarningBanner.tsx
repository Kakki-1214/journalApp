import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSubscription } from '@/context/SubscriptionContext';

interface Props { onUpgrade?: () => void }

export const StorageWarningBanner: React.FC<Props> = ({ onUpgrade }) => {
  const { entitlements } = useSubscription();
  if(!entitlements) return null;
  const { usedBytes, limitBytes } = entitlements.storage;
  if(limitBytes <= 0) return null;
  const pct = usedBytes / limitBytes;
  if(pct < 0.9) return null; // below threshold
  const percentDisplay = Math.min(100, Math.round(pct*100));
  function format(bytes:number){
    if(bytes < 1024) return `${bytes}B`;
    if(bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
    return `${(bytes/1024/1024).toFixed(1)}MB`;
  }
  return (
    <View style={[styles.container, pct >= 1 && styles.full]}>
      <View style={{ flex:1 }}>
        <Text style={styles.title}>{pct >= 1 ? 'ストレージ上限に達しました' : 'ストレージ残量が少なくなっています'}</Text>
        <Text style={styles.desc}>利用状況: {format(usedBytes)} / {format(limitBytes)} ({percentDisplay}%)</Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={onUpgrade}>
        <Text style={styles.btnText}>{pct >= 1 ? 'アップグレード' : '容量を増やす'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#FFF4D1', borderRadius:12, padding:14, borderWidth:1, borderColor:'#F2D48A', marginBottom:16 },
  full: { backgroundColor:'#FFE0E0', borderColor:'#F5A3A3' },
  title: { fontSize:14, fontWeight:'600', marginBottom:2 },
  desc: { fontSize:12, color:'#444' },
  btn: { backgroundColor:'#0a7ea4', borderRadius:8, paddingVertical:8, paddingHorizontal:14 },
  btnText: { color:'#fff', fontSize:12, fontWeight:'600' }
});
