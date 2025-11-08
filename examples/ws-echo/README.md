# WebSocket Echo Server Example (Adapter Edition)

This example demonstrates the `LRIWebSocketAdapter`, a lightweight helper that performs the LHS (Liminal Handshake Sequence) and LCE framing on top of plain `ws` sockets.

## Highlights

- **Adapter Driven** – reuse the same adapter on the server and the client.
- **Full LHS Handshake** – hello → mirror → bind → seal handled automatically.
- **Binary LCE Frames** – payloads are delivered as `[length][LCE JSON][payload]` buffers.
- **Semantic Echo** – the server reflects intent, affect, and memory metadata back to the client.

## Project Layout

```
examples/ws-echo/
├── client.js  # Client that uses the adapter to connect and send LCE frames
├── server.js  # WebSocket server that wraps each socket with the adapter
└── README.md
```

## Running the Example

Install dependencies (the example links against the local workspace package):

```bash
cd examples/ws-echo
npm install
```

Start the server:

```bash
npm run server
```

In another terminal run the client:

```bash
npm run client
```

### Expected Output

Server logs:

```
LRI WebSocket Echo Server (adapter) listening on port 8080
[Server] Client connected: 7f0d...
[Server] Received from 7f0d...:
  Intent: ask
  Goal: Test basic echo
  Payload: Hello, LRI!
```

Client logs:

```
Connecting to ws://localhost:8080 using adapter...
[Client] Connected and handshake completed!
[Client] Sending message 1/3:
  Intent: ask
  Payload: Hello, LRI!
[Client] Received response:
  Intent: tell
  Goal: Echo of: Test basic echo
  Payload: Echo: Hello, LRI!
```

## Server Walkthrough (`server.js`)

```javascript
const { WebSocketServer } = require('ws');
const { ws } = require('node-lri');

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (socket) => {
  const adapter = new ws.LRIWebSocketAdapter({ role: 'server', ws: socket, features: ['lss'] });

  adapter.once('ready', ({ sessionId }) => {
    console.log(`[Server] Client connected: ${sessionId}`);
  });

  adapter.on('frame', (lce, payload) => {
    adapter.send(
      {
        v: 1,
        intent: { type: 'tell', goal: `Echo of: ${lce.intent.goal || 'your message'}` },
        policy: { consent: 'private' },
      },
      `Echo: ${payload.toString()}`
    );
  });
});
```

## Client Walkthrough (`client.js`)

```javascript
const WebSocket = require('ws');
const { ws } = require('node-lri');

const socket = new WebSocket('ws://localhost:8080');
const adapter = new ws.LRIWebSocketAdapter({ role: 'client', ws: socket });

adapter.ready.then(() => {
  adapter.send(
    { v: 1, intent: { type: 'ask', goal: 'Ping' }, policy: { consent: 'private' } },
    'Hello from the client!'
  );
});
```

Both sides receive parsed LCE objects and raw payload buffers via the adapter, letting you concentrate on semantics rather than protocol wiring.
