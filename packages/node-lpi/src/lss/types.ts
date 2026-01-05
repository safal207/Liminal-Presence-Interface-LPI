import { LCE, IntentType } from '../types';

export interface LSSMessage {
  lce: LCE;
  payload?: unknown;
  timestamp: Date;
}

export interface DriftEvent {
  type: 'coherence_drop' | 'topic_shift';
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  details?: Record<string, unknown>;
  threadId?: string;
}

export interface CoherenceResult {
  overall: number;
  intentSimilarity: number;
  affectStability: number;
  semanticAlignment: number;
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
  /** Vagueness: Use of abstract/unclear language (0-1) */
  vagueness: number;
  /** Contradiction: Conflicting intents or affects (0-1) */
  contradiction: number;
  /** Semantic Gap: Logical jumps without connection (0-1) */
  semanticGap: number;
  /** Comprehension Barrier: Excessive complexity (0-1) */
  comprehensionBarrier: number;
  /** Overall obstacle score (0-1) */
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

export interface SessionMetrics {
  coherence: CoherenceResult;
  previousCoherence?: CoherenceResult;
  awareness: AwarenessMetrics;
  obstacles: ObstacleMetrics;
  termas: Terma[];
  driftEvents: DriftEvent[];
  updatedAt: Date;
}

export interface LSSSession {
  threadId: string;
  messages: LSSMessage[];
  coherence: number;
  metrics: SessionMetrics;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  };
}

export interface LSSOptions {
  maxMessages?: number;
  sessionTTL?: number;
  coherenceWindow?: number;
  driftMinCoherence?: number;
  driftDropThreshold?: number;
  topicShiftWindow?: number;
  storage?: SessionStorageAdapter;
}

export interface SessionStatistics {
  sessionCount: number;
  totalMessages: number;
  averageCoherence: number;
  averageAwareness: AwarenessMetrics;
  averageObstacles: ObstacleMetrics;
}

export interface SessionStorageAdapter {
  load(threadId: string): Promise<LSSSession | null>;
  save(session: LSSSession, ttlMs: number): Promise<void>;
  delete(threadId: string): Promise<boolean>;
  loadAll(): Promise<LSSSession[]>;
  clear(): Promise<void>;
  cleanup?(now: Date, ttlMs: number): Promise<void>;
}
