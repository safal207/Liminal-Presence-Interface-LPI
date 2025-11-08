# Getting Started with LRI

Welcome to the **Liminal Resonance Interface (LRI)**! This guide will help you get up and running with LRI in minutes.

## What is LRI?

LRI is a protocol for **semantic context exchange** between AI systems and applications. It provides:

- 🔌 **WebSocket Communication** - Real-time bidirectional messaging
- 🔐 **Cryptographic Trust** - Ed25519 signatures via LTP (Liminal Trust Protocol)
- 💾 **Session Management** - Coherence tracking via LSS (Liminal Session Store)
- 📦 **Structured Messages** - LCE (Liminal Context Exchange) format

---

## Installation

### Node.js

```bash
npm install node-lri
```

### Python

```bash
pip install python-lri
```

---

## Your First LCE Message

LCE (Liminal Context Exchange) is the core message format in LRI. Every message includes:

- **Intent** - What you're trying to do (`tell`, `ask`, `notify`, etc.)
- **Policy** - Privacy and consent settings
- **Payload** - Your actual data

### Node.js Example

```typescript
import { LCE } from 'node-lri';

// Create an LCE message
const message: LCE = {
  v: 1,  // LCE version
  intent: {
    type: 'tell',
    goal: 'Share information'
  },
  policy: {
    consent: 'private'  // or 'public', 'shared'
  }
};

console.log('My first LCE:', message);
```

### Python Example

```python
from lri import LCE, Intent, Policy

# Create an LCE message
message = LCE(
    v=1,
    intent=Intent(type="tell", goal="Share information"),
    policy=Policy(consent="private")
)

print(f"My first LCE: {message}")
```

---

## WebSocket Server (Node.js)

Let's create a WebSocket server that uses the LHS (Liminal Handshake Sequence) protocol.

```typescript
import { LRIWSServer } from 'node-lri';

// Create server
const server = new LRIWSServer({
  port: 8080,
  ltp: false,  // Cryptographic signing (optional)
  lss: false   // Session storage (optional)
});

// Handle incoming messages
server.onMessage = (sessionId, lce, payload) => {
  console.log(`Message from ${sessionId}:`, lce.intent.type);
  console.log('Payload:', payload.toString('utf-8'));

  // Echo back
  server.send(sessionId, {
    v: 1,
    intent: { type: 'notify', goal: 'Acknowledge' },
    policy: { consent: 'private' }
  }, 'Message received!');
};

// Handle connections
server.onConnect = (sessionId) => {
  console.log(`Client connected: ${sessionId}`);
};

// Handle disconnections
server.onDisconnect = (sessionId) => {
  console.log(`Client disconnected: ${sessionId}`);
};

console.log('LRI WebSocket server running on ws://localhost:8080');
```

### What's Happening?

1. **LHS Handshake** - Automatic hello → mirror → bind → seal sequence
2. **Session Management** - Each client gets a unique session ID
3. **Message Handling** - Receive LCE messages with binary payloads
4. **Bidirectional** - Server can send messages to clients

---

## WebSocket Client (Node.js)

Connect to an LRI WebSocket server:

```typescript
import { LRIWSClient } from 'node-lri';

// Create client
const client = new LRIWSClient({
  url: 'ws://localhost:8080'
});

// Handle connection
client.onOpen = () => {
  console.log('Connected to server!');

  // Send a message
  client.send({
    v: 1,
    intent: { type: 'tell', goal: 'Say hello' },
    policy: { consent: 'private' }
  }, 'Hello from client!');
};

// Handle incoming messages
client.onMessage = (lce, payload) => {
  console.log('Server says:', payload.toString('utf-8'));
  console.log('Intent:', lce.intent.type);
};

// Handle errors
client.onError = (error) => {
  console.error('Connection error:', error);
};

// Connect
client.connect();
```

### Features

- ✅ **Automatic Reconnection** - Reconnects on connection loss
- ✅ **LHS Protocol** - Handles handshake automatically
- ✅ **Type-Safe** - Full TypeScript support

---

## Trust Protocol (LTP)

Add cryptographic signatures to your messages with LTP:

```typescript
import { LTP } from 'node-lri';

// Generate a key pair
const keyPair = await LTP.generateKeyPair();
console.log('Public key:', keyPair.publicKey);

// Create LTP instance
const ltp = new LTP(keyPair.privateKey);

// Sign an LCE message
const lce = {
  v: 1,
  intent: { type: 'tell', goal: 'Trusted message' },
  policy: { consent: 'private' }
};

const signedLce = await ltp.sign(lce);
console.log('Signature:', signedLce.ltp?.signature);

// Verify signature
const isValid = await LTP.verify(signedLce, keyPair.publicKey);
console.log('Valid:', isValid);  // true
```

### Use Cases

- 🔐 **Authentication** - Verify message sender
- 🛡️ **Integrity** - Detect tampering
- 🔗 **Trust Chains** - Build chains of signed messages

### WebSocket with LTP

```typescript
const server = new LRIWSServer({
  port: 8080,
  ltp: true,
  ltpPrivateKey: keyPair.privateKey  // Server signs messages
});

// All outgoing messages are automatically signed
```

---

## Session Store (LSS)

Track conversation coherence and context with LSS:

```typescript
import { LSS } from 'node-lri';

// Create session store
const lss = new LSS();

// Create a session
const sessionId = lss.createSession({
  userId: 'user123',
  metadata: { source: 'web-app' }
});

// Add messages
lss.addMessage(sessionId, {
  v: 1,
  intent: { type: 'ask', goal: 'Get weather' },
  policy: { consent: 'private' }
}, Buffer.from('What is the weather?'));

lss.addMessage(sessionId, {
  v: 1,
  intent: { type: 'tell', goal: 'Provide weather' },
  policy: { consent: 'private' }
}, Buffer.from('It is sunny'));

// Calculate coherence score
const score = lss.calculateCoherence(sessionId);
console.log('Coherence score:', score.overall);  // 0.0 - 1.0

// Get suggestions
if (score.overall < 0.5) {
  const suggestions = lss.suggestInterventions(sessionId);
  console.log('Suggestions:', suggestions);
}
```

### What LSS Tracks

- 📊 **Coherence** - How well the conversation flows
- 🧵 **Threads** - Conversation thread tracking
- 💭 **Context** - Message history and patterns
- ⚠️ **Interventions** - Suggestions when coherence drops

### WebSocket with LSS

```typescript
const server = new LRIWSServer({
  port: 8080,
  lss: true  // Automatic coherence tracking
});

// Check session coherence
server.onMessage = (sessionId, lce, payload) => {
  const session = server.lss?.getSession(sessionId);
  if (session) {
    const coherence = server.lss?.calculateCoherence(sessionId);
    console.log('Coherence:', coherence?.overall);
  }
};
```

---

## Complete Example: Chat Server

Here's a complete example combining everything:

```typescript
import { LRIWSServer, LTP } from 'node-lri';

// Generate server keys
const keyPair = await LTP.generateKeyPair();

// Create server with all features
const server = new LRIWSServer({
  port: 8080,
  ltp: true,
  ltpPrivateKey: keyPair.privateKey,
  lss: true
});

// Handle messages
server.onMessage = (sessionId, lce, payload) => {
  const message = payload.toString('utf-8');
  console.log(`[${sessionId}] ${lce.intent.type}: ${message}`);

  // Check coherence
  const session = server.lss?.getSession(sessionId);
  if (session) {
    const coherence = server.lss?.calculateCoherence(sessionId);

    if (coherence && coherence.overall < 0.5) {
      // Low coherence - suggest intervention
      const suggestions = server.lss?.suggestInterventions(sessionId);
      console.log('⚠️ Low coherence. Suggestions:', suggestions);
    }
  }

  // Echo with acknowledgment
  server.send(sessionId, {
    v: 1,
    intent: { type: 'notify', goal: 'Acknowledge' },
    policy: { consent: 'private' }
  }, `Received: ${message}`);
};

server.onConnect = (sessionId) => {
  console.log(`✅ Client connected: ${sessionId}`);

  // Send welcome message
  server.send(sessionId, {
    v: 1,
    intent: { type: 'notify', goal: 'Welcome' },
    policy: { consent: 'private' }
  }, 'Welcome to LRI Chat!');
};

server.onDisconnect = (sessionId) => {
  console.log(`❌ Client disconnected: ${sessionId}`);
};

console.log('🚀 LRI Chat Server running on ws://localhost:8080');
console.log('📝 Features: WebSocket + LTP + LSS');
```

---

## Express.js Integration

Use LRI with Express for HTTP endpoints:

```typescript
import express from 'express';
import { lriMiddleware, validateLCE } from 'node-lri';

const app = express();

// Add LRI middleware
app.use(lriMiddleware());

// Create endpoint that accepts LCE
app.post('/message', async (req, res) => {
  const lce = req.body;

  // Validate LCE format
  if (!validateLCE(lce)) {
    return res.status(400).json({ error: 'Invalid LCE format' });
  }

  console.log('Received LCE:', lce.intent.type);

  // Process message
  res.json({
    v: 1,
    intent: { type: 'notify', goal: 'Acknowledge' },
    policy: { consent: 'private' },
    message: 'Processed'
  });
});

app.listen(3000, () => {
  console.log('LRI HTTP server running on http://localhost:3000');
});
```

---

## Next Steps

### 📚 Learn More

- **[RFC-000](./rfcs/rfc-000.md)** - Complete protocol specification
- **[API Reference](./api/)** - Detailed API documentation
- **[Examples](../examples/)** - More code examples

### 🔧 Tools

- **[lrictl](../packages/lrictl/)** - CLI tool for LRI development
- **WebSocket Examples** - See `examples/ws-echo/`
- **LTP Examples** - See `examples/ltp-signing/`
- **LSS Examples** - See `examples/lss-coherence/`

### 🌟 Advanced Topics

- **CBOR Encoding** - Binary encoding for efficiency
- **Custom Validators** - Add your own validation rules
- **Authentication** - Integrate with your auth system
- **Rate Limiting** - Protect your servers
- **Metrics** - Monitor LRI usage

---

## Need Help?

- 📖 **Documentation**: https://github.com/safal207/LRI-Liminal-Resonance-Interface.
- 🐛 **Issues**: https://github.com/safal207/LRI-Liminal-Resonance-Interface./issues
- 💬 **Discussions**: https://github.com/safal207/LRI-Liminal-Resonance-Interface./discussions

---

**Happy coding with LRI!** 🚀
