/**
 * WebSocket Server with LSS (Liminal Session Store)
 *
 * Demonstrates:
 * - Automatic conversation tracking
 * - Real-time coherence calculation
 * - History retrieval
 * - Coherence-based responses
 */

const { ws } = require('node-lri');

async function main() {
  console.log('=== LRI WebSocket Server with LSS ===\n');

  // Create server with LSS enabled
  const server = new ws.LRIWSServer({
    port: 9001,
    lss: true, // Enable LSS tracking
  });

  console.log('Server started on ws://localhost:9001');
  console.log('LSS enabled: tracking coherence automatically\n');

  // Handle incoming messages
  server.onMessage = async (sessionId, lce, payload) => {
    const message = payload.toString('utf-8');
    console.log(`\n[${sessionId}] Received:`, lce.intent?.type, '→', message);

    // Get current coherence
    const coherence = await server.getCoherence(sessionId);
    console.log(`  Coherence: ${coherence?.toFixed(3)}`);

    // Get detailed breakdown
    const breakdown = await server.getCoherenceBreakdown(sessionId);
    if (breakdown) {
      console.log(`  ├─ Intent similarity: ${breakdown.intentSimilarity.toFixed(3)}`);
      console.log(`  ├─ Affect stability: ${breakdown.affectStability.toFixed(3)}`);
      console.log(`  └─ Semantic alignment: ${breakdown.semanticAlignment.toFixed(3)}`);
    }

    // Get history
    const history = await server.getHistory(sessionId);
    console.log(`  Message count: ${history?.length || 0}`);

    // Respond with coherence info
    let responseText = `Received: ${message}`;

    if (coherence !== null) {
      responseText += `\n\nCoherence: ${coherence.toFixed(3)}`;

      if (coherence < 0.5) {
        responseText += '\n⚠️ Low coherence detected - conversation may be drifting';
      } else if (coherence > 0.8) {
        responseText += '\n✓ High coherence - focused conversation';
      }
    }

    // Send response
    await server.send(sessionId, {
      v: 1,
      intent: { type: 'tell', goal: 'respond with coherence info' },
      affect: coherence && coherence < 0.5
        ? { pad: [0.3, 0.5, 0.6], tags: ['concerned'] }
        : { pad: [0.7, 0.6, 0.5], tags: ['helpful'] },
      meaning: { topic: lce.meaning?.topic || 'general' },
      policy: { consent: 'private' },
    }, responseText);

    console.log(`  → Sent response with coherence: ${coherence?.toFixed(3)}`);
  };

  // Handle new connections
  server.onConnect = async (sessionId) => {
    console.log(`\n✓ Client connected: ${sessionId}`);
  };

  // Handle disconnections
  server.onDisconnect = async (sessionId) => {
    console.log(`\n✗ Client disconnected: ${sessionId}`);

    // Get final coherence
    const coherence = await server.getCoherence(sessionId);
    const history = await server.getHistory(sessionId);

    if (coherence !== null && history) {
      console.log(`  Final coherence: ${coherence.toFixed(3)}`);
      console.log(`  Total messages: ${history.length}`);
    }
  };

  // Keep running
  console.log('\nWaiting for clients...');
  console.log('Press Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
