import { Router } from 'express';
import { z } from 'zod';
import * as menuService from '../services/menu.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';

const router = Router();

// All routes require auth
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

// GET /menus/full?storeId= — full menu snapshot (POS startup)
router.get('/full', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const menu = await menuService.getFullMenu(storeId);
    res.json(successResponse(menu));
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

export default router;