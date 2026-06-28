# QuantiByte Missing Services Implementation Status

 

**Generated:** 2026-06-18

 

## Phase 1: Backend Services — COMPLETED

 

### ✅ API Gateway (Port 3000)

**Status:** Complete

**Files:**

- `/services/api-gateway/src/app.ts` - Central request routing with JWT validation

- `/services/api-gateway/src/config.ts` - Service endpoints configuration

- `/services/api-gateway/src/middleware/` - Auth, request logging, error handling

- `/services/api-gateway/src/utils/proxy.ts` - Service routing logic

 

**Features:**

- Request routing to all backend services

- JWT token validation before downstream forwarding

- Global (300 req/min) and per-user rate limiting (100 req/min)

- Correlation ID injection for request tracing

- Service health check aggregation

- CORS configuration for frontend apps

 

---

 

### ✅ Sync Service (Port 3006)

**Status:** Complete

**Files:**

- `/services/sync-service/src/app.ts` - Express app

- `/services/sync-service/src/db/migrate.ts` - Database schema (4 tables)

- `/services/sync-service/src/services/queue.service.ts` - Offline queue management

- `/services/sync-service/src/services/reconciliation.service.ts` - Conflict resolution

- `/services/sync-service/src/routes/sync.routes.ts` - REST API endpoints

 

**Database Schema:**

- `sync_queue` - Offline operations queue

- `reconciliation_logs` - Reconciliation history

- `conflict_resolutions` - Conflict tracking

- `sync_idempotency` - Deduplication

 

**Features:**

- Offline queue for POS terminals

- Batch reconciliation on reconnection

- Conflict detection (field-level comparison)

- Resolution strategy: remote-first (latest remote state)

- Inventory reconciliation after order sync

- History tracking & failed item recovery

 

**API Endpoints:**

```

POST   /api/v1/sync/queue          - Add item to sync queue

GET    /api/v1/sync/queue/:deviceId - Get pending items

POST   /api/v1/sync/reconcile/:deviceId - Reconcile pending items

GET    /api/v1/sync/history        - Reconciliation history

GET    /api/v1/sync/failed         - Failed items

POST   /api/v1/sync/retry/:itemId  - Retry failed item

```

 

---

 

### ✅ Churn Prediction Engine (Port 3009)

**Status:** Complete

**Files:**

- `/services/churn-engine/src/app.ts` - Express app

- `/services/churn-engine/src/db/migrate.ts` - Database schema (3 tables)

- `/services/churn-engine/src/services/scoring.service.ts` - Churn scoring algorithm

- `/services/churn-engine/src/jobs/scoring.job.ts` - Daily cron job (2 AM)

- `/services/churn-engine/src/routes/churn.routes.ts` - REST API

 

**Database Schema:**

- `customer_churn_scores` - Current churn scores & risk levels

- `churn_history` - Score change history

- `engagement_triggers` - Campaign trigger events

 

**Scoring Algorithm (0-1 scale):**

- Inactivity (40%): Days since last order / 60

- Frequency Decline (30%): Order trend last 3 vs 6 months

- AOV Decline (30%): Avg order value trend last 3 vs 6 months

 

**Risk Levels:**

- Critical: score >= 0.7

- High: score >= 0.5

- Medium: score >= 0.3

- Low: score < 0.3

 

**Auto-Triggers:**

- churn_detected (score >= 0.5) - Triggers re-engagement campaign

- risk_elevated - Segment change notification

- churned_60d - 60+ days inactive

 

**API Endpoints:**

```

GET    /api/v1/churn/scores       - Get churn scores (optional filter by riskLevel)

POST   /api/v1/churn/score        - Manual trigger daily scoring

```

 

**Cron Job:**

- Runs daily at 2 AM

- Scores all customers across all stores

- Persists scores to database

- Checks for re-engagement triggers

 

---

 

### ⏳ Reservation Service (Port 3010) — IN PROGRESS

**Status:** Scaffolding created, implementation pending

 

**Planned Files:**

- `/services/reservation-service/src/db/migrate.ts` - Schema: reservations, tables, cancellations

- `/services/reservation-service/src/services/reservation.service.ts` - Business logic

- `/services/reservation-service/src/routes/reservation.routes.ts` - REST API

 

**Planned Features:**

- Create reservations (date, time, party size, table assignment)

- Walk-in check-in tracking

- Pre-orders tied to reservations

- Table status management (available, reserved, occupied, cleaning)

- Cancellation with notifications

- Availability calendar queries

 

**Database Schema (to implement):**

```sql

- reservations (id, customer_id, store_id, date, time, party_size, table_id, status)

- tables (id, store_id, table_number, capacity, location)

- walk_in_checkins (id, reservation_id, checked_in_at)

- cancellations (id, reservation_id, reason, cancelled_at)

```

 

---

 

### ⏳ Staff Optimization Service (Port 
) — SCAFFOLDING PENDING

**Status:** Directory created, files pending

 

**Planned Files:**

- `/services/staff-optimization-service/src/db/migrate.ts`

- `/services/staff-optimization-service/src/services/forecast.service.ts`

- `/services/staff-optimization-service/src/routes/forecast.routes.ts`

 

**Planned Features:**

- Historical order pattern analysis (by hour, day, week)

- 7-day demand forecasting (ML model: linear regression or prophet)

- Optimal shift schedule recommendations

- Under-staffing alerts

- Staff utilization metrics

 

**Database Schema (to implement):**

```sql

- forecast_models (id, store_id, model_version, accuracy)

- daily_forecasts (id, store_id, date, hour, predicted_orders, confidence)

- shift_recommendations (id, store_id, date, recommended_staff_count)

- staffing_alerts (id, store_id, date, alert_type, message)

```

 

---

 

## Phase 2: Frontend Applications — PENDING

 

### Frontend Apps to Build

1. **KDS (Kitchen Display System)** - Port 5001

   - Real-time order queue display

   - Order time tracking (color-coded urgency)

   - Station-based filtering (grill, fryer, bar)

   - Mark item complete → auto order status update

 

2. **CRM Dashboard** - Port 5002

   - Customer segments (VIP, At-Risk, Churned, New, Loyal)

   - Loyalty tier analytics

   - Campaign performance metrics

   - Segment targeting for campaign creation

 

3. **Manager Dashboard** - Port 5003

   - Multi-store KPIs (orders, revenue, AOV, customer count)

   - Real-time order metrics

   - Inventory alerts

   - Churn risk alerts (X customers at risk)

   - Campaign ROI leaderboard

 

4. **Mobile App** - React Native / Flutter

   - Loyalty points balance & tier status

   - Reservation bookings

   - Transaction history

   - Campaign offers

 

5. **Self-Service Kiosk** - Port 5004

   - Touchscreen optimized ordering

   - Category → item → modifiers flow

   - Payment UI

   - Receipt printing

 

---

 

## Infrastructure Updates Needed

 

### docker-compose.yml Additions

```yaml

api-gateway:

  ports: ["3000:3000"]

 

sync-service:

  ports: ["3006:3006"]

  environment:

    SYNC_DB_URL: postgres://user:pass@sync-db:5432/pos_sync

 

churn-engine:

  ports: ["3009:3009"]

  environment:

    CHURN_DB_URL: postgres://user:pass@churn-db:5432/pos_churn

 

reservation-service:

  ports: ["3010:3010"]

  environment:

    RESERVATION_DB_URL: postgres://user:pass@reservation-db:5432/pos_reservations

 

staff-optimization-service:

  ports: ["3011:3011"]

  environment:

    STAFF_DB_URL: postgres://user:pass@staff-db:5432/pos_staff_optimization

 

# Database services

sync-db:

  image: postgres:15

  environment:

    POSTGRES_DB: pos_sync

 

churn-db:

  image: postgres:15

  environment:

    POSTGRES_DB: pos_churn

 

reservation-db:

  image: postgres:15

  environment:

    POSTGRES_DB: pos_reservations

 

staff-optimization-db:

  image: postgres:15

  environment:

    POSTGRES_DB: pos_staff_optimization

```

 

### Root package.json Scripts to Add

```json

{

  "scripts": {

    "services:api-gateway": "pnpm --filter @pos/api-gateway dev",

    "services:sync": "pnpm --filter @pos/sync-service dev",

    "services:churn": "pnpm --filter @pos/churn-engine dev",

    "services:reservation": "pnpm --filter @pos/reservation-service dev",

    "services:staff": "pnpm --filter @pos/staff-optimization-service dev",

    "db:migrate": "pnpm run db:migrate -r --filter '@pos/*-service'",

    "dev:all": "concurrently 'pnpm services:*' 'pnpm --filter @pos/pos-terminal dev'"

  }

}

```

 

### turbo.json Updates

```json

{

  "pipeline": {

    "db:migrate": {

      "dependsOn": [],

      "inputs": ["src/db/migrate.ts"]

    },

    "build": {

      "dependsOn": ["^build"]

    }

  }

}

```

 

---

 

## Event Types to Add to shared-types/src/events.ts

 

```typescript

// Sync Events

| 'sync.queue_added'

| 'sync.reconciled'

| 'sync.conflict_detected'

 

// Churn Events

| 'churn.scored'

| 'churn.risk_identified'

| 'churn.engaged'

 

// Reservation Events

| 'reservation.created'

| 'reservation.cancelled'

| 'reservation.checked_in'

| 'table.status_changed'

 

// Forecasting Events

| 'forecast.generated'

| 'shift.recommended'

| 'staffing.alert_triggered'

```

 

---

 

## Next Steps

 

1. **Complete Reservation Service** (2-3 hours)

   - Implement db/migrate.ts with schema

   - Build reservation.service.ts with business logic

   - Create REST routes with Zod validation

   - Add Kafka event producers

 

2. **Complete Staff Optimization Service** (2-3 hours)

   - Implement forecast.service.ts

   - Add basic demand forecasting (moving average or simple regression)

   - Shift recommendation algorithm

   - Batch job for daily forecasts

 

3. **Update Configuration Files** (30 min)

   - Add docker-compose entries for 5 new services + 4 databases

   - Update root package.json with service scripts

   - Update turbo.json with new service pipelines

 

4. **Build Frontend Applications** (3-4 days)

   - KDS (React + WebSocket for real-time updates)

   - CRM Dashboard (React + REST API polling)

   - Manager Dashboard (React + mixed polling/WebSocket)

   - Mobile App (React Native)

   - Self-Service Kiosk (React)

 

5. **Integration Testing** (1 day)

   - End-to-end order flow testing

   - Sync reconciliation testing

   - Churn scoring validation

   - Reservation workflow testing

 

---

 

## Testing Verification Checklist

 

### Backend Services

- [ ] Docker Compose starts all services without errors

- [ ] Health checks return 200 for all services

- [ ] Database migrations apply successfully

- [ ] API endpoints respond with correct schemas

- [ ] Rate limiting enforces limits

- [ ] JWT authentication works across gateway

- [ ] Offline sync reconciliation works correctly

- [ ] Churn scoring produces valid 0-1 scores

- [ ] Cron job fires daily at scheduled time

- [ ] Error handling returns proper status codes

 

### Frontends

- [ ] Dev servers start (vite for React apps)

- [ ] Pages render without console errors

- [ ] API integration works (data displays from backend)

- [ ] Real-time updates work (WebSocket for KDS)

- [ ] Forms validate and submit correctly

- [ ] Responsive on desktop/tablet/mobile

- [ ] TypeScript strict mode passes

 

### End-to-End

- [ ] Order created offline → synced on reconnect

- [ ] Churn score changes → campaign triggered

- [ ] Reservation created → KDS shows in order

- [ ] Staff forecast generated → shift recommendations displayed

 

---

 

## Summary

 

✅ **Completed:** API Gateway + Sync Service + Churn Engine (3/5 services)

⏳ **Remaining:** Reservation Service + Staff Optimization (2/5 services, 4-6 hours)

📱 **Frontend:** All 5 apps pending (3-4 days)

 

**Estimated Total Time to Production-Ready:**

- Backend services: 6-8 hours

- Frontend applications: 3-4 days

- Integration testing: 1 day

- **Total: ~4-5 days**