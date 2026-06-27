import bcrypt from 'bcryptjs';
import { db } from './client';
import { generateId } from '@pos/shared-utils';

async function seed(): Promise<void> {
  const storeId = generateId();
  const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
  const cashierPasswordHash = await bcrypt.hash('Cashier@123', 12);

  await db.query(
    `INSERT INTO users (id, store_id, username, email, password_hash, role, status)
     VALUES ($1, $2, 'admin', 'admin@pos.local', $3, 'admin', 'active')
     ON CONFLICT (username) DO NOTHING`,
    [generateId(), storeId, adminPasswordHash],
  );

  await db.query(
    `INSERT INTO users (id, store_id, username, email, password_hash, role, status)
     VALUES ($1, $2, 'cashier1', 'cashier1@pos.local', $3, 'cashier', 'active')
     ON CONFLICT (username) DO NOTHING`,
    [generateId(), storeId, cashierPasswordHash],
  );

  console.info(`Seed complete. Store ID: ${storeId}`);
  console.info('  admin / Admin@123');
  console.info('  cashier1 / Cashier@123');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });