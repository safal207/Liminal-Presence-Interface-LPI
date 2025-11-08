/**
 * Padmasambhava Teacher WebSocket Server
 *
 * An LRI WebSocket server that provides adaptive wisdom teachings
 * based on student's emotional state and comprehension level.
 *
 * Features:
 * - LHS (Liminal Handshake Sequence) protocol
 * - LSS (Liminal Session Store) for coherence tracking
 * - Context-aware teaching selection
 * - Skillful means (upaya) - adapting teaching style to student
 *
 * The Vajra Path: Cutting through confusion with diamond clarity.
 */

import { ws } from 'node-lri';
import { PadmasambhavaTeacher } from './teacher.js';

const PORT = 8888; // 8 is auspicious in Buddhism (Noble Eightfold Path)

// Create teacher instance
const teacher = new PadmasambhavaTeacher();

// Create LRI WebSocket server with LSS for coherence tracking
const server = new ws.LRIWSServer({
  port: PORT,
  lss: true, // Enable coherence tracking
  ltp: false, // Cryptographic signing optional
  encodings: ['json'],
});

console.log('═══════════════════════════════════════════════════════');
console.log('🪷  Padmasambhava Teacher - The Vajra Path  🪷');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('Cutting through confusion with diamond clarity.');
console.log('');
console.log(`WebSocket server listening on port ${PORT}`);
console.log('Waiting for students to connect...');
console.log('');
console.log('Press Ctrl+C to shut down gracefully');
console.log('═══════════════════════════════════════════════════════');
console.log('');

/**
 * Connection established - student has arrived
 */
server.onConnect = (sessionId) => {
  console.log(`\n🙏 [Connect] Student arrived: ${sessionId}`);
  console.log(`   Active sessions: ${server.sessions.size}`);
};

/**
 * Message received - student is asking or sharing
 */
server.onMessage = (sessionId, lce, payload) => {
  try {
    console.log(`\n📿 [Message] Received from ${sessionId}`);
    console.log(`   Intent: ${lce.intent?.type}`);

    if (lce.intent?.goal) {
      console.log(`   Goal: ${lce.intent.goal}`);
    }

    if (lce.affect?.tags) {
      console.log(`   Affect: ${lce.affect.tags.join(', ')}`);
    }

    if (lce.qos?.coherence !== undefined) {
      console.log(`   Coherence: ${lce.qos.coherence.toFixed(2)}`);
    }

    // Let the teacher respond
    const response = teacher.teach(sessionId, lce, payload);

    // Send teaching back to student
    server.send(sessionId, response.lce, response.payload);

    console.log(`   ✅ Teaching sent`);
  } catch (error) {
    console.error(`   ❌ Error processing message:`, error.message);

    // Send error response with compassionate tone
    const errorLCE = {
      v: 1,
      intent: {
        type: 'tell',
        goal: 'Acknowledging difficulty',
      },
      policy: { consent: 'private' },
      affect: {
        tags: ['empathetic', 'supportive'],
        pad: [0.2, -0.2, 0.0],
      },
      memory: {
        thread: lce.memory?.thread,
        t: new Date().toISOString(),
      },
    };

    const errorPayload = {
      message: 'I encountered difficulty processing your message. Please try again, or rephrase your question.',
      error: error.message,
    };

    server.send(sessionId, errorLCE, JSON.stringify(errorPayload));
  }
};

/**
 * Disconnect - student is leaving
 */
server.onDisconnect = (sessionId) => {
  console.log(`\n🙏 [Disconnect] Student departed: ${sessionId}`);
  console.log(`   Active sessions: ${server.sessions.size}`);

  // Close teacher session
  teacher.closeSession(sessionId);
};

/**
 * Error handling
 */
server.onError = (sessionId, error) => {
  console.error(`\n❌ [Error] Session ${sessionId}:`, error.message);
};

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🙏 Teacher is departing...');
  console.log('');

  // Show session summary
  const activeSessions = teacher.getActiveSessions();
  if (activeSessions.length > 0) {
    console.log(`Sessions conducted: ${activeSessions.length}`);
    activeSessions.forEach(session => {
      console.log(`  - ${session.sessionId}: ${session.teachingsCount} teachings, ${session.messageCount} messages`);
    });
  }

  console.log('');
  console.log('May all beings be happy. May all beings be free.');
  console.log('═══════════════════════════════════════════════════════');

  await server.close();
  process.exit(0);
});

/**
 * Unhandled errors
 */
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
