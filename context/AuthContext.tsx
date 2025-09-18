import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri, AuthSessionResult } from 'expo-auth-session';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

export interface AuthUser { id: string; email?: string; name?: string; provider: 'anonymous'|'email'|'google'|'apple'; }
interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  registerWithEmail(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  getToken(): Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'auth_session_v1';
const TOKEN_KEY = 'auth_jwt_v1';
const APPLE_PROFILE_PREFIX = 'apple_profile_v1_';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleClientIds = (Constants.expoConfig?.extra as any)?.googleClientIds || {};

  // 動的に discovery を構築 (Google OpenID endpoints)
  const googleDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke'
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch {}
      setInitializing(false);
    })();
  }, []);

  const persist = async (u: AuthUser | null, token?: string | null) => {
    setUser(u);
    if (u) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(u)); else await SecureStore.deleteItemAsync(STORAGE_KEY);
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token); else if(token === null) await SecureStore.deleteItemAsync(TOKEN_KEY);
  };

  async function backendAuth(path: string, body: any){
    const base = (Constants.expoConfig as any)?.extra?.apiBaseUrl || '';
    const resp = await fetch(base + path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if(!resp.ok) throw new Error('AUTH_FAILED');
  const json = await resp.json();
  // Backend currently wraps as { success, data: {...} } – unwrap if present for forward compatibility
  if(json && json.data && (json.data.token || json.data.user)) return json.data;
  return json;
  }
  const signInWithEmail = async (email: string, password: string) => {
    const json = await backendAuth('/auth/login', { email, password });
  await persist({ id: json.user.id, email: json.user.email, provider: 'email' }, json.token);
  };
  const registerWithEmail = async (email: string, password: string) => {
    const json = await backendAuth('/auth/register', { email, password });
  await persist({ id: json.user.id, email: json.user.email, provider: 'email' }, json.token);
  };

  const signInWithGoogle = async () => {
    if (googleLoading) return; setGoogleLoading(true);
    try {
      const clientId = Platform.select({
        ios: googleClientIds.ios,
        android: googleClientIds.android,
        web: googleClientIds.web,
        default: googleClientIds.expo || googleClientIds.web
      });
      if(!clientId) throw new Error('Missing Google clientId (set EXPO_PUBLIC_GOOGLE_* env vars)');

  const redirectUri = makeRedirectUri({});
      const authUrl = `${googleDiscovery.authorizationEndpoint}?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code&scope=${encodeURIComponent('profile email')}` +
        `&access_type=offline&prompt=select_account`;

  // startAsync が型エクスポートされていないため名前空間経由
  const result = await (AuthSession as any).startAsync({ authUrl }) as AuthSessionResult & { params: { code?: string } };
      if (result.type === 'success' && result.params.code) {
        // 通常はここでバックエンドへ code を送りトークン交換
        const pseudoEmail = 'user+' + result.params.code.slice(0,8) + '@google-oauth.local';
  await persist({ id: 'google:' + result.params.code, provider: 'google', email: pseudoEmail });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME
        ]
      });

      const id = credential.user; // stable Apple user identifier per app team
      let email = credential.email ?? undefined;
      let name: string | undefined = undefined;

      if (credential.fullName) {
        const { givenName, familyName, nickname } = credential.fullName as any;
        name = [givenName, familyName].filter(Boolean).join(' ') || nickname;
      }

      // Apple は初回のみ email / fullName を返すためローカルに保存
      const profileKey = APPLE_PROFILE_PREFIX + id;
      if (email || name) {
        await SecureStore.setItemAsync(profileKey, JSON.stringify({ email, name }));
      } else {
        // 2 回目以降は保存済みから復元
        const stored = await SecureStore.getItemAsync(profileKey);
        if (stored) {
          try { const parsed = JSON.parse(stored); email = email || parsed.email; name = name || parsed.name; } catch {}
        }
      }

      await persist({ id, email, name, provider: 'apple' });
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; throw e;
    }
  };

  const signOut = async () => { await persist(null, null); };

  const getToken = async () => {
    try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
  };

  return (
  <AuthContext.Provider value={{ user, initializing, signInWithEmail, registerWithEmail, signInWithGoogle, signInWithApple, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
