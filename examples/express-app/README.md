# Express + LRI Example

> Complete example demonstrating LRI middleware usage with Express.js

This example shows how to build an LRI-aware REST API server using Express.js and the `node-lri` SDK.

## Features Demonstrated

- ✅ **LRI Middleware** - Global middleware for parsing LCE from requests
- ✅ **Intent-aware routing** - Different responses based on intent type
- ✅ **LCE response headers** - Attaching LCE metadata to responses
- ✅ **Thread continuity** - Maintaining conversation context
- ✅ **Schema validation** - Automatic LCE validation
- ✅ **Graceful degradation** - Works with or without LCE headers

## Quick Start

### Installation

```bash
cd examples/express-app
npm install
```

### Configure the middleware

The project uses the latest `lriMiddleware` API that ships with the
`node-lri` package. Register it once near the top of your Express app:

```typescript
import express from 'express';
import { lriMiddleware } from 'node-lri';

const app = express();

app.use(
  lriMiddleware({
    required: false,   // Accept requests without LCE metadata
    validate: true,    // Enforce schema validation (recommended)
    headerName: 'LCE', // Override if your clients use a custom header name
  })
);
```

### Run the server

```bash
npm run dev
```

Server will start on `http://localhost:3000`.

### Try it out

The repo includes a helper script that sends a few sample requests with valid
LCE headers:

```bash
npm run demo
```

Need a quick header for manual testing? Use the helper from `node-lri`:

```bash
node -e "const { createLCEHeader } = require('node-lri'); console.log(createLCEHeader({ v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } }));"
```

Copy the printed value into the curl examples below.

## API Endpoints

### 1. GET `/ping`

Simple health check endpoint that accepts optional LCE.

**Request:**
```bash
curl http://localhost:3000/ping
```

**Request with LCE:**
```bash
# Create LCE
LCE=$(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64)

curl -H "LCE: $LCE" http://localhost:3000/ping
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receivedLCE": true
}
```

### 2. POST `/echo`

Echo endpoint that mirrors your request and responds with LCE.

**Request:**
```bash
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -H "LCE: $(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64)" \
  -d '{"message": "Hello LRI!"}'
```

**Response:**
```json
{
  "echo": {
    "message": "Hello LRI!"
  },
  "lce": {
    "v": 1,
    "intent": {
      "type": "tell",
      "goal": "Echo response"
    },
    "affect": {
      "tags": ["helpful"]
    },
    "memory": {
      "t": "2025-01-15T10:30:00.000Z"
    },
    "policy": {
      "consent": "private"
    }
  }
}
```

**Response Headers:**
```
LCE: eyJ2IjoxLCJpbnRlbnQiOnsidHlwZSI6InRlbGwifSwi...
```

### 3. GET `/api/data`

Intent-aware endpoint that responds differently based on intent type.

**Ask Intent (request data):**
```bash
curl -H "LCE: $(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64)" \
  http://localhost:3000/api/data
```

**Response:**
```json
{
  "message": "Here is the data you requested",
  "data": [1, 2, 3, 4, 5]
}
```

**Sync Intent (synchronize context):**
```bash
curl -H "LCE: $(echo '{"v":1,"intent":{"type":"sync"},"qos":{"coherence":0.85},"policy":{"consent":"private"}}' | base64)" \
  http://localhost:3000/api/data
```

**Response:**
```json
{
  "message": "Context synchronized",
  "coherence": 0.85
}
```

**No LCE (default behavior):**
```bash
curl http://localhost:3000/api/data
```

**Response:**
```json
{
  "message": "Data endpoint",
  "intent": "unknown"
}
```

## Code Walkthrough

### 1. Apply LRI Middleware

```typescript
import { lriMiddleware } from 'node-lri';

app.use(lriMiddleware({
  required: false,  // LCE is optional (graceful degradation)
  validate: true,   // Validate LCE against JSON Schema
}));
```

The middleware:
- Parses `LCE` header from requests
- Decodes Base64 → JSON
- Validates against schema
- Attaches to `req.lri.lce`

### 2. Access LCE in Endpoints

```typescript
app.get('/ping', (req: any, res) => {
  const lce = req.lri?.lce;

  // Access intent
  console.log('Intent:', lce?.intent.type);

  // Access affect
  console.log('Affect:', lce?.affect?.tags);

  res.json({ ok: true, receivedLCE: !!lce });
});
```

### 3. Create Response LCE

```typescript
import { createLCEHeader, LCE } from 'node-lri';

const responseLCE: LCE = {
  v: 1,
  intent: { type: 'tell', goal: 'Echo response' },
  affect: { tags: ['helpful'] },
  memory: {
    thread: requestLCE?.memory?.thread, // Continue thread
    t: new Date().toISOString(),
  },
  policy: { consent: 'private' },
};

// Attach to response
res.setHeader('LCE', createLCEHeader(responseLCE));
```

### 4. Intent-based Routing

```typescript
app.get('/api/data', (req: any, res) => {
  const intentType = req.lri?.lce?.intent.type || 'unknown';

  switch (intentType) {
    case 'ask':
      // Respond with data
      break;
    case 'sync':
      // Synchronize context
      break;
    default:
      // Default behavior
  }
});
```

## Testing with curl

### Helper Script

Create a file `test.sh`:

```bash
#!/bin/bash

# Encode LCE to Base64
encode_lce() {
  echo "$1" | base64 -w 0
}

# Test ping
LCE=$(encode_lce '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}')
curl -H "LCE: $LCE" http://localhost:3000/ping

# Test echo
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -H "LCE: $LCE" \
  -d '{"message": "Hello!"}'

# Test intent-aware endpoint
SYNC_LCE=$(encode_lce '{"v":1,"intent":{"type":"sync"},"policy":{"consent":"private"}}')
curl -H "LCE: $SYNC_LCE" http://localhost:3000/api/data
```

```bash
chmod +x test.sh
./test.sh
```

## LCE Structure Reference

Minimal LCE (required fields only):
```json
{
  "v": 1,
  "intent": {"type": "ask"},
  "policy": {"consent": "private"}
}
```

Full LCE with all fields:
```json
{
  "v": 1,
  "intent": {
    "type": "ask",
    "goal": "Get weather information"
  },
  "affect": {
    "pad": [0.3, 0.2, 0.1],
    "tags": ["curious"]
  },
  "memory": {
    "thread": "550e8400-e29b-41d4-a716-446655440000",
    "t": "2025-01-15T10:30:00Z"
  },
  "policy": {
    "consent": "private"
  },
  "qos": {
    "coherence": 0.87
  }
}
```

## Intent Types

| Intent | Description | Use Case |
|--------|-------------|----------|
| `ask` | Request information | Queries, questions |
| `tell` | Provide information | Responses, statements |
| `propose` | Suggest action | Recommendations |
| `confirm` | Acknowledge | Confirmations |
| `sync` | Synchronize context | Context alignment |
| `notify` | Alert | Notifications |

## Production Considerations

### 1. Middleware options

- `required` — Return HTTP 428 if an incoming request omits the header. Enable
  this in production to guarantee that every request carries LCE metadata.
- `validate` — Enforce schema validation (HTTP 422 on failure). Leave enabled
  unless you explicitly want to accept partially formed payloads.
- `headerName` — Override when integrating with legacy clients that use a
  custom header.

### 2. Logging

```typescript
app.use((req: any, res, next) => {
  const lce = req.lri?.lce;
  if (lce) {
    console.log({
      intent: lce.intent.type,
      consent: lce.policy.consent,
      thread: lce.memory?.thread,
    });
  }
  next();
});
```

### 3. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Next Steps

- **WebSocket Support:** See [ws-echo example](../ws-echo/)
- **Cryptographic Signatures:** See [ltp-signing example](../ltp-signing/)
- **Coherence Tracking:** See [lss-coherence example](../lss-coherence/)
- **Python/FastAPI:** See [fastapi-app example](../fastapi-app/)

## Resources

- [LRI Documentation](../../docs/getting-started.md)
- [Node SDK API](../../packages/node-lri/)
- [LCE Schema](../../schemas/lce-v0.1.json)
- [RFC-000](../../docs/rfcs/rfc-000.md)

## License

MIT - See [LICENSE](../../LICENSE)
