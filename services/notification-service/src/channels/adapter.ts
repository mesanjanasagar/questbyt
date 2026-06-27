import type { NotificationChannel } from '@pos/shared-types';

// ───────────────────────────────────────────
// Channel adapters – mock implementations for dev
// In production: implement real API calls to WhatsApp Business API, SendGrid, Twilio, etc.
// ───────────────────────────────────────────

export async function sendWhatsApp(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  console.info(`[WhatsApp] ${to}:\n${body}\n`);
  return { success: true };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  console.info(`[Email] ${subject} → ${to}:\n${body}\n`);
  return { success: true };
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  console.info(`[SMS] ${to}:\n${body}\n`);
  return { success: true };
}

export async function sendPush(deviceId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  console.info(`[Push] ${deviceId} ${title}: ${body}`);
  return { success: true };
}

// ───────────────────────────────────────────
// Dispatcher – route to correct channel
// ───────────────────────────────────────────

export async function sendNotification(
  channel: NotificationChannel,
  recipient: string,
  subject: string | undefined,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (channel) {
      case 'whatsapp':
        return await sendWhatsApp(recipient, body);
      case 'email':
        return await sendEmail(recipient, subject || 'Notification', body);
      case 'sms':
        return await sendSMS(recipient, body);
      case 'push':
        return await sendPush(recipient, subject || 'Notification', body);
      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}