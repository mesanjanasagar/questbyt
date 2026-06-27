import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { fireCampaigns } from '../services/campaign.service';
import type {
  DomainEvent,
  CustomerCreatedEvent,
  CustomerSegmentChangedEvent,
  CustomerPointsEarnedEvent,
} from '@pos/shared-types';
import type { Customer } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'marketing-service-consumer',
  brokers: [config.KAFKA_BROKER_URL],
});

let consumer: Consumer | null = null;

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'marketing-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'pos-events', fromBeginning: false });

  await consumer.run({ eachMessage: handleMessage });
  console.info('Kafka consumer connected (marketing-service), listening on pos-events');
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: DomainEvent<unknown>;
  try {
    event = JSON.parse(message.value.toString()) as DomainEvent<unknown>;
  } catch {
    console.warn('marketing-service: failed to parse Kafka message');
    return;
  }

  try {
    switch (event.eventType) {
      case 'customer.created':
        await handleCustomerCreated(event as DomainEvent<CustomerCreatedEvent>);
        break;
      case 'customer.segment_changed':
        await handleSegmentChanged(event as DomainEvent<CustomerSegmentChangedEvent>);
        break;
      case 'customer.points_earned':
        await handlePointsEarned(event as DomainEvent<CustomerPointsEarnedEvent>);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`marketing-service: error handling event ${event.eventType}:`, err);
  }
}

// ——————————————————————————————————————————
// customer.created → Welcome Flow campaigns
// ——————————————————————————————————————————

async function handleCustomerCreated(event: DomainEvent<CustomerCreatedEvent>): Promise<void> {
  const { customerId, storeId, name, phone, email } = event.data;

  const customer = await fetchCustomer(customerId, storeId);
  if (!customer) {
    // Build minimal stub if customer-service unreachable
    const stub: Customer = {
      id: customerId,
      storeId,
      name,
      phone,
      email,
      loyaltyPoints: 0,
      loyaltyTier: 'silver',
      segment: 'new',
      totalOrders: 0,
      totalSpend: 0,
      averageOrderValue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fireCampaigns('customer.created', stub);
    return;
  }

  await fireCampaigns('customer.created', customer);
}

// ——————————————————————————————————————————
// customer.segment_changed → Retention / Win-Back campaigns
// ——————————————————————————————————————————

async function handleSegmentChanged(
  event: DomainEvent<CustomerSegmentChangedEvent>,
): Promise<void> {
  const { customerId, storeId, previousSegment, newSegment } = event.data;

  const customer = await fetchCustomer(customerId, storeId);
  if (!customer) return;

  await fireCampaigns('customer.segment_changed', customer, {
    fromSegment: previousSegment,
  });

  console.info(
    `marketing-service: segment change ${previousSegment} → ${newSegment} for customer ${customerId}`,
  );
}

// ——————————————————————————————————————————
// customer.points_earned → Loyalty milestone campaigns
// ——————————————————————————————————————————

async function handlePointsEarned(
  event: DomainEvent<CustomerPointsEarnedEvent>,
): Promise<void> {
  const { customerId, storeId } = event.data;

  const customer = await fetchCustomer(customerId, storeId);
  if (!customer) return;

  await fireCampaigns('customer.points_earned', customer);
}

// ——————————————————————————————————————————
// Fetch full customer from customer-service
// ——————————————————————————————————————————

async function fetchCustomer(customerId: string, _storeId: string): Promise<Customer | null> {
  try {
    const res = await fetch(`${config.CUSTOMER_SERVICE_URL}/api/v1/customers/${customerId}`, {
      headers: { 'X-Internal-Service': 'marketing-service' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Customer };
    return json.data ?? null;
  } catch (err) {
    console.warn(`marketing-service: could not fetch customer ${customerId}:`, (err as Error).message);
    return null;
  }
}

export async function disconnectConsumer(): Promise<void> {
  await consumer?.disconnect();
}