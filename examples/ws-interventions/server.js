/**
 * WebSocket Server with Automatic Interventions
 *
 * Demonstrates:
 * - Automatic detection of coherence drop
 * - Smart intervention strategies (refocus, summarize, clarify)
 * - Cooldown to prevent spam
 * - Context-aware responses
 */

const { ws } = require('node-lri');

// Intervention message templates
const INTERVENTION_TEMPLATES = {
  refocus: (history) => {
    const topics = history
      .map((m) => m.lce.meaning?.topic)
      .filter((t) => t);
    const firstTopic = topics[0] || 'original topic';
    return `⚠️ I notice we've drifted from our original discussion. Let's refocus on ${firstTopic}. What would you like to know about that?`;
  },

  summarize: (history) => {
    const count = history.length;
    return `⚠️ We've covered a lot of ground (${count} messages). Let me summarize what we've discussed so far, and we can continue from there.`;
  },

  clarify: () => {
    return `⚠️ I want to make sure I understand you correctly. Could you clarify what you're looking for? This will help me give you a better response.`;
  },
};

async function main() {
  console.log('=== LRI WebSocket Server with Auto-Interventions ===\n');

  const server = new ws.LRIWSServer({
    port: 9002,
    lss: true, // Required for interventions
    interventions: true, // Enable automatic interventions
    interventionThreshold: 0.5, // Trigger when coherence < 0.5
    interventionCooldown: 10000, // Wait 10s between interventions
  });

  console.log('Server started on ws://localhost:9002');
  console.log('Interventions enabled:');
  console.log('  - Threshold: coherence < 0.5');
  console.log('  - Cooldown: 10 seconds');
  console.log('  - Strategies: refocus, summarize, clarify\n');

  // Handle interventions
  server.onIntervention = async (sessionId, info) => {
    console.log(`\n🚨 INTERVENTION TRIGGERED for ${sessionId}`);
    console.log(`   Coherence: ${info.coherence.toFixed(3)} (was ${info.previousCoherence?.toFixed(3) || 'N/A'})`);
    console.log(`   Strategy: ${info.suggestedStrategy}`);
    console.log(`   Reason: ${info.reason}`);
    console.log(`   Coherence Breakdown:`);
    console.log(`     ├─ Intent: ${info.breakdown.intentSimilarity.toFixed(3)}`);
    console.log(`     ├─ Affect: ${info.breakdown.affectStability.toFixed(3)}`);
    console.log(`     └─ Semantic: ${info.breakdown.semanticAlignment.toFixed(3)}`);

    if (info.awareness) {
      console.log(`   Awareness Metrics (Padmasambhava-inspired):`);
      console.log(`     ├─ Presence: ${info.awareness.presence.toFixed(3)} (here & now quality)`);
      console.log(`     ├─ Clarity: ${info.awareness.clarity.toFixed(3)} (communication clearness)`);
      console.log(`     ├─ Distraction: ${info.awareness.distraction.toFixed(3)} (scattered attention)`);
      console.log(`     ├─ Engagement: ${info.awareness.engagement.toFixed(3)} (depth of involvement)`);
      console.log(`     └─ Overall: ${info.awareness.overall.toFixed(3)} (combined awareness)`);
    }

    if (info.obstacles) {
      console.log(`   Obstacle Metrics (antarāya - impediments):`);
      console.log(`     ├─ Vagueness: ${info.obstacles.vagueness.toFixed(3)} (unclear expression)`);
      console.log(`     ├─ Contradiction: ${info.obstacles.contradiction.toFixed(3)} (conflicting statements)`);
      console.log(`     ├─ Semantic Gap: ${info.obstacles.semanticGap.toFixed(3)} (logical jumps)`);
      console.log(`     ├─ Comprehension Barrier: ${info.obstacles.comprehensionBarrier.toFixed(3)} (complexity)`);
      console.log(`     └─ Overall: ${info.obstacles.overall.toFixed(3)} (combined obstacles)`);
    }

    // Get history for context
    const history = await server.getHistory(sessionId);

    // Generate intervention message
    let message = '';
    switch (info.suggestedStrategy) {
      case 'refocus':
        message = INTERVENTION_TEMPLATES.refocus(history || []);
        break;
      case 'summarize':
        message = INTERVENTION_TEMPLATES.summarize(history || []);
        break;
      case 'clarify':
        message = INTERVENTION_TEMPLATES.clarify();
        break;
      default:
        message = '⚠️ Let me help you stay on track.';
    }

    // Send intervention message
    await server.send(sessionId, {
      v: 1,
      intent: { type: 'notify', goal: 'intervention' },
      affect: { pad: [0.5, 0.7, 0.6], tags: ['concerned', 'helpful'] },
      meaning: { topic: 'meta', tags: ['intervention', info.suggestedStrategy] },
      policy: { consent: 'private' },
    }, message);

    console.log(`   → Sent: ${message}`);
  };

  // Handle normal messages
  server.onMessage = async (sessionId, lce, payload) => {
    const message = payload.toString('utf-8');
    const coherence = await server.getCoherence(sessionId);
    const awareness = await server.getAwareness(sessionId);
    const obstacles = await server.getObstacles(sessionId);

    console.log(`\n[${sessionId}] Message: "${message}"`);
    console.log(`   Intent: ${lce.intent?.type || 'unknown'}`);
    console.log(`   Topic: ${lce.meaning?.topic || 'unknown'}`);
    console.log(`   Coherence: ${coherence?.toFixed(3)} ${coherence && coherence >= 0.7 ? '✓' : coherence && coherence < 0.5 ? '⚠️' : '~'}`);

    if (awareness) {
      console.log(`   Awareness: ${awareness.overall.toFixed(3)} (P:${awareness.presence.toFixed(2)} C:${awareness.clarity.toFixed(2)} D:${awareness.distraction.toFixed(2)} E:${awareness.engagement.toFixed(2)})`);
    }

    if (obstacles) {
      console.log(`   Obstacles: ${obstacles.overall.toFixed(3)} (V:${obstacles.vagueness.toFixed(2)} C:${obstacles.contradiction.toFixed(2)} S:${obstacles.semanticGap.toFixed(2)} B:${obstacles.comprehensionBarrier.toFixed(2)})`);
    }

    // Normal response (echo for demo)
    await server.send(sessionId, {
      v: 1,
      intent: { type: 'tell', goal: 'respond' },
      affect: { pad: [0.7, 0.6, 0.5], tags: ['helpful'] },
      meaning: { topic: lce.meaning?.topic || 'general' },
      policy: { consent: 'private' },
    }, `Received: ${message}`);
  };

  server.onConnect = (sessionId) => {
    console.log(`\n✓ Client connected: ${sessionId}`);
  };

  server.onDisconnect = async (sessionId) => {
    const coherence = await server.getCoherence(sessionId);
    const history = await server.getHistory(sessionId);
    console.log(`\n✗ Client disconnected: ${sessionId}`);
    console.log(`   Final coherence: ${coherence?.toFixed(3)}`);
    console.log(`   Total messages: ${history?.length || 0}`);
  };

  console.log('\nWaiting for clients...');
  console.log('Press Ctrl+C to stop\n');

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
