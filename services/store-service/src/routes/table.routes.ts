import { Router, IRouter } from 'express';
import { z } from 'zod';
import {
  createTable,
  getTablesByBranch,
  getTablesByDiningArea,
  updateTableStatus,
  deleteTable,
} from '../services/table.service';
import { authenticate, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

const CreateTableSchema = z.object({
  diningAreaId: z.string().uuid(),
  branchId: z.string().uuid(),
  storeId: z.string().uuid(),
  tableNumber: z.string().min(1).max(20),
  capacity: z.number().int().positive(),
});

// POST /tables – create table
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = CreateTableSchema.parse(req.body);
    const table = await createTable(body);
    res.status(201).json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
});

// GET /tables/by-branch/:branchId – list tables for a branch
router.get('/by-branch/:branchId', async (req, res, next) => {
  try {
    const tables = await getTablesByBranch(req.params.branchId);
    res.json({ success: true, data: tables });
  } catch (err) {
    next(err);
  }
});

// GET /tables/by-area/:diningAreaId – list tables for a dining area
router.get('/by-area/:diningAreaId', async (req, res, next) => {
  try {
    const tables = await getTablesByDiningArea(req.params.diningAreaId);
    res.json({ success: true, data: tables });
  } catch (err) {
    next(err);
  }
});

// PATCH /tables/:tableId/status – update table status
router.patch('/:tableId/status', async (req, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['available', 'occupied', 'reserved', 'cleaning']),
    }).parse(req.body);
    const table = await updateTableStatus(req.params.tableId, status);
    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
});

// DELETE /tables/:tableId
router.delete('/:tableId', requireAdmin, async (req, res, next) => {
  try {
    await deleteTable(req.params.tableId);
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) {
    next(err);
  }
});

export { router as tableRoutes };
