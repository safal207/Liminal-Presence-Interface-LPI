# WebSocket + LSS Example

Demonstrates WebSocket server with automatic coherence tracking using LSS (Liminal Session Store).

## Features

- **Automatic tracking**: All messages automatically stored in LSS
- **Real-time coherence**: Calculate coherence on every message
- **History retrieval**: Access full conversation history
- **Coherence breakdown**: See intent, affect, and semantic components

## Usage

### 1. Start the server

```bash
npm install
npm run server
```

Server will start on `ws://localhost:9001` with LSS enabled.

### 2. Run the client (in another terminal)

```bash
npm run client
```

Client will run three scenarios:
1. **High coherence**: All messages about weather (coherence ~0.9)
2. **Low coherence**: Jumping between topics (coherence ~0.4)
3. **Recovery**: Returning to focused conversation

## Server API

```javascript
const server = new LRIWSServer({
  port: 9001,
  lss: true, // Enable LSS
});

// Get coherence
const coherence = await server.getCoherence(sessionId);

// Get history
const history = await server.getHistory(sessionId);

// Get detailed breakdown
const breakdown = await server.getCoherenceBreakdown(sessionId);
```

## Example Output

```
[session-123] Received: ask → What is the weather today?
  Coherence: 1.000
  ├─ Intent similarity: 1.000
  ├─ Affect stability: 1.000
  └─ Semantic alignment: 1.000
  Message count: 1

[session-123] Received: ask → Will it rain tomorrow?
  Coherence: 0.921
  ├─ Intent similarity: 0.803
  ├─ Affect stability: 1.000
  └─ Semantic alignment: 1.000
  Message count: 2

[session-123] Received: plan → I need to plan my schedule
  Coherence: 0.653
  ├─ Intent similarity: 0.464
  ├─ Affect stability: 0.952
  └─ Semantic alignment: 0.500
  Message count: 3
  ⚠️ Low coherence detected
```

## How It Works

1. **Server enables LSS**: `lss: true` in options
2. **Messages auto-stored**: Both incoming and outgoing messages
3. **Coherence calculated**: After each message
4. **API access**: Get coherence, history, breakdown anytime

## Coherence Interpretation

- **>0.8**: High coherence - focused conversation
- **0.5-0.8**: Medium coherence - some drift
- **<0.5**: Low coherence - topic jumping

## Use Cases

- Chatbots: Track conversation quality
- Customer support: Detect confused customers
- Therapy apps: Monitor session coherence
- Gaming: Track narrative coherence
