import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen(){
  const { signInWithEmail, registerWithEmail, signInWithGoogle, signInWithApple, initializing } = useAuth();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toggle = () => setMode(m => m==='login' ? 'register':'login');

  const submit = async () => {
    if(loading) return; setLoading(true);
    try {
      if(mode==='login') await signInWithEmail(email, password); else await registerWithEmail(email, password);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: mode==='login'? 'Login':'Register', headerShown:false }} />
      <Text style={styles.title}>Journal Login</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize='none' keyboardType='email-address' value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode==='login'? 'Sign In':'Create Account'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={toggle} style={styles.linkBtn}><Text style={styles.linkText}>{mode==='login'? 'Need an account? Register':'Have an account? Login'}</Text></TouchableOpacity>
      <View style={styles.divider}><Text style={styles.dividerText}>OR</Text></View>
      <TouchableOpacity style={styles.secondaryBtn} onPress={signInWithGoogle}>
        <Text style={styles.secondaryText}>Continue with Google</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ width:'100%', height:50, marginTop:12 }}
          onPress={signInWithApple}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{ flex:1, alignItems:'center', justifyContent:'center', padding:28, backgroundColor:'#f5f7fa' },
  title:{ fontSize:26, fontWeight:'700', marginBottom:24 },
  input:{ width:'100%', borderWidth:1, borderColor:'#cdd5dd', borderRadius:10, paddingHorizontal:14, height:48, backgroundColor:'#fff', marginBottom:12 },
  primaryBtn:{ width:'100%', backgroundColor:'#0a7ea4', paddingVertical:14, borderRadius:10, alignItems:'center', marginTop:4 },
  primaryText:{ color:'#fff', fontWeight:'600', fontSize:16 },
  linkBtn:{ marginTop:12 },
  linkText:{ color:'#0a7ea4', fontSize:13 },
  divider:{ marginVertical:20 },
  dividerText:{ color:'#68727a', fontSize:12, letterSpacing:1 },
  secondaryBtn:{ width:'100%', backgroundColor:'#fff', borderWidth:1, borderColor:'#cfd6dc', paddingVertical:14, borderRadius:10, alignItems:'center' },
  secondaryText:{ color:'#222', fontWeight:'600' }
});
