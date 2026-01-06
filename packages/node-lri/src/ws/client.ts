/**
 * LPI WebSocket Client
 * Implements LHS protocol and LCE frame handling
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { LCE } from '../types';
import {
  LPIWSClientOptions,
  LPIWSConnection,
  LPIWSClientHandlers,
  LHSHello,
  LHSBind,
  LHSSeal,
  isLHSMessage,
  parseLPIFrame,
  encodeLPIFrame,
} from './types';
import { createDeprecatedClass } from '../deprecation';

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
 * LPI WebSocket Client
 *
 * Handles:
 * - LHS handshake sequence
 * - LCE frame encoding/decoding
 * - Automatic reconnection
 *
 * @example
 * ```typescript
 * const client = new LPIWSClient({
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
export class LPIWSClient {
  private ws: WebSocket | null = null;
  private options: Required<Omit<LPIWSClientOptions, 'auth' | 'lpiVersion' | 'lriVersion'>> & {
    auth?: string;
    lpiVersion?: string;
    lriVersion?: string;
  };
  private conn: LPIWSConnection | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Public handler properties
  public onMessage?: LPIWSClientHandlers['onMessage'];
  public onConnect?: LPIWSClientHandlers['onConnect'];
  public onClose?: LPIWSClientHandlers['onClose'];
  public onError?: LPIWSClientHandlers['onError'];

  constructor(urlOrOptions: string | LPIWSClientOptions) {
    // Allow passing URL string directly
    const options = typeof urlOrOptions === 'string' ? { url: urlOrOptions } : urlOrOptions;

    this.options = {
      url: options.url,
      clientId: options.clientId ?? randomUUID(),
      lpiVersion: options.lpiVersion,
      lriVersion: options.lriVersion,
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
              logError('[LPI WS Client] Message error:', error);
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
        logInfo('[LPI WS Client] Connection closed');
        // Set conn to null BEFORE calling onClose handler
        this.conn = null;

        if (this.onClose) {
          await this.onClose();
        }

        // Reconnect if enabled
        if (this.options.reconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', async (error: Error) => {
        logError('[LPI WS Client] Connection error:', error);
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
      }, 10000).unref(); // Don't block process exit

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
                result.catch((error) => {
                  logError('[LPI WS Client] onConnect handler error:', error);
                });
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
        lri_version: this.options.lpiVersion ?? this.options.lriVersion ?? '0.1',
        encodings: [this.options.encoding],
        features: this.options.features,
        client_id: this.options.clientId,
      };

      this.ws!.send(JSON.stringify(hello));
    });
  }

  /**
   * Handle incoming LPI frame
   */
  private async handleMessage(data: Buffer): Promise<void> {
    if (!this.conn) {
      throw new Error('Connection not established');
    }

    // Parse LPI frame
    const frame = parseLPIFrame(data);

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
    const frame = encodeLPIFrame(lce, payloadBuffer);

    // Send
    this.ws.send(frame);
  }

  /**
   * Get connection info
   */
  getConnection(): LPIWSConnection | null {
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
    logInfo(`[LPI WS Client] Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        logError('[LPI WS Client] Reconnect failed:', error);
      });
    }, delay);

    // Don't block process exit
    if (this.reconnectTimer.unref) {
      this.reconnectTimer.unref();
    }
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

export const LRIWSClient = createDeprecatedClass(
  'LRIWSClient',
  'LPIWSClient',
  LPIWSClient
);
