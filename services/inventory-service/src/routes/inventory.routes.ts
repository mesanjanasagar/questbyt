import { Router } from 'express';
import { z } from 'zod';
import * as inventoryService from '../services/inventory.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { InventoryUnitType } from '@pos/shared-types';

const router = Router();

router.use(authenticate);

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
    const product = await inventoryService.createProduct(body);
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
      req.user?.userId ?? 'system',
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
    const alerts = await inventoryService.getLowStockAlerts(storeId, status);
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