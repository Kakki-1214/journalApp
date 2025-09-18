// Unified DB provider interface (Day1 abstraction for Postgres migration)
import type { DbUser, DbSubscription, RefreshTokenRow, SubscriptionEvent } from './db';

export interface DBProvider {
  // Users
  getUserByProvider(provider: DbUser['provider'], providerSubject: string): Promise<DbUser | undefined>;
  getUserById(id: string): Promise<DbUser | undefined>;
  upsertUser(provider: DbUser['provider'], providerSubject: string, attrs: Partial<Omit<DbUser,'id'|'provider'|'providerSubject'>> & { email?: string | null; displayName?: string | null; passwordHash?: string | null }): Promise<DbUser>;
  createUser(data: Omit<DbUser,'id'|'createdAt'|'updatedAt'>): Promise<DbUser>;

  // Refresh tokens
  issueRefreshToken(userId: string, ttlDays?: number, fingerprint?: string): Promise<RefreshTokenRow>;
  findValidRefreshToken(token: string): Promise<RefreshTokenRow | undefined>;
  rotateRefreshToken(oldToken: string, userId: string): Promise<RefreshTokenRow | undefined>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
  markRefreshTokenReused(token: string): Promise<void>;
  setRefreshTokenFingerprint(tokenId: string, fingerprint: string): Promise<void>;

  // Subscriptions
  getActiveSubscriptionForUser(userId: string): Promise<DbSubscription | undefined>;
  getLatestSubscriptionForUser(userId: string): Promise<DbSubscription | undefined>;
  upsertActiveSubscription(userId: string, platform: DbSubscription['platform'], data: Partial<Omit<DbSubscription,'id'|'userId'|'platform'|'createdAt'|'updatedAt'|'status'>> & { status: DbSubscription['status'] }): Promise<DbSubscription>;
  findSubscriptionByPurchaseToken(token: string): Promise<DbSubscription | undefined>;
  findSubscriptionByOriginalTransactionId(txId: string): Promise<DbSubscription | undefined>;
  runExpirySweep(): Promise<{ expired: number }>;

  // Journal
  insertJournalEntry(userId: string, content: string): Promise<any>;
  listJournalEntries(userId: string, limit?: number, offset?: number): Promise<any[]>;
  deleteJournalEntry(userId: string, entryId: string): Promise<void>;
  totalJournalBytes(userId: string): Promise<number>;

  // Events / audit / revocation
  addAuditLog(action: string, userId: string | null, meta?: any): Promise<void>;
  addSubscriptionEvent(event: Omit<SubscriptionEvent,'id'|'createdAt'>): Promise<SubscriptionEvent>;
  revokeJti(jti: string, userId?: string): Promise<void>;
  isJtiRevoked(jti?: string): Promise<boolean>;

  // Webhook idempotency
  markWebhookProcessed(provider: string, eventId: string): Promise<boolean>;
  isWebhookProcessed(provider: string, eventId: string): Promise<boolean>;
}

export type DBProviderFactory = () => DBProvider;
