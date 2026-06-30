import { Router, IRouter } from 'express';
import { z } from 'zod';
import * as menuService from '../services/menu.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { MenuItemStatus } from '@pos/shared-types';

const router: IRouter = Router();

// Internal: resolve ingredients for an order (no JWT required)
router.post('/resolve-ingredients', async (req, res, next) => {
  try {
    const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? 'internal-secret-change-in-prod';
    if (req.headers['x-internal-service'] !== INTERNAL_SECRET) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const body = validateOrThrow(
      z.object({ items: z.array(z.object({ menuItemId: z.string().uuid(), quantity: z.number().positive() })) }),
      req.body,
    );
    const resolved = await menuService.resolveIngredientsForOrder(body.items);
    res.json(successResponse(resolved));
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

// GET /items?categoryId=
router.get('/', async (req, res, next) => {
  try {
    const { categoryId } = validateOrThrow(z.object({ categoryId: z.string().uuid() }), req.query);
    const items = await menuService.getItemsByCategory(categoryId);
    res.json(successResponse(items));
  } catch (err) {
    next(err);
  }
});

// GET /items/:id — full item with modifiers + variants
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const item = await menuService.getItemById(id);
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// POST /items
router.post('/', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        categoryId: z.string().uuid(),
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        nameAr: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.number().positive(),
        taxRate: z.number().min(0).max(100).optional(),
        sku: z.string().optional(),
        calories: z.number().int().optional(),
        allergens: z.string().optional(),
        tags: z.string().optional(),
        inventoryProductId: z.string().uuid().optional(),
      }),
      req.body,
    );
    const item = await menuService.createItem(body);
    res.status(201).json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id — update item details (and optionally status)
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        nameAr: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        basePrice: z.number().positive().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        sku: z.string().nullable().optional(),
        calories: z.number().int().nullable().optional(),
        allergens: z.string().nullable().optional(),
        tags: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        isFeatured: z.boolean().optional(),
        inventoryProductId: z.string().uuid().nullable().optional(),
        status: z.nativeEnum(MenuItemStatus).optional(),
      }),
      req.body,
    );
    const { status, ...rest } = body;
    let item = await menuService.updateItem(id, rest);
    if (status !== undefined) item = await menuService.updateItemStatus(id, status);
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const { status } = validateOrThrow(
      z.object({ status: z.nativeEnum(MenuItemStatus) }),
      req.body,
    );
    const item = await menuService.updateItemStatus(id, status);
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id — sets status to hidden
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    await menuService.updateItemStatus(id, 'hidden');
    res.json(successResponse(null, 'Item removed'));
  } catch (err) {
    next(err);
  }
});

// GET /items/:id/ingredients
router.get('/:id/ingredients', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const ingredients = await menuService.getIngredients(id);
    res.json(successResponse(ingredients));
  } catch (err) {
    next(err);
  }
});

// POST /items/:id/ingredients
router.post('/:id/ingredients', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        inventoryProductId: z.string().uuid(),
        quantity: z.number().positive(),
        unitType: z.string().min(1).max(20),
      }),
      req.body,
    );
    const ingredient = await menuService.addIngredient(id, body.inventoryProductId, body.quantity, body.unitType);
    res.status(201).json(successResponse(ingredient));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id/ingredients/:ingredientId
router.patch('/:id/ingredients/:ingredientId', async (req, res, next) => {
  try {
    const { ingredientId } = validateOrThrow(
      z.object({ id: z.string().uuid(), ingredientId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({ quantity: z.number().positive(), unitType: z.string().min(1).max(20) }),
      req.body,
    );
    const ingredient = await menuService.updateIngredient(ingredientId, body.quantity, body.unitType);
    res.json(successResponse(ingredient));
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id/ingredients/:ingredientId
router.delete('/:id/ingredients/:ingredientId', async (req, res, next) => {
  try {
    const { ingredientId } = validateOrThrow(
      z.object({ id: z.string().uuid(), ingredientId: z.string().uuid() }),
      req.params,
    );
    await menuService.removeIngredient(ingredientId);
    res.json(successResponse(null, 'Ingredient removed'));
  } catch (err) {
    next(err);
  }
});

export default router;