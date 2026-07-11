# Project Static Data Audit

Summary
-------
- Small monorepo POS system with multiple React apps and Node microservices.
- Components present: API gateway, auth, order, menu, notification, store, many microservices, and frontends (`pos-terminal`, `kds`, `manager-dashboard`, `kiosk`, `mobile-app`, `crm-dashboard`).

What's implemented (quick)
--------------------------
- Microservices: order-service, menu-service, auth-service, store-service, notification-service, inventory-service, payment-service, reporting-service, reservation-service, etc.
- API gateway that proxies to internal services and also proxies SSE `/api/v1/orders/events`.
- Frontends: multiple React apps (POS, KDS, Manager Dashboard, Kiosk, CRM, mobile) with local dev proxies.
- Real-time paths: SSE from `order-service` (sse-broadcaster) proxied via api-gateway; WebSocket/notification service wiring exists in architecture documents.
- DB migration & seed scripts exist for services (see `db:seed` scripts).

Static / hardcoded data found (should be made dynamic / configurable)
----------------------------------------------------------------
1. API base URLs & dev defaults
   - `.env` has many local service URLs: [/.env](.env) (e.g. `ORDER_SERVICE_URL=http://localhost:3001`, `NOTIFICATION_SERVICE_URL=http://localhost:3007`, `VITE_API_BASE_URL=http://localhost:3000/api/v1`).
   - Frontend API bases hardcoded as fallbacks: [apps/kds/src/api/client.ts](apps/kds/src/api/client.ts), [apps/kds/src/pages/LoginPage.tsx](apps/kds/src/pages/LoginPage.tsx), [apps/manager-dashboard/src/api/client.ts](apps/manager-dashboard/src/api/client.ts).

2. Mock / demo data embedded in frontends
   - `apps/kiosk/src/api/kiosk.ts` contains `MOCK_CATEGORIES` and `MOCK_ITEMS` used in dev.
   - `apps/manager-dashboard/src/api/dashboard.ts` contains `MOCK_STORES`, `MOCK_REVENUE`, `MOCK_STAFF`, etc.
   - `apps/crm-dashboard/src/api/customers.ts` contains `MOCK_CUSTOMERS`.
   These should be replaced with real REST calls when wiring to backend or behind a feature flag for offline demo mode.

3. Seeds & sample credentials
   - Service DB seed scripts create default users (e.g. admin in `services/auth-service/src/db/seed.ts` with `admin@pos.local`).
   - `DEVELOPMENT.md` documents sample credentials and dev endpoints. Keep as dev-only; do not leak to production.

4. Secrets & internal tokens
   - `.env` contains JWT_SECRET, REFRESH_TOKEN_SECRET, INTERNAL_SERVICE_SECRET and test Stripe keys: these must become secrets in a vault/secret manager in prod. See [/.env](.env).
   - Many services use `INTERNAL_SERVICE_SECRET` with a default `'internal-secret-change-in-prod'` in code (`services/*/src/config.ts`). Replace with required env and fail fast if missing.

5. Internal IDs and constants
   - `KIOSK_SYSTEM_ID` constant in `services/order-service/src/routes/order.routes.ts` is a special-device UUID used for public kiosks. Make this configurable by environment or device registration.

6. CORS / allowed origins
   - Multiple services set `ALLOWED_ORIGINS` with dev defaults `http://localhost:5173` or `http://localhost:3000` (see `services/api-gateway/src/config.ts` and many `app.ts` files). Use environment-configured allowed origin lists per environment.

7. Dev tooling URLs and proxies
   - Several `vite.config.ts` and proxy settings point to `http://localhost:3000` as a dev API target (see `apps/manager-dashboard/vite.config.ts`, `apps/pos-terminal/vite.config.ts`, `apps/kds/vite.config.js`, etc.). Make proxies conditional on NODE_ENV or `VITE_API_URL`.

8. Mock adapters and log-only providers
   - Notification & AI manager mock adapters log messages in dev (see `services/ai-manager-service` and `services/notification-service/src/channels/adapter.ts`). Provide a configuration flag to swap real vs mock adapters.

Priority recommendations
------------------------
1. Replace embedded mock front-end data with API clients behind a `DEV_MOCK` feature flag. Files to change: `apps/kiosk/src/api/kiosk.ts`, `apps/manager-dashboard/src/api/dashboard.ts`, `apps/crm-dashboard/src/api/*.ts`.
2. Centralize API base configuration for frontends: use `VITE_API_URL` (or `VITE_API_BASE_URL`) and remove hardcoded fallbacks (patch `apps/kds/src/api/client.ts`, `apps/kds/src/pages/LoginPage.tsx`, `apps/crm-dashboard/src/api/client.ts`).
3. Move all secrets to environment/secret manager and ensure `config.ts` rejects missing secrets in production (update `services/*/src/config.ts`).
4. Make service URLs configurable via the environment in production; ensure `.env` used only for local dev and not committed with production secrets.
5. Convert `KIOSK_SYSTEM_ID` and other device identifiers into device registration records stored in the DB and referenced at runtime.

Suggested next steps (small incremental)
--------------------------------------
- Create `PROJECT_STATIC_AUDIT.md` (this document) in repo (done).
- Replace front-end mock endpoints with real API calls behind `DEV_MOCK` toggles.
- Add a CI check that `.env` with production-like secrets is not committed and that required env vars are present in deployment manifests.
- Plan secrets migration to a vault (HashiCorp Vault, AWS Secrets Manager, or Cloud provider equivalent).

If you want, I can:
- Create PRs to centralize `API_BASE` in frontends and remove hardcoded `http://localhost` fallbacks.
- Replace a single mock file (e.g., `apps/kiosk/src/api/kiosk.ts`) with a real client implementation as a worked example.

-- Audit generated on: 2026-07-10
