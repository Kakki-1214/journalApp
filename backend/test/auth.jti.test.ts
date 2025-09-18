import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from './setup';

// Decode without verifying signature to inspect payload quickly (we trust test secret) but we still can verify using secret.

describe('JWT jti claim', () => {
  it('issues tokens containing a jti', async () => {
    const app = await createApp();
    const email = `jti_${Date.now()}@example.com`;
    const reg = await request(app).post('/auth/email/register').send({ email, password:'Pass1234!' });
    expect(reg.status).toBe(200);
    const token = reg.body.data.token as string;
    const decoded: any = jwt.decode(token);
    expect(decoded).toBeTruthy();
    expect(decoded.jti).toBeTypeOf('string');
    expect(decoded.jti.length).toBeGreaterThan(10);
  });
});
