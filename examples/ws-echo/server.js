/**
 * LRI WebSocket Echo Server Example
 *
 * Demonstrates:
 * - LHS (Liminal Handshake Sequence) protocol
 * - LCE frame encoding/decoding
 * - Session management
 * - Echo functionality with semantic context
 */

const { ws } = require('node-lri');

const PORT = 8080;

// Create LRI WebSocket server
const server = new ws.LRIWSServer({ port: PORT });

// Connection handler
server.onConnect = (sessionId) => {
  console.log(`[Server] Client connected: ${sessionId}`);
  console.log(`[Server] Active sessions: ${server.sessions.size}`);
};

// Message handler - echo back with modified LCE
server.onMessage = (sessionId, lce, payload) => {
  console.log(`[Server] Received from ${sessionId}:`);
  console.log(`  Intent: ${lce.intent.type}`);
  if (lce.intent.goal) {
    console.log(`  Goal: ${lce.intent.goal}`);
  }
  console.log(`  Payload: ${payload.toString()}`);

  // Echo back with 'tell' intent (response)
  const responseLCE = {
    v: 1,
    intent: {
      type: 'tell',
      goal: `Echo of: ${lce.intent.goal || 'your message'}`
    },
    policy: { consent: 'private' }
  };

  // Add affect if original message had it
  if (lce.affect) {
    responseLCE.affect = {
      pad: lce.affect.pad || [0, 0, 0],
      tags: ['responsive', ...(lce.affect.tags || [])]
    };
  }

  // Add memory context
  if (lce.memory) {
    responseLCE.memory = {
      thread: lce.memory.thread,
      t: new Date().toISOString()
    };
  }

  const echoPayload = `Echo: ${payload.toString()}`;

  server.send(sessionId, responseLCE, echoPayload);
  console.log(`[Server] Echoed back to ${sessionId}`);
};

// Disconnect handler
server.onDisconnect = (sessionId) => {
  console.log(`[Server] Client disconnected: ${sessionId}`);
  console.log(`[Server] Active sessions: ${server.sessions.size}`);
};

// Error handler
server.onError = (sessionId, error) => {
  console.error(`[Server] Error for ${sessionId}:`, error.message);
};

console.log(`LRI WebSocket Echo Server listening on port ${PORT}`);
console.log('Waiting for connections...\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  server.close();
  process.exit(0);
});
