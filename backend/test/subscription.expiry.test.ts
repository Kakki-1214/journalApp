import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';
import { getDBProvider } from '../src/dbFactory';

process.env.IAP_TEST_MODE = '1';

let app:any;
beforeAll(async () => { app = await createApp(); });

describe('Subscription expiry sweep', () => {
  it('marks active subscription expired after time passes & sweep runs', async () => {
    const email = `sweep_${Date.now()}@ex.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'pw123456'});
    const token = reg.body.data.token;

    // Create short future subscription (future:500ms to reduce timing flake)
    const verify = await request(app)
      .post('/iap/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform:'ios', receipt:'future:500', productId:'test_product_ios'});
    expect(verify.status).toBe(200);
    expect(verify.body.data.isPro).toBe(true);

  // Wait >500ms
  await new Promise(r=>setTimeout(r,600));

  // Run sweep via provider (unified path)
  const provider = getDBProvider();
  const res = await provider.runExpirySweep();
    expect(res.expired).toBe(1);

    // Status should now report not pro
    const status = await request(app)
      .get('/iap/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.data.isPro).toBe(false);
  });
});
