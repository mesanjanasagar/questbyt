// Data masking for logs – PCI-DSS compliance

export function maskCardNumber(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `**** **** **** ${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length < 2) return '***@***';
  return `${local[0]}***@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return '****';
  return `****${phone.slice(-4)}`;
}

export function maskApiKey(key: string): string {
  if (key.length < 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function sanitizeLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'passwordHash', 'cardNumber', 'cvv', 'pin', 'secret', 'token', 'apiKey'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = 'REDACTED';
    } else {
      result[key] = value;
    }
  }

  return result;
}