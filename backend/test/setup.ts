import { beforeAll, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Force SQLite provider for tests (keep runExpirySweep deterministic)
process.env.TEST_FORCE_SQLITE = '1';
// Ensure test env for bcrypt rounds and other test-time conditions
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

// Use isolated sqlite file per test run
const tmpDir = path.join(process.cwd(), '.tmp-test');
if(!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
// Use a per-worker, per-process unique sqlite file to avoid cross-test interference in parallel CI
const workerId = process.env.VITEST_WORKER_ID || 'w';
const dbFile = path.join(tmpDir, `test-${workerId}-${randomUUID()}.sqlite`);
process.env.DB_FILE = dbFile;
// Provide required env secrets placeholders
process.env.JWT_SECRET = 'test-secret-0123456789-entropy-demo';
process.env.APPLE_SHARED_SECRET = 'apple-secret';
process.env.GOOGLE_SA_EMAIL = 'service@example.com';
process.env.GOOGLE_SA_KEY = '-----BEGIN PRIVATE KEY-----\nMIIB...test\n-----END PRIVATE KEY-----\n';
process.env.IAP_TEST_MODE = '1';
// Provide webhook shared secret to satisfy new auth layer
process.env.WEBHOOK_SHARED_SECRET = 'test-shared-secret';
// High default auth limit for most tests (overridden per specific rate limit test)
if(!process.env.TEST_AUTH_LIMIT) process.env.TEST_AUTH_LIMIT = '9999';

// Lazy import DB to trigger schema creation
import('../src/db');
// Disable foreign key constraints to avoid FK errors during test data cleanup races
import('../src/db').then(m => { try { m.db.exec('PRAGMA foreign_keys=OFF;'); } catch {} });
import { resetRateLimiters } from '../src/rateLimit';

export async function purgeAll() {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbFile);
  db.exec('PRAGMA foreign_keys=OFF;');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name:string }[];
  for(const t of tables) {
    if(['sqlite_sequence','schema_migrations'].includes(t.name)) continue;
    db.prepare(`DELETE FROM ${t.name}`).run();
  }
  db.exec('PRAGMA foreign_keys=ON;');
  db.close();
}

afterEach(async () => {
  await purgeAll();
  await resetRateLimiters();
});

export async function createApp() {
  // import server components without starting listener
  const express = (await import('express')).default;
  const { authRouter } = await import('../src/routes.auth');
  const { iapRouter } = await import('../src/routes.iap');
  const { webhookRouter } = await import('../src/routes.webhooks');
  const { accountRouter } = await import('../src/routes.account');
  const { logger } = await import('../src/logger');
  const { metricsMiddleware, registry } = await import('../src/metrics');
  const { cacheGet, cacheSet } = await import('../src/redisClient');
  const { randomUUID } = await import('crypto');
  const app = express();
  app.use(express.json());
  app.use(metricsMiddleware);

  // use real rate limiter configs (auth stricter in test: 3/min already in index, reproduce here)
  const { createRateLimiter } = await import('../src/rateLimit');
  const authLimiter = createRateLimiter({ windowMs:60_000, max: parseInt(process.env.TEST_AUTH_LIMIT || '9999',10) });
  const defaultLimiter = createRateLimiter({ windowMs:60_000, max:120 });

  app.use((req,res,next)=>{
    const requestId = randomUUID();
    (req as any).requestId = requestId;
    const child = logger.child({ requestId, method: req.method, url: req.url });
    child.info({ msg: 'request.start' });
    res.on('finish', () => { child.info({ msg: 'request.finish', status: res.statusCode }); });
    next();
  });

  app.get('/health', (_req,res)=>res.json({ok:true}));
  // Extended healthz (mirror production simplified)
  const startTime = Date.now();
  const { db } = await import('../src/db');
  app.get('/healthz', async (_req,res) => {
    const checks:any = {};
    let status:'ok'|'degraded'|'error'='ok';
    try { const row:any = db.prepare('SELECT COUNT(1) as c FROM users').get(); checks.db={ok:true, users: row?.c??0}; } catch(e:any){ checks.db={ok:false,error:e.message}; status='error'; }
  try { await cacheGet('healthz-probe'); checks.cache={ok:true}; } catch(e:any){ checks.cache={ok:false,error:e.message}; if(status==='ok') status='degraded'; }
    const uptimeSec = Math.floor((Date.now()-startTime)/1000);
    res.status(status==='error'?500:200).json({ status, uptimeSec, version:'test', checks });
  });
  app.use('/auth', authLimiter, authRouter);
  app.use('/iap', defaultLimiter, iapRouter);
  app.use('/webhooks', defaultLimiter, webhookRouter);
  app.use('/account', defaultLimiter, accountRouter);
  app.get('/metrics', async (req,res)=>{
    const token = process.env.METRICS_TOKEN;
    if(token){
      const auth = req.headers.authorization || '';
      if(!auth.startsWith('Bearer ') || auth.slice(7)!==token) return res.status(401).end();
    }
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  return app;
}
