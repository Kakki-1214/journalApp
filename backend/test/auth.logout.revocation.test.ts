import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

describe('Logout revokes jti', () => {
  it('access token rejected after logout', async () => {
    const app = await createApp();
    const email = `logout_${Date.now()}@ex.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'Pass1234!' });
    expect(reg.status).toBe(200);
    const token = reg.body.data.token;

    // me works
    const meOk = await request(app).get('/auth/me').set('Authorization', 'Bearer '+token);
    expect(meOk.status).toBe(200);

    // logout
    const lo = await request(app).post('/auth/logout').set('Authorization','Bearer '+token);
    expect(lo.status).toBe(200);

    // me after logout should fail
    const meFail = await request(app).get('/auth/me').set('Authorization', 'Bearer '+token);
    expect(meFail.status).toBe(401);
    expect(meFail.body.error).toBe('TOKEN_REVOKED');
  });
});
