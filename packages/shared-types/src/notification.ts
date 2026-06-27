//
// Notification & multi-channel delivery types
//

export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'push';

export type NotificationTrigger =
  | 'order.completed'
  | 'payment.processed'
  | 'inventory.low_stock'
  | 'customer.segment_changed'
  | 'campaign.sent'
  | 'inventory.out_of_stock';

export interface NotificationTemplate {
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  subject?: string; // for email
  body: string;
  tokens: string[]; // {{customer_name}}, {{store_name}}, etc
}

export interface Notification {
  id: string;
  storeId: string;
  recipient: string; // phone, email, or device ID depending on channel
  channel: NotificationChannel;
  trigger: NotificationTrigger;
  subject?: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface ChannelConfig {
  whatsapp?: { apiUrl: string; token: string; phoneId: string };
  email?: { smtpHost: string; smtpPort: number; fromEmail: string };
  sms?: { apiUrl: string; apiKey: string };
  push?: { serviceUrl: string; apiKey: string };
}