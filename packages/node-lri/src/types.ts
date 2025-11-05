/**
 * LRI Core Types
 * Based on LCE v0.1 schema
 */

export type IntentType =
  | 'ask'
  | 'tell'
  | 'propose'
  | 'confirm'
  | 'notify'
  | 'sync'
  | 'plan'
  | 'agree'
  | 'disagree'
  | 'reflect';

export type ConsentLevel = 'private' | 'team' | 'public';

export interface Intent {
  type: IntentType;
  goal?: string;
}

export interface Affect {
  /** PAD model: [Pleasure, Arousal, Dominance] */
  pad?: [number, number, number];
  /** Human-readable affect tags */
  tags?: string[];
}

export interface Meaning {
  topic?: string;
  ontology?: string;
}

export interface Trust {
  proof?: string;
  attest?: string[];
}

export interface Memory {
  thread?: string;
  t?: string;
  ttl?: string;
}

export interface Policy {
  consent: ConsentLevel;
  share?: string[];
  dp?: string;
}

export interface QoS {
  coherence?: number;
  stability?: string;
}

export interface Trace {
  hop?: number;
  provenance?: string[];
}

/**
 * Liminal Context Envelope (LCE)
 */
export interface LCE {
  v: 1;
  intent: Intent;
  affect?: Affect;
  meaning?: Meaning;
  trust?: Trust;
  memory?: Memory;
  policy: Policy;
  qos?: QoS;
  trace?: Trace;
  sig?: string;
}

export interface LRIRequest extends Request {
  lri?: {
    lce: LCE;
    raw: string;
  };
}
