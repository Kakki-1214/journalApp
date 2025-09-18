import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

// Enable test mode for IAP
process.env.IAP_TEST_MODE = '1';

let app: any;
beforeAll(async () => { app = await createApp(); });

describe('IAP verify & status (TEST MODE)', () => {
  it('verifies Apple test receipt and returns isPro true then status reflects active', async () => {
    // Register & login flow (reuse existing auth endpoints)
    const email = `iap_apple_${Date.now()}@ex.com`;
    const register = await request(app).post('/auth/email/register').send({ email, password: 'pw123456' });
    expect(register.status).toBe(200);
    const token = register.body.data.token;

    const verify = await request(app)
      .post('/iap/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'ios', receipt: 'product:test_product_ios' });
    expect(verify.status).toBe(200);
  expect(verify.body.data.isPro).toBe(true);
  expect(verify.body.data.productId).toBe('test_product_ios');
  expect(verify.body.data.status).toBe('active');
  expect(verify.body.data.source).toBe('apple');
  expect(verify.body.data.willRenew).toBe(true);

    const status = await request(app)
      .get('/iap/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
  expect(status.body.data.isPro).toBe(true);
  expect(status.body.data.productId).toBe('test_product_ios');
  expect(status.body.data.status).toBe('active');
  expect(status.body.data.source).toBe('apple');
  expect(status.body.data.willRenew).toBe(true);
  });

  it('verifies Google expired token → isPro false in response & status', async () => {
    const email = `iap_google_${Date.now()}@ex.com`;
    const register = await request(app).post('/auth/email/register').send({ email, password: 'pw123456' });
    const token = register.body.data.token;

    const verify = await request(app)
      .post('/iap/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'android', receipt: 'expired:any', productId: 'test_product_android' });
    expect(verify.status).toBe(200);
  expect(verify.body.data.isPro).toBe(false);
  expect(verify.body.data.status).toBe('expired');
  expect(verify.body.data.source).toBe('google');
  expect(verify.body.data.willRenew).toBe(false);

    const status = await request(app)
      .get('/iap/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
  expect(status.body.data.isPro).toBe(false);
  expect(status.body.data.status).toBe('expired');
  expect(status.body.data.source).toBe('google');
  });
});
