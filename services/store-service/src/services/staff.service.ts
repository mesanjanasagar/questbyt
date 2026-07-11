import { db } from '../db/client';
import { NotFoundError } from '@pos/shared-utils';
import type { StaffProfile } from '@pos/shared-types';

interface StaffRow {
  id: string;
  user_id: string;
  store_id: string;
  branch_id: string | null;
  employee_number: string;
  position: string | null;
  pin: string | null;
  created_at: string;
  updated_at: string;
}

function mapStaff(row: StaffRow): StaffProfile {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    branchId: row.branch_id ?? undefined,
    employeeNumber: row.employee_number,
    position: row.position ?? undefined,
    pin: row.pin ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStaffByUserId(userId: string): Promise<StaffProfile | null> {
  const result = await db.query(`SELECT * FROM staff_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!result.rowCount || result.rowCount === 0) return null;
  return mapStaff(result.rows[0] as StaffRow);
}

export async function getStaffById(staffId: string): Promise<StaffProfile> {
  const result = await db.query(`SELECT * FROM staff_profiles WHERE id = $1`, [staffId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Staff ${staffId} not found`);
  return mapStaff(result.rows[0] as StaffRow);
}

export async function getStaffByStore(storeId: string): Promise<StaffProfile[]> {
  const result = await db.query(
    `SELECT * FROM staff_profiles WHERE store_id = $1 ORDER BY created_at ASC`,
    [storeId],
  );
  return result.rows.map((r) => mapStaff(r as StaffRow));
}

export async function updateStaff(
  staffId: string,
  updates: { branchId?: string | null; position?: string; employeeNumber?: string },
): Promise<StaffProfile> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.branchId !== undefined) {
    fields.push(`branch_id = $${idx++}`);
    values.push(updates.branchId);
  }
  if (updates.position !== undefined) {
    fields.push(`position = $${idx++}`);
    values.push(updates.position);
  }
  if (updates.employeeNumber !== undefined) {
    fields.push(`employee_number = $${idx++}`);
    values.push(updates.employeeNumber);
  }

  if (fields.length === 0) return getStaffById(staffId);

  fields.push(`updated_at = NOW()`);
  values.push(staffId);

  const result = await db.query(
    `UPDATE staff_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Staff ${staffId} not found`);
  return mapStaff(result.rows[0] as StaffRow);
}

export async function deleteStaff(staffId: string): Promise<void> {
  const result = await db.query(`DELETE FROM staff_profiles WHERE id = $1`, [staffId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Staff ${staffId} not found`);
}
