/**
 * LSS (Liminal Session Store)
 *
 * Track conversation context, calculate coherence, detect drift.
 *
 * Features:
 * - Session/thread storage with pluggable backends (in-memory, Redis)
 * - Coherence calculation (intent + affect + semantic)
 * - Context extraction from history
 * - Drift detection
 */

import { EventEmitter } from 'node:events';

import { LCE } from '../types';
import { InMemorySessionStorage } from './storage';
import type {
  CoherenceResult,
  DriftEvent,
  LSSMessage,
  LSSOptions,
  LSSSession,
  SessionMetrics,
  SessionStatistics,
  SessionStorageAdapter,
} from './types';

const INTENT_VECTORS: Record<string, number[]> = {
  ask: [1.0, 0.5, 0, 0, 0, 0.2],
  tell: [0.5, 1.0, 0, 0, 0.1, 0.2],
  propose: [0.1, 0.1, 1.0, 0.6, 0, 0.3],
  confirm: [0, 0, 0.6, 1.0, 0, 0.1],
  notify: [0, 0.4, 0, 0, 1.0, 0],
  sync: [0.2, 0.4, 0.1, 0, 0.8, 0.3],
  plan: [0.3, 0.3, 0.5, 0.3, 0, 1.0],
  agree: [0, 0.1, 0.6, 0.9, 0, 0.1],
  disagree: [0.2, 0.2, 0.4, 0.7, 0, 0.2],
  reflect: [0.4, 0.6, 0.1, 0, 0, 0.8],
};

type NormalizedOptions = Required<Omit<LSSOptions, 'storage'>>;

type EventEmitterListener = Parameters<EventEmitter['on']>[1];
type EventEmitterEmitArgs = Parameters<EventEmitter['emit']> extends [unknown, ...infer R]
  ? R
  : never;

/**
 * LSS - Liminal Session Store
 *
 * In-memory/Redis session storage with coherence calculation.
 */
export class LSS extends EventEmitter {
  private readonly storage: SessionStorageAdapter;
  private readonly options: NormalizedOptions;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: LSSOptions = {}) {
    super();
    this.options = {
      maxMessages: options.maxMessages ?? 1000,
      sessionTTL: options.sessionTTL ?? 3600000,
      coherenceWindow: options.coherenceWindow ?? 10,
      driftMinCoherence: options.driftMinCoherence ?? 0.6,
      driftDropThreshold: options.driftDropThreshold ?? 0.2,
      topicShiftWindow: options.topicShiftWindow ?? 5,
    };
    this.storage = options.storage ?? new InMemorySessionStorage();

    this.startCleanup();
  }

  /**
   * Store message in session
   */
  async store(threadId: string, lce: LCE, payload?: unknown): Promise<void> {
    await this.cleanupExpiredSessions();

    const now = new Date();
    let session = await this.storage.load(threadId);

    if (!session) {
      session = this.createSession(threadId, now);
    }

    session.messages.push({
      lce,
      payload,
      timestamp: now,
    });

    if (session.messages.length > this.options.maxMessages) {
      session.messages = session.messages.slice(-this.options.maxMessages);
    }

    session.metadata.messageCount = session.messages.length;
    session.metadata.updatedAt = now;

    if (session.messages.length >= 2) {
      const result = this.calculateCoherence(session.messages);
      const driftEvent = this.detectDrift(session, result);

      session.metrics.previousCoherence = session.metrics.coherence;
      session.metrics.coherence = result;
      session.metrics.updatedAt = now;
      session.coherence = result.overall;

      if (driftEvent) {
        const enrichedEvent: DriftEvent & { threadId: string } = { ...driftEvent, threadId };
        session.metrics.driftEvents.push(enrichedEvent);
        this.emit('drift', enrichedEvent);
      }
    } else {
      session.metrics.updatedAt = now;
    }

    await this.storage.save(session, this.options.sessionTTL);
  }

  override on(event: 'drift', listener: (payload: DriftEvent & { threadId: string }) => void): this;
  override on(event: string | symbol, listener: EventEmitterListener): this;
  override on(event: string | symbol, listener: EventEmitterListener): this {
    return super.on(event, listener);
  }

  override once(event: 'drift', listener: (payload: DriftEvent & { threadId: string }) => void): this;
  override once(event: string | symbol, listener: EventEmitterListener): this;
  override once(event: string | symbol, listener: EventEmitterListener): this {
    return super.once(event, listener);
  }

  override off(event: 'drift', listener: (payload: DriftEvent & { threadId: string }) => void): this;
  override off(event: string | symbol, listener: EventEmitterListener): this;
  override off(event: string | symbol, listener: EventEmitterListener): this {
    return super.off(event, listener);
  }

  override emit(event: 'drift', payload: DriftEvent & { threadId: string }): boolean;
  override emit(event: string | symbol, ...args: EventEmitterEmitArgs): boolean;
  override emit(event: string | symbol, ...args: EventEmitterEmitArgs): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Get session by thread ID
   */
  async getSession(threadId: string): Promise<LSSSession | null> {
    return this.storage.load(threadId);
  }

  /**
   * Get metrics for a session
   */
  async getMetrics(threadId: string): Promise<SessionMetrics | null> {
    const session = await this.storage.load(threadId);
    return session ? session.metrics : null;
  }

  /**
   * Update session metrics manually
   */
  async updateMetrics(
    threadId: string,
    metrics: Partial<Pick<SessionMetrics, 'coherence' | 'driftEvents'>>,
  ): Promise<SessionMetrics | null> {
    const session = await this.storage.load(threadId);
    if (!session) {
      return null;
    }

    if (metrics.coherence) {
      session.metrics.previousCoherence = session.metrics.coherence;
      session.metrics.coherence = metrics.coherence;
      session.coherence = metrics.coherence.overall;
    }

    if (metrics.driftEvents) {
      session.metrics.driftEvents = metrics.driftEvents.map((event) => ({
        ...event,
        threadId,
      }));
    }

    session.metrics.updatedAt = new Date();
    await this.storage.save(session, this.options.sessionTTL);
    return session.metrics;
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<LSSSession[]> {
    return this.storage.loadAll();
  }

  /**
   * Delete session
   */
  async deleteSession(threadId: string): Promise<boolean> {
    return this.storage.delete(threadId);
  }

  /**
   * Clear all sessions
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Calculate coherence for message history
   */
  calculateCoherence(messages: LSSMessage[]): CoherenceResult {
    if (messages.length < 2) {
      return {
        overall: 1.0,
        intentSimilarity: 1.0,
        affectStability: 1.0,
        semanticAlignment: 1.0,
      };
    }

    const window = messages.slice(-this.options.coherenceWindow);

    const intentSimilarity = this.calculateIntentSimilarity(window);
    const affectStability = this.calculateAffectStability(window);
    const semanticAlignment = this.calculateSemanticAlignment(window);

    const overall = 0.4 * intentSimilarity + 0.3 * affectStability + 0.3 * semanticAlignment;

    return {
      overall: Math.max(0, Math.min(1, overall)),
      intentSimilarity,
      affectStability,
      semanticAlignment,
    };
  }

  private calculateIntentSimilarity(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1].lce.intent?.type || 'tell';
      const curr = messages[i].lce.intent?.type || 'tell';

      const vec1 = INTENT_VECTORS[prev] || INTENT_VECTORS.tell;
      const vec2 = INTENT_VECTORS[curr] || INTENT_VECTORS.tell;

      const similarity = this.cosineSimilarity(vec1, vec2);
      totalSimilarity += similarity;
      comparisons++;
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  }

  private detectDrift(session: LSSSession, coherence: CoherenceResult): DriftEvent | null {
    const prev = session.metrics.coherence;

    const drop = prev.overall - coherence.overall;
    if (
      coherence.overall < this.options.driftMinCoherence &&
      drop >= this.options.driftDropThreshold
    ) {
      return {
        type: 'coherence_drop',
        severity: drop > 0.4 ? 'high' : drop > 0.25 ? 'medium' : 'low',
        timestamp: new Date(),
        details: {
          previous: prev.overall,
          current: coherence.overall,
        },
      };
    }

    const topics = session.messages
      .slice(-this.options.topicShiftWindow)
      .map((m) => m.lce.meaning?.topic)
      .filter((t): t is string => !!t);

    if (topics.length >= 3) {
      const uniqueTopics = new Set(topics);
      if (uniqueTopics.size >= Math.min(topics.length, 3)) {
        return {
          type: 'topic_shift',
          severity: uniqueTopics.size > 3 ? 'high' : 'medium',
          timestamp: new Date(),
          details: {
            window: topics,
            uniqueTopics: uniqueTopics.size,
          },
        };
      }
    }

    return null;
  }

  private calculateAffectStability(messages: LSSMessage[]): number {
    const pads = messages
      .map((m) => m.lce.affect?.pad)
      .filter((pad): pad is [number, number, number] => pad !== undefined);

    if (pads.length < 2) return 1.0;

    const variances = [0, 1, 2].map((dim) => {
      const values = pads.map((pad) => pad[dim]);
      return this.variance(values);
    });

    const avgVariance = variances.reduce((a, b) => a + b, 0) / 3;

    return Math.exp(-avgVariance * 5);
  }

  private calculateSemanticAlignment(messages: LSSMessage[]): number {
    const topics = messages
      .map((m) => m.lce.meaning?.topic)
      .filter((t): t is string => t !== undefined);

    if (topics.length < 2) return 1.0;

    const uniqueTopics = new Set(topics);

    return 1.0 / uniqueTopics.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private variance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private createSession(threadId: string, now: Date): LSSSession {
    return {
      threadId,
      messages: [],
      coherence: 1.0,
      metrics: {
        coherence: {
          overall: 1.0,
          intentSimilarity: 1.0,
          affectStability: 1.0,
          semanticAlignment: 1.0,
        },
        driftEvents: [],
        updatedAt: now,
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      },
    };
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions().catch(() => undefined);
    }, 60000);

    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();

    if (this.storage.cleanup) {
      await this.storage.cleanup(now, this.options.sessionTTL);
      return;
    }

    const sessions = await this.storage.loadAll();
    const cutoff = now.getTime() - this.options.sessionTTL;

    await Promise.all(
      sessions
        .filter((session) => session.metadata.updatedAt.getTime() < cutoff)
        .map((session) => this.storage.delete(session.threadId)),
    );
  }

  /**
   * Stop cleanup timer and clear all sessions
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    await this.storage.clear();
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<SessionStatistics> {
    const sessions = await this.storage.loadAll();

    return {
      sessionCount: sessions.length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      averageCoherence:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.coherence, 0) / sessions.length
          : 0,
    };
  }
}

export const lss = new LSS();

export default LSS;

export type {
  CoherenceResult,
  DriftEvent,
  LSSMessage,
  LSSSession,
  SessionMetrics,
  SessionStatistics,
  LSSOptions,
  SessionStorageAdapter,
} from './types';
export { InMemorySessionStorage, RedisSessionStorage, RedisCompatibleClient } from './storage';
