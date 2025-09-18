import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSubscription } from '@/context/SubscriptionContext';

interface Props { compact?: boolean; }

export const UpgradePanel: React.FC<Props> = ({ compact }) => {
  const { isPro, products, purchase, restore, loading, purchasing, error, refreshProducts } = useSubscription();
  const product = products[0];
  const [agreed, setAgreed] = React.useState(false);
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.title}>{isPro ? 'Pro Plan Active' : 'Upgrade to Pro'}</Text>
      {isPro ? (
        <Text style={styles.desc}>Thank you for supporting development. All premium features are unlocked.</Text>
      ) : (
        <Text style={styles.desc}>Unlock unlimited journaling potential (future: cloud sync, encryption, advanced stats).</Text>
      )}
      {!isPro && (
        <>
          <View style={{ backgroundColor:'#f6f8f9', padding:12, borderRadius:10, marginTop:12 }}>
            <Text style={{ fontSize:12, color:'#374049', lineHeight:16 }}>
              Subscription auto-renews until cancelled. Manage or cancel anytime in your App Store / Google Play account settings. Prices may vary by region. By continuing you agree to our
              {' '}<Text style={{ color:'#0a7ea4', textDecorationLine:'underline' }} onPress={()=>{} /* navigation handled by parent if needed */}>Terms</Text>
              {' '}and{' '}
              <Text style={{ color:'#0a7ea4', textDecorationLine:'underline' }} onPress={()=>{}}>Privacy Policy</Text>.
            </Text>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', marginTop:10 }}>
            <TouchableOpacity onPress={()=>setAgreed(v=>!v)} style={{ width:22, height:22, borderWidth:1, borderColor:'#0a7ea4', borderRadius:4, alignItems:'center', justifyContent:'center', marginRight:8, backgroundColor: agreed ? '#0a7ea4' : 'transparent' }}>
              {agreed && <Text style={{ color:'#fff', fontSize:14 }}>✓</Text>}
            </TouchableOpacity>
            <Text style={{ fontSize:12, color:'#2f3a43' }}>I have read and agree</Text>
          </View>
        </>
      )}
      {!isPro && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.primary, (!agreed || !product || purchasing) && { opacity:0.5 }]} disabled={!product || purchasing || !agreed} onPress={() => product && agreed && purchase(product.productId)}>
            {purchasing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{product ? `Subscribe (${product.price || '...'})` : 'Loading...'}</Text>}
          </TouchableOpacity>
          <View style={{ flexDirection:'column' }}>
            <TouchableOpacity style={[styles.btn, styles.secondary, { minWidth:140 }]} disabled={purchasing} onPress={restore}>
              <Text style={[styles.btnText, styles.secondaryText]}>Restore Purchases</Text>
            </TouchableOpacity>
            <Text style={{ fontSize:10, color:'#5a6670', marginTop:4, maxWidth:150 }}>If you already subscribed on another device.</Text>
          </View>
          <TouchableOpacity style={[styles.btn, styles.secondary]} disabled={purchasing || loading} onPress={refreshProducts}>
            <Text style={[styles.btnText, styles.secondaryText]}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card:{ backgroundColor:'#fff', borderRadius:16, padding:20, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:8, shadowOffset:{width:0,height:4}, borderWidth:1, borderColor:'#e3e8ec', marginVertical:12 },
  compact:{ padding:14 },
  title:{ fontSize:18, fontWeight:'700', marginBottom:6 },
  desc:{ fontSize:13, color:'#4a5560', lineHeight:18 },
  actions:{ flexDirection:'row', flexWrap:'wrap', marginTop:14, gap:8 },
  btn:{ paddingHorizontal:16, paddingVertical:12, borderRadius:10, minWidth:120, alignItems:'center', justifyContent:'center' },
  primary:{ backgroundColor:'#0a7ea4' },
  btnText:{ color:'#fff', fontWeight:'600', fontSize:14 },
  secondary:{ backgroundColor:'#f2f5f7' },
  secondaryText:{ color:'#0a7ea4' },
  error:{ color:'#b00020', marginTop:10, fontSize:12 }
});

export default UpgradePanel;
