import crypto from 'crypto';
const fetchFn: typeof fetch = (globalThis as any).fetch.bind(globalThis);
import { logger } from './logger';

/*
  Google Pub/Sub push: JWT in header (optional if configured) or we can verify message data using public certs.
  For RTDN via Google Cloud Pub/Sub, recommended: verify signed JWT in X-Goog-... headers or fetch Google certs for iss accounts.google.com.
  This helper performs minimal cached JWKS fetch + signature verify for RS256 tokens.
*/

interface VerifyOptions {
  requiredAudience?: string;
  clockToleranceSec?: number;
}

interface VerifyResult { valid: boolean; payload?: any; error?: string }

let cachedKeys: Record<string,string> = {};
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 min

async function fetchGoogleCerts(): Promise<Record<string,string>> {
  const now = Date.now();
  if(now - cachedAt < CACHE_TTL_MS && Object.keys(cachedKeys).length) return cachedKeys;
  const res = await fetchFn('https://www.googleapis.com/oauth2/v1/certs');
  if(!res.ok) throw new Error('CERT_FETCH_FAILED');
  const json = await res.json() as Record<string,string>;
  cachedKeys = json; cachedAt = now;
  return json;
}

export async function verifyGoogleJwt(jwt: string, opt: VerifyOptions = {}): Promise<VerifyResult> {
  try {
    const parts = jwt.split('.');
    if(parts.length !== 3) return { valid:false, error:'FORMAT' };
    const header = JSON.parse(Buffer.from(parts[0],'base64').toString('utf8'));
    if(header.alg !== 'RS256') return { valid:false, error:'ALG' };
    const payloadJson = JSON.parse(Buffer.from(parts[1],'base64').toString('utf8'));
    const { aud, iss, exp, nbf } = payloadJson;
    if(iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') return { valid:false, error:'ISS' };
    if(opt.requiredAudience && aud !== opt.requiredAudience) return { valid:false, error:'AUD' };
    const nowSec = Math.floor(Date.now()/1000);
    if(typeof exp === 'number' && nowSec > exp + (opt.clockToleranceSec||0)) return { valid:false, error:'EXP' };
    if(typeof nbf === 'number' && nowSec + (opt.clockToleranceSec||0) < nbf) return { valid:false, error:'NBF' };
    const certs = await fetchGoogleCerts();
    const pem = certs[header.kid];
    if(!pem) return { valid:false, error:'KID' };
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(parts[0] + '.' + parts[1]);
    verify.end();
    const sig = Buffer.from(parts[2], 'base64');
    const ok = verify.verify(pem, sig);
    if(!ok) return { valid:false, error:'BAD_SIGNATURE' };
    return { valid:true, payload: payloadJson };
  } catch(e:any) {
    logger.warn({ err:e.message }, 'google.jwt.verify.error');
    return { valid:false, error:e.message };
  }
}
