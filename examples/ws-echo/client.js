/**
 * LRI WebSocket Echo Client Example
 *
 * Demonstrates:
 * - Connecting to LRI WebSocket server
 * - LHS handshake from client side
 * - Sending messages with LCE context
 * - Receiving and handling responses
 */

const { ws } = require('node-lri');

const SERVER_URL = 'ws://localhost:8080';

// Create LRI WebSocket client
const client = new ws.LRIWSClient(SERVER_URL);

// Track message thread
const threadId = `thread-${Date.now()}`;
let messageCount = 0;

// Message handler
client.onMessage = (lce, payload) => {
  console.log('[Client] Received response:');
  console.log(`  Intent: ${lce.intent.type}`);
  if (lce.intent.goal) {
    console.log(`  Goal: ${lce.intent.goal}`);
  }
  if (lce.affect) {
    console.log(`  Affect tags: ${lce.affect.tags.join(', ')}`);
  }
  console.log(`  Payload: ${payload.toString()}\n`);
};

// Error handler
client.onError = (error) => {
  console.error('[Client] Error:', error.message);
};

// Close handler
client.onClose = () => {
  console.log('[Client] Connection closed');
  process.exit(0);
};

// Connect to server
console.log(`Connecting to ${SERVER_URL}...`);

client.connect().then(() => {
  console.log('[Client] Connected and handshake completed!\n');

  // Send a series of test messages
  const messages = [
    {
      lce: {
        v: 1,
        intent: { type: 'ask', goal: 'Test basic echo' },
        policy: { consent: 'private' },
        memory: { thread: threadId, t: new Date().toISOString() }
      },
      payload: 'Hello, LRI!'
    },
    {
      lce: {
        v: 1,
        intent: { type: 'tell', goal: 'Send data' },
        affect: {
          pad: [0.7, 0.5, 0.3],
          tags: ['curious', 'casual']
        },
        policy: { consent: 'private' },
        memory: { thread: threadId, t: new Date().toISOString() }
      },
      payload: 'This message has affect metadata'
    },
    {
      lce: {
        v: 1,
        intent: { type: 'propose', goal: 'Suggest action' },
        policy: { consent: 'team', share: ['echo-service'] },
        memory: { thread: threadId, t: new Date().toISOString() }
      },
      payload: 'Let\'s test consent levels'
    }
  ];

  // Send messages with delay
  messages.forEach((msg, index) => {
    setTimeout(() => {
      console.log(`[Client] Sending message ${index + 1}/${messages.length}:`);
      console.log(`  Intent: ${msg.lce.intent.type}`);
      console.log(`  Payload: ${msg.payload}\n`);

      client.send(msg.lce, msg.payload);
      messageCount++;

      // Disconnect after last message response
      if (messageCount === messages.length) {
        setTimeout(() => {
          console.log('[Client] All messages sent, disconnecting...');
          client.disconnect();
        }, 2000);
      }
    }, index * 1000); // 1 second between messages
  });
}).catch((error) => {
  console.error('[Client] Connection failed:', error.message);
  process.exit(1);
});
