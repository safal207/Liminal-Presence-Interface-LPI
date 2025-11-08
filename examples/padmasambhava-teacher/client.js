/**
 * Padmasambhava Teacher Client
 *
 * Interactive client for connecting to the teacher and receiving teachings
 */

import { ws } from 'node-lri';
import { createInterface } from 'readline';

const PORT = 8888;
const SERVER_URL = `ws://localhost:${PORT}`;

console.log('═══════════════════════════════════════════════════════');
console.log('🪷  Connecting to Padmasambhava Teacher  🪷');
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Create LRI WebSocket client
const client = new ws.LRIWSClient({
  url: SERVER_URL,
  features: ['lss'], // Enable coherence tracking
});

// State tracking
let isConnected = false;
let currentThread = null;

// Setup readline for interactive input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n🙏 You: ',
});

/**
 * Connection established
 */
client.onConnect = (sessionId) => {
  isConnected = true;
  currentThread = sessionId; // Use session ID as thread

  console.log('✅ Connected to teacher');
  console.log(`   Session: ${sessionId}`);
  console.log('');
  console.log('You may now ask questions or share your thoughts.');
  console.log('Type "help" for available commands.');
  console.log('Type "exit" to disconnect.');
  console.log('');

  rl.prompt();
};

/**
 * Teaching received
 */
client.onMessage = (lce, payload) => {
  console.log('');
  console.log('─────────────────────────────────────────────────────');
  console.log('📿 Teacher responds:');
  console.log('');

  // Parse response
  let teaching;
  try {
    teaching = JSON.parse(payload.toString());
  } catch (e) {
    teaching = { teaching: payload.toString() };
  }

  // Display teaching
  if (teaching.teaching) {
    console.log(teaching.teaching);
  } else if (teaching.message) {
    console.log(teaching.message);
  } else {
    console.log(payload.toString());
  }

  console.log('');

  // Display metadata if available
  if (teaching.metadata) {
    console.log(`📊 [Teaching ID: ${teaching.metadata.teaching_id}]`);
    if (teaching.metadata.selection_score) {
      console.log(`   Match score: ${teaching.metadata.selection_score}`);
    }
    if (teaching.metadata.session_summary) {
      const summary = teaching.metadata.session_summary;
      console.log(`   Your progress: ${summary.teachingsCount} teachings, coherence: ${summary.averageCoherence.toFixed(2)}`);
    }
  }

  // Display affect if available
  if (lce.affect?.tags) {
    console.log(`   Tone: ${lce.affect.tags.join(', ')}`);
  }

  console.log('─────────────────────────────────────────────────────');

  rl.prompt();
};

/**
 * Disconnected
 */
client.onDisconnect = () => {
  isConnected = false;
  console.log('\n✋ Disconnected from teacher');
  console.log('');
  console.log('May the teachings benefit all beings.');
  console.log('');
  rl.close();
  process.exit(0);
};

/**
 * Error
 */
client.onError = (error) => {
  console.error('\n❌ Error:', error.message);
  rl.prompt();
};

/**
 * Connect to server
 */
async function connect() {
  try {
    await client.connect();
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    console.log('');
    console.log('Is the server running? Try: npm run server');
    process.exit(1);
  }
}

/**
 * Send message to teacher
 */
function sendMessage(text, intent = 'ask', affectTags = ['curious']) {
  if (!isConnected) {
    console.log('❌ Not connected to server');
    return;
  }

  const lce = {
    v: 1,
    intent: {
      type: intent,
      goal: text.substring(0, 50),
    },
    policy: {
      consent: 'private',
    },
    affect: {
      tags: affectTags,
      pad: [0.3, 0.2, 0.1], // Default: curious
    },
    memory: {
      thread: currentThread,
      t: new Date().toISOString(),
    },
  };

  client.send(lce, text);
}

/**
 * Show help
 */
function showHelp() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Available commands:');
  console.log('');
  console.log('  help              - Show this help');
  console.log('  exit              - Disconnect and quit');
  console.log('  sync              - Check your understanding level');
  console.log('  plan <text>       - Share your practice plan');
  console.log('  reflect <text>    - Share a reflection or insight');
  console.log('  /frustrated       - Express frustration');
  console.log('  /confused         - Express confusion');
  console.log('  /curious          - Express curiosity (default)');
  console.log('  /peaceful         - Express peaceful state');
  console.log('');
  console.log('Or just type your question naturally!');
  console.log('═══════════════════════════════════════════════════════');
}

/**
 * Handle user input
 */
rl.on('line', (line) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  // Commands
  if (input === 'exit') {
    client.disconnect();
    return;
  }

  if (input === 'help') {
    showHelp();
    rl.prompt();
    return;
  }

  if (input === 'sync') {
    sendMessage('I would like to check my understanding', 'sync', ['neutral']);
    return;
  }

  if (input.startsWith('plan ')) {
    const plan = input.substring(5);
    sendMessage(plan, 'plan', ['confident', 'planning']);
    return;
  }

  if (input.startsWith('reflect ')) {
    const reflection = input.substring(8);
    sendMessage(reflection, 'reflect', ['analytical', 'thoughtful']);
    return;
  }

  // Affect modifiers
  if (input.startsWith('/')) {
    const affect = input.substring(1);
    console.log(`   [Affect set to: ${affect}]`);
    // Store for next message
    rl.prompt();
    return;
  }

  // Default: send as question with curious affect
  sendMessage(input, 'ask', ['curious']);
});

rl.on('close', () => {
  if (isConnected) {
    client.disconnect();
  }
});

// Start
connect();
