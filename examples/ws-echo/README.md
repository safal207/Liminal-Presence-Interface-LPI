# WebSocket Echo Server Example

This example demonstrates the LRI WebSocket implementation with the LHS (Liminal Handshake Sequence) protocol.

## Features

- **LHS Handshake**: Full 4-step handshake (Hello → Mirror → Bind → Seal)
- **LCE Framing**: Length-prefixed LCE + payload encoding
- **Session Management**: Track multiple concurrent connections
- **Semantic Echo**: Echo messages back with modified LCE context

## What This Example Shows

### Server (`server.js`)
- Creates an LRI WebSocket server on port 8080
- Handles the LHS handshake automatically
- Receives messages with LCE context
- Echoes back with modified intent and affect
- Tracks active sessions
- Graceful shutdown on SIGINT

### Client (`client.js`)
- Connects to the LRI WebSocket server
- Performs LHS handshake
- Sends test messages with different LCE contexts:
  - `ask` intent with basic context
  - `tell` intent with affect metadata
  - `propose` intent with consent policy
- Maintains thread continuity across messages
- Receives and logs responses

## LHS Handshake Flow

```
Client                          Server
  |                               |
  |--- Hello (versions/features)→ |
  |                               |
  | ←-- Mirror (selected options) |
  |                               |
  |--- Bind (thread/auth) ------→ |
  |                               |
  | ←-- Seal (session_id) ------- |
  |                               |
  |=== Flow (LCE frames) ========>|
```

## LCE Frame Format

Each message is encoded as:
```
[4 bytes: length][N bytes: LCE JSON][remaining: payload]
```

Example:
```javascript
{
  v: 1,
  intent: { type: 'ask', goal: 'Test echo' },
  policy: { consent: 'private' }
}
```
+
```
"Hello, LRI!"
```

## Running the Example

### Prerequisites

```bash
cd examples/ws-echo
npm install
```

### Start the Server

```bash
npm run server
```

Output:
```
LRI WebSocket Echo Server listening on port 8080
Waiting for connections...
```

### Run the Client (in another terminal)

```bash
npm run client
```

Expected output:
```
Connecting to ws://localhost:8080...
[Client] Connected and handshake completed!

[Client] Sending message 1/3:
  Intent: ask
  Payload: Hello, LRI!

[Client] Received response:
  Intent: tell
  Goal: Echo of: Test basic echo
  Payload: Echo: Hello, LRI!

...
```

## Code Walkthrough

### Server Handler

```javascript
const { ws } = require('node-lri');

const server = new ws.LRIWSServer({ port: 8080 });

server.onMessage = (sessionId, lce, payload) => {
  // Modify LCE for response
  const responseLCE = {
    v: 1,
    intent: { type: 'tell', goal: `Echo of: ${lce.intent.goal}` },
    policy: { consent: 'private' }
  };

  // Echo back
  server.send(sessionId, responseLCE, `Echo: ${payload}`);
};
```

### Client Usage

```javascript
const client = new ws.LRIWSClient('ws://localhost:8080');

client.onMessage = (lce, payload) => {
  console.log('Received:', payload.toString());
};

await client.connect(); // Performs LHS handshake

client.send(
  { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
  'Hello!'
);
```

## LCE Context Examples

### Basic Message
```javascript
{
  v: 1,
  intent: { type: 'tell' },
  policy: { consent: 'private' }
}
```

### With Affect and Memory
```javascript
{
  v: 1,
  intent: { type: 'ask', goal: 'Get data' },
  affect: {
    pad: [0.7, 0.5, 0.3],  // Pleasure, Arousal, Dominance
    tags: ['curious', 'urgent']
  },
  memory: {
    thread: 'thread-123',
    t: '2025-01-15T10:30:00Z'
  },
  policy: { consent: 'team', share: ['service-a'] }
}
```

## Protocol Details

### LHS Steps

1. **Hello**: Client announces supported versions and features
2. **Mirror**: Server selects version and encoding to use
3. **Bind**: Client provides thread ID and optional auth
4. **Seal**: Server confirms with session ID and signature

### Frame Encoding

The LCE + payload is encoded as a single frame:
- First 4 bytes: Big-endian uint32 length of LCE JSON
- Next N bytes: LCE JSON (UTF-8)
- Remaining bytes: Binary payload

This allows efficient streaming and clear boundaries between LCE metadata and payload data.

## Testing

Try modifying the client to send different messages:

```javascript
// Test different intent types
{ type: 'ask' }      // Question
{ type: 'tell' }     // Statement
{ type: 'propose' }  // Suggestion
{ type: 'notify' }   // Notification

// Test different consent levels
{ consent: 'private' }  // Only me
{ consent: 'team' }     // My team
{ consent: 'public' }   // Everyone
```

## Next Steps

- Add authentication in the Bind step
- Implement session persistence with LSS
- Add cryptographic signatures (LTP)
- Create a chat UI demo
- Test with multiple concurrent clients

## Related

- [Node.js SDK Documentation](../../packages/node-lri/README.md)
- [RFC-000: LRI Specification](../../docs/rfcs/rfc-000.md)
- [LHS Protocol](../../docs/rfcs/rfc-000.md#lhs-liminal-handshake-sequence)
