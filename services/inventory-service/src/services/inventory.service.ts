import { db } from '../db/client';
import { config } from '../config';
import { publishEvent } from '../events/producer';
import {
  generateId,
  NotFoundError,
  ValidationError,
  buildPaginatedResponse,
  parsePagination,
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
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitType: InventoryUnitType;
}): Promise<Product> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO products (id, store_id, sku, name, description, category_id, unit_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, req.storeId, req.sku, req.name, req.description ?? null, req.categoryId ?? null, req.unitType],
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
      'inventory.adjusted',
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
    ).catch((err) => console.warn('Failed to publish inventory.adjusted:', err.message));

    if (alert) {
      publishEvent(
        'inventory.low_stock',
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
      ).catch((err) => console.warn('Failed to publish inventory.low_stock:', err.message));
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
        [generateId(), item.productId, storeId, 'sale', $4, $5, orderId],
      );

      // Update inventory
      await client.query(
        `UPDATE inventory SET current_stock = $2, updated_at = NOW() WHERE product_id = $1`,
        [item.productId, newStock],
      );

      deductedItems.push({ productId: item.productId, quantityDeducted, remainingStock: newStock });

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