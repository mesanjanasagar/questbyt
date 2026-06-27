import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';
import { generateId } from '@pos/shared-utils';
import type { DomainEvent, EventType } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: [config.KAFKA_BROKER_URL],
});

let producer: Producer | null = null;

export async function connectProducer(): Promise<void> {
  producer = kafka.producer();
  await producer.connect();
  console.info('Kafka producer connected (order-service)');
}

export async function publishEvent<T>(
  eventType: EventType,
  storeId: string,
  aggregateId: string,
  aggregateType: string,
  data: T,
  correlationId?: string,
): Promise<void> {
  if (!producer) {
    // Graceful degradation: log but don't crash if Kafka unavailable in dev
    console.warn('Kafka producer not connected, skipping event:', eventType);
    return;
  }

  const event: DomainEvent<T> = {
    eventId: generateId(),
    eventType,
    aggregateId,
    aggregateType,
    version: 1,
    timestamp: new Date().toISOString(),
    sourceService: 'order-service',
    storeId,
    data,
    metadata: {
      correlationId: correlationId ?? generateId(),
    },
  };

  await producer.send({
    topic: 'pos-events',
    messages: [
      {
        key: storeId, // Partition by store_id for ordering
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect();
}