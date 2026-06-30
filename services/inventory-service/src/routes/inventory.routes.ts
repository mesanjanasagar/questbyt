import { Router, IRouter } from 'express';
import { z } from 'zod';
import * as inventoryService from '../services/inventory.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { InventoryUnitType } from '@pos/shared-types';

const router: IRouter = Router();

const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? 'internal-secret-change-in-prod';

function requireInternal(req: any, res: any, next: any) {
  if (req.headers['x-internal-service'] !== INTERNAL_SECRET) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  next();
}

// POST /inventory/reserve-for-order (internal)
router.post('/reserve-for-order', requireInternal, async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        orderId: z.string().min(1),
        storeId: z.string().uuid(),
        items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() })),
      }),
      req.body,
    );
    await inventoryService.reserveStockForOrder(body.orderId, body.storeId, body.items);
    res.json(successResponse(null, 'Stock reserved'));
  } catch (err) {
    next(err);
  }
});

// POST /inventory/release-for-order (internal)
router.post('/release-for-order', requireInternal, async (req, res, next) => {
  try {
    const { orderId } = validateOrThrow(z.object({ orderId: z.string().min(1) }), req.body);
    await inventoryService.releaseReservedForOrder(orderId);
    res.json(successResponse(null, 'Reservation released'));
  } catch (err) {
    next(err);
  }
});

// POST /inventory/consume-for-order (internal)
router.post('/consume-for-order', requireInternal, async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({ orderId: z.string().min(1), userId: z.string().optional() }),
      req.body,
    );
    await inventoryService.consumeReservedForOrder(body.orderId, body.userId ?? 'system');
    res.json(successResponse(null, 'Stock consumed'));
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

// GET /api/v1/inventory/products-with-stock?storeId=&status=&search=
router.get('/products-with-stock', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.enum(['active', 'inactive', 'archived']).optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await inventoryService.listProductsWithInventory(query.storeId, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/products
router.post('/products', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        sku: z.string().max(100).optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        unitType: z.nativeEnum(InventoryUnitType),
      }),
      req.body,
    );
    const product = await inventoryService.createProduct({ ...body, sku: body.sku ?? '' });
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/products?storeId=&status=&page=&limit=
router.get('/products', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.enum(['active', 'inactive', 'archived']).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await inventoryService.listProducts(query.storeId, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inventory/products/:productId — update product details
router.patch('/products/:productId', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(z.object({ productId: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        sku: z.string().max(100).optional(),
        unitType: z.nativeEnum(InventoryUnitType).optional(),
      }),
      req.body,
    );
    const product = await inventoryService.updateProduct(productId, body);
    res.json(successResponse(product, 'Product updated'));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/inventory/products/:productId — archive product
router.delete('/products/:productId', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(z.object({ productId: z.string().uuid() }), req.params);
    await inventoryService.archiveProduct(productId);
    res.json(successResponse(null, 'Product archived'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/products/:productId
router.get('/products/:productId', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(
      z.object({ productId: z.string().uuid() }),
      req.params,
    );
    const product = await inventoryService.getProductById(productId);
    res.json(successResponse(product));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/products/:productId/inventory
router.get('/products/:productId/inventory', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(
      z.object({ productId: z.string().uuid() }),
      req.params,
    );
    const inventory = await inventoryService.getInventory(productId);
    res.json(successResponse(inventory));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inventory/products/:productId/stock – set initial stock & reorder thresholds (onboarding)
router.patch('/products/:productId/stock', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(
      z.object({ productId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        currentStock: z.number().min(0),
        reorderLevel: z.number().min(0).optional(),
        reorderQuantity: z.number().min(0).optional(),
      }),
      req.body,
    );
    const result = await inventoryService.setInitialStock(productId, body, req.user?.sub ?? 'system');
    res.json(successResponse(result.inventory, 'Stock initialized'));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/products/:productId/adjust
router.post('/products/:productId/adjust', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(
      z.object({ productId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        movementType: z.enum(['purchase', 'adjustment', 'waste', 'return']),
        adjustmentQuantity: z.number(),
        reason: z.string().min(1).max(255),
        referenceId: z.string().optional(),
      }),
      req.body,
    );
    const result = await inventoryService.adjustStock(
      productId,
      body.movementType as any,
      { adjustmentQuantity: body.adjustmentQuantity, reason: body.reason, referenceId: body.referenceId },
      req.user?.sub ?? 'system',
    );
    res.json(successResponse(result, 'Stock adjusted'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/products/:productId/movements?page=&limit=
router.get('/products/:productId/movements', async (req, res, next) => {
  try {
    const { productId } = validateOrThrow(
      z.object({ productId: z.string().uuid() }),
      req.params,
    );
    const query = validateOrThrow(
      z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await inventoryService.getMovementHistory(productId, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/alerts?storeId=&status=
router.get('/alerts', async (req, res, next) => {
  try {
    const { storeId, status } = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.enum(['pending', 'acknowledged', 'resolved']).optional(),
      }),
      req.query,
    );
    const alerts = await inventoryService.getLowStockAlerts(storeId, status ?? '');
    res.json(successResponse(alerts));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inventory/alerts/:alertId/acknowledge
router.patch('/alerts/:alertId/acknowledge', async (req, res, next) => {
  try {
    const { alertId } = validateOrThrow(
      z.object({ alertId: z.string().uuid() }),
      req.params,
    );
    const alert = await inventoryService.acknowledgeAlert(alertId);
    res.json(successResponse(alert, 'Alert acknowledged'));
  } catch (err) {
    next(err);
  }
});

export default router;