# WebSocket Echo Server Example (Adapter Edition)

This example demonstrates the `LRIWebSocketAdapter`, a lightweight helper that performs the LHS (Liminal Handshake Sequence) and LCE framing on top of plain `ws` sockets.

## Highlights

- **Adapter Driven** – reuse the same adapter on the server and the client.
- **Full LHS Handshake** – hello → mirror → bind → seal handled automatically.
- **Binary LCE Frames** – payloads are delivered as `[length][LCE JSON][payload]` buffers.
- **Semantic Echo** – the server reflects intent, affect, and memory metadata back to the client.
- **Handshake Metadata** – negotiated encoding, peer identity, and session expiry are surfaced automatically.

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
  Client ID: ws-echo-adapter-client
  Encoding: json
  Session expires at: 2024-01-01T00:05:00.000Z
[Server] Received from 7f0d...:
  Intent: ask
  Goal: Test basic echo
  Payload: Hello, LRI!
```

Client logs:

```
Connecting to ws://localhost:8080 using adapter...
[Client] Declared client ID: ws-echo-adapter-client
[Client] Connected and handshake completed!
  Session: 7f0d...
  Encoding: json
  Server ID: ws-echo-adapter-server
  Features: lss
  Session expires at: 2024-01-01T00:05:00.000Z
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
  const adapter = new ws.LRIWebSocketAdapter({
    role: 'server',
    ws: socket,
    features: ['lss'],
    serverId: 'ws-echo-adapter-server',
    sealDurationMs: 5 * 60 * 1000,
  });

  adapter.once('ready', (connection) => {
    console.log(`[Server] Client connected: ${connection.sessionId}`);
    console.log(`  Client ID: ${connection.peer?.clientId ?? 'unknown'}`);
    console.log(`  Encoding: ${connection.encoding}`);
    console.log(`  Session expires at: ${connection.expiresAt?.toISOString()}`);
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
const adapter = new ws.LRIWebSocketAdapter({
  role: 'client',
  ws: socket,
  clientId: 'ws-echo-adapter-client',
  features: ['lss'],
});

adapter.ready.then((connection) => {
  console.log(`Session ${connection.sessionId} expires at ${connection.expiresAt?.toISOString()}`);
  adapter.send(
    { v: 1, intent: { type: 'ask', goal: 'Ping' }, policy: { consent: 'private' } },
    'Hello from the client!'
  );
});
```

Both sides receive parsed LCE objects and raw payload buffers via the adapter, letting you concentrate on semantics rather than protocol wiring.
