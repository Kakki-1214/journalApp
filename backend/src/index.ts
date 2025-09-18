import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes.auth';
import { iapRouter } from './routes.iap';
import { webhookRouter } from './routes.webhooks';
import { accountRouter } from './routes.account';
import { journalRouter } from './routes.journal';
import { entitlementsRouter } from './routes.entitlements';
import { logger, reportError } from './logger';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { createRateLimiter } from './rateLimit';
import { db } from './db';
import { getDBProvider } from './dbFactory';
const sweepProvider = getDBProvider();
import { subscriptionExpirySweeps } from './metrics';
import { metricsMiddleware, registry, subscriptionStatusLookups } from './metrics';
import { cacheGet } from './redisClient';
import { openApiSpec } from './openapi';

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  if(!raw) return [] as string[];
  return raw.split(',').map(s=>s.trim()).filter(Boolean);
}

export function createServerApp() {
  const app = express();
  const allowlist = parseCorsOrigins();
  const isProd = ['production','prod'].includes((process.env.NODE_ENV||'').toLowerCase());
  app.use(cors({
    origin: (origin, cb) => {
      // Allow non-browser (no origin), localhost in dev, and explicit allowlist in prod
      if(!origin) return cb(null, true);
      if(!isProd && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return cb(null, true);
      if(allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true
  }));
  app.use(express.json());
  return app;
}

const app = createServerApp();
// Security headers
// CSP + nonce
const cspReportOnly = process.env.CSP_REPORT_ONLY === '1';
app.use((_req,res,next)=>{
  (res as any).cspNonce = Buffer.from(randomUUID()).toString('base64');
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", 'data:', 'blob:'],
      "script-src": [ (res:any)=>`'nonce-${(res as any).cspNonce}'`, "'strict-dynamic'", "'self'" ],
      "style-src": ["'self'","'unsafe-inline'"],
      "connect-src": ["'self'"],
      "font-src": ["'self'", 'data:'],
      "frame-ancestors": ["'none'"],
      "report-uri": ['/csp-report']
    },
    reportOnly: cspReportOnly
  }
}));

// CSP violation report endpoint (Report-To / report-uri)
app.post('/csp-report', express.json({ type:'application/csp-report' }), (req,res)=>{
  logger.warn({ msg:'csp.violation', report: req.body });
  res.status(204).end();
});
// Metrics middleware (after basic parsing / security)
app.use(metricsMiddleware);

// Startup env validation (hard fail on critical secrets)
const requiredEnv = ['JWT_SECRET','APPLE_SHARED_SECRET','GOOGLE_SA_EMAIL'];
// DATABASE_URL or DB_FILE いずれか
if(!process.env.DATABASE_URL && !process.env.DB_FILE) {
  requiredEnv.push('DATABASE_URL(or DB_FILE)');
}
// GOOGLE_SA_KEY または GOOGLE_SA_KEY_B64 のどちらか必須
if(!process.env.GOOGLE_SA_KEY && !process.env.GOOGLE_SA_KEY_B64) {
  requiredEnv.push('GOOGLE_SA_KEY(or GOOGLE_SA_KEY_B64)');
}
const missing = requiredEnv.filter(k => !process.env[k]);
if(missing.length) {
  logger.error({ missing, message:'Critical environment variables missing. See README deployment section.' }, 'env.missing.fatal');
  process.exit(1);
}
// JWT_SECRET 強度 (長さ) 確認
if((process.env.JWT_SECRET||'').length < 32) {
  logger.error({ msg:'JWT_SECRET too short (<32 chars). Increase entropy.' });
  process.exit(1);
}
// METRICS_TOKEN (存在するなら) 最低長さ
if(process.env.METRICS_TOKEN && process.env.METRICS_TOKEN.length < 24) {
  logger.error({ msg:'METRICS_TOKEN too short (<24 chars)' });
  process.exit(1);
}
// Prevent accidental prod launch with test mode flags
if(process.env.IAP_TEST_MODE && ['production','prod'].includes((process.env.NODE_ENV||'').toLowerCase())) {
  logger.error({ msg:'Refusing to start: IAP_TEST_MODE active in production' });
  process.exit(1);
}
// SQLite 本番禁止 (許可フラグで明示 override)
if(['production','prod'].includes((process.env.NODE_ENV||'').toLowerCase())) {
  if((process.env.DB_FILE||'').endsWith('.sqlite') && !process.env.ALLOW_SQLITE_PROD) {
    logger.error({ msg:'SQLite detected in production. Set ALLOW_SQLITE_PROD=1 only if you accept single-node limitations.' });
    process.exit(1);
  }
}

// Route-specific rate limiters (env configurable)
const isTest = process.env.NODE_ENV === 'test';
function envNum(key: string, fallback: number) {
  const v = process.env[key];
  if(!v) return fallback;
  const n = parseInt(v,10); return Number.isFinite(n) ? n : fallback;
}
const authLimiter = createRateLimiter({
  windowMs: envNum('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
  max: isTest ? envNum('TEST_AUTH_RATE_LIMIT_MAX', 3) : envNum('AUTH_RATE_LIMIT_MAX', 60)
});
const defaultLimiter = createRateLimiter({
  windowMs: envNum('DEFAULT_RATE_LIMIT_WINDOW_MS', 60_000),
  max: envNum('DEFAULT_RATE_LIMIT_MAX', 120)
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  const child = logger.child({ requestId, method: req.method, url: req.url });
  child.info({ msg: 'request.start' });
  res.on('finish', () => {
    const duration = Date.now() - start;
    child.info({ msg: 'request.finish', status: res.statusCode, durationMs: duration, userId: (req as any).user?.id });
  });
  next();
});

// Basic health (legacy)
app.get('/health', (_req, res) => res.json({ ok:true }));
// Extended health
const startTime = Date.now();
app.get('/healthz', async (_req: Request, res: Response) => {
  const checks: any = {};
  let status: 'ok'|'degraded'|'error' = 'ok';
  // DB check
  try {
  const row: any = db.prepare('SELECT COUNT(1) as c FROM users').get();
  checks.db = { ok:true, users: row?.c ?? 0 };
  } catch(e:any) {
    checks.db = { ok:false, error: e.message }; status = 'error';
  }
  // Cache (best-effort)
  try {
    await cacheGet('healthz-probe');
    checks.cache = { ok:true };
  } catch(e:any) {
    checks.cache = { ok:false, error: e.message }; if(status==='ok') status='degraded';
  }
  const uptimeSec = Math.floor((Date.now()-startTime)/1000);
  res.setHeader('X-App-Version', process.env.APP_VERSION || 'dev');
  if(process.env.GIT_COMMIT) res.setHeader('X-Commit', process.env.GIT_COMMIT);
  res.status(status==='error'?500:200).json({ status, uptimeSec, version: process.env.APP_VERSION || 'dev', commit: process.env.GIT_COMMIT || undefined, checks });
});
app.use('/auth', authLimiter, authRouter);
app.use('/iap', defaultLimiter, (req,_res,next)=>{ if(req.method==='GET' && req.path==='/status') subscriptionStatusLookups.inc(); next(); }, iapRouter);
// Metrics endpoint
app.get('/metrics', async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if(token) {
    const header = req.headers.authorization || '';
    const ok = header.startsWith('Bearer ') && header.slice(7) === token;
    if(!ok) return res.status(401).end('unauthorized');
  }
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
app.use('/webhooks', defaultLimiter, webhookRouter);
app.use('/account', defaultLimiter, accountRouter);
app.use('/journal', defaultLimiter, journalRouter);
app.use('/entitlements', defaultLimiter, entitlementsRouter);
// OpenAPI (static minimal spec)
app.get('/openapi.json', (_req,res)=>{ res.json(openApiSpec); });

// Subscription expiry sweep (async provider) every 5 minutes (skip during tests)
if(process.env.NODE_ENV !== 'test') {
  const intervalMs = parseInt(process.env.SUB_EXPIRY_SWEEP_MS || '300000',10);
  setInterval(async () => {
    try {
      const res = await sweepProvider.runExpirySweep();
      if(res.expired>0){
        subscriptionExpirySweeps.inc(res.expired);
        logger.info({ msg:'subscription.expiry.sweep', expired: res.expired });
      }
    } catch(e:any) {
      logger.error({ msg:'subscription.expiry.sweep.error', error: e.message });
    }
  }, intervalMs).unref();
}

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  reportError(err, 'request.error', { context: { path: req.path, method: req.method } });
  if(res.headersSent) return;
  res.status(err.status || 500).json({ success:false, error: 'Internal error' });
});

export function startServer(port: number|string = process.env.PORT || 3000) {
  const srv = app.listen(port, () => {
    console.log('Backend spec server running on :' + port);
  });
  return srv;
}

if (require.main === module) {
  startServer();
}
