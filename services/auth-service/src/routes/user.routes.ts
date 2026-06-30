import { Router, IRouter, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createUser,
  getUserById,
  getUsersByStore,
  updateUserStatus,
  updateUserPassword,
  updateUserRole,
  updateUserStoreId,
} from '../services/user.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { config } from '../config';

const router: IRouter = Router();

// Internal service-to-service: link a user to a store (no JWT required)
router.patch('/:id/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.headers['x-internal-service'] !== config.INTERNAL_SERVICE_SECRET) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.body);
    await updateUserStoreId(req.params.id, storeId);
    res.json(successResponse(null, 'Store linked'));
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

const STAFF_ROLES = ['admin', 'manager', 'cashier', 'kitchen', 'waiter'] as const;

// POST /users – create staff user (admin only)
router.post('/', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, underscores, dots, and hyphens'),
        email: z.string().email().optional(),
        password: z.string().min(8).max(128),
        role: z.enum(STAFF_ROLES),
      }),
      req.body,
    );

    const user = await createUser({ ...body, role: body.role as string });
    res.status(201).json(successResponse(user, 'User created'));
  } catch (err) {
    next(err);
  }
});

// GET /users?storeId=... – list users for a store
router.get('/', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(
      z.object({ storeId: z.string().uuid() }),
      req.query,
    );
    const users = await getUsersByStore(storeId);
    res.json(successResponse(users));
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id/status – deactivate / reactivate
router.patch('/:id/status', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const { status } = validateOrThrow(
      z.object({ status: z.enum(['active', 'inactive', 'suspended']) }),
      req.body,
    );
    const user = await updateUserStatus(req.params.id, status);
    res.json(successResponse(user, 'Status updated'));
  } catch (err) {
    next(err);
  }
});

// GET /users/:id – get single user
router.get('/:id', async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id/role – change role (admin only)
router.patch('/:id/role', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const { role } = validateOrThrow(
      z.object({ role: z.enum(STAFF_ROLES) }),
      req.body,
    );
    const user = await updateUserRole(req.params.id, role);
    res.json(successResponse(user, 'Role updated'));
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id/password – change password
router.patch('/:id/password', async (req, res, next) => {
  try {
    const { newPassword } = validateOrThrow(
      z.object({ newPassword: z.string().min(8).max(128) }),
      req.body,
    );
    await updateUserPassword(req.params.id, newPassword);
    res.json(successResponse(null, 'Password updated'));
  } catch (err) {
    next(err);
  }
});

export default router;
