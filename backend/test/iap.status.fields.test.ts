import request from 'supertest';
import crypto from 'crypto';
import { startServer } from '../src/index';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { db } from '../src/db';

let server: any;

// Helper to insert a fake subscription directly (simulating an active one that will expire soon)
function insertSub(userId: string, productId: string, msFromNow: number, platform: string, willRenew = true) {
  const expiresAt = new Date(Date.now() + msFromNow).toISOString();
  db.prepare(`INSERT INTO subscriptions (id, user_id, platform, product_id, original_transaction_id, purchase_token, status, expires_at, latest_receipt, will_renew, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    crypto.randomUUID(), userId, platform, productId, 'orig', 'tok', 'active', expiresAt, null, willRenew ? 1 : 0, new Date().toISOString(), new Date().toISOString()
  );
}

describe('IAP status extended fields', () => {
  beforeAll(async () => {
    process.env.IAP_TEST_MODE = '1';
  server = await startServer(0);
  });
  afterAll(async () => {
    await server.close();
  });

  test('willRenew true while active then false after forced expiry', async () => {
    // create auth user via API (so token works with requireAuth)
    const email = `willrenew_${Date.now()}@ex.com`;
    const register = await request(server).post('/auth/email/register').send({ email, password:'pw123456' });
    expect(register.status).toBe(200);
    const token = register.body.data.token;
    const userId = register.body.data.user.id;
  insertSub(userId, 'test_product_ios', 60_000, 'apple', true); // long future expiry

    // initial status
    let res = await request(server).get('/iap/status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.willRenew).toBe(true);

  // Force expiry without waiting
  db.prepare(`UPDATE subscriptions SET expires_at=?, updated_at=? WHERE user_id=?`).run(new Date(Date.now()-1000).toISOString(), new Date().toISOString(), userId);
  const { runExpirySweep } = await import('../src/db');
  await runExpirySweep();

    res = await request(server).get('/iap/status').set('Authorization', `Bearer ${token}`).expect(200);
  // スイープ後 expired または (遅延時) active→再評価で expired のどちらか。
  expect(res.body.data.status).toBe('expired');
  expect(res.body.data.willRenew).toBe(false);
  });
});
