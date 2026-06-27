# POS System — Developer Setup Guide

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Docker Desktop (running)

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` — at minimum fill in:
- `JWT_SECRET` (64+ random chars)
- `REFRESH_TOKEN_SECRET` (64+ random chars)
- `ENCRYPTION_KEY` (32 hex chars)

All other values work as-is for local development.

---

## 3. Start infrastructure (Postgres, Redis, Kafka)

```bash
pnpm docker:up
```

Wait ~30 seconds for all containers to be healthy.

| Service   | URL                        | Notes                          |
|-----------|----------------------------|--------------------------------|
| pgAdmin   | http://localhost:5050      | admin@pos.local / admin        |
| Kafka UI  | http://localhost:8080      | Browse topics + messages       |
| Redis     | localhost:6379             | Use redis-cli or RedisInsight  |

---

## 4. Run database migrations

```bash
# Run all migrations
pnpm db:migrate

# Or per service:
cd services/auth-service && pnpm db:migrate
cd services/menu-service && pnpm db:migrate
cd services/order-service && pnpm db:migrate
```

---

## 5. Seed development data

```bash
cd services/auth-service && pnpm db:seed
```

Creates two users:
| Username | Password    | Role    |
|----------|-------------|---------|
| admin    | Admin@123   | admin   |
| cashier1 | Cashier@123 | cashier |

---

## 6. Start all services (dev mode)

```bash
pnpm dev
```

Turborepo starts everything in parallel:

| App / Service     | URL                    |
|-------------------|------------------------|
| **POS Terminal**  | http://localhost:5173  |
| **Auth Service**  | http://localhost:3004  |
| **Menu Service**  | http://localhost:3005  |
| **Order Service** | http://localhost:3001  |

---

## 7. API Quick Reference

### Auth
```bash
# Login
POST http://localhost:3004/auth/login
{ "username": "cashier1", "password": "Cashier@123", "deviceName": "dev-terminal", "deviceType": "pos_terminal" }

# Refresh
POST http://localhost:3004/auth/refresh
{ "refreshToken": "...", "deviceId": "..." }

# Me
GET http://localhost:3004/auth/me
Authorization: Bearer <token>
```

### Menu
```bash
# Full menu (cached, used by POS on startup)
GET http://localhost:3005/api/v1/menus/full?storeId=<uuid>

# List menus
GET http://localhost:3005/api/v1/menus?storeId=<uuid>

# Create menu
POST http://localhost:3005/api/v1/menus
{ "storeId": "...", "name": "Main Menu", "isDefault": true }

# Create category
POST http://localhost:3005/api/v1/menus/<menuId>/categories
{ "storeId": "...", "name": "Burgers", "nameAr": "برغر" }

# Create item
POST http://localhost:3005/api/v1/items
{ "categoryId": "...", "storeId": "...", "name": "Classic Burger", "basePrice": 45.00 }
```

### Orders
```bash
# Create order
POST http://localhost:3001/api/v1/orders
{
  "storeId": "...", "deviceId": "...", "cashierId": "...",
  "orderType": "dine-in", "tableNumber": 3,
  "items": [{ "menuItemId": "...", "quantity": 2, "unitPrice": 45.00 }]
}

# Update status
PATCH http://localhost:3001/api/v1/orders/<id>/status
{ "status": "cooking" }

# List orders
GET http://localhost:3001/api/v1/orders?storeId=<uuid>&status=pending
```

---

## Architecture Overview

c:/Next/
├── apps/
│ ├── marketplace/ ← Next.js (SEO — public menu, Phase 2)
│ └── pos-terminal/ ← React + Vite PWA (offline-first POS)
├── services/
│ ├── auth-service/ ← Port 3004 — JWT, RBAC, device registration
│ ├── menu-service/ ← Port 3005 — menus, categories, items, modifiers
│ └── order-service/ ← Port 3001 — order lifecycle + Kafka events
├── packages/
│ ├── shared-types/ ← TypeScript interfaces + enums (all services)
│ └── shared-utils/ ← Response helpers, pagination, validation, crypto
├── docker-compose.yml ← Postgres (x5), Redis, Kafka, pgAdmin, Kafka UI
├── turbo.json ← Monorepo task orchestration
└── pnpm-workspace.yaml ← Workspace definition

---

## Phase 2 Services (next up)

| Service               | Port | Description                       |
|-----------------------|------|-----------------------------------|
| `inventory-service`   | 3002 | Stock tracking, reservations      |
| `payment-service`     | 3003 | Stripe, refunds, receipts         |
| `notification-svc`    | 3007 | WebSocket (KDS, CDS, alerts)      |
| `reporting-service`   | 3008 | Dashboards, ClickHouse analytics  |
| `marketplace`         | 3000 | Next.js public storefront         |