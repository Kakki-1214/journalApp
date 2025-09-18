import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';
import crypto from 'crypto';
import { db } from '../src/db';

function insertSub(userId: string, productId: string, platform: string, status: string, willRenew: number, expiresOffsetMs: number){
  const expiresAt = new Date(Date.now() + expiresOffsetMs).toISOString();
  db.prepare(`INSERT INTO subscriptions (id, user_id, platform, product_id, original_transaction_id, purchase_token, status, expires_at, latest_receipt, will_renew, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    crypto.randomUUID(), userId, platform, productId, 'orig', 'tok', status, expiresAt, null, willRenew, new Date().toISOString(), new Date().toISOString()
  );
}

describe('/iap/status isCanceled field', () => {
  it('returns isCanceled=false for active subscription', async () => {
    const app = await createApp();
    const email = `isc_${Date.now()}_a@example.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'Pass1234!' });
    const token = reg.body.data.token;
    const userId = reg.body.data.user.id;
    insertSub(userId, 'prod1', 'apple', 'active', 1, 60_000);
    const res = await request(app).get('/iap/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('active');
  expect(res.body.data.isCanceled).toBe(false);
  });

  it('returns isCanceled true while active (canceled auto-renew) then after expiry remains true with expired status', async () => {
    const app = await createApp();
    const email = `isc_${Date.now()}_b@example.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'Pass1234!' });
    const token = reg.body.data.token;
    const userId = reg.body.data.user.id;
  // Insert canceled with future expiry (simulate still-paid period)
  insertSub(userId, 'prod1', 'apple', 'canceled', 0, 60_000);
  let res = await request(app).get('/iap/status').set('Authorization', `Bearer ${token}`);
  expect(res.body.data.status).toBe('active');
  expect(res.body.data.isCanceled).toBe(true);
  // Simulate expiry by directly updating DB (no sleep)
  db.prepare(`UPDATE subscriptions SET expires_at=? WHERE user_id=?`).run(new Date(Date.now()-1000).toISOString(), userId);
  const { runExpirySweep } = await import('../src/db');
  await runExpirySweep();
  res = await request(app).get('/iap/status').set('Authorization', `Bearer ${token}`);
  expect(res.body.data.status).toBe('expired');
  expect(res.body.data.isCanceled).toBe(true);
  });
});
