import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './setup';

describe('/metrics exposure', () => {
  it('increments counters for requests', async () => {
    const app = await createApp();
    // simple health check call
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toMatch(/http_requests_total{.*method="GET".*} [0-9]+/);
  });
});
