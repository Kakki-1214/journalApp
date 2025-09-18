# Postgres Migration Plan

## Goals
- Move from SQLite (dev) to PostgreSQL (prod) without feature regression.
- Keep a unified DAO API so route handlers stay unchanged.
- Support zero-downtime migration path once prod traffic exists.

## Phases
1. **Abstraction Layer**: Introduce a thin `DBProvider` interface with methods currently used by routes (users, subscriptions, journal entries, tokens, events, metrics). Keep SQLite impl as default.
2. **Postgres Adapter**: Implement using `pg` (node-postgres) or an ORM-lite (Drizzle). Prefer minimal SQL with prepared statements & parameterized queries.
3. **Env Switch**: If `DATABASE_URL` present -> use Postgres adapter; else fallback SQLite for local/dev/tests.
4. **Migration Tooling**: Use SQL migration files versioned in `backend/migrations/` with an applied migrations table (`schema_migrations`). Provide `npm run migrate` script that runs pending migrations inside container.
5. **Data Copy (One-Time)**: For existing single-node SQLite prod (if any) run export script:
   - `sqlite3 data.sqlite .dump --nosys > export.sql`
   - Transform to Postgres-compatible (data types, `AUTOINCREMENT` removal, `TEXT` vs `VARCHAR`) via simple script.
   - Import into Postgres within transaction.
6. **Verification**: Run read-only integrity checks: counts per table, random row spot-checks, subscription state invariants.
7. **Cutover**: Set maintenance (brief), point API to Postgres (set `DATABASE_URL`), run smoke tests, re-open.
8. **Rollback Plan**: Keep SQLite file snapshot; if critical failure revert env var and restart.

## Interface Sketch
```ts
export interface DBProvider {
  getUserByProvider(p:string, sub:string): DbUser|undefined;
  upsertUser(...): DbUser;
  createUser(...): DbUser;
  getUserById(id:string): DbUser|undefined;
  issueRefreshToken(userId:string, ttlDays?:number, fp?:string): RefreshTokenRow;
  findValidRefreshToken(token:string): RefreshTokenRow|undefined;
  rotateRefreshToken(oldToken:string, userId:string): RefreshTokenRow|undefined;
  revokeRefreshToken(token:string): void;
  revokeAllRefreshTokensForUser(userId:string): void;
  addSubscriptionEvent(event: Omit<SubscriptionEvent,'id'|'createdAt'>): SubscriptionEvent;
  upsertActiveSubscription(...): DbSubscription;
  getActiveSubscriptionForUser(userId:string): DbSubscription|undefined;
  getLatestSubscriptionForUser(userId:string): DbSubscription|undefined;
  runExpirySweep(): { expired:number };
  insertJournalEntry(userId:string, content:string): any;
  listJournalEntries(userId:string, limit?:number, offset?:number): any[];
  deleteJournalEntry(userId:string, entryId:string): void;
  totalJournalBytes(userId:string): number;
  revokeJti(jti:string, userId?:string): void;
  isJtiRevoked(jti:string): boolean;
}
```

## Considerations
- **Transactions**: Use `BEGIN ... COMMIT` around multi-table ops (account delete, subscription upsert + event write).
- **Connection Pool**: Use pg-pool (default). Tune: `MAX_POOL=10` initial.
- **Timeouts**: Set statement timeout (e.g., 5s) at connection.
- **Indices**: Add indices for lookups: `users(provider,provider_subject)`, `subscriptions(user_id,status,updated_at)`, `journal_entries(user_id,created_at)`.
- **Journal Storage**: Optionally move to `BYTEA` if binary/attachments appear later; currently `TEXT` fine.
- **Monitoring**: Expose pool stats via metrics (pending connections, idle, total).

## Next Steps
- Create `dbProvider.ts` interface file.
- Wrap current SQLite functions with adapter implementing that interface.
- Refactor imports in routes to use provider instead of direct functions.
- Implement Postgres adapter & migrations when ready.
