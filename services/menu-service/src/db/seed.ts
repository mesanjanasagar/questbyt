import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.MENU_DB_URL });

// Store to seed. Defaults to the store created by the auth-service seed so the
// POS terminal (which reads storeId from the logged-in user's JWT) finds a menu.
// Override with STORE_ID=<uuid> when seeding a different store.
const STORE_ID = process.env.STORE_ID ?? '981cfef4-b0d8-46dd-9403-23c8fda8bcce';

interface SeedItem {
  name: string;
  basePrice: number;
  description?: string;
  isFeatured?: boolean;
}

const CATEGORIES: { name: string; items: SeedItem[] }[] = [
  {
    name: 'Burgers',
    items: [
      { name: 'Classic Cheeseburger', basePrice: 28.0, description: 'Beef patty, cheddar, lettuce, tomato', isFeatured: true },
      { name: 'Double Beef Burger', basePrice: 38.0, description: 'Two patties, double cheese' },
      { name: 'Chicken Burger', basePrice: 26.0, description: 'Crispy chicken fillet' },
      { name: 'Veggie Burger', basePrice: 24.0, description: 'Plant-based patty' },
    ],
  },
  {
    name: 'Sides',
    items: [
      { name: 'French Fries', basePrice: 12.0 },
      { name: 'Onion Rings', basePrice: 14.0 },
      { name: 'Mozzarella Sticks', basePrice: 18.0 },
    ],
  },
  {
    name: 'Drinks',
    items: [
      { name: 'Cola', basePrice: 8.0 },
      { name: 'Fresh Orange Juice', basePrice: 14.0 },
      { name: 'Mineral Water', basePrice: 5.0 },
      { name: 'Iced Coffee', basePrice: 16.0, isFeatured: true },
    ],
  },
  {
    name: 'Desserts',
    items: [
      { name: 'Chocolate Cake', basePrice: 20.0 },
      { name: 'Ice Cream Sundae', basePrice: 18.0 },
    ],
  },
];

async function seed(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Idempotent: clear any existing menu data for this store (cascades to
    // categories and items) before re-seeding.
    await client.query('DELETE FROM menus WHERE store_id = $1', [STORE_ID]);

    const menuRes = await client.query(
      `INSERT INTO menus (store_id, name, description, is_default, status)
       VALUES ($1, 'Main Menu', 'Default store menu', TRUE, 'active')
       RETURNING id`,
      [STORE_ID],
    );
    const menuId = menuRes.rows[0].id as string;

    let categoryOrder = 0;
    let itemCount = 0;
    for (const cat of CATEGORIES) {
      const catRes = await client.query(
        `INSERT INTO menu_categories (menu_id, store_id, name, display_order, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [menuId, STORE_ID, cat.name, categoryOrder++],
      );
      const categoryId = catRes.rows[0].id as string;

      let sortOrder = 0;
      for (const item of cat.items) {
        await client.query(
          `INSERT INTO menu_items
             (category_id, store_id, name, description, base_price, tax_rate, status, sort_order, is_featured)
           VALUES ($1, $2, $3, $4, $5, 5.00, 'active', $6, $7)`,
          [categoryId, STORE_ID, item.name, item.description ?? null, item.basePrice, sortOrder++, item.isFeatured ?? false],
        );
        itemCount++;
      }
    }

    await client.query('COMMIT');
    console.info(`Menu seed complete for store ${STORE_ID}`);
    console.info(`  ${CATEGORIES.length} categories, ${itemCount} items`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Menu seed failed:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
