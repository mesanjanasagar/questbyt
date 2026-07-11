# Questbyt POS System

Monorepo (`pnpm` + `turbo`) restaurant POS platform: 6 frontend apps, 16 backend
microservices behind an API gateway, per-service Postgres, Redis, Kafka.

## Frontend apps (`apps/*`)

| App | Port | Purpose |
|---|---|---|
| `pos-terminal` | 5173 | Cashier/waiter terminal — orders, checkout, payment. Already a PWA (`vite-plugin-pwa`: installable, fullscreen/landscape). This is the device waitstaff use — there is no separate "waiter app". |
| `kds` | 5001 | Kitchen Display System — wall-mounted, shows incoming orders. Web only, no native plan (see decision below). |
| `crm-dashboard` | 5002 | Marketing/CRM back office — campaigns, segments, churn. |
| `manager-dashboard` | 5003 | Branch manager back office — inventory, menu, staff, tables, orders, promo codes. |
| `kiosk` | 5004 | Self-service customer ordering kiosk. |
| `mobile-app` | Expo | Customer-facing mobile app — loyalty points, campaigns, reservations. The only true native (React Native) app in the repo. |

## Backend services (`services/*`) — canonical ports

Source of truth: `.env.example`. Each service's `config.ts` should fall back to
these same values if its specific `*_SERVICE_PORT` env var isn't set — keep
these in sync if you touch a service's port.

| Service | Port | Purpose |
|---|---|---|
| `api-gateway` | 3000 | Single entry point, routes/proxies to all services below, handles auth |
| `order-service` | 3001 | Order lifecycle |
| `inventory-service` | 3002 | Stock tracking, ingredient reservation/consumption |
| `payment-service` | 3003 | Payments, shifts |
| `auth-service` | 3004 | Authentication/authorization |
| `menu-service` | 3005 | Menu items, categories, pricing |
| `sync-service` | 3006 | Cross-device/offline data sync |
| `notification-service` | 3007 | Push/email/SMS |
| `reporting-service` | 3008 | Analytics/reports |
| `ai-manager-service` | 3009 | AI-driven management features |
| `reservation-service` | 3010 | Table reservations |
| `store-service` | 3011 | Store/branch, staff, tables |
| `customer-service` | 3012 | Customer profiles (CRM backend) |
| `churn-engine` | 3013 | Churn prediction |
| `marketing-service` | 3014 | Campaigns |
| `staff-optimization-service` | 3015 | Staff scheduling optimization |

Infra (`docker-compose.yml`): one Postgres per service, Redis, Kafka +
Zookeeper + Kafka UI, pgAdmin.

## Common commands

- `pnpm dev` — run everything via turbo
- `pnpm apps:pos` / `apps:kds` / `apps:manager` / `apps:kiosk` / `apps:crm` / `apps:mobile` — run a single frontend
- `pnpm services:<name> dev` (or `pnpm --filter @pos/<service> dev`) — run a single service
- `pnpm docker:up` / `docker:down` — infra containers
- `pnpm db:migrate` / `pnpm db:seed`
- `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm type-check` — turbo across all packages

## Architecture decisions

- **No native app planned for waiter or KDS.** Waitstaff use `pos-terminal`
  (already a PWA). KDS stays a plain web app on a mounted display. Target
  staff devices are Android-only, so the one real argument for native
  (iOS lacks the Background Sync API) doesn't apply — Android Chrome supports
  Background Sync, so offline order queuing can be done via a PWA. Native
  (extending the `mobile-app` Expo stack) stays reserved for the
  customer-facing app where iOS support matters.
- **Known gap:** `pos-terminal`'s PWA only caches menu reads (`NetworkFirst`
  Workbox rule). Order submission (`POST` to `order-service`) has no offline
  queuing yet — if the network drops mid-submission it just fails. Closing
  this needs a Workbox Background Sync registration for the order route, a
  "queued, will sync" UI state, and idempotency on `order-service` for
  retried submissions.
