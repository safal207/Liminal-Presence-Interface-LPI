/**
 * LRI WebSocket Echo Server Example using the generic adapter.
 */

const { WebSocketServer } = require('ws');
const { ws } = require('node-lri');

const { LRIWebSocketAdapter } = ws;

const PORT = 8080;
const sessions = new Map();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  const adapter = new LRIWebSocketAdapter({
    role: 'server',
    ws: socket,
    features: ['lss'],
  });

  adapter.once('ready', (connection) => {
    sessions.set(connection.sessionId, adapter);
    console.log(`[Server] Client connected: ${connection.sessionId}`);
    console.log(`[Server] Active sessions: ${sessions.size}`);
  });

  adapter.on('frame', (lce, payload) => {
    const sessionId = adapter.connection?.sessionId ?? 'unknown';
    console.log(`[Server] Received from ${sessionId}:`);
    console.log(`  Intent: ${lce.intent.type}`);
    if (lce.intent.goal) {
      console.log(`  Goal: ${lce.intent.goal}`);
    }
    console.log(`  Payload: ${payload.toString()}\n`);

    const responseLCE = {
      v: 1,
      intent: {
        type: 'tell',
        goal: `Echo of: ${lce.intent.goal || 'your message'}`,
      },
      policy: { consent: 'private' },
    };

    if (lce.affect) {
      responseLCE.affect = {
        pad: lce.affect.pad || [0, 0, 0],
        tags: ['responsive', ...(lce.affect.tags || [])],
      };
    }

    if (lce.memory) {
      responseLCE.memory = {
        thread: lce.memory.thread,
        t: new Date().toISOString(),
      };
    }

    adapter.send(responseLCE, `Echo: ${payload.toString()}`);
  });

  adapter.on('close', () => {
    const sessionId = adapter.connection?.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
      console.log(`[Server] Client disconnected: ${sessionId}`);
      console.log(`[Server] Active sessions: ${sessions.size}`);
    }
  });

  adapter.on('error', (error) => {
    const sessionId = adapter.connection?.sessionId ?? 'handshake';
    console.error(`[Server] Error for ${sessionId}:`, error.message);
  });
});

console.log(`LRI WebSocket Echo Server (adapter) listening on port ${PORT}`);
console.log('Waiting for connections...\n');

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  for (const adapter of sessions.values()) {
    adapter.close(1001, 'Server shutting down');
  }
  wss.close(() => {
    process.exit(0);
  });
});
