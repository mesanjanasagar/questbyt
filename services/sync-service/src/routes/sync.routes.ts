import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateOrThrow } from '@pos/shared-utils';
import { authenticate } from '../middleware/authenticate';
import * as queueService from '../services/queue.service';
import * as reconciliationService from '../services/reconciliation.service';

const router = Router();

// Add item to sync queue (offline operations)
router.post('/queue', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = validateOrThrow(
      z.object({
        deviceId: z.string().uuid(),
        operationType: z.enum(['order_create', 'order_update', 'order_cancel', 'payment']),
        resourceType: z.string(),
        resourceId: z.string().uuid(),
        data: z.record(z.unknown()),
      }),
      req.body
    );

    const item = await queueService.addToQueue(
      payload.deviceId,
      req.user!.storeId,
      payload.operationType,
      payload.resourceType,
      payload.resourceId,
      payload.data
    );

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// Get pending items for a device
router.get('/queue/:deviceId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const { limit = '50' } = req.query;

    const items = await queueService.getPendingItems(deviceId, parseInt(limit as string));

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (err) {
    next(err);
  }
});

// Reconcile pending items (triggered when device reconnects)
router.post('/reconcile/:deviceId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const storeId = req.user!.storeId;

    const pendingItems = await queueService.getPendingItems(deviceId, 50);

    if (pendingItems.length === 0) {
      res.json({ success: true, data: [], reconciled: 0 });
      return;
    }

    const results = [];
    let reconciledCount = 0;

    for (const item of pendingItems) {
      try {
        // Fetch remote state if exists
        let remoteState = null;
        if (item.resourceType === 'order') {
          try {
            const response = await fetch(
              `http://localhost:3001/api/v1/orders/${item.resourceId}`,
              {
                headers: { 'x-internal-service': 'sync-service' },
              }
            );
            if (response.ok) {
              const data = await response.json();
              remoteState = data.data;
            }
          } catch {
            // Order doesn't exist remotely
          }
        }

        // Reconcile
        const log = await reconciliationService.reconcileOrder(item, remoteState);

        // Mark as synced
        await queueService.markSynced(item.id, log.resolvedState);

        // Reconcile inventory if it's an order
        if (item.resourceType === 'order' && item.operationType === 'order_create') {
          const orderData = item.payload as any;
          if (orderData.items) {
            await reconciliationService.reconcileInventory(item.resourceId, storeId, orderData.items);
          }
        }

        results.push(log);
        reconciledCount++;
      } catch (err) {
        console.error(`[Reconciliation] Failed for item ${item.id}:`, err);
        await queueService.markFailed(item.id, (err as Error).message, item.retryCount);
        results.push({ error: (err as Error).message, itemId: item.id });
      }
    }

    res.json({
      success: true,
      data: results,
      reconciled: reconciledCount,
      total: pendingItems.length,
    });
  } catch (err) {
    next(err);
  }
});

// Get reconciliation history
router.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '100' } = req.query;
    const storeId = req.user!.storeId;

    const history = await reconciliationService.getReconciliationHistory(
      storeId,
      parseInt(limit as string)
    );

    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    next(err);
  }
});

// Get failed items
router.get('/failed', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '100' } = req.query;
    const storeId = req.user!.storeId;

    const items = await queueService.getFailedItems(storeId, parseInt(limit as string));

    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    next(err);
  }
});

// Retry failed reconciliation
router.post('/retry/:itemId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    // Placeholder: would implement actual retry logic
    res.json({ success: true, message: 'Retry queued' });
  } catch (err) {
    next(err);
  }
});

export default router;