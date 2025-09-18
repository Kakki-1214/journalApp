import { createClient } from 'redis';
import { logger } from './logger';

let redis: ReturnType<typeof createClient> | null = null;
const memoryStore = new Map<string,{ value:string; expireAt:number }>();

export async function getRedis() {
  if(process.env.REDIS_URL) {
    if(!redis) {
      redis = createClient({ url: process.env.REDIS_URL });
      redis.on('error', err => logger.warn({ err }, 'redis.error'));
      try { await redis.connect(); logger.info('redis.connected'); } catch(e:any){ logger.warn({ err:e.message }, 'redis.connect_failed'); redis = null; }
    }
  }
  return redis;
}

export async function cacheSet(key: string, value: string, ttlSec: number) {
  const r = await getRedis();
  if(r) { await r.set(key, value, { EX: ttlSec }); return; }
  memoryStore.set(key, { value, expireAt: Date.now()+ttlSec*1000 });
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = await getRedis();
  if(r) return await r.get(key);
  const entry = memoryStore.get(key);
  if(!entry) return null;
  if(entry.expireAt < Date.now()) { memoryStore.delete(key); return null; }
  return entry.value;
}

// Test-only helper to clear in-memory cache (no effect if real redis in use)
export function __cacheClearTest() {
  memoryStore.clear();
}