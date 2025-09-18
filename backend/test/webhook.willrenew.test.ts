import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';
import { db } from '../src/db';
import crypto from 'crypto';

process.env.IAP_TEST_MODE = '1';

let app: any;
beforeAll(async () => { app = await createApp(); });

function insertActive(userId: string, platform: 'apple'|'google', { willRenew = 1 }: { willRenew?: number } = {}) {
  const now = Date.now();
  db.prepare(`INSERT INTO subscriptions (id,user_id,platform,product_id,original_transaction_id,purchase_token,status,expires_at,latest_receipt,will_renew,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    crypto.randomUUID(), userId, platform, 'test_product', platform==='apple'?'orig-tx':'', platform==='google'?'ptok':'', 'active', new Date(now+3600_000).toISOString(), null, willRenew, new Date().toISOString(), new Date().toISOString()
  );
}

describe('Webhook willRenew transitions', () => {
  it('Apple auto_renew_off then on updates willRenew flag', async () => {
    const email = `apple_wr_${Date.now()}@ex.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'pw123456' });
    const token = reg.body.data.token;
    const userId = reg.body.data.user.id;
    insertActive(userId,'apple',{ willRenew:1 });

    // simulate auto_renew_off webhook
  await request(app).post('/webhooks/apple').set('X-Webhook-Secret','test-shared-secret').send({ notificationType:'DID_CHANGE_RENEWAL_STATUS', subtype:'AUTO_RENEW_DISABLED', data:{ originalTransactionId:'orig-tx' }, eventId: crypto.randomUUID() }).expect(200);
    let status = await request(app).get('/iap/status').set('Authorization',`Bearer ${token}`).expect(200);
    expect(status.body.data.willRenew).toBe(false);

    // simulate auto_renew_on webhook
  await request(app).post('/webhooks/apple').set('X-Webhook-Secret','test-shared-secret').send({ notificationType:'DID_CHANGE_RENEWAL_STATUS', subtype:'AUTO_RENEW_ENABLED', data:{ originalTransactionId:'orig-tx' }, eventId: crypto.randomUUID() }).expect(200);
    status = await request(app).get('/iap/status').set('Authorization',`Bearer ${token}`).expect(200);
    expect(status.body.data.willRenew).toBe(true);
  });

  it('Google canceled / expired sets willRenew false', async () => {
    const email = `google_wr_${Date.now()}@ex.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'pw123456' });
    const token = reg.body.data.token;
    const userId = reg.body.data.user.id;
    insertActive(userId,'google',{ willRenew:1 });

    // simulate canceled webhook
  const canceledPayload = { subscriptionNotification:{ notificationType:3, purchaseToken:'ptok' } };
  await request(app).post('/webhooks/google').set('X-Webhook-Secret','test-shared-secret').send({ message:{ data: Buffer.from(JSON.stringify(canceledPayload)).toString('base64') } }).expect(200);
    let status = await request(app).get('/iap/status').set('Authorization',`Bearer ${token}`).expect(200);
    expect(status.body.data.willRenew).toBe(false);

    // ensure expired also maintains false
  const expiredPayload = { subscriptionNotification:{ notificationType:13, purchaseToken:'ptok' } };
  await request(app).post('/webhooks/google').set('X-Webhook-Secret','test-shared-secret').send({ message:{ data: Buffer.from(JSON.stringify(expiredPayload)).toString('base64') } }).expect(200);
    status = await request(app).get('/iap/status').set('Authorization',`Bearer ${token}`).expect(200);
    expect(status.body.data.willRenew).toBe(false);
  });
});
