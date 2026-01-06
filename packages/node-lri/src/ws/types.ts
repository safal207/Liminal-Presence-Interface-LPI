/**
 * WebSocket types for LPI
 * Includes LHS (Liminal Handshake Sequence) protocol
 */

import { LCE } from '../types';
import { createDeprecatedFunction } from '../deprecation';

/**
 * LHS Step types
 */
export type LHSStep = 'hello' | 'mirror' | 'bind' | 'seal' | 'flow';

/**
 * LHS Hello message (client → server)
 * First message in handshake sequence
 */
export interface LHSHello {
  step: 'hello';
  lri_version: string;
  encodings: ('json' | 'cbor')[];
  features: ('ltp' | 'lss' | 'compression')[];
  client_id?: string;
}

/**
 * LHS Mirror message (server → client)
 * Server echoes capabilities and negotiates
 */
export interface LHSMirror {
  step: 'mirror';
  lri_version: string;
  encoding: 'json' | 'cbor';
  features: ('ltp' | 'lss' | 'compression')[];
  server_id?: string;
}

/**
 * LHS Bind message (client → server)
 * Establish session context
 */
export interface LHSBind {
  step: 'bind';
  thread?: string;
  auth?: string;
  metadata?: Record<string, unknown>;
}

/**
 * LHS Seal message (server → client)
 * Cryptographic commitment to session
 */
export interface LHSSeal {
  step: 'seal';
  session_id: string;
  sig?: string;
  expires?: string;
}

/**
 * Union type of all LHS messages
 */
export type LHSMessage = LHSHello | LHSMirror | LHSBind | LHSSeal;

/**
 * LPI WebSocket frame structure
 *
 * Binary format:
 * [4 bytes: LCE length] [N bytes: LCE JSON] [remaining: payload]
 */
export interface LPIFrame {
  lce: LCE;
  payload: Buffer;
}

export type LRIFrame = LPIFrame;

/**
 * WebSocket server options
 */
export interface LPIWSServerOptions {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Enable LTP signatures */
  ltp?: boolean;
  /** LTP private key for signing (if ltp enabled) */
  ltpPrivateKey?: Uint8Array;
  /** Enable LSS session tracking */
  lss?: boolean;
  /** Supported encodings */
  encodings?: ('json' | 'cbor')[];
  /** Authentication handler */
  authenticate?: (params: { auth?: string; hello: LHSHello; bind: LHSBind }) => Promise<boolean> | boolean;
  /** Session timeout in ms */
  sessionTimeout?: number;
}

/**
 * WebSocket client options
 */
export interface LPIWSClientOptions {
  /** WebSocket URL */
  url: string;
  /** Client ID */
  clientId?: string;
  /** Preferred encoding */
  encoding?: 'json' | 'cbor';
  /** Request features */
  features?: ('ltp' | 'lss' | 'compression')[];
  /** Authentication token */
  auth?: string;
  /** Reconnect automatically */
  reconnect?: boolean;
}

/**
 * WebSocket connection state
 */
export interface LPIWSConnection {
  /** Unique session ID */
  sessionId: string;
  /** Connection thread */
  thread?: string;
  /** Negotiated encoding */
  encoding: 'json' | 'cbor';
  /** Enabled features */
  features: Set<'ltp' | 'lss' | 'compression'>;
  /** Handshake complete */
  ready: boolean;
  /** Connected timestamp */
  connectedAt: Date;
  /** Optional session expiry */
  expiresAt?: Date;
  /** Metadata about the remote peer */
  peer?: {
    clientId?: string;
    serverId?: string;
  };
}

/**
 * WebSocket server event handlers
 */
export interface LPIWSServerHandlers {
  /** Message received */
  onMessage?: (sessionId: string, lce: LCE, payload: Buffer) => void | Promise<void>;
  /** Connection established (after handshake) */
  onConnect?: (sessionId: string) => void | Promise<void>;
  /** Connection closed */
  onDisconnect?: (sessionId: string) => void | Promise<void>;
  /** Error occurred */
  onError?: (sessionId: string, error: Error) => void | Promise<void>;
}

/**
 * WebSocket client event handlers
 */
export interface LPIWSClientHandlers {
  /** Message received */
  onMessage?: (lce: LCE, payload: Buffer) => void | Promise<void>;
  /** Connection established (after handshake) */
  onConnect?: () => void | Promise<void>;
  /** Connection closed */
  onClose?: () => void | Promise<void>;
  /** Error occurred */
  onError?: (error: Error) => void | Promise<void>;
}

export type LPIWSEventHandlers = LPIWSServerHandlers & LPIWSClientHandlers;

/** @deprecated Use LPIWSServerHandlers or LPIWSClientHandlers */
export type LRIWSEventHandlers = LPIWSServerHandlers & LPIWSClientHandlers;

/**
 * Parse LPI frame from binary buffer
 */
export function parseLPIFrame(buffer: Buffer): LPIFrame {
  if (buffer.length < 4) {
    throw new Error('Frame too small');
  }

  // Read LCE length (4 bytes, network byte order)
  const lceLength = buffer.readUInt32BE(0);

  if (buffer.length < 4 + lceLength) {
    throw new Error('Invalid frame');
  }

  // Extract LCE JSON
  const lceJson = buffer.slice(4, 4 + lceLength).toString('utf-8');
  const lce = JSON.parse(lceJson) as LCE;

  // Extract payload
  const payload = buffer.slice(4 + lceLength);

  return { lce, payload };
}

/**
 * Encode LPI frame to binary buffer
 */
export function encodeLPIFrame(lce: LCE, payload: Buffer | string): Buffer {
  const lceJson = JSON.stringify(lce);
  const lceBuffer = Buffer.from(lceJson, 'utf-8');
  const lceLength = lceBuffer.length;

  // Create length header (4 bytes)
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32BE(lceLength, 0);

  // Convert payload to buffer if string
  const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;

  // Concatenate: [length][lce][payload]
  return Buffer.concat([lengthBuffer, lceBuffer, payloadBuffer]);
}

/**
 * Check if message is LHS message
 */
export function isLHSMessage(msg: unknown): msg is LHSMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'step' in msg &&
    typeof (msg as { step: unknown }).step === 'string'
  );
}

export type LRIWSServerOptions = LPIWSServerOptions;
export type LRIWSClientOptions = LPIWSClientOptions;
export type LRIWSConnection = LPIWSConnection;
export type LRIWSServerHandlers = LPIWSServerHandlers;
export type LRIWSClientHandlers = LPIWSClientHandlers;

export const parseLRIFrame = createDeprecatedFunction(
  'parseLRIFrame',
  'parseLPIFrame',
  parseLPIFrame
);
export const encodeLRIFrame = createDeprecatedFunction(
  'encodeLRIFrame',
  'encodeLPIFrame',
  encodeLPIFrame
);
