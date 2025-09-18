import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { DBProvider } from './dbProvider';
import type { DbUser, DbSubscription, RefreshTokenRow, SubscriptionEvent } from './db';

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (!pool) {
    const conn = process.env.DATABASE_URL;
    if (!conn) throw new Error('DATABASE_URL not set for Postgres provider');
    pool = new Pool({ connectionString: conn, max: parseInt(process.env.PG_POOL_MAX || '10',10) });
  }
  return pool;
}

async function applyMigrations() {
  const p = getPool();
  await p.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL)');
  const { rows } = await p.query('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r:any)=>r.id));
  const dir = join(__dirname, '..', 'migrations');
  let files: string[] = [];
  try { files = readdirSync(dir).filter(f=>/\.sql$/.test(f)).sort(); } catch { return; }
  for(const f of files) {
    const id = f.replace(/\.sql$/,'');
    if(applied.has(id)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id, applied_at) VALUES ($1, NOW())', [id]);
      await client.query('COMMIT');
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  }
}

async function ensureInit() {
  if(initialized) return;
  await applyMigrations();
  initialized = true;
}

function mapUser(row: any): DbUser {
  return {
    id: row.id, email: row.email, provider: row.provider, providerSubject: row.provider_subject,
    displayName: row.display_name, passwordHash: row.password_hash, createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function mapSub(row: any): DbSubscription {
  return {
    id: row.id, userId: row.user_id, platform: row.platform, productId: row.product_id,
    originalTransactionId: row.original_transaction_id, purchaseToken: row.purchase_token,
    status: row.status, expiresAt: row.expires_at, latestReceipt: row.latest_receipt,
    willRenew: row.will_renew, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export async function initPostgresProvider() {
  await applyMigrations();
}

export const postgresProvider: DBProvider = {
  async getUserByProvider(provider, subject) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT * FROM users WHERE provider=$1 AND provider_subject=$2 LIMIT 1', [provider, subject]);
    if(!rows[0]) return undefined; return mapUser(rows[0]);
  },
  async getUserById(id) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT * FROM users WHERE id=$1', [id]);
    if(!rows[0]) return undefined; return mapUser(rows[0]);
  },
  async upsertUser(provider, providerSubject, attrs) {
    await ensureInit();
    const existing = await this.getUserByProvider(provider, providerSubject);
    if(existing) {
      const fields: string[] = []; const values: any[] = []; let idx=1;
      if(attrs.email !== undefined) { fields.push(`email=$${idx++}`); values.push(attrs.email); }
      if(attrs.displayName !== undefined) { fields.push(`display_name=$${idx++}`); values.push(attrs.displayName); }
      if(attrs.passwordHash !== undefined) { fields.push(`password_hash=$${idx++}`); values.push(attrs.passwordHash); }
      if(fields.length) {
        values.push(existing.id); // id param
        await getPool().query(`UPDATE users SET ${fields.join(',')}, updated_at=NOW() WHERE id=$${values.length}`, values);
      }
      return (await this.getUserById(existing.id))!;
    }
  return this.createUser({ provider, providerSubject, email: attrs.email ?? null, displayName: attrs.displayName ?? null, passwordHash: attrs.passwordHash ?? null } as any);
  },
  async createUser(data) {
    await ensureInit();
    const { id, provider, providerSubject, email, displayName, passwordHash } = data as any;
    const userId = id || randomUUID();
    const { rows } = await getPool().query(
      'INSERT INTO users (id, provider, provider_subject, email, display_name, password_hash, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *',
      [userId, provider, providerSubject, email ?? null, displayName ?? null, passwordHash ?? null]
    );
    return mapUser(rows[0]);
  },
  async issueRefreshToken(userId, ttlDays=30, fingerprint) {
    await ensureInit();
    const id = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + ttlDays*24*60*60*1000).toISOString();
    const { rows } = await getPool().query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at, updated_at, fingerprint) VALUES ($1,$2,$3,$4,NOW(),NOW(),$5) RETURNING *',
      [id, userId, token, expiresAt, fingerprint ?? null]
    );
    const r = rows[0];
    return { id: r.id, userId: r.user_id, token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at, revokedAt: r.revoked_at, parentTokenId: r.parent_token_id, reusedAt: r.reused_at, fingerprint: r.fingerprint } as RefreshTokenRow;
  },
  async findValidRefreshToken(token) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT * FROM refresh_tokens WHERE token=$1 LIMIT 1', [token]);
    if(!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, userId: r.user_id, token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at, revokedAt: r.revoked_at, parentTokenId: r.parent_token_id, reusedAt: r.reused_at, fingerprint: r.fingerprint } as RefreshTokenRow;
  },
  async rotateRefreshToken(oldToken, userId) {
    await ensureInit();
    const existing = await this.findValidRefreshToken(oldToken);
    if(!existing || existing.userId !== userId) return undefined;
    // revoke old
    await getPool().query('UPDATE refresh_tokens SET revoked_at=NOW(), updated_at=NOW() WHERE token=$1 AND revoked_at IS NULL', [oldToken]);
    // issue new with parent reference
    const id = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    const { rows } = await getPool().query('INSERT INTO refresh_tokens (id,user_id,token,expires_at,parent_token_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *', [id, userId, token, expiresAt, existing.id]);
    const r = rows[0];
    return { id: r.id, userId: r.user_id, token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at, revokedAt: r.revoked_at, parentTokenId: r.parent_token_id, reusedAt: r.reused_at, fingerprint: r.fingerprint } as RefreshTokenRow;
  },
  async revokeRefreshToken(token) {
    await ensureInit();
    await getPool().query('UPDATE refresh_tokens SET revoked_at=NOW(), updated_at=NOW() WHERE token=$1 AND revoked_at IS NULL', [token]);
  },
  async revokeAllRefreshTokensForUser(userId) {
    await ensureInit();
    await getPool().query('UPDATE refresh_tokens SET revoked_at=NOW(), updated_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
  },
  async markRefreshTokenReused(token) {
    await ensureInit();
    await getPool().query('UPDATE refresh_tokens SET reused_at=NOW(), updated_at=NOW() WHERE token=$1 AND reused_at IS NULL', [token]);
  },
  async setRefreshTokenFingerprint(tokenId, fp) {
    await ensureInit();
    await getPool().query("UPDATE refresh_tokens SET fingerprint=COALESCE(fingerprint,$1) WHERE id=$2 AND (fingerprint IS NULL OR fingerprint='')", [fp, tokenId]);
  },
  async getActiveSubscriptionForUser(userId) {
    await ensureInit();
    const { rows } = await getPool().query("SELECT * FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY updated_at DESC LIMIT 1", [userId]);
    if(!rows[0]) return undefined; return mapSub(rows[0]);
  },
  async getLatestSubscriptionForUser(userId) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1', [userId]);
    if(!rows[0]) return undefined; return mapSub(rows[0]);
  },
  async upsertActiveSubscription(userId, platform, data) {
    await ensureInit();
    // Strategy: insert new row each call (immutable history) or update existing? Current schema updates same row (uses id). We'll upsert by (user_id, platform, product_id, original_transaction_id, purchase_token) preferring last active.
    const id = randomUUID();
    const { productId, originalTransactionId, purchaseToken, status, expiresAt, latestReceipt, willRenew } = data as any;
    const { rows } = await getPool().query(
      'INSERT INTO subscriptions (id,user_id,platform,product_id,original_transaction_id,purchase_token,status,expires_at,latest_receipt,will_renew,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *',
      [id, userId, platform, productId ?? null, originalTransactionId ?? null, purchaseToken ?? null, status, expiresAt ?? null, latestReceipt ?? null, willRenew ?? null]
    );
    return mapSub(rows[0]);
  },
  async findSubscriptionByPurchaseToken(token) {
    await ensureInit();
    if(!token) return undefined; const { rows } = await getPool().query('SELECT * FROM subscriptions WHERE purchase_token=$1 ORDER BY updated_at DESC LIMIT 1', [token]);
    if(!rows[0]) return undefined; return mapSub(rows[0]);
  },
  async findSubscriptionByOriginalTransactionId(txId) {
    await ensureInit();
    if(!txId) return undefined; const { rows } = await getPool().query('SELECT * FROM subscriptions WHERE original_transaction_id=$1 ORDER BY updated_at DESC LIMIT 1', [txId]);
    if(!rows[0]) return undefined; return mapSub(rows[0]);
  },
  async runExpirySweep() {
    await ensureInit();
    const { rowCount } = await getPool().query("UPDATE subscriptions SET status='expired', updated_at=NOW() WHERE status='active' AND expires_at IS NOT NULL AND expires_at < NOW()");
    return { expired: rowCount || 0 };
  },
  async insertJournalEntry(userId, content) {
    await ensureInit();
    const id = randomUUID();
    const { rows } = await getPool().query('INSERT INTO journal_entries (id,user_id,content,created_at,updated_at) VALUES ($1,$2,$3,NOW(),NOW()) RETURNING *', [id, userId, content]);
    const r = rows[0];
    return { id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at };
  },
  async listJournalEntries(userId, limit=500, offset=0) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT * FROM journal_entries WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset]);
  return rows.map((r:any)=>({ id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at }));
  },
  async deleteJournalEntry(userId, entryId) {
    await ensureInit();
    await getPool().query('DELETE FROM journal_entries WHERE id=$1 AND user_id=$2', [entryId, userId]);
  },
  async totalJournalBytes(userId) {
    await ensureInit();
    const { rows } = await getPool().query('SELECT COALESCE(SUM(octet_length(content)),0) AS bytes FROM journal_entries WHERE user_id=$1', [userId]);
    return parseInt(rows[0]?.bytes || '0',10);
  },
  async addAuditLog(action, userId, meta) {
    await ensureInit();
    await getPool().query('INSERT INTO audit_logs (id,user_id,action,meta,created_at) VALUES ($1,$2,$3,$4,NOW())', [randomUUID(), userId ?? null, action, meta ? JSON.stringify(meta) : null]);
  },
  async addSubscriptionEvent(event) {
    await ensureInit();
    const id = randomUUID();
    const { rows } = await getPool().query('INSERT INTO subscription_events (id,user_id,platform,product_id,event_type,expiry_date,raw_payload,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *', [id, event.userId, event.platform, event.productId ?? null, event.eventType, event.expiryDate ?? null, event.rawPayload ? JSON.stringify(event.rawPayload) : null]);
    const r = rows[0];
    return { id: r.id, userId: r.user_id, platform: r.platform, productId: r.product_id, eventType: r.event_type, expiryDate: r.expiry_date, rawPayload: r.raw_payload ? JSON.parse(r.raw_payload) : null, createdAt: r.created_at } as SubscriptionEvent;
  },
  async revokeJti(jti,userId) {
    await ensureInit();
    if(!jti) return; await getPool().query('INSERT INTO revoked_jtis (jti, user_id, revoked_at) VALUES ($1,$2,NOW()) ON CONFLICT (jti) DO NOTHING', [jti, userId ?? null]);
  },
  async isJtiRevoked(jti) {
    await ensureInit();
    if(!jti) return false; const { rows } = await getPool().query('SELECT 1 FROM revoked_jtis WHERE jti=$1 LIMIT 1', [jti]);
    return !!rows[0];
  },
  async markWebhookProcessed(provider, eventId) {
    await ensureInit();
    if(!provider || !eventId) return false;
    try {
      await getPool().query('INSERT INTO webhook_events_processed (id,provider,event_id,created_at) VALUES ($1,$2,$3,NOW())', [randomUUID(), provider, eventId]);
      return true;
    } catch { return false; }
  },
  async isWebhookProcessed(provider, eventId) {
    await ensureInit();
    if(!provider || !eventId) return false; const { rows } = await getPool().query('SELECT 1 FROM webhook_events_processed WHERE provider=$1 AND event_id=$2 LIMIT 1', [provider, eventId]);
    return !!rows[0];
  }
};
