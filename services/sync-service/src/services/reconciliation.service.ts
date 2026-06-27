import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { executeQuery, executeQuerySingle, executeTransaction } from '../db/client';
import { PoolClient } from 'pg';

export interface ReconciliationLog {
  id: string;
  deviceId: string;
  storeId: string;
  syncQueueId: string;
  reconciliationType: string;
  localState: Record<string, unknown>;
  remoteState: Record<string, unknown>;
  resolvedState: Record<string, unknown> | null;
  resolutionStrategy: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ConflictResolution {
  id: string;
  reconciliationLogId: string;
  conflictType: string;
  fieldName: string | null;
  localValue: Record<string, unknown> | null;
  remoteValue: Record<string, unknown> | null;
  resolvedValue: Record<string, unknown>;
  resolutionMethod: string;
  createdAt: string;
}

/**
 * Reconcile offline order with remote state
 * Conflict resolution priority: Remote > Local (keep latest remote state)
 */
export async function reconcileOrder(
  queueItem: any,
  remoteOrder: Record<string, unknown> | null
): Promise<ReconciliationLog> {
  return executeTransaction<ReconciliationLog>(async (client: PoolClient) => {
    const logId = uuidv4();

    if (!remoteOrder) {
      // Remote order doesn't exist → Create it from offline data
      try {
        const createResponse = await axios.post(
          `${config.ORDER_SERVICE_URL}/api/v1/orders`,
          queueItem.payload,
          {
            headers: {
              'x-internal-service': 'sync-service',
              'x-correlation-id': logId,
            },
          }
        );

        const resolvedState = createResponse.data.data;

        await client.query(
          `INSERT INTO reconciliation_logs
          (id, device_id, store_id, sync_queue_id, reconciliation_type, local_state, remote_state, resolved_state, resolution_strategy)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'create')`,
          [
            logId,
            queueItem.device_id,
            queueItem.store_id,
            queueItem.id,
            'order_create',
            JSON.stringify(queueItem.payload),
            JSON.stringify(null),
            JSON.stringify(resolvedState),
          ]
        );

        return {
          id: logId,
          deviceId: queueItem.device_id,
          storeId: queueItem.store_id,
          syncQueueId: queueItem.id,
          reconciliationType: 'order_create',
          localState: queueItem.payload,
          remoteState: {},
          resolvedState,
          resolutionStrategy: 'create',
          createdAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
        };
      } catch (err) {
        throw new Error(`Failed to create remote order: ${(err as Error).message}`);
      }
    }

    // Remote exists → Reconcile conflicts
    const conflicts = detectConflicts(queueItem.payload, remoteOrder);

    if (conflicts.length === 0) {
      // No conflicts → Remote state is source of truth
      const log = await client.query(
        `INSERT INTO reconciliation_logs
        (id, device_id, store_id, sync_queue_id, reconciliation_type, local_state, remote_state, resolved_state, resolution_strategy, resolved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'use_remote', CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          logId,
          queueItem.device_id,
          queueItem.store_id,
          queueItem.id,
          'order_reconcile',
          JSON.stringify(queueItem.payload),
          JSON.stringify(remoteOrder),
          JSON.stringify(remoteOrder),
        ]
      );

      return log.rows[0];
    }

    // Conflicts exist → Resolve
    const resolvedState = resolveConflicts(queueItem.payload, remoteOrder, conflicts);

    const log = await client.query(
      `INSERT INTO reconciliation_logs
      (id, device_id, store_id, sync_queue_id, reconciliation_type, local_state, remote_state, resolved_state, resolution_strategy, resolved_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'merged', CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        logId,
        queueItem.device_id,
        queueItem.store_id,
        queueItem.id,
        'order_reconcile',
        JSON.stringify(queueItem.payload),
        JSON.stringify(remoteOrder),
        JSON.stringify(resolvedState),
      ]
    );

    // Record each conflict resolution
    for (const conflict of conflicts) {
      await client.query(
        `INSERT INTO conflict_resolutions
        (reconciliation_log_id, conflict_type, field_name, local_value, remote_value, resolved_value, resolution_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          logId,
          conflict.type,
          conflict.field,
          JSON.stringify(conflict.localValue),
          JSON.stringify(conflict.remoteValue),
          JSON.stringify(conflict.resolvedValue),
          'use_remote_timestamp',
        ]
      );
    }

    return log.rows[0];
  });
}

function detectConflicts(
  localState: Record<string, unknown>,
  remoteState: Record<string, unknown>
): Array<{ type: string; field: string; localValue: unknown; remoteValue: unknown; resolvedValue: unknown }> {
  const conflicts = [];

  // Compare key fields
  const fieldsToCheck = ['status', 'totalAmount', 'items', 'discounts', 'paymentStatus'];

  for (const field of fieldsToCheck) {
    const localValue = localState[field];
    const remoteValue = remoteState[field];

    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      conflicts.push({
        type: 'field_mismatch',
        field,
        localValue,
        remoteValue,
        resolvedValue: remoteValue, // Remote wins
      });
    }
  }

  return conflicts;
}

function resolveConflicts(
  localState: Record<string, unknown>,
  remoteState: Record<string, unknown>,
  conflicts: any[]
): Record<string, unknown> {
  // Start with remote as base (remote is source of truth)
  const resolved = { ...remoteState };

  // Override with local values for certain fields (e.g., pending actions)
  for (const conflict of conflicts) {
    if (conflict.field === 'items' && Array.isArray(localState.items)) {
      // Merge items: keep remote items but add locally-added items
      const remoteItemIds = new Set((remoteState.items as any[])?.map(i => i.id) ?? []);
      const localOnlyItems = (localState.items as any[]).filter(i => !remoteItemIds.has(i.id));
      resolved.items = [...(remoteState.items as any[] ?? []), ...localOnlyItems];
    }
  }

  return resolved;
}

/**
 * Reconcile inventory after order sync
 */
export async function reconcileInventory(
  orderId: string,
  storeId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  try {
    await axios.post(
      `${config.INVENTORY_SERVICE_URL}/api/v1/inventory/deduct`,
      {
        orderId,
        storeId,
        items,
      },
      {
        headers: {
          'x-internal-service': 'sync-service',
        },
      }
    );
  } catch (err) {
    console.warn(`[Inventory Reconciliation] Failed for order ${orderId}:`, (err as Error).message);
    // Graceful degradation: don't fail sync if inventory fails
  }
}

export async function getReconciliationHistory(
  storeId: string,
  limit: number = 100
): Promise<ReconciliationLog[]> {
  return executeQuery<ReconciliationLog>(
    `SELECT * FROM reconciliation_logs
    WHERE store_id = $1
    ORDER BY created_at DESC
    LIMIT $2`,
    [storeId, limit]
  );
}