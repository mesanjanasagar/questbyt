import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeQuerySingle } from '../db/client';

export interface SyncQueueItem {
  id: string;
  deviceId: string;
  storeId: string;
  operationType: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  syncedAt: string | null;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage: string | null;
  retryCount: number;
}

export async function addToQueue(
  deviceId: string,
  storeId: string,
  operationType: string,
  resourceType: string,
  resourceId: string,
  payload: Record<string, unknown>
): Promise<SyncQueueItem> {
  const id = uuidv4();

  await executeQuery(
    `INSERT INTO sync_queue (id, device_id, store_id, operation_type, resource_type, resource_id, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [id, deviceId, storeId, operationType, resourceType, resourceId, JSON.stringify(payload)]
  );

  const item = await executeQuerySingle<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE id = $1',
    [id]
  );

  if (!item) throw new Error('Failed to create sync queue item');
  return item;
}

export async function getPendingItems(
  deviceId: string,
  limit: number = 50
): Promise<SyncQueueItem[]> {
  return executeQuery<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE device_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [deviceId, limit]
  );
}

export async function markSynced(
  queueItemId: string,
  _syncedState: Record<string, unknown> | null = null
): Promise<void> {
  await executeQuery(
    `UPDATE sync_queue
     SET status = 'synced', synced_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [queueItemId]
  );
}

export async function markFailed(
  queueItemId: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  const newRetryCount = retryCount + 1;
  const status = newRetryCount >= 3 ? 'failed' : 'pending';

  await executeQuery(
    `UPDATE sync_queue
     SET status = $1, error_message = $2, retry_count = $3
     WHERE id = $4`,
    [status, errorMessage, newRetryCount, queueItemId]
  );
}

export async function getFailedItems(
  storeId: string,
  limit: number = 100
): Promise<SyncQueueItem[]> {
  return executeQuery<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE store_id = $1 AND status = 'failed'
     ORDER BY created_at DESC
     LIMIT $2`,
    [storeId, limit]
  );
}

export async function clearSyncedItems(
  deviceId: string,
  beforeDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<number> {
  const result = await executeQuery(
    `DELETE FROM sync_queue
     WHERE device_id = $1 AND status = 'synced' AND synced_at < $2`,
    [deviceId, beforeDate.toISOString()]
  );

  return result.length;
}