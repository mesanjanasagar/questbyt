import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { deductStockForOrder } from '../services/inventory.service';
import { publishEvent } from './producer';
import type { DomainEvent, OrderCreatedEvent } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'inventory-service-consumer',
  brokers: [config.KAFKA_BROKER_URL],
});

let consumer: Consumer | null = null;

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'inventory-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'pos-events', fromBeginning: false });

  await consumer.run({ eachMessage: handleMessage });
  console.info('Kafka consumer connected (inventory-service), listening on pos-events');
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: DomainEvent<unknown>;
  try {
    event = JSON.parse(message.value.toString()) as DomainEvent<unknown>;
  } catch {
    console.warn('inventory-service: failed to parse Kafka message');
    return;
  }

  try {
    switch (event.eventType) {
      case 'order.completed':
        await handleOrderCompleted(event as DomainEvent<OrderCreatedEvent>);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`inventory-service: error handling event ${event.eventType}:`, err);
  }
}

// ================================================
// order.completed -> deduct stock from inventory
// We deduct stock after order completion (payment confirmed)
// ================================================

async function handleOrderCompleted(event: DomainEvent<OrderCreatedEvent>): Promise<void> {
  const { orderId, storeId, items } = event.data;

  if (!items || items.length === 0) return;

  const result = await deductStockForOrder(
    storeId,
    orderId,
    items.map((i) => ({ productId: i.menuItemId, quantity: i.quantity })),
  );

  console.info(
    `inventory-service: deducted stock for order ${orderId}: ${result.deductedItems.length} items`,
  );

  // Publish deduction event
  publishEvent(
    'inventory.deducted',
    storeId,
    orderId,
    'order',
    {
      orderId,
      storeId,
      items: result.deductedItems,
    },
  ).catch((err) => console.warn('Failed to publish inventory.deducted:', err.message));
}

export async function disconnectConsumer(): Promise<void> {
  await consumer?.disconnect();
}