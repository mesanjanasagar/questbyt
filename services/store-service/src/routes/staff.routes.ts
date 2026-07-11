import { Router, IRouter } from 'express';
import { z } from 'zod';
import { getStaffByStore, getStaffById, getStaffByUserId, updateStaff, deleteStaff } from '../services/staff.service';
import { authenticate, requireManagerOrAdmin, requireAdmin, type AuthenticatedRequest } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

// GET /staff/me — return the logged-in user's staff profile (used by POS to get branchId)
router.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const profile = await getStaffByUserId(req.userId!);
    if (!profile) {
      res.status(404).json({ success: false, error: 'No staff profile found for this user' });
      return;
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// GET /staff?storeId= — list all staff for a store
router.get('/', async (req, res, next) => {
  try {
    const { storeId } = z.object({ storeId: z.string().uuid() }).parse(req.query);
    const staff = await getStaffByStore(storeId);
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
});

// GET /staff/:staffId
router.get('/:staffId', async (req, res, next) => {
  try {
    const profile = await getStaffById(req.params.staffId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// PATCH /staff/:staffId — update branch, position, employee number
router.patch('/:staffId', requireManagerOrAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      branchId: z.string().uuid().nullable().optional(),
      position: z.string().max(100).optional(),
      employeeNumber: z.string().min(1).max(50).optional(),
    }).parse(req.body);
    const profile = await updateStaff(req.params.staffId, body);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// DELETE /staff/:staffId — remove staff profile (admin only)
router.delete('/:staffId', requireAdmin, async (req, res, next) => {
  try {
    await deleteStaff(req.params.staffId);
    res.json({ success: true, message: 'Staff profile removed' });
  } catch (err) {
    next(err);
  }
});

export { router as staffRoutes };
