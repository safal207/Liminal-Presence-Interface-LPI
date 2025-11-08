# 🗝️ lrictl - The Vajra Path

> *"The diamond cuts through ignorance. The CLI tool cuts through confusion."*
> — Adapted from Padmasambhava's teachings

Command-line tool for **Liminal Resonance Interface (LRI)**.

## 🌟 What is lrictl?

`lrictl` is a CLI tool for working with **LCE** (Liminal Context Envelopes) - the semantic context protocol for human-AI communication. It provides direct, immediate access to validation, inspection, encoding, and creation of LCE documents.

### The Four Liberating Actions

```
lrictl
  ├── validate    🔍 Purification    - Verify LCE correctness
  ├── inspect     👁️  Vision         - See LCE nature
  ├── encode      🔄 Transformation - JSON → Base64
  ├── decode      🔓 Opening        - Base64 → JSON
  └── create      ✨ Manifestation  - Interactive creation
```

---

## 📦 Installation

```bash
npm install -g lrictl
```

Or use from source:

```bash
cd packages/lrictl
npm install
npm run build
npm link
```

---

## 🎯 Usage

### 1. Validate LCE

Check if an LCE file is valid according to the schema:

```bash
lrictl validate my-lce.json
```

**Output:**
```
🔍 Validating LCE...

✓ Valid LCE
  Schema: LCE v0.1
  File: my-lce.json
```

For detailed error information:

```bash
lrictl validate invalid-lce.json --verbose
```

---

### 2. Inspect LCE

Display LCE in beautiful, human-readable format:

```bash
lrictl inspect my-lce.json
```

**Output:**
```
═══════════════════════════════════════════
  🗝️  Liminal Context Envelope (LCE)
═══════════════════════════════════════════

Version: v1

🎯 Intent:
  type: tell
  goal: Share system status update

🛡️  Policy:
  consent: team
  share: analytics@example.com

💗 Affect:
  PAD: [P:+0.70, A:+0.40, D:+0.80]
  tags: confident, analytical

🧠 Meaning:
  topic: system-status
  ontology: https://schema.org/Status

🧵 Memory:
  thread: 550e8400-e29b-41d4-a716-446655440000
  timestamp: 2024-01-15T10:30:00Z
  ttl: PT1H

⚡ Quality of Service:
  coherence: 95.0% ██████████
  stability: high

🔍 Trace:
  hops: 2
  provenance: service-a → service-b

═══════════════════════════════════════════
```

Disable colors:

```bash
lrictl inspect my-lce.json --no-color
```

---

### 3. Encode LCE

Convert JSON LCE to Base64 for HTTP headers:

```bash
lrictl encode my-lce.json
```

**Output:**
```
ewogICJ2IjogMSwKICAiaW50ZW50IjogewogICAgInR5cGUiOiAiYXNrIgogIH0sCiAgInBvbGljeSI6IHsKICAgICJjb25zZW50IjogInByaXZhdGUiCiAgfQp9
```

Save to file:

```bash
lrictl encode my-lce.json -o encoded.txt
```

---

### 4. Decode LCE

Convert Base64 back to JSON:

```bash
lrictl decode "ewogICJ2IjogMS..." --pretty
```

Or from file:

```bash
lrictl decode encoded.txt --pretty -o decoded.json
```

---

### 5. Create LCE

Interactive creation wizard:

```bash
lrictl create
```

**Interactive prompts:**
```
🗝️  Creating new LCE...

? What is the intent? (Use arrow keys)
  🙏 ask - Request information
  💬 tell - Provide information
  💡 propose - Suggest action
  ✓  confirm - Acknowledge
  🔔 notify - Alert
  ...

? Goal (optional): Get weather forecast

? Consent level: (Use arrow keys)
  🔒 private - Private data
  👥 team - Share with team
  🌍 public - Public data

? Add emotional affect? (Y/n)
```

Save to file:

```bash
lrictl create -o my-new-lce.json
```

---

## 📚 Examples

The `examples/` directory contains sample LCE files:

- **simple-ask.json** - Minimal valid LCE (ask intent)
- **complete-tell.json** - Full LCE with all optional fields
- **invalid-lce.json** - Invalid LCE for testing validation

Try them:

```bash
lrictl inspect examples/complete-tell.json
lrictl validate examples/invalid-lce.json --verbose
lrictl encode examples/simple-ask.json
```

---

## 🧘 Philosophy

> *"Form is emptiness, emptiness is form."*
> — Heart Sutra

LCE is both structure (JSON Schema) and flow (semantic meaning). `lrictl` helps you navigate this duality:

- **Validate** ensures *form* is correct
- **Inspect** reveals the *meaning*
- **Encode/Decode** transforms between manifestations
- **Create** brings new LCE into existence

---

## 🛠️ Development

### Build

```bash
npm run build
```

### Development mode

```bash
npm run dev -- validate examples/simple-ask.json
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm test
```

---

## 📖 LCE Schema

LCE (Liminal Context Envelope) v0.1 consists of:

### Required Fields
- **v** (number): Schema version (currently 1)
- **intent** (object): Communicative intent
  - `type`: One of 10 intent types (ask, tell, propose, confirm, notify, sync, plan, agree, disagree, reflect)
  - `goal` (optional): High-level goal
- **policy** (object): Privacy and consent
  - `consent`: One of private, team, public

### Optional Fields
- **affect**: Emotional context (PAD model + tags)
- **meaning**: Semantic topic and ontology
- **memory**: Thread, timestamp, TTL
- **trust**: Cryptographic proof and attestations
- **qos**: Coherence and stability metrics
- **trace**: Provenance chain
- **sig**: Detached Ed25519 signature (Base64url)

See full schema: `../../schemas/lce-v0.1.json`

---

## 🤝 Contributing

Contributions welcome! See main repo [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

## 📜 License

MIT License - see [LICENSE](../../LICENSE)

---

## 🙏 Acknowledgments

> *"May all beings benefit from this work."*

Created with inspiration from Padmasambhava's teachings on direct perception and skillful means.

The Vajra Path cuts through complexity, revealing the luminous nature of communication.

---

**lrictl** - Where form meets meaning. 🗝️✨
