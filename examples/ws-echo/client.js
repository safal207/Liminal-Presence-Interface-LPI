/**
 * LRI WebSocket Echo Client Example using the generic adapter.
 */

const WebSocket = require('ws');
const { ws } = require('node-lri');

const { LRIWebSocketAdapter } = ws;

const SERVER_URL = 'ws://localhost:8080';
const socket = new WebSocket(SERVER_URL);
const adapter = new LRIWebSocketAdapter({
  role: 'client',
  ws: socket,
  features: ['lss'],
});

const threadId = `thread-${Date.now()}`;
let pendingMessages = 0;

adapter.on('frame', (lce, payload) => {
  console.log('[Client] Received response:');
  console.log(`  Intent: ${lce.intent.type}`);
  if (lce.intent.goal) {
    console.log(`  Goal: ${lce.intent.goal}`);
  }
  if (lce.affect?.tags) {
    console.log(`  Affect tags: ${lce.affect.tags.join(', ')}`);
  }
  console.log(`  Payload: ${payload.toString()}\n`);

  pendingMessages--;
  if (pendingMessages <= 0) {
    console.log('[Client] All messages handled, closing connection...');
    adapter.close(1000, 'Client finished');
  }
});

adapter.on('error', (error) => {
  console.error('[Client] Error:', error.message);
});

adapter.on('close', () => {
  console.log('[Client] Connection closed');
  process.exit(0);
});

console.log(`Connecting to ${SERVER_URL} using adapter...`);

adapter.ready
  .then(() => {
    console.log('[Client] Connected and handshake completed!\n');

    const messages = [
      {
        lce: {
          v: 1,
          intent: { type: 'ask', goal: 'Test basic echo' },
          policy: { consent: 'private' },
          memory: { thread: threadId, t: new Date().toISOString() },
        },
        payload: 'Hello, LRI!',
      },
      {
        lce: {
          v: 1,
          intent: { type: 'tell', goal: 'Send data' },
          affect: {
            pad: [0.7, 0.5, 0.3],
            tags: ['curious', 'casual'],
          },
          policy: { consent: 'private' },
          memory: { thread: threadId, t: new Date().toISOString() },
        },
        payload: 'This message has affect metadata',
      },
      {
        lce: {
          v: 1,
          intent: { type: 'propose', goal: 'Suggest action' },
          policy: { consent: 'team', share: ['echo-service'] },
          memory: { thread: threadId, t: new Date().toISOString() },
        },
        payload: "Let's test consent levels",
      },
    ];

    pendingMessages = messages.length;

    messages.forEach((message, index) => {
      setTimeout(() => {
        console.log(`[Client] Sending message ${index + 1}/${messages.length}:`);
        console.log(`  Intent: ${message.lce.intent.type}`);
        console.log(`  Payload: ${message.payload}\n`);
        adapter.send(message.lce, message.payload);
      }, index * 1000);
    });
  })
  .catch((error) => {
    console.error('[Client] Connection failed:', error.message);
    process.exit(1);
  });
