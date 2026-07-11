import { Router, IRouter } from 'express';
import { z } from 'zod';
import * as menuService from '../services/menu.service';
import type { BulkImportRow } from '../services/menu.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';

const router: IRouter = Router();

// GET /menus/full?storeId= — public catalog for kiosk terminals (no auth required)
router.get('/full', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const menu = await menuService.getFullMenu(storeId);
    res.json(successResponse(menu));
  } catch (err) {
    next(err);
  }
});

// All other routes require auth
router.use(authenticate);

// —— Menus ——————————————————————————————————————————

// GET /menus?storeId=
router.get('/', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const menus = await menuService.getMenusByStore(storeId);
    res.json(successResponse(menus));
  } catch (err) {
    next(err);
  }
});

// POST /menus
router.post('/', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
      }),
      req.body,
    );
    const menu = await menuService.createMenu(body);
    res.status(201).json(successResponse(menu));
  } catch (err) {
    next(err);
  }
});

// PATCH /menus/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
      }),
      req.body,
    );
    const menu = await menuService.updateMenu(id, body);
    res.json(successResponse(menu));
  } catch (err) {
    next(err);
  }
});

// DELETE /menus/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    await menuService.deleteMenu(id);
    res.json(successResponse({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

// —— Categories ——————————————————————————————————————————

// GET /menus/:menuId/categories
router.get('/:menuId/categories', async (req, res, next) => {
  try {
    const { menuId } = validateOrThrow(z.object({ menuId: z.string().uuid() }), req.params);
    const categories = await menuService.getCategoriesByMenu(menuId);
    res.json(successResponse(categories));
  } catch (err) {
    next(err);
  }
});

// POST /menus/:menuId/categories
router.post('/:menuId/categories', async (req, res, next) => {
  try {
    const { menuId } = validateOrThrow(z.object({ menuId: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        nameAr: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
        displayOrder: z.number().int().optional(),
        availableFrom: z.string().optional(),
        availableTo: z.string().optional(),
        availableDays: z.string().optional(),
      }),
      req.body,
    );
    const category = await menuService.createCategory({ ...body, menuId });
    res.status(201).json(successResponse(category));
  } catch (err) {
    next(err);
  }
});

// PATCH /menus/:menuId/categories/:id
router.patch('/:menuId/categories/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ menuId: z.string().uuid(), id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        displayOrder: z.number().int().optional(),
        status: z.enum(['active', 'inactive', 'hidden']).optional(),
      }),
      req.body,
    );
    const category = await menuService.updateCategory(id, body);
    res.json(successResponse(category));
  } catch (err) {
    next(err);
  }
});

// DELETE /menus/:menuId/categories/:id
router.delete('/:menuId/categories/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ menuId: z.string().uuid(), id: z.string().uuid() }), req.params);
    await menuService.deleteCategory(id);
    res.json(successResponse({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

// POST /menus/:menuId/categories/reorder
router.post('/:menuId/categories/reorder', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        categories: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int() })).min(1),
      }),
      req.body,
    );
    await menuService.reorderCategories(body.categories);
    res.json(successResponse(null, 'Categories reordered'));
  } catch (err) {
    next(err);
  }
});

// POST /menus/:menuId/categories/:id/duplicate
router.post('/:menuId/categories/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ menuId: z.string().uuid(), id: z.string().uuid() }), req.params);
    const result = await menuService.duplicateCategory(id);
    res.status(201).json(successResponse(result, 'Category duplicated'));
  } catch (err) {
    next(err);
  }
});

// POST /menus/bulk-import
router.post('/bulk-import', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        rows: z.array(
          z.object({
            menuName: z.string().min(1),
            categoryName: z.string().min(1),
            itemName: z.string().min(1),
            description: z.string().optional(),
            price: z.number().positive(),
            taxRate: z.number().min(0).max(100).optional(),
            sku: z.string().optional(),
            status: z.string().optional(),
            dietaryType: z.string().optional(),
            variants: z.string().optional(),
            modifierGroups: z.string().optional(),
            ingredients: z.string().optional(),
          }),
        ).min(1).max(2000),
      }),
      req.body,
    );
    const result = await menuService.bulkImportMenu(body.storeId, body.rows as BulkImportRow[]);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

export default router;