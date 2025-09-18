import request from 'supertest';
import { describe, test, expect } from 'vitest';
import { createApp } from './setup';
import * as dbModule from '../src/db';

describe('healthz endpoint degraded', () => {
  test('db failure yields status=error (500) while still returning JSON body', async () => {
    const app = await createApp();
    // Monkey patch: force db.prepare to throw
    const originalDb = (dbModule as any).db;
    const originalPrepare = originalDb.prepare;
    (originalDb as any).prepare = () => { throw new Error('forced db failure'); };

    const res = await request(app).get('/healthz');

    // restore
    (originalDb as any).prepare = originalPrepare;

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.checks.db.ok).toBe(false);
    expect(typeof res.body.checks.db.error).toBe('string');
    // cache may be ok or degraded depending on environment; just assert presence
    expect(res.body.checks).toHaveProperty('cache');
  });
});
