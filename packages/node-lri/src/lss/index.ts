/**
 * LSS (Liminal Session Store)
 *
 * Track conversation context, calculate coherence, detect drift.
 * Now with Awareness Layer (inspired by Padmasambhava's teachings)
 *
 * Features:
 * - Session/thread storage in memory
 * - Coherence calculation (intent + affect + semantic)
 * - Awareness tracking (presence, clarity, distraction, engagement)
 * - Context extraction from history
 * - Drift detection
 */

import { LCE, IntentType } from '../types';

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
 * Awareness metrics (Padmasambhava-inspired)
 *
 * Tracks quality of presence and engagement in conversation
 */
export interface AwarenessMetrics {
  /** Presence: How "here and now" is the conversation (0-1) */
  presence: number;
  /** Clarity: How clear and understandable is the communication (0-1) */
  clarity: number;
  /** Distraction: Level of scattered attention (0-1, lower is better) */
  distraction: number;
  /** Engagement: Depth of involvement in conversation (0-1) */
  engagement: number;
  /** Overall awareness score (0-1) */
  overall: number;
}

/**
 * Obstacle metrics (antarāya - Buddhist concept of impediments)
 *
 * Detects barriers that prevent clear understanding in communication
 */
export interface ObstacleMetrics {
  /** Vagueness: Abstract/unclear expression without specifics (0-1, higher is worse) */
  vagueness: number;
  /** Contradiction: Conflicts with previous statements (0-1, higher is worse) */
  contradiction: number;
  /** Semantic Gap: Logical jumps without connection (0-1, higher is worse) */
  semanticGap: number;
  /** Comprehension Barrier: Language complexity preventing understanding (0-1, higher is worse) */
  comprehensionBarrier: number;
  /** Overall obstacle level (0-1, higher is worse) */
  overall: number;
}

/**
 * Terma type (treasure/teaching category)
 */
export type TermaType = 'insight' | 'pattern' | 'warning' | 'breakthrough';

/**
 * Conditions for revealing a terma
 */
export interface RevealConditions {
  /** Minimum similarity to original topic (0-1) */
  topicMatch?: number;
  /** Required intent types */
  intentMatch?: IntentType[];
  /** Minimum coherence threshold */
  coherenceThreshold?: number;
  /** Minimum awareness threshold */
  awarenessThreshold?: number;
  /** Maximum obstacles threshold */
  obstaclesThreshold?: number;
  /** Minimum time delay (ms) since hiding */
  timeDelay?: number;
}

/**
 * Terma - hidden insight for the right moment
 *
 * Inspired by Padmasambhava's terma tradition of hiding teachings
 * to be revealed at the appropriate time
 */
export interface Terma {
  /** Unique ID */
  id: string;
  /** Type of terma */
  type: TermaType;
  /** Content of the insight */
  content: string;
  /** When it was hidden */
  hiddenAt: Date;
  /** Context when hidden (topic, intent, coherence) */
  hiddenContext: {
    topic?: string;
    intent?: IntentType;
    coherence: number;
    awareness: number;
    obstacles: number;
  };
  /** Conditions for revealing */
  revealConditions: RevealConditions;
  /** Priority (0-1, higher = more important) */
  priority: number;
  /** Whether it has been revealed */
  revealed: boolean;
  /** When it was revealed (if revealed) */
  revealedAt?: Date;
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
  /** Current awareness metrics */
  awareness: AwarenessMetrics;
  /** Current obstacle metrics */
  obstacles: ObstacleMetrics;
  /** Hidden termas (treasures) waiting for right moment */
  termas: Terma[];
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

    // Recalculate awareness
    if (session.messages.length >= 1) {
      session.awareness = this.calculateAwareness(session.messages);
    }

    // Recalculate obstacles
    if (session.messages.length >= 1) {
      session.obstacles = this.calculateObstacles(session.messages);
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
   * Calculate awareness metrics for message history
   *
   * Inspired by Padmasambhava's teachings on mindfulness.
   * Tracks quality of presence and engagement in conversation.
   *
   * @param messages - Message history
   * @returns Awareness metrics
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
    const overall = (presence + clarity + engagement) / 3 * (1 - distraction);

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
   *
   * Measures:
   * - Consistent message timing (no long gaps)
   * - Recent activity (not stale)
   * - Steady rhythm
   */
  private calculatePresence(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const timestamps = messages.map((m) => m.timestamp.getTime());
    const now = Date.now();
    const mostRecent = timestamps[timestamps.length - 1];

    // Recency score: decay over time (5 min = 0.5, 30 min = 0.1)
    const ageMinutes = (now - mostRecent) / 60000;
    const recencyScore = Math.exp(-ageMinutes / 10);

    // Timing consistency: low variance = high presence
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
   *
   * Based on:
   * - Coherence (from existing metric)
   * - Semantic alignment
   * - Affect stability
   */
  private calculateClarity(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const coherence = this.calculateCoherence(messages);

    // Clarity is weighted combination of coherence components
    // Semantic alignment is most important for clarity
    return (
      0.5 * coherence.semanticAlignment +
      0.3 * coherence.intentSimilarity +
      0.2 * coherence.affectStability
    );
  }

  /**
   * Calculate distraction - scattered attention
   *
   * Measures:
   * - Topic jumping (frequent changes)
   * - Intent chaos (erratic patterns)
   * - Affect volatility
   */
  private calculateDistraction(messages: LSSMessage[]): number {
    if (messages.length < 3) return 0.0; // Need history for distraction

    // Topic jumping: count unique topics in recent window
    const window = messages.slice(-5); // Last 5 messages
    const topics = window
      .map((m) => m.lce.meaning?.topic)
      .filter((t): t is string => t !== undefined);

    const topicJumps = new Set(topics).size;
    const topicDistraction = Math.min(1.0, (topicJumps - 1) / 4); // 5 different topics = max

    // Intent chaos: variance in intent similarity
    const intentSimilarity = this.calculateIntentSimilarity(window);
    const intentDistraction = 1 - intentSimilarity;

    // Affect volatility: high variance = high distraction
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
   *
   * Measures:
   * - Message frequency (active participation)
   * - Intent diversity (rich interaction)
   * - Response patterns (not just broadcasting)
   */
  private calculateEngagement(messages: LSSMessage[]): number {
    if (messages.length < 2) return 1.0;

    const window = messages.slice(-10); // Last 10 messages

    // Activity score: more recent messages = higher engagement
    const timestamps = window.map((m) => m.timestamp.getTime());
    const timespan = timestamps[timestamps.length - 1] - timestamps[0];
    const messagesPerMinute = (window.length / (timespan / 60000)) || 0;
    const activityScore = Math.min(1.0, messagesPerMinute / 2); // 2 msg/min = max

    // Intent diversity: variety shows engagement (but not chaos)
    const intents = window.map((m) => m.lce.intent?.type || 'tell');
    const uniqueIntents = new Set(intents).size;
    const diversityScore = Math.min(1.0, uniqueIntents / 4); // 4+ intents = good variety

    // Response pattern: ask-tell pairs show engagement
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
   *
   * @param messages - Message history
   * @returns Obstacle metrics
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

    // Overall obstacles: average of all components (higher = worse)
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
   *
   * Measures:
   * - Presence of vague words (thing, stuff, maybe, perhaps)
   * - Lack of specificity in meaning.topic
   * - Missing concrete details
   */
  private calculateVagueness(messages: LSSMessage[]): number {
    if (messages.length === 0) return 0.0;

    const window = messages.slice(-5); // Last 5 messages
    let vagueCount = 0;
    let totalMessages = 0;

    // List of vague indicators
    const vagueWords = ['thing', 'stuff', 'maybe', 'perhaps', 'kind of', 'sort of', 'like', 'whatever', 'something', 'anything'];

    for (const msg of window) {
      totalMessages++;

      // Check payload for vague words (if string)
      if (typeof msg.payload === 'string') {
        const lowerPayload = msg.payload.toLowerCase();
        const vagueMatches = vagueWords.filter((word) => lowerPayload.includes(word)).length;
        if (vagueMatches > 0) {
          vagueCount += Math.min(1.0, vagueMatches / 3); // 3+ vague words = max
        }
      }

      // Check for missing or generic topics
      const topic = msg.lce.meaning?.topic;
      if (!topic || topic === 'general' || topic === 'misc' || topic.length < 3) {
        vagueCount += 0.5;
      }
    }

    return Math.min(1.0, vagueCount / totalMessages);
  }

  /**
   * Calculate contradiction - conflicts with previous statements
   *
   * Measures:
   * - Intent reversals (propose → disagree on same topic)
   * - Affect polarity flips (positive → negative suddenly)
   * - Topic confusion (same topic with opposite intents)
   */
  private calculateContradiction(messages: LSSMessage[]): number {
    if (messages.length < 2) return 0.0;

    const window = messages.slice(-10); // Last 10 messages
    let contradictions = 0;

    for (let i = 1; i < window.length; i++) {
      const prev = window[i - 1];
      const curr = window[i];

      // Same topic but opposing intents
      const prevTopic = prev.lce.meaning?.topic;
      const currTopic = curr.lce.meaning?.topic;
      const prevIntent = prev.lce.intent?.type;
      const currIntent = curr.lce.intent?.type;

      if (prevTopic && currTopic && prevTopic === currTopic) {
        // Contradictory intent pairs
        if (
          (prevIntent === 'propose' && currIntent === 'disagree') ||
          (prevIntent === 'agree' && currIntent === 'disagree') ||
          (prevIntent === 'confirm' && currIntent === 'disagree')
        ) {
          contradictions++;
        }
      }

      // Affect polarity flip (pleasure dimension)
      const prevPad = prev.lce.affect?.pad;
      const currPad = curr.lce.affect?.pad;
      if (prevPad && currPad) {
        const prevPleasure = prevPad[0];
        const currPleasure = currPad[0];
        // Strong flip: -0.5 to +0.5 or vice versa
        if (Math.abs(prevPleasure - currPleasure) > 1.0) {
          contradictions += 0.5;
        }
      }
    }

    return Math.min(1.0, contradictions / (window.length / 2));
  }

  /**
   * Calculate semantic gap - logical jumps without connection
   *
   * Measures:
   * - Topic switches without transition
   * - Intent discontinuity
   * - Missing context/thread continuity
   */
  private calculateSemanticGap(messages: LSSMessage[]): number {
    if (messages.length < 3) return 0.0;

    const window = messages.slice(-8); // Last 8 messages
    let gaps = 0;

    for (let i = 1; i < window.length; i++) {
      const prev = window[i - 1];
      const curr = window[i];

      // Abrupt topic change without semantic similarity
      const prevTopic = prev.lce.meaning?.topic;
      const currTopic = curr.lce.meaning?.topic;

      if (prevTopic && currTopic && prevTopic !== currTopic) {
        // Check if topics are completely unrelated (no common words)
        const prevWords = new Set(prevTopic.toLowerCase().split(/\s+/));
        const currWords = new Set(currTopic.toLowerCase().split(/\s+/));
        const commonWords = [...prevWords].filter((w) => currWords.has(w));

        if (commonWords.length === 0 && prevTopic.length > 3 && currTopic.length > 3) {
          gaps++;
        }
      }

      // Intent discontinuity (e.g., ask → plan without tell)
      const prevIntent = prev.lce.intent?.type;
      const currIntent = curr.lce.intent?.type;

      if (prevIntent === 'ask' && currIntent !== 'tell' && currIntent !== 'propose') {
        gaps += 0.5; // Didn't answer the question
      }
    }

    return Math.min(1.0, gaps / (window.length / 2));
  }

  /**
   * Calculate comprehension barrier - language complexity
   *
   * Measures:
   * - Payload length (very long = harder)
   * - Nested intent complexity
   * - Missing clarification after confusion
   */
  private calculateComprehensionBarrier(messages: LSSMessage[]): number {
    if (messages.length === 0) return 0.0;

    const window = messages.slice(-5); // Last 5 messages
    let barrierScore = 0;

    for (const msg of window) {
      // Very long messages are harder to comprehend
      if (typeof msg.payload === 'string') {
        const wordCount = msg.payload.split(/\s+/).length;
        if (wordCount > 100) {
          barrierScore += Math.min(1.0, (wordCount - 100) / 100);
        }
      }

      // Complex nested structures in payload
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
    averageAwareness: {
      presence: number;
      clarity: number;
      distraction: number;
      engagement: number;
      overall: number;
    };
    averageObstacles: {
      vagueness: number;
      contradiction: number;
      semanticGap: number;
      comprehensionBarrier: number;
      overall: number;
    };
  } {
    const sessions = Array.from(this.sessions.values());

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
        avgAwareness.presence += session.awareness.presence;
        avgAwareness.clarity += session.awareness.clarity;
        avgAwareness.distraction += session.awareness.distraction;
        avgAwareness.engagement += session.awareness.engagement;
        avgAwareness.overall += session.awareness.overall;

        avgObstacles.vagueness += session.obstacles.vagueness;
        avgObstacles.contradiction += session.obstacles.contradiction;
        avgObstacles.semanticGap += session.obstacles.semanticGap;
        avgObstacles.comprehensionBarrier += session.obstacles.comprehensionBarrier;
        avgObstacles.overall += session.obstacles.overall;
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

  /**
   * Hide a terma (insight) for later revelation
   *
   * @param threadId - Thread ID
   * @param content - The insight content to hide
   * @param type - Type of terma
   * @param revealConditions - Conditions for revelation
   * @param priority - Priority (higher = revealed first)
   */
  async hideTerma(
    threadId: string,
    content: string,
    type: TermaType,
    revealConditions: RevealConditions,
    priority: number = 5
  ): Promise<string> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`Session ${threadId} not found`);
    }

    // Get current context
    const currentContext = {
      topic: session.messages.length > 0 ? session.messages[session.messages.length - 1].lce.meaning?.topic : undefined,
      intent: session.messages.length > 0 ? session.messages[session.messages.length - 1].lce.intent.type : undefined,
      coherence: session.coherence,
      awareness: session.awareness.overall,
      obstacles: session.obstacles.overall,
    };

    const terma: Terma = {
      id: `terma_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      hiddenAt: new Date(),
      hiddenContext: currentContext,
      revealConditions,
      priority,
      revealed: false,
    };

    session.termas.push(terma);
    session.metadata.updatedAt = new Date();

    return terma.id;
  }

  /**
   * Check and reveal termas that meet their conditions
   *
   * @param threadId - Thread ID
   * @returns Array of revealed termas
   */
  async revealTermas(threadId: string): Promise<Terma[]> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`Session ${threadId} not found`);
    }

    const revealed: Terma[] = [];
    const now = new Date();

    // Get current context
    const currentContext = {
      topic: session.messages.length > 0 ? session.messages[session.messages.length - 1].lce.meaning?.topic : undefined,
      intent: session.messages.length > 0 ? session.messages[session.messages.length - 1].lce.intent.type : undefined,
      coherence: session.coherence,
      awareness: session.awareness.overall,
      obstacles: session.obstacles.overall,
    };

    // Check each unrevealed terma
    for (const terma of session.termas) {
      if (!terma.revealed && this.checkRevealConditions(terma, currentContext, now)) {
        terma.revealed = true;
        terma.revealedAt = now;
        revealed.push(terma);
      }
    }

    // Sort by priority (higher first)
    revealed.sort((a, b) => b.priority - a.priority);

    if (revealed.length > 0) {
      session.metadata.updatedAt = new Date();
    }

    return revealed;
  }

  /**
   * Check if a terma's reveal conditions are met
   */
  private checkRevealConditions(
    terma: Terma,
    currentContext: {
      topic?: string;
      intent?: IntentType;
      coherence: number;
      awareness: number;
      obstacles: number;
    },
    now: Date
  ): boolean {
    const conditions = terma.revealConditions;

    // Check time delay
    if (conditions.timeDelay) {
      const timeSinceHidden = now.getTime() - terma.hiddenAt.getTime();
      if (timeSinceHidden < conditions.timeDelay) {
        return false;
      }
    }

    // Check topic match
    if (conditions.topicMatch !== undefined && terma.hiddenContext.topic && currentContext.topic) {
      const similarity = this.calculateTopicSimilarity(terma.hiddenContext.topic, currentContext.topic);
      if (similarity < conditions.topicMatch) {
        return false;
      }
    }

    // Check intent match
    if (conditions.intentMatch && conditions.intentMatch.length > 0) {
      if (!currentContext.intent || !conditions.intentMatch.includes(currentContext.intent)) {
        return false;
      }
    }

    // Check coherence threshold
    if (conditions.coherenceThreshold !== undefined) {
      if (currentContext.coherence < conditions.coherenceThreshold) {
        return false;
      }
    }

    // Check awareness threshold
    if (conditions.awarenessThreshold !== undefined) {
      if (currentContext.awareness < conditions.awarenessThreshold) {
        return false;
      }
    }

    // Check obstacles threshold (should be below threshold)
    if (conditions.obstaclesThreshold !== undefined) {
      if (currentContext.obstacles > conditions.obstaclesThreshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate topic similarity using simple word overlap
   */
  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    const words1 = new Set(topic1.toLowerCase().split(/\s+/));
    const words2 = new Set(topic2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get all termas for a session
   */
  async getTermas(threadId: string): Promise<Terma[]> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`Session ${threadId} not found`);
    }
    return session.termas;
  }

  /**
   * Get unrevealed termas for a session
   */
  async getUnrevealedTermas(threadId: string): Promise<Terma[]> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`Session ${threadId} not found`);
    }
    return session.termas.filter((t) => !t.revealed);
  }
}

// Export singleton instance
export const lss = new LSS();

export default LSS;
