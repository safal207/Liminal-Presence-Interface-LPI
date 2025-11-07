/**
 * LSS (Liminal Session Store)
 *
 * Track conversation context, calculate coherence, detect drift.
 *
 * Features:
 * - Session/thread storage in memory
 * - Coherence calculation (intent + affect + semantic)
 * - Context extraction from history
 * - Drift detection
 */

import { LCE } from '../types';

/**
 * Stored message in session
 */
export interface LSSMessage {
  /** LCE envelope */
  lce: LCE;
  /** Message payload */
  payload?: any;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Session data
 */
export interface LSSSession {
  /** Thread/session ID */
  threadId: string;
  /** Message history */
  messages: LSSMessage[];
  /** Current coherence score */
  coherence: number;
  /** Session metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  };
}

/**
 * Coherence calculation result
 */
export interface CoherenceResult {
  /** Overall coherence (0-1) */
  overall: number;
  /** Intent similarity component */
  intentSimilarity: number;
  /** Affect stability component */
  affectStability: number;
  /** Semantic alignment component */
  semanticAlignment: number;
}

/**
 * LSS Store options
 */
export interface LSSOptions {
  /** Maximum messages per session */
  maxMessages?: number;
  /** Session TTL in milliseconds */
  sessionTTL?: number;
  /** Coherence calculation window */
  coherenceWindow?: number;
}

/**
 * Intent type mapping for similarity calculation
 *
 * Vectors capture semantic relationships between intents:
 * - ask/tell: complementary pair (question-answer pattern)
 * - propose/confirm: complementary pair (suggestion-agreement)
 * - notify/sync: information sharing
 *
 * Dimensions: [inquiry, inform, proposal, decision, broadcast, meta]
 */
const INTENT_VECTORS: Record<string, number[]> = {
  ask: [1.0, 0.5, 0, 0, 0, 0.2],        // question expects answer
  tell: [0.5, 1.0, 0, 0, 0.1, 0.2],     // answer relates to question
  propose: [0.1, 0.1, 1.0, 0.6, 0, 0.3],// suggestion expects decision
  confirm: [0, 0, 0.6, 1.0, 0, 0.1],    // agreement relates to proposal
  notify: [0, 0.4, 0, 0, 1.0, 0],       // broadcast information
  sync: [0.2, 0.4, 0.1, 0, 0.8, 0.3],   // coordination
  plan: [0.3, 0.3, 0.5, 0.3, 0, 1.0],   // planning/strategy
  agree: [0, 0.1, 0.6, 0.9, 0, 0.1],    // agreement
  disagree: [0.2, 0.2, 0.4, 0.7, 0, 0.2],// disagreement still relates
  reflect: [0.4, 0.6, 0.1, 0, 0, 0.8],  // metacognition
};

/**
 * LSS - Liminal Session Store
 *
 * In-memory session storage with coherence calculation.
 *
 * @example
 * ```typescript
 * const lss = new LSS();
 *
 * // Store messages
 * await lss.store('thread-123', lce1);
 * await lss.store('thread-123', lce2);
 *
 * // Get session
 * const session = await lss.getSession('thread-123');
 * console.log('Coherence:', session.coherence);
 *
 * // Calculate coherence
 * const coherence = lss.calculateCoherence(session.messages);
 * console.log('Intent similarity:', coherence.intentSimilarity);
 * ```
 */
export class LSS {
  private sessions: Map<string, LSSSession> = new Map();
  private options: Required<LSSOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: LSSOptions = {}) {
    this.options = {
      maxMessages: options.maxMessages ?? 1000,
      sessionTTL: options.sessionTTL ?? 3600000, // 1 hour
      coherenceWindow: options.coherenceWindow ?? 10, // Last 10 messages
    };

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Store message in session
   *
   * @param threadId - Thread/session ID
   * @param lce - LCE envelope
   * @param payload - Optional payload
   */
  async store(threadId: string, lce: LCE, payload?: any): Promise<void> {
    let session = this.sessions.get(threadId);

    if (!session) {
      // Create new session
      session = {
        threadId,
        messages: [],
        coherence: 1.0, // Start with perfect coherence
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
        },
      };
      this.sessions.set(threadId, session);
    }

    // Add message
    session.messages.push({
      lce,
      payload,
      timestamp: new Date(),
    });

    // Trim if too many messages
    if (session.messages.length > this.options.maxMessages) {
      session.messages = session.messages.slice(-this.options.maxMessages);
    }

    // Update metadata
    session.metadata.updatedAt = new Date();
    session.metadata.messageCount = session.messages.length;

    // Recalculate coherence
    if (session.messages.length >= 2) {
      const result = this.calculateCoherence(session.messages);
      session.coherence = result.overall;
    }
  }

  /**
   * Get session by thread ID
   *
   * @param threadId - Thread/session ID
   * @returns Session or null if not found
   */
  async getSession(threadId: string): Promise<LSSSession | null> {
    return this.sessions.get(threadId) || null;
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<LSSSession[]> {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete session
   *
   * @param threadId - Thread/session ID
   */
  async deleteSession(threadId: string): Promise<boolean> {
    return this.sessions.delete(threadId);
  }

  /**
   * Clear all sessions
   */
  async clear(): Promise<void> {
    this.sessions.clear();
  }

  /**
   * Calculate coherence for message history
   *
   * Formula:
   * coherence = 0.4×intent_similarity + 0.3×affect_stability + 0.3×semantic_alignment
   *
   * @param messages - Message history
   * @returns Coherence result with components
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

    // Use last N messages for coherence window
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

  /**
   * Calculate intent similarity
   *
   * Uses cosine similarity between intent vectors.
   * Penalizes erratic switches (ask→tell→ask is good, ask→plan→notify is bad)
   */
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

  /**
   * Calculate affect stability
   *
   * Measures variance in PAD vectors.
   * Low variance = stable affect = high score
   */
  private calculateAffectStability(messages: LSSMessage[]): number {
    const pads = messages
      .map((m) => m.lce.affect?.pad)
      .filter((pad): pad is [number, number, number] => pad !== undefined);

    if (pads.length < 2) return 1.0;

    // Calculate variance for each dimension
    const variances = [0, 1, 2].map((dim) => {
      const values = pads.map((pad) => pad[dim]);
      return this.variance(values);
    });

    // Average variance across dimensions
    const avgVariance = variances.reduce((a, b) => a + b, 0) / 3;

    // Convert variance to stability (0 variance = 1.0 stability)
    // Use exponential decay: stability = e^(-variance)
    return Math.exp(-avgVariance * 5);
  }

  /**
   * Calculate semantic alignment
   *
   * Checks topic/ontology consistency.
   * Same topics/ontology = high score
   */
  private calculateSemanticAlignment(messages: LSSMessage[]): number {
    const topics = messages
      .map((m) => m.lce.meaning?.topic)
      .filter((t): t is string => t !== undefined);

    if (topics.length < 2) return 1.0;

    // Count unique topics
    const uniqueTopics = new Set(topics);

    // Fewer unique topics = higher alignment
    // If all same topic: 1.0
    // If all different topics: approaches 0
    return 1.0 / uniqueTopics.size;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate variance of array
   */
  private variance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [threadId, session] of this.sessions.entries()) {
        const age = now - session.metadata.updatedAt.getTime();
        if (age > this.options.sessionTTL) {
          this.sessions.delete(threadId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop cleanup timer and clear all sessions
   *
   * Call this when you're done with the LSS instance to prevent memory leaks.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.sessions.clear();
  }

  /**
   * Get session statistics
   */
  getStats(): {
    sessionCount: number;
    totalMessages: number;
    averageCoherence: number;
  } {
    const sessions = Array.from(this.sessions.values());

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

// Export singleton instance
export const lss = new LSS();

export default LSS;
