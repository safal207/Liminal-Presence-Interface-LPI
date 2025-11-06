/**
 * LRI WebSocket Server
 * Implements LHS protocol and LCE frame handling
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { LCE } from '../types';
import { LTP } from '../ltp';
import { LSS } from '../lss';
import {
  LRIWSServerOptions,
  LRIWSConnection,
  LRIWSServerHandlers,
  LHSHello,
  LHSMirror,
  LHSBind,
  LHSSeal,
  isLHSMessage,
  parseLRIFrame,
  encodeLRIFrame,
} from './types';

/**
 * LRI WebSocket Server
 *
 * Handles:
 * - LHS handshake sequence
 * - LCE frame encoding/decoding
 * - Session management
 *
 * @example
 * ```typescript
 * const server = new LRIWSServer({
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
export class LRIWSServer {
  private wss: WebSocketServer;
  private options: Required<LRIWSServerOptions>;
  private connections: Map<string, { ws: WebSocket; conn: LRIWSConnection }> = new Map();
  private lss?: LSS;

  // Public handler properties
  public onMessage?: LRIWSServerHandlers['onMessage'];
  public onConnect?: LRIWSServerHandlers['onConnect'];
  public onDisconnect?: LRIWSServerHandlers['onDisconnect'];
  public onError?: LRIWSServerHandlers['onError'];

  constructor(options: LRIWSServerOptions = {}) {
    this.options = {
      port: options.port ?? 8080,
      host: options.host ?? '0.0.0.0',
      ltp: options.ltp ?? false,
      ltpPrivateKey: options.ltpPrivateKey,
      lss: options.lss ?? false,
      encodings: options.encodings ?? ['json'],
      authenticate: options.authenticate ?? (async () => true),
      sessionTimeout: options.sessionTimeout ?? 3600000, // 1 hour
    };

    // Initialize LSS if enabled
    if (this.options.lss) {
      this.lss = new LSS({
        sessionTTL: this.options.sessionTimeout,
      });
    }

    // Start listening immediately
    this.wss = new WebSocketServer({
      port: this.options.port,
      host: this.options.host,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
  }

  /**
   * Get sessions map (for compatibility)
   */
  get sessions(): Map<string, { ws: WebSocket; conn: LRIWSConnection }> {
    return this.connections;
  }

  /**
   * Start listening for connections
   */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: this.options.port,
        host: this.options.host,
      });

      this.wss.on('listening', () => {
        console.log(`[LRI WS] Server listening on ${this.options.host}:${this.options.port}`);
        resolve();
      });

      this.wss.on('error', (error: Error) => {
        console.error('[LRI WS] Server error:', error);
        reject(error);
      });

      this.wss.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });
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
          console.error('[LRI WS] Message error:', error);
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
        console.error('[LRI WS] Connection error:', error);
        if (this.onError) {
          await this.onError(sessionId!, error);
        }
      });
    } catch (error) {
      console.error('[LRI WS] Handshake failed:', error);
      ws.close(1002, 'Handshake failed');
    }
  }

  /**
   * Perform LHS handshake
   */
  private async performHandshake(ws: WebSocket): Promise<LRIWSConnection> {
    return new Promise((resolve, reject) => {
      let step: 'hello' | 'bind' = 'hello';
      const conn: Partial<LRIWSConnection> = {
        sessionId: randomUUID(),
        encoding: 'json',
        features: new Set(),
        ready: false,
        connectedAt: new Date(),
      };

      const timeout = setTimeout(() => {
        reject(new Error('Handshake timeout'));
      }, 10000);

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
              lri_version: '0.1',
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
              const authenticated = await this.options.authenticate(bind.auth);
              if (!authenticated) {
                reject(new Error('Authentication failed'));
                return;
              }
            }

            conn.thread = bind.thread;

            // Send Seal
            const seal: LHSSeal = {
              step: 'seal',
              session_id: conn.sessionId!,
              expires: new Date(
                Date.now() + this.options.sessionTimeout
              ).toISOString(),
            };

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
                console.error('[LRI WS] LTP signing failed:', error);
              }
            }

            ws.send(JSON.stringify(seal));
            conn.ready = true;

            clearTimeout(timeout);
            ws.off('message', messageHandler);
            resolve(conn as LRIWSConnection);
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
   * Handle incoming LRI frame
   */
  private async handleMessage(sessionId: string, data: Buffer): Promise<void> {
    const connData = this.connections.get(sessionId);
    if (!connData) {
      throw new Error('Connection not found');
    }

    const { conn } = connData;

    // Parse LRI frame
    const frame = parseLRIFrame(data);

    // Store in LSS if enabled
    if (this.lss) {
      const threadId = conn.thread || sessionId;
      await this.lss.store(threadId, frame.lce, frame.payload);
    }

    // Call message handler with Buffer payload
    if (this.onMessage) {
      await this.onMessage(sessionId, frame.lce, frame.payload);
    }
  }

  /**
   * Send message to client
   */
  async send(sessionId: string, lce: LCE, payload: unknown): Promise<void> {
    const connData = this.connections.get(sessionId);
    if (!connData) {
      throw new Error('Connection not found');
    }

    const { ws, conn } = connData;

    // Serialize payload
    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const payloadBuffer = Buffer.from(payloadStr, 'utf-8');

    // Store in LSS if enabled (outgoing messages)
    if (this.lss) {
      const threadId = conn.thread || sessionId;
      await this.lss.store(threadId, lce, payload);
    }

    // Encode frame
    const frame = encodeLRIFrame(lce, payloadBuffer);

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
  getConnections(): LRIWSConnection[] {
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
   * Get conversation coherence for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Coherence score (0-1) or null if LSS not enabled or session not found
   */
  async getCoherence(sessionId: string): Promise<number | null> {
    if (!this.lss) {
      return null;
    }

    // Try sessionId first, then check if it's a thread
    const session = await this.lss.getSession(sessionId);
    if (session) {
      return session.coherence;
    }

    // Try finding by thread in active connections
    for (const { conn } of this.connections.values()) {
      if (conn.thread === sessionId) {
        const threadSession = await this.lss.getSession(conn.thread);
        return threadSession?.coherence ?? null;
      }
    }

    return null;
  }

  /**
   * Get conversation history for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Message history or null if LSS not enabled or session not found
   */
  async getHistory(sessionId: string): Promise<any[] | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (session) {
      return session.messages;
    }

    // Try finding by thread
    for (const { conn } of this.connections.values()) {
      if (conn.thread === sessionId) {
        const threadSession = await this.lss.getSession(conn.thread);
        return threadSession?.messages ?? null;
      }
    }

    return null;
  }

  /**
   * Get detailed coherence breakdown
   *
   * @param sessionId - Session ID or thread ID
   * @returns Coherence components or null if LSS not enabled or session not found
   */
  async getCoherenceBreakdown(sessionId: string): Promise<any | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (!session) {
      return null;
    }

    return this.lss.calculateCoherence(session.messages);
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

      // Cleanup LSS
      if (this.lss) {
        this.lss.destroy();
      }

      // Close server
      this.wss.close(() => {
        console.log('[LRI WS] Server closed');
        resolve();
      });
    });
  }
}
