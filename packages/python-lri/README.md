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

```python
from fastapi import FastAPI, Request
from lri import LRI, LCE, Intent, Policy

app = FastAPI()
lri = LRI()

@app.get("/api/data")
async def get_data(request: Request):
    # Parse LCE from request
    lce = await lri.parse_request(request, required=False)

    # Access LCE metadata
    if lce:
        print(f"Intent: {lce.intent.type}")
        print(f"Affect: {lce.affect.tags if lce.affect else None}")
        print(f"Thread: {lce.memory.thread if lce.memory else None}")

    return {"ok": True}
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
