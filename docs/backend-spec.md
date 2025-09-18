# Backend Specification (Current)

## Overview
Backend supports auth, subscriptions (Apple/Google), webhook lifecycle, auditing, and security hardening. All endpoints return:
```
{ success: boolean, data?: any, error?: string, details?: any }
```

### Persistence Layer
SQLite (better-sqlite3) WAL mode `data.sqlite`.
Tables:

1. `users` (id, email, provider, provider_subject, display_name, password_hash, created_at, updated_at)
2. `subscriptions` (id, user_id, platform, product_id, original_transaction_id, purchase_token, status, expires_at, latest_receipt, created_at, updated_at)
3. `refresh_tokens` (id, user_id, token, expires_at, created_at, revoked_at, fingerprint, reused_at)
4. `subscription_events` (id, user_id, platform, product_id, event_type, expiry_date, raw_payload, created_at)
5. `audit_logs` (id, user_id, action, meta, created_at)
6. `webhook_events_processed` (id, provider, event_id, created_at)

Key DAO functions: user upsert, active subscription upsert, refresh token issue/rotate, subscription event add, webhook idempotency markers.

Limitations:

- No external migration tool.
- Subscription upgrade/downgrade semantics simplified.
- Fingerprint binding storing initial fingerprint pending.

## Authentication

### POST /auth/email/register
Request: `{ email, password }`
Behavior:
- Password hashed with bcrypt (cost 10) stored in `users.password_hash`.
Request: `{ email, password }` -> verifies bcrypt hash. On failure 401.
Response: `{ token, user }`

### POST /auth/google/exchange
- Verifies `id_token` signature via Google JWKS (`https://www.googleapis.com/oauth2/v3/certs`).
- Creates or retrieves a user (provider `google`, subject = Google `sub`).
Response: `{ token, user }`

### POST /auth/apple/verify
Request: `{ identityToken }`
- Verifies identity token signature via Apple JWKS (`https://appleid.apple.com/auth/keys`).
- Creates or retrieves user (provider `apple`).

### JWT & Refresh Tokens

- Reuse detection: presenting revoked token => mark reused, revoke all user refresh tokens, audit event.
- Optional fingerprint binding (client supplies fingerprint; mismatch => revoke all).
- Future: version claim `ver` for global invalidation.

### Token Signature Verification
Failure in signature, aud, or iss validation → 401.

## Logging & Audit
Logging: pino (JSON). Each request gets a `requestId` and emits `request.start` and `request.finish` with duration and userId (if authenticated).
Audit logs stored in `audit_logs` table: `{ id, user_id, action, meta, created_at }` for key security events:
- `email.register`, `email.login.success`, `email.login.fail`
- `google.exchange`, `apple.verify`
- `iap.verify`
Only truncated JSON (2KB) of meta stored.
## In-App Purchases & Subscriptions

### Data Columns (subscriptions)

`will_renew` (INTEGER 0/1, nullable) 追加。現状は「将来の自動更新が期待できる暫定フラグ」。TEST MODE では `!expired && expiresAt` の単純判定。

### POST /iap/verify

Request: `{ platform: 'ios'|'android', receipt, productId? }`

Behavior:

- iOS: Apple verifyReceipt (prod → 21007 fallback sandbox)。Apple ステータスコードを内部エラーコードへマップ。
- Android: Service Account JWT → Access Token → Purchases.subscriptions GET。HTTP / OAuth エラーを内部エラーコードへマップ。
- 成功時: アクティブ購読 upsert (過去より新しいものを上書き)。期限切れなら `status=expired` で保存。

Response (成功例):

```jsonc
{
  "success": true,
  "data": {
    "isPro": true,
    "productId": "pro_monthly",
    "expiryDate": "2025-09-09T12:34:56.000Z",
    "status": "active",          // active | expired
    "source": "apple",           // apple | google
    "willRenew": true             // naive flag (has future expiry)
  }
}
```
失敗時 400: `{ success:false, error:"APPLE_ERR_INVALID_STATUS" }` など。

### Error Mapping (抜粋)

Apple → Internal:

- 21002 → APPLE_ERR_MALFORMED_RECEIPT
- 21007 → APPLE_ERR_SANDBOX_RECEIPT (自動で sandbox 再試行)
- 21010 → APPLE_ERR_UNAUTHORIZED
- その他未定義 → APPLE_ERR_UNKNOWN_STATUS

Google → Internal:

- 401 / invalid_grant → GOOGLE_ERR_AUTH
- 404 subscription not found → GOOGLE_ERR_NOT_FOUND
- 410 gone / expired payload → GOOGLE_ERR_EXPIRED
- その他 5xx → GOOGLE_ERR_SERVER

### Test Mode (IAP_TEST_MODE=1)

外部通信なし。`receipt` / トークンパターン:

- `product:<id>` 明示的 productId
- `future:<ms>` 指定 ms 先に expiry (例 `future:60000`)
- `past:<ms>` / `expired:<any>` 過去時刻 (即時 expired)
- それ以外: デフォルト未来 1h

### GET /iap/status

レスポンス拡張:

```jsonc
// アクティブ
{ "success":true, "data": { "isPro":true, "status":"active", "productId":"pro_monthly", "expiryDate":"...", "source":"apple", "willRenew":true } }
// 期限切れ (履歴反映)
{ "success":true, "data": { "isPro":false, "status":"expired", "productId":"pro_monthly", "expiryDate":"...", "source":"google", "willRenew":false } }
// 購読なし
{ "success":true, "data": { "isPro":false, "status":"none", "willRenew":false } }
```

ロジック:

1. アクティブ購読 (status='active') を検索
2. `expires_at` 過去 → expired 判定
3. アクティブ無い場合、最新行が `expired` なら expired として返却

### willRenew のイベント駆動更新

`subscriptions.will_renew` (INTEGER 0/1, nullable) は最初の `/iap/verify` 時に「未来の expires_at が存在するか」で初期化し、その後は Webhook により更新される。

Apple:

- `DID_CHANGE_RENEWAL_STATUS` + `AUTO_RENEW_DISABLED` → willRenew=0 (statusは変えない)
- `DID_CHANGE_RENEWAL_STATUS` + `AUTO_RENEW_ENABLED`  → status が active なら willRenew=1 (inactive 状態では次の renewed/purchased まで保留)
- `DID_RENEW` / `INITIAL_BUY` (renewed/purchased) → status=active (willRenew 変更せず)
- `EXPIRED` → status=expired, willRenew=0
- `CANCEL` / `REFUND` → status=canceled, willRenew=0

Google (RTDN numeric notificationType):

- 2 renewed / 4 purchased / 1 recovered / 7 restarted → status=active, willRenew=1
- 3 canceled / 12 revoked → status=canceled, willRenew=0
- 13 expired → status=expired, willRenew=0
- 5 on_hold / 6 in_grace / 10 paused → 状態保持 (willRenew 不変更)

Fallback: `will_renew` が null の旧レコードは `expires_at` が未来なら true として `/iap/status` で返却 (保存はしない)。

Test Mode: `IAP_TEST_MODE=1` では Google Webhook の Pub/Sub JWT 検証スキップ & 簡易 JSON / base64 ペイロードを許容, Apple は未署名 payload も許容。

 
### Expiry Sweep

`runExpirySweep()` が `expires_at < now` の active を一括で status='expired' 更新。デフォルト 5 分間隔 (ENV `SUB_EXPIRY_SWEEP_MS` 調整、test 環境では interval 無効)。


### Subscription Events

`subscription_events` に verified / expired などを記録し監査 & 分析用途。


## Webhooks

### POST /webhooks/apple

JWS verification pipeline:

1. Format + parts
2. x5c chain parse (issuer→subject continuity)
3. Validity window (NotBefore/NotAfter)
4. Root fingerprint allow-list (`APPLE_ROOT_FINGERPRINTS` / default set)
5. Leaf signature verify (RSA-SHA256)
6. Revocation stub (future OCSP/CRL)
On success: map notificationType/subtype → event, refresh expiry on renew, persist event, idempotency guard.

### POST /webhooks/google

Steps:

1. Optional Pub/Sub JWT verify (`x-goog-jwt` or Authorization Bearer) vs Google certs (iss=accounts.google.com, aud = `GOOGLE_PUBSUB_AUDIENCE` if set)
2. Base64 decode `message.data` JSON
3. Map numeric notificationType
4. Idempotency check
5. Refresh expiry via Google subscription verify for renew-like events
6. Record event + audit

## Data Models

User:
 
```json
{
  id: string,
  email?: string,
  name?: string,
  providers: [{ type: 'email'|'google'|'apple', subject: string }],
  proUntil?: string | null
}
```bash

SubscriptionStatus:
 
- Bcrypt password hashing
- Google & Apple identity token JWKS verification
- Apple receipt + Google subscription validation
- Redis (fallback) rate limiting (IP+path)

Planned / Partial:

- OCSP/CRL revocation
- Fingerprint persistence & binding
- Error taxonomy expansion & localization
- Advanced subscription plan transitions

## Environment Variables

```bash
JWT_SECRET=change-me
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_SA_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SA_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APPLE_CLIENT_ID=com.example.app (optional)
APPLE_SHARED_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANDROID_PACKAGE_NAME=com.example.app
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379 (optional)
Critical env vars are enforced at startup (missing -> process exit): `JWT_SECRET`, `APPLE_SHARED_SECRET`, `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`. Google Pub/Sub webhook now requires a valid JWT (missing also 401).
```

## Account Deletion

`DELETE /account` (auth required) hard-deletes user, subscriptions, subscription_events, audit_logs, then logs `account.delete` audit action.

## Rate Limiting

Redis (またはメモリ fallback) 120 req / 60s per IP+path => 429 `{ error: 'RATE_LIMITED' }`.

### Environment-Configurable Limits

Auth routes (`/auth/*`) とデフォルトルートで個別設定可能。

Env Keys:

```bash
AUTH_RATE_LIMIT_MAX=60            # 期間内最大回数 (デフォルト 60)
AUTH_RATE_LIMIT_WINDOW_MS=60000   # 期間(ミリ秒)
DEFAULT_RATE_LIMIT_MAX=120        # 非 auth ルート上限
DEFAULT_RATE_LIMIT_WINDOW_MS=60000
TEST_AUTH_RATE_LIMIT_MAX=3        # テスト時の auth 上限 (テストセットアップで使用)
```

未設定時はコード内デフォルトを採用。`TEST_AUTH_RATE_LIMIT_MAX` は test harness のみ。

## Health Check

### GET /healthz

包括的ヘルス (JSON)。

```jsonc
200 OK
{
  "status": "ok | degraded | error",
  "uptimeSec": 123,
  "version": "1.0.0",
  "checks": {
    "db": { "ok": true, "users": 10 },
    "cache": { "ok": true }
  }
}
```

- `status=ok`: 全 checks.ok=true
- `status=degraded`: 致命的でない (例: cache) 失敗
- `status=error` + HTTP 500: DB クエリ失敗など根幹機能不可

ユニットテスト: 正常系 (`health.test.ts`), DB 強制失敗によるエラー系 (`health.degraded.test.ts`)。

### GET /health

簡易互換 ( `{ ok: true }` )。将来レガシー互換用に残置。

## Database Migrations

内蔵シンプル実装 (ライブラリ未使用):

- `schema_migrations` テーブルで適用済み ID を記録。
- 起動時 `migrations` 配列を順序適用 (トランザクション)。
- ベースライン ID: `20240901_000001_baseline`。

追加手順:

1. `db.ts` の `migrations` 配列末尾にオブジェクト追加 `{ id: 'YYYYMMDD_HHMMSS_desc', name: '...', up: (db)=>{...} }`。
2. 既存テーブル変更は `ALTER TABLE` で後方互換的に (破壊的変更は新テーブル + データ移行推奨)。
3. テストは新スキーマ自動反映 (テスト起動で同じロジック実行)。

失敗時: トランザクション rollback しプロセス例外で起動失敗 (早期検知)。


Unified error responses use `errors.ts` helper with standardized codes (e.g., INVALID_SIGNATURE, INVALID_PUBSUB_TOKEN, BAD_REQUEST, UNAUTHORIZED, RATE_LIMITED, INTERNAL) and optional `details`.

## Versioning

Future: include `ver` claim for global access token invalidation.

---
Living document: reflects current hardening (chain validation, idempotency, Pub/Sub JWT, refresh reuse). Future updates will extend revocation and plan transitions.
