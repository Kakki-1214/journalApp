const fetchFn: typeof fetch = (globalThis as any).fetch.bind(globalThis);
import jwt from 'jsonwebtoken';
import { CONFIG } from './config';

const TEST_MODE = process.env.IAP_TEST_MODE === '1';

export interface VerifyResult {
  success: boolean;
  productId?: string;
  expiresAt?: string | null;
  errorCode?: string;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
}

// Apple receipt verification
export async function verifyAppleReceipt(receipt: string): Promise<VerifyResult> {
  if(TEST_MODE) {
    // Accept any non-empty receipt; encode simple scenario tokens: expired:<ms> or product:<id>
    if(!receipt) return { success:false, errorCode:'TEST_EMPTY_RECEIPT' };
    let productId = 'test_product_ios';
    let expiresAt: string | null = null;
    if(receipt.startsWith('product:')) productId = receipt.split(':')[1] || productId;
    if(receipt.startsWith('expired:') || receipt.startsWith('past:')) {
      let pastMs = 3600_000;
      const parts = receipt.split(':');
      if(parts[1] && /^\d+$/.test(parts[1])) pastMs = parseInt(parts[1],10);
      expiresAt = new Date(Date.now() - pastMs).toISOString();
    } else if(receipt.startsWith('future:')) {
      let futureMs = 3600_000;
      const parts = receipt.split(':');
      if(parts[1] && /^\d+$/.test(parts[1])) futureMs = parseInt(parts[1],10);
      expiresAt = new Date(Date.now() + futureMs).toISOString();
    } else {
      const future = Date.now() + 3600_000; // default 1h ahead
      expiresAt = new Date(future).toISOString();
    }
    return { success:true, productId, expiresAt, originalTransactionId: 'test-original-tx' };
  }
  if(!CONFIG.apple.sharedSecret) {
    return { success:false, errorCode:'APPLE_SHARED_SECRET_MISSING' };
  }
  const body = { 'receipt-data': receipt, password: CONFIG.apple.sharedSecret, 'exclude-old-transactions': true };
  const endpoints = [
    'https://buy.itunes.apple.com/verifyReceipt',
    'https://sandbox.itunes.apple.com/verifyReceipt'
  ];
  let last: any = null;
  for (let i=0;i<endpoints.length;i++) {
  const resp = await fetchFn(endpoints[i], { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    last = await resp.json();
    if(last.status === 21007 && i === 0) continue; // retry on sandbox receipt
    break;
  }
  if(last?.status !== 0) {
    // Map common Apple status codes
    const appleMap: Record<number,string> = {
      21000: 'APPLE_ERR_BAD_JSON',
      21002: 'APPLE_ERR_RECEIPT_DATA_MALFORMED',
      21003: 'APPLE_ERR_RECEIPT_AUTH_FAILED',
      21004: 'APPLE_ERR_SHARED_SECRET_MISMATCH',
      21005: 'APPLE_ERR_SERVER_UNAVAILABLE',
      21006: 'APPLE_ERR_SUB_EXPIRED',
      21007: 'APPLE_ERR_SANDBOX_RECEIPT_ON_PROD',
      21008: 'APPLE_ERR_PROD_RECEIPT_ON_SANDBOX',
      21010: 'APPLE_ERR_USER_CANCELLED'
    };
    const mapped = appleMap[last?.status] || ('APPLE_STATUS_'+ last?.status);
    return { success:false, errorCode: mapped };
  }
  const latest = last.latest_receipt_info?.[last.latest_receipt_info.length-1];
  const productId = latest?.product_id;
  // Apple returns ms epoch in string (purchase_date_ms / expires_date_ms)
  const expiresMs = latest?.expires_date_ms ? parseInt(latest.expires_date_ms,10) : undefined;
  const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;
  const originalTransactionId = latest?.original_transaction_id || latest?.transaction_id || null;
  return { success:true, productId, expiresAt, originalTransactionId };
}

// Google subscription verification
export async function verifyGoogleSubscription(purchaseToken: string, productId?: string): Promise<VerifyResult> {
  if(TEST_MODE) {
    if(!purchaseToken) return { success:false, errorCode:'TEST_EMPTY_TOKEN' };
    const pid = productId || 'test_product_android';
    let expiresAt: string | null;
    if(purchaseToken.startsWith('expired:') || purchaseToken.startsWith('past:')) {
      let pastMs = 3600_000;
      const parts = purchaseToken.split(':');
      if(parts[1] && /^\d+$/.test(parts[1])) pastMs = parseInt(parts[1],10);
      expiresAt = new Date(Date.now()-pastMs).toISOString();
    } else if(purchaseToken.startsWith('future:')) {
      let futureMs = 3600_000;
      const parts = purchaseToken.split(':');
      if(parts[1] && /^\d+$/.test(parts[1])) futureMs = parseInt(parts[1],10);
      expiresAt = new Date(Date.now()+futureMs).toISOString();
    } else {
      expiresAt = new Date(Date.now()+3600_000).toISOString();
    }
    return { success:true, productId: pid, expiresAt, purchaseToken: 'test-purchase-token' };
  }
  if(!CONFIG.google.serviceAccountEmail || !CONFIG.google.serviceAccountKey || !CONFIG.google.clientId) {
    return { success:false, errorCode:'GOOGLE_SA_MISSING' };
  }
  // Create service account JWT for OAuth token
  const now = Math.floor(Date.now()/1000);
  const claim = {
    iss: CONFIG.google.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const saJwt = jwt.sign(claim, CONFIG.google.serviceAccountKey, { algorithm:'RS256' });
  const tokenResp = await fetchFn('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: saJwt }).toString()
  });
  if(!tokenResp.ok) {
    const code = tokenResp.status;
    const map: Record<number,string> = {
      400: 'GOOGLE_ERR_OAUTH_BAD_REQUEST',
      401: 'GOOGLE_ERR_OAUTH_UNAUTHORIZED'
    };
    return { success:false, errorCode: map[code] || 'GOOGLE_OAUTH_FAIL' };
  }
  const tokenJson: any = await tokenResp.json();
  const accessToken = tokenJson.access_token;
  if(!accessToken) return { success:false, errorCode:'GOOGLE_ACCESS_TOKEN_MISSING' };

  if(!productId) {
    // productId is required for Google API path; cannot continue
    return { success:false, errorCode:'PRODUCT_ID_REQUIRED' };
  }
  // NOTE: packageName should ideally come from config; placeholder here
  const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.example.app';
  const subUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
  const subResp = await fetchFn(subUrl, { headers:{ Authorization: `Bearer ${accessToken}` } });
  if(!subResp.ok) {
    const code = subResp.status;
    const map: Record<number,string> = {
      400: 'GOOGLE_ERR_SUB_BAD_REQUEST',
      401: 'GOOGLE_ERR_SUB_UNAUTHORIZED',
      403: 'GOOGLE_ERR_SUB_FORBIDDEN',
      404: 'GOOGLE_ERR_SUB_NOT_FOUND'
    };
    return { success:false, errorCode: map[code] || ('GOOGLE_SUB_STATUS_'+code) };
  }
  const subJson: any = await subResp.json();
  const expiryMs = subJson.expiryTimeMillis ? parseInt(subJson.expiryTimeMillis,10) : undefined;
  const expiresAt = expiryMs ? new Date(expiryMs).toISOString() : null;
  return { success:true, productId, expiresAt, purchaseToken };
}
