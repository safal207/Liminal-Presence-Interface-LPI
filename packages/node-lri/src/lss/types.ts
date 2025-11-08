import { LCE } from '../types';

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

export interface SessionMetrics {
  coherence: CoherenceResult;
  previousCoherence?: CoherenceResult;
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
}

export interface SessionStorageAdapter {
  load(threadId: string): Promise<LSSSession | null>;
  save(session: LSSSession, ttlMs: number): Promise<void>;
  delete(threadId: string): Promise<boolean>;
  loadAll(): Promise<LSSSession[]>;
  clear(): Promise<void>;
  cleanup?(now: Date, ttlMs: number): Promise<void>;
}
