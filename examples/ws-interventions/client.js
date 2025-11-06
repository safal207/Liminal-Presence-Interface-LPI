/**
 * WebSocket Client - Test Automatic Interventions
 *
 * Scenarios:
 * 1. Coherent conversation (no intervention)
 * 2. Topic drift → REFOCUS intervention
 * 3. Intent chaos → CLARIFY intervention
 * 4. Return to coherence
 */

const { ws } = require('node-lri');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== LRI Client - Testing Auto-Interventions ===\n');

  const client = new ws.LRIWSClient({
    url: 'ws://localhost:9002',
    clientId: 'intervention-test-client',
    features: ['lss'],
  });

  await new Promise((resolve, reject) => {
    client.onConnect = resolve;
    client.onError = reject;
    client.connect();
  });

  console.log('✓ Connected to server\n');

  let interventionCount = 0;

  client.onMessage = (lce, payload) => {
    const message = payload.toString('utf-8');
    const isIntervention = lce.meaning?.tags?.includes('intervention');

    if (isIntervention) {
      interventionCount++;
      console.log(`\n🚨 SERVER INTERVENTION #${interventionCount}`);
      console.log(`   Strategy: ${lce.meaning?.tags?.[1] || 'unknown'}`);
      console.log(`   Message: ${message}\n`);
    } else {
      console.log(`   Server: ${message}`);
    }
  };

  // ===  Scenario 1: Coherent Conversation (No Intervention) ===
  console.log('=== Scenario 1: Coherent Conversation ===');
  console.log('Topic: Programming - Should stay coherent\n');

  const coherentMessages = [
    { text: 'What is TypeScript?', topic: 'programming', intent: 'ask' },
    { text: 'How do I use interfaces?', topic: 'programming', intent: 'ask' },
    { text: 'Can you explain generics?', topic: 'programming', intent: 'ask' },
  ];

  for (const msg of coherentMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: msg.intent },
      affect: { pad: [0.6, 0.5, 0.5], tags: ['curious'] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);
    await sleep(1500);
  }

  await sleep(2000);

  // === Scenario 2: Topic Drift → REFOCUS ===
  console.log('\n=== Scenario 2: Topic Drift (Expect REFOCUS) ===');
  console.log('Jump between topics rapidly\n');

  const driftMessages = [
    { text: 'What about Python?', topic: 'programming', intent: 'ask' },
    { text: 'I need to buy groceries', topic: 'shopping', intent: 'plan' },
    { text: 'What is the weather?', topic: 'weather', intent: 'ask' },
    { text: 'Tell me about history', topic: 'history', intent: 'ask' },
  ];

  for (const msg of driftMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: msg.intent },
      affect: { pad: [Math.random(), Math.random(), Math.random()], tags: [] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);
    await sleep(1500);
  }

  await sleep(12000); // Wait for cooldown

  // === Scenario 3: Intent Chaos → CLARIFY ===
  console.log('\n=== Scenario 3: Intent Chaos (Expect CLARIFY) ===');
  console.log('Same topic but erratic intents\n');

  const chaosMessages = [
    { text: 'Tell me about AI', topic: 'ai', intent: 'ask' },
    { text: 'Plan AI project', topic: 'ai', intent: 'plan' },
    { text: 'Notify about AI', topic: 'ai', intent: 'notify' },
    { text: 'Sync AI status', topic: 'ai', intent: 'sync' },
  ];

  for (const msg of chaosMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: msg.intent },
      affect: { pad: [0.8, 0.2, 0.9], tags: ['confused'] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);
    await sleep(1500);
  }

  await sleep(12000); // Wait for cooldown

  // === Scenario 4: Return to Coherence ===
  console.log('\n=== Scenario 4: Return to Coherence ===');
  console.log('Back to focused conversation\n');

  const recoveryMessages = [
    { text: 'Back to programming', topic: 'programming', intent: 'ask' },
    { text: 'What is React?', topic: 'programming', intent: 'ask' },
    { text: 'How do hooks work?', topic: 'programming', intent: 'ask' },
  ];

  for (const msg of recoveryMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: msg.intent },
      affect: { pad: [0.6, 0.5, 0.5], tags: ['focused'] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);
    await sleep(1500);
  }

  await sleep(2000);

  console.log('\n=== Summary ===');
  console.log(`Total interventions: ${interventionCount}`);
  console.log('Expected: 2-3 interventions (refocus, clarify)');
  console.log('\n✓ Interventions prevent conversation drift automatically!');

  await client.disconnect();
  console.log('\n✓ Disconnected');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
