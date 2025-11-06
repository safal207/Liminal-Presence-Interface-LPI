/**
 * Obstacle Detector Demo (antarāya - Buddhist concept of impediments)
 *
 * Demonstrates detection of communication barriers:
 * - Vagueness: unclear/abstract expression
 * - Contradiction: conflicting statements
 * - Semantic Gap: logical jumps
 * - Comprehension Barrier: complexity
 */

const { lss: lssModule } = require('node-lri');

// Create LSS instance
const lss = new lssModule.LSS();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printObstacles(label, obstacles) {
  console.log(`\n${label}`);
  console.log(`  Vagueness:             ${obstacles.vagueness.toFixed(3)} - unclear expression (higher = worse)`);
  console.log(`  Contradiction:         ${obstacles.contradiction.toFixed(3)} - conflicting statements`);
  console.log(`  Semantic Gap:          ${obstacles.semanticGap.toFixed(3)} - logical jumps`);
  console.log(`  Comprehension Barrier: ${obstacles.comprehensionBarrier.toFixed(3)} - complexity`);
  console.log(`  Overall:               ${obstacles.overall.toFixed(3)} - combined obstacles`);
}

async function main() {
  console.log('=== LRI Obstacle Detector Demo ===\n');
  console.log('Inspired by Buddhist concept of antarāya (impediments)\n');

  // Scenario 1: Vague communication
  console.log('--- Scenario 1: Vague Communication ---');
  console.log('Messages with unclear, abstract language\n');

  const session1 = 'vague-session';
  const vagueMessages = [
    'I need to do something with that thing',
    'Maybe we should do some stuff later',
    'Kind of like whatever you think',
    'Perhaps something about things',
  ];

  for (const msg of vagueMessages) {
    const lce = {
      v: 1,
      intent: { type: 'tell' },
      meaning: { topic: 'general' }, // Generic topic adds to vagueness
      policy: { consent: 'private' },
    };
    await lss.store(session1, lce, msg);
    await sleep(100);
  }

  const vague = await lss.getSession(session1);
  printObstacles('Result: High Vagueness Detected ⚠️', vague.obstacles);

  await sleep(1000);

  // Scenario 2: Contradictions
  console.log('\n\n--- Scenario 2: Contradictions ---');
  console.log('Conflicting statements on same topics\n');

  const session2 = 'contradiction-session';
  const contradictoryMessages = [
    { intent: 'propose', topic: 'deployment', text: "Let's deploy to production", pad: [0.7, 0.6, 0.5] },
    { intent: 'disagree', topic: 'deployment', text: "Actually no, let's not deploy", pad: [0.3, 0.7, 0.4] },
    { intent: 'agree', topic: 'testing', text: 'Yes, we should test it', pad: [0.8, 0.5, 0.6] },
    { intent: 'disagree', topic: 'testing', text: "No, don't test it", pad: [-0.5, 0.8, 0.3] },
  ];

  for (const msg of contradictoryMessages) {
    const lce = {
      v: 1,
      intent: { type: msg.intent },
      meaning: { topic: msg.topic },
      affect: { pad: msg.pad, tags: [] },
      policy: { consent: 'private' },
    };
    await lss.store(session2, lce, msg.text);
    await sleep(100);
  }

  const contradictory = await lss.getSession(session2);
  printObstacles('Result: Contradictions Detected ⚠️', contradictory.obstacles);

  await sleep(1000);

  // Scenario 3: Semantic gaps
  console.log('\n\n--- Scenario 3: Semantic Gaps ---');
  console.log('Abrupt topic changes without logical connection\n');

  const session3 = 'gap-session';
  const unrelatedTopics = [
    { topic: 'quantum-physics', text: 'Discussing quantum entanglement' },
    { topic: 'cooking-recipes', text: 'How to make lasagna' },
    { topic: 'car-repair', text: 'Fixing brake pads' },
    { topic: 'poetry-analysis', text: 'Interpreting haiku' },
  ];

  for (const msg of unrelatedTopics) {
    const lce = {
      v: 1,
      intent: { type: 'tell' },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    };
    await lss.store(session3, lce, msg.text);
    await sleep(100);
  }

  const gapped = await lss.getSession(session3);
  printObstacles('Result: Semantic Gaps Detected ⚠️', gapped.obstacles);

  await sleep(1000);

  // Scenario 4: Comprehension barriers
  console.log('\n\n--- Scenario 4: Comprehension Barriers ---');
  console.log('Overly complex or lengthy communication\n');

  const session4 = 'complex-session';

  // Very long message
  const longMessage = 'This is an extremely long message that goes on and on and on. '.repeat(20);

  // Deeply nested structure
  const complexPayload = {
    level1: {
      level2: {
        level3: {
          level4: {
            level5: {
              level6: {
                data: 'buried deep',
              },
            },
          },
        },
      },
    },
  };

  const lce1 = {
    v: 1,
    intent: { type: 'tell' },
    meaning: { topic: 'explanation' },
    policy: { consent: 'private' },
  };
  await lss.store(session4, lce1, longMessage);

  const lce2 = {
    v: 1,
    intent: { type: 'tell' },
    meaning: { topic: 'data' },
    policy: { consent: 'private' },
  };
  await lss.store(session4, lce2, complexPayload);

  const complex = await lss.getSession(session4);
  printObstacles('Result: Comprehension Barriers Detected ⚠️', complex.obstacles);

  await sleep(1000);

  // Scenario 5: Clear communication (no obstacles)
  console.log('\n\n--- Scenario 5: Clear Communication ---');
  console.log('Specific, consistent, well-connected messages\n');

  const session5 = 'clear-session';
  const clearMessages = [
    { topic: 'react development', text: 'We need to refactor the UserService component' },
    { topic: 'react development', text: 'The UserService should use hooks instead of class methods' },
    { topic: 'react development', text: 'After refactoring, we\'ll update the tests' },
  ];

  for (const msg of clearMessages) {
    const lce = {
      v: 1,
      intent: { type: 'tell' },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    };
    await lss.store(session5, lce, msg.text);
    await sleep(200);
  }

  const clear = await lss.getSession(session5);
  printObstacles('Result: Minimal Obstacles ✓', clear.obstacles);

  // Summary
  console.log('\n\n=== Summary ===\n');

  const stats = lss.getStats();
  console.log(`Total sessions: ${stats.sessionCount}`);
  console.log(`Average obstacles:`);
  console.log(`  Vagueness:             ${stats.averageObstacles.vagueness.toFixed(3)}`);
  console.log(`  Contradiction:         ${stats.averageObstacles.contradiction.toFixed(3)}`);
  console.log(`  Semantic Gap:          ${stats.averageObstacles.semanticGap.toFixed(3)}`);
  console.log(`  Comprehension Barrier: ${stats.averageObstacles.comprehensionBarrier.toFixed(3)}`);
  console.log(`  Overall:               ${stats.averageObstacles.overall.toFixed(3)}`);

  console.log('\n✓ Obstacle Detector identifies specific communication barriers');
  console.log('✓ Enables targeted interventions (clarify, refocus, simplify)');
  console.log('✓ Complements awareness and coherence tracking\n');

  // Cleanup
  lss.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
