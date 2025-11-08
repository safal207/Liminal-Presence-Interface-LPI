/**
 * Terma System Demo
 *
 * Demonstrates hiding and revealing insights at the right moment
 * Inspired by Padmasambhava's terma tradition
 */

const { lss } = require('../../packages/node-lri/dist/lss');

const threadId = 'terma-demo-thread';

// Helper to create LCE
function createLCE(intent, topic) {
  return {
    v: 1,
    intent: { type: intent },
    meaning: topic ? { topic } : undefined,
    policy: { consent: 'private' },
  };
}

// Helper to print section
function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

// Helper to print terma
function printTerma(terma) {
  console.log('\n📿 Terma revealed:');
  console.log(`   Type: ${terma.type}`);
  console.log(`   Priority: ${terma.priority}`);
  console.log(`   Content: "${terma.content}"`);
  console.log(`   Hidden at: ${terma.hiddenAt.toISOString()}`);
  console.log(`   Revealed at: ${terma.revealedAt.toISOString()}`);
  console.log(`   Hidden context:`, {
    topic: terma.hiddenContext.topic,
    intent: terma.hiddenContext.intent,
    coherence: terma.hiddenContext.coherence.toFixed(2),
  });
}

async function demo() {
  printSection('Terma System Demo - Hidden Insights for the Right Moment');

  // Scenario 1: Topic-based revelation
  printSection('Scenario 1: Topic-Based Revelation');
  console.log('Discussion starts about React...');

  await lss.store(
    threadId,
    createLCE('ask', 'react basics'),
    'What is React?'
  );

  await lss.store(
    threadId,
    createLCE('tell', 'react basics'),
    'React is a JavaScript library for building UIs'
  );

  // Hide insight about React performance
  console.log('\n🔒 Hiding terma about React performance (requires topicMatch: 0.3)');
  await lss.hideTerma(
    threadId,
    'React uses virtual DOM to optimize rendering performance',
    'insight',
    { topicMatch: 0.3 },
    7
  );

  console.log('\nSwitching to Python topic...');
  await lss.store(
    threadId,
    createLCE('ask', 'python django'),
    'What about Django?'
  );

  let revealed = await lss.revealTermas(threadId);
  console.log(`\n❌ Termas revealed: ${revealed.length} (topic doesn't match)`);

  console.log('\nReturning to React topic...');
  await lss.store(
    threadId,
    createLCE('ask', 'react performance'),
    'How to optimize React?'
  );

  revealed = await lss.revealTermas(threadId);
  console.log(`\n✅ Termas revealed: ${revealed.length} (topic matches!)`);
  if (revealed.length > 0) {
    printTerma(revealed[0]);
  }

  // Scenario 2: Intent-based revelation
  const threadId2 = 'terma-demo-thread-2';
  printSection('Scenario 2: Intent-Based Revelation');
  console.log('User asks questions...');

  await lss.store(threadId2, createLCE('ask', 'databases'), 'What is SQL?');
  await lss.store(
    threadId2,
    createLCE('tell', 'databases'),
    'SQL is a query language'
  );

  console.log('\n🔒 Hiding warning (requires intent: tell or propose)');
  await lss.hideTerma(
    threadId2,
    'Warning: Always validate user input before SQL queries to prevent injection',
    'warning',
    { intentMatch: ['tell', 'propose'] },
    9
  );

  console.log('\nUser continues asking...');
  await lss.store(threadId2, createLCE('ask', 'sql queries'), 'How to write queries?');
  revealed = await lss.revealTermas(threadId2);
  console.log(`\n❌ Termas revealed: ${revealed.length} (intent is 'ask', not 'tell')`);

  console.log('\nUser starts explaining their approach...');
  await lss.store(
    threadId2,
    createLCE('tell', 'sql implementation'),
    'I will build queries from user input'
  );

  revealed = await lss.revealTermas(threadId2);
  console.log(`\n✅ Termas revealed: ${revealed.length} (intent is 'tell'!)`);
  if (revealed.length > 0) {
    printTerma(revealed[0]);
  }

  // Scenario 3: Time-delayed revelation
  const threadId3 = 'terma-demo-thread-3';
  printSection('Scenario 3: Time-Delayed Revelation');
  console.log('Starting conversation...');

  await lss.store(threadId3, createLCE('ask', 'learning'), 'How to learn coding?');

  console.log('\n🔒 Hiding pattern (requires 2 second delay)');
  await lss.hideTerma(
    threadId3,
    'Pattern: Learning happens through consistent practice over time',
    'pattern',
    { timeDelay: 2000 },
    5
  );

  console.log('\nImmediate check...');
  revealed = await lss.revealTermas(threadId3);
  console.log(`❌ Termas revealed: ${revealed.length} (too soon)`);

  console.log('\nWaiting 2 seconds...');
  await new Promise((resolve) => setTimeout(resolve, 2100));

  revealed = await lss.revealTermas(threadId3);
  console.log(`✅ Termas revealed: ${revealed.length} (time has passed!)`);
  if (revealed.length > 0) {
    printTerma(revealed[0]);
  }

  // Scenario 4: Priority-based ordering
  const threadId4 = 'terma-demo-thread-4';
  printSection('Scenario 4: Priority-Based Ordering');
  console.log('Hiding multiple termas with different priorities...');

  await lss.store(threadId4, createLCE('ask', 'architecture'), 'System design?');

  await lss.hideTerma(
    threadId4,
    'Low priority: Document your code',
    'insight',
    {},
    3
  );

  await lss.hideTerma(
    threadId4,
    'Medium priority: Use design patterns',
    'pattern',
    {},
    6
  );

  await lss.hideTerma(
    threadId4,
    'High priority: Security must be considered from the start',
    'warning',
    {},
    10
  );

  console.log('\nRevealing all termas...');
  await lss.store(threadId4, createLCE('tell', 'architecture'), 'Building system');
  revealed = await lss.revealTermas(threadId4);

  console.log(`\n✅ ${revealed.length} termas revealed in priority order:`);
  revealed.forEach((terma, i) => {
    console.log(`\n${i + 1}. [Priority ${terma.priority}] ${terma.type.toUpperCase()}`);
    console.log(`   "${terma.content}"`);
  });

  // Scenario 5: Combined conditions
  const threadId5 = 'terma-demo-thread-5';
  printSection('Scenario 5: Combined Conditions (Topic + Intent + Coherence)');
  console.log('Starting coherent conversation about AI...');

  await lss.store(threadId5, createLCE('ask', 'artificial intelligence'), 'What is AI?');
  await lss.store(
    threadId5,
    createLCE('tell', 'artificial intelligence'),
    'AI simulates human intelligence'
  );

  console.log('\n🔒 Hiding breakthrough (requires: topic match + tell intent + coherence > 0.6)');
  await lss.hideTerma(
    threadId5,
    'Breakthrough: AI alignment becomes critical as capabilities increase',
    'breakthrough',
    {
      topicMatch: 0.25,
      intentMatch: ['tell', 'propose'],
      coherenceThreshold: 0.6,
    },
    8
  );

  console.log('\nTrying with wrong intent...');
  await lss.store(
    threadId5,
    createLCE('ask', 'ai safety'),
    'Is AI safe?'
  );
  revealed = await lss.revealTermas(threadId5);
  console.log(`❌ Termas revealed: ${revealed.length} (wrong intent)`);

  console.log('\nTrying with correct topic and intent...');
  await lss.store(
    threadId5,
    createLCE('tell', 'ai alignment'),
    'AI must be aligned with human values'
  );

  revealed = await lss.revealTermas(threadId5);
  console.log(`✅ Termas revealed: ${revealed.length} (all conditions met!)`);
  if (revealed.length > 0) {
    printTerma(revealed[0]);
  }

  // Summary
  printSection('Summary: Terma System Statistics');
  const stats = lss.getStats();
  console.log(`Total sessions: ${stats.sessionCount}`);
  console.log(`Total messages: ${stats.totalMessages}`);
  console.log(`Average coherence: ${stats.averageCoherence.toFixed(2)}`);

  // Count total termas across all sessions
  let totalTermas = 0;
  let revealedTermas = 0;
  for (const session of await lss.getAllSessions()) {
    const termas = await lss.getTermas(session.threadId);
    totalTermas += termas.length;
    revealedTermas += termas.filter((t) => t.revealed).length;
  }

  console.log(`\nTotal termas hidden: ${totalTermas}`);
  console.log(`Total termas revealed: ${revealedTermas}`);
  console.log(`Still hidden: ${totalTermas - revealedTermas}`);

  console.log('\n' + '='.repeat(70));
  console.log('Demo complete! 🎉');
  console.log('Terma system successfully hides insights until conditions are right.');
  console.log('='.repeat(70) + '\n');
}

demo().catch(console.error);
