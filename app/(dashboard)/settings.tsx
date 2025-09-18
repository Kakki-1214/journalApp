import React from 'react';
import { ScrollView, View, TouchableOpacity, Linking, Modal, Pressable, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import UpgradePanel from '@/components/subscription/UpgradePanel';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const supportEmail = (Constants.expoConfig?.extra as any)?.supportEmail || 'support@example.com';
  const mailto = `mailto:${supportEmail}`;
  const { signOut } = useAuth();
  const [showDelete, setShowDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const handleDelete = async () => {
    if(deleting) return;
    setDeleting(true);
    try {
      // Call backend delete
      await fetch(process.env.EXPO_PUBLIC_API_BASE_URL + '/account', { method:'DELETE', headers:{ 'Content-Type':'application/json' }}).catch(()=>{});
      await signOut();
      setShowDelete(false);
    } finally { setDeleting(false); }
  };
  return (
    <>
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:24 }}>
      <ThemedText type="title" style={{ marginBottom:20 }}>Settings</ThemedText>
      <UpgradePanel />
      <View style={{ height:28 }} />
      <ThemedText type="defaultSemiBold" style={{ marginBottom:8 }}>Legal & Support</ThemedText>
      <View style={{ gap:8 }}>
        <Link href="../legal/privacy" asChild>
          <TouchableOpacity style={{ paddingVertical:10 }}>
            <ThemedText>Privacy Policy</ThemedText>
          </TouchableOpacity>
        </Link>
        <Link href="../legal/terms" asChild>
          <TouchableOpacity style={{ paddingVertical:10 }}>
            <ThemedText>Terms of Service</ThemedText>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={{ paddingVertical:10 }} onPress={()=>Linking.openURL(mailto)}>
          <ThemedText>Contact Support ({supportEmail})</ThemedText>
        </TouchableOpacity>
      </View>
      <View style={{ height:40 }} />
      <ThemedText type="defaultSemiBold" style={{ marginBottom:8, color:'#b00020' }}>Danger Zone</ThemedText>
      <View style={{ gap:12 }}>
        <TouchableOpacity style={{ backgroundColor:'#fff5f5', borderWidth:1, borderColor:'#ffb4b4', padding:14, borderRadius:12 }} onPress={() => setShowDelete(true)}>
          <ThemedText style={{ color:'#b00020', fontWeight:'600' }}>Delete Account</ThemedText>
          <ThemedText style={{ fontSize:12, color:'#b45b5b', marginTop:4 }}>Permanently removes your data. This cannot be undone.</ThemedText>
        </TouchableOpacity>
      </View>
      <View style={{ height:32 }} />
      <ThemedText style={{ fontSize:12, color:'#55616a' }}>Other settings coming soon.</ThemedText>
    </ScrollView>
    <Modal transparent visible={showDelete} animationType="fade" onRequestClose={()=>!deleting && setShowDelete(false)}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', padding:24 }}>
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:20 }}>
          <ThemedText type="title" style={{ fontSize:18 }}>Confirm Deletion</ThemedText>
          <ThemedText style={{ marginTop:12, fontSize:13, lineHeight:18 }}>This will permanently delete your account & journal data. This action cannot be undone. Are you sure?</ThemedText>
          <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:20, gap:12 }}>
            <Pressable disabled={deleting} onPress={()=> setShowDelete(false)} style={{ paddingVertical:10, paddingHorizontal:16 }}>
              <ThemedText style={{ color:'#444' }}>Cancel</ThemedText>
            </Pressable>
            <Pressable disabled={deleting} onPress={handleDelete} style={{ backgroundColor:'#b00020', paddingVertical:10, paddingHorizontal:18, borderRadius:8 }}>
              {deleting ? <ActivityIndicator color="#fff" /> : <ThemedText style={{ color:'#fff', fontWeight:'600' }}>Delete</ThemedText>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}
