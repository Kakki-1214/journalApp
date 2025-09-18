import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

// NODE_ENV=test で authLimiter は 60s window 3req 設定

describe('Auth route rate limiting', () => {
  it('4th request within window returns 429', async () => {
  process.env.TEST_AUTH_LIMIT = '3';
  const app = await createApp();
    for(let i=0;i<3;i++) {
      const res = await request(app).post('/auth/email/register').send({ email:`u${i}@e.com`, password:'Passw0rd!' });
      expect(res.status).toBe(200);
    }
    const extra = await request(app).post('/auth/email/register').send({ email:'uX@e.com', password:'Passw0rd!' });
    expect([429]).toContain(extra.status);
  });
});
