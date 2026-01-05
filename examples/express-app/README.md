# Express + LRI Demo Application

> Example Express server that shows how to integrate the `node-lri` middleware, parse LCE metadata, and shape responses based on intent.

## Quick start

Launch the example from the repository root with the following steps:

1. Install all workspace dependencies:

   ```bash
   npm install
   ```

2. (Optional, but recommended when hacking on the SDK): rebuild the middleware so the example consumes the latest sources.

   ```bash
   npm run build --workspace node-lri
   ```

3. Start the Express demo in development mode:

   ```bash
   cd examples/express-app
   npm install
   npm run dev
   ```

   The server listens on <http://localhost:3000>. Leave this terminal running and open a new one for the requests below.

## Crafting LCE headers

You can generate a Base64 LCE header with the helper shipped in the SDK:

```bash
node -e "const { createLCEHeader } = require('node-lri'); const lce = { v: 1, intent: { type: 'ask', goal: 'Demo request' }, policy: { consent: 'private' } }; console.log(createLCEHeader(lce));"
```

Store the output in a shell variable for the examples below:

```bash
LCE=$(node -e "const { createLCEHeader } = require('node-lri'); const lce = { v: 1, intent: { type: 'ask', goal: 'Demo request' }, policy: { consent: 'private' } }; process.stdout.write(createLCEHeader(lce));")
```

## Demo requests and responses

Use the `LCE` variable you exported above (or create headers inline) when exercising the endpoints. Each example includes the request, a trimmed response, and notes about the fields you should see.

### 1. `GET /ping`

Check server health and verify that the middleware recorded your header.

```bash
curl -i http://localhost:3000/ping
```

Sample response:

```
HTTP/1.1 200 OK
Content-Type: application/liminal.lce+json; charset=utf-8

{"receivedLCE":false,"timestamp":"2024-01-01T00:00:00.000Z"}
```

The `receivedLCE` flag flips to `true` when you include metadata:

```bash
curl -i -H "LCE: $LCE" http://localhost:3000/ping
```

Key fields:

- `receivedLCE` confirms whether the middleware decoded the header.
- `timestamp` helps correlate logs with client activity.

### 2. `POST /echo`

Mirror a JSON payload and watch the middleware mint a follow-up LCE header.

```bash
curl -i -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -H "LCE: $LCE" \
  -d '{"message": "Hello LRI!"}'
```

Trimmed response:

```
HTTP/1.1 200 OK
LCE: eyJ2IjoxLCJpbnRlbnQiOnsidHlwZSI6InRlbGwifSwibWVtb3J5Ijp7InRocmVhZCI6Ii4uLiJ9fQ==

{"echo":{"message":"Hello LRI!"},"lce":{"intent":{"type":"tell"}},"received":true}
```

Notes:

- `echo.message` mirrors the request body to prove regular handlers still run.
- The response `LCE` header contains Base64 JSON that continues the conversation. Pipe it through `base64 --decode | jq` to inspect the metadata.
- `lce.memory.thread` and related fields persist identifiers from the request when present.

If you omit the request header while `required` is enabled in `index.ts`, the endpoint responds with `428 Precondition Required` and an error payload that lists the missing header name.

### 3. `GET /api/data`

Intent changes the payload shape. First craft a sync-focused header:

```bash
SYNC_LCE=$(node -e "const { createLCEHeader } = require('node-lri'); const lce = { v: 1, intent: { type: 'sync' }, policy: { consent: 'private' }, qos: { coherence: 0.9 } }; process.stdout.write(createLCEHeader(lce));")
```

Request standard data:

```bash
curl -i -H "LCE: $LCE" http://localhost:3000/api/data
```

- Returns a JSON list under `data` and a message acknowledging the `ask` intent.

Ask for synchronization instead:

```bash
curl -i -H "LCE: $SYNC_LCE" http://localhost:3000/api/data
```

- Swaps the response for coherence metadata and messaging tailored to the `sync` intent.

## Troubleshooting

- **422 Invalid LCE** – Ensure your JSON payload matches the schema. Missing intent types or malformed fields will trigger validation errors when `validate: true` is enabled.
- **428 LCE header required** – If you enable the `required` option in `index.ts`, every request must include the header.
- **400 Malformed LCE header** – Verify that the header value is Base64 encoded JSON.

## Next steps

- Explore the WebSocket example in [`examples/ws-echo`](../ws-echo/).
- Inspect the middleware implementation in [`packages/node-lri/src/middleware.ts`](../../packages/node-lri/src/middleware.ts).
- Read the LCE schema reference in [`schemas/lce-v0.1.json`](../../schemas/lce-v0.1.json).

MIT © LRI Contributors
