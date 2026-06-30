import { db } from '../db/client';
import { generateId, NotFoundError } from '@pos/shared-utils';
import { publishEvent } from '../events/producer';
import type { Table, CreateTableRequest } from '@pos/shared-types';

export async function createTable(req: CreateTableRequest): Promise<Table> {
  const tableId = generateId();

  const result = await db.query(
    `INSERT INTO tables (id, dining_area_id, branch_id, store_id, table_number, capacity)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tableId, req.diningAreaId, req.branchId, req.storeId, req.tableNumber, req.capacity],
  );

  await publishEvent(
    'table_created_v1',
    req.storeId,
    tableId,
    'table',
    {
      tableId,
      diningAreaId: req.diningAreaId,
      branchId: req.branchId,
      storeId: req.storeId,
      tableNumber: req.tableNumber,
      capacity: req.capacity,
    },
  );

  await advanceOnboardingStep(req.storeId, 'staff_added');

  return mapTable(result.rows[0]);
}

export async function getTablesByBranch(branchId: string): Promise<Table[]> {
  const result = await db.query(
    `SELECT t.* FROM tables t
     WHERE t.branch_id = $1
     ORDER BY t.table_number ASC`,
    [branchId],
  );
  return result.rows.map(mapTable);
}

export async function getTablesByDiningArea(diningAreaId: string): Promise<Table[]> {
  const result = await db.query(
    `SELECT * FROM tables WHERE dining_area_id = $1 ORDER BY table_number ASC`,
    [diningAreaId],
  );
  return result.rows.map(mapTable);
}

export async function updateTableStatus(
  tableId: string,
  status: Table['status'],
): Promise<Table> {
  const result = await db.query(
    `UPDATE tables SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [tableId, status],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Table ${tableId} not found`);

  const table = mapTable(result.rows[0]);

  await publishEvent(
    'table_updated_v1',
    table.storeId,
    tableId,
    'table',
    { tableId, storeId: table.storeId, previousStatus: null, newStatus: status },
  );

  return table;
}

export async function deleteTable(tableId: string): Promise<void> {
  const result = await db.query(`DELETE FROM tables WHERE id = $1 RETURNING store_id`, [tableId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Table ${tableId} not found`);
}

async function advanceOnboardingStep(storeId: string, nextStep: string): Promise<void> {
  await db.query(
    `UPDATE onboarding_state
     SET current_step = $2,
         completed_steps = completed_steps || $3::jsonb,
         updated_at = NOW()
     WHERE store_id = $1 AND is_complete = FALSE
       AND NOT (completed_steps @> $3::jsonb)`,
    [storeId, nextStep, JSON.stringify(['tables_configured'])],
  );
}

function mapTable(row: Record<string, unknown>): Table {
  return {
    id: row.id as string,
    diningAreaId: row.dining_area_id as string,
    branchId: row.branch_id as string,
    storeId: row.store_id as string,
    tableNumber: row.table_number as string,
    capacity: row.capacity as number,
    status: row.status as Table['status'],
    qrCodeUrl: row.qr_code_url as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
