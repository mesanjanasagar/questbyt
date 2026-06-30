import { db } from '../db/client';
import { generateId, NotFoundError } from '@pos/shared-utils';
import { publishEvent } from '../events/producer';
import type { Branch, CreateBranchRequest, DiningArea, CreateDiningAreaRequest } from '@pos/shared-types';

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function createBranch(req: CreateBranchRequest): Promise<Branch> {
  const branchId = generateId();

  const result = await db.query(
    `INSERT INTO branches
       (id, store_id, branch_code, name, address, phone, email, timezone, is_main)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      branchId,
      req.storeId,
      req.branchCode,
      req.name,
      req.address ? JSON.stringify(req.address) : null,
      req.phone ?? null,
      req.email ?? null,
      req.timezone ?? 'Asia/Dubai',
      req.isMain ?? false,
    ],
  );

  const branch = mapBranch(result.rows[0]);

  await publishEvent(
    'branch_created_v1',
    req.storeId,
    branchId,
    'branch',
    {
      branchId,
      storeId: req.storeId,
      branchCode: req.branchCode,
      name: req.name,
      isMain: req.isMain ?? false,
    },
  );

  // Non-fatal: onboarding_state may not exist for admin-created restaurants
  advanceOnboardingStep(req.storeId, 'tables_configured').catch((err: Error) =>
    console.warn('[store-service] advanceOnboardingStep failed (non-fatal):', err.message),
  );

  return branch;
}

export async function getBranchesByStore(storeId: string): Promise<Branch[]> {
  const result = await db.query(
    `SELECT * FROM branches WHERE store_id = $1 AND is_active = TRUE ORDER BY is_main DESC, name ASC`,
    [storeId],
  );
  return result.rows.map(mapBranch);
}

export async function getBranchById(branchId: string): Promise<Branch> {
  const result = await db.query(`SELECT * FROM branches WHERE id = $1`, [branchId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Branch ${branchId} not found`);
  return mapBranch(result.rows[0]);
}

export async function updateBranch(
  branchId: string,
  req: Partial<Omit<CreateBranchRequest, 'storeId'>>,
): Promise<Branch> {
  await db.query(
    `UPDATE branches
     SET name        = COALESCE($2, name),
         address     = COALESCE($3, address),
         phone       = COALESCE($4, phone),
         email       = COALESCE($5, email),
         timezone    = COALESCE($6, timezone),
         is_main     = COALESCE($7, is_main),
         updated_at  = NOW()
     WHERE id = $1`,
    [
      branchId,
      req.name ?? null,
      req.address ? JSON.stringify(req.address) : null,
      req.phone ?? null,
      req.email ?? null,
      req.timezone ?? null,
      req.isMain ?? null,
    ],
  );
  return getBranchById(branchId);
}

export async function setBranchStatus(branchId: string, isActive: boolean): Promise<Branch> {
  const res = await db.query(
    `UPDATE branches SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [branchId, isActive],
  );
  if (!res.rowCount || res.rowCount === 0) throw new NotFoundError(`Branch ${branchId} not found`);
  return getBranchById(branchId);
}

export async function deleteBranch(branchId: string): Promise<void> {
  const res = await db.query(`DELETE FROM branches WHERE id = $1 RETURNING id`, [branchId]);
  if (!res.rowCount || res.rowCount === 0) throw new NotFoundError(`Branch ${branchId} not found`);
}

// ─── Dining Areas ─────────────────────────────────────────────────────────────

export async function createDiningArea(req: CreateDiningAreaRequest): Promise<DiningArea> {
  const areaId = generateId();

  const result = await db.query(
    `INSERT INTO dining_areas (id, branch_id, store_id, name, description, floor_number)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [areaId, req.branchId, req.storeId, req.name, req.description ?? null, req.floorNumber ?? 1],
  );

  await publishEvent(
    'dining_area.created.v1' as any,
    req.storeId,
    areaId,
    'dining_area',
    { diningAreaId: areaId, branchId: req.branchId, storeId: req.storeId, name: req.name, floorNumber: req.floorNumber ?? 1 },
  );

  return mapDiningArea(result.rows[0]);
}

export async function getDiningAreasByBranch(branchId: string): Promise<DiningArea[]> {
  const result = await db.query(
    `SELECT * FROM dining_areas WHERE branch_id = $1 ORDER BY floor_number ASC, name ASC`,
    [branchId],
  );
  return result.rows.map(mapDiningArea);
}

// ─── Onboarding step helper ───────────────────────────────────────────────────

async function advanceOnboardingStep(storeId: string, nextStep: string): Promise<void> {
  await db.query(
    `UPDATE onboarding_state
     SET current_step = $2, updated_at = NOW()
     WHERE store_id = $1 AND is_complete = FALSE`,
    [storeId, nextStep],
  );
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function mapBranch(row: Record<string, unknown>): Branch {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    branchCode: row.branch_code as string,
    name: row.name as string,
    address: row.address as Branch['address'],
    phone: row.phone as string | undefined,
    email: row.email as string | undefined,
    timezone: row.timezone as string,
    isMain: row.is_main as boolean,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapDiningArea(row: Record<string, unknown>): DiningArea {
  return {
    id: row.id as string,
    branchId: row.branch_id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    floorNumber: row.floor_number as number,
    createdAt: row.created_at as string,
  };
}
