import { sendNotification } from '../channels/adapters';
import type { DomainEvent } from '@pos/shared-types';

// ───────────────────────────────────────────
// Notification router – maps events + channels + templates
// ───────────────────────────────────────────

export async function routeNotification(event: DomainEvent<unknown>): Promise<void> {
  const triggers: Array<{ channel: string; recipient: string; subject?: string; body: string }> = [];

  switch (event.eventType) {
    // Order completed → customer SMS
    case 'order.completed': {
      const d = event.data as any;
      triggers.push({
        channel: 'sms',
        recipient: d.customerPhone || d.customerId || '',
        body: `Your order #${d.orderId.slice(0, 8)} is ready! Thank you for ordering from us.`,
      });
      break;
    }

    // Payment processed → order confirmation email
    case 'payment.processed': {
      const d = event.data as any;
      triggers.push({
        channel: 'email',
        recipient: d.customerEmail || d.customerId || '',
        subject: 'Payment Received',
        body: `Payment of AED ${d.amount} received for order #${d.orderId.slice(0, 8)}.`,
      });
      break;
    }

    // Low stock alert → manager WhatsApp
    case 'inventory.low_stock': {
      const d = event.data as any;
      triggers.push({
        channel: 'whatsapp',
        recipient: '+971501234567', // Config this per store
        subject: 'Low Stock Alert',
        body: `Product ${d.productId} is running low (${d.currentStock} remaining). Reorder soon!`,
      });
      break;
    }

    // Customer segment changed → different campaigns
    case 'customer.segment_changed': {
      const d = event.data as any;
      if (d.newSegment === 'at_risk') {
        triggers.push({
          channel: 'whatsapp',
          recipient: d.customerId,
          body: 'We miss you! Here\'s 15% off your next order. Use code COMEBACK15.',
        });
      }
      break;
    }

    // Campaign sent → log for audit
    case 'campaign.sent': {
      console.info(`notification-service: campaign execution ${event.aggregateId}`);
      break;
    }

    // Inventory out of stock → alert
    case 'inventory.out_of_stock': {
      const d = event.data as any;
      triggers.push({
        channel: 'push',
        recipient: 'all-managers',
        body: `Product ${d.productName} is out of stock.`,
      });
      break;
    }

    default:
      // No action needed
      break;
  }

  // Send all triggered notifications in parallel
  await Promise.all(
    triggers.map((t) =>
      sendNotification(t.channel as any, t.recipient, t.subject, t.body).catch((err) =>
        console.error(`notification-service: failed to send ${t.channel}`, err),
      ),
    ),
  );
}