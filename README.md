# LPI - Liminal Presence Interface

> Semantic context, consent, trust, and session coherence for human-AI communication.

[![CI](https://github.com/safal207/Liminal-Presence-Interface-LPI/actions/workflows/ci.yml/badge.svg)](https://github.com/safal207/Liminal-Presence-Interface-LPI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/safal207/Liminal-Presence-Interface-LPI)
[![Status](https://img.shields.io/badge/status-beta-green.svg)](https://github.com/safal207/Liminal-Presence-Interface-LPI)

LPI is a Layer 8 protocol for wrapping application messages with structured intent, affect, consent, trust, and memory metadata. In practical terms, it gives agentic systems and human-AI applications a portable envelope for saying not only what was sent, but why it was sent, under what consent, with what trust material, and with what session continuity.

## Why This Matters

Output-only interfaces hide important control signals. A message may be syntactically valid while still being unsafe, underspecified, or disconnected from user intent.

LPI addresses that gap by making communication state explicit:

- `intent` captures what the message is trying to do
- `affect` and `meaning` preserve semantic context
- `policy` carries consent and sharing expectations
- `trust` attaches cryptographic verification material
- `memory` and `LSS` preserve thread continuity and drift metrics

This makes LPI relevant for:

- agentic oversight
- consent-aware human-AI interfaces
- secure message signing and validation
- session coherence monitoring
- structured handshakes across transports

## Repository Contents

This monorepo currently contains:

- `packages/node-lri` - Node.js SDK and middleware
- `packages/python-lri` - Python SDK, FastAPI integration, validator, and LSS support
- `packages/lpictl` and `packages/lrictl` - CLI tooling
- `docs/specs` - LHS, LTP, LSS, and transport specifications
- `docs/security/THREAT-MODEL.md` - STRIDE-style security review
- `vocab/` and `schemas/` - canonical protocol vocabularies and schema artifacts
- `examples/` - Express, FastAPI, WebSocket, and signing examples

## Safety and Oversight Framing

LPI is useful as a communication and interface layer in a broader safety stack.

It is especially relevant for cases where a system needs to validate:

- whether a message carried the right consent state
- whether a signed context envelope was tampered with or replayed
- whether a session is drifting semantically across turns
- whether a transport handshake preserved context correctly
- whether trust, context, and routing metadata stay attached across boundaries

For a concise safety-facing summary, see [docs/safety/agentic_presence_threat_model.md](docs/safety/agentic_presence_threat_model.md).

## Validation Status

The repository now includes a root-level validation snapshot at [VALIDATION_RESULTS.md](VALIDATION_RESULTS.md).

The current reproducible validation path covers:

- vocabulary artifact generation and verification
- Python SDK core tests for parsing, validation, and LSS behavior

Run it locally with:

```bash
python scripts/validate_project.py
python scripts/generate_validation_results.py
```

## Quick Start

### Node.js

```bash
npm install node-lri express
```

```typescript
import express from 'express';
import { lriMiddleware } from 'node-lri';

const app = express();
app.use(lriMiddleware());

app.get('/api/data', (req: any, res) => {
  const lce = req.lri?.lce;
  res.json({
    message: 'Hello from LPI',
    intent: lce?.intent.type ?? null,
  });
});

app.listen(3000);
```

### Python

```bash
pip install python-lri fastapi
```

```python
from fastapi import FastAPI, Request
from lri import LRI

app = FastAPI()
lri = LRI()

@app.get('/api/data')
async def get_data(request: Request):
    lce = await lri.parse_request(request, required=False)
    return {
        'message': 'Hello from LPI',
        'intent': lce.intent.type if lce else None,
    }
```

## Protocol Building Blocks

### LCE

The Liminal Context Envelope is the structured payload that carries semantic context.

### LHS

The Liminal Handshake Sequence defines the context-establishing transport handshake.

#### Protocol versioning (WebSocket handshake)

This SDK uses `lpiVersion` as the canonical option to advertise a protocol version during the LHS handshake.

- **Canonical option:** `lpiVersion`
- **Legacy alias (deprecated):** `lriVersion`
- **Wire compatibility:** handshake field remains `lri_version`

Version resolution is centralized and follows:

`lpiVersion` → `lriVersion` → default (`0.1`)

### LTP

The Liminal Trust Protocol signs envelopes with detached Ed25519 signatures.

### LSS

The Liminal Session Store tracks thread-level continuity, coherence, and drift.

## Key Documents

- [Getting Started](docs/getting-started.md)
- [RFC-000 Overview](docs/rfcs/rfc-000.md)
- [LHS Spec](docs/specs/lhs.md)
- [LTP Spec](docs/specs/ltp.md)
- [LSS Spec](docs/specs/lss.md)
- [Transport Notes](docs/specs/transports.md)
- [Security Threat Model](docs/security/THREAT-MODEL.md)
- [Agentic Presence Threat Model](docs/safety/agentic_presence_threat_model.md)
- [Validation Snapshot](VALIDATION_RESULTS.md)

## Development Notes

The full workspace test matrix still depends on complete Node workspace setup. For a stable review path, use the root validation scripts first and then drill down into individual packages.

```bash
node --test tests/vocab.artifacts.test.mjs
cd packages/python-lri
python -m pytest -q tests/test_lri.py tests/test_lss.py tests/test_validator.py
```

## Positioning

LPI should be evaluated as a semantic communication and interface-control layer for human-AI systems.

It is not just a messaging wrapper. The repository combines:

- structured semantic envelopes
- transport handshake semantics
- consent-carrying policy fields
- signed trust material
- session drift and coherence tracking

That combination makes it useful as a supporting artifact for agentic oversight and safety-oriented interface design.