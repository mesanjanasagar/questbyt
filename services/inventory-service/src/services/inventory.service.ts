import { db } from '../db/client';
import { publishEvent } from '../events/producer';
import {
  generateId,
  NotFoundError,
  ValidationError,
  buildPaginatedResponse,
  parsePagination,
  convertToStockUnit,
} from '@pos/shared-utils';
import type {
  Product,
  InventoryRecord,
  StockMovement,
  LowStockAlert,
  AdjustStockRequest,
  PaginatedResponse,
  PaginationQuery,
} from '@pos/shared-types';
import { InventoryUnitType, StockMovementType } from '@pos/shared-types';

// ================================================
// Create product
// ================================================

export async function createProduct(req: {
  storeId: string;
  sku?: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitType: InventoryUnitType;
}): Promise<Product> {
  const id = generateId();
  const result = await db.query(
    // sku must be NULL (not '') when absent — the table has UNIQUE(store_id, sku)
    // and Postgres treats multiple NULLs as non-conflicting but multiple ''
    // as a real duplicate, so a second SKU-less product would otherwise fail.
    `INSERT INTO products (id, store_id, sku, name, description, category_id, unit_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, req.storeId, req.sku || null, req.name, req.description ?? null, req.categoryId ?? null, req.unitType],
  );

  const product = rowToProduct(result.rows[0]);

  // Create empty inventory record
  await db.query(
    `INSERT INTO inventory (id, product_id, store_id, current_stock, reserved_stock)
     VALUES ($1, $2, $3, 0, 0)`,
    [generateId(), id, req.storeId],
  );

  return product;
}

// ================================================
// Get product by ID
// ================================================

export async function getProductById(id: string): Promise<Product> {
  const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Product ${id} not found`);
  }
  return rowToProduct(result.rows[0]);
}

// ================================================
// List products for a store
// ================================================

export async function listProducts(
  storeId: string,
  query: PaginationQuery & { status?: string },
): Promise<PaginatedResponse<Product>> {
  const { page, limit, offset } = parsePagination(query);
  const params: unknown[] = [storeId];
  let where = 'WHERE store_id = $1';

  if (query.status) {
    params.push(query.status);
    where += ` AND status = $${params.length}`;
  }

  const countResult = await db.query(`SELECT COUNT(*) FROM products ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const dataResult = await db.query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return buildPaginatedResponse(dataResult.rows.map(rowToProduct), total, page, limit);
}

// ================================================
// Get inventory for a product
// ================================================

export async function getInventory(productId: string): Promise<InventoryRecord> {
  const result = await db.query('SELECT * FROM inventory WHERE product_id = $1', [productId]);
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Inventory for product ${productId} not found`);
  }
  return rowToInventory(result.rows[0]);
}

// ================================================
// Adjust stock (manual adjustment, waste, purchase, etc.)
// ================================================

export async function adjustStock(
  productId: string,
  movementType: StockMovementType,
  req: AdjustStockRequest,
  userId: string,
): Promise<{ movement: StockMovement; inventory: InventoryRecord; alert?: LowStockAlert }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate product exists
    const prodResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (!prodResult.rowCount || prodResult.rowCount === 0) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    const product = prodResult.rows[0];

    // 2. Get current inventory for update
    const invResult = await client.query(
      `SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE`,
      [productId],
    );
    if (!invResult.rowCount || invResult.rowCount === 0) {
      throw new NotFoundError(`Inventory for product ${productId} not found`);
    }
    const inv = invResult.rows[0];

    // 3. Calculate new stock
    const currentStock = parseFloat(inv.current_stock);
    const newStock = currentStock + req.adjustmentQuantity;

    if (newStock < 0) {
      throw new ValidationError(
        `Stock cannot be negative (current: ${currentStock}, adjustment: ${req.adjustmentQuantity})`,
      );
    }

    // 4. Record movement
    const movementId = generateId();
    await client.query(
      `INSERT INTO stock_movements
       (id, product_id, store_id, movement_type, quantity, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        movementId,
        productId,
        product.store_id,
        movementType,
        req.adjustmentQuantity,
        req.referenceId ?? null,
        req.reason,
        userId,
      ],
    );

    // 5. Update inventory
    await client.query(
      `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
      [productId, newStock],
    );

    // 6. Check for low stock alert
    let alert: LowStockAlert | undefined;
    const reorderLevel = inv.reorder_level ? parseFloat(inv.reorder_level) : null;
    if (reorderLevel && newStock <= reorderLevel) {
      // Create or update low-stock alert
      const alertResult = await client.query(
        `INSERT INTO low_stock_alerts (id, store_id, product_id, alert_level, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (product_id, status) WHERE status IN ('pending','acknowledged')
         DO UPDATE SET created_at = NOW() RETURNING *`,
        [generateId(), product.store_id, productId, reorderLevel],
      );
      alert = rowToAlert(alertResult.rows[0]);
    }

    await client.query('COMMIT');

    const movement = rowToMovement(
      await client.query('SELECT * FROM stock_movements WHERE id = $1', [movementId]).then(r => r.rows[0]),
    );
    const finalInv = rowToInventory({
      ...inv,
      current_stock: newStock,
    });

    // Publish event (outside transaction)
    publishEvent(
      'inventory_stock_adjusted_v1',
      product.store_id,
      productId,
      'product',
      {
        productId,
        storeId: product.store_id,
        previousStock: currentStock,
        newStock,
        movementType,
        referenceId: req.referenceId,
      },
    ).catch((err) => console.warn('Failed to publish inventory_stock_adjusted_v1:', err.message));

    if (alert) {
      publishEvent(
        'inventory_low_stock_v1',
        product.store_id,
        productId,
        'product',
        {
          productId,
          storeId: product.store_id,
          currentStock: newStock,
          reorderLevel,
          alertId: alert.id,
        },
      ).catch((err) => console.warn('Failed to publish inventory_low_stock_v1:', err.message));
    }

    return { movement, inventory: finalInv, alert };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Deduct stock from order (called by Kafka consumer on order.completed)
// Returns items that were deducted + any low-stock alerts triggered
// ================================================

export async function deductStockForOrder(
  storeId: string,
  orderId: string,
  items: Array<{ productId: string; quantity: number }>,
): Promise<{
  deductedItems: Array<{ productId: string; quantityDeducted: number; remainingStock: number }>;
  alerts: LowStockAlert[];
}> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const deductedItems: Array<{ productId: string; quantityDeducted: number; remainingStock: number }> = [];
    const alerts: LowStockAlert[] = [];

    for (const item of items) {
      // Get current inventory
      const invResult = await client.query(
        `SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE`,
        [item.productId],
      );

      if (!invResult.rowCount || invResult.rowCount === 0) continue; // Product not found, skip

      const inv = invResult.rows[0];
      const currentStock = parseFloat(inv.current_stock);
      const quantityToDeduct = Math.min(item.quantity, currentStock);
      const newStock = currentStock - quantityToDeduct;

      // Record movement
      await client.query(
        `INSERT INTO stock_movements
         (id, product_id, store_id, movement_type, quantity, reference_id, reference_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'order', 'system')`,
        [generateId(), item.productId, storeId, 'sale', quantityToDeduct, orderId],
      );

      // Update inventory
      await client.query(
        `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
        [item.productId, newStock],
      );

      deductedItems.push({ productId: item.productId, quantityDeducted: quantityToDeduct, remainingStock: newStock });

      // Check low-stock
      const reorderLevel = inv.reorder_level ? parseFloat(inv.reorder_level) : null;
      if (reorderLevel && newStock <= reorderLevel) {
        const alertResult = await client.query(
          `INSERT INTO low_stock_alerts (id, store_id, product_id, alert_level, status)
           VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (product_id, status) WHERE status IN ('pending','acknowledged')
           DO UPDATE SET created_at = NOW() RETURNING *`,
          [generateId(), storeId, item.productId, reorderLevel],
        );
        alerts.push(rowToAlert(alertResult.rows[0]));
      }
    }

    await client.query('COMMIT');

    return { deductedItems, alerts };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Set initial stock (onboarding) — sets reorder thresholds and creates
// a purchase movement to establish opening stock level
// ================================================

export async function setInitialStock(
  productId: string,
  req: { currentStock: number; reorderLevel?: number; reorderQuantity?: number },
  userId: string,
): Promise<{ inventory: InventoryRecord }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const prodResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (!prodResult.rowCount || prodResult.rowCount === 0) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    const product = prodResult.rows[0];

    // Update reorder thresholds
    await client.query(
      `UPDATE inventory
       SET reorder_level = $2, reorder_quantity = $3, updated_at = NOW()
       WHERE product_id = $1`,
      [productId, req.reorderLevel ?? null, req.reorderQuantity ?? null],
    );

    // Record opening purchase movement if stock > 0
    if (req.currentStock > 0) {
      await client.query(
        `INSERT INTO stock_movements
         (id, product_id, store_id, movement_type, quantity, notes, created_by)
         VALUES ($1, $2, $3, 'purchase', $4, 'Opening stock', $5)`,
        [generateId(), productId, product.store_id, req.currentStock, userId],
      );

      await client.query(
        `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
        [productId, req.currentStock],
      );
    }

    await client.query('COMMIT');

    const invResult = await client.query('SELECT * FROM inventory WHERE product_id = $1', [productId]);
    const inventory = rowToInventory(invResult.rows[0]);

    publishEvent(
      'inventory_stock_initialized_v1',
      product.store_id,
      productId,
      'product',
      { productId, storeId: product.store_id, initialStock: req.currentStock },
    ).catch((err) => console.warn('Failed to publish inventory_stock_initialized_v1:', err.message));

    return { inventory };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Bulk import products (Excel/CSV) — mirrors the menu service's bulk
// import: create-or-skip per row, one row's failure doesn't abort the rest.
// ================================================

export interface BulkImportProductRow {
  name: string;
  sku?: string;
  description?: string;
  unitType?: string;
  currentStock?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
}

export interface BulkImportProductResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const VALID_UNIT_TYPES = new Set(['piece', 'kg', 'liter', 'box']);

export async function bulkImportProducts(
  storeId: string,
  rows: BulkImportProductRow[],
  userId: string,
): Promise<BulkImportProductResult> {
  const result: BulkImportProductResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header offset

    try {
      if (!row.name?.trim()) {
        result.errors.push({ row: rowNum, message: 'name is required' });
        continue;
      }
      const unitType = row.unitType?.trim().toLowerCase() || 'piece';
      if (!VALID_UNIT_TYPES.has(unitType)) {
        result.errors.push({ row: rowNum, message: `unit_type "${row.unitType}" must be one of piece, kg, liter, box` });
        continue;
      }

      // Skip (not error) on an existing SKU or exact name match within the
      // store — same "don't duplicate on re-import" behavior as menu items.
      const trimmedSku = row.sku?.trim() || null;
      const existing = await db.query(
        `SELECT id FROM products WHERE store_id = $1 AND (LOWER(name) = $2 OR ($3::text IS NOT NULL AND sku = $3)) LIMIT 1`,
        [storeId, row.name.trim().toLowerCase(), trimmedSku],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        result.skipped++;
        continue;
      }

      const product = await createProduct({
        storeId,
        name: row.name.trim(),
        sku: row.sku?.trim() || undefined,
        description: row.description?.trim() || undefined,
        unitType: unitType as InventoryUnitType,
      });
      result.created++;

      if (row.currentStock !== undefined || row.reorderLevel !== undefined || row.reorderQuantity !== undefined) {
        try {
          await setInitialStock(
            product.id,
            { currentStock: row.currentStock ?? 0, reorderLevel: row.reorderLevel, reorderQuantity: row.reorderQuantity },
            userId,
          );
        } catch (err: any) {
          result.errors.push({ row: rowNum, message: `Product created but stock failed: ${err?.message ?? 'unknown error'}` });
        }
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? 'Unknown error' });
    }
  }

  return result;
}

// ================================================
// Update product details
// ================================================

export async function updateProduct(
  productId: string,
  data: { name?: string; description?: string; sku?: string; unitType?: InventoryUnitType },
): Promise<Product> {
  const existing = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Product ${productId} not found`);
  const row = existing.rows[0];
  const result = await db.query(
    `UPDATE products SET name = $1, description = $2, sku = $3, unit_type = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [data.name ?? row.name, data.description ?? row.description, data.sku ?? row.sku, data.unitType ?? row.unit_type, productId],
  );
  return rowToProduct(result.rows[0]);
}

// ================================================
// Archive (soft-delete) a product
// ================================================

export async function archiveProduct(productId: string): Promise<void> {
  const result = await db.query(
    `UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [productId],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Product ${productId} not found`);
}

// ================================================
// Reserve stock for an order (adds to reserved_stock)
// ================================================

export async function reserveStockForOrder(
  orderId: string,
  storeId: string,
  items: Array<{ productId: string; quantity: number; unitType?: string }>,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      // Join products for its stocking unit — the caller's quantity is in
      // the recipe's unit (e.g. "200" meaning 200g), which has to be
      // converted into whatever unit this product is actually counted in
      // (kg/liter/piece/box) before it means anything against current_stock.
      const inv = await client.query(
        `SELECT i.*, p.unit_type AS product_unit_type FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE i.product_id = $1 FOR UPDATE`,
        [item.productId],
      );
      if (!inv.rowCount || inv.rowCount === 0) continue;
      const requestedQty = item.unitType
        ? convertToStockUnit(item.quantity, item.unitType, inv.rows[0].product_unit_type)
        : item.quantity;
      const available = parseFloat(inv.rows[0].current_stock) - parseFloat(inv.rows[0].reserved_stock);
      const toReserve = Math.min(requestedQty, Math.max(0, available));
      if (toReserve <= 0) continue;
      await client.query(
        `UPDATE inventory SET reserved_stock = reserved_stock + $2, updated_at = NOW() WHERE product_id = $1`,
        [item.productId, toReserve],
      );
      await client.query(
        `INSERT INTO order_reservations (id, order_id, store_id, product_id, quantity) VALUES ($1,$2,$3,$4,$5)`,
        [generateId(), orderId, storeId, item.productId, toReserve],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Release reserved stock on order cancellation
// ================================================

export async function releaseReservedForOrder(orderId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const reservations = await client.query(
      `SELECT * FROM order_reservations WHERE order_id = $1 AND status = 'reserved' FOR UPDATE`,
      [orderId],
    );
    for (const res of reservations.rows) {
      await client.query(
        `UPDATE inventory SET reserved_stock = GREATEST(0, reserved_stock - $2), updated_at = NOW() WHERE product_id = $1`,
        [res.product_id, parseFloat(res.quantity)],
      );
      await client.query(`UPDATE order_reservations SET status = 'released' WHERE id = $1`, [res.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Consume reserved stock when order is paid/completed
// ================================================

export async function consumeReservedForOrder(orderId: string, userId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const reservations = await client.query(
      `SELECT r.*, p.store_id as pstore FROM order_reservations r
       JOIN products p ON p.id = r.product_id
       WHERE r.order_id = $1 AND r.status = 'reserved' FOR UPDATE`,
      [orderId],
    );
    for (const res of reservations.rows) {
      const qty = parseFloat(res.quantity);
      await client.query(
        `UPDATE inventory
         SET current_stock = GREATEST(0, current_stock - $2),
             reserved_stock = GREATEST(0, reserved_stock - $2),
             updated_at = NOW()
         WHERE product_id = $1`,
        [res.product_id, qty],
      );
      await client.query(
        `INSERT INTO stock_movements (id, product_id, store_id, movement_type, quantity, reference_id, reference_type, created_by)
         VALUES ($1,$2,$3,'sale',$4,$5,'order',$6)`,
        [generateId(), res.product_id, res.store_id, qty, orderId, userId],
      );
      await client.query(`UPDATE order_reservations SET status = 'consumed' WHERE id = $1`, [res.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// List products with their inventory levels (combined for frontend)
// ================================================

export async function listProductsWithInventory(
  storeId: string,
  query: PaginationQuery & { status?: string; search?: string },
): Promise<PaginatedResponse<Product & { inventory?: InventoryRecord }>> {
  const { page, limit, offset } = parsePagination(query);
  const params: unknown[] = [storeId];
  let where = 'WHERE p.store_id = $1';

  if (query.status) {
    params.push(query.status);
    where += ` AND p.status = $${params.length}`;
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
  }

  const countResult = await db.query(`SELECT COUNT(*) FROM products p ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const dataResult = await db.query(
    `SELECT p.*, i.current_stock, i.reserved_stock, i.reorder_level, i.reorder_quantity, i.updated_at as inv_updated_at
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const rows = dataResult.rows.map((row) => {
    const product = rowToProduct(row);
    const inventory: InventoryRecord | undefined = row.current_stock !== null ? {
      id: '',
      productId: row.id as string,
      storeId: row.store_id as string,
      currentStock: parseFloat(row.current_stock),
      reservedStock: parseFloat(row.reserved_stock ?? '0'),
      availableStock: parseFloat(row.current_stock) - parseFloat(row.reserved_stock ?? '0'),
      reorderLevel: row.reorder_level ? parseFloat(row.reorder_level) : undefined,
      reorderQuantity: row.reorder_quantity ? parseFloat(row.reorder_quantity) : undefined,
      updatedAt: row.inv_updated_at as string,
    } : undefined;
    return { ...product, inventory };
  });

  return buildPaginatedResponse(rows, total, page, limit);
}

// ================================================
// Acknowledge low-stock alert
// ================================================

export async function acknowledgeAlert(alertId: string): Promise<LowStockAlert> {
  const result = await db.query(
    `UPDATE low_stock_alerts
     SET status = 'acknowledged', acknowledged_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [alertId],
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Alert ${alertId} not found`);
  }
  return rowToAlert(result.rows[0]);
}

// ================================================
// Get low-stock alerts for a store
// ================================================

export async function getLowStockAlerts(
  storeId: string,
  statuses: string,
): Promise<LowStockAlert[]> {
  const params: unknown[] = [storeId];
  let where = 'WHERE store_id = $1';

  if (statuses) {
    params.push(statuses);
    where += ` AND status = $${params.length}`;
  }

  const result = await db.query(
    `SELECT * FROM low_stock_alerts ${where} ORDER BY created_at DESC`,
    params,
  );

  return result.rows.map(rowToAlert);
}

// ================================================
// Get movement history for a product
// ================================================

export async function getMovementHistory(
  productId: string,
  query: PaginationQuery,
): Promise<PaginatedResponse<StockMovement>> {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM stock_movements WHERE product_id = $1`,
    [productId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await db.query(
    `SELECT * FROM stock_movements WHERE product_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [productId, limit, offset],
  );

  return buildPaginatedResponse(dataResult.rows.map(rowToMovement), total, page, limit);
}

// ================================================
// Row mappers
// ================================================

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    sku: row.sku as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    categoryId: row.category_id as string | undefined,
    unitType: row.unit_type as InventoryUnitType,
    status: row.status as 'active' | 'inactive' | 'archived',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToInventory(row: Record<string, unknown>): InventoryRecord {
  const current = parseFloat(row.current_stock as string);
  const reserved = parseFloat(row.reserved_stock as string);
  return {
    id: row.id as string,
    productId: row.product_id as string,
    storeId: row.store_id as string,
    currentStock: current,
    reservedStock: reserved,
    availableStock: current - reserved,
    reorderLevel: row.reorder_level ? parseFloat(row.reorder_level as string) : undefined,
    reorderQuantity: row.reorder_quantity ? parseFloat(row.reorder_quantity as string) : undefined,
    lastCountedAt: row.last_counted_at as string | undefined,
    updatedAt: row.updated_at as string,
  };
}

function rowToMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    storeId: row.store_id as string,
    movementType: row.movement_type as StockMovementType,
    quantity: parseFloat(row.quantity as string),
    referenceId: row.reference_id as string | undefined,
    referenceType: row.reference_type as string | undefined,
    notes: row.notes as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

function rowToAlert(row: Record<string, unknown>): LowStockAlert {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    productId: row.product_id as string,
    alertLevel: parseFloat(row.alert_level as string),
    status: row.status as 'pending' | 'acknowledged' | 'resolved',
    createdAt: row.created_at as string,
    acknowledgedAt: row.acknowledged_at as string | undefined,
  };
}