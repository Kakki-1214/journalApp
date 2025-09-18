import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// Basic models
export interface DbUser {
  id: string;
  email: string | null; // email user or derived from provider token
  provider: 'email' | 'google' | 'apple';
  providerSubject: string; // subject/uid inside provider token
  displayName: string | null;
  passwordHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbSubscription {
  id: string;
  userId: string;
  platform: 'apple' | 'google' | 'none';
  productId: string | null;
  originalTransactionId: string | null; // apple
  purchaseToken: string | null;          // google
  status: 'active' | 'expired' | 'canceled';
  expiresAt: string | null;
  latestReceipt: string | null; // raw receipt/purchase token for re-validation
  willRenew?: number | null; // 1/0 future placeholder
  createdAt: string;
  updatedAt: string;
}

const dbFile = process.env.DB_FILE || 'data.sqlite';
export const db = new Database(dbFile);

// --- Simple migration system -------------------------------------------------
// Each migration has an id (timestamp style) and a function that runs once.
// Add new migrations to the array; they will execute in order if not recorded.
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);

interface Migration { id: string; up: () => void; }
const migrations: Migration[] = [
  // Baseline placeholder (if future structural changes are needed, add more here)
  { id: '20240901_000001_baseline', up: () => { /* baseline marker */ } },
];

function hasMigration(id: string): boolean {
  const row = db.prepare('SELECT 1 FROM schema_migrations WHERE id=?').get(id);
  return !!row;
}

function recordMigration(id: string) {
  // Use OR IGNORE to avoid race when test workers / multiple imports run concurrently.
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(id, new Date().toISOString());
}

for(const m of migrations) {
  if(!hasMigration(m.id)) {
    const trx = db.transaction(() => { m.up(); recordMigration(m.id); });
    trx();
  }
}
// -----------------------------------------------------------------------------

db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  display_name TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_subject)
);`);

// Add unique index for email if not exists (nullable emails allowed, duplicates ignored when null)
try {
  const existingEmailIndex = db.prepare(`PRAGMA index_list(users)`).all() as any[];
  if(!existingEmailIndex.find(r => /users_email_unique/i.test(r.name))) {
    // Using partial uniqueness workaround: Since SQLite lacks partial index on older versions, we enforce via trigger alternative.
    // Simpler: create unique index treating NULLs as distinct (SQLite already treats NULL != NULL in UNIQUE)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL`);
  }
} catch {}

// Migration: add password_hash column if missing
const userCols = db.prepare("PRAGMA table_info(users)").all() as { name:string }[];
if(!userCols.find(c=>c.name==='password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}

db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  product_id TEXT,
  original_transaction_id TEXT,
  purchase_token TEXT,
  status TEXT NOT NULL,
  expires_at TEXT,
  latest_receipt TEXT,
  will_renew INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

// Migration: add will_renew column if missing (older DBs)
try {
  const subCols = db.prepare("PRAGMA table_info(subscriptions)").all() as { name:string }[];
  if(!subCols.find(c=>c.name==='will_renew')) {
    db.exec('ALTER TABLE subscriptions ADD COLUMN will_renew INTEGER');
  }
} catch {}

db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  fingerprint TEXT,
  reused_at TEXT
);`);

db.exec(`CREATE TABLE IF NOT EXISTS webhook_events_processed (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(provider, event_id)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  product_id TEXT,
  event_type TEXT NOT NULL,
  expiry_date TEXT,
  raw_payload TEXT,
  created_at TEXT NOT NULL
);`);

// JWT jti revocation list
db.exec(`CREATE TABLE IF NOT EXISTS revoked_jtis (
  jti TEXT PRIMARY KEY,
  user_id TEXT,
  revoked_at TEXT NOT NULL
);`);

// User journal entries (for storage limiting). Assuming simple text content for now.
db.exec(`CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  meta?: any;
  createdAt: string;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  platform: 'apple' | 'google';
  productId: string | null;
  eventType: string; // verified|renewed|canceled|expired|grace|refund etc.
  expiryDate: string | null;
  rawPayload?: any;
  createdAt: string;
}

export interface RefreshTokenRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  fingerprint?: string | null;
  reusedAt?: string | null;
}

export function addAuditLog(action: string, userId: string | null, meta?: any) {
  const log: AuditLog = { id: randomUUID(), userId, action, meta, createdAt: new Date().toISOString() };
  db.prepare(`INSERT INTO audit_logs (id, user_id, action, meta, created_at) VALUES (@id, @userId, @action, @meta, @createdAt)`).run({ ...log, meta: meta ? JSON.stringify(meta).slice(0,2000) : null });
}

export function addSubscriptionEvent(event: Omit<SubscriptionEvent, 'id' | 'createdAt'>) {
  const row: SubscriptionEvent = { id: randomUUID(), createdAt: new Date().toISOString(), ...event };
  db.prepare(`INSERT INTO subscription_events (id, user_id, platform, product_id, event_type, expiry_date, raw_payload, created_at) VALUES (@id, @userId, @platform, @productId, @eventType, @expiryDate, @rawPayload, @createdAt)`) 
    .run({ ...row, rawPayload: row.rawPayload ? JSON.stringify(row.rawPayload).slice(0,4000) : null });
  return row;
}

export function issueRefreshToken(userId: string, ttlDays = 30, fingerprint?: string): RefreshTokenRow {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays*24*60*60*1000);
  const row: RefreshTokenRow = { id: randomUUID(), userId, token: randomUUID(), expiresAt: expires.toISOString(), createdAt: now.toISOString(), revokedAt: null, fingerprint: fingerprint ?? null, reusedAt: null };
  db.prepare(`INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at, revoked_at, fingerprint, reused_at) VALUES (@id, @userId, @token, @expiresAt, @createdAt, @revokedAt, @fingerprint, @reusedAt)`).run(row);
  return row;
}

export function findValidRefreshToken(token: string): RefreshTokenRow | undefined {
  const row: any = db.prepare(`SELECT * FROM refresh_tokens WHERE token=? LIMIT 1`).get(token);
  if(!row) return undefined;
  if(new Date(row.expires_at).getTime() < Date.now()) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    fingerprint: row.fingerprint,
    reusedAt: row.reused_at
  };
}

export function revokeRefreshToken(token: string) {
  db.prepare(`UPDATE refresh_tokens SET revoked_at=? WHERE token=?`).run(new Date().toISOString(), token);
}

export function rotateRefreshToken(oldToken: string, userId: string): RefreshTokenRow | undefined {
  const existing = findValidRefreshToken(oldToken);
  if(!existing) return undefined;
  revokeRefreshToken(oldToken);
  return issueRefreshToken(userId);
}

export function markRefreshTokenReused(token: string) {
  db.prepare(`UPDATE refresh_tokens SET reused_at=? WHERE token=?`).run(new Date().toISOString(), token);
}

export function revokeAllRefreshTokensForUser(userId: string) {
  db.prepare(`UPDATE refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).run(new Date().toISOString(), userId);
}

export function markWebhookProcessed(provider: string, eventId: string): boolean {
  try {
    db.prepare(`INSERT INTO webhook_events_processed (id, provider, event_id, created_at) VALUES (?, ?, ?, ? )`).run(randomUUID(), provider, eventId, new Date().toISOString());
    return true;
  } catch { return false; }
}

export function isWebhookProcessed(provider: string, eventId: string): boolean {
  const row = db.prepare(`SELECT 1 FROM webhook_events_processed WHERE provider=? AND event_id=?`).get(provider, eventId);
  return !!row;
}

// User DAO
export function getUserByProvider(provider: DbUser['provider'], providerSubject: string): DbUser | undefined {
  const row = db.prepare(`SELECT * FROM users WHERE provider = ? AND provider_subject = ?`).get(provider, providerSubject);
  if (!row) return undefined;
  return mapUser(row);
}

export function getUserById(id: string): DbUser | undefined {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  if (!row) return undefined;
  return mapUser(row);
}

export function createUser(data: Omit<DbUser, 'id' | 'createdAt' | 'updatedAt'>): DbUser {
  const now = new Date().toISOString();
  const user: DbUser = { id: randomUUID(), createdAt: now, updatedAt: now, ...data };
  db.prepare(`INSERT INTO users (id, email, provider, provider_subject, display_name, password_hash, created_at, updated_at) VALUES (@id, @email, @provider, @providerSubject, @displayName, @passwordHash, @createdAt, @updatedAt)`).run({ ...user, passwordHash: (user as any).passwordHash ?? null });
  return user;
}

export function upsertUser(provider: DbUser['provider'], providerSubject: string, attrs: Partial<Omit<DbUser, 'id' | 'provider' | 'providerSubject'>> & { email?: string | null; displayName?: string | null; passwordHash?: string | null; }): DbUser {
  const existing = getUserByProvider(provider, providerSubject);
  if (existing) {
    const updatedAt = new Date().toISOString();
    const merged = { ...existing, ...attrs, updatedAt } as DbUser;
    db.prepare(`UPDATE users SET email=@email, display_name=@displayName, password_hash=@passwordHash, updated_at=@updatedAt WHERE id=@id`).run({ ...merged, passwordHash: (merged as any).passwordHash ?? existing.passwordHash ?? null });
    return merged;
  }
  return createUser({ provider, providerSubject, email: attrs.email ?? null, displayName: attrs.displayName ?? null, passwordHash: attrs.passwordHash ?? null });
}

function mapUser(row: any): DbUser {
  return {
    id: row.id,
    email: row.email,
    provider: row.provider,
    providerSubject: row.provider_subject,
    displayName: row.display_name,
  passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Subscription DAO
export function getActiveSubscriptionForUser(userId: string): DbSubscription | undefined {
  const row = db.prepare(`SELECT * FROM subscriptions WHERE user_id=? AND status='active' ORDER BY updated_at DESC LIMIT 1`).get(userId);
  return row ? mapSub(row) : undefined;
}

// Helper: fetch latest subscription regardless of status (for webhook toggles affecting willRenew)
export function getLatestSubscriptionForUser(userId: string): DbSubscription | undefined {
  const row = db.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1`).get(userId);
  return row ? mapSub(row) : undefined;
}

export function upsertActiveSubscription(userId: string, platform: DbSubscription['platform'], data: Partial<Omit<DbSubscription, 'id' | 'userId' | 'platform' | 'createdAt' | 'updatedAt' | 'status'>> & { status: DbSubscription['status']; }): DbSubscription {
  const now = new Date().toISOString();
  const existing = getActiveSubscriptionForUser(userId);
  if (existing) {
    const merged: DbSubscription = { ...existing, ...data, platform, userId, updatedAt: now } as DbSubscription;
    db.prepare(`UPDATE subscriptions SET platform=@platform, product_id=@productId, original_transaction_id=@originalTransactionId, purchase_token=@purchaseToken, status=@status, expires_at=@expiresAt, latest_receipt=@latestReceipt, will_renew=@willRenew, updated_at=@updatedAt WHERE id=@id`).run({ ...merged, willRenew: (merged as any).willRenew ?? null });
    return merged;
  }
  const sub: DbSubscription = {
    id: randomUUID(),
    userId,
    platform,
    productId: data.productId ?? null,
    originalTransactionId: data.originalTransactionId ?? null,
    purchaseToken: data.purchaseToken ?? null,
    status: data.status,
    expiresAt: data.expiresAt ?? null,
    latestReceipt: data.latestReceipt ?? null,
    willRenew: (data as any).willRenew ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`INSERT INTO subscriptions (id, user_id, platform, product_id, original_transaction_id, purchase_token, status, expires_at, latest_receipt, will_renew, created_at, updated_at) VALUES (@id, @userId, @platform, @productId, @originalTransactionId, @purchaseToken, @status, @expiresAt, @latestReceipt, @willRenew, @createdAt, @updatedAt)`).run(sub);
  return sub;
}

function mapSub(row: any): DbSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    productId: row.product_id,
    originalTransactionId: row.original_transaction_id,
    purchaseToken: row.purchase_token,
    status: row.status,
    expiresAt: row.expires_at,
    latestReceipt: row.latest_receipt,
  willRenew: row.will_renew,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findSubscriptionByPurchaseToken(token: string): DbSubscription | undefined {
  const row = db.prepare(`SELECT * FROM subscriptions WHERE purchase_token=? LIMIT 1`).get(token);
  return row ? mapSub(row) : undefined;
}

export function findSubscriptionByOriginalTransactionId(txId: string): DbSubscription | undefined {
  const row = db.prepare(`SELECT * FROM subscriptions WHERE original_transaction_id=? LIMIT 1`).get(txId);
  return row ? mapSub(row) : undefined;
}

// Expiry sweep: mark active subscriptions whose expires_at < now as expired
export function runExpirySweep(): { expired: number } {
  const now = new Date();
  const nowIso = now.toISOString();
  // Single SQL to mark and count
  const stmt = db.prepare(`UPDATE subscriptions SET status='expired', updated_at=? WHERE status='active' AND expires_at IS NOT NULL AND expires_at < ?`);
  const info = stmt.run(nowIso, nowIso);
  return { expired: info.changes };
}

// JTI revocation helpers
export function revokeJti(jti: string, userId?: string) {
  if(!jti) return;
  try { db.prepare(`INSERT OR IGNORE INTO revoked_jtis (jti, user_id, revoked_at) VALUES (?,?,?)`).run(jti, userId || null, new Date().toISOString()); } catch {}
}
export function isJtiRevoked(jti?: string): boolean {
  if(!jti) return false;
  const row = db.prepare(`SELECT 1 FROM revoked_jtis WHERE jti=? LIMIT 1`).get(jti);
  return !!row;
}

export function insertJournalEntry(userId: string, content: string) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`INSERT INTO journal_entries (id, user_id, content, created_at, updated_at) VALUES (?,?,?,?,?)`).run(id, userId, content, now, now);
  return { id, userId, content, createdAt: now, updatedAt: now };
}

export function listJournalEntries(userId: string, limit = 500, offset = 0) {
  const rows = db.prepare(`SELECT * FROM journal_entries WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset);
  return rows.map((r:any)=>({ id:r.id, userId:r.user_id, content:r.content, createdAt:r.created_at, updatedAt:r.updated_at }));
}

export function deleteJournalEntry(userId: string, entryId: string) {
  db.prepare(`DELETE FROM journal_entries WHERE id=? AND user_id=?`).run(entryId, userId);
}

export function totalJournalBytes(userId: string): number {
  const row:any = db.prepare(`SELECT SUM(LENGTH(content)) as bytes FROM journal_entries WHERE user_id=?`).get(userId);
  return row?.bytes || 0;
}
