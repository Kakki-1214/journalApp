import { Router, Request, Response } from 'express';
import { IapVerifyRequest } from './types';
import { addAuditLog, addSubscriptionEvent } from './db';
import { getDBProvider } from './dbFactory';
import { requireAuth } from './authMiddleware';
import { verifyAppleReceipt, verifyGoogleSubscription } from './iapVerifier';
import { iapVerifyCounter, subscriptionStatusTransitions } from './metrics';

export const iapRouter = Router();
const provider = getDBProvider();

iapRouter.post('/verify', requireAuth, async (req: Request, res: Response) => {
  const parsed = IapVerifyRequest.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ success:false, error: parsed.error.message });
  const { platform, receipt, productId } = parsed.data;
  const uid = req.user!.id;
  try {
    let result;
    if(platform === 'ios') {
      result = await verifyAppleReceipt(receipt);
    } else {
      result = await verifyGoogleSubscription(receipt, productId);
    }
  if(!result.success || !result.productId) {
      iapVerifyCounter.inc({ result: 'fail', platform });
      addAuditLog('iap.verify.failed', uid, { platform, errorCode: result.errorCode });
      return res.status(400).json({ success:false, error: result.errorCode || 'VERIFY_FAILED' });
    }
    const lifetimeIds = (process.env.LIFETIME_PRODUCT_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
    const isLifetime = lifetimeIds.includes(result.productId);
    const now = Date.now();
    const expired = !isLifetime && result.expiresAt ? new Date(result.expiresAt).getTime() < now : false;
    const status = expired ? 'expired' : 'active';
    const source = platform === 'ios' ? 'apple' : 'google';
    let willRenew = !expired && !!result.expiresAt && !isLifetime; // lifetime は更新しない
  const prev = await provider.getLatestSubscriptionForUser(uid);
  const sub = await provider.upsertActiveSubscription(uid, source, { status, productId: result.productId, expiresAt: isLifetime ? null : (result.expiresAt ?? null), latestReceipt: receipt, originalTransactionId: result.originalTransactionId ?? null, purchaseToken: result.purchaseToken ?? null, willRenew: willRenew ? 1 : 0 });
  if(prev && prev.status !== sub.status){
    subscriptionStatusTransitions.inc({ from: prev.status, to: sub.status, source: 'verify' });
  } else if(!prev){
    subscriptionStatusTransitions.inc({ from: 'none', to: sub.status, source: 'verify' });
  }
  addAuditLog('iap.verify.success', uid, { platform, productId: result.productId });
  iapVerifyCounter.inc({ result: 'success', platform });
  addSubscriptionEvent({ userId: uid, platform: source, productId: result.productId, eventType: expired ? 'expired' : 'verified', expiryDate: sub.expiresAt, rawPayload: { platform, productId: result.productId, expiresAt: result.expiresAt, willRenew } });
    return res.json({ success:true, data:{ isPro: !expired || isLifetime, productId: result.productId, expiryDate: sub.expiresAt, status, source, willRenew, isLifetime } });
  } catch (e:any) {
    iapVerifyCounter.inc({ result: 'error', platform });
    addAuditLog('iap.verify.failed', uid, { platform, error: e.message });
    return res.status(500).json({ success:false, error:'VERIFY_EXCEPTION' });
  }
});

iapRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.id;
  // Always look at most recent subscription (regardless of status) to unify logic
  // Use provider methods: prefer latest subscription regardless of status
  const row: any = await provider.getLatestSubscriptionForUser(uid);
  if (!row) {
    return res.json({ success:true, data: { isPro:false, status:'none', willRenew:false, isCanceled:false, isLifetime:false, tier:'free', upcomingExpiry:false } });
  }
  const now = Date.now();
  const expiresAtMs = row.expiresAt ? new Date(row.expiresAt).getTime() : undefined;
  const isTimeExpired = expiresAtMs !== undefined && expiresAtMs < now;
  const canceled = row.status === 'canceled';
  const baseProduct = row.productId;
  const source = row.platform;
  const lifetimeIds = (process.env.LIFETIME_PRODUCT_IDS||'').split(',').map((s:string)=>s.trim()).filter(Boolean);
  const isLifetime = baseProduct && lifetimeIds.includes(baseProduct);
  const tier = isLifetime ? 'lifetime' : (row.status === 'active' || row.status === 'canceled') && !isTimeExpired ? 'pro' : 'free';
  const upcomingExpiry = !isTimeExpired && !isLifetime && expiresAtMs !== undefined && (expiresAtMs - now) < 24*3600*1000;
  if (isTimeExpired || row.status === 'expired') {
    return res.json({ success:true, data: { isPro:isLifetime, status:'expired', productId: baseProduct, expiryDate: row.expiresAt, source, willRenew:false, isCanceled: canceled || row.status==='canceled', isLifetime, tier: isLifetime ? 'lifetime' : 'free', upcomingExpiry:false } });
  }
  // Non-expired window
  if (row.status === 'active') {
    // Determine willRenew -> explicit will_renew else heuristic
    let willRenew:boolean;
    if (row.willRenew !== null && row.willRenew !== undefined) {
      willRenew = !!row.willRenew;
    } else if (row.expiresAt) {
      willRenew = new Date(row.expiresAt).getTime() > now;
    } else {
      willRenew = false;
    }
    return res.json({ success:true, data: { isPro:true, status:'active', productId: baseProduct, expiryDate: row.expiresAt, source, willRenew: isLifetime ? false : willRenew, isCanceled:false, isLifetime, tier, upcomingExpiry } });
  }
  if (row.status === 'canceled') {
    return res.json({ success:true, data: { isPro:!isTimeExpired || isLifetime, status:'active', productId: baseProduct, expiryDate: row.expiresAt, source, willRenew:false, isCanceled:true, isLifetime, tier, upcomingExpiry } });
  }
  return res.json({ success:true, data: { isPro:isLifetime, status:'none', willRenew:false, isCanceled:false, isLifetime, tier: isLifetime ? 'lifetime' : 'free', upcomingExpiry:false } });
});
