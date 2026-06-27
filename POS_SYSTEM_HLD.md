Gmail	Sanjana Sagar <123sanjanasagar@gmail.com>
(no subject)
Sanjana Sagar (Technology) <SanjanaSA@emiratesnbd.com>	24 June 2026 at 16:33
To: "123sanjanasagar@gmail.com" <123sanjanasagar@gmail.com>
# POS System with Inventory Management - High Level Design (HLD)

 

**Document Version:** 1.0 

**Date:** 2026-06-16 

**Status:** Design Phase

 

---

 

## 1. Executive Summary

 

This document outlines the High-Level Design for a modern, scalable POS (Point of Sale) system with integrated inventory management supporting multiple devices (POS terminals, Kitchen Display Systems, mobile apps, dashboards). The architecture follows event-driven microservices patterns with offline-first capability for resilience.

 

---

 

## 2. System Overview

 

### 2.1 Scope & Goals

 

**In Scope:**

- Multi-device POS operations (terminal, KDS, mobile, dashboard)

- Inventory management and real-time stock tracking

- Order management lifecycle

- Payment processing

- Reporting & analytics

- Offline-first functionality

- Multi-tenant support (optional)

 

**Out of Scope:**

- 3rd party integrations (initial phase)

- Advanced ML/AI features

- Legacy system migration

 

### 2.2 Key Requirements

 

| Requirement | Priority | Description |

|---|---|---|

| Availability | Critical | 99.9% uptime SLA |

| Offline Support | Critical | Works without internet for 4+ hours |

| Real-time Sync | High | <500ms event propagation |

| Scalability | High | 1000+ concurrent users per deployment |

| Security | Critical | PCI-DSS compliance, encrypted payments |

| Consistency | High | Strong consistency for inventory |

| Performance | High | <200ms API response time |

 

---

 

## 3. System Architecture

 

### 3.1 High-Level Component Diagram

 

```

┌──────────────────────────────────────────────────────────────────┐

│                        CLIENT LAYER                              │

├────────────────────────────────────────────────────────────────┤

│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │

│  │ POS Terminal │  │ Kitchen Disp.│  │  Mobile App  │          │

│  │  (React PWA) │  │  (React PWA) │  │(React Native)│          │

│  └──────────────┘  └──────────────┘  └──────────────┘          │

│  ┌──────────────────────────────────┐  ┌──────────────┐         │

│  │  Manager Dashboard (React SPA)   │  │ Self-Service │         │

│  └──────────────────────────────────┘  │    Kiosk     │         │

│                                         └──────────────┘         │

└────────────┬────────────────────────────────────────────────────┘

             │ (REST/GraphQL/WebSocket)

┌────────────▼────────────────────────────────────────────────────┐

│                   API GATEWAY LAYER                             │

├──────────────────────────────────────────────────────────────┤

│  ┌────────────────────────────────────────────────────────┐  │

│  │ Kong API Gateway / AWS API Gateway                    │  │

│  │ ├─ Authentication (JWT validation)                    │  │

│  │ ├─ Rate Limiting                                      │  │

│  │ ├─ Request Logging                                    │  │

│  │ ├─ CORS / Security Headers                            │  │

│  │ └─ Request Routing to Backend Services               │  │

│  └────────────────────────────────────────────────────────┘  │

└────────┬──────────────┬──────────────┬──────────────┬──────────┘

         │              │              │              │

    ┌────▼────┐    ┌────▼────┐   ┌───▼────┐    ┌────▼────┐

    │  Order  │    │Inventory│   │Payment │    │ Device  │

    │ Service │    │ Service │   │ Service│    │ Service │

    └────┬────┘    └────┬────┘   └───┬────┘    └────┬────┘

         │              │            │              │

    ┌────▼────┐    ┌────▼────┐   ┌───▼────┐    ┌────▼────┐

    │  Menu   │    │ Vendor  │   │ Auth   │    │Reporting│

    │ Service │    │ Service │   │ Service│    │ Service │

    └────┬────┘    └────┬────┘   └───┬────┘    └────┬────┘

         │              │            │              │

         └──────────────┼────────────┼──────────────┘

                        │

            ┌───────────▼──────────────┐

            │  Event Bus / Message Q   │

            │  (Kafka / RabbitMQ)      │

            │  ├─ order.created        │

            │  ├─ stock.updated        │

            │  ├─ payment.processed    │

            │  └─ device.synced        │

            └───────────┬──────────────┘

                        │

         ┌──────────────┼──────────────┐

         │              │              │

    ┌────▼────┐    ┌────▼────┐   ┌───▼────┐

    │  Cache  │    │  Primary │   │ Search │

    │ (Redis) │    │   DB     │   │ (ES)   │

    │         │    │(Postgres)│   │        │

    └─────────┘    └──────────┘   └────────┘

```

 

### 3.2 Service Architecture

 

#### **Core Microservices**

 

| Service | Port | Responsibility | Tech Stack |

|---|---|---|---|

| **Order Service** | 3001 | Create/manage orders, order lifecycle | Node.js, TypeScript, PostgreSQL |

| **Inventory Service** | 3002 | Stock tracking, reservations, alerts | Node.js, TypeScript, PostgreSQL |

| **Payment Service** | 3003 | Process payments, refunds, receipts | Node.js, TypeScript, PostgreSQL |

| **Auth Service** | 3004 | JWT, RBAC, device registration | Node.js, TypeScript, Redis |

| **Menu Service** | 3005 | Products, categories, modifiers, pricing | Node.js, TypeScript, PostgreSQL |

| **Device Service** | 3006 | Device registration, sync state | Node.js, TypeScript, PostgreSQL |

| **Notification Service** | 3007 | WebSocket events, KDS updates, alerts | Node.js, Socket.io |

| **Reporting Service** | 3008 | Analytics, dashboards, sales reports | Node.js, TypeScript, ClickHouse |

| **Sync Service** | 3009 | Offline data reconciliation, CRDT merge | Node.js, TypeScript |

 

---

 

## 4. Data Layer Design

 

### 4.1 Database Schema Overview

 

#### **Order Service Database**

 

```sql

CREATE TABLE orders (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    device_id UUID NOT NULL,

    cashier_id UUID NOT NULL,

    customer_id UUID,

    status ENUM ('pending', 'cooking', 'ready', 'completed', 'cancelled') DEFAULT 'pending',

    total_amount DECIMAL(10,2),

    tax_amount DECIMAL(10,2),

    discount_amount DECIMAL(10,2),

    payment_status ENUM ('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',

    payment_method VARCHAR(50),

    order_type ENUM ('dine-in', 'takeout', 'delivery') DEFAULT 'dine-in',

    table_number INT,

    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    completed_at TIMESTAMP,

    created_offline BOOLEAN DEFAULT FALSE,

    synced_at TIMESTAMP

);

 

CREATE TABLE order_items (

    id UUID PRIMARY KEY,

    order_id UUID NOT NULL REFERENCES orders(id),

    menu_item_id UUID NOT NULL,

    quantity INT NOT NULL,

    unit_price DECIMAL(10,2),

    total_price DECIMAL(10,2),

    modifications JSONB,

    notes TEXT,

    status ENUM ('pending', 'cooking', 'ready', 'served') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE

);

 

CREATE TABLE order_discounts (

    id UUID PRIMARY KEY,

    order_id UUID NOT NULL REFERENCES orders(id),

    discount_type ENUM ('percentage', 'fixed') NOT NULL,

    discount_value DECIMAL(10,2),

    reason VARCHAR(255),

    applied_by UUID,

    applied_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE order_audit (

    id UUID PRIMARY KEY,

    order_id UUID NOT NULL,

    action VARCHAR(50),

    changes JSONB,

    actor_id UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE INDEX idx_orders_store_status ON orders(store_id, status);

CREATE INDEX idx_orders_device ON orders(device_id);

CREATE INDEX idx_order_items_status ON order_items(status);

CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

```

 

#### **Inventory Service Database**

 

```sql

CREATE TABLE products (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    sku VARCHAR(50) UNIQUE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    category_id UUID,

    unit_type ENUM ('piece', 'kg', 'liter', 'box') DEFAULT 'piece',

    status ENUM ('active', 'inactive', 'archived') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE inventory (

    id UUID PRIMARY KEY,

    product_id UUID NOT NULL UNIQUE REFERENCES products(id),

    store_id UUID NOT NULL,

    current_stock INT NOT NULL DEFAULT 0,

    reserved_stock INT DEFAULT 0,

    available_stock INT GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,

    reorder_level INT,

    reorder_quantity INT,

    last_counted_at TIMESTAMP,

    updated_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE stock_movements (

    id UUID PRIMARY KEY,

    product_id UUID NOT NULL,

    store_id UUID NOT NULL,

    movement_type ENUM ('purchase', 'sale', 'adjustment', 'waste', 'return') NOT NULL,

    quantity INT NOT NULL,

    reference_id UUID,

    reference_type VARCHAR(50),

    notes TEXT,

    created_by UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE inventory_recipes (

    id UUID PRIMARY KEY,

    product_id UUID NOT NULL REFERENCES products(id),

    ingredient_id UUID NOT NULL REFERENCES products(id),

    quantity DECIMAL(10,3) NOT NULL,

    unit_type VARCHAR(50)

);

 

CREATE TABLE low_stock_alerts (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    product_id UUID NOT NULL REFERENCES products(id),

    alert_level INT,

    status ENUM ('pending', 'acknowledged', 'resolved') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT NOW(),

    acknowledged_at TIMESTAMP

);

 

CREATE INDEX idx_inventory_store_stock ON inventory(store_id, available_stock);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

CREATE INDEX idx_alerts_store_status ON low_stock_alerts(store_id, status);

```

 

#### **Payment Service Database**

 

```sql

CREATE TABLE payments (

    id UUID PRIMARY KEY,

    order_id UUID NOT NULL,

    store_id UUID NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    payment_method VARCHAR(50) NOT NULL,

    payment_gateway VARCHAR(50),

    transaction_id VARCHAR(255),

    status ENUM ('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',

    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW(),

    processed_at TIMESTAMP

);

 

CREATE TABLE refunds (

    id UUID PRIMARY KEY,

    payment_id UUID NOT NULL REFERENCES payments(id),

    amount DECIMAL(10,2),

    reason VARCHAR(255),

    status ENUM ('pending', 'success', 'failed') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE INDEX idx_payments_order ON payments(order_id);

CREATE INDEX idx_payments_status ON payments(status);

```

 

#### **Auth Service Database (Redis + PostgreSQL)**

 

```sql

-- PostgreSQL

CREATE TABLE users (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    username VARCHAR(255) UNIQUE NOT NULL,

    email VARCHAR(255),

    password_hash VARCHAR(255) NOT NULL,

    role ENUM ('admin', 'manager', 'cashier', 'kitchen', 'waiter') NOT NULL,

    status ENUM ('active', 'inactive', 'suspended') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW(),

    last_login TIMESTAMP

);

 

CREATE TABLE device_registrations (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    device_name VARCHAR(255),

    device_type ENUM ('pos_terminal', 'kds', 'mobile', 'kiosk', 'dashboard') NOT NULL,

    user_id UUID REFERENCES users(id),

    device_token VARCHAR(512) UNIQUE,

    fcm_token VARCHAR(512),

    status ENUM ('active', 'inactive', 'revoked') DEFAULT 'active',

    last_heartbeat TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()

);

 

-- Redis

device_session:{device_id} = {

  "device_id": "uuid",

  "user_id": "uuid",

  "jwt": "token",

  "permissions": ["order:create", "inventory:read"],

  "expires_at": 1234567890

}

 

refresh_token:{token_hash} = {

  "device_id": "uuid",

  "issued_at": 1234567890,

  "expires_at": 1234567890

}

```

 

### 4.2 Cache Strategy (Redis)

 

```

CACHE_KEY_PATTERNS:

 

menu:{store_id} = JSON (TTL: 1 hour)

  → Product categories, items, pricing

 

stock:{store_id}:{product_id} = INT (TTL: 30 min)

  → Available stock count (updated via pub/sub)

 

device_session:{device_id} = JSON (TTL: 24 hours)

  → User session, permissions, sync state

 

store_config:{store_id} = JSON (TTL: 2 hours)

  → Tax rates, operating hours, payment methods

 

rate_limit:{api_key}:{endpoint} = INT (TTL: 1 min)

  → Request count for rate limiting

 

order_lock:{order_id} = STRING (TTL: 5 sec)

  → Distributed lock for concurrent updates

```

 

### 4.3 Analytics Database (ClickHouse)

 

```sql

CREATE TABLE sales_analytics (

    store_id UUID,

    order_id UUID,

    order_date Date,

    order_time DateTime,

    product_id UUID,

    product_name String,

    quantity Int32,

    unit_price Float64,

    total_price Float64,

    discount Float64,

    payment_method String,

    order_type String

) ENGINE = MergeTree()

ORDER BY (store_id, order_date, order_time);

 

CREATE TABLE inventory_analytics (

    store_id UUID,

    product_id UUID,

    movement_date Date,

    movement_type String,

    quantity Int32,

    reference_type String

) ENGINE = MergeTree()

ORDER BY (store_id, movement_date);

```

 

---

 

## 5. API Layer Design

 

### 5.1 Order Service APIs

 

```

POST /api/v1/orders

├─ Body: { items, customer_id, order_type, table_number, notes }

├─ Response: { order_id, status, created_at }

└─ Event: order.created → EventBus

 

GET /api/v1/orders/{order_id}

├─ Response: Full order with items and timeline

└─ Cache: 30 seconds

 

PATCH /api/v1/orders/{order_id}/status

├─ Body: { status, reason }

├─ Response: { order_id, status, updated_at }

└─ Event: order.status_updated → EventBus

 

POST /api/v1/orders/{order_id}/items

├─ Body: { item_id, quantity, modifications }

├─ Response: { item_id, added_at }

└─ Event: order.item_added → EventBus

 

DELETE /api/v1/orders/{order_id}/items/{item_id}

├─ Body: { reason }

└─ Event: order.item_removed → EventBus

 

POST /api/v1/orders/{order_id}/cancel

├─ Body: { reason }

├─ Response: { order_id, status, refund_details }

└─ Events: order.cancelled, inventory.reserved_released, payment.refund_initiated

 

GET /api/v1/orders?store_id={id}&status={status}&from={date}&to={date}

├─ Query Params: page, limit, sort

└─ Response: Paginated orders list

```

 

### 5.2 Inventory Service APIs

 

```

GET /api/v1/inventory/products

├─ Query: { store_id, category_id, status, page, limit }

├─ Response: Product list with stock levels

└─ Cache: 1 hour

 

GET /api/v1/inventory/products/{product_id}

├─ Response: Full product details + stock info

└─ Cache: 30 minutes

 

PATCH /api/v1/inventory/{product_id}/stock

├─ Body: { adjustment_quantity, reason, reference_id }

├─ Response: { product_id, new_stock, previous_stock }

└─ Event: inventory.adjusted → EventBus

 

POST /api/v1/inventory/reserve

├─ Body: { product_id, quantity, order_id }

├─ Response: { reservation_id, reserved_quantity }

└─ Transaction: Atomic stock deduction

 

POST /api/v1/inventory/release

├─ Body: { reservation_id }

└─ Event: inventory.reserved_released

 

GET /api/v1/inventory/low-stock

├─ Response: List of low-stock products

└─ Real-time: WebSocket updates

```

 

### 5.3 Payment Service APIs

 

```

POST /api/v1/payments/process

├─ Body: { order_id, amount, payment_method, card_token, receipt_details }

├─ Response: { payment_id, transaction_id, status }

├─ Idempotency-Key: {uuid} (prevent duplicate charges)

└─ Event: payment.processed → EventBus

 

POST /api/v1/payments/{payment_id}/refund

├─ Body: { amount, reason }

├─ Response: { refund_id, status, amount }

└─ Event: payment.refunded → EventBus

 

GET /api/v1/payments/{payment_id}

├─ Response: Payment details + receipt

└─ Cache: 1 hour

```

 

### 5.4 Device Sync APIs

 

```

POST /api/v1/device/register

├─ Body: { device_name, device_type, user_id, fcm_token }

├─ Response: { device_id, device_token, sync_data }

└─ Sync: Menu, products, initial inventory snapshot

 

POST /api/v1/device/sync

├─ Body: { device_id, last_sync, local_changes: [orders, inventory] }

├─ Response: { status, server_changes, conflicts, next_sync_token }

└─ Algorithm: CRDT merge with timestamp resolution

 

GET /api/v1/device/sync/delta?since={timestamp}

├─ Response: Only changed records since timestamp

└─ Optimized for mobile bandwidth

 

POST /api/v1/device/heartbeat

├─ Body: { device_id, battery_level, network_status }

└─ Updates: Last heartbeat in database

```

 

### 5.5 WebSocket Events (Notification Service)

 

```

Connection: ws://api.pos.local/ws?device_id={id}&token={jwt}

 

Subscribed Channels:

├─ order_updates:{store_id}

│  └─ Events: order.created, order.status_changed, order.ready

├─ inventory_updates:{store_id}

│  └─ Events: stock.updated, stock.low_alert, stock.out

├─ device_sync:{device_id}

│  └─ Events: sync_required, menu_updated, conflict_detected

└─ system:{store_id}

   └─ Events: maintenance_alert, payment_failed, device_offline

 

Example Event Payload:

{

  "type": "order.ready",

  "order_id": "uuid",

  "table_number": 5,

  "items": ["Burger", "Fries"],

  "timestamp": 1234567890,

  "source_device_id": "kds-001"

}

```

 

---

 

## 6. Offline-First Architecture

 

### 6.1 Offline Data Storage (Client-Side)

 

```javascript

// IndexedDB Schema

{

  stores: [

    'products',

    'orders',

    'order_items',

    'inventory_snapshot',

    'sync_queue',

    'sync_conflicts'

  ]

}

 

// Sync Queue (prioritized)

{

  id: uuid,

  entity_type: 'order' | 'order_item' | 'inventory_adjustment',

  operation: 'create' | 'update' | 'delete',

  data: {...},

  retry_count: 0,

  created_at: timestamp,

  priority: 1-10

}

 

// Conflict Resolution

{

  id: uuid,

  entity_type: string,

  entity_id: uuid,

  local_version: {...},

  server_version: {...},

  conflict_type: 'update_conflict' | 'delete_conflict',

  resolved: false,

  resolution: null

}

```

 

### 6.2 Sync Algorithm (CRDT - Last-Write-Wins)

 

```

SYNC_FLOW:

 

1. Client collects local changes:

   - New orders (created_offline = true)

   - Stock adjustments

   - Order status updates

 

2. Client prepares sync payload:

   {

     device_id: string,

     last_sync_token: string,

     local_changes: [

       { entity: 'order', op: 'create', data: {...}, timestamp: ts1 },

       { entity: 'inventory', op: 'update', data: {...}, timestamp: ts2 }

     ]

   }

 

3. Server processes sync:

   - Validates each change

   - For conflicts: Compare timestamps (latest wins)

   - Reserve inventory atomically

   - Generate server_changes

   - Return new_sync_token

 

4. Client merges response:

   {

     sync_token: "new_token",

     server_changes: [...],

     conflicts: [

       { entity_id, resolution_required: true }

     ]

   }

 

5. User resolves conflicts (UI):

   - Accept server version

   - Accept local version

   - Manual merge

 

6. Retry failed items

```

 

### 6.3 Service Worker Strategy

 

```javascript

// service-worker.js

 

// Offline event queuing

self.addEventListener('fetch', (event) => {

  if (event.request.method === 'POST' && isApi(event.request.url)) {

    event.respondWith(

      fetch(event.request)

        .catch(() => queueOfflineRequest(event.request))

    );

  }

});

 

// Background sync (when online)

self.addEventListener('sync', (event) => {

  if (event.tag === 'sync-queue') {

    event.waitUntil(syncOfflineData());

  }

});

 

// Push notifications (KDS updates)

self.addEventListener('push', (event) => {

  const data = event.data.json();

  self.registration.showNotification(data.title, data);

});

```

 

---

 

## 7. Event-Driven Architecture

 

### 7.1 Event Schema

 

```json

{

  "event_id": "uuid",

  "event_type": "order.created | order.status_updated | inventory.adjusted",

  "aggregate_id": "order_id or product_id",

  "aggregate_type": "Order | Product",

  "version": 1,

  "timestamp": "2026-06-16T10:30:00Z",

  "source_service": "order_service",

  "source_device_id": "device-uuid",

  "user_id": "user-uuid",

  "store_id": "store-uuid",

  "data": {

    "order_id": "...",

    "status": "pending",

    "total": 150.00,

    "items": [...]

  },

  "metadata": {

    "correlation_id": "uuid",

    "causation_id": "uuid",

    "idempotency_key": "uuid"

  }

}

```

 

### 7.2 Event Catalog

 

| Event | Producer | Consumers | Trigger |

|---|---|---|---|

| `order.created` | Order Svc | Inventory, Notification, Reporting | New order |

| `order.item_added` | Order Svc | Inventory, Notification | Item added |

| `order.item_removed` | Order Svc | Inventory (release reserved) | Item deleted |

| `order.status_updated` | Order Svc | Notification, Reporting | Status change |

| `order.cancelled` | Order Svc | Inventory, Payment, Reporting | Cancel triggered |

| `inventory.reserved` | Inventory Svc | Notification | Stock reserved |

| `inventory.adjusted` | Inventory Svc | Reporting, Cache invalidation | Stock moved |

| `inventory.low_stock` | Inventory Svc | Notification, Alert | Low threshold hit |

| `inventory.out_of_stock` | Inventory Svc | Notification | Zero stock |

| `payment.processed` | Payment Svc | Order Svc, Reporting, Notification | Payment success |

| `payment.failed` | Payment Svc | Notification, Order Svc (revert) | Payment failed |

| `payment.refunded` | Payment Svc | Reporting, Notification | Refund issued |

| `device.synced` | Sync Svc | Device Svc, Notification | Sync complete |

| `device.offline` | Device Svc | Notification, Manager Dashboard | Device unreachable |

| `device.online` | Device Svc | Notification | Device reconnected |

 

### 7.3 Event Processing (Kafka / RabbitMQ)

 

```yaml

# Kafka Topic Configuration

topics:

  pos-events:

    partitions: 10  # Partitioned by store_id for ordering

    replication_factor: 3

    retention_ms: 7_days

    config:

      compression.type: snappy

      max.message.bytes: 1_MB

 

  pos-dlq:  # Dead Letter Queue

    partitions: 3

    replication_factor: 3

    retention_ms: 30_days

 

Consumer Groups:

  - notification-service

  - reporting-service

  - inventory-service

  - order-service

  - device-sync-service

  - analytics-processor

 

Partition Strategy: event.store_id % num_partitions

  → Ensures all events for a store go to same partition (ordering)

```

 

---

 

## 8. Security Architecture

 

### 8.1 Authentication Flow

 

```

┌─────────────┐

│   Device    │

└────┬────────┘

     │ POST /auth/login

     │ { username, password, device_name }

     │

     ▼

┌─────────────────────────────────────┐

│     Auth Service                    │

├─────────────────────────────────────┤

│ 1. Validate credentials (bcrypt)    │

│ 2. Check 2FA (if enabled)           │

│ 3. Register device                  │

│ 4. Generate JWT (15 min expiry)     │

│ 5. Generate Refresh Token (7 days)  │

└────┬────────────────────────────────┘

     │ Response:

     │ {

     │   "access_token": "jwt",

     │   "refresh_token": "token",

     │   "device_id": "uuid",

     │   "permissions": ["order:create", ...]

     │ }

     │

     ▼

┌──────────────┐

│ Device Cache │ (IndexedDB + localStorage)

│ JWT + perms  │ (Refresh token in secure cookie)

└──────────────┘

 

Authorization Headers:

Authorization: Bearer {jwt}

X-Device-ID: {device_id}

X-Store-ID: {store_id}

```

 

### 8.2 RBAC (Role-Based Access Control)

 

```yaml

Roles:

  admin:

    - all:*

 

  manager:

    - order:view_all

    - inventory:manage

    - device:manage

    - reports:view

    - user:create

    - user:edit

    - refund:approve

 

  cashier:

    - order:create

    - order:view_own

    - order:close

    - payment:process

    - refund:request

 

  kitchen:

    - order:view

    - order:status_update

    - inventory:view

 

  waiter:

    - order:create

    - order:view

    - customer:manage

 

# Enforcement at API Gateway & Service Level

verifyPermission(user_role, required_permission):

  if permission in role_permissions[user_role]:

    allow

  else:

    deny with 403

```

 

### 8.3 Data Security

 

```

✓ TLS 1.3 for all network communication

✓ AES-256 encryption for sensitive data at rest

✓ Tokenization for payment card data

✓ PCI-DSS Level 1 compliance

✓ SQL injection prevention (parameterized queries)

✓ XSS protection (Content Security Policy)

✓ CSRF tokens for state-changing operations

✓ Rate limiting (10 req/sec per device)

✓ Audit logging for all sensitive operations

✓ Data masking in logs (card numbers, SSN)

```

 

### 8.4 Secrets Management

 

```

Environment Variables (.env.local - NOT in git):

- DB_URL

- JWT_SECRET

- REFRESH_TOKEN_SECRET

- PAYMENT_API_KEY

- STRIPE_SECRET_KEY

- KAFKA_BROKER_URL

- REDIS_URL

- ENCRYPTION_KEY

 

Vault Integration (HashiCorp Vault):

- Rotate secrets every 90 days

- Audit all secret access

- Different secrets per environment (dev/staging/prod)

```

 

---

 

## 9. Deployment Architecture

 

### 9.1 Infrastructure Stack

 

```

┌─────────────────────────────────────────┐

│          CDN (CloudFront)               │

│    ├─ Static assets (JS, CSS, images)   │

│    └─ Cache TTL: 30 days for versioned  │

└────────┬────────────────────────────────┘

         │

┌────────▼──────────────────────────────┐

│    Load Balancer (ALB)                 │

│  ├─ Health checks (every 5s)           │

│  ├─ SSL/TLS termination                │

│  └─ Route based on path                │

└────────┬──────────────────────────────┘

         │

    ┌────┴─────────────────┐

    │                      │

┌───▼──────────┐    ┌─────▼────────┐

│ EKS Cluster  │    │ Serverless   │

│              │    │ (Lambda)     │

│ Services:    │    │              │

│ ├─ Order     │    │ Webhooks,    │

│ ├─ Inventory │    │ async tasks  │

│ ├─ Payment   │    │              │

│ ├─ Auth      │    │              │

│ └─ ...       │    │              │

└───┬──────────┘    └──────────────┘

    │

    ├─ Horizontal scaling: 3-10 replicas per service

    ├─ Resource limits: CPU/Memory per pod

    ├─ Rolling updates: 1 pod at a time

    └─ Readiness/Liveness probes

```

 

### 9.2 Database Deployment

 

```

Primary Database (PostgreSQL):

├─ 3 nodes (leader + 2 replicas)

├─ Automated failover

├─ Read replicas for analytics queries

├─ Backup: Daily snapshots + WAL archiving

├─ RTO: 15 minutes

└─ RPO: 5 minutes

 

Cache (Redis):

├─ Redis Cluster (3 shards)

├─ Replication: 1 slave per shard

├─ Eviction: LRU

├─ Persistence: AOF (append-only file)

└─ Backup: Hourly snapshots

 

Analytics DB (ClickHouse):

├─ 2 nodes (replica 1 + replica 2)

├─ S3 for data storage

├─ Daily backups

└─ Read-only for reporting

 

Message Broker (Kafka):

├─ 3 brokers minimum

├─ Replication factor: 3

├─ Retention: 7 days

└─ Backup: MirrorMaker to backup cluster

```

 

### 9.3 Multi-Region Setup (High Availability)

 

```

Region A (Primary)          Region B (Secondary)

├─ EKS Cluster              ├─ EKS Cluster

├─ PostgreSQL (Leader)      ├─ PostgreSQL (Replica)

├─ Redis Cluster            ├─ Redis Cluster

└─ Kafka Cluster            └─ Kafka Cluster

         │

         │ (Cross-region replication)

         │

      Route 53 (DNS failover)

      └─ Active-Active traffic split (50/50)

         or Active-Passive (use secondary if primary down)

```

 

---

 

## 10. Monitoring & Observability

 

### 10.1 Logging Stack

 

```

Application Logs:

├─ Structured JSON logging (Winston/Pino)

├─ Log levels: ERROR, WARN, INFO, DEBUG

├─ ELK Stack (Elasticsearch + Logstash + Kibana)

│  └─ Retention: 30 days

├─ Loki for structured logs (Kubernetes integration)

└─ Correlation IDs across services

 

Sensitive Data Masking:

├─ Card numbers: **** **** **** 1234

├─ SSN: ***-**-1234

├─ API keys: {first-4}...{last-4}

└─ Passwords: REDACTED

```

 

### 10.2 Metrics Collection

 

```

Prometheus Metrics:

├─ Service metrics

│  ├─ http_requests_total (by method, path, status)

│  ├─ http_request_duration_seconds (histogram)

│  ├─ database_query_duration_seconds

│  └─ message_queue_depth

├─ Business metrics

│  ├─ orders_created_total

│  ├─ revenue_total

│  ├─ inventory_out_of_stock_count

│  └─ payment_success_rate

├─ Infrastructure metrics

│  ├─ pod_cpu_usage_percent

│  ├─ pod_memory_usage_percent

│  ├─ disk_usage_percent

│  └─ network_io_bytes

└─ Grafana Dashboards

   ├─ System overview

   ├─ Service health

   ├─ Business KPIs

   └─ Alerts dashboard

 

Alert Rules:

├─ Service unavailable (5+ min)

├─ High error rate (>5%)

├─ High latency (p99 > 2s)

├─ Database connection pool exhausted

├─ Message queue lag (>1000 messages)

└─ Out of memory (>85%)

```

 

### 10.3 Distributed Tracing

 

```

OpenTelemetry Integration:

├─ Trace every request end-to-end

├─ Jaeger backend

├─ Sample 1-10% of requests (configurable)

├─ Track spans:

│  ├─ HTTP handler

│  ├─ Database query

│  ├─ Message publish/consume

│  ├─ External API calls

│  └─ Cache hits/misses

└─ Context propagation headers:

   ├─ traceparent

   ├─ tracestate

   └─ baggage

```

 

---

 

## 11. Performance & Scalability

 

### 11.1 Performance Targets

 

| Metric | Target | SLA |

|---|---|---|

| API Response Time (p50) | <100ms | 99% |

| API Response Time (p99) | <500ms | 99% |

| Order Creation | <1s | 99.9% |

| Inventory Update | <500ms | 99.9% |

| Payment Processing | <2s | 99.5% |

| Menu Load | <200ms | 99.9% |

| Device Sync | <5s | 99% |

 

### 11.2 Capacity Planning

 

```

Single Store (100 concurrent users):

├─ Order Service: 1 pod (2 CPU, 2GB RAM)

├─ Inventory Service: 1 pod

├─ Payment Service: 1 pod

├─ Database: 1 node (4 CPU, 16GB RAM)

└─ Total: ~$500/month

 

Multi-Store Chain (5 stores, 500 concurrent):

├─ Each service: 3-5 replicas

├─ Database: 3-node cluster (8 CPU, 32GB RAM each)

├─ Cache: Redis cluster (3 shards)

├─ Message queue: 3 Kafka brokers

└─ Total: ~$5,000/month

 

Enterprise (50+ stores, 5000+ concurrent):

├─ Auto-scaling: 5-20 pods per service

├─ Multi-region deployment

├─ Dedicated databases per region

├─ Advanced caching layers

└─ Total: $50,000+/month

```

 

### 11.3 Optimization Strategies

 

```

Database:

├─ Index on frequently queried fields

├─ Partitioning: orders by date

├─ Connection pooling (30-50 connections)

├─ Query caching (Redis)

└─ Read replicas for analytics

 

API:

├─ Pagination: 50 items/page (default)

├─ Response compression: gzip/brotli

├─ Caching headers: ETag, Last-Modified

├─ Lazy loading of relationships

└─ GraphQL field-level caching

 

Frontend:

├─ Code splitting by route

├─ Lazy load images (Intersection Observer)

├─ Service Worker caching

├─ IndexedDB for offline data

└─ Debounce/throttle user actions

```

 

---

 

## 12. Disaster Recovery & Business Continuity

 

### 12.1 RTO/RPO Targets

 

| Component | RTO | RPO |

|---|---|---|

| API Services | 5 min | 0 min |

| Database | 15 min | 5 min |

| Message Queue | 10 min | 1 min |

| Cache | 1 min | - |

| Storage/Backups | 1 hour | 1 hour |

 

### 12.2 Backup Strategy

 

```

Database (PostgreSQL):

├─ Hourly snapshots to S3

├─ Daily full backup

├─ WAL archiving (point-in-time recovery)

├─ Retention: 30 days

 

Event Store (Kafka):

├─ MirrorMaker replication to secondary cluster

├─ 7-day retention in primary

├─ S3 export of critical events

 

Configurations:

├─ Git repository (version controlled)

├─ Secrets in HashiCorp Vault with audit logs

└─ Automated backups every 6 hours

 

Recovery Procedures:

├─ Documented runbooks

├─ Monthly DR drills

├─ Automated testing of backup integrity

└─ <15 min recovery time target

```

 

### 12.3 Failover Plan

 

```

Primary Region Failure Detected:

├─ Health checks fail for 2 minutes

├─ Route 53 DNS switches to secondary region

├─ Replica database promoted to primary

├─ Services start in secondary region

├─ Sync catches up Kafka consumer lag

├─ Alerts sent to on-call team

└─ ETA: 10-15 minutes

 

Manual Failover (if automated fails):

├─ DBA promotes replica manually

├─ DNS updated

├─ Services redeployed

├─ Data consistency verified

└─ ETA: 30-45 minutes

```

 

---

 

## 13. Development & Deployment Workflow

 

### 13.1 CI/CD Pipeline

 

```

GitHub Push

    │

    ├─ Unit Tests (Jest)

    ├─ Integration Tests

    ├─ Linting (ESLint)

    ├─ Security Scan (SonarQube)

    └─ Build Docker Image

           │

    ┌──────┴──────┐

    │             │

(Manual)    Automatic (main branch)

    │             │

    ▼             ▼

Dev/Staging    Production

  Env         Env

    │             │

    ├─ E2E Tests  ├─ Smoke Tests

    ├─ Load Test  ├─ Canary Deploy (5%)

    └─ Manual QA  ├─ 25%, 50%, 100%

                  └─ Health Check & Rollback

```

 

### 13.2 Branch Strategy (Git Flow)

 

```

main (production)

├─ Protected: require PR + reviews

├─ Auto-deploy on merge

└─ Tag with semantic version

 

develop (staging)

├─ Integration branch

└─ Deploy to staging daily

 

feature/* (feature branches)

├─ Create from develop

├─ Merge back via PR

└─ Delete after merge

 

hotfix/* (emergency fixes)

├─ Create from main

├─ Merge to main & develop

└─ Tag as patch version

```

 

### 13.3 Infrastructure as Code (Terraform)

 

```hcl

# infrastructure/main.tf

 

module "eks_cluster" {

  source = "./modules/eks"

 

  cluster_name = "pos-prod"

  environment  = "production"

 

  worker_nodes = 10

  node_type    = "t3.xlarge"

}

 

module "rds_postgres" {

  source = "./modules/rds"

 

  db_name = "pos_db"

  engine  = "postgres"

  version = "15"

 

  instance_class = "db.r5.2xlarge"

  multi_az       = true

}

 

module "elasticache_redis" {

  source = "./modules/elasticache"

 

  cluster_id = "pos-redis"

  engine     = "redis"

  node_type  = "cache.r6g.xlarge"

}

 

# All infrastructure versioned and peer-reviewed

```

 

---

 

## 14. Configuration Management

 

### 14.1 Environment Configuration

 

```yaml

# config/dev.yml

database:

  host: postgres-dev

  port: 5432

  pool_size: 10

 

redis:

  host: redis-dev

  port: 6379

  ttl: 3600

 

api:

  timeout: 30s

  rate_limit: 100

 

features:

  offline_sync: true

  multi_device: true

  analytics: true

 

logging:

  level: DEBUG

  format: json

 

---

 

# config/prod.yml (encrypted)

database:

  host: ${DB_HOST}

  port: 5432

  pool_size: 50

  ssl: true

 

redis:

  host: ${REDIS_HOST}

  cluster: true

 

api:

  timeout: 5s

  rate_limit: 1000

 

logging:

  level: WARN

  format: json

  mask_sensitive: true

```

 

### 14.2 Feature Flags

 

```javascript

// Feature flag service (via LaunchDarkly or custom)

 

// Enable offline sync for specific stores

isOfflineSyncEnabled(store_id, user_role)

  → true for beta users, false for others

 

// A/B test new inventory UI

getInventoryUIVersion(user_id)

  → 'old' (90%) vs 'new' (10%)

 

// Gradually rollout payment feature

isPaymentGatewayEnabled(store_id, payment_method)

  → Enable Stripe for 50% of stores

```

 

---

 

## 15. Implementation Roadmap

 

### Phase 1 (Months 1-2): MVP

- [ ] Core order management

- [ ] Basic inventory tracking

- [ ] Payment processing

- [ ] Single device type (POS terminal)

- [ ] Deployment: Single server

 

### Phase 2 (Months 3-4): Multi-Device & Offline

- [ ] Kitchen Display System

- [ ] Mobile app (React Native)

- [ ] Offline-first architecture

- [ ] Device sync mechanism

- [ ] Deployment: AWS EKS

 

### Phase 3 (Months 5-6): Analytics & Scale

- [ ] Reporting dashboard

- [ ] Advanced analytics

- [ ] Multi-region deployment

- [ ] Performance optimization

- [ ] Manager portal

 

### Phase 4 (Months 7-8): Enterprise Features

- [ ] Multi-tenant support

- [ ] Advanced RBAC

- [ ] API marketplace

- [ ] 3rd-party integrations

- [ ] High availability setup

 

---

 

## 16. Unified Revenue & Food Aggregator Contribution Dashboard

 

This section defines the design of the **Unified Revenue Dashboard** — a single view that shows the store's total revenue and the percentage contribution from each channel (direct POS and all connected food aggregator platforms: Deliveroo, Talabat, Noon Food, Careem Food, etc.).

 

---

 

### 16.1 Dashboard Overview

 

```

┌─────────────────────────────────────────────────────────────────────────┐

│  UNIFIED REVENUE DASHBOARD          Store: The Burger Lab   Jun 2026    │

├────────────────────────────────────────────────────────────────────────┤

│                                                                         │

│   TOTAL GROSS REVENUE                  NET REVENUE (after commission)  │

│   ┌───────────────────┐                ┌───────────────────┐           │

│   │   AED 425,000     │                │   AED 388,250     │           │

│   │   +12.3% vs May   │                │   Commission Lost │           │

│   └───────────────────┘                │   AED 36,750 (8.6%)│          │

│                                        └───────────────────┘           │

├────────────────────────────────────────────────────────────────────────┤

│  CHANNEL CONTRIBUTION BREAKDOWN                                        │

│                                                                         │

│  ● Direct POS    ████████████████████░░░░░░░░░░░░  42.4%  AED 180,000 │

│  ● Deliveroo     █████████████░░░░░░░░░░░░░░░░░░░  28.2%  AED 120,000 │

│  ● Talabat       ██████████░░░░░░░░░░░░░░░░░░░░░░  20.0%  AED  85,000 │

│  ● Noon Food     █████░░░░░░░░░░░░░░░░░░░░░░░░░░░   9.4%  AED  40,000 │

│                                                                         │

│                  [ Pie Chart ]    [ Bar Chart ]    [ Trend Line ]      │

└─────────────────────────────────────────────────────────────────────────┘

```

 

---

 

### 16.2 Channel Contribution Metrics

 

Each aggregator channel shows the following KPIs side-by-side:

 

| Metric | Direct POS | Deliveroo | Talabat | Noon Food | Careem |

|---|---|---|---|---|---|

| **Gross Revenue** | AED 180,000 | AED 120,000 | AED 85,000 | AED 40,000 | AED 0 |

| **% of Total** | 42.4% | 28.2% | 20.0% | 9.4% | 0% |

| **Total Orders** | 1,200 | 800 | 620 | 280 | 0 |

| **Avg Order Value** | AED 150 | AED 150 | AED 137 | AED 143 | - |

| **Commission Rate** | 0% | 15% | 15% | 15% | 15% |

| **Commission Paid** | AED 0 | AED 18,000 | AED 12,750 | AED 6,000 | AED 0 |

| **Net Revenue** | AED 180,000 | AED 102,000 | AED 72,250 | AED 34,000 | - |

| **Net % of Total** | 46.4% | 26.3% | 18.6% | 8.7% | - |

| **MoM Growth** | +8.5% | +13.0% | +10.3% | +5.3% | - |

 

> **Key Insight Panel:** "Direct POS generates 42.4% of orders but 46.4% of net revenue due to zero commission — incentivising repeat direct orders saves AED 36,750/month."

 

---

 

### 16.3 Architecture — Aggregator Data Ingestion

 

```

┌───────────────────────────────────────────────────────────────┐

│                    AGGREGATOR LAYER                           │

│                                                               │

│  Deliveroo   Talabat   Noon Food   Careem    Hunger Station   │

│  (Webhook)  (Webhook)  (Polling)  (Webhook)   (REST API)     │

└──────────────────────────┬────────────────────────────────────┘

                           │

             ┌─────────────▼──────────────┐

             │   Aggregator Gateway Svc   │

             │                            │

             │  ├─ Validate HMAC sig      │

             │  ├─ Normalize order schema │

             │  ├─ Attach platform tag    │

             │  ├─ Lookup commission rate │

             │  └─ Compute net revenue    │

             └─────────────┬──────────────┘

                           │

        ┌──────────────────┼──────────────────┐

        │                  │                  │

  ┌─────▼──────┐   ┌───────▼──────┐   ┌──────▼──────┐

  │Order Svc   │   │Inventory Svc │   │Revenue Svc  │

  │(create     │   │(deduct stock)│   │(update chan-│

  │ platform   │   │              │   │ nel totals) │

  │ order)     │   │              │   │             │

  └────────────┘   └──────────────┘   └─────────────┘

                                             │

                                    ┌────────▼────────┐

                                    │  ClickHouse     │

                                    │  (Revenue       │

                                    │   Analytics DB) │

                                    └─────────────────┘

```

 

---

 

### 16.4 Database Schema

 

```sql

-- Revenue totals per channel per store (pre-aggregated for fast dashboard load)

CREATE TABLE channel_revenue_summary (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    period_type ENUM ('daily', 'weekly', 'monthly') NOT NULL,

    period_date DATE NOT NULL,

    platform VARCHAR(50) NOT NULL,     -- 'direct', 'deliveroo', 'talabat', 'noon', 'careem'

    gross_revenue DECIMAL(12,2) DEFAULT 0.00,

    net_revenue DECIMAL(12,2) DEFAULT 0.00,

    commission_paid DECIMAL(12,2) DEFAULT 0.00,

    order_count INT DEFAULT 0,

    avg_order_value DECIMAL(10,2),

    revenue_share_pct DECIMAL(5,2),    -- % of store total for that period

    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE (store_id, period_type, period_date, platform)

);

 

-- Per-order platform tag for raw rollups

ALTER TABLE orders ADD COLUMN platform VARCHAR(50) DEFAULT 'direct';

ALTER TABLE orders ADD COLUMN platform_order_id VARCHAR(255);

ALTER TABLE orders ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0.00;

ALTER TABLE orders ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE orders ADD COLUMN net_revenue DECIMAL(10,2);

 

-- Aggregator commission rates (configurable per store)

CREATE TABLE aggregator_commissions (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    platform VARCHAR(50) NOT NULL,

    commission_pct DECIMAL(5,2) NOT NULL,

    effective_from DATE NOT NULL,

    effective_to DATE,

    UNIQUE (store_id, platform, effective_from)

);

 

CREATE INDEX idx_channel_revenue_store_period ON channel_revenue_summary(store_id, period_date DESC);

CREATE INDEX idx_orders_platform ON orders(store_id, platform, created_at DESC);

```

 

---

 

### 16.5 Dashboard API Endpoints

 

```

GET /api/v1/analytics/revenue/channels

├─ Query: store_id, period (daily|weekly|monthly), from, to

├─ Response:

│  {

│    "period": "2026-06",

│    "total_gross": 425000.00,

│    "total_net": 388250.00,

│    "total_commission_lost": 36750.00,

│    "channels": [

│      {

│        "platform": "direct",

│        "label": "Direct POS",

│        "gross_revenue": 180000,

│        "net_revenue": 180000,

│        "orders": 1200,

│        "avg_order": 150.00,

│        "share_pct": 42.4,

│        "net_share_pct": 46.4,

│        "mom_growth_pct": 8.5

│      },

│      {

│        "platform": "deliveroo",

│        "label": "Deliveroo",

│        "gross_revenue": 120000,

│        "net_revenue": 102000,

│        "commission_paid": 18000,

│        "commission_rate": 15,

│        "orders": 800,

│        "avg_order": 150.00,

│        "share_pct": 28.2,

│        "net_share_pct": 26.3,

│        "mom_growth_pct": 13.0

│      },

│      ...

│    ]

│  }

 

GET /api/v1/analytics/revenue/channels/trend

├─ Query: store_id, platform (all|deliveroo|talabat|...), granularity (day|week|month)

├─ Response: Time-series data for trend charts

│  {

│    "series": [

│      { "date": "2026-01", "direct": 150000, "deliveroo": 90000, "talabat": 60000, "noon": 25000 },

│      { "date": "2026-02", "direct": 160000, "deliveroo": 100000, ... },

│      ...

│    ]

│  }

 

GET /api/v1/analytics/revenue/channels/insight

├─ Response: Auto-generated textual insight

│  {

│    "insights": [

│      "Direct POS contributes 42.4% of gross but 46.4% of net — highest margin channel.",

│      "Talabat orders grew 10.3% MoM — fastest growing aggregator.",

│      "Commission to aggregators: AED 36,750 this month (8.6% of gross).",

│      "Switching 10% of Deliveroo customers to direct would save AED 1,800/month."

│    ]

│  }

```

 

---

 

### 16.6 Real-Time Channel Updates (WebSocket)

 

```

WebSocket Channel: revenue_updates:{store_id}

 

Event: revenue.channel_updated

Payload:

{

  "type": "revenue.channel_updated",

  "platform": "talabat",

  "delta": {

    "gross_revenue": +137.50,

    "net_revenue": +116.88,

    "commission": +20.63,

    "order_count": +1

  },

  "new_totals": {

    "talabat_gross_today": 4250.00,

    "talabat_share_pct_today": 21.3

  },

  "timestamp": "2026-06-16T14:30:00Z"

}

 

→ Dashboard widgets update live without page refresh

→ Donut chart slices animate to new percentages

```

 

---

 

### 16.7 Supported Aggregator Platforms

 

| Platform | Region | Integration Method | Webhook Auth |

|---|---|---|---|

| **Direct POS** | All | Native | - |

| **Deliveroo** | UAE, KSA, Kuwait | Webhook (push) | HMAC-SHA256 |

| **Talabat** | UAE, KSA, Bahrain, Kuwait, Jordan | Webhook (push) | HMAC-SHA256 |

| **Noon Food** | UAE, KSA, Egypt | REST API polling | API Key |

| **Careem Food** | UAE, KSA | Webhook (push) | HMAC-SHA256 |

| **Hunger Station** | KSA | REST API | API Key |

 

---

 

### 16.8 Commission Impact Analysis View

 

Visual panel comparing **gross vs net** across channels at a glance:

 

```

COMMISSION IMPACT — Jun 2026

 

Channel       Gross Revenue    Commission    Net Revenue    Loss %

──────────────────────────────────────────────────────────────────

Direct POS    AED 180,000      AED 0         AED 180,000    0.0%

Deliveroo     AED 120,000      AED 18,000    AED 102,000   15.0%

Talabat       AED  85,000      AED 12,750    AED  72,250   15.0%

Noon Food     AED  40,000      AED  6,000    AED  34,000   15.0%

──────────────────────────────────────────────────────────────────

TOTAL         AED 425,000      AED 36,750    AED 388,250    8.6%

 

💡 Recommendation:

  If 20% of aggregator orders shift to direct channel:

  → Additional net revenue gain: ~AED 7,350/month

  → Annual saving: ~AED 88,200

```

 

---

 

## 17. Feature Modules

 

This section provides detailed design for each major feature module of the POS platform — covering data models, APIs, UI flows, and event contracts.

 

---

 

### 17.1 Basic Marketplace

 

The marketplace acts as a **digital storefront** where customers can browse menus, place orders online, and track delivery — directly from the store without third-party aggregators.

 

#### Architecture

 

```

Customer Browser / App

        │

        ▼

┌─────────────────────┐

│  Marketplace SPA    │   (React PWA — public-facing)

│  ├─ Store catalog   │

│  ├─ Menu browser    │

│  ├─ Cart & checkout │

│  └─ Order tracker   │

└────────┬────────────┘

         │ REST / GraphQL

         ▼

┌─────────────────────┐

│  Marketplace Svc    │   Port: 3010

│  ├─ Store listings  │

│  ├─ Menu rendering  │

│  ├─ Cart management │

│  ├─ Order placement │

│  └─ SEO & slugs     │

└────────┬────────────┘

         │

    ┌────┴─────────────┐

    │                  │

Order Svc         Payment Svc

(create order)  (online checkout)

```

 

#### Key Features

 

| Feature | Description |

|---|---|

| Public store URL | `menu.posapp.com/{store-slug}` — shareable per store |

| Menu catalog | Category browsing, item search, photos, allergen info |

| Cart management | Add/remove items, modifiers, special instructions |

| Online checkout | Credit card, Apple Pay, Google Pay |

| Order tracking | Real-time order status page (no account required) |

| Multi-language | Arabic / English toggle |

| SEO optimized | Static-rendered menus (Next.js SSR) |

 

#### Database Schema

 

```sql

CREATE TABLE marketplace_stores (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL UNIQUE REFERENCES stores(id),

    slug VARCHAR(100) UNIQUE NOT NULL,    -- e.g. "the-burger-lab"

    is_published BOOLEAN DEFAULT FALSE,

    tagline VARCHAR(255),

    cover_image_url TEXT,

    min_order_amount DECIMAL(10,2),

    estimated_prep_mins INT DEFAULT 20,

    accepts_online_orders BOOLEAN DEFAULT TRUE,

    operating_hours JSONB,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE marketplace_banners (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    image_url TEXT NOT NULL,

    title VARCHAR(255),

    link_url TEXT,

    display_order INT DEFAULT 0,

    active BOOLEAN DEFAULT TRUE,

    valid_from TIMESTAMP,

    valid_to TIMESTAMP

);

```

 

#### API Endpoints

 

```

GET  /marketplace/{slug}                 → Store info + open status

GET  /marketplace/{slug}/menu            → Full menu with categories + items

POST /marketplace/{slug}/cart            → Create/update cart session

POST /marketplace/{slug}/orders          → Place online order

GET  /marketplace/{slug}/orders/{id}     → Order tracking page

```

 

---

 

### 17.2 Menu Management

 

Full lifecycle management of the store's menu — categories, items, modifiers, pricing, images, availability, and time-based visibility.

 

#### Menu Structure

 

```

Store

└─ Menu (can have multiple menus: Breakfast, Lunch, Dinner)

   └─ Categories (e.g. Burgers, Drinks, Sides)

      └─ Items (e.g. Classic Burger)

         ├─ Variants (Small / Medium / Large)

         ├─ Modifier Groups (Add-ons: Extra cheese, Sauce)

         │   └─ Modifiers (individual options)

         └─ Linked Inventory Product (for stock deduction)

```

 

#### Database Schema

 

```sql

CREATE TABLE menus (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,          -- "Breakfast Menu"

    description TEXT,

    is_default BOOLEAN DEFAULT FALSE,

    status ENUM ('active', 'inactive') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE menu_categories (

    id UUID PRIMARY KEY,

    menu_id UUID NOT NULL REFERENCES menus(id),

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    name_ar VARCHAR(255),                -- Arabic translation

    description TEXT,

    image_url TEXT,

    display_order INT DEFAULT 0,

    status ENUM ('active', 'inactive', 'hidden') DEFAULT 'active',

    available_from TIME,                 -- e.g. 09:00 (for timed categories)

    available_to TIME,

    available_days VARCHAR(50)           -- e.g. "Mon,Tue,Wed,Thu,Fri"

);

 

CREATE TABLE menu_items (

    id UUID PRIMARY KEY,

    category_id UUID NOT NULL REFERENCES menu_categories(id),

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    name_ar VARCHAR(255),

    description TEXT,

    image_url TEXT,

    base_price DECIMAL(10,2) NOT NULL,

    tax_rate DECIMAL(5,2) DEFAULT 5.00,

    sku VARCHAR(100),

    barcode VARCHAR(100),

    calories INT,

    allergens VARCHAR(255),

    tags VARCHAR(255),                   -- e.g. "spicy,bestseller,new"

    status ENUM ('active', 'inactive', 'sold_out', 'hidden') DEFAULT 'active',

    sort_order INT DEFAULT 0,

    is_featured BOOLEAN DEFAULT FALSE,

    inventory_product_id UUID REFERENCES products(id),

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE modifier_groups (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,         -- "Choose your sauce"

    selection_type ENUM ('single', 'multiple') DEFAULT 'single',

    min_selections INT DEFAULT 0,

    max_selections INT DEFAULT 1,

    is_required BOOLEAN DEFAULT FALSE

);

 

CREATE TABLE modifier_group_items (

    id UUID PRIMARY KEY,

    modifier_group_id UUID REFERENCES modifier_groups(id),

    menu_item_id UUID REFERENCES menu_items(id)

);

 

CREATE TABLE modifiers (

    id UUID PRIMARY KEY,

    group_id UUID NOT NULL REFERENCES modifier_groups(id),

    name VARCHAR(255) NOT NULL,

    name_ar VARCHAR(255),

    price_adjustment DECIMAL(10,2) DEFAULT 0.00,

    is_default BOOLEAN DEFAULT FALSE,

    status ENUM ('active', 'inactive') DEFAULT 'active',

    inventory_product_id UUID REFERENCES products(id)

);

 

CREATE TABLE item_variants (

    id UUID PRIMARY KEY,

    menu_item_id UUID NOT NULL REFERENCES menu_items(id),

    name VARCHAR(100) NOT NULL,          -- "Large", "Small"

    price DECIMAL(10,2) NOT NULL,

    sku VARCHAR(100),

    status ENUM ('active', 'inactive') DEFAULT 'active'

);

```

 

#### Menu Management APIs

 

```

GET    /api/v1/menus                       → List all menus for store

POST   /api/v1/menus                       → Create menu

PATCH  /api/v1/menus/{id}                  → Update menu

 

GET    /api/v1/menus/{id}/categories       → List categories

POST   /api/v1/menus/{id}/categories       → Create category

PATCH  /api/v1/categories/{id}             → Update / reorder

DELETE /api/v1/categories/{id}             → Delete category

 

POST   /api/v1/items                       → Create item

PATCH  /api/v1/items/{id}                  → Update item

PATCH  /api/v1/items/{id}/status           → Toggle active/sold_out

POST   /api/v1/items/bulk-update           → Bulk price/status update

POST   /api/v1/items/{id}/image            → Upload item image

 

POST   /api/v1/modifier-groups             → Create modifier group

POST   /api/v1/modifier-groups/{id}/modifiers → Add modifier option

```

 

---

 

### 17.3 Customer Model

 

Unified customer profiles capturing identity, order history, preferences, loyalty, and channel attribution.

 

#### Customer Lifecycle

 

```

New Customer

    │

    ├─ Walk-in POS  → Captured via phone/name at checkout

    ├─ Online order → Auto-created from marketplace order

    ├─ Aggregator   → Resolved from platform order (see §16.4)

    └─ Loyalty sign-up → Self-registered via QR code

           │

           ▼

    Customer Profile (canonical)

    ├─ Identity (phone, email, name)

    ├─ Preferences (dietary, fav items)

    ├─ Order history (all channels)

    ├─ Loyalty points

    ├─ Applied coupons

    └─ Segment (New / Regular / VIP / Churned)

```

 

#### Database Schema

 

```sql

CREATE TABLE customers (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    canonical_phone VARCHAR(20),

    canonical_email VARCHAR(255),

    full_name VARCHAR(255),

    date_of_birth DATE,

    gender ENUM ('male', 'female', 'other', 'prefer_not_to_say'),

    preferred_language VARCHAR(10) DEFAULT 'en',

    dietary_preferences VARCHAR(255),    -- e.g. "halal,vegetarian"

    notes TEXT,

    segment ENUM ('new', 'regular', 'vip', 'at_risk', 'churned') DEFAULT 'new',

    loyalty_points INT DEFAULT 0,

    total_orders INT DEFAULT 0,

    total_spent DECIMAL(12,2) DEFAULT 0.00,

    first_order_at TIMESTAMP,

    last_order_at TIMESTAMP,

    referral_code VARCHAR(20) UNIQUE,

    referred_by_customer_id UUID REFERENCES customers(id),

    marketing_opt_in BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE customer_addresses (

    id UUID PRIMARY KEY,

    customer_id UUID NOT NULL REFERENCES customers(id),

    label VARCHAR(50),                   -- "Home", "Office"

    address_line_1 VARCHAR(255),

    city VARCHAR(100),

    country VARCHAR(100),

    latitude DECIMAL(9,6),

    longitude DECIMAL(9,6),

    is_default BOOLEAN DEFAULT FALSE

);

 

CREATE TABLE customer_loyalty (

    id UUID PRIMARY KEY,

    customer_id UUID NOT NULL REFERENCES customers(id) UNIQUE,

    card_number VARCHAR(50) UNIQUE,

    points_balance INT DEFAULT 0,

    points_earned_total INT DEFAULT 0,

    points_redeemed_total INT DEFAULT 0,

    tier ENUM ('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',

    tier_expiry DATE,

    updated_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE loyalty_transactions (

    id UUID PRIMARY KEY,

    customer_id UUID NOT NULL,

    order_id UUID,

    transaction_type ENUM ('earn', 'redeem', 'adjust', 'expire') NOT NULL,

    points INT NOT NULL,

    balance_after INT,

    description VARCHAR(255),

    created_at TIMESTAMP DEFAULT NOW()

);

```

 

#### Customer APIs

 

```

POST /api/v1/customers                     → Create customer

GET  /api/v1/customers/{id}                → Customer profile + stats

GET  /api/v1/customers/search?q={phone}    → Phone/email lookup at POS

PATCH /api/v1/customers/{id}               → Update profile

 

GET  /api/v1/customers/{id}/orders         → Full order history (all channels)

GET  /api/v1/customers/{id}/loyalty        → Points balance + tier

POST /api/v1/customers/{id}/loyalty/redeem → Redeem points at checkout

```

 

---

 

### 17.4 Timed Events

 

Schedule automatic price changes, menu availability, special operating hours, and happy-hour rules — all time-bound.

 

#### Types of Timed Events

 

| Event Type | Example |

|---|---|

| **Happy Hour** | 20% off all drinks 3 PM – 6 PM daily |

| **Time-based menu** | Breakfast menu active 7 AM – 11 AM only |

| **Scheduled price change** | Burger price AED 45 → AED 50 from next Monday |

| **Category blackout** | Hide "Alcohol" section on Fridays |

| **Surge pricing** | +15% on weekend evenings |

| **Promotional window** | "Ramadan Special" menu active during Ramadan |

 

#### Database Schema

 

```sql

CREATE TABLE timed_events (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    event_type ENUM ('happy_hour', 'menu_schedule', 'price_change',

                     'category_blackout', 'surge_pricing', 'promo_window') NOT NULL,

    status ENUM ('active', 'inactive', 'expired') DEFAULT 'active',

 

    -- Recurrence

    recurrence_type ENUM ('once', 'daily', 'weekly', 'custom') DEFAULT 'once',

    active_days VARCHAR(50),             -- "Mon,Tue,Wed" or "all"

    start_time TIME,                     -- 15:00

    end_time TIME,                       -- 18:00

    valid_from DATE,

    valid_to DATE,

 

    -- Action definition

    applies_to ENUM ('all', 'category', 'item') DEFAULT 'all',

    target_ids JSONB,                    -- [category_id, ...] or [item_id, ...]

    action JSONB,                        -- { type: 'price_override', value: 45.00 }

                                         -- { type: 'discount_pct', value: 20 }

                                         -- { type: 'hide', value: true }

 

    priority INT DEFAULT 0,             -- Higher = applied first on conflict

    created_by UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

 

-- Runtime: which items are currently affected by active timed events

CREATE TABLE active_event_overrides (

    item_id UUID NOT NULL,

    event_id UUID NOT NULL REFERENCES timed_events(id),

    override_type VARCHAR(50),

    override_value JSONB,

    expires_at TIMESTAMP,

    PRIMARY KEY (item_id, event_id)

);

```

 

#### Timed Event Engine (Background Scheduler)

 

```

Cron: every 1 minute → EventScheduler.evaluate()

 

For each store:

  1. Query timed_events WHERE active AND within time window

  2. Build active_event_overrides map

  3. Publish: menu.overrides_updated (store_id, overrides)

  4. POS terminals + Marketplace reload price/visibility from cache

 

Cache key: menu_overrides:{store_id} (TTL: auto-expires at event end)

 

Example override at 15:00:

  {

    "category:drinks": { "discount_pct": 20, "label": "Happy Hour" },

    "item:beer-123":   { "hidden": true }   ← if alcohol blackout

  }

```

 

#### APIs

 

```

GET  /api/v1/timed-events                  → List all events for store

POST /api/v1/timed-events                  → Create timed event

PATCH /api/v1/timed-events/{id}            → Edit event

DELETE /api/v1/timed-events/{id}           → Deactivate event

GET  /api/v1/timed-events/active-now       → What's currently in effect

```

 

---

 

### 17.5 Coupons & Promotions

 

Two distinct but related modules:

 

- **Coupons** — code-based discounts redeemed by a specific customer at checkout

- **Promotions** — automatic rule-based discounts applied to qualifying orders

 

---

 

#### 17.5.1 Coupons

 

```sql

CREATE TABLE coupons (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    code VARCHAR(50) NOT NULL UNIQUE,   -- e.g. "WELCOME20"

    description VARCHAR(255),

    discount_type ENUM ('percentage', 'fixed_amount', 'free_item', 'free_delivery') NOT NULL,

    discount_value DECIMAL(10,2),

    free_item_id UUID REFERENCES menu_items(id),

    min_order_amount DECIMAL(10,2) DEFAULT 0,

    max_discount_cap DECIMAL(10,2),

    usage_limit INT,                     -- total uses allowed (NULL = unlimited)

    usage_limit_per_customer INT DEFAULT 1,

    times_used INT DEFAULT 0,

    valid_from TIMESTAMP NOT NULL,

    valid_to TIMESTAMP,

    applicable_to ENUM ('all', 'category', 'item') DEFAULT 'all',

    target_ids JSONB,

    customer_segment ENUM ('all', 'new', 'vip', 'returning') DEFAULT 'all',

    is_active BOOLEAN DEFAULT TRUE,

    created_by UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE coupon_redemptions (

    id UUID PRIMARY KEY,

    coupon_id UUID NOT NULL REFERENCES coupons(id),

    customer_id UUID NOT NULL,

    order_id UUID NOT NULL,

    discount_applied DECIMAL(10,2),

    redeemed_at TIMESTAMP DEFAULT NOW()

);

```

 

#### Coupon Validation Flow

 

```

POST /api/v1/coupons/validate

Body: { code, customer_id, cart_total, cart_items }

 

Validations (in order):

  1. Coupon exists + is_active = true

  2. Within valid_from / valid_to window

  3. cart_total >= min_order_amount

  4. usage_limit not exceeded (global)

  5. customer usage_limit_per_customer not exceeded

  6. Customer segment match

  7. Item/category applicability match

 

Response:

  {

    "valid": true,

    "discount_type": "percentage",

    "discount_value": 20,

    "computed_discount": 30.00,       ← applied to cart

    "message": "WELCOME20 — 20% off applied!"

  }

```

 

---

 

#### 17.5.2 Promotions (Auto-Applied Rules)

 

```sql

CREATE TABLE promotions (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    promotion_type ENUM (

        'buy_x_get_y',          -- Buy 2 get 1 free

        'spend_and_save',       -- Spend AED 100 get 15% off

        'bundle_deal',          -- Burger + Fries + Drink for AED 50

        'loyalty_multiplier',   -- 2x loyalty points this weekend

        'flash_sale',           -- 30% off for 2 hours

        'free_item_threshold'   -- Free dessert on orders > AED 150

    ) NOT NULL,

    rule_config JSONB NOT NULL,        -- Flexible rule definition

    discount_type ENUM ('percentage', 'fixed_amount', 'free_item'),

    discount_value DECIMAL(10,2),

    stackable BOOLEAN DEFAULT FALSE,   -- Can combine with other promotions?

    priority INT DEFAULT 0,

    valid_from TIMESTAMP NOT NULL,

    valid_to TIMESTAMP,

    max_uses INT,

    times_used INT DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW()

);

 

-- Rule config examples:

-- Buy 2 get 1: { "buy_qty": 2, "get_qty": 1, "item_id": "uuid" }

-- Spend & save: { "min_spend": 100, "discount_pct": 15 }

-- Bundle: { "items": ["uuid1","uuid2","uuid3"], "bundle_price": 50 }

```

 

#### Auto-Apply Engine

 

```

On cart change → PromotionEngine.evaluate(cart, store_id)

 

1. Load active promotions (cached in Redis: promos:{store_id})

2. Sort by priority DESC

3. For each promotion, test rule_config against cart

4. Collect all matching promotions

5. If !stackable → pick highest-value promotion only

6. Return applied discounts list

 

Applied to order:

  order.discounts = [

    { type: "promotion", name: "Happy Meal Bundle", amount: 15.00 },

    { type: "coupon",    code: "WELCOME20",          amount: 30.00 }

  ]

```

 

#### APIs

 

```

GET  /api/v1/promotions                    → List all promotions

POST /api/v1/promotions                    → Create promotion

PATCH /api/v1/promotions/{id}              → Edit promotion

GET  /api/v1/promotions/active             → Currently running promotions

 

POST /api/v1/coupons                       → Generate coupon

GET  /api/v1/coupons                       → List coupons + usage stats

POST /api/v1/coupons/validate              → Validate at checkout

POST /api/v1/coupons/bulk-generate         → Generate batch (e.g. 1000 unique codes)

```

 

---

 

### 17.6 Dashboards

 

The platform includes role-specific dashboards served from a unified **Reporting + Dashboard Service**.

 

#### Dashboard Types

 

| Dashboard | Audience | Key Widgets |

|---|---|---|

| **Operations Dashboard** | Manager (real-time) | Live orders, table status, queue depth, device health |

| **Sales Dashboard** | Owner / Finance | Revenue by channel, top items, hourly sales heatmap |

| **Inventory Dashboard** | Store Manager | Stock levels, low-stock alerts, movement trend |

| **Customer Dashboard** | CRM / Marketing | New vs returning, LTV, churn risk, coupon performance |

| **Aggregator Dashboard** | Management | Channel contribution %, commission cost, net revenue |

| **Employee Dashboard** | HR / Manager | Shift summary, orders per cashier, average handle time |

 

#### Operations Dashboard (Real-Time)

 

```

┌──────────────────────────────────────────────────────────────────┐

│  LIVE OPERATIONS         The Burger Lab    Mon 16 Jun  14:32    │

├───────────────┬──────────────┬───────────────┬──────────────────┤

│ Orders Today  │  In Progress │  Avg Wait Time │  Revenue Today  │

│     248       │      12      │    8.5 min     │  AED 18,450     │

├───────────────┴──────────────┴───────────────┴──────────────────┤

│                                                                   │

│  LIVE QUEUE                          DEVICE STATUS               │

│  #1045  Table 4   Burger x2   9m     POS-01  ● Online            │

│  #1046  Takeout   Wrap x1     3m     POS-02  ● Online            │

│  #1047  Delivery  Salad x3   12m     KDS-01  ● Online            │

│                                      KDS-02  ⚠ Offline           │

│                                                                   │

│  TOP SELLING TODAY                   STOCK ALERTS                │

│  1. Classic Burger   x58             ⚠ Chicken Breast  → 2 kg   │

│  2. Fries            x72             ✗ Coleslaw Mix    → OUT     │

│  3. Coke             x91             ⚠ Burger Buns     → 20 pcs │

└──────────────────────────────────────────────────────────────────┘

```

 

#### Dashboard Data Architecture

 

```

Widgets pull data from two layers:

 

1. Real-time layer (WebSocket):

   → Live orders, device status, queue updates

 

2. Pre-aggregated layer (Redis + ClickHouse):

   → Today's revenue, top items, stock levels

   → Refreshed every 60 seconds by background aggregator job

 

Dashboard API:

GET /api/v1/dashboards/operations        → Real-time ops data

GET /api/v1/dashboards/sales?period=today → Sales summary

GET /api/v1/dashboards/inventory         → Stock health

GET /api/v1/dashboards/customers         → CRM summary

GET /api/v1/dashboards/employees         → Shift performance

```

 

---

 

### 17.7 Reporting

 

Scheduled and on-demand reports covering sales, inventory, customers, and financials.

 

#### Report Catalog

 

| Report | Frequency | Export |

|---|---|---|

| **Daily Sales Summary** | Daily (auto-email) | PDF, CSV |

| **Hourly Sales Breakdown** | On-demand | CSV |

| **Sales by Category / Item** | On-demand | PDF, CSV |

| **Payment Method Summary** | Daily | PDF |

| **Inventory Movement Report** | Daily | CSV |

| **Waste & Adjustment Report** | Weekly | CSV |

| **Low Stock Report** | On-demand | CSV |

| **Customer Retention Report** | Weekly | PDF |

| **Coupon Performance Report** | Weekly | CSV |

| **Aggregator Revenue Report** | Monthly | PDF |

| **Employee Performance Report** | Weekly | PDF |

| **Tax Summary Report** | Monthly | PDF (VAT-ready) |

 

#### Reporting Service Design

 

```

Report Generation Pipeline:

 

User requests report

        │

        ▼

┌──────────────────┐

│  Report Queue    │   (Bull Queue / SQS)

│  (async for      │

│   large reports) │

└────────┬─────────┘

         │

         ▼

┌──────────────────┐    ┌──────────────┐

│  Report Worker   │───►│  ClickHouse  │

│  ├─ Query data   │    │  (analytics) │

│  ├─ Aggregate    │    └──────────────┘

│  ├─ Format PDF   │

│  └─ Upload S3    │

└────────┬─────────┘

         │

         ▼

┌──────────────────┐

│  Notification    │  Email / WhatsApp delivery

│  Service         │

└──────────────────┘

```

 

#### Reporting APIs

 

```

GET  /api/v1/reports                           → List available reports

POST /api/v1/reports/generate                  → Request report generation

     Body: { report_type, period_from, period_to, format, filters }

GET  /api/v1/reports/{job_id}/status           → Poll generation status

GET  /api/v1/reports/{job_id}/download         → Download generated file (S3 URL)

 

GET  /api/v1/reports/sales/summary             → Inline sales summary (light)

GET  /api/v1/reports/sales/items               → Item performance table

GET  /api/v1/reports/inventory/movements       → Stock movement log

GET  /api/v1/reports/customers/retention       → Cohort retention data

GET  /api/v1/reports/tax/vat-summary           → UAE VAT 5% report

```

 

---

 

### 17.8 Kitchen Display System (KDS)

 

Dedicated screen inside the kitchen showing live orders, station routing, and prep timers.

 

#### KDS Architecture

 

```

Order Created (POS / Online / Aggregator)

         │

         ▼

Order Service → Event: order.created

         │

         ▼

Notification Service

         │ WebSocket push

         ▼

┌──────────────────────────────────────────────┐

│  KDS Application (React PWA)                 │

│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │

│  │  Grill   │  │  Fryer   │  │  Assembly  │ │

│  │ Station  │  │ Station  │  │  Station   │ │

│  │#1044 3m  │  │#1044 5m  │  │ Waiting... │ │

│  │  Burger  │  │  Fries   │  │            │ │

│  │  x2 ●   │  │  x2 ●   │  │            │ │

│  └──────────┘  └──────────┘  └────────────┘ │

└──────────────────────────────────────────────┘

```

 

#### KDS Features

 

| Feature | Description |

|---|---|

| **Station routing** | Items routed to specific stations (Grill, Fryer, Cold) based on category config |

| **Priority coloring** | Green (< 5 min) → Yellow (5-10 min) → Red (> 10 min) |

| **Bump screen** | Tap item to mark as ready; tap order to bump entire order |

| **Timer tracking** | Per-item and per-order elapsed time |

| **Multi-screen support** | Different stations can display only their relevant items |

| **Offline resilience** | Queues new orders locally during network interruption |

| **Audio alerts** | Sound on new order arrival |

 

#### Database Schema

 

```sql

CREATE TABLE kds_stations (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(100) NOT NULL,          -- "Grill", "Fryer", "Cold Station"

    device_id UUID REFERENCES device_registrations(id),

    assigned_category_ids JSONB,         -- Categories routed here

    display_order INT DEFAULT 0,

    status ENUM ('active', 'inactive') DEFAULT 'active'

);

 

CREATE TABLE kds_order_items (

    id UUID PRIMARY KEY,

    order_item_id UUID NOT NULL REFERENCES order_items(id),

    station_id UUID NOT NULL REFERENCES kds_stations(id),

    received_at TIMESTAMP DEFAULT NOW(),

    started_at TIMESTAMP,

    ready_at TIMESTAMP,

    bumped_at TIMESTAMP,

    status ENUM ('waiting', 'in_progress', 'ready', 'bumped') DEFAULT 'waiting',

    prep_time_seconds INT,               -- Actual time taken

    target_seconds INT                   -- SLA target

);

```

 

#### KDS Events (WebSocket)

 

```

kds.order_received    → New order arrives on screen

kds.item_started      → Cook taps item to start prep

kds.item_ready        → Item marked ready

kds.order_bumped      → Full order sent to assembly

kds.timer_alert       → Order exceeded target time

kds.order_recalled    → Recalled from bump history

```

 

---

 

### 17.9 Customer Display System (CDS)

 

A customer-facing screen mounted at the POS terminal showing the live order summary, pricing, and promotional messages.

 

#### CDS Layout

 

```

┌──────────────────────────────────────────┐

│         THE BURGER LAB                   │

│  ─────────────────────────────────────── │

│  YOUR ORDER                              │

│                                          │

│  Classic Burger           AED  45.00     │

│  French Fries             AED  18.00     │

│  Coke (Large)             AED  12.00     │

│  ─────────────────────────────────────── │

│  Subtotal                 AED  75.00     │

│  Discount (WELCOME20)    -AED  15.00     │

│  VAT (5%)                 AED   3.00     │

│  ─────────────────────────────────────── │

│  TOTAL                    AED  63.00     │

│                                          │

│  ┌──────────────────────────────────┐   │

│  │  🔥 Try our NEW Cheesy Fries!    │   │

│  └──────────────────────────────────┘   │

└──────────────────────────────────────────┘

```

 

#### CDS Features

 

| Feature | Description |

|---|---|

| **Live cart mirror** | Shows cart items in real-time as cashier adds them |

| **Promotional banners** | Rotating promotional content between orders |

| **Loyalty points** | Shows earned/redeemed points for loyalty customers |

| **Payment prompt** | Shows "Please tap card" during payment stage |

| **Thank you screen** | Confirmation screen + receipt options post-payment |

| **Idle advertising** | Video/image slideshow when no active transaction |

| **QR code loyalty** | QR to sign up for loyalty program |

 

#### CDS Architecture

 

```

POS Terminal (Cashier App)

    │ Cart update events

    ▼

Notification Service

    │ WebSocket: customer_display:{device_id}

    ▼

CDS Application (React PWA)

    ├─ Receives cart_updated events

    ├─ Shows promotional banners via config

    ├─ Renders payment stage from payment_initiated event

    └─ Shows thank_you from payment_completed event

```

 

#### CDS WebSocket Events

 

```

cart.updated           → Refresh cart display

cart.discount_applied  → Show discount line

payment.initiated      → Show "Tap your card" screen

payment.completed      → Show thank you + points earned

loyalty.points_earned  → Animate points badge

cds.promo_updated      → New promo banner from manager

```

 

---

 

### 17.10 Inventory Management (Full Module)

 

Extends the basic schema from §4.1 with full warehouse operations, supplier management, purchase orders, and waste tracking.

 

#### Inventory Features

 

| Feature | Description |

|---|---|

| **Stock counting** | Scheduled count sheets, variance reports |

| **Purchase orders** | Create PO → Receive items → Auto-update stock |

| **Supplier management** | Supplier catalog, contact, lead times |

| **Multi-location stock** | Track across kitchen, store room, bar |

| **Expiry tracking** | FIFO / FEFO rotation with expiry alerts |

| **Waste logging** | Log waste with reason codes |

| **Recipe costing** | Auto-calculate COGS per item sold |

| **Reorder automation** | Auto-create draft PO when stock hits reorder level |

 

#### Extended Database Schema

 

```sql

CREATE TABLE suppliers (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    contact_name VARCHAR(255),

    contact_phone VARCHAR(50),

    contact_email VARCHAR(255),

    payment_terms VARCHAR(100),         -- "Net 30"

    lead_time_days INT DEFAULT 3,

    status ENUM ('active', 'inactive') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE purchase_orders (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    supplier_id UUID NOT NULL REFERENCES suppliers(id),

    po_number VARCHAR(50) UNIQUE,

    status ENUM ('draft', 'sent', 'partial', 'received', 'cancelled') DEFAULT 'draft',

    expected_delivery DATE,

    notes TEXT,

    total_cost DECIMAL(12,2),

    created_by UUID,

    created_at TIMESTAMP DEFAULT NOW(),

    received_at TIMESTAMP

);

 

CREATE TABLE purchase_order_items (

    id UUID PRIMARY KEY,

    po_id UUID NOT NULL REFERENCES purchase_orders(id),

    product_id UUID NOT NULL REFERENCES products(id),

    ordered_qty DECIMAL(10,3) NOT NULL,

    received_qty DECIMAL(10,3) DEFAULT 0,

    unit_cost DECIMAL(10,4),

    total_cost DECIMAL(12,2)

);

 

CREATE TABLE stock_locations (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    name VARCHAR(100) NOT NULL,          -- "Main Kitchen", "Cold Storage"

    type ENUM ('kitchen', 'storeroom', 'bar', 'walk-in') DEFAULT 'kitchen'

);

 

CREATE TABLE inventory_by_location (

    id UUID PRIMARY KEY,

    product_id UUID NOT NULL REFERENCES products(id),

    location_id UUID NOT NULL REFERENCES stock_locations(id),

    current_qty DECIMAL(10,3) DEFAULT 0,

    expiry_date DATE,

    batch_number VARCHAR(100),

    UNIQUE (product_id, location_id, batch_number)

);

 

CREATE TABLE waste_logs (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    product_id UUID NOT NULL REFERENCES products(id),

    quantity DECIMAL(10,3) NOT NULL,

    reason_code ENUM ('expired', 'damaged', 'overproduction', 'spillage', 'other'),

    cost_impact DECIMAL(10,2),

    notes TEXT,

    logged_by UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

```

 

---

 

### 17.11 Accounting & HR Module

 

Handles basic financial records and employee management integrated with the POS.

 

#### 17.11.1 Accounting

 

**Scope:** Basic double-entry bookkeeping, journal entries from POS transactions, VAT reporting, and integration with external accounting platforms.

 

```sql

CREATE TABLE accounts (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    code VARCHAR(20) NOT NULL,

    name VARCHAR(255) NOT NULL,

    account_type ENUM ('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,

    parent_id UUID REFERENCES accounts(id),

    is_system BOOLEAN DEFAULT FALSE,    -- Protected system account

    UNIQUE (store_id, code)

);

 

-- Pre-created system accounts (auto-created on store setup):

-- 1000 - Cash

-- 1001 - Card Receivable

-- 2000 - VAT Payable

-- 4000 - Sales Revenue

-- 4001 - Delivery Revenue

-- 5000 - Cost of Goods Sold

-- 5100 - Waste Expense

-- 6000 - Commission Expense (aggregators)

 

CREATE TABLE journal_entries (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    reference_type VARCHAR(50),         -- 'order', 'refund', 'adjustment'

    reference_id UUID,

    description TEXT,

    entry_date DATE NOT NULL,

    created_by UUID,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE journal_lines (

    id UUID PRIMARY KEY,

    journal_id UUID NOT NULL REFERENCES journal_entries(id),

    account_id UUID NOT NULL REFERENCES accounts(id),

    debit DECIMAL(12,2) DEFAULT 0,

    credit DECIMAL(12,2) DEFAULT 0,

    description VARCHAR(255)

);

 

-- Auto-journal on payment.processed:

--   DR  Cash / Card Receivable     75.00

--   CR  Sales Revenue              71.43

--   CR  VAT Payable                 3.57

 

-- Auto-journal on aggregator.order_received:

--   DR  Cash                       85.00

--   CR  Sales Revenue              80.95

--   CR  VAT Payable                 4.05

--   DR  Commission Expense         12.75

--   CR  Cash                       12.75

```

 

#### Accounting Features

 

| Feature | Description |

|---|---|

| **Auto-journaling** | Journal entries created automatically on every sale, refund, and adjustment |

| **VAT report** | UAE 5% VAT summary report for FTA filing |

| **P&L Statement** | Revenue vs expenses by period |

| **Cash flow** | Daily cash reconciliation (expected vs counted) |

| **External sync** | Export to QuickBooks, Xero, Zoho Books via API |

 

---

 

#### 17.11.2 HR Module

 

Employee management covering scheduling, clock-in/out, payroll data, and performance.

 

```sql

CREATE TABLE employees (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    user_id UUID REFERENCES users(id),

    employee_code VARCHAR(50) UNIQUE,

    full_name VARCHAR(255) NOT NULL,

    role VARCHAR(100),

    employment_type ENUM ('full_time', 'part_time', 'contract') DEFAULT 'full_time',

    hourly_rate DECIMAL(10,2),

    monthly_salary DECIMAL(10,2),

    hire_date DATE,

    status ENUM ('active', 'inactive', 'on_leave') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE shifts (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    employee_id UUID NOT NULL REFERENCES employees(id),

    scheduled_start TIMESTAMP NOT NULL,

    scheduled_end TIMESTAMP NOT NULL,

    actual_start TIMESTAMP,

    actual_end TIMESTAMP,

    status ENUM ('scheduled', 'active', 'completed', 'missed') DEFAULT 'scheduled',

    break_minutes INT DEFAULT 0,

    notes TEXT

);

 

CREATE TABLE clock_events (

    id UUID PRIMARY KEY,

    employee_id UUID NOT NULL REFERENCES employees(id),

    shift_id UUID REFERENCES shifts(id),

    event_type ENUM ('clock_in', 'clock_out', 'break_start', 'break_end') NOT NULL,

    device_id UUID,

    pin_verified BOOLEAN DEFAULT FALSE,

    timestamp TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE payroll_periods (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    period_start DATE NOT NULL,

    period_end DATE NOT NULL,

    status ENUM ('draft', 'approved', 'paid') DEFAULT 'draft',

    total_payroll DECIMAL(12,2),

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE payroll_lines (

    id UUID PRIMARY KEY,

    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),

    employee_id UUID NOT NULL REFERENCES employees(id),

    regular_hours DECIMAL(6,2),

    overtime_hours DECIMAL(6,2),

    gross_pay DECIMAL(10,2),

    deductions DECIMAL(10,2),

    net_pay DECIMAL(10,2)

);

```

 

#### HR Features

 

| Feature | Description |

|---|---|

| **Shift scheduling** | Weekly schedule builder, drag-and-drop |

| **Clock-in / Clock-out** | PIN-based via any POS terminal |

| **Timesheet** | Auto-calculated from clock events |

| **Performance reports** | Orders per hour, avg handle time per cashier |

| **Payroll export** | Export payroll data to CSV/PDF for WPS (UAE) compliance |

| **Leave management** | Leave requests, approval workflow |

 

#### HR APIs

 

```

GET  /api/v1/employees                     → List employees

POST /api/v1/employees                     → Create employee

GET  /api/v1/shifts?week=2026-W25          → Weekly schedule

POST /api/v1/shifts                        → Create shift

POST /api/v1/clock/in                      → Clock in via PIN

POST /api/v1/clock/out                     → Clock out

GET  /api/v1/payroll/{period_id}           → Payroll summary

POST /api/v1/payroll/{period_id}/approve   → Approve payroll

```

 

---

 

### 17.12 Notifier Service

 

Centralized notification service delivering alerts and messages across multiple channels — push, email, SMS, and WhatsApp.

 

#### Notification Channels

 

| Channel | Use Cases | Provider |

|---|---|---|

| **Push Notification** | Order ready, stock alert, device offline | Firebase FCM |

| **Email** | Daily reports, receipts, coupon codes | SendGrid / SES |

| **SMS** | Order confirmation, OTP, payment receipt | Twilio / Unifonic |

| **WhatsApp** | Order confirmation, delivery tracking, loyalty | WhatsApp Business API |

| **In-App (WebSocket)** | Live order updates, KDS alerts, manager alerts | Socket.io |

| **Webhook** | Custom integrations, 3rd-party triggers | Custom HTTP |

 

#### Notifier Architecture

 

```

Event Bus (Kafka)

    │  (notification.send events from all services)

    ▼

┌─────────────────────────────────────────────────────┐

│  Notifier Service (Port: 3007)                      │

│                                                     │

│  ┌──────────────────────────────────────────────┐  │

│  │  Notification Router                         │  │

│  │  ├─ Determine channels from preference       │  │

│  │  ├─ Template rendering (Handlebars)          │  │

│  │  ├─ Deduplication (Redis: 5-min window)      │  │

│  │  └─ Rate limiting per recipient              │  │

│  └──────────────────────────────────────────────┘  │

│         │         │         │         │             │

│    ┌────▼──┐ ┌───▼──┐ ┌───▼──┐ ┌────▼──┐          │

│    │  FCM  │ │Email │ │ SMS  │ │  WA   │           │

│    │Channel│ │Channel│ │Channel│ │Channel│          │

│    └───────┘ └───────┘ └───────┘ └───────┘          │

└─────────────────────────────────────────────────────┘

```

 

#### Database Schema

 

```sql

CREATE TABLE notification_templates (

    id UUID PRIMARY KEY,

    store_id UUID,                       -- NULL = system template

    event_type VARCHAR(100) NOT NULL,    -- e.g. 'order.ready'

    channel VARCHAR(50) NOT NULL,        -- 'push', 'email', 'sms', 'whatsapp'

    subject VARCHAR(255),

    body_template TEXT NOT NULL,         -- Handlebars template

    is_active BOOLEAN DEFAULT TRUE,

    language VARCHAR(10) DEFAULT 'en',

    UNIQUE (store_id, event_type, channel, language)

);

 

CREATE TABLE notification_logs (

    id UUID PRIMARY KEY,

    store_id UUID,

    recipient_type ENUM ('customer', 'employee', 'device', 'manager'),

    recipient_id UUID,

    event_type VARCHAR(100),

    channel VARCHAR(50),

    status ENUM ('queued', 'sent', 'delivered', 'failed') DEFAULT 'queued',

    payload JSONB,

    error_message TEXT,

    sent_at TIMESTAMP,

    delivered_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()

);

 

CREATE TABLE notification_preferences (

    id UUID PRIMARY KEY,

    recipient_type VARCHAR(50),

    recipient_id UUID NOT NULL,

    event_type VARCHAR(100) NOT NULL,

    channel VARCHAR(50) NOT NULL,

    is_enabled BOOLEAN DEFAULT TRUE,

    UNIQUE (recipient_id, event_type, channel)

);

```

 

#### Notification Event Catalog

 

| Event | Recipients | Channels | Trigger |

|---|---|---|---|

| `order.ready` | Customer | Push, WhatsApp | Order marked ready |

| `order.confirmed` | Customer | Email, SMS | Order placed online |

| `payment.receipt` | Customer | Email, WhatsApp | Payment successful |

| `stock.low_alert` | Manager | Push, Email | Stock < threshold |

| `stock.out_of_stock` | Manager | Push, SMS | Stock = 0 |

| `device.offline` | Manager | Push | Device disconnected > 5 min |

| `coupon.issued` | Customer | Email, WhatsApp | Coupon generated |

| `loyalty.points_earned` | Customer | Push | Points awarded |

| `daily.report` | Manager | Email | Auto-scheduled daily |

| `shift.reminder` | Employee | Push, SMS | 1 hour before shift |

| `payroll.approved` | Employee | Email | Payroll approved |

 

#### Notifier APIs

 

```

POST /api/v1/notifications/send        → Send immediate notification

     Body: { event_type, recipient_id, data, channels }

 

GET  /api/v1/notifications/logs        → Delivery log for audit

GET  /api/v1/notifications/templates   → Manage templates

POST /api/v1/notifications/templates   → Create/update template

 

POST /api/v1/notifications/preferences → Update recipient preferences

```

 

---

 

### 17.13 Feature Module Summary

 

| Module | Section | Status | Service | Port |

|---|---|---|---|---|

| Basic Marketplace | §17.1 | Defined | `marketplace-svc` | 3010 |

| Menu Management | §17.2 | Defined | `menu-svc` | 3005 |

| Customer Model | §17.3 | Defined | `customer-svc` | 3011 |

| Timed Events | §17.4 | Defined | `scheduler-svc` | 3012 |

| Coupons | §17.5.1 | Defined | `promotions-svc` | 3013 |

| Promotions | §17.5.2 | Defined | `promotions-svc` | 3013 |

| Dashboards | §17.6 | Defined | `reporting-svc` | 3008 |

| Reporting | §17.7 | Defined | `reporting-svc` | 3008 |

| KDS | §17.8 | Defined | `notification-svc` | 3007 |

| Customer Display | §17.9 | Defined | `notification-svc` | 3007 |

| Inventory (Full) | §17.10 | Defined | `inventory-svc` | 3002 |

| Accounting | §17.11.1 | Defined | `accounting-svc` | 3014 |

| HR | §17.11.2 | Defined | `hr-svc` | 3015 |

| Notifier | §17.12 | Defined | `notification-svc` | 3007 |

 

---

 

## 18. Appendix

 

### 18.1 Technology Choices Justification

 

---

 

#### 18.1.1 Database: PostgreSQL (NOT MongoDB)

 

**Decision: PostgreSQL for all transactional data**

 

| Criterion | PostgreSQL | MongoDB | Why POS Needs PostgreSQL |

|---|---|---|---|

| **ACID Transactions** | ✅ Full ACID | ⚠️ Multi-doc (limited) | **Critical:** "Add order + Deduct inventory" MUST be atomic. Partial failure = overselling the last burger twice. |

| **Consistency Model** | Strong consistency | Eventual consistency | Payments & financial records cannot be eventually consistent. |

| **Inventory Locking** | Row-level pessimistic locks | No native locking | Stock reservation requires row locks to prevent race conditions. |

| **Relational Data** | Native JOINs (fast) | No JOINs (slow) | Orders → Items → Products → Inventory are deeply relational. Aggregating without JOINs is expensive at scale. |

| **Complex Aggregations** | Excellent (GROUP BY, Window Fn) | Slow on large datasets | VAT reports, P&L, sales by hour require complex GROUP BY + window functions. |

| **Schema Enforcement** | Strict (enforced) | Schema-less (risky) | POS data has fixed well-known shape. Schema-less adds silent data corruption risk. |

| **Audit Trails** | Triggers + triggers (easy) | Manual implementation | Every stock change, discount, void needs audit logs. PostgreSQL triggers automate this. |

| **CQRS / Event Sourcing** | Can replay writes | Possible but complex | PostgreSQL WAL (Write-Ahead Log) makes CQRS straightforward. |

 

**Where MongoDB might fit (hybrid approach):**

```

Use MongoDB for:

├─ Notification logs            → High write, schema varies per type

├─ Customer activity feed       → Timeline, nested documents

├─ Audit event store (append)   → Immutable, flexible payload

└─ Menu CMS content             → Rich, nested modifiers

 

NOT for (PostgreSQL only):

├─ Orders                       → ACID required

├─ Payments                     → PCI-DSS audit trail

├─ Inventory                    → Row locking + strong consistency

├─ Accounting journals          → Double-entry must balance exactly

└─ Customer loyalty points      → Cannot lose points due to eventual consistency

```

 

**Conclusion:** A POS system's core data is **transactional, not document-heavy**. PostgreSQL is the right choice. A NoSQL store can supplement for logs/analytics, but the operational heartbeat must be PostgreSQL.

 

---

 

#### 18.1.2 Frontend: Next.js + React Split (NOT monolithic React)

 

**Original HLD error:** Listed "React" everywhere. **Corrected decision: Split based on SEO need.**

 

```

┌──────────────────────────────────────────────────────────────┐

│  FRONTEND ARCHITECTURE CORRECTED                            │

├──────────────────────────────────────────────────────────────┤

│                                                              │

│  1. PUBLIC MARKETPLACE (SEO-critical)                       │

│     Technology: Next.js (React + SSR/SSG)                   │

│     Rationale:                                              │

│     • Menu pages indexed by Google                          │

│     • Faster First Contentful Paint (FCP)                   │

│     • Built-in image optimization (next/image)             │

│     • Auto API routes for cart/checkout                     │

│     • Incremental Static Regeneration (ISR)                │

│                                                              │

│  2. INTERNAL OPERATIONS (Offline-first PWA)                 │

│     Technology: React SPA (Vite) + Service Worker           │

│     Apps: POS Terminal, KDS, Manager Dashboard              │

│     Rationale:                                              │

│     • Offline-first PWA (works without internet)            │

│     • No SSR needed (internal-only, no Google crawl)        │

│     • Faster hot reload (Vite > Next.js for SPA)           │

│     • Lighter bundle (no SSR framework overhead)            │

│     • Service Worker full control for cache strategy       │

│                                                              │

│  3. MOBILE APP                                              │

│     Technology: React Native (iOS/Android)                  │

│     Rationale:                                              │

│     • Waiter app, delivery tracking                         │

│     • Code sharing with React web (components)             │

│     • Vibration alerts, camera access (native)             │

│                                                              │

└──────────────────────────────────────────────────────────────┘

```

 

| Tech | Use Case | SEO | Offline | Bundle | DevEx |

|---|---|---|---|---|---|

| **Next.js** | Public marketplace | ✅ Excellent | ⚠️ Complex | ~200KB | ✅ Great |

| **React SPA** | Internal POS/KDS | ❌ None | ✅ Full PWA | ~80KB | ✅✅ Excellent |

| **React Native** | Mobile waiter app | N/A | ⚠️ Partial | Platform | ✅ Good |

 

**Why this split works:**

 

1. **Marketplace (Next.js):**

   - Customers search "burger delivery near me" → finds your menu on Google

   - Server renders menu HTML → instant page load

   - Images auto-optimized for mobile

   - Converts to PWA for checkout (best of both)

 

2. **POS Terminal (React SPA):**

   - Never needs Google indexing

   - Must work offline (network interruption is common in restaurants)

   - Needs rapid dev cycle (hot reload > rebuild)

   - Service Worker full control over offline strategy

 

3. **Mobile Waiter App (React Native):**

   - Tablet at table → place order

   - Camera to scan QR codes

   - Vibration alerts for table calls

   - One codebase → iOS + Android

 

---

 

#### 18.1.3 Backend: Node.js (TypeScript)

 

| Choice | Reason |

|---|---|

| **Node.js** | Async I/O handles 1000s concurrent WebSocket connections efficiently. JavaScript across stack (frontend + backend) = shared validation logic. Large ecosystem (Express, Fastify, Socket.io). |

| **Alternative rejected: Go** | Compile step slows local dev. More verbose. Loss of code reuse with frontend. |

| **Alternative rejected: Python** | Slower at concurrency. Overkill for POS API layer. |

| **TypeScript** | Type safety prevents runtime errors in payment/inventory logic. Auto-generated API docs (Swagger from types). |

 

---

 

#### 18.1.4 Message Queue: Kafka (NOT RabbitMQ)

 

| Criterion | Kafka | RabbitMQ |

|---|---|---|

| **Throughput** | 1M+ events/sec | 1M events/sec |

| **Event replay** | ✅ Full log retained | ❌ Messages deleted after consume |

| **Ordering guarantee** | Per partition | Per queue |

| **Use case** | Event sourcing, audit trail | Task queues |

 

**For POS:** Kafka is better because:

- Every order, payment, inventory change = an **event** that must be auditable

- Regulatory (UAE) may require 7-year audit trail of all transactions

- Replay events to rebuild state if needed

- Analytics (ClickHouse) needs full history

 

RabbitMQ is fine for "send this notification" (fire-and-forget), but Kafka is essential for "record this payment forever."

 

---

 

#### 18.1.5 Cache: Redis (NOT Memcached)

 

| Feature | Redis | Memcached |

|---|---|---|

| **Data types** | Strings, Hashes, Sets, Sorted Sets, Streams | Strings only |

| **Persistence** | AOF, RDB snapshots | None |

| **Expiry** | TTL per key | TTL per key |

| **Pub/Sub** | ✅ Built-in | ❌ No |

| **Cluster** | ✅ Redis Cluster | Basic replication |

 

**For POS:** Redis Pub/Sub powers:

- Menu updates → all POS terminals notified instantly

- Stock changes → all terminals see new available stock

- Timed events → "Happy hour started" pushed to all devices

 

Memcached is fine for dumb cache (menu at 15:00), but Redis is essential for pub/sub architecture.

 

---

 

#### 18.1.6 Message Format: JSON (REST) + GraphQL (optional)

 

**Decision: REST APIs as primary, GraphQL optional for dashboard/reporting**

 

| Format | Use Case | Reason |

|---|---|---|

| **REST (JSON)** | All POS APIs, Mobile, Marketplace | Simplicity, universally understood, easy to cache with ETags |

| **GraphQL** | Dashboard, Reporting, Analytics | Exact field fetching (no over-fetch), nested data, fewer API calls |

| **WebSocket** | Real-time (KDS, orders, stock) | Bidirectional, push notifications |

 

POS terminals don't need GraphQL complexity — REST is simpler and faster to develop.

 

---

 

#### 18.1.7 Container Orchestration: Kubernetes (EKS/AKS)

 

| Feature | Kubernetes | Docker Compose | VM + manual |

|---|---|---|---|

| **Multi-region** | Built-in | Manual | Manual |

| **Auto-scaling** | Pod-level autoscaling | Manual | Manual |

| **Load balancing** | Service mesh | Manual | Manual |

| **Rolling updates** | Zero downtime | Downtime | Downtime |

| **Monitoring** | Prometheus native | DIY | DIY |

 

**For growth:** Start with Docker Compose (Phase 1), migrate to Kubernetes at Phase 2 (multi-device support). K8s is overkill for a single POS until you scale to 10+ locations.

 

---

 

#### 18.1.8 Storage: S3 (for backups, images, reports)

 

**Why S3 and not NFS / local disk:**

- Durability: 99.999999999% (11 nines)

- Versioning: Automatic rollback on accidental delete

- Lifecycle: Auto-archive old backups to Glacier (cheap)

- Cross-region replication: DR-ready

- Cost-effective at scale

 

---

 

### 18.2 Risk Mitigation

 

| Risk | Impact | Mitigation |

|---|---|---|

| Single point of failure | Service down | Multi-region, auto-failover |

| Data loss | Business critical | RAID-10, replicated backups, Kafka log retention |

| Payment fraud | Financial loss | PCI-DSS, payment tokenization, rate limiting |

| Inventory inconsistency | Overselling | Row-level locks (PostgreSQL), pessimistic locking |

| Network partition | Split-brain | Offline queue + idempotent APIs + CRDT merge |

| Performance degradation | User experience | Caching (Redis), CDN, auto-scaling, connection pooling |

| Supply chain attack | Compromised deps | Npm audit, SBOM, pinned versions, container scanning |

 

---

 

### 18.3 Cost Estimates

 

```

Monthly Costs (Rough, production setup):

 

Compute:

├─ EKS Cluster (10 nodes × t3.xlarge): $2,000

├─ RDS PostgreSQL (multi-AZ, db.r5.2xlarge): $1,500

├─ ElastiCache Redis Cluster (3 shards): $400

├─ Kafka (MSK, 3 brokers): $800

└─ Lambda (serverless webhooks): $50

 

Storage & Databases:

├─ S3 (backups, images, reports): $300

├─ Glacier archival: $100

├─ ClickHouse (analytics): $500

└─ RDS automated backups (included): -

 

Network & CDN:

├─ CloudFront CDN (menu, images): $200

├─ Data transfer (inter-region): $300

└─ VPN/Direct Connect (optional): -

 

Monitoring & Ops:

├─ DataDog (logs + metrics): $400

├─ PagerDuty (on-call): $200

├─ HashiCorp Vault (secrets): $300

└─ GitHub Enterprise (private repos): $300

 

Payments & 3rd-party:

├─ Stripe (2.2% + $0.30): $2,500 (assuming $100K revenue/month)

├─ Twilio SMS (notifications): $50

├─ SendGrid (transactional email): $50

└─ Mapbox (order tracking maps): $100

 

Support:

├─ AWS Support (Business): $500

└─ Security audit & compliance: $400

 

────────────────────────────────

TOTAL (Enterprise): ~$10,000/month

 

STARTUP (Phase 1, single location):

├─ RDS Micro ($50/month)

├─ Single EC2 instance ($100/month)

├─ Redis (shared tier, $15/month)

├─ S3 + CloudFront ($50/month)

├─ Stripe fees ($500/month on $20K revenue)

└─ Total: ~$700/month → grow to $10K at scale

────────────────────────────────

```

 

### 16.2 Risk Mitigation

 

| Risk | Impact | Mitigation |

|---|---|---|

| Single point of failure | Service down | Multi-region, auto-failover |

| Data loss | Business critical | RAID-10, replicated backups |

| Payment fraud | Financial loss | PCI-DSS, payment tokenization |

| Network partition | Inconsistent state | Offline queue, eventual consistency |

| Performance degradation | User experience | Caching, CDN, auto-scaling |

 

### 16.3 Cost Estimates

 

```

Monthly Costs (Rough):

 

Compute:

├─ EKS Cluster (10 nodes × t3.xlarge): $2,000

├─ RDS PostgreSQL (multi-AZ): $1,500

├─ ElastiCache Redis: $400

└─ Kafka (MSK): $800

 

Network & Storage:

├─ Data transfer: $300

├─ S3 backups: $100

└─ CloudFront CDN: $200

 

Monitoring & Support:

├─ DataDog/New Relic: $400

├─ HashiCorp Vault: $300

└─ Support: $500

 

Total: ~$6,500/month (scales with usage)

```

 

---

 

---

 

## 19. QuantiSrv — AI-Powered Restaurant Operations Cloud

 

> **Vision:** QuantiSrv is not just a POS. It is a platform that runs restaurant operations end-to-end — manages customers, automates marketing, predicts revenue, optimises delivery platforms, and provides AI-native insights to every layer of the business.

 

---

 

### 19.1 Platform Overview

 

```

┌─────────────────────────────────────────────────────────────────────────┐

│                    QuantiSrv Platform Layer                             │

├──────────────┬──────────────┬────────────────┬──────────────────────────┤

│  POS Service │  CRM Service │Analytics Service│ Marketing Automation    │

│              │              │                 │   + Campaign Engine      │

├──────────────┴──────────────┴────────────────┴──────────────────────────┤

│                         AI / Intelligence Layer                         │

├─────────────────────────────────────────────────────────────────────────┤

│  API Gateway (Auth · Rate Limiting · Routing · CORS)                    │

├──────────────────────┬──────────────────────────────────────────────────┤

│  PostgreSQL (OLTP)   │  Firebase Queue / Kafka (Events)                 │

│  ClickHouse (OLAP)   │  Firestore / Redis (NoSQL Cache)                 │

└──────────────────────┴──────────────────────────────────────────────────┘

```

 

**Platform Pillars:**

 

| Pillar | Description |

|---|---|

| POS Core | Orders, billing, refunds, discounts, tax, multi-branch, kitchen printing |

| CRM Engine | Customer lifecycle tracking, retention scoring, churn prediction |

| Marketing Automation | Triggered campaigns, segmentation, multi-channel delivery |

| AI Restaurant Manager | Natural language Q&A over all business data (WhatsApp-native) |

| Loyalty & Rewards | Points engine, tier management, redemption at POS |

| Revenue Intelligence | Aggregator contribution analytics, forecasting, ROI tracking |

 

---

 

### 19.2 POS Core Module (Finalised for HLD)

 

The POS module is the transactional heart of the platform. All other modules depend on the event stream it produces.

 

#### 19.2.1 Order Lifecycle

 

```

Customer Order

      │

      ▼

┌─────────────┐     ┌──────────────┐     ┌─────────────────┐

│  Item Entry │────▶│ Order Review │────▶│ Payment Process │

│  + Modifiers│     │ + Split Bills│     │ Cash/Card/Wallet │

└─────────────┘     └──────────────┘     └────────┬────────┘

                                                   │

                    ┌──────────────────────────────▼──────────┐

                    │            Order Events (Kafka)          │

                    │  order.created → order.paid → KDS print  │

                    └──────────────────────────────────────────┘

                                                   │

                    ┌─────────────────┬─────────────▼──────────┐

                    │  Kitchen Print  │  Inventory Deduction    │

                    │  (KDS / Printer)│  (stock.updated event)  │

                    └─────────────────┴────────────────────────┘

```

 

#### 19.2.2 POS Feature Set

 

| Feature | Detail |

|---|---|

| Orders | Dine-in, Takeaway, Delivery, Aggregator-injected |

| Billing | Split bills (by seat, by item, by percentage) |

| Refunds & Voids | Full / partial refund with reason audit trail |

| Discounts | Item-level, order-level, coupon codes, auto-apply rules |

| Tax | Multi-rate tax (VAT, service charge), per-item override |

| Multi-branch | Centralised menu, branch-level stock & pricing override |

| Kitchen Printing | Station routing — hot kitchen / cold kitchen / bar |

| Order Cycle Metric | Average time from order placement → fulfilment (tracked per day, per branch) |

| Revenue Probability | ML model: if customer re-orders within 14 days → high retention signal |

 

#### 19.2.3 Order Cycle & Revenue Probability Signal

 

```

Order Placed ──▶ Fulfilment Timer Started

                       │

               Order Completed

                       │

          ┌────────────▼────────────┐

          │   Re-order within       │

          │   14 days?              │

          │   YES → High Retention  │──▶ CRM: "Loyal" segment

          │   NO  → Churn Risk      │──▶ CRM: Trigger win-back campaign

          └─────────────────────────┘

```

 

---

 

### 19.3 CRM Engine

 

The CRM module tracks every customer's purchase lifecycle and computes retention scores in real-time.

 

#### 19.3.1 Customer Retention Model

 

```

Purchase Signal

      │

      ▼

┌─────────────────────────────────────────────────────┐

│  Retention Rule Engine                              │

│  • Purchase frequency: every N days                 │

│  • Last seen: days since last order                 │

│  • Order gap threshold: configurable (default 14d)  │

└───────────────────────┬─────────────────────────────┘

                        │

         ┌──────────────┼──────────────┐

         ▼              ▼              ▼

   Active (< 7d)  At-Risk (7-14d)  Churned (> 14d)

         │              │              │

    No action    Discount Offer   Win-Back Flow

                  Welcome Flow    (Email/WhatsApp)

```

 

#### 19.3.2 CRM Segments

 

| Segment | Criteria | Automated Action |

|---|---|---|

| New | First order | Welcome message + onboarding offer |

| Active | Order gap < 7 days | Loyalty points nudge |

| At-Risk | Order gap 7–14 days | Discount voucher or free item |

| Churned | Order gap > 14 days | Win-back campaign (3-touch sequence) |

| VIP | Top 10% by spend | Priority treatment, exclusive offers |

| Lapsed | No order > 30 days | Reactivation campaign |

 

---

 

### 19.4 Marketing Automation Engine

 

#### 19.4.1 Campaign Trigger Flow

 

```

Event Source

(order.paid / churn.detected / signup.completed)

      │

      ▼

┌─────────────────────────┐

│  Campaign Engine        │

│  Evaluate Trigger Rules │

└────────────┬────────────┘

             │ Match Found

             ▼

┌─────────────────────────┐     ┌────────────────────────┐

│  Template Renderer      │────▶│  Channel Router        │

│  (personalise message)  │     │  Push / SMS / WhatsApp │

└─────────────────────────┘     │  Email / In-App        │

                                 └────────────────────────┘

                                           │

                                           ▼

                                 ┌─────────────────────┐

                                 │  Delivery Tracker   │

                                 │  Sent / Opened /    │

                                 │  Clicked / Converted│

                                 └─────────────────────┘

```

 

#### 19.4.2 Automation Flows

 

| Flow | Trigger | Messages | Goal |

|---|---|---|---|

| Welcome Flow | New customer signup | Welcome message → onboarding tip → first-order discount | Activate |

| Retention Flow | 7-day order gap | "We miss you" + discount | Re-engage |

| Win-Back Flow | 14-day order gap | Discount → Free item → Last chance | Recover churned |

| Feedback Request | Order complete + 1 hour | Rating request → review link | Social proof |

| Loyalty Milestone | Points threshold crossed | "You've earned X reward" | Delight |

| Aggregator Upsell | Aggregator order detected | "Order direct, save 15%" | Channel shift |

 

---

 

### 19.5 AI Restaurant Manager (WhatsApp-Native Q&A)

 

The AI Restaurant Manager allows owners and managers to query all business data via natural language — primarily through WhatsApp, with a web fallback.

 

#### 19.5.1 Architecture

 

```

Manager (WhatsApp)

      │

      ▼

┌─────────────────────┐

│  WhatsApp Business  │

│  API Webhook        │

└────────┬────────────┘

         │

         ▼

┌─────────────────────┐

│  NLU Router         │

│  (intent detection) │

└────────┬────────────┘

         │

    ┌────┴────────────────────────────────┐

    │                                     │

    ▼                                     ▼

┌───────────┐                    ┌────────────────┐

│ Query     │                    │ Action         │

│ Engine    │                    │ Engine         │

│ (read DB) │                    │ (trigger flow) │

└───────────┘                    └────────────────┘

         │

         ▼

┌─────────────────────┐

│  Response Renderer  │

│  (plain text reply) │

└─────────────────────┘

```

 

#### 19.5.2 Example Manager Queries

 

| Query | Response Type |

|---|---|

| "What is my revenue today?" | Real-time aggregated revenue across channels |

| "How can I increase revenue?" | AI recommendation (top 3 actions ranked by predicted lift) |

| "Which items are selling the most?" | Top 5 items by quantity + revenue, current period |

| "Show me lapsed customers" | Count + segment breakdown, link to campaign |

| "What is my Deliveroo commission this month?" | Aggregator cost breakdown |

| "Which branch is underperforming?" | Branch comparison with variance flag |

 

---

 

### 19.6 Loyalty & Points Engine

 

#### 19.6.1 Points Accrual Rules

 

| Tier | Points per AED | Multiplier | Unlock Threshold |

|---|---|---|---|

| Silver | 1 pt / AED 10 | 1× | Default |

| Gold | 1 pt / AED 10 | 1.5× | 500 pts lifetime |

| Platinum | 1 pt / AED 10 | 2× | 2,000 pts lifetime |

 

#### 19.6.2 Redemption

 

- Points redeemable at POS checkout (1 pt = AED 0.05, configurable)

- Partial redemption supported

- Expiry: configurable per tenant (default: 12 months inactive)

 

#### 19.6.3 Points Engine Flow

 

```

Order Paid

    │

    ▼

Calculate Points Earned

(order total × multiplier by tier)

    │

    ▼

Write to loyalty_ledger table

(idempotent — keyed by order_id)

    │

    ▼

Publish loyalty.points_earned event

    │

    ▼

Notify Customer (push / WhatsApp)

```

 

---

 

### 19.7 Smart Delivery & Aggregator Intelligence

 

#### 19.7.1 Delivery Channel Filtering

 

```

Incoming Order

      │

      ├── Direct (POS / App / Web)

      │       └── Zero commission, full data ownership

      │

      ├── Deliveroo / Talabat / Noon Food / Careem

      │       └── Commission deducted, contribution tracked

      │

      └── Hunger Station / Other aggregators

              └── Net revenue = Gross − Commission − Ops cost

```

 

#### 19.7.2 AI Delivery Optimisation Questions

 

- "Which aggregator gives the best net margin per order?"

- "What is my direct vs aggregator revenue split this week?"

- "Should I run a promotion on Talabat this weekend?" → AI scores based on historical uplift

 

---

 

### 19.8 AI Product Intelligence

 

Tracks item-level performance and drives automated menu optimisation.

 

| Signal | Action |

|---|---|

| Item not ordered for 7+ days | Flag for menu review |

| Item with 90%+ repeat rate | Promote as "best seller" |

| High modifier attach rate | Suggest default modifier |

| Low margin item in top 10 | Alert owner: pricing review |

| Seasonal demand spike detected | Auto-increase stock threshold |

 

---

 

### 19.9 Customer Intelligence Dashboard

 

**For managers — available in web dashboard and via AI Q&A:**

 

```

┌──────────────────────────────────────────────────────────┐

│  Customer Intelligence Panel                             │

├─────────────────────┬────────────────────────────────────┤

│  Metric             │  Value (live)                      │

├─────────────────────┼────────────────────────────────────┤

│  Total Customers    │  12,450                            │

│  Active (< 7d)      │  3,200  (25.7%)                    │

│  At-Risk (7-14d)    │  1,800  (14.5%)                    │

│  Churned (> 14d)    │  7,450  (59.8%)                    │

│  Avg Order Value    │  AED 87.50                         │

│  Retention Rate     │  42%                               │

│  VIP Customers      │  245                               │

│  Campaign ROI       │  3.2× (last 30 days)               │

└─────────────────────┴────────────────────────────────────┘

```

 

---

 

### 19.10 Competitive Positioning

 

| Dimension | Foodics | Oracle | QuantiSrv | Revenue Growth |

|---|---|---|---|---|

| POS Operations | Yes | Yes | Yes | Baseline |

| CRM + Retention | Basic | No | Yes | +15–30% |

| Marketing Automation | No | No | Yes | +10–20% |

| AI Q&A (WhatsApp) | No | No | Yes | Differentiator |

| Aggregator Intelligence | No | No | Yes | Cost recovery |

| Predictive Revenue | No | No | Yes | +5–15% |

 

---

 

### 19.11 Go-To-Market Advantage

 

1. **Wholesale Data Advantage** — every POS transaction feeds the AI model; competitors cannot replicate without data

2. **WhatsApp-First** — restaurant owners in the region live in WhatsApp; zero app install friction

3. **Predict Revenue** — demonstrate ROI before sale; show prospects what retention automation will recover

4. **Dynamic Offers** — auto-personalised discounts tied to customer tier, last visit, and margin headroom

5. **Automated Reporting** — AI-generated weekly digest delivered to owner WhatsApp every Monday 8 AM

 

---

 

**Document Approval:**

- [ ] Architecture Lead

- [ ] Security Review

- [ ] Infrastructure Team

- [ ] Product Manager

 

**Version History:**

| Version | Date | Changes |

|---|---|---|

| 1.0 | 2026-06-16 | Initial HLD document |

| 1.1 | 2026-06-16 | Added §16 Aggregator Revenue Dashboard; §17 Feature Modules (Marketplace, Menu, Customer, Timed Events, Coupons, Promotions, Dashboards, Reporting, KDS, CDS, Inventory, Accounting, HR, Notifier) |

| 1.2 | 2026-06-16 | **CRITICAL CORRECTIONS:** §18.1 Technology Choices — Corrected Frontend to Next.js (marketplace SSR/SSG) + React SPA (POS/KDS/Dashboard offline PWA); Corrected DB choice: PostgreSQL (ACID + strong consistency) NOT MongoDB; detailed justification for each tech stack choice; updated cost estimates |

| 1.3 | 2026-06-17 | Added §19 QuantiSrv AI-Powered Restaurant Operations Cloud — POS finalised specs (order cycle, revenue probability, split bills, multi-branch), CRM retention model, Marketing Automation flows, AI Restaurant Manager (WhatsApp Q&A), Loyalty & Points Engine, Smart Delivery & Aggregator Intelligence, AI Product Intelligence, Customer Intelligence Dashboard, Competitive Positioning, Go-To-Market Advantage |

 

 

From: Sanjana Sagar (Technology)
Sent: Sunday, July 6, 2025 7:59 PM
To: 123sanjanasagar@gmail.com
Subject:

 

 

DISCLAIMER: This e-mail message including any of its attachments is intended solely for the addressee(s) and may contain privileged information. If you are not the addressee or you have received this email message in error, please notify the sender who will remove your details from its database. You are not authorized to read, copy, disseminate, distribute or use this e-mail message or any attachment to it in any manner and must delete the email and destroy any hard copies of it. This e-mail message does not contain financial instructions or commitments of any kind. Any views expressed in this message are those of the individual sender and do not necessarily reflect the views of Emirates NBD PJSC, or any other related subsidiaries, entities or persons.

Emirates NBD Bank (P.J.S.C.) is licensed by the Central Bank of the UAE.
.بنك الإمارات دبي الوطني ش.م.ع. هو بنك مرخّص من قبل مصرف الإمارات العربية المتحدة المركزي