import type { Response } from 'express';

interface SSEClient {
  res: Response;
  storeId: string;
}

class SSEBroadcaster {
  private clients: Map<string, Set<SSEClient>> = new Map();

  connect(storeId: string, res: Response): () => void {
    if (!this.clients.has(storeId)) {
      this.clients.set(storeId, new Set());
    }
    const client: SSEClient = { res, storeId };
    this.clients.get(storeId)!.add(client);
    return () => {
      this.clients.get(storeId)?.delete(client);
    };
  }

  broadcast(storeId: string, event: string, data: unknown): void {
    const clients = this.clients.get(storeId);
    if (!clients || clients.size === 0) return;
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const dead: SSEClient[] = [];
    for (const client of clients) {
      try {
        client.res.write(message);
      } catch {
        dead.push(client);
      }
    }
    for (const c of dead) clients.delete(c);
  }

  clientCount(storeId?: string): number {
    if (storeId) return this.clients.get(storeId)?.size ?? 0;
    let total = 0;
    for (const s of this.clients.values()) total += s.size;
    return total;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
