import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

async function build() { return await createApp(); }

describe('Auth basic flow', () => {
  it('register -> login -> me', async () => {
    const app = await build();
    const email = 'user@example.com';
    const password = 'Passw0rd!';
    const reg = await request(app).post('/auth/email/register').send({ email, password, fingerprint:'fp1' });
    expect(reg.status).toBe(200);
    const refreshToken = reg.body.data.refreshToken;
    const token = reg.body.data.token;
    const me = await request(app).get('/auth/me').set('Authorization', 'Bearer '+token);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email.toLowerCase());
    const dup = await request(app).post('/auth/email/register').send({ email, password });
    expect(dup.status).toBe(400);
    const login = await request(app).post('/auth/email/login').send({ email, password });
    expect(login.status).toBe(200);
  const badPw = await request(app).post('/auth/email/login').send({ email, password:'wrongpw' });
    expect(badPw.status).toBe(401);
    expect(refreshToken).toBeTruthy();
  });
});
