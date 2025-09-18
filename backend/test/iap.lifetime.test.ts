import request from 'supertest';
import { startServer } from '../src/index';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let server: any;

describe('IAP lifetime subscription & entitlements', () => {
  beforeAll(async () => {
    process.env.IAP_TEST_MODE = '1';
    process.env.LIFETIME_PRODUCT_IDS = 'com.journalapp.pro.lifetime';
    server = await startServer(0);
  });
  afterAll(async () => { await server.close(); });

  test('lifetime verify sets isLifetime and tier=lifetime', async () => {
    const email = `life_${Date.now()}@ex.com`;
    const reg = await request(server).post('/auth/email/register').send({ email, password:'pw123456' });
    expect(reg.status).toBe(200);
    const token = reg.body.data.token;

    // Simulate Apple receipt in test mode with product: identifier
    const verify = await request(server).post('/iap/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform:'ios', receipt:'product:com.journalapp.pro.lifetime', productId:'com.journalapp.pro.lifetime' });
    expect(verify.status).toBe(200);
    expect(verify.body.data.isLifetime).toBe(true);
    expect(verify.body.data.expiryDate).toBe(null);

    const status = await request(server).get('/iap/status').set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.data.isLifetime).toBe(true);
    expect(status.body.data.tier).toBe('lifetime');
    expect(status.body.data.isPro).toBe(true);

    const ent = await request(server).get('/entitlements').set('Authorization', `Bearer ${token}`);
    expect(ent.status).toBe(200);
    expect(ent.body.data.tier).toBe('lifetime');
    expect(ent.body.data.capabilities.canTag).toBe(true);
  });
});
