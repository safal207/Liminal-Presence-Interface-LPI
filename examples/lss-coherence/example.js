/**
 * LSS (Liminal Session Store) Example
 *
 * Demonstrates:
 * - Session storage and retrieval
 * - Coherence calculation
 * - Intent similarity tracking
 * - Affect stability measurement
 * - Semantic alignment detection
 */

const { lss } = require('node-lri');

async function main() {
  console.log('=== LSS (Liminal Session Store) Example ===\n');

  // Create LSS instance
  const store = new lss.LSS();

  // === Example 1: High Coherence Conversation ===
  console.log('1. High Coherence Conversation (Weather Discussion)');
  console.log('   - Same topic: weather');
  console.log('   - Natural ask/tell pattern');
  console.log('   - Stable emotional tone\n');

  const coherentMessages = [
    {
      v: 1,
      intent: { type: 'ask', goal: 'Get weather info' },
      affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
      meaning: { topic: 'weather' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'tell', goal: 'Provide weather info' },
      affect: { pad: [0.3, 0.2, 0.1], tags: ['helpful'] },
      meaning: { topic: 'weather' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'ask', goal: 'Ask follow-up' },
      affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
      meaning: { topic: 'weather' },
      policy: { consent: 'private' },
    },
  ];

  for (const lce of coherentMessages) {
    await store.store('thread-coherent', lce);
  }

  const coherentSession = await store.getSession('thread-coherent');
  console.log('   Coherence:', coherentSession.coherence.toFixed(3));

  const coherentBreakdown = store.calculateCoherence(coherentSession.messages);
  console.log('   ├─ Intent similarity:', coherentBreakdown.intentSimilarity.toFixed(3));
  console.log('   ├─ Affect stability:', coherentBreakdown.affectStability.toFixed(3));
  console.log('   └─ Semantic alignment:', coherentBreakdown.semanticAlignment.toFixed(3));
  console.log('');

  // === Example 2: Low Coherence Conversation ===
  console.log('2. Low Coherence Conversation (Topic Jumping)');
  console.log('   - Different topics: weather → food → work');
  console.log('   - Erratic intent types');
  console.log('   - Varying emotional tone\n');

  const incoherentMessages = [
    {
      v: 1,
      intent: { type: 'ask', goal: 'Weather' },
      affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
      meaning: { topic: 'weather' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'plan', goal: 'Dinner' },
      affect: { pad: [0.8, 0.9, 0.5], tags: ['excited'] },
      meaning: { topic: 'food' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'sync', goal: 'Work status' },
      affect: { pad: [0.1, 0.1, 0.9], tags: ['stressed'] },
      meaning: { topic: 'work' },
      policy: { consent: 'private' },
    },
  ];

  for (const lce of incoherentMessages) {
    await store.store('thread-incoherent', lce);
  }

  const incoherentSession = await store.getSession('thread-incoherent');
  console.log('   Coherence:', incoherentSession.coherence.toFixed(3));

  const incoherentBreakdown = store.calculateCoherence(incoherentSession.messages);
  console.log('   ├─ Intent similarity:', incoherentBreakdown.intentSimilarity.toFixed(3));
  console.log('   ├─ Affect stability:', incoherentBreakdown.affectStability.toFixed(3));
  console.log('   └─ Semantic alignment:', incoherentBreakdown.semanticAlignment.toFixed(3));
  console.log('');

  // === Example 3: Multi-Session Management ===
  console.log('3. Multi-Session Management');
  console.log('   - Track multiple conversations');
  console.log('   - Get statistics\n');

  // Add another session
  await store.store('thread-3', {
    v: 1,
    intent: { type: 'tell' },
    policy: { consent: 'private' },
  });

  const stats = store.getStats();
  console.log('   Sessions:', stats.sessionCount);
  console.log('   Total messages:', stats.totalMessages);
  console.log('   Average coherence:', stats.averageCoherence.toFixed(3));
  console.log('');

  // === Example 4: Intent Relationships ===
  console.log('4. Intent Relationships');
  console.log('   - ask/tell: complementary (question-answer)');
  console.log('   - propose/confirm: complementary (suggestion-agreement)');
  console.log('   - Different intents have varying similarity\n');

  const intentPairs = [
    ['ask', 'tell'],
    ['ask', 'ask'],
    ['ask', 'plan'],
    ['propose', 'confirm'],
  ];

  for (const [intent1, intent2] of intentPairs) {
    const messages = [
      {
        lce: { v: 1, intent: { type: intent1 }, policy: { consent: 'private' } },
        timestamp: new Date(),
      },
      {
        lce: { v: 1, intent: { type: intent2 }, policy: { consent: 'private' } },
        timestamp: new Date(),
      },
    ];
    const result = store.calculateCoherence(messages);
    console.log(`   ${intent1} → ${intent2}: ${result.intentSimilarity.toFixed(3)}`);
  }
  console.log('');

  // === Example 5: Real-time Coherence Tracking ===
  console.log('5. Real-time Coherence Tracking');
  console.log('   - Watch coherence evolve as conversation progresses\n');

  const threadId = 'thread-realtime';
  const realtimeMessages = [
    {
      v: 1,
      intent: { type: 'ask' },
      affect: { pad: [0.5, 0.5, 0.5], tags: [] },
      meaning: { topic: 'coding' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'tell' },
      affect: { pad: [0.5, 0.5, 0.5], tags: [] },
      meaning: { topic: 'coding' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'ask' },
      affect: { pad: [0.5, 0.5, 0.5], tags: [] },
      meaning: { topic: 'coding' },
      policy: { consent: 'private' },
    },
    {
      v: 1,
      intent: { type: 'plan' },
      affect: { pad: [0.8, 0.7, 0.6], tags: [] },
      meaning: { topic: 'project' },
      policy: { consent: 'private' },
    },
  ];

  for (let i = 0; i < realtimeMessages.length; i++) {
    await store.store(threadId, realtimeMessages[i]);
    const session = await store.getSession(threadId);
    console.log(`   Message ${i + 1}: coherence = ${session.coherence.toFixed(3)}`);
  }
  console.log('   (Notice coherence drops when topic changes)\n');

  // === Summary ===
  console.log('=== Summary ===');
  console.log('✓ LSS tracks conversation coherence in real-time');
  console.log('✓ Coherence formula: 0.4×intent + 0.3×affect + 0.3×semantic');
  console.log('✓ High coherence (>0.7): focused, stable conversation');
  console.log('✓ Low coherence (<0.5): drift detected, topic jumping');
  console.log('');
  console.log('Use cases:');
  console.log('  - Detect conversation drift');
  console.log('  - Guide AI to stay on topic');
  console.log('  - Measure conversation quality');
  console.log('  - Trigger interventions when coherence drops');
  console.log('');

  // Cleanup
  store.destroy();
  console.log('✓ LSS cleaned up');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
