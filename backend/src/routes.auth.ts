import { Router } from 'express';
import { EmailAuthRequest, GoogleCodeExchangeRequest, AppleVerifyRequest } from './types';
import { CONFIG } from './config';
import { signSession } from './utils';
import { getDBProvider } from './dbFactory';
import { sendError } from './errors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyWithJwks } from './jwks';
import { requireAuth } from './authMiddleware';
import { revokeJti } from './db';
const provider = getDBProvider();

// helper
function emailKey(email: string) { return email.toLowerCase(); }

export const authRouter = Router();

authRouter.post('/email/register', async (req, res) => {
  const parsed = EmailAuthRequest.safeParse(req.body);
  if(!parsed.success) return sendError(res,'BAD_REQUEST', parsed.error.message);
  const { email, password } = parsed.data;
  const existing = await provider.getUserByProvider('email', emailKey(email));
  if (existing) return sendError(res,'BAD_REQUEST','Email exists');
  const saltRounds = process.env.NODE_ENV === 'test' ? 4 : 10;
  const hash = await bcrypt.hash(password, saltRounds);
  const user = await provider.upsertUser('email', emailKey(email), { email, passwordHash: hash });
  await provider.addAuditLog('email.register', user.id, { email });
  const fp = (req.body?.fingerprint as string|undefined) || (req.headers['x-client-fingerprint'] as string|undefined) || null;
  const rt = await provider.issueRefreshToken(user.id, 30, fp || undefined);
  return res.json({ success:true, data: { token: signSession({ id: user.id, email: user.email || undefined, providers:[{type:'email', subject: user.providerSubject}] , createdAt: user.createdAt, updatedAt: user.updatedAt }), refreshToken: rt.token, user: { id: user.id, email: user.email } } });
});

authRouter.post('/email/login', async (req,res) => {
  const parsed = EmailAuthRequest.safeParse(req.body);
  if(!parsed.success) return sendError(res,'BAD_REQUEST', parsed.error.message);
  const { email, password } = parsed.data;
  const existing = await provider.getUserByProvider('email', emailKey(email));
  if(!existing) {
    // Avoid user enumeration: return generic invalid credentials
    return sendError(res,'UNAUTHORIZED','Invalid credentials');
  }
  if(!existing.passwordHash || !(await bcrypt.compare(password, existing.passwordHash))) {
  await provider.addAuditLog('email.login.fail', existing?.id || null, { email });
  return sendError(res,'UNAUTHORIZED','Invalid credentials');
  }
  await provider.addAuditLog('email.login.success', existing.id, { email });
  const fp = (req.body?.fingerprint as string|undefined) || (req.headers['x-client-fingerprint'] as string|undefined) || null;
  const rt = await provider.issueRefreshToken(existing.id, 30, fp || undefined);
  return res.json({ success:true, data: { token: signSession({ id: existing.id, email: existing.email || undefined, providers:[{type:'email', subject: existing.providerSubject}], createdAt: existing.createdAt, updatedAt: existing.updatedAt }), refreshToken: rt.token, user: { id: existing.id, email: existing.email } } });
});

// Convenience aliases expected by mobile client
authRouter.post('/register', (req, _res, next) => { (req as any).url = '/email/register'; next(); });
authRouter.post('/login', (req, _res, next) => { (req as any).url = '/email/login'; next(); });

authRouter.post('/google/exchange', async (req, res) => {
  const parsed = GoogleCodeExchangeRequest.safeParse(req.body);
  if(!parsed.success) return sendError(res,'BAD_REQUEST', parsed.error.message);
  const { code, redirectUri } = parsed.data;
  if(!CONFIG.google.clientId || !CONFIG.google.clientSecret) return sendError(res,'INTERNAL','Server Google creds missing');
  // Spec only: do NOT log code in production
  let tokens: any;
  try {
    const resp = await fetch(CONFIG.google.tokenEndpoint, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code,
        client_id: CONFIG.google.clientId,
        client_secret: CONFIG.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type:'authorization_code'
      }).toString()
    });
    tokens = await resp.json();
  } catch (e:any) {
  return sendError(res,'BAD_REQUEST','Google token fetch failed');
  }
  if(!tokens.id_token) return sendError(res,'BAD_REQUEST','Missing id_token');
  // Verify Google ID token signature & claims
  try {
    const payload = await verifyWithJwks(tokens.id_token, 'https://www.googleapis.com/oauth2/v3/certs', {
      expectedAud: CONFIG.google.clientId,
      expectedIss: ['https://accounts.google.com', 'accounts.google.com']
    });
    const sub = payload.sub as string;
    const email = payload.email as string | undefined;
  const dbUser = await provider.upsertUser('google', sub, { email: email ?? null });
  await provider.addAuditLog('google.exchange', dbUser.id, { sub, hasEmail: !!email });
  const fp = (req.body?.fingerprint as string|undefined) || (req.headers['x-client-fingerprint'] as string|undefined) || null;
  const rt = await provider.issueRefreshToken(dbUser.id, 30, fp || undefined);
  return res.json({ success:true, data:{ token: signSession({ id: dbUser.id, email: dbUser.email || undefined, providers:[{type:'google', subject: dbUser.providerSubject}], createdAt: dbUser.createdAt, updatedAt: dbUser.updatedAt }), refreshToken: rt.token, user: { id: dbUser.id, email: dbUser.email } } });
  } catch (e:any) {
  return sendError(res,'UNAUTHORIZED','Invalid Google token');
  }
});

authRouter.post('/apple/verify', async (req, res) => {
  const parsed = AppleVerifyRequest.safeParse(req.body);
  if(!parsed.success) return sendError(res,'BAD_REQUEST', parsed.error.message);
  const { identityToken } = parsed.data;
  try {
    const payload = await verifyWithJwks(identityToken, 'https://appleid.apple.com/auth/keys', {
      expectedAud: process.env.APPLE_CLIENT_ID || undefined,
      expectedIss: 'https://appleid.apple.com'
    });
    const sub = (payload.sub as string) || 'apple-unknown';
    const email = (payload.email as string | undefined);
  const dbUser = await provider.upsertUser('apple', sub, { email: email ?? null });
  await provider.addAuditLog('apple.verify', dbUser.id, { sub, hasEmail: !!email });
  const fp = (req.body?.fingerprint as string|undefined) || (req.headers['x-client-fingerprint'] as string|undefined) || null;
  const rt = await provider.issueRefreshToken(dbUser.id, 30, fp || undefined);
  return res.json({ success:true, data:{ token: signSession({ id: dbUser.id, email: dbUser.email || undefined, providers:[{type:'apple', subject: dbUser.providerSubject}], createdAt: dbUser.createdAt, updatedAt: dbUser.updatedAt }), refreshToken: rt.token, user: { id: dbUser.id, email: dbUser.email } } });
  } catch (e:any) {
  return sendError(res,'UNAUTHORIZED','Invalid Apple token');
  }
});

authRouter.get('/me', requireAuth, async (req,res) => {
  const user = await provider.getUserById(req.user!.id);
  if(!user) return sendError(res,'BAD_REQUEST','Not found');
  return res.json({ success:true, data:{ id: user.id, email: user.email } });
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken, fingerprint } = req.body || {};
  if(!refreshToken) return sendError(res,'BAD_REQUEST','MISSING_REFRESH_TOKEN');
  const row = await provider.findValidRefreshToken(refreshToken);
  if(!row) return sendError(res,'UNAUTHORIZED','INVALID_REFRESH_TOKEN');
  const user = await provider.getUserById(row.userId);
  if(!user) {
  await provider.revokeRefreshToken(refreshToken);
    return sendError(res,'UNAUTHORIZED','INVALID_REFRESH_TOKEN');
  }
  // 再利用検知: token が既に revoked なら盗用の可能性 → 全無効化
  if(row.revokedAt) {
  await provider.markRefreshTokenReused(refreshToken);
  await provider.revokeAllRefreshTokensForUser(user.id);
    await provider.addAuditLog('refresh.reuse_detected', user.id, { tokenId: row.id });
    return res.status(401).json({ success:false, error:'TOKEN_REUSED' });
  }
  // 指紋不一致 (初回発行時 fingerprint 保存は未実装のため後続拡張余地)
  if(row.fingerprint && fingerprint && row.fingerprint !== fingerprint) {
  await provider.markRefreshTokenReused(refreshToken);
  await provider.revokeAllRefreshTokensForUser(user.id);
  await provider.addAuditLog('refresh.fingerprint_mismatch', user.id, { tokenId: row.id });
  return res.status(401).json({ success:false, error:'FINGERPRINT_MISMATCH' });
  }
  const rotated = await provider.rotateRefreshToken(refreshToken, user.id);
  if(rotated && fingerprint && !rotated.fingerprint) {
    await provider.setRefreshTokenFingerprint(rotated.id, fingerprint);
  }
  if(!rotated) return sendError(res,'UNAUTHORIZED','INVALID_REFRESH_TOKEN');
  const newAccess = signSession({ id: user.id, email: user.email || undefined, providers:[{type:user.provider, subject: user.providerSubject}], createdAt: user.createdAt, updatedAt: user.updatedAt });
  return res.json({ success:true, data:{ token: newAccess, refreshToken: rotated.token } });
});
// Access token logout (revoke jti)
authRouter.post('/logout', (req,res)=>{
  const header = req.headers.authorization;
  if(!header?.startsWith('Bearer ')) return res.status(400).json({ success:false, error:'Missing bearer token' });
  const token = header.substring('Bearer '.length);
  try {
    const decoded:any = jwt.verify(token, CONFIG.jwtSecret);
    if(decoded.jti) revokeJti(decoded.jti, decoded.uid || decoded.sub);
    provider.addAuditLog('auth.logout', decoded.uid || decoded.sub || null, { jti: decoded.jti });
  } catch(e:any) {
    return res.status(400).json({ success:false, error:'Invalid token' });
  }
  return res.json({ success:true });
});
