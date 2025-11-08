import { LCE } from '../types';
import { LSSSession, SessionStorageAdapter } from './types';

export class InMemorySessionStorage implements SessionStorageAdapter {
  private readonly sessions = new Map<string, LSSSession>();

  async load(threadId: string): Promise<LSSSession | null> {
    return this.sessions.get(threadId) ?? null;
  }

  async save(session: LSSSession, _ttlMs: number): Promise<void> {
    this.sessions.set(session.threadId, session);
  }

  async delete(threadId: string): Promise<boolean> {
    return this.sessions.delete(threadId);
  }

  async loadAll(): Promise<LSSSession[]> {
    return Array.from(this.sessions.values());
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }

  async cleanup(now: Date, ttlMs: number): Promise<void> {
    const expiry = now.getTime() - ttlMs;
    for (const [threadId, session] of this.sessions.entries()) {
      if (session.metadata.updatedAt.getTime() < expiry) {
        this.sessions.delete(threadId);
      }
    }
  }
}

export interface RedisCompatibleClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: number | string, ...args: Array<string | number>): Promise<[string, string[]]>;
}

const DEFAULT_SCAN_COUNT = 100;

export class RedisSessionStorage implements SessionStorageAdapter {
  constructor(
    private readonly client: RedisCompatibleClient,
    private readonly options: { keyPrefix?: string; scanCount?: number } = {},
  ) {}

  private get keyPrefix(): string {
    return this.options.keyPrefix ?? 'lss:session:';
  }

  private get scanCount(): number {
    return this.options.scanCount ?? DEFAULT_SCAN_COUNT;
  }

  async load(threadId: string): Promise<LSSSession | null> {
    const raw = await this.client.get(this.key(threadId));
    if (!raw) {
      return null;
    }
    return deserializeSession(raw);
  }

  async save(session: LSSSession, ttlMs: number): Promise<void> {
    const payload = serializeSession(session);
    await this.client.set(this.key(session.threadId), payload, 'PX', ttlMs);
  }

  async delete(threadId: string): Promise<boolean> {
    const deleted = await this.client.del(this.key(threadId));
    return deleted > 0;
  }

  async loadAll(): Promise<LSSSession[]> {
    const keys = await this.scanAllKeys();
    if (keys.length === 0) {
      return [];
    }
    const sessions = await Promise.all(
      keys.map(async (key) => {
        const raw = await this.client.get(key);
        return raw ? deserializeSession(raw) : null;
      }),
    );
    return sessions.filter((session): session is LSSSession => session !== null);
  }

  async clear(): Promise<void> {
    const keys = await this.scanAllKeys();
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  private async scanAllKeys(): Promise<string[]> {
    let cursor: string | number = '0';
    const keys: string[] = [];
    const pattern = `${this.keyPrefix}*`;

    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', this.scanCount);
      cursor = typeof nextCursor === 'number' ? String(nextCursor) : nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private key(threadId: string): string {
    return `${this.keyPrefix}${threadId}`;
  }
}

export interface SerializableSession {
  threadId: string;
  coherence: number;
  messages: Array<{
    lce: LCE;
    payload?: unknown;
    timestamp: string;
  }>;
  metrics: {
    coherence: {
      overall: number;
      intentSimilarity: number;
      affectStability: number;
      semanticAlignment: number;
    };
    previousCoherence?: {
      overall: number;
      intentSimilarity: number;
      affectStability: number;
      semanticAlignment: number;
    };
    driftEvents: Array<{
      type: 'coherence_drop' | 'topic_shift';
      severity: 'low' | 'medium' | 'high';
      timestamp: string;
      details?: Record<string, unknown>;
      threadId?: string;
    }>;
    updatedAt: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  };
}

export function serializeSession(session: LSSSession): string {
  const serializable: SerializableSession = {
    threadId: session.threadId,
    coherence: session.coherence,
    messages: session.messages.map((message) => ({
      lce: message.lce,
      payload: message.payload,
      timestamp: message.timestamp.toISOString(),
    })),
    metrics: {
      coherence: session.metrics.coherence,
      previousCoherence: session.metrics.previousCoherence,
      driftEvents: session.metrics.driftEvents.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
      updatedAt: session.metrics.updatedAt.toISOString(),
    },
    metadata: {
      createdAt: session.metadata.createdAt.toISOString(),
      updatedAt: session.metadata.updatedAt.toISOString(),
      messageCount: session.metadata.messageCount,
    },
  };

  return JSON.stringify(serializable);
}

export function deserializeSession(payload: string): LSSSession {
  const data = JSON.parse(payload) as SerializableSession;
  return {
    threadId: data.threadId,
    coherence: data.coherence,
    messages: data.messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp),
    })),
    metrics: {
      coherence: data.metrics.coherence,
      previousCoherence: data.metrics.previousCoherence,
      driftEvents: data.metrics.driftEvents.map((event) => ({
        ...event,
        timestamp: new Date(event.timestamp),
      })),
      updatedAt: new Date(data.metrics.updatedAt),
    },
    metadata: {
      ...data.metadata,
      createdAt: new Date(data.metadata.createdAt),
      updatedAt: new Date(data.metadata.updatedAt),
    },
  };
}
