import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { routeNotification } from '../services/notification.service';
import type { DomainEvent } from '@pos/shared-types';

const kafka = new Kafka({
  clientId: 'notification-service-consumer',
  brokers: [config.KAFKA_BROKER_URL],
});

let consumer: Consumer | null = null;

export async function connectConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'notification-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'pos-events', fromBeginning: false });
  await consumer.run({ eachMessage: handleMessage });
  console.info('Kafka consumer connected (notification-service), listening on pos-events');
}

async function handleMessage({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  let event: DomainEvent<unknown>;
  try {
    event = JSON.parse(message.value.toString()) as DomainEvent<unknown>;
  } catch {
    console.warn('notification-service: failed to parse Kafka message');
    return;
  }

  try {
    // Route any event that should trigger notifications
    await routeNotification(event);
  } catch (err) {
    console.error(`notification-service: error handling event ${event.eventType}:`, err);
  }
}

export async function disconnectConsumer(): Promise<void> {
  await consumer?.disconnect();
}