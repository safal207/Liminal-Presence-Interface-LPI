# python-lri

Python SDK for Liminal Resonance Interface (LRI)

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

## License

MIT - See [LICENSE](../../LICENSE)
