import { Router, type IRouter } from 'express';
import { config, getStoreIdForPhone } from '../config';
import { parseQuery } from '../nlu/router';
import { executeQuery } from '../engine/query.engine';
import { generateRecommendations } from '../engine/recommendation.engine';
import { formatResponse, formatRecommendations } from '../engine/formatter';
import { upsertSession } from '../session/context';
import type { WhatsAppMessage } from '@pos/shared-types';

const router: IRouter = Router();

// ---------------------------------------------
// GET /webhook - WhatsApp verification handshake
// ---------------------------------------------

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
    console.info('ai-manager: WhatsApp webhook verified');
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: 'Forbidden' });
});

// ---------------------------------------------
// POST /webhook - Inbound WhatsApp messages
// ---------------------------------------------

router.post('/', async (req, res) => {
  // Acknowledge immediately (WhatsApp requires <5s response)
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body as WhatsAppWebhookPayload;
    const messages = extractMessages(body);

    for (const msg of messages) {
      await handleMessage(msg);
    }
  } catch (err) {
    console.error('ai-manager: webhook processing error:', err);
  }
});

// ---------------------------------------------
// POST /query - Direct API query (for dashboard / testing without WhatsApp)
// ---------------------------------------------

router.post('/query', async (req, res, next) => {
  try {
    const { storeId, text } = req.body as { storeId?: string; text?: string };
    if (!storeId || !text) {
      res.status(400).json({ success: false, error: 'storeId and text are required' });
      return;
    }

    const parsed = parseQuery(text);
    let reply: string;

    if (parsed.intent === 'ai.recommendation') {
      const recs = await generateRecommendations(storeId);
      reply = formatRecommendations(recs);
    } else {
      const result = await executeQuery(parsed, storeId);
      reply = formatResponse(result);
    }

    res.json({ success: true, data: { intent: parsed.intent, reply } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------
// Core message handler
// ---------------------------------------------

async function handleMessage(msg: WhatsAppMessage): Promise<void> {
  const phone = normalisePhone(msg.from);
  const storeId = getStoreIdForPhone(phone);

  if (!storeId) {
    // Unknown manager - send onboarding message
    await sendWhatsApp(
      phone,
      'Your number is not registered as a manager. Contact your admin to link your WhatsApp to a store.',
    );
    return;
  }

  console.info(`ai-manager: message from ${phone} → "${msg.text}"`);

  const parsed = parseQuery(msg.text);
  upsertSession(phone, storeId, parsed.intent);

  let reply: string;
  try {
    if (parsed.intent === 'ai.recommendation') {
      const recs = await generateRecommendations(storeId);
      reply = formatRecommendations(recs);
    } else {
      const result = await executeQuery(parsed, storeId);
      reply = formatResponse(result);
    }
  } catch (err) {
    console.error('ai-manager: query error:', err);
    reply = 'Sorry, I had trouble fetching that data. Please try again.';
  }

  await sendWhatsApp(phone, reply);
}

// ---------------------------------------------
// Send WhatsApp message via Business API
// ---------------------------------------------

async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_ID) {
    // Dev mode - just log
    console.info(`[WhatsApp MOCK] → ${to}:\n${text}\n`);
    return;
  }

  try {
    const url = `${config.WHATSAPP_API_URL}/${config.WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`ai-manager: WhatsApp send failed (${res.status}):`, err);
    }
  } catch (err) {
    console.error('ai-manager: WhatsApp API error:', err);
  }
}

// ---------------------------------------------
// Extract messages from WhatsApp webhook payload
// ---------------------------------------------

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
        }>;
      };
    }>;
  }>;
}

function extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === 'text' && msg.text?.body) {
          messages.push({
            from: msg.from,
            text: msg.text.body,
            timestamp: msg.timestamp,
            messageId: msg.id,
          });
        }
      }
    }
  }
  return messages;
}

function normalisePhone(phone: string): string {
  // Remove + prefix if present
  return phone.replace(/^\+/, '');
}

export default router;