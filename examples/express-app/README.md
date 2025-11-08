# Express + LRI Demo Application

> Example Express server that shows how to integrate the `node-lri` middleware, parse LCE metadata, and shape responses based on intent.

## Quick start

Follow these steps from the repository root to launch the demo server:

1. Install monorepo dependencies (installs both the SDK and example app packages):

   ```bash
   npm install
   ```

2. (Optional) Rebuild the SDK if you are developing the middleware at the same time:

   ```bash
   npm run build --workspace node-lri
   ```

3. Install example-local dependencies and start the development server:

   ```bash
   cd examples/express-app
   npm install
   npm run dev
   ```

   The server listens on <http://localhost:3000>. When it boots it logs ready-made `curl` commands you can paste into another terminal.

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

Use the `LCE` variable you exported above (or create a new header inline) when exploring the API. Each command includes an explanation of the fields you should see in the response.

### 1. `GET /ping`

Checks server health and tells you whether the middleware saw an LCE header.

```bash
curl -i http://localhost:3000/ping
```

- `receivedLCE: false` because no header was provided.
- `timestamp` is generated on the server and will vary.

To prove the middleware parsed your header, run the same request with metadata:

```bash
curl -i -H "LCE: $LCE" http://localhost:3000/ping
```

- The status code remains `200`.
- `receivedLCE: true` confirms the header was decoded successfully.

### 2. `POST /echo`

Mirrors the JSON body and includes a fresh LCE header in the response so you can continue a conversation.

```bash
curl -i -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -H "LCE: $LCE" \
  -d '{"message": "Hello LRI!"}'
```

- The response body echoes your payload under `echo.message`.
- The server emits a new `LCE` header that you can decode with `base64 --decode` to inspect follow-up metadata.
- Fields like `lce.memory.thread` copy identifiers from the request to maintain continuity.

You can decode the response header inline:

```bash
curl -i -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -H "LCE: $LCE" \
  -d '{"message": "Inspect headers"}' | \
  grep '^LCE:' | \
  cut -d' ' -f2 | \
  base64 --decode | \
  jq
```

If you omit the request header while the middleware requires it (set in `index.ts`), the endpoint answers with a `428 Precondition Required` error describing the missing header name.

### 3. `GET /api/data`

Illustrates how intent drives responses. Create a sync-focused header:

```bash
SYNC_LCE=$(node -e "const { createLCEHeader } = require('node-lri'); const lce = { v: 1, intent: { type: 'sync' }, policy: { consent: 'private' }, qos: { coherence: 0.9 } }; process.stdout.write(createLCEHeader(lce));")
```

Ask for data with a standard intent:

```bash
curl -H "LCE: $LCE" http://localhost:3000/api/data
```

- Returns a list of sample numbers and a friendly `message` acknowledging the ask intent.

Synchronize context instead:

```bash
curl -H "LCE: $SYNC_LCE" http://localhost:3000/api/data
```

- Response swaps the payload for `coherence` metadata and a message confirming the sync.

## Troubleshooting

- **422 Invalid LCE** – Ensure your JSON payload matches the schema. Missing intent types or malformed fields will trigger validation errors when `validate: true` is enabled.
- **428 LCE header required** – If you enable the `required` option in `index.ts`, every request must include the header.
- **400 Malformed LCE header** – Verify that the header value is Base64 encoded JSON.

## Next steps

- Explore the WebSocket example in [`examples/ws-echo`](../ws-echo/).
- Inspect the middleware implementation in [`packages/node-lri/src/middleware.ts`](../../packages/node-lri/src/middleware.ts).
- Read the LCE schema reference in [`schemas/lce-v0.1.json`](../../schemas/lce-v0.1.json).

MIT © LRI Contributors
