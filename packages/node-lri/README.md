# node-lri

Node.js SDK for Liminal Resonance Interface (LRI)

**Version:** 0.2.0 (Beta)

## Features

- ✅ **HTTP/Express** - Middleware for REST APIs
- ✅ **WebSocket** - LHS handshake + LCE framing
- ✅ **LTP** - Cryptographic signatures (Ed25519)
- ✅ **LSS** - Coherence calculation & session storage
- ✅ **CBOR** - Binary encoding for IoT
- ✅ **gRPC** - Metadata adapter
- ✅ **Schema validation** - JSON Schema v1
- ✅ **TypeScript** - Full type safety

## Installation

```bash
npm install node-lri
```

## Quick Start

### Express Middleware

```typescript
import express from 'express';
import { lriMiddleware, createLCEHeader, LCE } from 'node-lri';

const app = express();

// Add LRI middleware
app.use(lriMiddleware({
  required: false,  // Make LCE optional
  validate: true,   // Validate against schema
}));

app.get('/api/data', (req: any, res) => {
  const lce = req.lri?.lce;

  // Access LCE metadata
  console.log('Intent:', lce?.intent.type);
  console.log('Affect:', lce?.affect?.tags);
  console.log('Thread:', lce?.memory?.thread);

  // Create response with LCE
  const responseLCE: LCE = {
    v: 1,
    intent: { type: 'tell' },
    policy: { consent: 'private' }
  };

  res.setHeader('LCE', createLCEHeader(responseLCE));
  res.json({ ok: true });
});

app.listen(3000);
```

### WebSocket Server

```typescript
import { LRIWSServer } from 'node-lri/ws';

const server = new LRIWSServer({ port: 8080 });

server.on('connected', (ws, sessionId) => {
  console.log('Client connected:', sessionId);
});

server.on('message', (ws, lce, payload) => {
  console.log('Intent:', lce.intent.type);

  // Echo back
  server.send(ws, {
    v: 1,
    intent: { type: 'tell' },
    policy: { consent: 'private' }
  }, payload);
});
```

### Cryptographic Signatures (LTP)

```typescript
import { ltp } from 'node-lri';

// Generate Ed25519 keys
const keys = await ltp.generateKeys();

// Sign LCE
const lce = {
  v: 1,
  intent: { type: 'tell' },
  policy: { consent: 'private' }
};

const signed = await ltp.sign(lce, keys.privateKey);
console.log('Signature:', signed.sig);

// Verify
const valid = await ltp.verify(signed, keys.publicKey);
console.log('Valid:', valid); // true

// Detect tampering
signed.intent.type = 'ask';  // Modify
const invalid = await ltp.verify(signed, keys.publicKey);
console.log('Valid:', invalid); // false
```

### Coherence Tracking (LSS)

```typescript
import { lss } from 'node-lri';

const store = new lss.LSS();

// Store messages
await store.store('thread-1', {
  v: 1,
  intent: { type: 'ask' },
  affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
  meaning: { topic: 'weather' },
  policy: { consent: 'private' }
});

await store.store('thread-1', {
  v: 1,
  intent: { type: 'tell' },
  affect: { pad: [0.3, 0.2, 0.1], tags: ['helpful'] },
  meaning: { topic: 'weather' },
  policy: { consent: 'private' }
});

// Get coherence
const session = await store.getSession('thread-1');
console.log('Coherence:', session.coherence); // 0.92

const breakdown = store.calculateCoherence(session.messages);
console.log('Intent similarity:', breakdown.intentSimilarity);
console.log('Affect stability:', breakdown.affectStability);
console.log('Semantic alignment:', breakdown.semanticAlignment);
```

### CBOR Encoding

```typescript
import { cbor } from 'node-lri';

const lce = {
  v: 1,
  intent: { type: 'ask' },
  policy: { consent: 'private' }
};

// Encode to CBOR
const encoded = cbor.encodeLCE(lce);
console.log('JSON size:', JSON.stringify(lce).length); // 60
console.log('CBOR size:', encoded.length); // 40 (33% smaller)

// Decode
const decoded = cbor.decodeLCE(encoded);
console.log('Decoded:', decoded);
```

### gRPC Integration

```typescript
import { grpc } from 'node-lri';
import * as grpcLib from '@grpc/grpc-js';

// Client: Attach LCE to metadata
const metadata = new grpcLib.Metadata();
grpc.attachLCE(metadata, {
  v: 1,
  intent: { type: 'ask' },
  policy: { consent: 'private' }
});

client.method(request, metadata, callback);

// Server: Extract LCE from metadata
function handler(call, callback) {
  const lce = grpc.extractLCE(call.metadata);
  console.log('Intent:', lce?.intent.type);

  // ...
}
```

## API Reference

### Core

#### Types
- `LCE` - Liminal Context Envelope interface
- `Intent` - Communicative intent
- `Affect` - Emotional context (PAD model)
- `Policy` - Privacy/consent policy
- `Memory` - Session context
- `QoS` - Quality of service metrics
- `Trust` - Cryptographic proof
- `Trace` - Provenance tracking

#### Functions

**`lriMiddleware(options?)`**
- Express middleware for HTTP
- Options: `required`, `headerName`, `validate`

**`createLCEHeader(lce: LCE): string`**
- Create Base64-encoded LCE header

**`parseLCEHeader(header: string): LCE`**
- Parse Base64-encoded LCE header

**`validateLCE(lce: unknown): ValidationResult`**
- Validate LCE against JSON Schema

### WebSocket (`node-lri/ws`)

#### `LRIWSServer`

```typescript
const server = new LRIWSServer(options);

// Events
server.on('connected', (ws, sessionId) => {});
server.on('message', (ws, lce, payload) => {});
server.on('error', (ws, error) => {});

// Methods
server.send(ws, lce, payload);
server.broadcast(lce, payload);
server.close();
```

#### `LRIWSClient`

```typescript
const client = new LRIWSClient(url, options);

await client.connect();
client.on('message', (lce, payload) => {});
client.send(lce, payload);
await client.close();
```

### LTP - Liminal Trust Protocol (`node-lri/ltp`)

**`generateKeys(): Promise<KeyPair>`**
- Generate Ed25519 key pair

**`sign(lce: LCE, privateKey: string): Promise<LCE>`**
- Sign LCE with JWS

**`verify(signedLCE: LCE, publicKey: string): Promise<boolean>`**
- Verify LCE signature

**`exportJWK(keys: KeyPair): JWK`**
- Export keys to JWK format

**`importJWK(jwk: JWK): KeyPair`**
- Import keys from JWK

### LSS - Liminal Session Store (`node-lri/lss`)

#### `LSS` Class

```typescript
const store = new lss.LSS(options?);

await store.store(threadId, lce);
const session = await store.getSession(threadId);
const breakdown = store.calculateCoherence(messages);
const stats = store.getStats();
store.deleteSession(threadId);
store.destroy();
```

**Options:**
- `maxMessages: number` - Max messages per session (default: 100)
- `coherenceWindow: number` - Window for coherence calc (default: 10)
- `autoCleanup: boolean` - Auto-cleanup old sessions (default: true)
- `cleanupInterval: number` - Cleanup interval ms (default: 3600000)
- `maxAge: number` - Max session age ms (default: 86400000)

### CBOR Encoding (`node-lri/cbor`)

**`encodeLCE(lce: LCE): Buffer`**
- Encode LCE to CBOR

**`decodeLCE(buffer: Buffer): LCE`**
- Decode CBOR to LCE

**`encodeFrame(lce: LCE, payload: Buffer): Buffer`**
- Encode LCE + payload for WebSocket

**`decodeFrame(buffer: Buffer): { lce: LCE, payload: Buffer }`**
- Decode WebSocket frame

**`compareSize(lce: LCE): { json: number, cbor: number, savings: number }`**
- Compare JSON vs CBOR sizes

### gRPC Adapter (`node-lri/grpc`)

**`attachLCE(metadata: Metadata, lce: LCE, encoding?: 'json' | 'cbor')`**
- Attach LCE to gRPC metadata

**`extractLCE(metadata: Metadata): LCE | null`**
- Extract LCE from gRPC metadata

## Examples

### Complete Examples

- **[Express App](../../examples/express-app)** - REST API with LRI middleware
- **[WebSocket Echo](../../examples/ws-echo)** - WebSocket server with LHS handshake
- **[LTP Signing](../../examples/ltp-signing)** - Cryptographic signatures
- **[LSS Coherence](../../examples/lss-coherence)** - Coherence tracking

### Code Snippets

#### Intent-based Routing

```typescript
app.get('/api/data', (req: any, res) => {
  const lce = req.lri?.lce;

  switch (lce?.intent.type) {
    case 'ask':
      res.json({ data: [...] });
      break;
    case 'sync':
      res.json({ coherence: lce.qos?.coherence });
      break;
    default:
      res.json({ message: 'Unknown intent' });
  }
});
```

#### WebSocket with LSS

```typescript
import { LRIWSServer } from 'node-lri/ws';
import { lss } from 'node-lri';

const server = new LRIWSServer({ port: 8080 });
const store = new lss.LSS();

server.on('message', async (ws, lce, payload) => {
  const threadId = lce.memory?.thread || 'default';

  // Store message
  await store.store(threadId, lce);

  // Get coherence
  const session = await store.getSession(threadId);

  // Send response with coherence
  server.send(ws, {
    ...lce,
    intent: { type: 'tell' },
    qos: { coherence: session.coherence }
  }, payload);
});
```

#### Signed Messages

```typescript
import { ltp } from 'node-lri';

const keys = await ltp.generateKeys();

// Sign outgoing
const lce = {
  v: 1,
  intent: { type: 'tell' },
  policy: { consent: 'team' }
};
const signed = await ltp.sign(lce, keys.privateKey);

// Send
res.setHeader('LCE', createLCEHeader(signed));

// Verify incoming
app.use(async (req: any, res, next) => {
  const lce = req.lri?.lce;

  if (lce?.sig) {
    const valid = await ltp.verify(lce, publicKey);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  next();
});
```

## Development

### Build

```bash
npm install
npm run build
```

### Test

```bash
npm test                    # Run all tests
npm test -- --coverage      # With coverage
npm test -- ws-server       # Specific test
```

### Lint

```bash
npm run lint
npm run lint -- --fix
```

### Type Check

```bash
npm run type-check
```

## Version History

### v0.2.0 (Current - Beta)

- ✅ WebSocket support (LHS handshake)
- ✅ LTP (Ed25519 signatures)
- ✅ LSS (coherence calculation)
- ✅ CBOR encoding
- ✅ gRPC metadata adapter
- ✅ 204 passing tests

### v0.1.0 (Alpha)

- ✅ HTTP/Express middleware
- ✅ LCE schema validation
- ✅ TypeScript types
- ✅ Basic examples

## Roadmap

### v1.0.0 (Stable)

- [ ] Production hardening
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Complete API documentation
- [ ] Migration guides

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Resources

- [LRI Documentation](../../docs/getting-started.md)
- [RFC-000](../../docs/rfcs/rfc-000.md)
- [LCE Schema](../../schemas/lce-v0.1.json)
- [GitHub Repository](https://github.com/lri/lri)

## License

MIT - See [LICENSE](../../LICENSE)
