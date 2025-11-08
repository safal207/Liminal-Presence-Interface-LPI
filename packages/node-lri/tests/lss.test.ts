/**
 * LSS (Liminal Session Store) tests
 */

import { LSS, RedisCompatibleClient, RedisSessionStorage } from '../src/lss';
import type { CoherenceResult, DriftEvent } from '../src/lss';
import { LCE } from '../src/types';

class FakeRedis implements RedisCompatibleClient {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    this.evictExpired();
    const entry = this.store.get(key);
    return entry?.value ?? null;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK'> {
    let ttlMs: number | undefined;
    if (args[0] === 'PX' && typeof args[1] === 'number') {
      ttlMs = Number(args[1]);
    }

    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.store.set(key, { value: value.toString(), expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed++;
      }
    }
    return removed;
  }

  async scan(cursor: number | string, ...args: Array<string | number>): Promise<[string, string[]]> {
    this.evictExpired();
    let pattern = '*';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'MATCH' && args[i + 1] !== undefined) {
        pattern = String(args[i + 1]);
        break;
      }
    }

    const keys = Array.from(this.store.keys()).filter((key) => this.matches(pattern, key));
    return ['0', keys];
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private matches(pattern: string, key: string): boolean {
    if (pattern === '*') {
      return true;
    }
    if (pattern.endsWith('*')) {
      return key.startsWith(pattern.slice(0, -1));
    }
    return key === pattern;
  }
}

describe('LSS (Liminal Session Store)', () => {
  let lss: LSS;

  beforeEach(() => {
    lss = new LSS();
  });

  afterEach(async () => {
    await lss.destroy();
  });

  describe('store and retrieve', () => {
    it('should store message in new session', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);

      const session = await lss.getSession('thread-1');
      expect(session).toBeDefined();
      expect(session?.threadId).toBe('thread-1');
      expect(session?.messages.length).toBe(1);
      expect(session?.messages[0].lce).toEqual(lce);
    });

    it('should store multiple messages in same session', async () => {
      const lce1: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };
      const lce2: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce1);
      await lss.store('thread-1', lce2);

      const session = await lss.getSession('thread-1');
      expect(session?.messages.length).toBe(2);
      expect(session?.messages[0].lce.intent.type).toBe('ask');
      expect(session?.messages[1].lce.intent.type).toBe('tell');
    });

    it('should store payload with message', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = { text: 'Hello, world!' };

      await lss.store('thread-1', lce, payload);

      const session = await lss.getSession('thread-1');
      expect(session?.messages[0].payload).toEqual(payload);
    });

    it('should return null for non-existent session', async () => {
      const session = await lss.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should handle multiple sessions', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      await lss.store('thread-2', lce);
      await lss.store('thread-3', lce);

      const sessions = await lss.getAllSessions();
      expect(sessions.length).toBe(3);
    });

    it('should delete session', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      const deleted = await lss.deleteSession('thread-1');

      expect(deleted).toBe(true);
      const session = await lss.getSession('thread-1');
      expect(session).toBeNull();
    });

    it('should clear all sessions', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      await lss.store('thread-2', lce);
      await lss.clear();

      const sessions = await lss.getAllSessions();
      expect(sessions.length).toBe(0);
    });
  });

  describe('metadata', () => {
    it('should track message count', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      await lss.store('thread-1', lce);
      await lss.store('thread-1', lce);

      const session = await lss.getSession('thread-1');
      expect(session?.metadata.messageCount).toBe(3);
    });

    it('should track timestamps', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const before = new Date();
      await lss.store('thread-1', lce);
      const after = new Date();

      const session = await lss.getSession('thread-1');
      expect(session?.metadata.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session?.metadata.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should update updatedAt on new messages', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      const session1 = await lss.getSession('thread-1');

      await new Promise((resolve) => setTimeout(resolve, 50));

      await lss.store('thread-1', lce);
      const session2 = await lss.getSession('thread-1');

      expect(session2?.metadata.updatedAt.getTime()).toBeGreaterThanOrEqual(
        session1!.metadata.updatedAt.getTime()
      );
    });
  });

  describe('coherence calculation', () => {
    it('should start with perfect coherence for first message', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBe(1.0);
    });

    it('should calculate coherence for multiple messages', async () => {
      const messages: LCE[] = [
        { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeGreaterThan(0);
      expect(session?.coherence).toBeLessThanOrEqual(1);
    });

    it('should calculate high coherence for consistent conversation', async () => {
      const messages: LCE[] = [
        {
          v: 1,
          intent: { type: 'ask' },
          affect: { pad: [0.3, 0.2, 0.1], tags: [] },
          meaning: { topic: 'weather' },
          policy: { consent: 'private' },
        },
        {
          v: 1,
          intent: { type: 'tell' },
          affect: { pad: [0.3, 0.2, 0.1], tags: [] },
          meaning: { topic: 'weather' },
          policy: { consent: 'private' },
        },
        {
          v: 1,
          intent: { type: 'ask' },
          affect: { pad: [0.3, 0.2, 0.1], tags: [] },
          meaning: { topic: 'weather' },
          policy: { consent: 'private' },
        },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeGreaterThan(0.7); // High coherence
    });

    it('should calculate low coherence for inconsistent conversation', async () => {
      const messages: LCE[] = [
        {
          v: 1,
          intent: { type: 'ask' },
          affect: { pad: [0.3, 0.2, 0.1], tags: [] },
          meaning: { topic: 'weather' },
          policy: { consent: 'private' },
        },
        {
          v: 1,
          intent: { type: 'plan' },
          affect: { pad: [0.8, 0.9, 0.5], tags: [] },
          meaning: { topic: 'food' },
          policy: { consent: 'private' },
        },
        {
          v: 1,
          intent: { type: 'sync' },
          affect: { pad: [0.1, 0.1, 0.9], tags: [] },
          meaning: { topic: 'work' },
          policy: { consent: 'private' },
        },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeLessThan(0.5); // Low coherence
    });
  });

  describe('coherence components', () => {
    it('should calculate intent similarity', async () => {
      const messages = [
        {
          lce: { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } } as LCE,
          timestamp: new Date(),
        },
        {
          lce: { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } } as LCE,
          timestamp: new Date(),
        },
        {
          lce: { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } } as LCE,
          timestamp: new Date(),
        },
      ];

      const result = lss.calculateCoherence(messages);
      expect(result.intentSimilarity).toBeGreaterThan(0);
      expect(result.intentSimilarity).toBeLessThanOrEqual(1);
    });

    it('should calculate affect stability', async () => {
      const messages = [
        {
          lce: {
            v: 1,
            intent: { type: 'tell' },
            affect: { pad: [0.3, 0.2, 0.1], tags: [] },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
        {
          lce: {
            v: 1,
            intent: { type: 'tell' },
            affect: { pad: [0.3, 0.2, 0.1], tags: [] },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
      ];

      const result = lss.calculateCoherence(messages);
      expect(result.affectStability).toBeGreaterThan(0.8); // Very stable
    });

    it('should calculate semantic alignment', async () => {
      const messages = [
        {
          lce: {
            v: 1,
            intent: { type: 'tell' },
            meaning: { topic: 'weather' },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
        {
          lce: {
            v: 1,
            intent: { type: 'tell' },
            meaning: { topic: 'weather' },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
      ];

      const result = lss.calculateCoherence(messages);
      expect(result.semanticAlignment).toBe(1.0); // Perfect alignment
    });

    it('should return all coherence components', async () => {
      const messages = [
        {
          lce: {
            v: 1,
            intent: { type: 'ask' },
            affect: { pad: [0.3, 0.2, 0.1], tags: [] },
            meaning: { topic: 'weather' },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
        {
          lce: {
            v: 1,
            intent: { type: 'tell' },
            affect: { pad: [0.3, 0.2, 0.1], tags: [] },
            meaning: { topic: 'weather' },
            policy: { consent: 'private' },
          } as LCE,
          timestamp: new Date(),
        },
      ];

      const result = lss.calculateCoherence(messages);

      expect(result.overall).toBeDefined();
      expect(result.intentSimilarity).toBeDefined();
      expect(result.affectStability).toBeDefined();
      expect(result.semanticAlignment).toBeDefined();
    });
  });

  describe('metrics API', () => {
    it('should expose metrics snapshot and persist manual overrides', async () => {
      const messages: LCE[] = [
        { v: 1, intent: { type: 'ask' }, meaning: { topic: 'alpha' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, meaning: { topic: 'alpha' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lss.store('thread-metrics', lce);
      }

      const initialMetrics = await lss.getMetrics('thread-metrics');
      expect(initialMetrics).not.toBeNull();
      const baselineCoherence = initialMetrics!.coherence.overall;

      const override: CoherenceResult = {
        overall: 0.42,
        intentSimilarity: 0.4,
        affectStability: 0.5,
        semanticAlignment: 0.6,
      };

      const driftEvents: DriftEvent[] = [
        {
          type: 'topic_shift',
          severity: 'medium',
          timestamp: new Date(),
          details: { reason: 'manual' },
        },
      ];

      const updated = await lss.updateMetrics('thread-metrics', {
        coherence: override,
        driftEvents,
      });

      expect(updated).not.toBeNull();
      expect(updated?.coherence.overall).toBeCloseTo(0.42);
      expect(updated?.driftEvents).toHaveLength(1);
      expect(updated?.driftEvents[0].threadId).toBe('thread-metrics');

      const refreshed = await lss.getMetrics('thread-metrics');
      expect(refreshed?.coherence.overall).toBeCloseTo(0.42);
      expect(refreshed?.previousCoherence?.overall).toBeCloseTo(
        baselineCoherence,
      );
    });
  });

  describe('statistics', () => {
    it('should return correct stats for empty store', async () => {
      const stats = await lss.getStats();

      expect(stats.sessionCount).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.averageCoherence).toBe(0);
    });

    it('should return correct stats for multiple sessions', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      await lss.store('thread-1', lce);
      await lss.store('thread-2', lce);

      const stats = await lss.getStats();

      expect(stats.sessionCount).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.averageCoherence).toBeGreaterThan(0);
    });
  });

  describe('options', () => {
    it('should respect maxMessages limit', async () => {
      const lssLimited = new LSS({ maxMessages: 3 });
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      for (let i = 0; i < 5; i++) {
        await lssLimited.store('thread-1', lce);
      }

      const session = await lssLimited.getSession('thread-1');
      expect(session?.messages.length).toBe(3);
      await lssLimited.destroy();
    });

    it('should respect coherenceWindow', async () => {
      const lssSmallWindow = new LSS({ coherenceWindow: 2 });
      const messages: LCE[] = [
        { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'sync' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'plan' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lssSmallWindow.store('thread-1', lce);
      }

      // Coherence should only use last 2 messages (sync, plan)
      const session = await lssSmallWindow.getSession('thread-1');
      expect(session?.coherence).toBeDefined();
      await lssSmallWindow.destroy();
    });
  });

  describe('storage adapters', () => {
    it('should persist sessions using redis storage adapter', async () => {
      const redis = new FakeRedis();
      const store = new LSS({ storage: new RedisSessionStorage(redis) });
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await store.store('redis-thread', lce);

      const raw = await redis.get('lss:session:redis-thread');
      expect(raw).not.toBeNull();

      const session = await store.getSession('redis-thread');
      expect(session?.threadId).toBe('redis-thread');

      await store.destroy();
    });

    it('should apply ttl cleanup for redis storage', async () => {
      const redis = new FakeRedis();
      const store = new LSS({ sessionTTL: 5, storage: new RedisSessionStorage(redis) });
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await store.store('redis-ttl', lce);

      await new Promise((resolve) => setTimeout(resolve, 25));

      const session = await store.getSession('redis-ttl');
      expect(session).toBeNull();

      await store.destroy();
    });
  });

  describe('edge cases', () => {
    it('should handle messages without affect', async () => {
      const messages: LCE[] = [
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeDefined();
      expect(session?.coherence).toBeGreaterThan(0);
    });

    it('should handle messages without meaning', async () => {
      const messages: LCE[] = [
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeDefined();
    });

    it('should handle unknown intent types', async () => {
      const messages: LCE[] = [
        { v: 1, intent: { type: 'unknown' as any }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
      ];

      for (const lce of messages) {
        await lss.store('thread-1', lce);
      }

      const session = await lss.getSession('thread-1');
      expect(session?.coherence).toBeDefined();
    });
  });
});
