const fetchFn: typeof fetch = (globalThis as any).fetch.bind(globalThis);
import jwkToPem from 'jwk-to-pem';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface CachedKey { pem: string; kid: string; exp: number; }

const cache: Record<string, CachedKey> = {};

async function fetchJwks(url: string) {
  const res = await fetchFn(url);
  if(!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return res.json() as Promise<{ keys: any[] }>;
}

async function getPemForKid(jwksUrl: string, kid: string): Promise<string> {
  const now = Date.now();
  const c = cache[jwksUrl+':'+kid];
  if(c && c.exp > now) return c.pem;
  const jwks = await fetchJwks(jwksUrl);
  for(const k of jwks.keys) {
    if(k.kid === kid) {
      const pem = jwkToPem(k);
      cache[jwksUrl+':'+kid] = { pem, kid, exp: now + 60*60*1000 }; // 1h cache
      return pem;
    }
  }
  throw new Error('Key not found');
}

export interface VerifyOptions {
  expectedAud?: string;
  expectedIss?: string | string[];
}

export async function verifyWithJwks(token: string, jwksUrl: string, opts: VerifyOptions = {}): Promise<JwtPayload> {
  const headerPart = token.split('.')[0];
  const header = JSON.parse(Buffer.from(headerPart,'base64').toString('utf8'));
  const kid = header.kid;
  if(!kid) throw new Error('Missing kid');
  const pem = await getPemForKid(jwksUrl, kid);
  const payload = jwt.verify(token, pem, { algorithms: ['RS256'] }) as JwtPayload;
  if(opts.expectedAud && payload.aud !== opts.expectedAud) throw new Error('aud mismatch');
  if(opts.expectedIss) {
    const allowed = Array.isArray(opts.expectedIss) ? opts.expectedIss : [opts.expectedIss];
    if(!allowed.includes(payload.iss as string)) throw new Error('iss mismatch');
  }
  return payload;
}
