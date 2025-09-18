import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useSubscription } from '@/context/SubscriptionContext';
import { Stack, useRouter } from 'expo-router';

export default function UpgradeScreen(){
  const { products, purchase, purchasing, entitlements, loading, error, restore } = useSubscription();
  const router = useRouter();
  const lifetimeCandidates = products.filter(p => /life|lifetime|永久|買い切り/i.test(p.title));
  const subsCandidates = products.filter(p => !/life|lifetime|永久|買い切り/i.test(p.title));
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding:24 }}>
      <Stack.Screen options={{ title:'Upgrade' }} />
      <Text style={styles.header}>アップグレード</Text>
      {entitlements?.isPro && (
        <View style={styles.badge}><Text style={styles.badgeText}>{entitlements.isLifetime ? 'LIFETIME アクティブ' : 'PRO アクティブ'}</Text></View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator style={{ marginVertical:16 }} />}

      <Text style={styles.sectionTitle}>サブスクリプション</Text>
      {subsCandidates.length === 0 && <Text style={styles.dim}>商品が見つかりません</Text>}
      {subsCandidates.map(p => (
        <ProductCard key={p.productId} product={p} onPress={() => purchase(p.productId)} loading={purchasing} />
      ))}

      <Text style={styles.sectionTitle}>買い切り / Lifetime</Text>
      {lifetimeCandidates.length === 0 && <Text style={styles.dim}>商品が見つかりません</Text>}
      {lifetimeCandidates.map(p => (
        <ProductCard key={p.productId} product={p} onPress={() => purchase(p.productId)} loading={purchasing} lifetime />
      ))}

      <View style={styles.linksBox}>
        <TouchableOpacity onPress={()=> Linking.openURL('https://example.com/terms')}><Text style={styles.link}>利用規約</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=> Linking.openURL('https://example.com/privacy')}><Text style={styles.link}>プライバシー</Text></TouchableOpacity>
        <TouchableOpacity onPress={restore}><Text style={styles.link}>購入を復元</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={()=> router.back()}><Text style={styles.closeText}>閉じる</Text></TouchableOpacity>
    </ScrollView>
  );
}

function ProductCard({ product, onPress, loading, lifetime }: { product:any; onPress:()=>void; loading:boolean; lifetime?:boolean }){
  return (
    <View style={styles.card}>
      <View style={{ flex:1 }}>
        <Text style={styles.cardTitle}>{product.title}</Text>
        {product.description ? <Text style={styles.cardDesc}>{product.description}</Text> : null}
        <Text style={styles.price}>{product.price ? product.price : ''} {lifetime && <Text style={styles.lifetimeTag}>LIFETIME</Text>}</Text>
      </View>
      <TouchableOpacity style={styles.buyBtn} disabled={loading} onPress={onPress}>
        <Text style={styles.buyText}>{loading ? '処理中...' : '購入'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{ flex:1, backgroundColor:'#f6f8fa' },
  header:{ fontSize:24, fontWeight:'700', marginBottom:16 },
  badge:{ alignSelf:'flex-start', backgroundColor:'#0a7ea4', paddingHorizontal:12, paddingVertical:6, borderRadius:20, marginBottom:12 },
  badgeText:{ color:'#fff', fontWeight:'600', fontSize:12 },
  sectionTitle:{ fontSize:16, fontWeight:'700', marginTop:24, marginBottom:8 },
  dim:{ fontSize:12, opacity:0.6 },
  card:{ flexDirection:'row', backgroundColor:'#fff', padding:16, borderRadius:14, marginBottom:12, gap:12, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardTitle:{ fontSize:16, fontWeight:'600', marginBottom:4 },
  cardDesc:{ fontSize:12, color:'#555', marginBottom:6 },
  price:{ fontSize:14, fontWeight:'600', color:'#222' },
  lifetimeTag:{ fontSize:10, color:'#fff', backgroundColor:'#ff9800', paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  buyBtn:{ backgroundColor:'#0a7ea4', alignSelf:'center', paddingHorizontal:16, paddingVertical:10, borderRadius:10 },
  buyText:{ color:'#fff', fontWeight:'600' },
  linksBox:{ flexDirection:'row', flexWrap:'wrap', gap:16, marginTop:32 },
  link:{ color:'#0a7ea4', fontSize:12 },
  error:{ color:'#d33', fontSize:12, marginBottom:12 },
  closeBtn:{ marginTop:40, alignSelf:'center', paddingVertical:10, paddingHorizontal:24, backgroundColor:'#e1e6ea', borderRadius:30 },
  closeText:{ fontSize:14, fontWeight:'600', color:'#333' }
});
