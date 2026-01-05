# LSS (Liminal Session Store) - Coherence Tracking Example

> Demonstrates conversation coherence calculation and semantic drift detection using LSS

This example shows how to use the **Liminal Session Store (LSS)** to track conversation quality, calculate coherence scores, and detect semantic drift in real-time.

## What is LSS?

**LSS (Liminal Session Store)** is a context memory system that:

- 📊 **Tracks conversation threads** - Store LCE messages per session
- 🎯 **Calculates coherence** - Measure semantic alignment (0-1 scale)
- 🔍 **Detects drift** - Identify when conversations lose focus
- 📈 **Provides analytics** - Intent similarity, affect stability, topic consistency

### Coherence Formula

```
coherence = 0.4 × intent_similarity + 0.3 × affect_stability + 0.3 × semantic_alignment
```

Where:
- **Intent similarity (40%)**: How well intents flow (ask→tell good, ask→plan poor)
- **Affect stability (30%)**: Emotional consistency (PAD vector variance)
- **Semantic alignment (30%)**: Topic consistency (same vs different topics)

## Quick Start

### Installation

```bash
cd examples/lss-coherence
npm install
```

### Run the example

```bash
node example.js
```

## Example Output

```
=== LSS (Liminal Session Store) Example ===

1. High Coherence Conversation (Weather Discussion)
   - Same topic: weather
   - Natural ask/tell pattern
   - Stable emotional tone

   Coherence: 0.892
   ├─ Intent similarity: 0.950
   ├─ Affect stability: 0.856
   └─ Semantic alignment: 0.870

2. Low Coherence Conversation (Topic Jumping)
   - Different topics: weather → food → work
   - Erratic intent types
   - Varying emotional tone

   Coherence: 0.234
   ├─ Intent similarity: 0.125
   ├─ Affect stability: 0.312
   └─ Semantic alignment: 0.267
```

## Features Demonstrated

### 1. Basic Session Storage

```javascript
const { lss } = require('node-lri');

// Create LSS instance
const store = new lss.LSS();

// Store messages
const lce = {
  v: 1,
  intent: { type: 'ask', goal: 'Get weather info' },
  affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
  meaning: { topic: 'weather' },
  policy: { consent: 'private' }
};

await store.store('thread-id', lce);
```

### 2. Retrieve Session with Coherence

```javascript
// Get session
const session = await store.getSession('thread-id');

console.log('Coherence:', session.coherence);
console.log('Message count:', session.messages.length);
console.log('First message:', session.messages[0].lce);
```

### 3. Calculate Coherence Breakdown

```javascript
const breakdown = store.calculateCoherence(session.messages);

console.log('Intent similarity:', breakdown.intentSimilarity);
console.log('Affect stability:', breakdown.affectStability);
console.log('Semantic alignment:', breakdown.semanticAlignment);
console.log('Overall coherence:', breakdown.coherence);
```

### 4. Multi-Session Management

```javascript
// Multiple threads
await store.store('thread-1', lce1);
await store.store('thread-2', lce2);
await store.store('thread-3', lce3);

// Get statistics
const stats = store.getStats();

console.log('Total sessions:', stats.sessionCount);
console.log('Total messages:', stats.totalMessages);
console.log('Average coherence:', stats.averageCoherence);
```

### 5. Real-time Coherence Tracking

```javascript
const threadId = 'conversation-123';

// Add messages one by one
for (const lce of messages) {
  await store.store(threadId, lce);

  const session = await store.getSession(threadId);
  console.log(`Coherence: ${session.coherence.toFixed(3)}`);

  // Alert if coherence drops
  if (session.coherence < 0.5) {
    console.warn('⚠️ Low coherence detected - conversation drifting!');
  }
}
```

## Understanding Coherence Scores

### Intent Similarity

Measures how well intent types flow together:

| Intent Pair | Similarity | Reason |
|-------------|------------|--------|
| ask → tell | 0.950 | Natural Q&A flow |
| ask → ask | 1.000 | Same intent |
| ask → plan | 0.125 | Poor flow |
| propose → confirm | 0.850 | Complementary pair |

### Affect Stability

Measures emotional consistency using PAD vectors:

```javascript
// Stable affect (high score)
const stable = [
  { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
  { pad: [0.3, 0.2, 0.1], tags: ['interested'] },
  { pad: [0.3, 0.2, 0.1], tags: ['engaged'] }
];
// → Stability: 0.95

// Volatile affect (low score)
const volatile = [
  { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
  { pad: [0.8, 0.9, 0.5], tags: ['excited'] },
  { pad: [-0.5, 0.1, 0.9], tags: ['stressed'] }
];
// → Stability: 0.25
```

### Semantic Alignment

Measures topic consistency:

```javascript
// Aligned (high score)
const aligned = [
  { meaning: { topic: 'weather' } },
  { meaning: { topic: 'weather' } },
  { meaning: { topic: 'weather' } }
];
// → Alignment: 1.0

// Diverged (low score)
const diverged = [
  { meaning: { topic: 'weather' } },
  { meaning: { topic: 'food' } },
  { meaning: { topic: 'work' } }
];
// → Alignment: 0.33
```

## Coherence Interpretation

| Score | Rating | Interpretation | Action |
|-------|--------|----------------|--------|
| 0.9 - 1.0 | Excellent | Highly focused conversation | Continue naturally |
| 0.7 - 0.9 | Good | Coherent with minor variations | Monitor |
| 0.5 - 0.7 | Fair | Some drift detected | Consider refocusing |
| 0.3 - 0.5 | Poor | Significant drift | Prompt user to clarify |
| 0.0 - 0.3 | Very Poor | Incoherent conversation | Reset context |

## Use Cases

### 1. AI Chat Quality Control

```javascript
async function chatEndpoint(req, res) {
  const lce = req.lri.lce;
  const threadId = lce.memory.thread;

  // Store message
  await store.store(threadId, lce);

  // Check coherence
  const session = await store.getSession(threadId);

  if (session.coherence < 0.5) {
    // Ask clarifying question
    return res.json({
      message: "I want to make sure I understand. Let me clarify...",
      intent: { type: 'sync' }
    });
  }

  // Normal response
  return res.json({ message: "Understood!", data: [...] });
}
```

### 2. Multi-Agent Routing

```javascript
function routeToAgent(session) {
  if (session.coherence > 0.8) {
    return 'specialist-agent';  // High coherence - stay with specialist
  } else if (session.coherence < 0.5) {
    return 'clarification-agent';  // Low coherence - need clarification
  } else {
    return 'general-agent';  // Medium coherence - general handling
  }
}
```

### 3. Conversation Analytics

```javascript
// Analyze conversation quality
async function analyzeConversation(threadId) {
  const session = await store.getSession(threadId);
  const breakdown = store.calculateCoherence(session.messages);

  return {
    overallQuality: session.coherence,
    intentFlow: breakdown.intentSimilarity,
    emotionalConsistency: breakdown.affectStability,
    topicFocus: breakdown.semanticAlignment,
    messageCount: session.messages.length,
    avgMessagesPerMinute: calculateRate(session),
    driftPoints: findDriftPoints(session)
  };
}
```

### 4. Intervention Triggers

```javascript
const COHERENCE_THRESHOLD = 0.5;
const CHECK_INTERVAL = 5;  // Check every 5 messages

let messageCount = 0;

async function onMessage(threadId, lce) {
  await store.store(threadId, lce);
  messageCount++;

  if (messageCount % CHECK_INTERVAL === 0) {
    const session = await store.getSession(threadId);

    if (session.coherence < COHERENCE_THRESHOLD) {
      // Trigger intervention
      await sendInterventionMessage(threadId, {
        type: 'sync',
        message: 'I notice we may have drifted off topic. Would you like to refocus?'
      });
    }
  }
}
```

## Configuration

### LSS Options

```javascript
const store = new lss.LSS({
  maxMessages: 50,           // Max messages per session
  coherenceWindow: 10,       // Window for coherence calculation
  autoCleanup: true,         // Auto-cleanup old sessions
  cleanupInterval: 3600000,  // Cleanup every hour
  maxAge: 86400000           // Delete sessions older than 24h
});
```

### Coherence Weights

Customize the coherence formula:

```javascript
// Default weights
const weights = {
  intent: 0.4,     // 40%
  affect: 0.3,     // 30%
  semantic: 0.3    // 30%
};

// Calculate with custom weights
const coherence =
  weights.intent * intentSimilarity +
  weights.affect * affectStability +
  weights.semantic * semanticAlignment;
```

## API Reference

### `LSS` Class

#### Constructor
```javascript
const store = new lss.LSS(options?)
```

#### Methods

**`store(threadId, lce)`**
- Store LCE message in session
- Returns: `Promise<void>`

**`getSession(threadId)`**
- Retrieve session with coherence
- Returns: `Promise<Session>`

**`calculateCoherence(messages)`**
- Calculate coherence breakdown
- Returns: `CoherenceBreakdown`

**`getStats()`**
- Get aggregate statistics
- Returns: `{ sessionCount, totalMessages, averageCoherence }`

**`deleteSession(threadId)`**
- Delete specific session
- Returns: `void`

**`destroy()`**
- Cleanup all sessions
- Returns: `void`

### Types

```typescript
interface Session {
  threadId: string;
  messages: StoredMessage[];
  coherence: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredMessage {
  lce: LCE;
  timestamp: Date;
}

interface CoherenceBreakdown {
  coherence: number;
  intentSimilarity: number;
  affectStability: number;
  semanticAlignment: number;
}
```

## Performance Considerations

### Memory Usage

Each session stores full LCE messages. For high-volume applications:

```javascript
// Limit messages per session
const store = new lss.LSS({ maxMessages: 20 });

// Periodic cleanup
setInterval(() => {
  store.cleanup();  // Remove old sessions
}, 3600000);  // Every hour
```

### Coherence Calculation

- Calculated on-demand (not stored)
- O(n) complexity for n messages
- Use `coherenceWindow` to limit calculation range

```javascript
// Calculate only last 10 messages
const recent = session.messages.slice(-10);
const coherence = store.calculateCoherence(recent);
```

## Integration with WebSocket

See [ws-echo example](../ws-echo/) for WebSocket + LSS integration:

```javascript
const { LRIWSServer } = require('node-lri/ws');
const { lss } = require('node-lri');

const server = new LRIWSServer({ port: 8080 });
const store = new lss.LSS();

server.on('message', async (ws, lce, payload) => {
  const threadId = lce.memory.thread;

  // Store message
  await store.store(threadId, lce);

  // Check coherence
  const session = await store.getSession(threadId);

  // Send coherence in response
  server.send(ws, {
    ...lce,
    qos: { coherence: session.coherence }
  }, payload);
});
```

## Testing

Run the example and observe:

1. **High coherence** (~0.9): Focused conversation about weather
2. **Low coherence** (~0.2): Topic jumping (weather→food→work)
3. **Intent relationships**: ask→tell flows well
4. **Real-time tracking**: Watch coherence evolve
5. **Multi-session**: Manage multiple conversations

## Troubleshooting

**Q: Coherence always high?**
A: Check that messages have `meaning.topic` and `affect.pad` fields

**Q: Intent similarity always 1.0?**
A: Ensure messages have different `intent.type` values

**Q: Memory leak?**
A: Enable auto-cleanup or call `store.destroy()` when done

## Next Steps

- **WebSocket + LSS:** [ws-echo example](../ws-echo/)
- **Cryptographic Signatures:** [ltp-signing example](../ltp-signing/)
- **Express Integration:** [express-app example](../express-app/)
- **Python/FastAPI:** [fastapi-app example](../fastapi-app/)

## Resources

- [LRI Documentation](../../docs/getting-started.md)
- [Node SDK API](../../packages/node-lri/)
- [RFC-000: LSS Section](../../docs/rfcs/rfc-000.md#103-lss-liminal-session-store)
- [LCE Schema](../../schemas/lce-v0.1.json)

## License

MIT - See [LICENSE](../../LICENSE)
