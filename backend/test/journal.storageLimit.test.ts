import request from 'supertest';
import { startServer } from '../src/index';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let server: any;

describe('Journal storage limit (free)', () => {
  beforeAll(async () => {
    process.env.IAP_TEST_MODE = '1';
    process.env.FREE_STORAGE_BYTES = '120'; // very small limit
    server = await startServer(0);
  });
  afterAll(async () => { await server.close(); });

  test('exceeding storage returns 402', async () => {
    const email = `stor_${Date.now()}@ex.com`;
    const reg = await request(server).post('/auth/email/register').send({ email, password:'pw123456' });
    expect(reg.status).toBe(200);
    const token = reg.body.data.token;

    // first small entry
    const e1 = await request(server).post('/journal').set('Authorization', `Bearer ${token}`).send({ content:'a'.repeat(60) });
    expect(e1.status).toBe(200);
    // second pushes over 120 bytes total
    const e2 = await request(server).post('/journal').set('Authorization', `Bearer ${token}`).send({ content:'b'.repeat(80) });
    expect(e2.status).toBe(402);
    expect(e2.body.error).toBe('STORAGE_LIMIT_EXCEEDED');
  });
});
