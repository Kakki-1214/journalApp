-- Optimize expiry sweep and lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions(status, expires_at);
-- (Optional future) index for latest subscription per user status ordering
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_updated ON subscriptions(user_id, updated_at DESC);

INSERT INTO schema_migrations(id, applied_at)
  VALUES ('0002_indexes', now())
  ON CONFLICT (id) DO NOTHING;
