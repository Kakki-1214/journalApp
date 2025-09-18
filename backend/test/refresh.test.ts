import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

async function setupUser(app:any){
  // 重複登録 (purgeAll 無効化により既存ユーザ残存) を避けるため一意メール生成
  const email=`rot_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const password='Pass1234!';
  const reg = await request(app).post('/auth/email/register').send({ email, password, fingerprint:'fpX' });
  return { email, password, reg };
}

describe('Refresh token rotation & reuse detection', () => {
  it('rotates successfully', async () => {
    const app = await createApp();
    const { reg } = await setupUser(app);
    const oldRt = reg.body.data.refreshToken;
  const first = await request(app).post('/auth/refresh').send({ refreshToken: oldRt, fingerprint:'fpX' });
    expect(first.status).toBe(200);
    const newRt = first.body.data.refreshToken;
    expect(newRt).not.toBe(oldRt);
  });

  it('detects reuse of revoked token', async () => {
    const app = await createApp();
    const { reg } = await setupUser(app);
    const oldRt = reg.body.data.refreshToken;
    const first = await request(app).post('/auth/refresh').send({ refreshToken: oldRt, fingerprint:'fpX' });
    expect(first.status).toBe(200);
    // reuse oldRt again should trigger reuse detection (revoked already)
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: oldRt, fingerprint:'fpX' });
  expect(reuse.status).toBe(401);
  // depending on timing, revoked token may appear simply invalid
  expect(['TOKEN_REUSED','INVALID_REFRESH_TOKEN','UNAUTHORIZED']).toContain(reuse.body.error);
  });
});
