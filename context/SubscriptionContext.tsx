import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';

// 型変更により IAPProduct が存在しないバージョン向けに動的派生型を定義
type DerivedIAPProduct = NonNullable<
  Awaited<ReturnType<typeof InAppPurchases.getProductsAsync>>['results']
>[number];

interface EntitlementsData {
  tier: 'free' | 'pro' | 'lifetime';
  isPro: boolean;
  isLifetime: boolean;
  capabilities: { canTag: boolean; canStats: boolean; canCalendarExtras: boolean };
  storage: { usedBytes: number; limitBytes: number };
}

interface SubscriptionContextValue {
  isPro: boolean;
  loading: boolean;
  products: DerivedIAPProduct[];
  purchasing: boolean;
  error?: string | null;
  entitlements?: EntitlementsData;
  refreshEntitlements(): Promise<void>;
  purchase(productId: string): Promise<void>;
  restore(): Promise<void>;
  refreshProducts(): Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const RECEIPT_CACHE_KEY = 'iap_receipts_v1';

function productIdsFromExtra(){
  const extra = (Constants.expoConfig as any)?.extra?.iap?.productIds || {};
  if(Platform.OS === 'ios' && extra.ios) return extra.ios as string[];
  if(Platform.OS === 'android' && extra.android) return extra.android as string[];
  return extra.fallback || [];
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<DerivedIAPProduct[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementsData | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const loadProducts = async () => {
    try {
      const ids = productIdsFromExtra();
      const { responseCode, results } = await InAppPurchases.getProductsAsync(ids);
      if (results) setProducts(results as DerivedIAPProduct[]);
      if (responseCode && responseCode !== (InAppPurchases as any).IAPResponseCode?.OK) {
        setError('Store response not OK');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    }
  };

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    if(!token) return {} as Record<string,string>;
    return { Authorization: `Bearer ${token}` };
  }, [getToken]);

  const fetchEntitlements = useCallback(async () => {
    try {
      const base = (Constants.expoConfig as any)?.extra?.apiBaseUrl || '';
      const resp = await fetch(base + '/entitlements', { headers: await authHeaders() });
      if(!resp.ok) throw new Error('entitlements fetch failed');
      const json = await resp.json();
      if(json?.data){
        setEntitlements(json.data);
        if(json.data.isPro && !isPro) setIsPro(true);
      }
    } catch { /* silent */ }
  }, [isPro, authHeaders]);

  const verifyPurchase = useCallback(async (purchase: any) => {
    try {
      const base = (Constants.expoConfig as any)?.extra?.apiBaseUrl || '';
      const headers = { 'Content-Type':'application/json', ...(await authHeaders()) };
      // platform 判定 (Android: purchase.productId & purchase.purchaseToken, iOS: transactionReceipt)
      const isIos = Platform.OS === 'ios';
      const receiptData = isIos ? purchase.transactionReceipt || purchase.originalJson : purchase.purchaseToken || purchase.orderId;
      if(!receiptData) return;
      const body = JSON.stringify({ platform: isIos ? 'ios':'android', receipt: receiptData, productId: purchase.productId });
      const resp = await fetch(base + '/iap/verify', { method:'POST', headers, body });
      if(resp.ok) {
        await fetchEntitlements();
      }
    } catch {}
  }, [authHeaders, fetchEntitlements]);

  useEffect(() => {
    (async () => {
      try {
        await InAppPurchases.connectAsync();
  InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
          if (errorCode) {
            setError('Purchase failed: ' + errorCode);
            setPurchasing(false);
            return;
          }
          if (results) {
            for (const purchase of results as any[]) {
              if (!purchase.acknowledged) {
                setIsPro(true);
                try {
                  const existingRaw = await SecureStore.getItemAsync(RECEIPT_CACHE_KEY);
                  const arr = existingRaw ? JSON.parse(existingRaw) : [];
                  arr.push({ productId: purchase.productId, purchaseTime: Date.now(), platform: purchase.platform || 'unknown', raw: purchase });
                  await SecureStore.setItemAsync(RECEIPT_CACHE_KEY, JSON.stringify(arr.slice(-50)));
                } catch {}
    // サーバ検証
    await verifyPurchase(purchase);
                try { await InAppPurchases.finishTransactionAsync(purchase, true); } catch {}
              }
            }
          }
          setPurchasing(false);
        });
        await loadProducts();
        try {
          const cached = await SecureStore.getItemAsync(RECEIPT_CACHE_KEY);
          if (cached) {
            const arr = JSON.parse(cached);
            if (Array.isArray(arr) && arr.length) setIsPro(true);
          }
        } catch {}
        await fetchEntitlements();
      } catch (e) {
        setError((e as any)?.message || 'IAP init failed');
      } finally {
        setLoading(false);
      }
    })();
    return () => { InAppPurchases.disconnectAsync(); };
  }, [fetchEntitlements, verifyPurchase]);

  const purchase = async (productId: string) => {
    // Central entry: initiates purchase. Verification + entitlements refresh are handled in the purchase listener via verifyPurchase().
    if (purchasing) return; setError(null); setPurchasing(true);
    try {
      await InAppPurchases.purchaseItemAsync(productId);
    } catch (e: any) {
      setError(e?.message || 'Purchase failed');
      setPurchasing(false);
    }
  };
  const restore = async () => {
    setError(null);
    try {
      const { results } = await InAppPurchases.getPurchaseHistoryAsync();
      if(results?.length) {
        setIsPro(true);
        // Cache latest history
        try { await SecureStore.setItemAsync(RECEIPT_CACHE_KEY, JSON.stringify(results.slice(-50))); } catch {}
        // Server-side verification for each (best-effort sequential to avoid burst)
        for (const p of results as any[]) {
          try { await verifyPurchase(p); } catch { /* ignore per item */ }
        }
        await fetchEntitlements();
      }
    } catch (e: any) {
      setError(e?.message || 'Restore failed');
    }
  };

  const refreshProducts = async () => { setError(null); await loadProducts(); };
  const refreshEntitlements = async () => { await fetchEntitlements(); };

  return (
  <SubscriptionContext.Provider value={{ isPro, loading, products, purchasing, error, entitlements, refreshEntitlements, purchase, restore, refreshProducts }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if(!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
