import { Router } from 'express';
import { z } from 'zod';
import * as menuService from '../services/menu.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { MenuItemStatus } from '@pos/shared-types';

const router = Router();

router.use(authenticate);

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

export default router;