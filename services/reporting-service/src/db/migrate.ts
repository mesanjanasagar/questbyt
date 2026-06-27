import { Pool } from 'pg';

import { config } from '../config';



const db = new Pool({ connectionString: config.REPORTING_DB_URL });



// The reporting DB is a denormalised read-model.

// Events from order-service and payment-service are ingested here.

// All queries are fast aggregations — no joins to operational DBs.



const migrations = `

-- ─────────────────────────────────────────────

-- Denormalised order fact table (one row per order)

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_orders (

    id UUID PRIMARY KEY,

    store_id UUID NOT NULL,

    customer_id UUID,

    cashier_id UUID NOT NULL,

    order_type VARCHAR(50) NOT NULL,

    platform VARCHAR(50) NOT NULL DEFAULT 'direct',

    status VARCHAR(50) NOT NULL,

    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    net_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,

    item_count INT NOT NULL DEFAULT 0,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL

);

 

CREATE INDEX IF NOT EXISTS idx_rorders_store_date ON report_orders(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rorders_platform ON report_orders(store_id, platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rorders_customer ON report_orders(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rorders_date ON report_orders(created_at DESC);

 

-- ─────────────────────────────────────────────

-- Order item lines (for top-item queries)

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_order_items (

    id UUID PRIMARY KEY,

    order_id UUID NOT NULL REFERENCES report_orders(id) ON DELETE CASCADE,

    store_id UUID NOT NULL,

    menu_item_id UUID NOT NULL,

    menu_item_name VARCHAR(255),

    quantity INT NOT NULL,

    unit_price DECIMAL(10,2) NOT NULL,

    total_price DECIMAL(10,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL

);

 

CREATE INDEX IF NOT EXISTS idx_ritems_store_item ON report_order_items(store_id, menu_item_id);

CREATE INDEX IF NOT EXISTS idx_ritems_date ON report_order_items(store_id, created_at DESC);

 

-- ─────────────────────────────────────────────

-- Daily snapshot (pre-computed nightly, serves dashboard tiles fast)

-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_snapshots (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    store_id UUID NOT NULL,

    date DATE NOT NULL,

    total_orders INT NOT NULL DEFAULT 0,

    gross_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,

    net_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,

    total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,

    total_discount DECIMAL(12,2) NOT NULL DEFAULT 0,

    total_commission DECIMAL(12,2) NOT NULL DEFAULT 0,

    avg_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,

    new_customers INT NOT NULL DEFAULT 0,

    returning_customers INT NOT NULL DEFAULT 0,

    top_item_id UUID,

    top_item_name VARCHAR(255),

    top_item_revenue DECIMAL(12,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (store_id, date)

);

 

CREATE INDEX IF NOT EXISTS idx_snapshots_store_date ON daily_snapshots(store_id, date DESC);

`;



async function runMigrations(): Promise<void> {

    const client = await db.connect();

    try {

        await client.query('BEGIN');

        await client.query(migrations);

        await client.query('COMMIT');

        console.info('Reporting service migrations complete');

    } catch (err) {

        await client.query('ROLLBACK');

        console.error('Migration failed:', err);

        throw err;

    } finally {

        client.release();

        await db.end();

    }

}



runMigrations()

    .then(() => process.exit(0))

    .catch(() => process.exit(1));