# FastAPI + LRI Example

> Complete example demonstrating LRI usage with FastAPI and Python

This example shows how to build an LRI-aware REST API server using FastAPI and the `python-lri` SDK.

## Features Demonstrated

- ✅ **LRI Request Parsing** - Parse LCE from request headers
- ✅ **FastAPI Depends helper** - Inject validated `LCE` objects directly (optional & required)
- ✅ **Intent-aware routing** - Different responses based on intent type
- ✅ **LCE response headers** - Attaching LCE metadata to responses
- ✅ **Pydantic validation** - Type-safe LCE models
- ✅ **Async/await** - Modern Python async patterns
- ✅ **Graceful degradation** - Works with or without LCE headers
- ✅ **Payload-aware handlers** - Combine body data with LCE metadata (`/chat`)
- ✅ **Structured errors** - Global handler keeps `HTTPException.detail` stable

## Quick Start

### Installation

```bash
cd examples/fastapi-app
pip install -r requirements.txt
```

### Run the server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --reload
```

Server will start on `http://localhost:8000`

### View API Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## API Endpoints

### 1. GET `/`

Root endpoint with API information.

**Request:**
```bash
curl http://localhost:8000/
```

**Response:**
```json
{
  "name": "LRI FastAPI Example",
  "version": "0.1.0",
  "endpoints": ["/ping", "/echo", "/ingest", "/chat", "/api/data"],
  "lri": {
    "version": "0.1",
    "header": "LCE",
    "media_type": "application/liminal.lce+json"
  }
}
```

### 2. GET `/ping`

Simple health check endpoint that accepts optional LCE.

**Request:**
```bash
curl http://localhost:8000/ping
```

**Request with LCE:**
```bash
# Create LCE
LCE=$(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64)

curl -H "LCE: $LCE" http://localhost:8000/ping
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-01-15T10:30:00.000000",
  "received_lce": false
}
```

### 3. POST `/echo`

Echo endpoint that mirrors your request and responds with fresh LCE metadata.

**Request:**
```bash
curl -X POST http://localhost:8000/echo \
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
    "policy": {
      "consent": "private"
    }
  }
}
```

**Response Headers:**
```
LCE: eyJ2IjoxLCJpbnRlbnQiOnsidHlwZSI6InRlbGwifSwi...
Content-Type: application/liminal.lce+json
```

### 4. POST `/ingest`

Write endpoint that **requires** an LCE header. Demonstrates `Depends(lri.dependency(required=True))`.

**Request:**
```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -H "LCE: $(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"team"}}' | base64)" \
  -d '{"message": "ping"}'
```

**Response:**
```json
{
  "intent": "ask",
  "echo": "ping"
}
```

**Missing header:**
```json
{
  "detail": {
    "error": "LCE header required",
    "header": "LCE"
  }
}
```

**Malformed header (decode failure -> 400):**
```json
{
  "detail": {
    "error": "Malformed LCE header",
    "message": "Expecting value: line 1 column 1 (char 0)"
  }
}
```

### 5. POST `/chat`

Combine body payloads with LCE metadata to inform downstream logic.

**Request:**
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "LCE: $(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"team"}}' | base64)" \
  -d '{"prompt": "Summarise the last session"}'
```

**Response:**
```json
{
  "prompt": "Summarise the last session",
  "intent": "ask",
  "consent": "team"
}
```

**Invalid LCE (schema error -> 422):**
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "LCE: $(echo '{"v":1,"intent":{"type":"invalid"},"policy":{"consent":"team"}}' | base64)" \
  -d '{"prompt": "Broken"}'
```

```json
{
  "detail": {
    "error": "Invalid LCE",
    "details": [
      {
        "message": "Invalid intent type. Must be one of: ask, tell, propose, confirm, notify, sync, plan, agree, disagree, reflect",
        "path": "/intent/type"
      }
    ]
  }
}
```

### 6. GET `/api/data`

Intent-aware endpoint that responds differently based on intent type.

**Ask Intent (request data):**
```bash
curl -H "LCE: $(echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64)" \
  http://localhost:8000/api/data
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
  http://localhost:8000/api/data
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
curl http://localhost:8000/api/data
```

**Response:**
```json
{
  "message": "Data endpoint",
  "intent": "unknown"
}
```

## Code Walkthrough

### 1. Initialize LRI

```python
from lri import LRI

app = FastAPI(title="LRI FastAPI Example")
lri = LRI()
```

The `LRI` class provides:
- Request parsing
- LCE validation
- Header encoding

### 2. Parse LCE in Endpoints

Use the dependency helper to inject an optional `LCE` directly into the route or
require it when necessary:

```python
from typing import Optional
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from lri import LCE


@app.exception_handler(HTTPException)
async def passthrough_http_exception(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/ping")
async def ping(lce: Optional[LCE] = Depends(lri.dependency())):
    return {"ok": True, "received_lce": lce is not None}


@app.post("/ingest")
async def ingest(
    payload: dict,
    lce: LCE = Depends(lri.dependency(required=True)),
):
    return {"intent": lce.intent.type, "echo": payload.get("message", "")}


@app.post("/chat")
async def chat(
    payload: dict,
    lce: LCE = Depends(lri.dependency(required=True)),
):
    return {
        "prompt": payload["prompt"],
        "intent": lce.intent.type,
        "consent": lce.policy.consent,
    }
```

The shared handler keeps all `HTTPException` payloads consistent with the SDK
documentation so tests can assert on the `detail` envelope.

### 3. Create Response LCE

```python
from typing import Optional
from fastapi import Depends
from fastapi.responses import JSONResponse
from lri import LCE, Intent, Policy


@app.post("/echo")
async def echo(
    body: dict,
    lce: Optional[LCE] = Depends(lri.dependency()),
):
    response_lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Echo response"),
        policy=Policy(consent=lce.policy.consent if lce else "private")
    )

    response = JSONResponse(content={"echo": body})
    response.headers["LCE"] = lri.create_header(response_lce)
    response.headers["Content-Type"] = "application/liminal.lce+json"
    return response
```

### 4. Intent-based Logic

```python
from typing import Optional
from fastapi import Depends


@app.get("/api/data")
async def get_data(lce: Optional[LCE] = Depends(lri.dependency())):
    intent_type = lce.intent.type if lce else "unknown"

    if intent_type == "ask":
        return {
            "message": "Here is the data you requested",
            "data": [1, 2, 3, 4, 5]
        }
    if intent_type == "sync" and lce and lce.qos:
        return {
            "message": "Context synchronized",
            "coherence": lce.qos.coherence or 0.5
        }
    return {
        "message": "Data endpoint",
        "intent": intent_type
    }
```

### 5. Structured HTTP Exceptions

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse


@app.exception_handler(HTTPException)
async def passthrough_http_exception(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

The handler mirrors what the SDK documentation describes, so automated tests can
assert on the `detail` field without special cases.

## Testing with Python

### Using requests library

```python
import requests
import base64
import json

# Helper function
def encode_lce(lce_dict):
    lce_json = json.dumps(lce_dict)
    return base64.b64encode(lce_json.encode()).decode()

# Test ping
lce = {
    "v": 1,
    "intent": {"type": "ask"},
    "policy": {"consent": "private"}
}

headers = {"LCE": encode_lce(lce)}
response = requests.get("http://localhost:8000/ping", headers=headers)
print(response.json())

# Test echo
response = requests.post(
    "http://localhost:8000/echo",
    headers=headers,
    json={"message": "Hello LRI!"}
)
print(response.json())
print(f"Response LCE: {response.headers.get('LCE')}")

# Test intent-aware endpoint
sync_lce = {
    "v": 1,
    "intent": {"type": "sync"},
    "policy": {"consent": "private"}
}
headers = {"LCE": encode_lce(sync_lce)}
response = requests.get("http://localhost:8000/api/data", headers=headers)
print(response.json())
```

Save as `test_client.py` and run:

```bash
python test_client.py
```

## LCE Models (Pydantic)

The `python-lri` SDK uses Pydantic for type-safe LCE models:

```python
from lri import LCE, Intent, Affect, Policy, Memory

# Create LCE with type checking
lce = LCE(
    v=1,
    intent=Intent(type="ask", goal="Get information"),
    affect=Affect(
        pad=[0.3, 0.2, 0.1],
        tags=["curious"]
    ),
    memory=Memory(
        thread="550e8400-e29b-41d4-a716-446655440000",
        t="2025-01-15T10:30:00Z"
    ),
    policy=Policy(consent="private")
)

# Serialize to dict (excluding None values)
lce_dict = lce.model_dump(exclude_none=True)

# Validate from dict
lce = LCE(**lce_dict)
```

## Production Considerations

### 1. Required LCE

```python
@app.get("/api/secure")
async def secure_endpoint(request: Request):
    # Require LCE (raises 400 if missing)
    lce = await lri.parse_request(request, required=True)

    return {"data": "sensitive information"}
```

### 2. Error Handling

```python
from fastapi import HTTPException

@app.get("/api/data")
async def get_data(request: Request):
    try:
        lce = await lri.parse_request(request, required=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid LCE: {str(e)}")

    return {"data": "success"}
```

### 3. Middleware for Logging

```python
from starlette.middleware.base import BaseHTTPMiddleware

class LRILoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        lri_instance = LRI()
        lce = await lri_instance.parse_request(request, required=False)

        if lce:
            print(f"[LRI] Intent: {lce.intent.type}, Consent: {lce.policy.consent}")

        response = await call_next(request)
        return response

app.add_middleware(LRILoggingMiddleware)
```

### 4. CORS Support

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5. Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/data")
@limiter.limit("10/minute")
async def get_data(request: Request):
    lce = await lri.parse_request(request, required=False)
    return {"data": "rate-limited endpoint"}
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Build and run

```bash
docker build -t lri-fastapi-example .
docker run -p 8000:8000 lri-fastapi-example
```

## Development

### Install in editable mode

```bash
# Install python-lri in development mode
cd ../../packages/python-lri
pip install -e ".[dev]"

# Return to example
cd ../../examples/fastapi-app
pip install -r requirements.txt
```

### Run tests

```bash
pytest
```

### Type checking

```bash
mypy main.py
```

## Limitations (Current Python SDK)

The Python SDK currently supports:

- ✅ HTTP/REST endpoints
- ✅ Basic LCE parsing and validation
- ✅ Pydantic models

Not yet supported (coming in future versions):

- ❌ WebSocket support
- ❌ LTP (cryptographic signatures)
- ❌ LSS (coherence calculation)
- ❌ CBOR encoding
- ❌ gRPC metadata

See [Node.js examples](../express-app/) for these features.

## Next Steps

- **Node.js/Express:** See [express-app example](../express-app/)
- **WebSocket (Node):** See [ws-echo example](../ws-echo/)
- **Cryptographic Signatures (Node):** See [ltp-signing example](../ltp-signing/)
- **Coherence Tracking (Node):** See [lss-coherence example](../lss-coherence/)

## Resources

- [LRI Documentation](../../docs/getting-started.md)
- [Python SDK API](../../packages/python-lri/)
- [LCE Schema](../../schemas/lce-v0.1.json)
- [RFC-000](../../docs/rfcs/rfc-000.md)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## License

MIT - See [LICENSE](../../LICENSE)
