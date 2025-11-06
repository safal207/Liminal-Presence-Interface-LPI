/**
 * Awareness Layer Demo (Padmasambhava-inspired)
 *
 * Demonstrates how awareness metrics track the quality
 * of mindful presence in conversation:
 * - Presence: "here and now" quality
 * - Clarity: communication clearness
 * - Distraction: scattered attention
 * - Engagement: depth of involvement
 */

const { lss: lssModule } = require('node-lri');

// Create LSS instance
const lss = new lssModule.LSS();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printAwareness(label, awareness) {
  console.log(`\n${label}`);
  console.log(`  Presence:    ${awareness.presence.toFixed(3)} - "here and now" quality`);
  console.log(`  Clarity:     ${awareness.clarity.toFixed(3)} - communication clearness`);
  console.log(`  Distraction: ${awareness.distraction.toFixed(3)} - scattered attention (lower is better)`);
  console.log(`  Engagement:  ${awareness.engagement.toFixed(3)} - depth of involvement`);
  console.log(`  Overall:     ${awareness.overall.toFixed(3)} - combined awareness`);
}

async function main() {
  console.log('=== LRI Awareness Layer Demo ===\n');
  console.log('Inspired by Padmasambhava\'s teachings on mindful presence\n');

  // Scenario 1: Focused conversation (high awareness)
  console.log('--- Scenario 1: Focused Conversation ---');
  console.log('All messages about same topic, consistent timing, engaged dialogue\n');

  const session1 = 'focused-session';
  for (let i = 0; i < 5; i++) {
    const lce = {
      v: 1,
      intent: { type: i % 2 === 0 ? 'ask' : 'tell' },
      meaning: { topic: 'mindfulness' },
      affect: { pad: [0.7, 0.6, 0.5], tags: ['curious', 'present'] },
      policy: { consent: 'private' },
    };
    await lss.store(session1, lce, `Message ${i + 1} about mindfulness`);
    await sleep(200); // Consistent timing
  }

  const focused = await lss.getSession(session1);
  printAwareness('Result: High Awareness ✓', focused.awareness);

  await sleep(1000);

  // Scenario 2: Topic drift (medium awareness, high distraction)
  console.log('\n\n--- Scenario 2: Topic Drift ---');
  console.log('Jumping between different topics - losing focus\n');

  const session2 = 'drifting-session';
  const topics = ['meditation', 'cooking', 'sports', 'technology', 'history'];
  for (let i = 0; i < topics.length; i++) {
    const lce = {
      v: 1,
      intent: { type: 'tell' },
      meaning: { topic: topics[i] },
      affect: { pad: [Math.random(), Math.random(), Math.random()], tags: [] },
      policy: { consent: 'private' },
    };
    await lss.store(session2, lce, `Message about ${topics[i]}`);
  }

  const drifting = await lss.getSession(session2);
  printAwareness('Result: Medium Awareness, High Distraction ⚠️', drifting.awareness);

  await sleep(1000);

  // Scenario 3: Intent chaos (low clarity)
  console.log('\n\n--- Scenario 3: Intent Chaos ---');
  console.log('Erratic intents without clear direction\n');

  const session3 = 'chaotic-session';
  const intents = ['ask', 'plan', 'notify', 'sync', 'reflect'];
  for (const intent of intents) {
    const lce = {
      v: 1,
      intent: { type: intent },
      meaning: { topic: 'project' },
      affect: { pad: [0.5, 0.5, 0.5], tags: ['confused'] },
      policy: { consent: 'private' },
    };
    await lss.store(session3, lce, `${intent} about project`);
  }

  const chaotic = await lss.getSession(session3);
  printAwareness('Result: Low Clarity, High Intent Variance ⚠️', chaotic.awareness);

  await sleep(1000);

  // Scenario 4: Low engagement (monologue)
  console.log('\n\n--- Scenario 4: Low Engagement ---');
  console.log('All notifications/broadcasts - no interaction\n');

  const session4 = 'broadcast-session';
  for (let i = 0; i < 5; i++) {
    const lce = {
      v: 1,
      intent: { type: 'notify' },
      meaning: { topic: 'status' },
      policy: { consent: 'private' },
    };
    await lss.store(session4, lce, `Status update ${i + 1}`);
    await sleep(100);
  }

  const broadcast = await lss.getSession(session4);
  printAwareness('Result: Lower Engagement (no dialogue) ~', broadcast.awareness);

  await sleep(1000);

  // Scenario 5: Recovery - returning to focus
  console.log('\n\n--- Scenario 5: Recovery ---');
  console.log('After distraction, returning to mindful conversation\n');

  const session5 = 'recovery-session';

  // First: scattered (low awareness)
  for (const topic of ['a', 'b', 'c']) {
    const lce = {
      v: 1,
      intent: { type: 'tell' },
      meaning: { topic },
      policy: { consent: 'private' },
    };
    await lss.store(session5, lce, `Scattered: ${topic}`);
  }

  console.log('After distraction:');
  let recovery = await lss.getSession(session5);
  console.log(`  Distraction: ${recovery.awareness.distraction.toFixed(3)}`);
  console.log(`  Overall: ${recovery.awareness.overall.toFixed(3)}`);

  // Then: return to focus (awareness improves)
  console.log('\nReturning to focus...');
  for (let i = 0; i < 5; i++) {
    const lce = {
      v: 1,
      intent: { type: i % 2 === 0 ? 'ask' : 'tell' },
      meaning: { topic: 'mindfulness' },
      affect: { pad: [0.7, 0.6, 0.5], tags: ['present'] },
      policy: { consent: 'private' },
    };
    await lss.store(session5, lce, `Back to mindfulness`);
    await sleep(200);
  }

  recovery = await lss.getSession(session5);
  console.log('\nAfter recovery:');
  console.log(`  Distraction: ${recovery.awareness.distraction.toFixed(3)} (decreased)`);
  console.log(`  Overall: ${recovery.awareness.overall.toFixed(3)} (improved)`);
  printAwareness('\nFinal State: Awareness Restored ✓', recovery.awareness);

  // Summary
  console.log('\n\n=== Summary ===\n');

  const stats = lss.getStats();
  console.log(`Total sessions: ${stats.sessionCount}`);
  console.log(`Average coherence: ${stats.averageCoherence.toFixed(3)}`);
  console.log(`Average awareness:`);
  console.log(`  Presence:    ${stats.averageAwareness.presence.toFixed(3)}`);
  console.log(`  Clarity:     ${stats.averageAwareness.clarity.toFixed(3)}`);
  console.log(`  Distraction: ${stats.averageAwareness.distraction.toFixed(3)}`);
  console.log(`  Engagement:  ${stats.averageAwareness.engagement.toFixed(3)}`);
  console.log(`  Overall:     ${stats.averageAwareness.overall.toFixed(3)}`);

  console.log('\n✓ Awareness Layer tracks mindful presence in conversation');
  console.log('✓ Can detect drift, distraction, and recovery');
  console.log('✓ Complements coherence with presence-based metrics\n');

  // Cleanup
  lss.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
