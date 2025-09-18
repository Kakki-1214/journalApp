import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

// health.test focuses on /healthz extended endpoint

describe('healthz endpoint', () => {
  it('returns status ok and expected keys', async () => {
    const app = await createApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('uptimeSec');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('db');
  });
});
