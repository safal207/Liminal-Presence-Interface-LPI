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
  AwarenessMetrics,
  CoherenceResult,
  DriftEvent,
  LSSMessage,
  LSSOptions,
  LSSSession,
  ObstacleMetrics,
  RevealConditions,
  SessionMetrics,
  SessionStatistics,
  SessionStorageAdapter,
  Terma,
  TermaType,
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

      // Calculate Buddhist-inspired metrics
      session.metrics.awareness = this.calculateAwareness(session.messages);
      session.metrics.obstacles = this.calculateObstacles(session.messages);

      // Check for termas to reveal
      const currentMessage = session.messages[session.messages.length - 1];
      const revealedTermas = this.revealTermas(session, currentMessage);

      // Emit events for revealed termas
      for (const terma of revealedTermas) {
        this.emit('terma_revealed', { terma, threadId });
      }

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
  override on(
    event: 'terma_revealed',
    listener: (payload: { terma: Terma; threadId: string }) => void,
  ): this;
  override on(event: string | symbol, listener: EventEmitterListener): this;
  override on(event: string | symbol, listener: EventEmitterListener): this {
    return super.on(event, listener);
  }

  override once(event: 'drift', listener: (payload: DriftEvent & { threadId: string }) => void): this;
  override once(
    event: 'terma_revealed',
    listener: (payload: { terma: Terma; threadId: string }) => void,
  ): this;
  override once(event: string | symbol, listener: EventEmitterListener): this;
  override once(event: string | symbol, listener: EventEmitterListener): this {
    return super.once(event, listener);
  }

  override off(event: 'drift', listener: (payload: DriftEvent & { threadId: string }) => void): this;
  override off(
    event: 'terma_revealed',
    listener: (payload: { terma: Terma; threadId: string }) => void,
  ): this;
  override off(event: string | symbol, listener: EventEmitterListener): this;
  override off(event: string | symbol, listener: EventEmitterListener): this {
    return super.off(event, listener);
  }

  override emit(event: 'drift', payload: DriftEvent & { threadId: string }): boolean;
  override emit(event: 'terma_revealed', payload: { terma: Terma; threadId: string }): boolean;
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
        awareness: {
          presence: 1.0,
          clarity: 1.0,
          distraction: 0.0,
          engagement: 1.0,
          overall: 1.0,
        },
        obstacles: {
          vagueness: 0.0,
          contradiction: 0.0,
          semanticGap: 0.0,
          comprehensionBarrier: 0.0,
          overall: 0.0,
        },
        termas: [],
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
   * Calculate awareness metrics for message history
   *
   * Inspired by Dzogchen teachings on natural awareness (rigpa).
   * Tracks quality of presence and engagement in conversation.
   */
  calculateAwareness(messages: LSSMessage[]): AwarenessMetrics {
    if (messages.length === 0) {
      return {
        presence: 1.0,
        clarity: 1.0,
        distraction: 0.0,
        engagement: 1.0,
        overall: 1.0,
      };
    }

    const presence = this.calculatePresence(messages);
    const clarity = this.calculateClarity(messages);
    const distraction = this.calculateDistraction(messages);
    const engagement = this.calculateEngagement(messages);

    // Overall awareness: average of positive metrics minus distraction
    const overall = ((presence + clarity + engagement) / 3) * (1 - distraction);

    return {
      presence: Math.max(0, Math.min(1, presence)),
      clarity: Math.max(0, Math.min(1, clarity)),
      distraction: Math.max(0, Math.min(1, distraction)),
      engagement: Math.max(0, Math.min(1, engagement)),
      overall: Math.max(0, Math.min(1, overall)),
    };
  }

  /**
   * Calculate presence - "here and now" quality
   */
  private calculatePresence(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const timestamps = messages.map((m) => m.timestamp.getTime());
    const now = Date.now();
    const mostRecent = timestamps[timestamps.length - 1];

    const ageMinutes = (now - mostRecent) / 60000;
    const recencyScore = Math.exp(-ageMinutes / 10);

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = this.variance(intervals);
    const consistencyScore = Math.exp(-variance / (avgInterval * avgInterval + 1));

    return (recencyScore + consistencyScore) / 2;
  }

  /**
   * Calculate clarity - communication clearness
   */
  private calculateClarity(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const coherence = this.calculateCoherence(messages);

    return (
      0.5 * coherence.semanticAlignment +
      0.3 * coherence.intentSimilarity +
      0.2 * coherence.affectStability
    );
  }

  /**
   * Calculate distraction - scattered attention
   */
  private calculateDistraction(messages: LSSMessage[]): number {
    if (messages.length < 3) return 0.0;

    const window = messages.slice(-5);
    const topics = window
      .map((m) => m.lce.meaning?.topic)
      .filter((t): t is string => t !== undefined);

    const topicJumps = new Set(topics).size;
    const topicDistraction = Math.min(1.0, (topicJumps - 1) / 4);

    const intentSimilarity = this.calculateIntentSimilarity(window);
    const intentDistraction = 1 - intentSimilarity;

    const pads = window
      .map((m) => m.lce.affect?.pad)
      .filter((pad): pad is [number, number, number] => pad !== undefined);

    let affectDistraction = 0;
    if (pads.length >= 2) {
      const variances = [0, 1, 2].map((dim) => {
        const values = pads.map((pad) => pad[dim]);
        return this.variance(values);
      });
      const avgVariance = variances.reduce((a, b) => a + b, 0) / 3;
      affectDistraction = Math.min(1.0, avgVariance * 5);
    }

    return (topicDistraction + intentDistraction + affectDistraction) / 3;
  }

  /**
   * Calculate engagement - depth of involvement
   */
  private calculateEngagement(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const window = messages.slice(-10);
    const timestamps = window.map((m) => m.timestamp.getTime());
    const timespan = timestamps[timestamps.length - 1] - timestamps[0];
    const messagesPerMinute = (window.length / (timespan / 60000)) || 0;
    const activityScore = Math.min(1.0, messagesPerMinute / 2);

    const intents = window.map((m) => m.lce.intent?.type || 'tell');
    const uniqueIntents = new Set(intents).size;
    const diversityScore = Math.min(1.0, uniqueIntents / 4);

    let responsePatterns = 0;
    for (let i = 1; i < intents.length; i++) {
      const prev = intents[i - 1];
      const curr = intents[i];
      if (
        (prev === 'ask' && curr === 'tell') ||
        (prev === 'propose' && curr === 'confirm') ||
        (prev === 'tell' && curr === 'ask')
      ) {
        responsePatterns++;
      }
    }
    const patternScore = Math.min(1.0, responsePatterns / (intents.length / 2));

    return (activityScore + diversityScore + patternScore) / 3;
  }

  /**
   * Calculate obstacle metrics for message history
   *
   * Inspired by Buddhist concept of antarāya (impediments).
   * Detects barriers that prevent clear understanding.
   */
  calculateObstacles(messages: LSSMessage[]): ObstacleMetrics {
    if (messages.length === 0) {
      return {
        vagueness: 0.0,
        contradiction: 0.0,
        semanticGap: 0.0,
        comprehensionBarrier: 0.0,
        overall: 0.0,
      };
    }

    const vagueness = this.calculateVagueness(messages);
    const contradiction = this.calculateContradiction(messages);
    const semanticGap = this.calculateSemanticGap(messages);
    const comprehensionBarrier = this.calculateComprehensionBarrier(messages);

    const overall = (vagueness + contradiction + semanticGap + comprehensionBarrier) / 4;

    return {
      vagueness: Math.max(0, Math.min(1, vagueness)),
      contradiction: Math.max(0, Math.min(1, contradiction)),
      semanticGap: Math.max(0, Math.min(1, semanticGap)),
      comprehensionBarrier: Math.max(0, Math.min(1, comprehensionBarrier)),
      overall: Math.max(0, Math.min(1, overall)),
    };
  }

  /**
   * Calculate vagueness - abstract/unclear expression
   */
  private calculateVagueness(messages: LSSMessage[]): number {
    if (messages.length === 0) return 0.0;

    const window = messages.slice(-5);
    let vagueCount = 0;
    let totalMessages = 0;

    const vagueWords = [
      'thing',
      'stuff',
      'maybe',
      'perhaps',
      'kind of',
      'sort of',
      'like',
      'whatever',
      'something',
      'anything',
    ];

    for (const msg of window) {
      totalMessages++;

      if (typeof msg.payload === 'string') {
        const lowerPayload = msg.payload.toLowerCase();
        const vagueMatches = vagueWords.filter((word) => lowerPayload.includes(word)).length;
        if (vagueMatches > 0) {
          vagueCount += Math.min(1.0, vagueMatches / 3);
        }
      }

      const topic = msg.lce.meaning?.topic;
      if (!topic || topic === 'general' || topic === 'misc' || topic.length < 3) {
        vagueCount += 0.5;
      }
    }

    return Math.min(1.0, vagueCount / totalMessages);
  }

  /**
   * Calculate contradiction - conflicts with previous statements
   */
  private calculateContradiction(messages: LSSMessage[]): number {
    if (messages.length < 2) return 0.0;

    const window = messages.slice(-10);
    let contradictions = 0;

    for (let i = 1; i < window.length; i++) {
      const prev = window[i - 1];
      const curr = window[i];

      const prevTopic = prev.lce.meaning?.topic;
      const currTopic = curr.lce.meaning?.topic;
      const prevIntent = prev.lce.intent?.type;
      const currIntent = curr.lce.intent?.type;

      if (prevTopic && currTopic && prevTopic === currTopic) {
        if (
          (prevIntent === 'propose' && currIntent === 'disagree') ||
          (prevIntent === 'agree' && currIntent === 'disagree') ||
          (prevIntent === 'confirm' && currIntent === 'disagree')
        ) {
          contradictions++;
        }
      }

      const prevPad = prev.lce.affect?.pad;
      const currPad = curr.lce.affect?.pad;
      if (prevPad && currPad) {
        const prevPleasure = prevPad[0];
        const currPleasure = currPad[0];
        if (Math.abs(prevPleasure - currPleasure) > 1.0) {
          contradictions += 0.5;
        }
      }
    }

    return Math.min(1.0, contradictions / (window.length / 2));
  }

  /**
   * Calculate semantic gap - logical jumps without connection
   */
  private calculateSemanticGap(messages: LSSMessage[]): number {
    if (messages.length < 3) return 0.0;

    const window = messages.slice(-8);
    let gaps = 0;

    for (let i = 1; i < window.length; i++) {
      const prev = window[i - 1];
      const curr = window[i];

      const prevTopic = prev.lce.meaning?.topic;
      const currTopic = curr.lce.meaning?.topic;

      if (prevTopic && currTopic && prevTopic !== currTopic) {
        const prevWords = new Set(prevTopic.toLowerCase().split(/\s+/));
        const currWords = new Set(currTopic.toLowerCase().split(/\s+/));
        const commonWords = [...prevWords].filter((w) => currWords.has(w));

        if (commonWords.length === 0 && prevTopic.length > 3 && currTopic.length > 3) {
          gaps++;
        }
      }

      const prevIntent = prev.lce.intent?.type;
      const currIntent = curr.lce.intent?.type;

      if (prevIntent === 'ask' && currIntent !== 'tell' && currIntent !== 'propose') {
        gaps += 0.5;
      }
    }

    return Math.min(1.0, gaps / (window.length / 2));
  }

  /**
   * Calculate comprehension barrier - language complexity
   */
  private calculateComprehensionBarrier(messages: LSSMessage[]): number {
    if (messages.length === 0) return 0.0;

    const window = messages.slice(-5);
    let barrierScore = 0;

    for (const msg of window) {
      if (typeof msg.payload === 'string') {
        const wordCount = msg.payload.split(/\s+/).length;
        if (wordCount > 100) {
          barrierScore += Math.min(1.0, (wordCount - 100) / 100);
        }
      }

      if (typeof msg.payload === 'object' && msg.payload !== null) {
        const depth = this.getObjectDepth(msg.payload);
        if (depth > 4) {
          barrierScore += Math.min(0.5, (depth - 4) / 10);
        }
      }
    }

    return Math.min(1.0, barrierScore / window.length);
  }

  /**
   * Get maximum depth of nested object
   */
  private getObjectDepth(obj: any, currentDepth = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return currentDepth + 1;
      return Math.max(...obj.map((item) => this.getObjectDepth(item, currentDepth + 1)));
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return currentDepth + 1;

    return Math.max(...keys.map((key) => this.getObjectDepth(obj[key], currentDepth + 1)));
  }

  // ============================================
  // Terma System (Hidden Insights)
  // ============================================

  /**
   * Hide an insight (terma) to be revealed at the right moment
   *
   * Inspired by Padmasambhava's terma tradition: teachings hidden
   * to be discovered when conditions are ripe
   *
   * @param threadId - Thread ID
   * @param type - Type of terma (insight, pattern, warning, breakthrough)
   * @param content - The insight content to hide
   * @param revealConditions - Conditions for revealing
   * @param priority - Priority (0-1, higher = more important)
   * @returns The created terma
   */
  async hideTerma(
    threadId: string,
    type: TermaType,
    content: string,
    revealConditions: RevealConditions = {},
    priority: number = 0.5,
  ): Promise<Terma> {
    const session = await this.storage.load(threadId);
    if (!session) {
      throw new Error(`Session not found: ${threadId}`);
    }

    const now = new Date();
    const currentMetrics = session.metrics;

    // Extract current context from latest message
    const latestMessage = session.messages[session.messages.length - 1];
    const topic = latestMessage?.lce.meaning?.topic;
    const intent = latestMessage?.lce.intent.type;

    const terma: Terma = {
      id: `terma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      content,
      hiddenAt: now,
      hiddenContext: {
        topic,
        intent,
        coherence: currentMetrics.coherence.overall,
        awareness: currentMetrics.awareness.overall,
        obstacles: currentMetrics.obstacles.overall,
      },
      revealConditions,
      priority: Math.max(0, Math.min(1, priority)),
      revealed: false,
    };

    session.metrics.termas.push(terma);
    session.metadata.updatedAt = now;

    await this.storage.save(session, this.options.sessionTTL);

    return terma;
  }

  /**
   * Get all termas for a session
   *
   * @param threadId - Thread ID
   * @param includeRevealed - Include revealed termas (default: true)
   * @returns Array of termas
   */
  async getTermas(threadId: string, includeRevealed: boolean = true): Promise<Terma[]> {
    const session = await this.storage.load(threadId);
    if (!session) {
      return [];
    }

    const termas = session.metrics.termas;
    if (includeRevealed) {
      return termas;
    }

    return termas.filter((t) => !t.revealed);
  }

  /**
   * Get revealed termas for a session
   *
   * @param threadId - Thread ID
   * @returns Array of revealed termas
   */
  async getRevealedTermas(threadId: string): Promise<Terma[]> {
    const session = await this.storage.load(threadId);
    if (!session) {
      return [];
    }

    return session.metrics.termas.filter((t) => t.revealed);
  }

  /**
   * Check reveal conditions and reveal termas if conditions are met
   *
   * @param session - Current session
   * @param currentMessage - Current message being processed
   * @returns Array of revealed termas (if any)
   */
  private revealTermas(session: LSSSession, currentMessage: LSSMessage): Terma[] {
    const now = new Date();
    const revealed: Terma[] = [];

    // Check each unrevealed terma
    for (const terma of session.metrics.termas) {
      if (terma.revealed) continue;

      const conditions = terma.revealConditions;
      let shouldReveal = true;

      // Check time delay
      if (conditions.timeDelay !== undefined) {
        const timeSinceHidden = now.getTime() - terma.hiddenAt.getTime();
        if (timeSinceHidden < conditions.timeDelay) {
          shouldReveal = false;
          continue;
        }
      }

      // Check coherence threshold
      if (conditions.coherenceThreshold !== undefined) {
        if (session.metrics.coherence.overall < conditions.coherenceThreshold) {
          shouldReveal = false;
          continue;
        }
      }

      // Check awareness threshold
      if (conditions.awarenessThreshold !== undefined) {
        if (session.metrics.awareness.overall < conditions.awarenessThreshold) {
          shouldReveal = false;
          continue;
        }
      }

      // Check obstacles threshold (lower is better)
      if (conditions.obstaclesThreshold !== undefined) {
        if (session.metrics.obstacles.overall > conditions.obstaclesThreshold) {
          shouldReveal = false;
          continue;
        }
      }

      // Check intent match
      if (conditions.intentMatch && conditions.intentMatch.length > 0) {
        if (!conditions.intentMatch.includes(currentMessage.lce.intent.type)) {
          shouldReveal = false;
          continue;
        }
      }

      // Check topic match (simple word overlap)
      if (conditions.topicMatch !== undefined && terma.hiddenContext.topic) {
        const currentTopic = currentMessage.lce.meaning?.topic || '';
        const similarity = this.calculateTopicSimilarity(
          terma.hiddenContext.topic,
          currentTopic,
        );

        if (similarity < conditions.topicMatch) {
          shouldReveal = false;
          continue;
        }
      }

      // All conditions met - reveal!
      if (shouldReveal) {
        terma.revealed = true;
        terma.revealedAt = now;
        revealed.push(terma);
      }
    }

    return revealed;
  }

  /**
   * Calculate topic similarity (simple word overlap)
   *
   * @param topic1 - First topic
   * @param topic2 - Second topic
   * @returns Similarity score (0-1)
   */
  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    if (!topic1 || !topic2) return 0;

    const words1 = new Set(
      topic1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    const words2 = new Set(
      topic2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<SessionStatistics> {
    const sessions = await this.storage.loadAll();

    const avgAwareness = {
      presence: 0,
      clarity: 0,
      distraction: 0,
      engagement: 0,
      overall: 0,
    };

    const avgObstacles = {
      vagueness: 0,
      contradiction: 0,
      semanticGap: 0,
      comprehensionBarrier: 0,
      overall: 0,
    };

    if (sessions.length > 0) {
      for (const session of sessions) {
        avgAwareness.presence += session.metrics.awareness.presence;
        avgAwareness.clarity += session.metrics.awareness.clarity;
        avgAwareness.distraction += session.metrics.awareness.distraction;
        avgAwareness.engagement += session.metrics.awareness.engagement;
        avgAwareness.overall += session.metrics.awareness.overall;

        avgObstacles.vagueness += session.metrics.obstacles.vagueness;
        avgObstacles.contradiction += session.metrics.obstacles.contradiction;
        avgObstacles.semanticGap += session.metrics.obstacles.semanticGap;
        avgObstacles.comprehensionBarrier += session.metrics.obstacles.comprehensionBarrier;
        avgObstacles.overall += session.metrics.obstacles.overall;
      }

      avgAwareness.presence /= sessions.length;
      avgAwareness.clarity /= sessions.length;
      avgAwareness.distraction /= sessions.length;
      avgAwareness.engagement /= sessions.length;
      avgAwareness.overall /= sessions.length;

      avgObstacles.vagueness /= sessions.length;
      avgObstacles.contradiction /= sessions.length;
      avgObstacles.semanticGap /= sessions.length;
      avgObstacles.comprehensionBarrier /= sessions.length;
      avgObstacles.overall /= sessions.length;
    }

    return {
      sessionCount: sessions.length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      averageCoherence:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.coherence, 0) / sessions.length
          : 0,
      averageAwareness: avgAwareness,
      averageObstacles: avgObstacles,
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
