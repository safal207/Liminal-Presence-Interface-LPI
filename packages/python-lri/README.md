# python-lri

Python SDK for Liminal Resonance Interface (LRI)

**Version:** 0.1.0 (Alpha)

**Status:** Core HTTP/REST features only. Advanced features coming soon.

## Installation

```bash
pip install python-lri
```

## Quick Start

### FastAPI Integration

#### Dependency Injection with `Depends`

Use `LRI.dependency()` anywhere you would normally inject request state. The
helper handles header parsing, validation, and converting the payload into the
`LCE` Pydantic model.

```python
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from lri import LCE, LRI

app = FastAPI()
lri = LRI()


@app.post("/events")
async def ingest_event(
    payload: dict,
    lce: LCE = Depends(lri.dependency(required=True)),
):
    """Require LCE metadata for write operations."""
    return {"intent": lce.intent.type, "payload": payload}


@app.get("/optional")
async def optional_context(
    lce: Optional[LCE] = Depends(lri.dependency()),
):
    """Gracefully degrade when the header is absent."""
    return {"intent": lce.intent.type if lce else None}


@app.exception_handler(HTTPException)
async def handle_http_exception(_, exc: HTTPException):
    """Pass through structured LRI errors in a predictable JSON shape."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

The dependency helper wraps `parse_request` and delivers an `LCE` (or `None`)
directly to your route handler. Set `required=True` to enforce the presence of
the header, otherwise requests without LCE metadata will still succeed. Because
the helper raises `HTTPException`, standard FastAPI exception handlers can be
used to customise error responses (see example above).

#### Manual Parsing (Advanced)

You can still call `parse_request` manually if you need fine-grained control:

```python
from fastapi import FastAPI, Request
from lri import LRI

app = FastAPI()
lri = LRI()


@app.get("/api/data")
async def get_data(request: Request):
    lce = await lri.parse_request(request, required=False)
    return {"ok": True, "intent": lce.intent.type if lce else None}
```

### Creating LCE Headers

```python
from lri import LRI, LCE, Intent, Policy

# Create LCE
lce = LCE(
    v=1,
    intent=Intent(type="tell", goal="Provide data"),
    policy=Policy(consent="private")
)

# Create Base64 header
header = LRI.create_header(lce)

# Add to response
response.headers["LCE"] = header
```

### Validation

```python
from lri import validate_lce

errors = validate_lce(lce_data)

if errors:
    print("Validation errors:", errors)
```

## API Reference

### Classes

#### `LRI(header_name="LCE", validate=True)`

Main LRI handler for FastAPI.

**Methods:**
- `parse_request(request, required=False)` - Parse LCE from request
- `create_header(lce)` - Create Base64 header (static method)

#### `LCE`

Liminal Context Envelope model (Pydantic).

**Fields:**
- `v: int` - Version (always 1)
- `intent: Intent` - Communicative intent
- `affect: Optional[Affect]` - Emotional context
- `meaning: Optional[Meaning]` - Semantic context
- `trust: Optional[Trust]` - Authenticity
- `memory: Optional[Memory]` - Session context
- `policy: Policy` - Privacy/consent
- `qos: Optional[QoS]` - Quality metrics
- `trace: Optional[Trace]` - Provenance
- `sig: Optional[str]` - Signature

### Functions

#### `validate_lce(data: dict) -> Optional[list]`

Validate LCE against schema. Returns list of errors or None if valid.

## Examples

See [examples/fastapi-app](../../examples/fastapi-app) for a complete example.

### Example Payloads

```json
{
  "v": 1,
  "intent": {"type": "ask", "goal": "Retrieve dataset"},
  "policy": {"consent": "team"},
  "memory": {"thread": "b1f3f7d2-8a9d-4d0a"}
}
```

```json
{
  "v": 1,
  "intent": {"type": "tell", "goal": "Stream update"},
  "policy": {"consent": "private"},
  "affect": {"tags": ["supportive"]}
}
```

Base64-encode the payload to create an `LCE` header:

```bash
echo '{"v":1,"intent":{"type":"ask"},"policy":{"consent":"private"}}' | base64
```

### Error Handling

`LRI.parse_request` and the dependency helper raise `HTTPException` with
structured error payloads that you can expose directly or transform inside a
global exception handler:

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()


@app.exception_handler(HTTPException)
async def format_lri_errors(_, exc: HTTPException):
    # Return a consistent envelope for clients and tests.
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

| Status | Scenario | Detail payload |
| ------ | -------- | -------------- |
| `400` | Base64 decode or JSON parse failure | `{"error": "Malformed LCE header", "message": "..."}` |
| `422` | Schema errors | `{"error": "Invalid LCE", "details": [...]}` |
| `422` | Pydantic model errors | `{"error": "LCE validation failed", "message": "..."}` |
| `428` | Header required but missing | `{"error": "LCE header required", "header": "LCE"}` |

Use these shapes to build consistent client-side error handling and automated
tests.

## Current Limitations

The Python SDK currently supports:

- ✅ **HTTP/REST** endpoints (FastAPI, Flask, Django)
- ✅ **LCE parsing** and validation
- ✅ **Pydantic models** for type safety
- ✅ **Basic schema validation**

**Not yet supported** (planned for future releases):

- ❌ **WebSocket** support (use Node SDK for now)
- ❌ **LTP** - Cryptographic signatures
- ❌ **LSS** - Coherence calculation
- ❌ **CBOR** encoding
- ❌ **gRPC** metadata adapter

### Feature Parity with Node SDK

| Feature | Node SDK | Python SDK | Status |
|---------|----------|------------|--------|
| HTTP/REST | ✅ v0.1.0 | ✅ v0.1.0 | Complete |
| WebSocket | ✅ v0.2.0 | ❌ Planned | In Progress |
| LTP (signatures) | ✅ v0.2.0 | ❌ Planned | Q1 2026 |
| LSS (coherence) | ✅ v0.2.0 | ❌ Planned | Q1 2026 |
| CBOR encoding | ✅ v0.2.0 | ❌ Planned | Q2 2026 |
| gRPC adapter | ✅ v0.2.0 | ❌ Planned | Q2 2026 |

For advanced features, please use the [Node.js SDK](../node-lri/) (v0.2.0).

## Roadmap

### v0.2.0 (Q1 2026)

- [ ] WebSocket support (asyncio)
- [ ] LTP - Ed25519 signatures (PyNaCl)
- [ ] LSS - Coherence calculation
- [ ] Async middleware for ASGI

### v0.3.0 (Q2 2026)

- [ ] CBOR encoding (cbor2)
- [ ] gRPC metadata adapter
- [ ] Django integration
- [ ] Flask integration

### v1.0.0 (Q3 2026)

- [ ] Feature parity with Node SDK
- [ ] Production hardening
- [ ] Complete test coverage
- [ ] Performance benchmarks
- [ ] Security audit

## Development

```bash
# Install in development mode
pip install -e ".[dev]"

# Test
pytest

# Lint
ruff check .

# Type check
mypy lri
```

## Contributing

We're actively looking for contributors to help with:

- WebSocket implementation (asyncio/websockets)
- LTP signatures (PyNaCl)
- LSS coherence tracking
- Test coverage
- Documentation

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Resources

- [Node SDK](../node-lri/) - For advanced features
- [FastAPI Example](../../examples/fastapi-app/)
- [LRI Documentation](../../docs/getting-started.md)
- [RFC-000](../../docs/rfcs/rfc-000.md)
- [LCE Schema](../../schemas/lce-v0.1.json)

## License

MIT - See [LICENSE](../../LICENSE)
