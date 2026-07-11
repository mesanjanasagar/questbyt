import { db } from '../db/client';
import { generateId, ValidationError, NotFoundError, ConflictError } from '@pos/shared-utils';

export interface RegisterShift {
  id: string;
  storeId: string;
  deviceId: string;
  cashierId: string;
  openingBalance: number;
  openingNotes?: string;
  closingBalance?: number;
  expectedCash?: number;
  variance?: number;
  closingNotes?: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface ShiftSummary {
  shift: RegisterShift;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  onlineSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  movements: CashMovement[];
}

function rowToShift(row: Record<string, unknown>): RegisterShift {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    deviceId: row.device_id as string,
    cashierId: row.cashier_id as string,
    openingBalance: parseFloat(row.opening_balance as string),
    openingNotes: row.opening_notes as string | undefined,
    closingBalance: row.closing_balance != null ? parseFloat(row.closing_balance as string) : undefined,
    expectedCash: row.expected_cash != null ? parseFloat(row.expected_cash as string) : undefined,
    variance: row.variance != null ? parseFloat(row.variance as string) : undefined,
    closingNotes: row.closing_notes as string | undefined,
    status: row.status as 'open' | 'closed',
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | undefined,
  };
}

function rowToMovement(row: Record<string, unknown>): CashMovement {
  return {
    id: row.id as string,
    shiftId: row.shift_id as string,
    type: row.type as 'cash_in' | 'cash_out',
    amount: parseFloat(row.amount as string),
    reason: row.reason as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

// ───────────────────────────────────────────
// Open a shift — one active shift per device (physical till) at a time
// ───────────────────────────────────────────

export async function openShift(req: {
  storeId: string; deviceId: string; cashierId: string; openingBalance: number; openingNotes?: string;
}): Promise<RegisterShift> {
  const existing = await db.query(
    `SELECT id FROM register_shifts WHERE device_id = $1 AND status = 'open'`,
    [req.deviceId],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError('A shift is already open on this register. Close it before opening a new one.');
  }

  const result = await db.query(
    `INSERT INTO register_shifts (id, store_id, device_id, cashier_id, opening_balance, opening_notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [generateId(), req.storeId, req.deviceId, req.cashierId, req.openingBalance, req.openingNotes ?? null],
  );
  return rowToShift(result.rows[0]);
}

// ───────────────────────────────────────────
// Get the currently-open shift for a device, if any
// ───────────────────────────────────────────

export async function getActiveShift(deviceId: string): Promise<ShiftSummary | null> {
  const result = await db.query(
    `SELECT * FROM register_shifts WHERE device_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    [deviceId],
  );
  if (!result.rowCount) return null;
  const shift = rowToShift(result.rows[0]);
  return buildSummary(shift, new Date().toISOString());
}

// ───────────────────────────────────────────
// Record an ad-hoc cash in/out against the active shift
// ───────────────────────────────────────────

export async function recordCashMovement(req: {
  shiftId: string; type: 'cash_in' | 'cash_out'; amount: number; reason: string; actorId: string;
}): Promise<CashMovement> {
  const shiftResult = await db.query(`SELECT * FROM register_shifts WHERE id = $1`, [req.shiftId]);
  if (!shiftResult.rowCount) throw new NotFoundError(`Shift ${req.shiftId} not found`);
  if (shiftResult.rows[0].status !== 'open') {
    throw new ValidationError('Cannot record a cash movement against a closed shift');
  }

  const storeId = shiftResult.rows[0].store_id;
  const result = await db.query(
    `INSERT INTO cash_movements (id, shift_id, store_id, type, amount, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [generateId(), req.shiftId, storeId, req.type, req.amount, req.reason, req.actorId],
  );
  return rowToMovement(result.rows[0]);
}

// ───────────────────────────────────────────
// Close a shift — counts what's actually in the drawer against what the
// system expects, and records the variance for the manager to see.
// ───────────────────────────────────────────

export async function closeShift(req: {
  shiftId: string; closingBalance: number; closingNotes?: string;
}): Promise<ShiftSummary> {
  const shiftResult = await db.query(`SELECT * FROM register_shifts WHERE id = $1`, [req.shiftId]);
  if (!shiftResult.rowCount) throw new NotFoundError(`Shift ${req.shiftId} not found`);
  const shift = rowToShift(shiftResult.rows[0]);
  if (shift.status !== 'open') throw new ValidationError('This shift is already closed');

  const closedAt = new Date().toISOString();
  const summary = await buildSummary(shift, closedAt);
  const variance = parseFloat((req.closingBalance - summary.expectedCash).toFixed(2));

  const updated = await db.query(
    `UPDATE register_shifts
     SET status = 'closed', closing_balance = $2, expected_cash = $3, variance = $4,
         closing_notes = $5, closed_at = $6
     WHERE id = $1 RETURNING *`,
    [req.shiftId, req.closingBalance, summary.expectedCash, variance, req.closingNotes ?? null, closedAt],
  );

  return { ...summary, shift: rowToShift(updated.rows[0]) };
}

// ───────────────────────────────────────────
// Shift history (manager view)
// ───────────────────────────────────────────

export async function listShifts(storeId: string, limit = 30): Promise<RegisterShift[]> {
  const result = await db.query(
    `SELECT * FROM register_shifts WHERE store_id = $1 ORDER BY opened_at DESC LIMIT $2`,
    [storeId, limit],
  );
  return result.rows.map(rowToShift);
}

export async function getShiftById(shiftId: string): Promise<ShiftSummary> {
  const result = await db.query(`SELECT * FROM register_shifts WHERE id = $1`, [shiftId]);
  if (!result.rowCount) throw new NotFoundError(`Shift ${shiftId} not found`);
  const shift = rowToShift(result.rows[0]);
  return buildSummary(shift, shift.closedAt ?? new Date().toISOString());
}

// ───────────────────────────────────────────
// Shared summary builder — sums cash/card/wallet/online sales and cash
// refunds taken on this device during the shift window, plus manual cash
// movements, to arrive at what should be sitting in the drawer.
// ───────────────────────────────────────────

async function buildSummary(shift: RegisterShift, windowEnd: string): Promise<ShiftSummary> {
  const salesResult = await db.query(
    `SELECT payment_method, COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE device_id = $1 AND status = 'success'
       AND created_at >= $2 AND created_at <= $3
     GROUP BY payment_method`,
    [shift.deviceId, shift.openedAt, windowEnd],
  );
  const salesByMethod: Record<string, number> = {};
  for (const row of salesResult.rows) {
    salesByMethod[row.payment_method] = parseFloat(row.total);
  }

  const refundsResult = await db.query(
    `SELECT COALESCE(SUM(r.amount), 0) AS total
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE p.device_id = $1 AND p.payment_method = 'cash' AND r.status = 'success'
       AND r.created_at >= $2 AND r.created_at <= $3`,
    [shift.deviceId, shift.openedAt, windowEnd],
  );
  const cashRefunds = parseFloat(refundsResult.rows[0].total);

  const movementsResult = await db.query(
    `SELECT * FROM cash_movements WHERE shift_id = $1 ORDER BY created_at ASC`,
    [shift.id],
  );
  const movements = movementsResult.rows.map(rowToMovement);
  const cashIn = movements.filter((m) => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter((m) => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0);

  const cashSales = salesByMethod.cash ?? 0;
  const expectedCash = parseFloat(
    (shift.openingBalance + cashSales - cashRefunds + cashIn - cashOut).toFixed(2),
  );

  return {
    shift,
    cashSales,
    cardSales: salesByMethod.card ?? 0,
    walletSales: salesByMethod.wallet ?? 0,
    onlineSales: salesByMethod.online ?? 0,
    cashRefunds,
    cashIn,
    cashOut,
    expectedCash,
    movements,
  };
}
