# Release Procedure

## 1. Pre-Flight Checklist

- [ ] All tests green (unit + integration)
- [ ] README & docs updated (features, endpoints, env vars)
- [ ] Security review (JWT secret length >=32, no IAP_TEST_MODE in prod, CSP mode confirmed)
- [ ] CSP: enforce by default (`CSP_REPORT_ONLY=0`), during tuning use report-only
- [ ] Webhook endpoints configured (Apple / Google) + signature/JWT verification enabled
- [ ] Metrics endpoint access controlled (network allow-list or auth proxy)
- [ ] Backup & rollback plan documented

## 2. Environment Variables

Required:

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=<32+ char random>
APPLE_SHARED_SECRET=<app store shared secret>
GOOGLE_SA_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SA_KEY_B64=<base64 service account key>  # or GOOGLE_SA_KEY multiline
REDIS_URL=redis://host:6379
```

Optional / Operational:

```bash
APP_VERSION=1.0.0
GIT_COMMIT=<short-sha>
LOG_LEVEL=info
SUB_EXPIRY_SWEEP_MS=300000
ALLOW_SQLITE_PROD=1              # ONLY for single-node trial
METRICS_TOKEN=<long-random>      # protect /metrics
CSP_REPORT_ONLY=0                # 0=enforce, set 1 during tuning
```

## 3. Build & Deploy (Backend)

1. Install deps: `npm ci`
2. (If TS build step required for runtime) `npm run build`
3. Containerize (example Dockerfile sketch):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node","dist/index.js"]
```

1. Push image to registry.
2. Deploy (e.g. container service / ECS / GKE / Fly.io). Ensure secrets injected as env vars.
3. Configure health probes:
   - Liveness: `/health`
   - Readiness: `/healthz` (treat `status=ok` as ready; `degraded` still serve but monitor)

### GitHub Container Registry (GHCR) publishing

This repo includes a workflow to build and publish the backend image to GHCR.

- Workflow: `.github/workflows/backend-cd.yml`
- Image name: `ghcr.io/<owner>/<repo>-backend`
- Triggers:
   - Push to `main` → tags `main` and commit `sha`
   - Push a semver tag (e.g. `v1.2.3`) → tags `v1.2.3`, `1.2`, `1`, `latest`

Requirements:

- No extra secrets required: `GITHUB_TOKEN` has `packages:write` in the repo by default
- Consumers must authenticate to GHCR or the package must be public

Manual pull example:

```bash
docker pull ghcr.io/<owner>/<repo>-backend:latest
```

Composeで公開イメージへ切替（override）:

```bash
# ローカル/サーバでの起動例（Windows PowerShellは改行を ` ` で繋ぐ）
docker compose -f docker-compose.prod.yml -f docker-compose.image.yml up -d

# 任意のタグ/イメージ名を渡す
$Env:BACKEND_IMAGE="ghcr.io/<owner>/<repo>-backend:v1.2.3"; docker compose -f docker-compose.prod.yml -f docker-compose.image.yml up -d
```

## 4. Database & Persistence

- SQLite not recommended for production concurrency; for scale migrate to Postgres.
- If migrating: create equivalent schema; port data (users, subscriptions, logs) or start fresh.
- Ensure periodic backups (subscription & audit logs).


## 5. Webhooks

Apple:

- Provide production URL to App Store Server Notifications (V2)
- Verify signed payload enforced (already code guarded in production)

Google:

- Configure Pub/Sub RTDN push target → `/webhooks/google`
- Service account key in env for receipt verification


## 6. Metrics & Observability

- High 5xx rate
- Subscription expiry sweeps failing
- Spike in `iap_verify_total{result="fail"}`
- CSP violations: monitor POST `/csp-report` logs, tighten policy if high

OpenAPI:

- Minimal spec is served at `/openapi.json`. Keep it updated or extend with schemas/security.

## 7. Security Hardening

- Rotate JWT secret if leaked (consider forcing re-login)
- Enforce HTTPS termination
- Keep rate limits configured
- Protect `/metrics` & `/csp-report` endpoints (network ACL or auth)

## 8. Client Release (Mobile)

- Update product IDs (real store identifiers) in `app.json`
- Build & submit with EAS

```bash
eas build -p ios --profile production
eas build -p android --profile production
```


```bash
eas submit -p ios --profile production
eas submit -p android --profile production
```


## 9. Rollback Strategy

- High error rate (>5% for sustained 5m)
- Auth failures spiking
- Webhook processing backlog

## 10. Post-Release Monitoring

- Track adoption and conversions; review CSP logs; prune old revoked_jtis

## 11. Future Improvements (Roadmap)

- Migration tooling; tracing; richer OpenAPI; additional metrics

Minimal quick smoke test after deploy:

```bash
GET /healthz         -> status 200 + status=ok
POST /auth/email/register {email,pw}
GET /auth/me (Bearer) -> 200
POST /auth/logout (Bearer)
GET /auth/me (Bearer) -> 401 TOKEN_REVOKED
GET /metrics          -> contains http_requests_total
GET /openapi.json     -> valid JSON with openapi: 3.0.x
```
