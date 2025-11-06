/**
 * WebSocket Client - LSS Coherence Testing
 *
 * Demonstrates:
 * - High coherence conversation (same topic)
 * - Low coherence conversation (topic jumping)
 * - Server automatically tracks coherence
 */

const { ws } = require('node-lri');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== LRI WebSocket Client - LSS Testing ===\n');

  const client = new ws.LRIWSClient({
    url: 'ws://localhost:9001',
    clientId: 'test-client',
    features: ['lss'],
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    client.onConnect = resolve;
    client.onError = reject;
    client.connect();
  });

  console.log('✓ Connected to server\n');

  // Message handler
  client.onMessage = (lce, payload) => {
    const message = payload.toString('utf-8');
    console.log('Server response:', message);
    console.log('');
  };

  // Scenario 1: High coherence conversation
  console.log('=== Scenario 1: High Coherence (Weather Topic) ===\n');

  const weatherMessages = [
    { text: 'What is the weather today?', topic: 'weather' },
    { text: 'Will it rain tomorrow?', topic: 'weather' },
    { text: 'Should I bring an umbrella?', topic: 'weather' },
  ];

  for (const msg of weatherMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: 'ask', goal: 'get weather info' },
      affect: { pad: [0.5, 0.5, 0.5], tags: ['curious'] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);

    await sleep(1000);
  }

  await sleep(2000);

  // Scenario 2: Low coherence conversation
  console.log('\n=== Scenario 2: Low Coherence (Topic Jumping) ===\n');

  const jumpingMessages = [
    { text: 'What is the weather?', topic: 'weather', intent: 'ask' },
    { text: 'I need to plan my schedule', topic: 'planning', intent: 'plan' },
    { text: 'What is for dinner?', topic: 'food', intent: 'ask' },
    { text: 'Update the project status', topic: 'work', intent: 'sync' },
  ];

  for (const msg of jumpingMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: msg.intent, goal: msg.text },
      affect: { pad: [Math.random(), Math.random(), Math.random()], tags: [] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);

    await sleep(1000);
  }

  await sleep(2000);

  // Scenario 3: Recovery to coherence
  console.log('\n=== Scenario 3: Coherence Recovery ===\n');

  const recoveryMessages = [
    { text: 'Let's focus on the project', topic: 'work' },
    { text: 'What are the next steps?', topic: 'work' },
    { text: 'How can we improve?', topic: 'work' },
  ];

  for (const msg of recoveryMessages) {
    console.log(`Sending: "${msg.text}"`);
    await client.send({
      v: 1,
      intent: { type: 'ask', goal: 'project discussion' },
      affect: { pad: [0.6, 0.5, 0.5], tags: ['focused'] },
      meaning: { topic: msg.topic },
      policy: { consent: 'private' },
    }, msg.text);

    await sleep(1000);
  }

  await sleep(2000);

  console.log('\n=== Summary ===');
  console.log('✓ High coherence: focused on one topic (weather)');
  console.log('✓ Low coherence: jumping between topics');
  console.log('✓ Recovery: returning to focused conversation');
  console.log('\nServer automatically tracked coherence using LSS');

  // Disconnect
  await client.disconnect();
  console.log('\n✓ Disconnected');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
