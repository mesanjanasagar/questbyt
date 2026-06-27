import type { ConversationSession, QueryIntent } from '@pos/shared-types';

// In-memory session store - keyed by phone number
// In production: replace with Redis with TTL
const sessions = new Map<string, ConversationSession>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getSession(phone: string): ConversationSession | undefined {
  const session = sessions.get(phone);
  if (!session) return undefined;

  // Expire stale sessions
  const age = Date.now() - new Date(session.lastQueryAt).getTime();
  if (age > SESSION_TTL_MS) {
    sessions.delete(phone);
    return undefined;
  }
  return session;
}

export function upsertSession(
  phone: string,
  storeId: string,
  intent: QueryIntent,
): ConversationSession {
  const session: ConversationSession = {
    phone,
    storeId,
    lastIntent: intent,
    lastQueryAt: new Date().toISOString(),
  };
  sessions.set(phone, session);
  return session;
}

export function clearSession(phone: string): void {
  sessions.delete(phone);
}

export function getActiveSessions(): number {
  return sessions.size;
}