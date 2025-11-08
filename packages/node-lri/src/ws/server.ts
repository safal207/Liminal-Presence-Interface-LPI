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

  // Intervention tracking
  private sessionCoherence: Map<string, number> = new Map(); // Previous coherence
  private lastIntervention: Map<string, number> = new Map(); // Last intervention timestamp

  // Public handler properties
  public onMessage?: LRIWSServerHandlers['onMessage'];
  public onConnect?: LRIWSServerHandlers['onConnect'];
  public onDisconnect?: LRIWSServerHandlers['onDisconnect'];
  public onError?: LRIWSServerHandlers['onError'];
  public onIntervention?: LRIWSServerHandlers['onIntervention'];

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
      interventions: options.interventions ?? false,
      interventionThreshold: options.interventionThreshold ?? 0.5,
      interventionCooldown: options.interventionCooldown ?? 30000, // 30 seconds
    };

    // Initialize LSS if enabled
    if (this.options.lss) {
      this.lss = new LSS({
        sessionTTL: this.options.sessionTimeout,
      });
    }

    // Validate interventions require LSS
    if (this.options.interventions && !this.options.lss) {
      throw new Error('Interventions require LSS to be enabled (lss: true)');
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
        const connData = this.connections.get(sessionId!);
        const threadId = connData?.conn.thread || sessionId!;

        this.connections.delete(sessionId!);

        // Cleanup intervention tracking
        this.sessionCoherence.delete(threadId);
        this.lastIntervention.delete(threadId);

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
    const threadId = conn.thread || sessionId;

    // Parse LRI frame
    const frame = parseLRIFrame(data);

    // Store previous coherence
    const previousCoherence = this.sessionCoherence.get(threadId);

    // Store in LSS if enabled
    if (this.lss) {
      await this.lss.store(threadId, frame.lce, frame.payload);

      // Reveal termas if conditions are met
      await this.lss.revealTermas(threadId);

      // Check for intervention if enabled
      if (this.options.interventions && this.onIntervention) {
        await this.checkIntervention(threadId, sessionId, previousCoherence);
      }
    }

    // Call message handler with Buffer payload
    if (this.onMessage) {
      await this.onMessage(sessionId, frame.lce, frame.payload);
    }
  }

  /**
   * Check if intervention is needed based on coherence
   */
  private async checkIntervention(
    threadId: string,
    sessionId: string,
    previousCoherence?: number
  ): Promise<void> {
    if (!this.lss || !this.onIntervention) return;

    const session = await this.lss.getSession(threadId);
    if (!session || session.messages.length < 2) return;

    const currentCoherence = session.coherence;

    // Save current coherence for next time
    this.sessionCoherence.set(threadId, currentCoherence);

    // Check threshold
    if (currentCoherence >= this.options.interventionThreshold) {
      return;
    }

    // Check cooldown
    const lastTime = this.lastIntervention.get(threadId) || 0;
    const now = Date.now();
    if (now - lastTime < this.options.interventionCooldown) {
      return;
    }

    // Get breakdown
    const breakdown = this.lss.calculateCoherence(session.messages);

    // Get awareness and obstacle metrics
    const awareness = session.awareness;
    const obstacles = session.obstacles;

    // Determine strategy (considering coherence, awareness, and obstacles)
    let strategy: 'refocus' | 'summarize' | 'clarify' | 'none' = 'none';
    let reason = '';

    // Highest priority: obstacles (specific communication barriers)
    if (obstacles.vagueness > 0.6) {
      strategy = 'clarify';
      reason = 'Vagueness detected - expression lacks specificity and concrete details';
    } else if (obstacles.contradiction > 0.5) {
      strategy = 'clarify';
      reason = 'Contradiction detected - conflicting statements in conversation';
    } else if (obstacles.semanticGap > 0.5) {
      strategy = 'refocus';
      reason = 'Semantic gap detected - logical jumps without connection';
    } else if (obstacles.comprehensionBarrier > 0.6) {
      strategy = 'summarize';
      reason = 'Comprehension barrier detected - communication is too complex';
    }
    // Second priority: awareness-based interventions (compassionate)
    else if (awareness.distraction > 0.6) {
      strategy = 'refocus';
      reason = 'High distraction detected - scattered attention across topics';
    } else if (awareness.clarity < 0.5) {
      strategy = 'clarify';
      reason = 'Low clarity - communication needs clarification';
    } else if (awareness.presence < 0.5) {
      strategy = 'summarize';
      reason = 'Low presence - conversation losing continuity';
    }
    // Fallback: coherence-based
    else if (breakdown.semanticAlignment < 0.5) {
      strategy = 'refocus';
      reason = 'Topic drift detected - multiple topics discussed';
    } else if (breakdown.intentSimilarity < 0.4) {
      strategy = 'clarify';
      reason = 'Intent inconsistency - unclear conversation direction';
    } else if (breakdown.affectStability < 0.5) {
      strategy = 'summarize';
      reason = 'Emotional volatility - unstable affect detected';
    } else {
      strategy = 'refocus';
      reason = 'General coherence drop - conversation losing focus';
    }

    // Update last intervention time
    this.lastIntervention.set(threadId, now);

    // Get recently revealed termas (only those revealed in last 5 seconds)
    const allTermas = await this.lss.getTermas(threadId);
    const recentlyRevealed = allTermas.filter(
      (t: any) =>
        t.revealed && t.revealedAt && now - new Date(t.revealedAt).getTime() < 5000
    );

    // Call intervention handler
    await this.onIntervention(sessionId, {
      coherence: currentCoherence,
      breakdown: {
        intentSimilarity: breakdown.intentSimilarity,
        affectStability: breakdown.affectStability,
        semanticAlignment: breakdown.semanticAlignment,
      },
      previousCoherence,
      awareness: {
        presence: awareness.presence,
        clarity: awareness.clarity,
        distraction: awareness.distraction,
        engagement: awareness.engagement,
        overall: awareness.overall,
      },
      obstacles: {
        vagueness: obstacles.vagueness,
        contradiction: obstacles.contradiction,
        semanticGap: obstacles.semanticGap,
        comprehensionBarrier: obstacles.comprehensionBarrier,
        overall: obstacles.overall,
      },
      termas: recentlyRevealed,
      suggestedStrategy: strategy,
      reason,
    });
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
   * Get awareness metrics for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Awareness metrics or null if LSS not enabled or session not found
   */
  async getAwareness(sessionId: string): Promise<any | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (session) {
      return session.awareness;
    }

    // Try finding by thread in active connections
    for (const { conn } of this.connections.values()) {
      if (conn.thread === sessionId) {
        const threadSession = await this.lss.getSession(conn.thread);
        return threadSession?.awareness ?? null;
      }
    }

    return null;
  }

  /**
   * Get detailed awareness breakdown
   *
   * @param sessionId - Session ID or thread ID
   * @returns Awareness components or null if LSS not enabled or session not found
   */
  async getAwarenessBreakdown(sessionId: string): Promise<any | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (!session) {
      return null;
    }

    return this.lss.calculateAwareness(session.messages);
  }

  /**
   * Get obstacle metrics for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Obstacle metrics or null if LSS not enabled or session not found
   */
  async getObstacles(sessionId: string): Promise<any | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (session) {
      return session.obstacles;
    }

    // Try finding by thread in active connections
    for (const { conn } of this.connections.values()) {
      if (conn.thread === sessionId) {
        const threadSession = await this.lss.getSession(conn.thread);
        return threadSession?.obstacles ?? null;
      }
    }

    return null;
  }

  /**
   * Get detailed obstacle breakdown
   *
   * @param sessionId - Session ID or thread ID
   * @returns Obstacle components or null if LSS not enabled or session not found
   */
  async getObstaclesBreakdown(sessionId: string): Promise<any | null> {
    if (!this.lss) {
      return null;
    }

    const session = await this.lss.getSession(sessionId);
    if (!session) {
      return null;
    }

    return this.lss.calculateObstacles(session.messages);
  }

  /**
   * Hide a terma (insight) for later revelation
   *
   * @param sessionId - Session ID or thread ID
   * @param content - The insight content to hide
   * @param type - Type of terma
   * @param revealConditions - Conditions for revelation
   * @param priority - Priority (higher = revealed first, default 5)
   * @returns Terma ID or null if LSS not enabled
   */
  async hideTerma(
    sessionId: string,
    content: string,
    type: 'insight' | 'pattern' | 'warning' | 'breakthrough',
    revealConditions: any,
    priority: number = 5
  ): Promise<string | null> {
    if (!this.lss) {
      return null;
    }

    try {
      return await this.lss.hideTerma(sessionId, content, type, revealConditions, priority);
    } catch {
      return null;
    }
  }

  /**
   * Get all termas for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Array of termas or null if LSS not enabled
   */
  async getTermas(sessionId: string): Promise<any[] | null> {
    if (!this.lss) {
      return null;
    }

    try {
      return await this.lss.getTermas(sessionId);
    } catch {
      return null;
    }
  }

  /**
   * Get unrevealed termas for a session
   *
   * @param sessionId - Session ID or thread ID
   * @returns Array of unrevealed termas or null if LSS not enabled
   */
  async getUnrevealedTermas(sessionId: string): Promise<any[] | null> {
    if (!this.lss) {
      return null;
    }

    try {
      return await this.lss.getUnrevealedTermas(sessionId);
    } catch {
      return null;
    }
  }

  /**
   * Reveal termas that meet their conditions
   *
   * @param sessionId - Session ID or thread ID
   * @returns Array of revealed termas or null if LSS not enabled
   */
  async revealTermas(sessionId: string): Promise<any[] | null> {
    if (!this.lss) {
      return null;
    }

    try {
      return await this.lss.revealTermas(sessionId);
    } catch {
      return null;
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

      // Cleanup intervention tracking
      this.sessionCoherence.clear();
      this.lastIntervention.clear();

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
