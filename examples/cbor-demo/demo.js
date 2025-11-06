/**
 * CBOR vs JSON Size Comparison Demo
 *
 * Shows bandwidth savings using CBOR encoding for LRI messages
 */

const { cbor } = require('node-lri');

// Helper to format bytes
function formatBytes(bytes) {
  return `${bytes} bytes`;
}

// Helper to format savings
function formatSavings(json, cbor) {
  const savings = json - cbor;
  const percent = ((savings / json) * 100).toFixed(1);
  return `${savings} bytes (${percent}%)`;
}

console.log('=== CBOR vs JSON Size Comparison ===\n');

// === Example 1: Minimal LCE ===
console.log('1. Minimal LCE');
const minimal = {
  v: 1,
  intent: { type: 'tell' },
  policy: { consent: 'private' },
};

const minimalJson = Buffer.from(JSON.stringify(minimal));
const minimalCbor = cbor.encodeLCE(minimal);

console.log(`   JSON:  ${formatBytes(minimalJson.length)}`);
console.log(`   CBOR:  ${formatBytes(minimalCbor.length)}`);
console.log(`   Saved: ${formatSavings(minimalJson.length, minimalCbor.length)}`);
console.log('');

// === Example 2: Full LCE ===
console.log('2. Full LCE with all fields');
const full = {
  v: 1,
  intent: { type: 'ask', goal: 'Get weather information for planning' },
  affect: { pad: [0.6, 0.5, 0.4], tags: ['curious', 'planning'] },
  meaning: { topic: 'weather forecast', ontology: 'meteorology' },
  memory: { thread: 'conv-12345', ttl: '3600' },
  policy: { consent: 'private', share: ['team:weather'] },
};

const fullComp = cbor.compareSizes(full);
console.log(`   JSON:  ${formatBytes(fullComp.jsonSize)}`);
console.log(`   CBOR:  ${formatBytes(fullComp.cborSize)}`);
console.log(`   Saved: ${formatSavings(fullComp.jsonSize, fullComp.cborSize)}`);
console.log('');

// === Example 3: IoT Scenario ===
console.log('3. IoT Device (100 messages/min)');
const iot = {
  v: 1,
  intent: { type: 'sync' },
  affect: { pad: [0, 0, 0] },
  meaning: { topic: 'sensor', ontology: 'temperature' },
  policy: { consent: 'private' },
};

const iotComp = cbor.compareSizes(iot);
const messagesPerMin = 100;
const jsonPerMin = iotComp.jsonSize * messagesPerMin;
const cborPerMin = iotComp.cborSize * messagesPerMin;
const savedPerMin = jsonPerMin - cborPerMin;

console.log(`   Per message:`);
console.log(`     JSON:  ${formatBytes(iotComp.jsonSize)}`);
console.log(`     CBOR:  ${formatBytes(iotComp.cborSize)}`);
console.log(`   Per minute (100 msgs):`);
console.log(`     JSON:  ${formatBytes(jsonPerMin)}`);
console.log(`     CBOR:  ${formatBytes(cborPerMin)}`);
console.log(`     Saved: ${formatSavings(jsonPerMin, cborPerMin)}`);

const savedPerHour = savedPerMin * 60;
const savedPerDay = savedPerHour * 24;
console.log(`   Per hour:`);
console.log(`     Saved: ${(savedPerHour / 1024).toFixed(1)} KB`);
console.log(`   Per day:`);
console.log(`     Saved: ${(savedPerDay / 1024).toFixed(1)} KB`);
console.log('');

// === Example 4: High-Volume Chat ===
console.log('4. Chat Service (1000 users, 10 msg/min each)');
const chat = {
  v: 1,
  intent: { type: 'tell', goal: 'send message' },
  affect: { pad: [0.7, 0.6, 0.5], tags: ['friendly'] },
  meaning: { topic: 'conversation' },
  memory: { thread: 'chat-room-general' },
  policy: { consent: 'public' },
};

const chatComp = cbor.compareSizes(chat);
const users = 1000;
const msgsPerUserPerMin = 10;
const totalMsgsPerMin = users * msgsPerUserPerMin;

const chatJsonPerMin = chatComp.jsonSize * totalMsgsPerMin;
const chatCborPerMin = chatComp.cborSize * totalMsgsPerMin;
const chatSavedPerMin = chatJsonPerMin - chatCborPerMin;

console.log(`   Per message:`);
console.log(`     JSON:  ${formatBytes(chatComp.jsonSize)}`);
console.log(`     CBOR:  ${formatBytes(chatComp.cborSize)}`);
console.log(`   Per minute (10,000 msgs):`);
console.log(`     JSON:  ${(chatJsonPerMin / 1024).toFixed(1)} KB`);
console.log(`     CBOR:  ${(chatCborPerMin / 1024).toFixed(1)} KB`);
console.log(`     Saved: ${(chatSavedPerMin / 1024).toFixed(1)} KB`);

const chatSavedPerDay = chatSavedPerMin * 60 * 24;
console.log(`   Per day:`);
console.log(`     Saved: ${(chatSavedPerDay / 1024 / 1024).toFixed(2)} MB`);
console.log('');

// === Example 5: Frame with Payload ===
console.log('5. Message with Payload');
const frameLce = {
  v: 1,
  intent: { type: 'tell' },
  meaning: { topic: 'data transfer' },
  policy: { consent: 'private' },
};
const payload = 'This is a typical message payload that contains some text data';

const jsonFrame = JSON.stringify({ lce: frameLce, payload });
const jsonFrameSize = Buffer.from(jsonFrame).length;
const cborFrame = cbor.encodeFrame(frameLce, payload);

console.log(`   JSON frame:  ${formatBytes(jsonFrameSize)}`);
console.log(`   CBOR frame:  ${formatBytes(cborFrame.length)}`);
console.log(`   Saved:       ${formatSavings(jsonFrameSize, cborFrame.length)}`);
console.log('');

// === Summary ===
console.log('=== Summary ===');
console.log('');
console.log('Benefits of CBOR:');
console.log('  ✓ 5-35% smaller than JSON (depending on structure)');
console.log('  ✓ Binary format - faster parsing');
console.log('  ✓ Perfect for IoT devices with limited bandwidth');
console.log('  ✓ Significant savings at scale (MBs per day)');
console.log('');
console.log('Use cases:');
console.log('  - IoT sensors transmitting frequent updates');
console.log('  - Mobile apps on cellular networks');
console.log('  - High-volume messaging systems');
console.log('  - Embedded devices with limited memory');
console.log('');
console.log('✓ CBOR encoding reduces bandwidth costs!');
