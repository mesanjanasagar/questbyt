import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { generateId, ConflictError, NotFoundError } from '@pos/shared-utils';
export interface CreateUserRequest {
  storeId: string;
  username: string;
  email?: string;
  password: string;
  role: string;
}

export interface UserRecord {
  id: string;
  storeId: string;
  username: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
}

export async function createUser(req: CreateUserRequest): Promise<UserRecord> {
  const existing = await db.query(
    `SELECT id FROM users WHERE username = $1`,
    [req.username],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`Username '${req.username}' is already taken`);
  }

  const passwordHash = await bcrypt.hash(req.password, 12);
  const userId = generateId();

  const result = await db.query(
    `INSERT INTO users (id, store_id, username, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING id, store_id, username, email, role, status, created_at, last_login`,
    [userId, req.storeId, req.username, req.email ?? null, passwordHash, req.role],
  );

  return mapUser(result.rows[0]);
}

export async function getUsersByStore(storeId: string): Promise<UserRecord[]> {
  const result = await db.query(
    `SELECT id, store_id, username, email, role, status, created_at, last_login
     FROM users WHERE store_id = $1 ORDER BY created_at ASC`,
    [storeId],
  );
  return result.rows.map(mapUser);
}

export async function updateUserStatus(
  userId: string,
  status: 'active' | 'inactive' | 'suspended',
): Promise<UserRecord> {
  const result = await db.query(
    `UPDATE users SET status = $2 WHERE id = $1
     RETURNING id, store_id, username, email, role, status, created_at, last_login`,
    [userId, status],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`User ${userId} not found`);
  return mapUser(result.rows[0]);
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash]);
}

export async function getUserById(userId: string): Promise<UserRecord> {
  const result = await db.query(
    `SELECT id, store_id, username, email, role, status, created_at, last_login
     FROM users WHERE id = $1`,
    [userId],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`User ${userId} not found`);
  return mapUser(result.rows[0]);
}

export async function updateUserRole(userId: string, role: string): Promise<UserRecord> {
  const result = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1
     RETURNING id, store_id, username, email, role, status, created_at, last_login`,
    [userId, role],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`User ${userId} not found`);
  return mapUser(result.rows[0]);
}

export async function updateUserStoreId(userId: string, storeId: string): Promise<void> {
  await db.query(`UPDATE users SET store_id = $2 WHERE id = $1`, [userId, storeId]);
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    username: row.username as string,
    email: row.email as string | undefined,
    role: row.role as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    lastLogin: row.last_login as string | undefined,
  };
}
