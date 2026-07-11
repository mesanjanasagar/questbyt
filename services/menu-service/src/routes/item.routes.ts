import { Router, IRouter } from 'express';
import { z } from 'zod';
import * as menuService from '../services/menu.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { MenuItemStatus, DietaryType, type MenuItem } from '@pos/shared-types';

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

// POST /items/bulk — bulk status update (must precede /:id routes)
router.post('/bulk', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        ids: z.array(z.string().uuid()).min(1),
        status: z.nativeEnum(MenuItemStatus),
      }),
      req.body,
    );
    await menuService.bulkUpdateItemStatus(body.ids, body.status);
    res.json(successResponse(null, 'Items updated'));
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
        dietaryType: z.nativeEnum(DietaryType).optional(),
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

// PATCH /items/reorder — reorder items within a category (must precede /:id)
router.patch('/reorder', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })).min(1),
      }),
      req.body,
    );
    await menuService.reorderItems(body.items);
    res.json(successResponse(null, 'Items reordered'));
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
        dietaryType: z.nativeEnum(DietaryType).nullable().optional(),
        sortOrder: z.number().int().optional(),
        isFeatured: z.boolean().optional(),
        inventoryProductId: z.string().uuid().nullable().optional(),
        isRecommended: z.boolean().optional(),
        hideOnline: z.boolean().optional(),
        availableFromTime: z.string().nullable().optional(),
        availableToTime: z.string().nullable().optional(),
        availableDays: z.string().nullable().optional(),
        status: z.nativeEnum(MenuItemStatus).optional(),
      }),
      req.body,
    );
    const { status, ...rest } = body;
    const hasFields = Object.keys(rest).length > 0;

    // Never invoke the full-column UPDATE when only status is being changed.
    // updateItem runs a SET on every column including newly-added ones that may not
    // yet exist in the DB if the migration hasn't been applied; calling it with an
    // empty payload would silently succeed but then fail with "column does not exist"
    // on any environment whose schema predates the most recent migration.
    const base: MenuItem | null = hasFields
      ? await menuService.updateItem(id, rest)
      : null;

    const item: MenuItem = status !== undefined
      ? await menuService.updateItemStatus(id, status)
      : base ?? await menuService.getItemById(id);

    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// POST /items/:id/duplicate
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const item = await menuService.duplicateItem(id);
    res.status(201).json(successResponse(item, 'Item duplicated'));
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

// DELETE /items/:id/hard — permanent delete
router.delete('/:id/hard', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    await menuService.hardDeleteItem(id);
    res.json(successResponse(null, 'Item permanently deleted'));
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

// ─── Variants ────────────────────────────────────────────────────────────────

// POST /items/:id/variants
router.post('/:id/variants', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({ name: z.string().min(1).max(100), price: z.number().positive(), sku: z.string().optional() }),
      req.body,
    );
    const variant = await menuService.addVariant(id, body);
    res.status(201).json(successResponse(variant));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id/variants/:variantId
router.patch('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const { variantId } = validateOrThrow(
      z.object({ id: z.string().uuid(), variantId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(100).optional(),
        price: z.number().positive().optional(),
        sku: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      }),
      req.body,
    );
    const variant = await menuService.updateVariant(variantId, body);
    res.json(successResponse(variant));
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id/variants/:variantId
router.delete('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const { variantId } = validateOrThrow(
      z.object({ id: z.string().uuid(), variantId: z.string().uuid() }),
      req.params,
    );
    await menuService.removeVariant(variantId);
    res.json(successResponse(null, 'Variant removed'));
  } catch (err) {
    next(err);
  }
});

// ─── Modifier Groups ─────────────────────────────────────────────────────────

// POST /items/:id/modifier-groups — creates a group and links it to this item
router.post('/:id/modifier-groups', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        selectionType: z.enum(['single', 'multiple']).optional(),
        minSelections: z.number().int().min(0).optional(),
        maxSelections: z.number().int().min(1).optional(),
        isRequired: z.boolean().optional(),
      }),
      req.body,
    );
    const group = await menuService.createModifierGroup(id, body);
    res.status(201).json(successResponse(group));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id/modifier-groups/:groupId
router.patch('/:id/modifier-groups/:groupId', async (req, res, next) => {
  try {
    const { groupId } = validateOrThrow(
      z.object({ id: z.string().uuid(), groupId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        selectionType: z.enum(['single', 'multiple']).optional(),
        minSelections: z.number().int().min(0).optional(),
        maxSelections: z.number().int().min(1).optional(),
        isRequired: z.boolean().optional(),
      }),
      req.body,
    );
    const group = await menuService.updateModifierGroup(groupId, body);
    res.json(successResponse(group));
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id/modifier-groups/:groupId
router.delete('/:id/modifier-groups/:groupId', async (req, res, next) => {
  try {
    const { groupId } = validateOrThrow(
      z.object({ id: z.string().uuid(), groupId: z.string().uuid() }),
      req.params,
    );
    await menuService.deleteModifierGroup(groupId);
    res.json(successResponse(null, 'Modifier group removed'));
  } catch (err) {
    next(err);
  }
});

// POST /items/:id/modifier-groups/:groupId/modifiers
router.post('/:id/modifier-groups/:groupId/modifiers', async (req, res, next) => {
  try {
    const { groupId } = validateOrThrow(
      z.object({ id: z.string().uuid(), groupId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255),
        nameAr: z.string().optional(),
        priceAdjustment: z.number().optional(),
        isDefault: z.boolean().optional(),
      }),
      req.body,
    );
    const modifier = await menuService.addModifier(groupId, body);
    res.status(201).json(successResponse(modifier));
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id/modifier-groups/:groupId/modifiers/:modifierId
router.patch('/:id/modifier-groups/:groupId/modifiers/:modifierId', async (req, res, next) => {
  try {
    const { modifierId } = validateOrThrow(
      z.object({ id: z.string().uuid(), groupId: z.string().uuid(), modifierId: z.string().uuid() }),
      req.params,
    );
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        nameAr: z.string().optional(),
        priceAdjustment: z.number().optional(),
        isDefault: z.boolean().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      }),
      req.body,
    );
    const modifier = await menuService.updateModifier(modifierId, body);
    res.json(successResponse(modifier));
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id/modifier-groups/:groupId/modifiers/:modifierId
router.delete('/:id/modifier-groups/:groupId/modifiers/:modifierId', async (req, res, next) => {
  try {
    const { modifierId } = validateOrThrow(
      z.object({ id: z.string().uuid(), groupId: z.string().uuid(), modifierId: z.string().uuid() }),
      req.params,
    );
    await menuService.removeModifier(modifierId);
    res.json(successResponse(null, 'Modifier removed'));
  } catch (err) {
    next(err);
  }
});

export default router;