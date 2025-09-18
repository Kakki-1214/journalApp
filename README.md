# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ````

   ```text
   ```

   ````

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Journal Feature Added

- Markdown editing + live preview toggle
- Statistics (donut chart of mood distribution)
- Responsive sidebar (auto-collapse under 900px width + manual toggle)

### Main Files (Core)

- `types/journal.ts` – Type definitions
- `lib/journalStorage.ts` – Persistence helpers (load/save/upsert/delete)
- `context/JournalContext.tsx` – React context with CRUD + search

### UI & Navigation (Dashboard + Mobile Tabs)

Dashboard (wide screens):

- `app/(dashboard)/_layout.tsx` – Dashboard stack group
- `components/layout/Sidebar.tsx` – Sidebar navigation (responsive collapse)
- `components/layout/DashboardLayout.tsx` – Adaptive container (handles width + collapse)
- `app/(dashboard)/home.tsx` – Stats overview (counts, moods)
- `app/(dashboard)/entries.tsx` – Uses shared components (EntryList + EntryEditor)
- `app/(dashboard)/calendar.tsx` – Calendar month grid with navigation
- `app/(dashboard)/stats.tsx` – Mood distribution donut chart
- `app/(dashboard)/tags.tsx` – Tag frequency listing
- `app/(dashboard)/settings.tsx` – Settings placeholder

Mobile Tabs:

- `(tabs)` group (Entries / Calendar / Tags / Stats / Settings)
- `(tabs)/journal/_layout.tsx` – Nested stack for list + new + detail
- `(tabs)/journal/index.tsx` – List view
- `(tabs)/journal/[id].tsx` – Detail editing (shared editor hook)

Legacy `app/journal/index.tsx` now only redirects to the tab stack for backward compatibility (old deep links).

### Shared Abstractions (Refactor)

- `hooks/journal/useJournalEditor.ts` – Central editor state machine (create/update/delete, mode toggle, tags)
These remove duplicated logic that previously lived separately in dashboard and tab screens.

### Markdown Preview

Markdown support is provided by `react-native-markdown-display`.

- Toggle between Edit and Preview modes in both the dashboard `entries` screen and the legacy detail screen.
- Inline styles customize headings, code blocks, inline code, emphasis, strong text, and links.
- Empty content in Preview shows a subtle placeholder.

Basic formatting examples you can try in the editor body:

```markdown
# Heading 1
## Heading 2

Regular paragraph with **bold**, _italic_, and `inline code`.

````

```js
// Code block
function greet(name){
   return `Hello ${name}`;
}
```
````

- List:
   - Item A
   - Item B
1. First
2. Second

Links: [Expo](https://expo.dev)

### Usage

1. Install dependencies (ensure AsyncStorage + nanoid installed):
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npx expo start
   ```
3. Open the app and select the Journal tab.
4. Add entries with the ＋ button, edit inline, delete from detail screen.

### Future Improvements (Ideas)

- Additional charts (entries per day trend, streaks)
- Profile & settings persistence (username, avatar, theme preference)
- Cloud sync (Supabase / SQLite / Realm / WatermelonDB)
- End-to-end encryption for content privacy
- Offline-first conflict resolution strategy
- Entry attachments (images) & image picker
- Improved tag management (rename / merge)

---

## Authentication (Google OAuth – WIP)

Implemented initial Google sign-in flow using `expo-auth-session` (authorization code – no backend token exchange yet). To enable real login:

1. Create a project in Google Cloud Console and enable "Google Identity Services" (OAuth consent screen: External, publish test if needed).
2. Create OAuth client IDs:
   - iOS: Bundle ID (will be set when you configure native build; placeholder ok for Expo Go tests)
   - Android: Package name + SHA-1 (for production; for Expo Go dev you can still test via proxy)
   - Web: Set Authorized redirect URI (add `https://auth.expo.io/@YOUR_USERNAME/JournalApp` and any custom domains later)
3. Copy the client IDs into env variables (e.g. in `app.config.js` or `.env` handled by your chosen loader) matching:
```
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=YOUR_EXPO_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID
```
4. Rebuild (or restart `npx expo start`) so `app.json` `extra.googleClientIds` is populated.
5. The current implementation fabricates a pseudo email from the returned authorization code. In production you must exchange the code for tokens server-side:
   - POST to `https://oauth2.googleapis.com/token` with `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`.
   - Verify ID token (JWT) and extract `sub` (stable user ID) + `email`.
   - Create a session / issue your own JWT if needed, then persist securely.

Planned next steps:
- Add backend exchange endpoint.
- Refresh token handling (offline access) & token revocation support.
- Migrate pseudo user IDs to stable Google `sub`.

---

## Apple Sign-In (WIP)

Implemented basic Sign in with Apple using `expo-apple-authentication`.

Flow details:
- Requests EMAIL + FULL_NAME scopes.
- Apple returns `email` / `fullName` ONLY on first successful authorization per Apple ID & app.
- On first login we persist `{ email, name }` in SecureStore keyed by `apple_profile_v1_<appleUserId>`.
- Subsequent logins restore missing fields from SecureStore.

Setup steps (summary):
1. Enroll in Apple Developer Program.
2. In Apple Developer portal: Identifiers → App ID: enable 'Sign in with Apple'.
3. Ensure the bundle identifier in the native build matches the configured App ID.
4. (If using a backend) Validate identity token (JWT) from Apple for additional security.
5. Implement account deletion / token revocation handling.

Next steps planned:
- Server-side validation of Apple identity token.
- Account deletion endpoint (App Store guideline compliance).
- Provider linking (Google + Apple + Email under single user).

Security note: Current implementation stores minimal profile only locally; no remote sync yet.

---

## User-Scoped Storage

Journal entries are now isolated per authenticated user.

Key scheme:
```
Base (legacy): journalEntries:v1
Per user:       journalEntries:v1:user:<userId>
```

Migration behavior:
- On first load after a user signs in, if `journalEntries:v1:user:<userId>` does not exist but legacy `journalEntries:v1` does, the legacy data is copied to the user-specific key (non-destructive).
- Subsequent writes only touch the user key.
- Signing out keeps user data persisted for next sign-in.

Implications / Next steps:
- To implement a global sign-out & wipe, also remove the per-user key.
- A future remote sync layer can iterate keys with prefix `journalEntries:v1:user:` to upload.
- Consider encryption (e.g., device key) before remote sync for privacy.

---

## Backend Subscriptions (Apple / Google)

The backend now owns subscription state with verification + webhook lifecycle and persists a `willRenew` flag.

Key points:

- `/iap/verify` (test mode patterns: `product:<id>`, `future:<ms>`, `expired:<any>` etc.) stores subscription row with `status` (active/expired) and initial `will_renew` (future expiry => 1 else 0).
- `/iap/status` returns: `{ isPro, status, productId, expiryDate, source, willRenew }`.
- Webhooks mutate `status` & `willRenew`:
   - Apple: auto renew disabled/enabled (`DID_CHANGE_RENEWAL_STATUS` subtypes) toggles `willRenew` without changing status; `EXPIRED` / `CANCEL` / `REFUND` force `willRenew=0` and update status; renew events refresh expiry but keep existing `willRenew`.
   - Google RTDN: renewed/purchased/recovered/restarted => `active + willRenew=1`; canceled/revoked => `canceled + willRenew=0`; expired => `expired + willRenew=0`; grace/hold/paused keep current flags.
- Fallback: legacy rows with `will_renew` null are heuristically treated as `true` if `expires_at` in future (not persisted) to avoid misleading UI for older data.
- Test mode (`IAP_TEST_MODE=1`): external network skipped, Google webhook skips JWT verification and accepts simplified payload; Apple unsigned payload accepted.

Client considerations:

- Prefer `/iap/status` polling (e.g. on app foreground) instead of trusting local purchase results.
- UI to show upcoming lapse if `willRenew=false` and `status=active` (user turned off auto-renew but still within paid period).

### Pricing / Products

- サブスク例: `com.journalapp.pro.monthly`, `com.journalapp.pro.yearly`
- 買い切り (lifetime) 例: `com.journalapp.pro.lifetime`
- 環境変数 `LIFETIME_PRODUCT_IDS` に買い切り製品 ID をカンマ区切り指定

### Freemium Model

- 無料ユーザ: ジャーナル作成/保存/閲覧のみ (分類・タグ・統計等なし)
- ストレージ制限: `FREE_STORAGE_BYTES` (未設定は 1MB)。超過時 402 `STORAGE_LIMIT_EXCEEDED`
- 有料 (サブスク/買い切り) は同等機能 (タグ/統計/高度カレンダー等)
- `GET /entitlements` で tier (`free|pro|lifetime`) と capabilities を取得
- Lifetime は期限なし: `/iap/status` `isLifetime=true, tier=lifetime`
- When `status=expired` treat `willRenew=false` definitively until a new verify or purchase.

Future roadmap:
- Handle upgrade/downgrade / plan changes (multiple product tiers).
- Webhook signature hardening & retry dead-letter queue.
- Server-driven proactive notifications (email / push) for grace / on-hold states.

### Deployment & Ops Notes

Environment variables (required for production backend start):

```
JWT_SECRET= (strong random 32+ chars; build will abort if <32)
APPLE_SHARED_SECRET= (App Store shared secret)
GOOGLE_SA_EMAIL= service-account@project.iam.gserviceaccount.com
# Either provide plaintext key or base64 (preferred for CI)
GOOGLE_SA_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# or
GOOGLE_SA_KEY_B64=BASE64_ENCODED_KEY
```

Optional:

```
APP_VERSION=1.0.0
GIT_COMMIT=<short-hash>

```

### Database Provider Selection

Runtime chooses provider via env:

| Condition | Provider |
|-----------|----------|
| `TEST_FORCE_SQLITE=1` | SQLite (forced; used in unit tests for deterministic sync helpers) |
| `DATABASE_URL` present | Postgres |
| Otherwise | SQLite |

In CI/unit tests we set `TEST_FORCE_SQLITE=1` to avoid mixing the synchronous `runExpirySweep()` (SQLite implementation in `db.ts`) with the Postgres provider, which would cause sweep counts to differ.

### Postgres Migrations

`migrations/0001_init.sql` sets initial schema. `0002_indexes.sql` adds:

- `idx_subscriptions_status_expires` on `(status, expires_at)` to accelerate expiry sweeps.
- `idx_subscriptions_user_updated` on `(user_id, updated_at DESC)` to speed latest subscription lookups.

The migration runner records applied files in `schema_migrations` (id = filename without `.sql`). Safe to run repeatedly; already-applied files are skipped.

### Local Testing Against Postgres

If you want to exercise the Postgres provider locally:

1. Start a Postgres instance (e.g. Docker).  
2. Set `DATABASE_URL=postgres://user:pass@localhost:5432/dbname` (omit `TEST_FORCE_SQLITE`).  
3. Start backend; migrations auto-apply at first query.  
4. Run a manual sweep check:
   - Create a short future sub via `/iap/verify` (test mode `future:100`).
   - Wait >100ms and call internal `runExpirySweep()` (or trigger interval) then confirm status via `/iap/status`.

Note: Unit tests remain on SQLite for speed & deterministic timing.

### Webhook Security

If you deploy Apple/Google webhooks behind an API gateway, you can enforce a shared secret:

```
WEBHOOK_SHARED_SECRET=your-random-shared-secret
```

Clients (Apple/Google push proxies) must send header:

```
X-Webhook-Secret: your-random-shared-secret
```

Requests failing this check return 401 and are counted with `webhook_events_total{result="auth_fail"}`.

### Expanded Metrics

New Prometheus counters / gauges:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `subscription_status_transitions_total` | Counter | from,to,source | Subscription status changes (verify/webhook) |
| `subscription_expiry_sweep_total` | Counter | (none) | Total subscriptions marked expired in sweeps (incremented by number expired) |
| `webhook_events_total` | Counter | provider,result,event | Webhook events processed (`result=ok|auth_fail`) |

Existing journal gauges (`journal_storage_bytes`) continue to track per-user storage size.
SUB_EXPIRY_SWEEP_MS=300000
LOG_LEVEL=info
GOOGLE_PUBSUB_AUDIENCE=<expected-aud-if-using-jwt-verification>
REDIS_URL=redis://host:6379
```

Safety guard: process exits if required vars missing, or if `NODE_ENV=production` while `IAP_TEST_MODE` is set (prevents accidental mock mode in prod).

Additional production guards:
- JWT_SECRET length < 32 => startup abort
- Production + SQLite (`DB_FILE` ends with .sqlite) => abort unless `ALLOW_SQLITE_PROD=1`
- Apple webhooks: in production (and not test mode) a signed payload is REQUIRED; unsigned is rejected with 400
- Google service account key may be supplied via `GOOGLE_SA_KEY_B64` (base64) to avoid raw multiline secrets in env files

Health endpoints:
- `/health` legacy simple
- `/healthz` detailed JSON + headers `X-App-Version`, `X-Commit`

Rate limits (env override): `AUTH_RATE_LIMIT_MAX`, `DEFAULT_RATE_LIMIT_MAX`, `*_WINDOW_MS`.

Test Mode purchase recipes are only for local/dev; never enable `IAP_TEST_MODE` in production.

---

### Recommended Enhancements (Implemented)

The following security / clarity improvements were recently added:

- Added `helmet` middleware for baseline security headers (tweak CSP later when hosting web build).
- JWT access tokens now include a `jti` (unique ID) claim enabling correlation & future revocation lists.
- `/iap/status` response extended with `isCanceled` to distinguish voluntary cancellation from natural expiry.
- Documented existing `DELETE /account` endpoint (full user data purge; idempotent).

Sample `/iap/status` active:
```json
{"success":true,"data":{"isPro":true,"status":"active","productId":"journal_pro_monthly_ios","expiryDate":"2024-12-01T12:34:56.000Z","source":"apple","willRenew":true,"isCanceled":false}}
```

Sample `/iap/status` expired + canceled:
```json
{"success":true,"data":{"isPro":false,"status":"expired","productId":"journal_pro_monthly_ios","expiryDate":"2024-10-01T12:34:56.000Z","source":"apple","willRenew":false,"isCanceled":true}}
```

Decoded JWT payload example (new `jti` claim):
```json
{"uid":"user_123","ver":1,"jti":"550e8400-e29b-41d4-a716-446655440000","iat":1700000000,"exp":1700003600}
```

Planned (not yet implemented): revocation store keyed by `jti`, CSP tighten (report-only), metrics for subscription lifecycle events.

### New Additions (Metrics, CSP, Token Revocation)

- Prometheus metrics at `/metrics` (counters: `http_requests_total`, `subscription_status_lookups_total`, histogram: `http_request_duration_seconds`, plus default process metrics).  
- Basic CSP (helmet) with report-only mode by default (`CSP_REPORT_ONLY=0` to enforce). Violations POST to `/csp-report` and are logged (`csp.violation`).  
- JWT jti revocation list (`revoked_jtis` table). `/auth/logout` records the current access token jti; subsequent use returns `TOKEN_REVOKED`.  
- Metrics & revocation logic are environment agnostic (enabled in all modes). Protect `/metrics` behind network / auth in production.

### Day3 P2 Enhancements (Security & API Discoverability)

Implemented in latest iteration:

| Feature | Description | Env / Notes |
|---------|-------------|-------------|
| CSP Nonce | Each response injects `res.locals.cspNonce` used in `script-src 'self' 'nonce-<value>'` to allow inline boot script w/o unsafe-inline. | Auto-generated per request. Add `<script nonce={nonce}>` in SSR templates (web build future). |
| CSP Report / Enforce | Default behavior: enforce unless `CSP_REPORT_ONLY=1` (then `report-only`). Violations POST JSON to `/csp-report` and are logged. | Set `CSP_REPORT_ONLY=1` during tuning. |
| `/openapi.json` | Minimal static OpenAPI 3.0.3 spec enumerating main auth / journal / subscription endpoints. | Extend `backend/src/openapi.ts` as endpoints evolve. |
| `upcomingExpiry` flag | Added to `/iap/status` response: `true` when a renewable (non-lifetime) active subscription expires < 24h. | Client can pre-emptively surface renewal UI / reminders. |

Example `/iap/status` (active, expiring within 24h):

```json
{"success":true,"data":{"isPro":true,"status":"active","productId":"journal_pro_monthly_ios","expiryDate":"2024-12-01T12:00:00.000Z","source":"apple","willRenew":true,"isCanceled":false,"isLifetime":false,"tier":"pro","upcomingExpiry":true}}
```

Example `/iap/status` (lifetime):

```json
{"success":true,"data":{"isPro":true,"status":"active","productId":"journal_pro_lifetime_ios","expiryDate":null,"source":"apple","willRenew":false,"isCanceled":false,"isLifetime":true,"tier":"lifetime","upcomingExpiry":false}}
```

Client Guidance:
1. Treat `upcomingExpiry=true` as soft-warning (do not immediately block features).
2. If also `willRenew=false` and not lifetime: user has canceled – pair with `isCanceled` for messaging ("Renews until <date>").
3. Lifetime products always report `upcomingExpiry=false`.

Extending the OpenAPI Spec:
- Add schemas for JWT-authenticated endpoints (bearerAuth security scheme) when generating external docs.
- Keep spec lean; automation (e.g. code-first decorators) can replace manual file later.
- Document new response fields (e.g. additional subscription statuses) promptly to avoid client drift.

Operational Notes:
- Monitoring: Add alert if CSP violation rate spikes (possible XSS attempt or legitimate inline script blocked).
- Metric `subscription_expiry_sweep_total` now increments by number of subscriptions newly expired each sweep.
- Webhook metrics (`webhook_events_total`) include `result="auth_fail"` when shared secret mismatch; track ratio.

See `docs/release.md` for end-to-end release procedure.

## Release Checklist (Backend)

Security / Config:
- [ ] `NODE_ENV=production` で起動確認 (dev 専用フラグ未使用 `IAP_TEST_MODE` OFF)
- [ ] 強度十分な `JWT_SECRET` (32+ chars, ランダム)
- [ ] `APPLE_SHARED_SECRET` / Google Service Account (`GOOGLE_SA_EMAIL` + Key) 設定
- [ ] 本番は SQLite 非使用 (`DATABASE_URL` 指定) もしくは `ALLOW_SQLITE_PROD=1` 明示許可
- [ ] CORS: `CORS_ORIGINS` に公開フロントエンドドメイン列挙
- [ ] `/metrics` へのアクセスはネットワーク制限または `METRICS_TOKEN` で保護 (24+ chars)
- [ ] CSP enforce (デフォルト). 一時的に緩める場合のみ `CSP_REPORT_ONLY=1`

Observability:
- [ ] Prometheus スクレイプ設定登録 (job_name=journal-backend)
- [ ] アラート: 高エラーレート, レイテンシ p95, メモリ/FD 異常, 失敗ログ急増
- [ ] 重要メトリクス: `iap_verify_total`, `subscription_status_lookups_total`, `pro_access_attempt_total`, `pro_access_denied_total`

Subscriptions:
- [ ] App Store Connect / Play Console の製品 ID がクライアント & backend ロジックと一致
- [ ] Webhook (Apple Server Notifications / Play RTDN) URL 登録 & シグネチャ検証有効
- [ ] Grace / Hold / Refund シナリオ手動テスト or シミュレーション
- [ ] Expiry sweep (`SUB_EXPIRY_SWEEP_MS`) ログ確認

Data & Migrations:
- [ ] Postgres 運用 (マイグレーション計画). SQLite は開発限定
- [ ] 自動バックアップ (WAL + pg_dump スケジュール) / 復元リハーサル
- [ ] 個人データ削除フロー (`DELETE /account`) 監査ログ記録

Security Hardening:
- [ ] 最小権限サービスアカウント (Google IAP 検証用)
- [ ] シークレットは CI / Vault 管理 (直接 `.env` commit しない)
- [ ] 監査: ログ内に PII（メール等）不要部分マスク

Performance:
- [ ] 負荷試験 (RPS 想定 * 2) で p95 < 300ms 確認
- [ ] レートリミット閾値 (`AUTH_RATE_LIMIT_MAX`, `DEFAULT_RATE_LIMIT_MAX`) 適正化

Rollout:
- [ ] CI (ビルド + テスト) success バッジ
- [ ] Git タグ (v1.0.0 等) + `APP_VERSION` 注入
- [ ] ブルー/グリーン or カナリア手順 (必要なら)

Post-Release:
- [ ] 初週: 日次サブスク獲得/解約レポート
- [ ] エラーログ監視アラートしきい値チューニング
- [ ] 利用増加時の水平スケール戦略 (プロセス数 or コンテナ数 + セッション無状態)

---

## Database Migration (Day2: Postgres Adapter Complete)

Phase status:
- Day1: DBProvider 抽象化 (SQLite ラップ) 完了。
- Day2: Postgres 実装 (ユーザ / リフレッシュトークン / サブスク / ジャーナル / 監査ログ / jti / webhook 重複排除) 実装完了。全ルートは Promise ベースの非同期プロバイダを利用。

Why async now? もともと SQLite 同期 API だったが、Postgres 導入で I/O が非同期化必須。インターフェース全体を Promise 化し、将来別ストア (Redis キャッシュ, 分析用リードレプリカ) 差し替えを容易化。

Switching to Postgres:
1. 用意: `DATABASE_URL=postgres://user:pass@host:5432/dbname` を backend 実行環境へ設定。
2. 起動時: `dbPostgres` が `schema_migrations` を確認し未適用 SQL (`backend/migrations/*.sql`) を適用。
3. 既存 SQLite データ移行 (開発 → 本番初期) は一度だけ: SQLite から `users`, `subscriptions`, `journal_entries`, `refresh_tokens` を CSV / COPY で投入 (マイグレーションスクリプトは今後 `docs/postgres-migration.md` へ追加予定)。
4. フォールバック: `DATABASE_URL` 未設定なら自動で SQLite プロバイダ (開発用途) を利用。

Operational notes:
- Migration safety: SQL ファイルは昇順適用し、成功時 `schema_migrations` に ID を記録。
- Refresh token rotation: 親子チェーン (parent_token_id) でトレーサビリティ。Fingerprint は初回付与後は上書きしない仕様。
- Expiry sweep: `runExpirySweep()` は Postgres 版も実装 (期限切れを一括更新)。
- jti revocation: `revoked_jtis` 挿入 ON CONFLICT DO NOTHING で冪等。
- Webhook idempotency: `webhook_events_processed` に (provider,event_id) ユニーク制約。

Env considerations:
```
# Required when switching to Postgres
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
# Optional tuning
PG_POOL_MAX=10
```

Caution:
- 本番切替前に全テスト (`npm test --workspace backend` など) とサンプルリクエスト (register/login/journal CRUD/iap/status/refresh) を Postgres 上で実行。
- 既存 SQLite を本番で使い続ける場合は `ALLOW_SQLITE_PROD=1` を明示しない限り将来ガードが強化される予定。

Next (Day3+ ideas):
- 並列マイグレーション (複数 .sql) / トランザクション分割 & ロールバック戦略。
- `LISTEN/NOTIFY` を用いたリアルタイム無効化 (refresh token reuse 即時反映)。
- 読み取り最適化: `journal_entries` の部分インデックス (user_id, created_at DESC) 既存で十分だが件数増でカバリングインデックス検討。
- Partition (将来, 大規模ジャーナル想定)。

---

## Subscriptions / In-App Purchases (Prototype → Server-Backed)

The app integrates a prototype subscription layer using `expo-in-app-purchases`:

Current behavior:
- Loads platform-specific product IDs (`journal_pro_monthly_ios` / `journal_pro_monthly_android`, fallback `journal_pro_monthly`).
- Listens for purchase updates and automatically acknowledges unacknowledged transactions, setting `isPro=true`.
- Restore checks purchase history to re-enable `isPro`.
- Basic error + loading + purchasing states surfaced through `UpgradePanel` in Settings.

### Server Integration (Implemented)

Backend (`backend/`):
- `/iap/verify` Apple / Google サーバー検証 (TEST MODE で外部呼び出し抑制)。
- `/iap/status` 現在/直近の購読状態: `status` = active | expired | none, `source`, `willRenew`。
- 自動期限スイープ `runExpirySweep()` (デフォルト 5 分間隔)。
- エラーコードマッピング: `APPLE_ERR_*`, `GOOGLE_ERR_*` をクライアント UI/ロギングで利用可。

TEST MODE (`IAP_TEST_MODE=1`) 受理パターン例:
```
product:pro_monthly
future:60000     # 60 秒後期限
past:1000        # 1 秒過去 (即 expired)
expired:anything # 即 expired (エイリアス)
```

現行 UI はローカル `isPro` とバックエンド `status` を統合する予定 (未実装部分: grace, account-hold, price changes)。

### Remaining Production Tasks
1. Real product identifiers (App Store Connect / Play Console) & price localization
2. Webhook 実稼働化 (Apple Server Notifications / Play RTDN) + signature/JWT 設定

## 実機 Smoke テスト Checklist (ローカル / TestFlight / Internal Track)

短時間で主要フローを検証するための 1 パス手順。

### 事前準備
- バックエンド起動: ポート例 `http://192.168.x.X:3000`
- フロント env: PowerShell 例
  ```powershell
  $env:EXPO_PUBLIC_API_BASE_URL="http://192.168.x.X:3000"; npx expo start
  ```
- `app.json` の `extra.apiBaseUrl` は env 展開 (`${EXPO_PUBLIC_API_BASE_URL}`) で反映
- (任意) 購入テスト簡略化: `IAP_TEST_MODE=1` で backend 起動

### テストシナリオ
1. 起動 → 未ログイン状態で gated 画面 (Tags/Stats/Calendar 拡張) が Upgrade 要求表示になること
2. Register: 新規メール+PW → 成功後 SecureStore に token 保存 (手動: 再起動で自動ログイン確認)
3. `/entitlements` 取得 (ネットワーク DevTools) → `tier=free` `capabilities.canTag=false`
4. Journal エントリを複数追加しストレージ使用量を増やす (Home/Entries で警告バナーが閾値近くで表示されるか確認)
5. Upgrade 画面: 商品リスト表示 (Monthly / Lifetime) ※ ストア接続失敗はエラーテキスト確認
6. 購入テスト: TEST MODE の場合 → ダミー productId を purchase → 購入 listener 発火後 `/iap/verify` 呼び出し (network log)
7. `/entitlements` 再取得 → `tier=pro` または `lifetime` / `capabilities.canTag=true`
8. Gated 画面 (Tags/Stats/Calendar) にアクセス → 利用可能になっていること
9. Sign Out → ローカル journal free データがユーザ別キーとして維持され再ログイン後復元されること
10. 再ログイン → token 再利用; `refresh` 未実装部分 (将来) を考慮し 401 が発生しないこと

### 確認ポイント (期待値)
- AuthContext: ラップレス/ラップ有りレスポンス両対応 (backend `{ success, data }` unwrap 済)
- 402 STORAGE_LIMIT_EXCEEDED 時: UI 上で graceful (現状: 書き込み失敗ログのみ想定) → 追加実装候補
- `isPro` 反映タイミング: purchase listener 内 verify 成功後 ≤ 数秒
- Lifetime 商品は `entitlements.tier=lifetime` で永続 (expiry 無視)

---

## Auth / IAP 最新差分メモ
- `app.json` `extra.apiBaseUrl` を追加: EXPO_PUBLIC_API_BASE_URL 環境変数で実機・同一LANバックエンドへ指向
- IAP product IDs に Lifetime (例: `journal_pro_lifetime_*`) を追加
- `AuthContext.backendAuth` は backend レスポンスが `{ success:true, data:{ token, user } }` 形式でも直接 `{ token, user }` 形式でも動作 (自動 unwrap) 
- 既存バックエンド `/auth/(register|login)` は `/auth/email/*` へのエイリアス (URL 変更不要)
- 失敗時エラーコード: 現状シンプル ('AUTH_FAILED') → 今後詳細ハンドリング拡張候補

---

## EXPO_PUBLIC_API_BASE_URL 設定例
実機 (同一 LAN) からローカル backend へ接続するため `apiBaseUrl` を環境変数で渡します。

### PowerShell (Windows)
```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.0.42:3000"; npx expo start
```

### macOS/Linux (bash/zsh)
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.42:3000 npx expo start
```

`app.json` の `${EXPO_PUBLIC_API_BASE_URL}` が展開され、`Constants.expoConfig.extra.apiBaseUrl` から利用されます。

---

## IAP_TEST_MODE 簡易利用
ローカル検証でストア外テストを行うため backend をテストモード起動できます。

### 起動例 (PowerShell)
```powershell
$env:IAP_TEST_MODE="1"; $env:JWT_SECRET="devsecretdevsecretdevsecretdevsecret"; node backend/dist/index.js
```
(ビルド手順はプロジェクト設定に応じて `npm run dev` など)

### ダミー購入レシピ
`/iap/verify` に渡す `receipt` (または purchase 経由) を以下パターンにすると挙動を再現:
- `product:<id>` 未来 30 分想定
- `future:<ms>` 現在 + ms 後に期限 (例 `future:60000` で 1 分)
- `expired:anything` / `past:<ms>` 期限切れ

### 期待値
- `active` 状態 → `/entitlements` `tier=pro`
- `expired` レシピ適用後 → `tier=free` に戻る

本番では必ず `IAP_TEST_MODE` を未設定 (0) にしてください。

---

## Postgres 移行サマリ
詳細: `backend/docs/postgres-migration.md`

段階概要:
1. DBProvider インターフェイス導入 (既存 SQLite 実装をラップ)
2. Postgres アダプタ実装 (`pg` + prepared statements)
3. `DATABASE_URL` 有無で自動切替 / ローカルは SQLite 継続
4. マイグレーション管理: `backend/migrations/*.sql` + `schema_migrations` テーブル + `npm run migrate`
5. 既存データ移行 (必要時): SQLite dump → 型変換 → PG 取込 (トランザクション)
6. 整合性検証: テーブル件数 / サブスク状態 / サンプル行
7. 切替 & ロールバック: ENV 切替前に SQLite snapshot バックアップ

重点検討:
- トランザクション境界 (refresh token ローテーション, subscription+event 同時)
- インデックス: users(provider,subject), subscriptions(user_id,status,updated_at), journal_entries(user_id,created_at)
- Statement timeout=5s などガード
- メトリクス: プール統計 (将来拡張)

---

### Postgres 移行進捗 (Day1)
- DBProvider 抽象レイヤー導入
- 全ルート / ミドルウェアを provider 経由化 (SQLite 実装: `dbSqlite.ts`)
- 次: Postgres アダプタ + migrations (Day2)
