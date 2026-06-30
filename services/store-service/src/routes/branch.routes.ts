import { Router, IRouter } from 'express';
import { z } from 'zod';
import {
  createBranch,
  getBranchesByStore,
  getBranchById,
  updateBranch,
  setBranchStatus,
  deleteBranch,
  createDiningArea,
  getDiningAreasByBranch,
} from '../services/branch.service';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().optional(),
});

const CreateBranchSchema = z.object({
  storeId: z.string().uuid(),
  branchCode: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  address: AddressSchema.optional(),
  phone: z.string().max(50).optional(),
  // Allow empty string (UI sends '' for empty optional fields)
  email: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  timezone: z.string().max(100).optional(),
  isMain: z.boolean().optional(),
});

// POST /branches – create branch
router.post('/', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = CreateBranchSchema.parse(req.body);
    const branch = await createBranch(body);
    res.status(201).json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

// GET /branches/by-store/:storeId – list branches for a store
router.get('/by-store/:storeId', async (req, res, next) => {
  try {
    const branches = await getBranchesByStore(req.params.storeId);
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
});

// GET /branches/:branchId – get single branch
router.get('/:branchId', async (req, res, next) => {
  try {
    const branch = await getBranchById(req.params.branchId);
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

// PATCH /branches/:branchId – update branch
router.patch('/:branchId', requireAdmin, async (req, res, next) => {
  try {
    const body = CreateBranchSchema.omit({ storeId: true }).partial().parse(req.body);
    const branch = await updateBranch(req.params.branchId, body);
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

// PATCH /branches/:branchId/status – activate / deactivate
router.patch('/:branchId/status', requireAdmin, async (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const branch = await setBranchStatus(req.params.branchId, isActive);
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

// DELETE /branches/:branchId – hard delete (cascades to tables & dining areas)
router.delete('/:branchId', requireAdmin, async (req, res, next) => {
  try {
    await deleteBranch(req.params.branchId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Dining Areas ─────────────────────────────────────────────────────────────

const CreateDiningAreaSchema = z.object({
  branchId: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  floorNumber: z.number().int().positive().optional(),
});

// POST /branches/:branchId/dining-areas – create dining area
router.post('/:branchId/dining-areas', requireAdmin, async (req, res, next) => {
  try {
    const body = CreateDiningAreaSchema.parse({
      ...req.body,
      branchId: req.params.branchId,
    });
    const area = await createDiningArea(body);
    res.status(201).json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
});

// GET /branches/:branchId/dining-areas – list dining areas
router.get('/:branchId/dining-areas', async (req, res, next) => {
  try {
    const areas = await getDiningAreasByBranch(req.params.branchId);
    res.json({ success: true, data: areas });
  } catch (err) {
    next(err);
  }
});

export { router as branchRoutes };
