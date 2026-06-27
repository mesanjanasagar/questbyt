1   import { Pool } from 'pg';
2   import { config } from '../config';
3   
4   const db = new Pool({ connectionString: config.REPORTING_DB_URL });
5   
6   // The reporting DB is a denormalised read-model.
7   // Events from order-service and payment-service are ingested here.
8   // All queries are fast aggregations — no joins to operational DBs.
9   
10  const migrations = `
11  -- ───────────────────────────────────────────
12  -- Denormalised order fact table (one row per order)
13  -- ───────────────────────────────────────────
14  CREATE TABLE IF NOT EXISTS report_orders (
15    id UUID PRIMARY KEY,
16    store_id UUID NOT NULL,
17    customer_id UUID,
18    cashier_id UUID NOT NULL,
19    order_type VARCHAR(50) NOT NULL,
20    platform VARCHAR(50) NOT NULL DEFAULT 'direct',
21    status VARCHAR(50) NOT NULL,
22    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
23    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
24    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
25    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
26    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
27    net_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
28    item_count INT NOT NULL DEFAULT 0,
29    completed_at TIMESTAMPTZ,
30    created_at TIMESTAMPTZ NOT NULL
31  );
32  
33  CREATE INDEX IF NOT EXISTS idx_rorders_store_date ON report_orders(store_id, created_at DESC);
34  CREATE INDEX IF NOT EXISTS idx_rorders_platform ON report_orders(store_id, platform, created_at DESC);
35  CREATE INDEX IF NOT EXISTS idx_rorders_customer ON report_orders(customer_id) WHERE customer_id IS NOT NULL;
36  CREATE INDEX IF NOT EXISTS idx_rorders_date ON report_orders(created_at DESC);
37  
38  -- ───────────────────────────────────────────
39  -- Order item lines (for top-item queries)
40  -- ───────────────────────────────────────────
41  CREATE TABLE IF NOT EXISTS report_order_items (
42    id UUID PRIMARY KEY,
43    order_id UUID NOT NULL REFERENCES report_orders(id) ON DELETE CASCADE,
44    store_id UUID NOT NULL,
45    menu_item_id UUID NOT NULL,
46    menu_item_name VARCHAR(255),
47    quantity INT NOT NULL,
48    unit_price DECIMAL(10,2) NOT NULL,
49    total_price DECIMAL(10,2) NOT NULL,
50    created_at TIMESTAMPTZ NOT NULL
51  );
52  
53  CREATE INDEX IF NOT EXISTS idx_ritems_store_item ON report_order_items(store_id, menu_item_id);
54  CREATE INDEX IF NOT EXISTS idx_ritems_date ON report_order_items(store_id, created_at DESC);
55  
56  -- ───────────────────────────────────────────
57  -- Daily snapshot (pre-computed nightly, serves dashboard tiles fast)
58  -- ───────────────────────────────────────────
59  CREATE TABLE IF NOT EXISTS daily_snapshots (
60    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
61    store_id UUID NOT NULL,
62    date DATE NOT NULL,
63    total_orders INT NOT NULL DEFAULT 0,
64    gross_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
65    net_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
66    total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
67    total_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
68    total_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
69    avg_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
70    new_customers INT NOT NULL DEFAULT 0,
71    returning_customers INT NOT NULL DEFAULT 0,
72    top_item_id UUID,
73    top_item_name VARCHAR(255),
74    top_item_revenue DECIMAL(12,2),
75    created_at TIMESTAMPTZ DEFAULT NOW(),
76    UNIQUE (store_id, date)
77  );
78  
79  CREATE INDEX IF NOT EXISTS idx_snapshots_store_date ON daily_snapshots(store_id, date DESC);
80  `;
81  
82  async function runMigrations(): Promise<void> {
83    const client = await db.connect();
84    try {
85      await client.query('BEGIN');
86      await client.query(migrations);
87      await client.query('COMMIT');
88      console.info('Reporting service migrations complete');
89    } catch (err) {
90      await client.query('ROLLBACK');
91      console.error('Migration failed:', err);
92      throw err;
93    } finally {
94      client.release();
95      await db.end();
96    }
97  }
98  
99  runMigrations()
100   .then(() => process.exit(0))
101   .catch(() => process.exit(1));