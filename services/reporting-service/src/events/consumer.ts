import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { ingestOrder } from '../services/reporting.service';
import type { DomainEvent, OrderCreatedEvent, OrderStatusUpdatedEvent } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'reporting-service-consumer',
  brokers: [config.KAFKA_BROKER_URL],
});

let consumer: Consumer | null = null;

// In-flight order cache to accumulate items before marking complete
// In production this would be Redis; for now a local map is fine for a single instance
const pendingOrders = new Map<string, PendingOrder>();

interface PendingOrder {
  id: string;
  storeId: string;
  customerId?: string;
  cashierId: string;
  orderType: string;
  platform: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netRevenue: number;
  itemCount: number;
  completedAt?: string;
  createdAt: string;
  items: Array<{
    id: string;
    menuItemId: string;
    menuItemName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'reporting-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'pos-events', fromBeginning: false });

  await consumer.run({ eachMessage: handleMessage });
  console.info('Kafka consumer connected (reporting-service), listening on pos-events');
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: DomainEvent<unknown>;
  try {
    event = JSON.parse(message.value.toString()) as DomainEvent<unknown>;
  } catch {
    console.warn('reporting-service: failed to parse Kafka message');
    return;
  }

  try {
    switch (event.eventType) {
      case 'order.created':
        handleOrderCreated(event as DomainEvent<OrderCreatedEvent>);
        break;
      case 'order.completed':
        await handleOrderCompleted(event as DomainEvent<OrderStatusUpdatedEvent>);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`reporting-service: error handling event ${event.eventType}:`, err);
  }
}

// ----------------------------------------
// order.created -> cache order metadata for later ingestion
// ----------------------------------------

function handleOrderCreated(event: DomainEvent<OrderCreatedEvent>): void {
  const d = event.data;
  pendingOrders.set(d.orderId, {
    id: d.orderId,
    storeId: d.storeId,
    cashierId: d.cashierId,
    orderType: d.orderType,
    platform: 'direct',
    status: 'pending',
    totalAmount: d.totalAmount,
    taxAmount: 0,
    discountAmount: 0,
    commissionRate: 0,
    commissionAmount: 0,
    netRevenue: d.totalAmount,
    itemCount: d.items?.length ?? 0,
    createdAt: event.timestamp,
    items: (d.items ?? []).map((item, idx) => ({
      id: `${d.orderId}-${idx}`,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice,
    })),
  });
}

// ----------------------------------------
// order.completed -> flush to reporting DB
// ----------------------------------------

async function handleOrderCompleted(event: DomainEvent<OrderStatusUpdatedEvent>): Promise<void> {
  const orderId = event.aggregateId;
  const pending = pendingOrders.get(orderId);

  if (!pending) {
    // Not in cache (service restart) - ingest with minimal data
    await ingestOrder({
      id: orderId,
      storeId: event.storeId,
      cashierId: 'unknown',
      orderType: 'dine-in',
      platform: 'direct',
      status: 'completed',
      totalAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      commissionRate: 0,
      commissionAmount: 0,
      netRevenue: 0,
      itemCount: 0,
      completedAt: event.timestamp,
      createdAt: event.timestamp,
    });
    return;
  }

  pending.status = 'completed';
  pending.completedAt = event.timestamp;

  await ingestOrder(pending);
  pendingOrders.delete(orderId);

  console.info(`reporting-service: ingested completed order ${orderId}`);
}

export async function disconnectConsumer(): Promise<void> {
  await consumer?.disconnect();
}