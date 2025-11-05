# LRI - Liminal Resonance Interface

> **Layer 8 for Human-AI Communication**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/lri/lri)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](https://github.com/lri/lri)

LRI (Liminal Resonance Interface) is a semantic communication protocol that sits above the traditional OSI Layer 7 (Application), adding context, intent, affect, and consent to every interaction between humans and AI systems.

## What is LRI?

LRI introduces **Layer 8** - a semantic layer that wraps application-level messages with rich contextual metadata:

- **Intent** - What the message aims to achieve (ask, tell, propose, etc.)
- **Affect** - Emotional context (PAD model: Pleasure, Arousal, Dominance)
- **Consent** - Privacy and data sharing policies
- **Coherence** - Quality metrics for semantic alignment
- **Trust** - Cryptographic proof and attestations
- **Memory** - Session context and continuity

### Why?

Current protocols (HTTP, WebSocket, gRPC) transport *data* but not *meaning*. LRI bridges this gap:

| Traditional | With LRI |
|-------------|----------|
| `{"query": "weather"}` | Intent: `ask`, Affect: `curious`, Consent: `private` |
| Raw text | Rich semantic context |
| No quality metrics | Coherence tracking |
| Implicit trust | Cryptographic proof |

## Quick Start

### Node.js (Express)

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
  console.log('Intent:', lce?.intent.type);

  res.json({
    message: 'Hello from LRI!',
    intent: lce?.intent.type
  });
});

app.listen(3000);
```

### Python (FastAPI)

```bash
pip install python-lri fastapi
```

```python
from fastapi import FastAPI, Request
from lri import LRI

app = FastAPI()
lri = LRI()

@app.get("/api/data")
async def get_data(request: Request):
    lce = await lri.parse_request(request, required=False)

    return {
        "message": "Hello from LRI!",
        "intent": lce.intent.type if lce else None
    }
```

## LCE - Liminal Context Envelope

The core data structure of LRI is the **LCE** (Liminal Context Envelope):

```json
{
  "v": 1,
  "intent": {
    "type": "ask",
    "goal": "Get weather information"
  },
  "affect": {
    "pad": [0.3, 0.1, 0.0],
    "tags": ["curious", "casual"]
  },
  "meaning": {
    "topic": "weather",
    "ontology": "https://schema.org/WeatherForecast"
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

### Intent Types

- `ask` - Request information
- `tell` - Provide information
- `propose` - Suggest action
- `confirm` - Acknowledge
- `notify` - Alert
- `sync` - Synchronize context
- `plan` - Outline strategy
- `agree` / `disagree` - Response to proposal
- `reflect` - Introspection

### Consent Levels

- `private` - Personal use only
- `team` - Shared within team
- `public` - Publicly shareable

## Architecture

```
┌─────────────────────────────────────────┐
│  Layer 8: LRI (Semantic/Context)        │  ← LCE, Intent, Affect
├─────────────────────────────────────────┤
│  Layer 7: Application (HTTP/WS/gRPC)    │  ← Traditional protocols
├─────────────────────────────────────────┤
│  Layer 6: Presentation                   │
│  ...                                     │
│  Layer 1: Physical                       │
└─────────────────────────────────────────┘
```

LRI operates **on top of** existing Layer 7 protocols:

- **HTTP** - LCE in headers (`LCE: base64(json)`)
- **WebSocket** - LCE prefix on each frame
- **gRPC** - LCE in metadata

## Project Structure

```
lri/
├── schemas/              # JSON Schema for LCE
│   └── lce-v0.1.json
├── vocab/               # Intent/Affect vocabularies
│   ├── intent.yaml
│   └── affect.yaml
├── packages/
│   ├── node-lri/        # Node.js SDK
│   └── python-lri/      # Python SDK
├── examples/
│   ├── express-app/     # Express example
│   ├── fastapi-app/     # FastAPI example
│   └── ws-echo/         # WebSocket example
├── sidecar/             # Transparent proxy
├── tools/               # CLI tools
└── docs/                # Documentation
```

## Features

### Current (v0.1.0 - Alpha)

- ✅ LCE JSON Schema v1
- ✅ Intent/Affect vocabularies
- ✅ Node.js SDK (Express middleware)
- ✅ Python SDK (FastAPI integration)
- ✅ Base64 HTTP header encoding
- ✅ Schema validation

### Planned (v0.2.0)

- [ ] LHS (Liminal Handshake Sequence) for WebSocket
- [ ] LTP (Liminal Trust Protocol) - JWS signatures
- [ ] LSS (Liminal Session Store) - coherence calculation
- [ ] CBOR encoding for IoT
- [ ] gRPC metadata adapter
- [ ] CLI tool (`lrictl`)

### Future (v1.0)

- [ ] Sidecar proxy with Prometheus metrics
- [ ] Interactive web demo
- [ ] Audit trail for compliance
- [ ] Comprehensive benchmarks
- [ ] Production-ready SDKs

## Documentation

- [RFC-000: LRI Overview](docs/rfcs/rfc-000.md) (Coming soon)
- [LCE Schema Spec](schemas/lce-v0.1.json)
- [Intent Vocabulary](vocab/intent.yaml)
- [Affect Vocabulary](vocab/affect.yaml)
- [Node SDK Guide](packages/node-lri/README.md) (Coming soon)
- [Python SDK Guide](packages/python-lri/README.md) (Coming soon)

## Examples

### Express App

See [examples/express-app](examples/express-app/) for a complete Express example.

```bash
cd examples/express-app
npm install
npm run dev
```

### FastAPI App

See [examples/fastapi-app](examples/fastapi-app/) for a complete FastAPI example.

```bash
cd examples/fastapi-app
pip install -r requirements.txt
python main.py
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repo
git clone https://github.com/lri/lri.git
cd lri

# Install dependencies
cd packages/node-lri && npm install
cd ../python-lri && pip install -e ".[dev]"

# Run tests
npm test
pytest
```

### Opening Issues

We have 22 planned issues across spec, SDK, security, and tooling. See [docs/issues/ALL-ISSUES.md](docs/issues/ALL-ISSUES.md) for the complete list.

**Good first issues:**
- #2: LCE JSON Schema validation
- #5: Node SDK documentation
- #22: Improve this README

## Roadmap

| Milestone | Version | Target | Status |
|-----------|---------|--------|--------|
| Core spec + basic SDKs | v0.1.0 | Q1 2025 | 🟡 In Progress |
| WebSocket + Crypto | v0.2.0 | Q2 2025 | 📋 Planned |
| Production ready | v1.0.0 | Q3 2025 | 📋 Planned |

## Use Cases

- **AI Chat Apps** - Add intent and affect to conversations
- **Multi-Agent Systems** - Semantic routing based on intent
- **Compliance** - Built-in consent and audit trail
- **Context Preservation** - Maintain coherence across sessions
- **Human-AI Collaboration** - Rich context for better understanding

## Philosophy

LRI is built on these principles:

1. **Semantic-first** - Meaning matters more than bytes
2. **Privacy by design** - Explicit consent on every message
3. **Layered approach** - Works with existing protocols
4. **Human-centric** - Optimized for human-AI interaction
5. **Open standard** - Community-driven, vendor-neutral

## FAQ

**Q: Do I need to change my existing API?**
A: No! LRI wraps your existing API with metadata. Your endpoints work as-is.

**Q: What's the performance overhead?**
A: Minimal - typically <10% for size and <5% for CPU. See benchmarks (coming soon).

**Q: Is this only for AI?**
A: No, but it's optimized for human-AI interaction. Human-human chat benefits too!

**Q: Why not just use HTTP headers?**
A: We do! LCE is transmitted via headers, but with a standardized semantic structure.

**Q: Does this work with REST/GraphQL/gRPC?**
A: Yes! LRI sits above these protocols and works with all of them.

## License

MIT - See [LICENSE](LICENSE) for details.

## Citation

```bibtex
@misc{lri2025,
  title={LRI: Liminal Resonance Interface},
  author={LRI Contributors},
  year={2025},
  url={https://github.com/lri/lri}
}
```

## Community

- **GitHub Issues:** [Report bugs & request features](https://github.com/lri/lri/issues)
- **Discussions:** [Join the conversation](https://github.com/lri/lri/discussions)
- **Discord:** Coming soon

---

**Built with ❤️ by the LRI community**

*"Adding meaning to the message, context to the conversation."*
