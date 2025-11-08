import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { LCE } from '../types';
import {
  LRIWSConnection,
  LHSHello,
  LHSMirror,
  LHSBind,
  LHSSeal,
  isLHSMessage,
  parseLRIFrame,
  encodeLRIFrame,
} from './types';

/**
 * Base options shared between client and server adapters
 */
interface BaseAdapterOptions {
  /** Underlying WebSocket instance */
  ws: WebSocket;
  /** LRI protocol version */
  lriVersion?: string;
  /** Optional frame listener that will be attached automatically */
  onFrame?: (lce: LCE, payload: Buffer) => void;
}

/**
 * Server side adapter options
 */
export interface ServerAdapterOptions extends BaseAdapterOptions {
  role: 'server';
  /** Supported encodings */
  encodings?: ('json' | 'cbor')[];
  /** Supported optional features */
  features?: ('ltp' | 'lss' | 'compression')[];
  /** Custom session identifier */
  sessionId?: string;
  /** Optional server identifier echoed in mirror */
  serverId?: string;
  /** Duration (ms) before seal expiry timestamp */
  sealDurationMs?: number;
  /** Optional authentication hook invoked with bind auth token */
  authenticate?: (params: { auth?: string; hello: LHSHello; bind: LHSBind }) => Promise<boolean> | boolean;
}

/**
 * Client side adapter options
 */
export interface ClientAdapterOptions extends BaseAdapterOptions {
  role: 'client';
  /** Preferred encoding */
  encoding?: 'json' | 'cbor';
  /** Requested optional features */
  features?: ('ltp' | 'lss' | 'compression')[];
  /** Client identifier to advertise during hello */
  clientId?: string;
  /** Authentication token sent during bind */
  auth?: string;
  /** Optional thread identifier to reuse */
  threadId?: string;
}

export type LRIWebSocketAdapterOptions = ServerAdapterOptions | ClientAdapterOptions;

export type FrameListener = (lce: LCE, payload: Buffer) => void;
export type ReadyListener = (connection: LRIWSConnection) => void;

/**
 * Adapter that encapsulates the LHS handshake and LCE frame parsing for raw WebSocket instances.
 */
export class LRIWebSocketAdapter extends EventEmitter {
  public readonly role: 'client' | 'server';
  private readonly ws: WebSocket;
  private handshakeListener: ((data: RawData) => void) | null = null;
  private resolved = false;
  private readyResolve!: (value: LRIWSConnection) => void;
  private readyReject!: (reason: Error) => void;
  public readonly ready: Promise<LRIWSConnection>;
  public connection: LRIWSConnection | null = null;
  private serverOptions?: ServerAdapterOptions;
  private clientOptions?: ClientAdapterOptions;

  constructor(options: LRIWebSocketAdapterOptions) {
    super();
    this.role = options.role;
    this.ws = options.ws;
    if (options.onFrame) {
      this.on('frame', options.onFrame);
    }

    this.ready = new Promise<LRIWSConnection>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.ws.on('close', () => {
      this.emit('close');
    });

    this.ws.on('error', (error: Error) => {
      if (!this.connection) {
        this.rejectHandshake(error);
        return;
      }
      this.emit('error', error);
    });

    if (options.role === 'server') {
      const serverOptions: ServerAdapterOptions = {
        role: 'server',
        ws: this.ws,
        lriVersion: options.lriVersion ?? '0.1',
        encodings: options.encodings ?? ['json'],
        features: options.features ?? [],
        sessionId: options.sessionId,
        serverId: options.serverId,
        sealDurationMs: options.sealDurationMs ?? 60 * 60 * 1000,
        authenticate: options.authenticate ?? (async () => true),
      };
      this.serverOptions = serverOptions;
      this.startServerHandshake(serverOptions);
    } else {
      const clientOptions: ClientAdapterOptions = {
        role: 'client',
        ws: this.ws,
        lriVersion: options.lriVersion ?? '0.1',
        encoding: options.encoding ?? 'json',
        features: options.features ?? [],
        clientId: options.clientId,
        auth: options.auth,
        threadId: options.threadId,
      };
      this.clientOptions = clientOptions;
      this.startClientHandshake(clientOptions);
    }
  }

  /**
   * Send an LCE frame once the handshake is complete.
   */
  public send(lce: LCE, payload: Buffer | string | Record<string, unknown>): void {
    if (!this.connection || !this.connection.ready) {
      throw new Error('Cannot send before handshake completes');
    }

    const payloadBuffer = Buffer.isBuffer(payload)
      ? payload
      : typeof payload === 'string'
      ? Buffer.from(payload, 'utf-8')
      : Buffer.from(JSON.stringify(payload), 'utf-8');

    const frame = encodeLRIFrame(lce, payloadBuffer);
    this.ws.send(frame);
  }

  /**
   * Close the underlying WebSocket connection.
   */
  public close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }

  private startServerHandshake(options: ServerAdapterOptions): void {
    let phase: 'hello' | 'bind' = 'hello';
    let negotiatedEncoding: 'json' | 'cbor' = 'json';
    let negotiatedFeatures: ('ltp' | 'lss' | 'compression')[] = [];
    let helloMsg: LHSHello | null = null;

    this.handshakeListener = async (raw: RawData) => {
      try {
        const message = this.parseHandshakeMessage(raw);
        if (!isLHSMessage(message)) {
          throw new Error('Expected LHS handshake message');
        }

        if (phase === 'hello' && message.step === 'hello') {
          helloMsg = message;
          if (!Array.isArray(message.encodings) || message.encodings.length === 0) {
            throw new Error('Hello must include encodings');
          }

          const supportedEncodings = options.encodings ?? ['json'];
          const candidate = message.encodings.find((enc) => supportedEncodings.includes(enc));
          negotiatedEncoding = candidate ?? supportedEncodings[0] ?? 'json';

          const supportedFeatures = options.features ?? [];
          negotiatedFeatures = (message.features ?? []).filter((feature) =>
            supportedFeatures.includes(feature)
          ) as ('ltp' | 'lss' | 'compression')[];

          const mirror: LHSMirror = {
            step: 'mirror',
            lri_version: options.lriVersion ?? '0.1',
            encoding: negotiatedEncoding,
            features: negotiatedFeatures,
          };

          if (options.serverId) {
            mirror.server_id = options.serverId;
          }

          this.ws.send(JSON.stringify(mirror));
          phase = 'bind';
          return;
        }

        if (phase === 'bind' && message.step === 'bind') {
          const bind = message as LHSBind;
          const authenticated = await (options.authenticate?.({
            auth: bind.auth,
            hello: helloMsg!,
            bind,
          }) ?? true);

          if (!authenticated) {
            throw new Error('Authentication failed');
          }

          const sessionId = options.sessionId ?? randomUUID();
          const seal: LHSSeal = {
            step: 'seal',
            session_id: sessionId,
          };

          const sealDuration = options.sealDurationMs ?? 60 * 60 * 1000;
          if (sealDuration > 0) {
            seal.expires = new Date(Date.now() + sealDuration).toISOString();
          }

          this.ws.send(JSON.stringify(seal));

          this.setConnection({
            sessionId,
            thread: bind.thread,
            encoding: negotiatedEncoding,
            features: new Set(negotiatedFeatures),
            ready: true,
            connectedAt: new Date(),
          });
          return;
        }

        throw new Error(`Unexpected handshake message: ${message.step}`);
      } catch (error) {
        this.rejectHandshake(error as Error);
      }
    };

    this.ws.on('message', this.handshakeListener);
  }

  private startClientHandshake(options: ClientAdapterOptions): void {
    const begin = () => {
      let phase: 'mirror' | 'seal' = 'mirror';
      const requestedThread = options.threadId ?? randomUUID();
      let negotiatedFeatures: ('ltp' | 'lss' | 'compression')[] = [];
      let negotiatedEncoding: 'json' | 'cbor' = options.encoding ?? 'json';

      this.handshakeListener = (raw: RawData) => {
        try {
          const message = this.parseHandshakeMessage(raw);
          if (!isLHSMessage(message)) {
            // Ignore non-handshake messages until ready
            return;
          }

          if (phase === 'mirror' && message.step === 'mirror') {
            const mirror = message as LHSMirror;
            negotiatedEncoding = mirror.encoding;
            negotiatedFeatures = mirror.features ?? [];

            const bind: LHSBind = {
              step: 'bind',
              thread: requestedThread,
            };

            if (options.auth) {
              bind.auth = options.auth;
            }

            this.ws.send(JSON.stringify(bind));
            phase = 'seal';
            return;
          }

          if (phase === 'seal' && message.step === 'seal') {
            const seal = message as LHSSeal;

            this.setConnection({
              sessionId: seal.session_id,
              thread: requestedThread,
              encoding: negotiatedEncoding,
              features: new Set(negotiatedFeatures),
              ready: true,
              connectedAt: new Date(),
            });
            return;
          }

          throw new Error(`Unexpected handshake message: ${message.step}`);
        } catch (error) {
          this.rejectHandshake(error as Error);
        }
      };

      this.ws.on('message', this.handshakeListener);

      const hello: LHSHello = {
        step: 'hello',
        lri_version: options.lriVersion ?? '0.1',
        encodings: [options.encoding ?? 'json'],
        features: options.features ?? [],
      };

      if (options.clientId) {
        hello.client_id = options.clientId;
      }

      this.ws.send(JSON.stringify(hello));
    };

    if (this.ws.readyState === this.ws.OPEN) {
      begin();
    } else {
      this.ws.once('open', begin);
    }
  }

  private setConnection(connection: LRIWSConnection): void {
    if (this.handshakeListener) {
      this.ws.off('message', this.handshakeListener);
      this.handshakeListener = null;
    }

    this.connection = connection;
    this.resolved = true;
    this.readyResolve(connection);
    this.emit('ready', connection);

    this.ws.on('message', this.handleFrame);
  }

  private handleFrame = (raw: RawData): void => {
    try {
      const buffer = this.rawDataToBuffer(raw);
      const frame = parseLRIFrame(buffer);
      this.emit('frame', frame.lce, frame.payload);
    } catch (error) {
      this.emit('error', error as Error);
    }
  };

  private parseHandshakeMessage(raw: RawData): unknown {
    const text = this.rawDataToBuffer(raw).toString('utf-8');
    return JSON.parse(text);
  }

  private rawDataToBuffer(raw: RawData): Buffer {
    if (typeof raw === 'string') {
      return Buffer.from(raw, 'utf-8');
    }

    if (Buffer.isBuffer(raw)) {
      return raw;
    }

    if (Array.isArray(raw)) {
      return Buffer.concat(raw.map((item) => this.rawDataToBuffer(item)));
    }

    if (raw instanceof ArrayBuffer) {
      return Buffer.from(raw);
    }

    return Buffer.from(raw as ArrayBufferLike);
  }

  private rejectHandshake(error: Error): void {
    if (!this.resolved) {
      this.resolved = true;
      if (this.handshakeListener) {
        this.ws.off('message', this.handshakeListener);
        this.handshakeListener = null;
      }
      this.readyReject(error);
      if (this.ws.readyState === this.ws.OPEN || this.ws.readyState === this.ws.CONNECTING) {
        try {
          this.ws.close(1002, 'Handshake failed');
        } catch (closeError) {
          this.emit('error', closeError as Error);
        }
      }
    }
    this.emit('error', error);
  }
}

export default LRIWebSocketAdapter;
