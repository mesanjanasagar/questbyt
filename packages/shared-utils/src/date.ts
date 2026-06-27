export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateString(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0];
}

export function isWithinDateRange(date: Date | string, from: string, to: string): boolean {
  const d = new Date(date).getTime();
  return d >= new Date(from).getTime() && d <= new Date(to).getTime();
}