/**
 * LRI WebSocket Client
 * Implements LHS protocol and LCE frame handling
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { LCE } from '../types';
import {
  LRIWSClientOptions,
  LRIWSConnection,
  LRIWSClientHandlers,
  LHSHello,
  LHSBind,
  LHSSeal,
  isLHSMessage,
  parseLRIFrame,
  encodeLRIFrame,
} from './types';

/**
 * LRI WebSocket Client
 *
 * Handles:
 * - LHS handshake sequence
 * - LCE frame encoding/decoding
 * - Automatic reconnection
 *
 * @example
 * ```typescript
 * const client = new LRIWSClient({
 *   url: 'ws://localhost:8080',
 *   features: ['lss'],
 * });
 *
 * client.on('message', (lce, payload) => {
 *   console.log('Received:', lce.intent.type, payload);
 * });
 *
 * await client.connect();
 *
 * client.send({
 *   v: 1,
 *   intent: { type: 'ask' },
 *   policy: { consent: 'private' },
 * }, { question: 'Hello?' });
 * ```
 */
export class LRIWSClient {
  private ws: WebSocket | null = null;
  private options: Required<Omit<LRIWSClientOptions, 'auth'>> & { auth?: string };
  private conn: LRIWSConnection | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Public handler properties
  public onMessage?: LRIWSClientHandlers['onMessage'];
  public onConnect?: LRIWSClientHandlers['onConnect'];
  public onClose?: LRIWSClientHandlers['onClose'];
  public onError?: LRIWSClientHandlers['onError'];

  constructor(urlOrOptions: string | LRIWSClientOptions) {
    // Allow passing URL string directly
    const options = typeof urlOrOptions === 'string' ? { url: urlOrOptions } : urlOrOptions;

    this.options = {
      url: options.url,
      clientId: options.clientId ?? randomUUID(),
      encoding: options.encoding ?? 'json',
      features: options.features ?? [],
      auth: options.auth,
      reconnect: options.reconnect ?? false,
    };
  }

  /**
   * Connect to server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.url);

      this.ws.on('open', async () => {
        try {
          await this.performHandshake();
          resolve();

          // Setup message handler
          this.ws!.on('message', async (data: Buffer) => {
            try {
              await this.handleMessage(data);
            } catch (error) {
              console.error('[LRI WS Client] Message error:', error);
              if (this.onError) {
                await this.onError(error as Error);
              }
            }
          });
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('close', async () => {
        console.log('[LRI WS Client] Connection closed');
        if (this.onClose) {
          await this.onClose();
        }
        this.conn = null;

        // Reconnect if enabled
        if (this.options.reconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', async (error: Error) => {
        console.error('[LRI WS Client] Connection error:', error);
        if (this.onError) {
          await this.onError(error);
        }
      });
    });
  }

  /**
   * Perform LHS handshake
   */
  private async performHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      let step: 'mirror' | 'seal' = 'mirror';

      const timeout = setTimeout(() => {
        reject(new Error('Handshake timeout'));
      }, 10000);

      const messageHandler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString('utf-8'));

          if (!isLHSMessage(msg)) {
            // Not an LHS message, might be flow data
            return;
          }

          // Step 2: Mirror
          if (step === 'mirror' && msg.step === 'mirror') {
            // Send Bind
            const bind: LHSBind = {
              step: 'bind',
              thread: randomUUID(),
              auth: this.options.auth,
            };

            this.ws!.send(JSON.stringify(bind));
            step = 'seal';
          }
          // Step 4: Seal
          else if (step === 'seal' && msg.step === 'seal') {
            const seal = msg as LHSSeal;

            // Create connection
            this.conn = {
              sessionId: seal.session_id,
              thread: randomUUID(),
              encoding: this.options.encoding,
              features: new Set(this.options.features),
              ready: true,
              connectedAt: new Date(),
            };

            clearTimeout(timeout);
            this.ws!.off('message', messageHandler);

            // Notify connection established
            if (this.onConnect) {
              const result = this.onConnect();
              if (result instanceof Promise) {
                result.catch(console.error);
              }
            }

            resolve();
          } else {
            reject(new Error(`Unexpected LHS step: ${msg.step}`));
          }
        } catch (error) {
          reject(error);
        }
      };

      this.ws!.on('message', messageHandler);

      // Send Hello
      const hello: LHSHello = {
        step: 'hello',
        lri_version: '0.1',
        encodings: [this.options.encoding],
        features: this.options.features,
        client_id: this.options.clientId,
      };

      this.ws!.send(JSON.stringify(hello));
    });
  }

  /**
   * Handle incoming LRI frame
   */
  private async handleMessage(data: Buffer): Promise<void> {
    if (!this.conn) {
      throw new Error('Connection not established');
    }

    // Parse LRI frame
    const frame = parseLRIFrame(data);

    // Call message handler with Buffer payload
    if (this.onMessage) {
      await this.onMessage(frame.lce, frame.payload);
    }
  }

  /**
   * Send message to server
   */
  send(lce: LCE, payload: unknown): void {
    if (!this.ws || !this.conn || !this.conn.ready) {
      throw new Error('Not connected');
    }

    // Serialize payload
    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const payloadBuffer = Buffer.from(payloadStr, 'utf-8');

    // Encode frame
    const frame = encodeLRIFrame(lce, payloadBuffer);

    // Send
    this.ws.send(frame);
  }

  /**
   * Get connection info
   */
  getConnection(): LRIWSConnection | null {
    return this.conn;
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.conn?.ready ?? false;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = 5000; // 5 seconds
    console.log(`[LRI WS Client] Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error('[LRI WS Client] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.conn = null;
  }
}
