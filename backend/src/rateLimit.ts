import type { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet, __cacheClearTest } from './redisClient';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  key?: (req: Request) => string; // default ip+route
}


function makeKey(base: string) {
  return `rl2:${base}`;
}

export function createRateLimiter(cfg: RateLimitConfig) {
  const windowSec = Math.ceil(cfg.windowMs / 1000);
  return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
      const bucketBase = cfg.key ? cfg.key(req) : `${ip}:${req.path}`;
      const windowBucket = Math.floor(Date.now() / cfg.windowMs);
      const cacheKey = makeKey(`${bucketBase}:${windowBucket}`);
      const raw = await cacheGet(cacheKey);
      const current = raw ? parseInt(raw,10) : 0;
      if(current >= cfg.max) {
        res.setHeader('Retry-After', String(windowSec));
        return res.status(429).json({ success:false, error:'RATE_LIMITED' });
      }
      await cacheSet(cacheKey, String(current+1), windowSec + 2);
      return next();
    } catch(e:any) {
      // fail open
      return next();
    }
  };
}

// For tests: naive reset (memory fallback keys only) – redis keys will expire naturally
export async function resetRateLimiters() {
  __cacheClearTest();
}
