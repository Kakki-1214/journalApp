-- Initial PostgreSQL schema aligned with current SQLite tables
CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  display_name text,
  password_hash text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  product_id text,
  original_transaction_id text,
  purchase_token text,
  status text NOT NULL,
  expires_at timestamptz,
  latest_receipt text,
  will_renew integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  user_id text,
  action text NOT NULL,
  meta text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  revoked_at timestamptz,
  fingerprint text,
  reused_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

CREATE TABLE IF NOT EXISTS webhook_events_processed (
  id text PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE(provider,event_id)
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  product_id text,
  event_type text NOT NULL,
  expiry_date timestamptz,
  raw_payload text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS revoked_jtis (
  jti text PRIMARY KEY,
  user_id text,
  revoked_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created ON journal_entries(user_id, created_at DESC);

-- Record this migration
INSERT INTO schema_migrations(id, applied_at)
  VALUES ('0001_init', now())
  ON CONFLICT (id) DO NOTHING;