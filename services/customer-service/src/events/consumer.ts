import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { recordOrderForCustomer } from '../services/customer.service';
import type { DomainEvent, PaymentProcessedEvent } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'customer-service-consumer',
  brokers: [config.KAFKA_BROKER_URL],
});

let consumer: Consumer | null = null;

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'customer-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'pos-events', fromBeginning: false });

  await consumer.run({ eachMessage: handleMessage });
  console.info('Kafka consumer connected (customer-service), listening on pos-events');
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: DomainEvent<unknown>;
  try {
    event = JSON.parse(message.value.toString()) as DomainEvent<unknown>;
  } catch {
    console.warn('customer-service: failed to parse Kafka message');
    return;
  }

  try {
    switch (event.eventType) {
      case 'payment.processed':
        await handlePaymentProcessed(event as DomainEvent<PaymentProcessedEvent>);
        break;
      default:
        // Ignore events not relevant to this service
        break;
    }
  } catch (err) {
    // Log but don't crash the consumer - bad messages go to dead-letter manually
    console.error(`customer-service: error handling event ${event.eventType}:`, err);
  }
}

// ----------------------------------------
// payment.processed -> update customer stats + loyalty
// Only processes orders that have a customer_id attached.
// The order-service attaches customer_id when the cashier selects a customer at checkout.
// ----------------------------------------

async function handlePaymentProcessed(
  event: DomainEvent<PaymentProcessedEvent>,
): Promise<void> {
  const { orderId, storeId, amount } = event.data;

  // We need to look up whether this order has a customer_id.
  // The payment event doesn't carry it, so we query order-service via HTTP.
  // This is intentionally a lightweight lookup - no Kafka coupling to order schema.
  const customerId = await fetchCustomerIdForOrder(orderId, storeId);
  if (!customerId) return; // walk-in order, no customer attached

  await recordOrderForCustomer(customerId, storeId, orderId, amount);
  console.info(`customer-service: recorded order ${orderId} for customer ${customerId}`);
}

// ----------------------------------------
// Fetch customer_id from order-service
// Returns null if not found or order has no customer
// ----------------------------------------

async function fetchCustomerIdForOrder(
  orderId: string,
  _storeId: string,
): Promise<string | null> {
  const orderServiceUrl = process.env.ORDER_SERVICE_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${orderServiceUrl}/api/v1/orders/${orderId}`, {
      headers: { 'X-Internal-Service': 'customer-service' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { customerId?: string } };
    return json.data?.customerId ?? null;
  } catch (err) {
    console.warn(`customer-service: could not fetch order ${orderId}:`, (err as Error).message);
    return null;
  }
}

export async function disconnectConsumer(): Promise<void> {
  await consumer?.disconnect();
}