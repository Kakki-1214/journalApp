import { Router, Request, Response } from 'express';
import { addAuditLog, addSubscriptionEvent } from './db';
import { getDBProvider } from './dbFactory';
const provider = getDBProvider();
import { verifyAppleReceipt, verifyGoogleSubscription } from './iapVerifier';
import { webhookEventsTotal } from './webhookMetrics';
import { subscriptionStatusTransitions } from './metrics';
import { CONFIG } from './config';
import { verifyAppleSignedPayload } from './appleWebhookVerify';
import { verifyGoogleJwt } from './googlePubSubVerify';

// Helper: map Apple notificationType/subtype -> eventType
function mapAppleEvent(nt?: string, sub?: string): string {
  if(nt === 'DID_RENEW') return 'renewed';
  if(nt === 'EXPIRED') return 'expired';
  if(nt === 'CANCEL') return 'canceled';
  if(nt === 'REFUND') return 'refunded';
  if(nt === 'GRACE_PERIOD_EXPIRED') return 'grace_end';
  if(nt === 'DID_CHANGE_RENEWAL_STATUS') return sub === 'AUTO_RENEW_DISABLED' ? 'auto_renew_off' : 'auto_renew_on';
  return (nt || 'unknown').toLowerCase();
}

// Helper: map Google RTDN subscriptionNotification.notificationType numbers
// https://developer.android.com/google/play/billing/rtdn-reference
const googleTypeMap: Record<number,string> = {
  1:'recovered',2:'renewed',3:'canceled',4:'purchased',5:'on_hold',6:'in_grace',7:'restarted',8:'price_change_confirmed',9:'deferred',10:'paused',11:'pause_schedule_changed',12:'revoked',13:'expired'
};
function mapGoogleEvent(n?: number): string { return n && googleTypeMap[n] ? googleTypeMap[n] : 'unknown'; }

export const webhookRouter = Router();

webhookRouter.post('/apple', async (req: Request, res: Response) => {
  const shared = process.env.WEBHOOK_SHARED_SECRET;
  if(shared){
    const hdr = req.headers['x-webhook-secret'];
    if(hdr !== shared){
      webhookEventsTotal.inc({ provider:'apple', result:'auth_fail', event:'_pre' });
      return res.status(401).json({ success:false, error:'UNAUTHORIZED' });
    }
  }
  const signedPayload = (req.body && req.body.signedPayload) || req.body?.signed_payload;
  let body: any = req.body;
  // 本番 (IAP_TEST_MODE でない) では署名必須
  if(CONFIG.isProduction && !process.env.IAP_TEST_MODE) {
    if(!signedPayload) {
      addAuditLog('webhook.apple.missing_signature', null, {});
      return res.status(400).json({ success:false, error:'MISSING_SIGNATURE' });
    }
  }
  if(signedPayload) {
    const v = await verifyAppleSignedPayload(signedPayload);
    if(!v.valid) {
      addAuditLog('webhook.apple.invalid_signature', null, { error: v.error });
      return res.status(400).json({ success:false, error:'INVALID_SIGNATURE' });
    }
    body = v.payload?.data || v.payload; // ASN v2 encloses in data
  }
  const notificationType = body.notificationType || body.notification_type;
  const eventId = body.notificationUUID || body.eventId || body.signedPayload?.notificationUUID;
    if(eventId && await provider.isWebhookProcessed('apple', eventId)) return res.json({ success:true, dedup:true });
  const subtype = body.subtype;
  const unified = mapAppleEvent(notificationType, subtype);
  const txId = body.originalTransactionId || body.original_transaction_id || body.data?.originalTransactionId || body.data?.original_transaction_id;
  if(!txId) return res.status(400).json({ success:false, error:'NO_ORIGINAL_TRANSACTION_ID' });
    let sub = await provider.findSubscriptionByOriginalTransactionId(txId);
  if(!sub) {
    addAuditLog('webhook.apple.unknown_tx', null, { txId, notificationType, subtype });
    return res.json({ success:true });
  }
  let status = sub.status;
  let refreshedExpiry: string | null | undefined = sub.expiresAt;
  let willRenew = sub.willRenew ? 1 : 0;
  if(['renewed','purchased','restarted'].includes(unified)) {
    status = 'active';
    // renewal そのものでは willRenew を強制変更しない (別イベントで制御)
    // Attempt refresh via latest receipt if present
    if(sub.latestReceipt) {
      try {
        const re = await verifyAppleReceipt(sub.latestReceipt);
        if(re.success && re.expiresAt) refreshedExpiry = re.expiresAt;
      } catch {/* ignore */}
    }
  }
  if(['expired'].includes(unified)) { status = 'expired'; willRenew = 0; }
  if(['canceled','revoked','refunded'].includes(unified)) { status = 'canceled'; willRenew = 0; }
  if(['auto_renew_off'].includes(unified)) { willRenew = 0; }
  if(['auto_renew_on'].includes(unified)) {
    if(status==='active') willRenew = 1; else {
      const latest = await provider.getLatestSubscriptionForUser(sub.userId);
      if(latest && latest.id === sub.id && ['active'].includes(latest.status)) willRenew = 1;
    }
  }
  const finalExpiry = refreshedExpiry ?? sub.expiresAt ?? null;
  const fromStatus = sub.status;
    const updated = await provider.upsertActiveSubscription(sub.userId, 'apple', { status, productId: sub.productId ?? null, originalTransactionId: sub.originalTransactionId, purchaseToken: sub.purchaseToken ?? null, expiresAt: finalExpiry, latestReceipt: sub.latestReceipt, willRenew });
  if(fromStatus !== updated.status){ subscriptionStatusTransitions.inc({ from: fromStatus, to: updated.status, source:'webhook' }); }
  addSubscriptionEvent({ userId: sub.userId, platform: 'apple', productId: sub.productId, eventType: unified, expiryDate: finalExpiry, rawPayload: { notificationType, subtype, signed: !!signedPayload, willRenew } });
  if(eventId) provider.markWebhookProcessed('apple', eventId);
  webhookEventsTotal.inc({ provider:'apple', result:'ok', event: unified });
  addAuditLog('webhook.apple.processed', sub.userId, { event: unified, eventId });
  res.json({ success:true });
});

webhookRouter.post('/google', async (req: Request, res: Response) => {
  const shared = process.env.WEBHOOK_SHARED_SECRET;
  if(shared){
    const hdr = req.headers['x-webhook-secret'];
    if(hdr !== shared){
      webhookEventsTotal.inc({ provider:'google', result:'auth_fail', event:'_pre' });
      return res.status(401).json({ success:false, error:'UNAUTHORIZED' });
    }
  }
  // Pub/Sub push JWT 検証 (X-Goog-JWT / Authorization Bearer など運用側で適切なヘッダ名設定想定)
  if(!process.env.IAP_TEST_MODE){
    const token = (req.headers['x-goog-jwt'] as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    if(!token) {
      addAuditLog('webhook.google.jwt_missing', null, {});
      return res.status(401).json({ success:false, error:'INVALID_PUBSUB_TOKEN' });
    }
    const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
    const ver = await verifyGoogleJwt(token, audience ? { requiredAudience: audience } : {});
    if(!ver.valid) {
      addAuditLog('webhook.google.invalid_jwt', null, { error: ver.error });
      return res.status(401).json({ success:false, error:'INVALID_PUBSUB_TOKEN' });
    }
  }
  // 以降: 既存 RTDN 処理
  const body = req.body || {};
  // Optional lightweight auth check (e.g., shared secret header) could be added here
  const message = body.message || {};
  if(!message.data) return res.status(400).json({ success:false, error:'NO_DATA' });
  let decoded: any = {};
  try {
    decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
  } catch {
    return res.status(400).json({ success:false, error:'DECODE_ERROR' });
  }
  let subNotif = decoded.subscriptionNotification;
  // Test mode shorthand: direct notificationType + purchaseToken in root body
  if(process.env.IAP_TEST_MODE && !subNotif && req.body?.notificationType) {
    subNotif = { notificationType: (() => {
      const map: Record<string, number> = {
        'SUBSCRIPTION_RECOVERED':1,'SUBSCRIPTION_RENEWED':2,'SUBSCRIPTION_CANCELED':3,'SUBSCRIPTION_PURCHASED':4,'SUBSCRIPTION_ON_HOLD':5,'SUBSCRIPTION_IN_GRACE_PERIOD':6,'SUBSCRIPTION_RESTARTED':7,'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED':8,'SUBSCRIPTION_DEFERRED':9,'SUBSCRIPTION_PAUSED':10,'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED':11,'SUBSCRIPTION_REVOKED':12,'SUBSCRIPTION_EXPIRED':13
      }; return map[req.body.notificationType] ?? 0; })(), purchaseToken: req.body.data?.purchaseToken || req.body.purchaseToken };
  }
  if(!subNotif) return res.json({ success:true });
  const event = mapGoogleEvent(subNotif.notificationType);
  const eventId = decoded.messageId || subNotif.eventId || subNotif.notificationId;
    if(eventId && await provider.isWebhookProcessed('google', eventId)) return res.json({ success:true, dedup:true });
  const purchaseToken = subNotif.purchaseToken;
    const sub = await provider.findSubscriptionByPurchaseToken(purchaseToken);
  if(!sub) {
    addAuditLog('webhook.google.unknown_token', null, { purchaseToken, event });
    return res.json({ success:true });
  }
  let status = sub.status;
  let refreshedExpiry: string | null | undefined = sub.expiresAt;
  let willRenew = sub.willRenew ? 1 : 0;
  if(['purchased','renewed','recovered','restarted'].includes(event)) {
    status = 'active';
    willRenew = 1; // assumed auto-renew still on
    // Refresh expiry by calling Google API again if we still have purchaseToken + productId
    if(sub.purchaseToken && sub.productId) {
      try {
        const re = await verifyGoogleSubscription(sub.purchaseToken, sub.productId);
        if(re.success && re.expiresAt) refreshedExpiry = re.expiresAt;
      } catch {/* ignore */}
    }
  }
  if(['expired'].includes(event)) { status = 'expired'; willRenew = 0; }
  if(['canceled','revoked'].includes(event)) { status = 'canceled'; willRenew = 0; }
  if(['paused','on_hold','in_grace'].includes(event)) { /* keep status; renewal pending decision */ }
  const finalExpiry = refreshedExpiry ?? sub.expiresAt ?? null;
  const fromStatusG = sub.status;
    const updatedG = await provider.upsertActiveSubscription(sub.userId, 'google', { status, productId: sub.productId ?? null, originalTransactionId: sub.originalTransactionId ?? null, purchaseToken: sub.purchaseToken, expiresAt: finalExpiry, latestReceipt: sub.latestReceipt, willRenew });
  if(fromStatusG !== updatedG.status){ subscriptionStatusTransitions.inc({ from: fromStatusG, to: updatedG.status, source:'webhook' }); }
  addSubscriptionEvent({ userId: sub.userId, platform: 'google', productId: sub.productId, eventType: event, expiryDate: finalExpiry, rawPayload: { notificationType: subNotif.notificationType, willRenew } });
  if(eventId) provider.markWebhookProcessed('google', eventId);
  webhookEventsTotal.inc({ provider:'google', result:'ok', event });
  addAuditLog('webhook.google.processed', sub.userId, { event, eventId });
  res.json({ success:true });
});
