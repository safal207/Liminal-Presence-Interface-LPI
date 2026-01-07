/**
 * LPI WebSocket Server
 * Implements LHS protocol and LCE frame handling
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'crypto';
import { LCE } from '../types';
import { LTP } from '../ltp';
import {
  LPIWSServerOptions,
  LPIWSConnection,
  LPIWSServerHandlers,
  LHSHello,
  LHSMirror,
  LHSBind,
  LHSSeal,
  isLHSMessage,
  parseLPIFrame,
  encodeLPIFrame,
} from './types';
import { createDeprecatedClass } from '../deprecation';
import { resolveProtoVersion } from './proto';

const isTestEnv = process.env.NODE_ENV === 'test';
const logInfo = (...args: Parameters<typeof console.log>): void => {
  if (!isTestEnv) {
    console.log(...args);
  }
};
const logError = (...args: Parameters<typeof console.error>): void => {
  if (!isTestEnv) {
    console.error(...args);
  }
};

/**
 * LPI WebSocket Server
 *
 * Handles:
 * - LHS handshake sequence
 * - LCE frame encoding/decoding
 * - Session management
 *
 * @example
 * ```typescript
 * const server = new LPIWSServer({
 *   port: 8080,
 *   ltp: false,
 *   lss: true,
 * });
 *
 * server.on('message', (lce, payload, conn) => {
 *   console.log('Received:', lce.intent.type, payload);
 *   server.send(conn.sessionId, {
 *     v: 1,
 *     intent: { type: 'tell' },
 *     policy: { consent: 'private' },
 *   }, payload);
 * });
 *
 * server.listen();
 * ```
 */
type NormalizedServerOptions = {
  port: number;
  host: string;
  ltp: boolean;
  ltpPrivateKey?: Uint8Array;
  lss: boolean;
  encodings: ('json' | 'cbor')[];
  lpiVersion: string;
  lriVersion?: string;
  strictVersion: boolean;
  authenticate: NonNullable<LPIWSServerOptions['authenticate']>;
  sessionTimeout: number;
};

export class LPIWSServer {
  private wss: WebSocketServer;
  private options: NormalizedServerOptions;
  private connections: Map<string, { ws: WebSocket; conn: LPIWSConnection }> = new Map();

  // Public handler properties
  public onMessage?: LPIWSServerHandlers['onMessage'];
  public onConnect?: LPIWSServerHandlers['onConnect'];
  public onDisconnect?: LPIWSServerHandlers['onDisconnect'];
  public onError?: LPIWSServerHandlers['onError'];

  constructor(options: LPIWSServerOptions = {}) {
    const normalizedVersion = resolveProtoVersion(options);
    this.options = {
      port: options.port ?? 8080,
      host: options.host ?? '0.0.0.0',
      lpiVersion: resolveProtoVersion(options),
      lriVersion: options.lriVersion,
      ltp: options.ltp ?? false,
      ltpPrivateKey: options.ltpPrivateKey,
      lss: options.lss ?? false,
      encodings: options.encodings ?? ['json'],
      lpiVersion: normalizedVersion,
      lriVersion: options.lriVersion,
      strictVersion: options.strictVersion ?? false,
      authenticate: options.authenticate ?? (async () => true),
      sessionTimeout: options.sessionTimeout ?? 3600000, // 1 hour
    };

    // Start listening immediately
    this.wss = new WebSocketServer({
      port: this.options.port,
      host: this.options.host,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.wss.on('error', (error: Error) => {
      logError('[LPI WS] Server error:', error);
    });
  }

  /**
   * Get sessions map (for compatibility)
   */
  get sessions(): Map<string, { ws: WebSocket; conn: LPIWSConnection }> {
    return this.connections;
  }

  /**
   * Get the actual port the server is listening on
   */
  get port(): number {
    const address = this.wss.address();
    if (address && typeof address !== 'string') {
      return address.port;
    }
    return this.options.port;
  }

  /**
   * Start listening for connections
   */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const address = this.wss.address() as AddressInfo | string | null;
        if (address) {
          resolve();
          return;
        }
      } catch {
        // Ignore; we'll resolve on the listening event.
      }
      const onListening = () => {
        this.wss.off('error', onError);
        logInfo(
          `[LPI WS] Server listening on ${this.options.host}:${this.port} (proto=${this.options.lpiVersion})`
        );
        resolve();
      };
      const onError = (error: Error) => {
        this.wss.off('listening', onListening);
        logError('[LPI WS] Server error:', error);
        reject(error);
      };

      this.wss.once('listening', onListening);
      this.wss.once('error', onError);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket): Promise<void> {
    let sessionId: string | null = null;

    try {
      // Wait for LHS handshake
      const conn = await this.performHandshake(ws);
      sessionId = conn.sessionId;

      // Store connection
      this.connections.set(sessionId, { ws, conn });

      // Notify connection established
      if (this.onConnect) {
        await this.onConnect(sessionId);
      }

      // Handle messages
      ws.on('message', async (data: Buffer) => {
        try {
          await this.handleMessage(sessionId!, data);
        } catch (error) {
          logError('[LPI WS] Message error:', error);
          if (this.onError) {
            await this.onError(sessionId!, error as Error);
          }
        }
      });

      ws.on('close', async () => {
        this.connections.delete(sessionId!);
        if (this.onDisconnect) {
          await this.onDisconnect(sessionId!);
        }
      });

      ws.on('error', async (error: Error) => {
        logError('[LPI WS] Connection error:', error);
        if (this.onError) {
          await this.onError(sessionId!, error);
        }
      });
    } catch (error) {
      logError('[LPI WS] Handshake failed:', error);
      ws.close(1002, 'Handshake failed');
    }
  }

  /**
   * Perform LHS handshake
   */
  private async performHandshake(ws: WebSocket): Promise<LPIWSConnection> {
    return new Promise((resolve, reject) => {
      let step: 'hello' | 'bind' = 'hello';
      let helloMsg: LHSHello | null = null;
      const conn: Partial<LPIWSConnection> = {
        sessionId: randomUUID(),
        encoding: 'json',
        features: new Set<'ltp' | 'lss' | 'compression'>(),
        ready: false,
        connectedAt: new Date(),
      };

      const timeout = setTimeout(() => {
        reject(new Error('Handshake timeout'));
      }, 10000).unref(); // Don't block process exit

      const messageHandler = async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString('utf-8'));

          if (!isLHSMessage(msg)) {
            reject(new Error('Expected LHS message'));
            return;
          }

          // Step 1: Hello
          if (step === 'hello' && msg.step === 'hello') {
            const hello = msg as LHSHello;
            helloMsg = hello;

            // Version mismatch handling (server-authoritative)
            const serverVersion = this.options.lpiVersion;
            const clientVersion = hello.lri_version;
            if (clientVersion && clientVersion !== serverVersion) {
              const message = `[LPI WS] Protocol version mismatch: client=${clientVersion} server=${serverVersion}`;
              if (this.options.strictVersion) {
                reject(new Error(message));
                return;
              }
              logInfo(message);
            }

            if (hello.client_id) {
              conn.peer = { clientId: hello.client_id };
            }

            // Negotiate encoding
            conn.encoding = this.options.encodings.includes(hello.encodings[0])
              ? hello.encodings[0]
              : 'json';

            // Negotiate features
            hello.features.forEach((feature) => {
              if (feature === 'ltp' && this.options.ltp) conn.features!.add('ltp');
              if (feature === 'lss' && this.options.lss) conn.features!.add('lss');
            });

            // Send Mirror
            const mirror: LHSMirror = {
              step: 'mirror',
              // Wire field stays `lri_version` for backwards compatibility.
              lri_version: this.options.lpiVersion,
              encoding: conn.encoding!,
              features: Array.from(conn.features!) as ('ltp' | 'lss')[],
            };

            ws.send(JSON.stringify(mirror));
            step = 'bind';
          }
          // Step 3: Bind
          else if (step === 'bind' && msg.step === 'bind') {
            const bind = msg as LHSBind;

            // Authenticate if auth provided
            if (bind.auth) {
              const authFn = this.options.authenticate;
              if (authFn) {
                if (!helloMsg) {
                  reject(new Error('Handshake state error: missing hello'));
                  return;
                }
                const params = { auth: bind.auth, hello: helloMsg, bind };
                let authenticated = false;
                try {
                  authenticated = await (authFn as (args: typeof params) => boolean | Promise<boolean>)(
                    params
                  );
                } catch {
                  try {
                    authenticated = await (authFn as (auth?: string) => boolean | Promise<boolean>)(
                      bind.auth
                    );
                  } catch {
                    authenticated = false;
                  }
                }
                if (!authenticated) {
                  reject(new Error('Authentication failed'));
                  return;
                }
              }
            }

            conn.thread = bind.thread;

            // Send Seal
            const seal: LHSSeal = {
              step: 'seal',
              session_id: conn.sessionId!,
            };

            if (this.options.sessionTimeout > 0) {
              const expiresAt = new Date(Date.now() + this.options.sessionTimeout);
              seal.expires = expiresAt.toISOString();
              conn.expiresAt = expiresAt;
            }

            // Add LTP signature if enabled
            if (this.options.ltp && this.options.ltpPrivateKey) {
              try {
                // Create minimal LCE for seal signature
                const sealLCE: LCE = {
                  v: 1,
                  intent: { type: 'sync' },
                  policy: { consent: 'private' },
                  memory: {
                    thread: conn.thread || conn.sessionId!,
                    t: new Date().toISOString(),
                  },
                };

                const signed = await LTP.sign(sealLCE, this.options.ltpPrivateKey);
                seal.sig = signed.sig;
              } catch (error) {
                logError('[LPI WS] LTP signing failed:', error);
              }
            }

            ws.send(JSON.stringify(seal));
            conn.ready = true;

            clearTimeout(timeout);
            ws.off('message', messageHandler);
            resolve(conn as LPIWSConnection);
          } else {
            reject(new Error(`Unexpected LHS step: ${msg.step}`));
          }
        } catch (error) {
          reject(error);
        }
      };

      ws.on('message', messageHandler);
    });
  }

  /**
   * Handle incoming LPI frame
   */
  private async handleMessage(sessionId: string, data: Buffer): Promise<void> {
    const connData = this.connections.get(sessionId);
    if (!connData) {
      throw new Error('Connection not found');
    }

    // Parse LPI frame
    const frame = parseLPIFrame(data);

    // Call message handler with Buffer payload
    if (this.onMessage) {
      await this.onMessage(sessionId, frame.lce, frame.payload);
    }
  }

  /**
   * Send message to client
   */
  send(sessionId: string, lce: LCE, payload: unknown): void {
    const connData = this.connections.get(sessionId);
    if (!connData) {
      throw new Error('Connection not found');
    }

    const { ws } = connData;

    // Serialize payload
    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const payloadBuffer = Buffer.from(payloadStr, 'utf-8');

    // Encode frame
    const frame = encodeLPIFrame(lce, payloadBuffer);

    // Send
    ws.send(frame);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(lce: LCE, payload: unknown): void {
    for (const sessionId of this.connections.keys()) {
      this.send(sessionId, lce, payload);
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): LPIWSConnection[] {
    return Array.from(this.connections.values()).map((c) => c.conn);
  }

  /**
   * Close specific connection
   */
  closeConnection(sessionId: string, reason?: string): void {
    const connData = this.connections.get(sessionId);
    if (connData) {
      connData.ws.close(1000, reason);
      this.connections.delete(sessionId);
    }
  }

  /**
   * Close server and all connections
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all connections
      for (const { ws } of this.connections.values()) {
        ws.close(1001, 'Server shutting down');
      }
      this.connections.clear();

      // Close server
      this.wss.close(() => {
        logInfo('[LPI WS] Server closed');
        resolve();
      });
    });
  }
}

export const LRIWSServer = createDeprecatedClass(
  'LRIWSServer',
  'LPIWSServer',
  LPIWSServer
);
