# Release v0.2.0 - WebSocket, Crypto, and IoT Support

This PR contains the complete v0.2.0 release with all planned features implemented and tested.

## 🎉 Major Features

### Core Protocol Features

- **LHS (Liminal Handshake Sequence)** for WebSocket connections
  - Four-step handshake: Hello → Mirror → Bind → Seal
  - Feature negotiation (LTP, LSS, compression)
  - Encoding negotiation (JSON, CBOR)
  - Session establishment with thread tracking

- **LTP (Liminal Trust Protocol)** - Cryptographic signing and verification
  - Ed25519 signatures using JWS (JSON Web Signature)
  - JCS (JSON Canonicalization Scheme, RFC 8785) for consistent signing
  - Key generation and management
  - Signature verification with tamper detection

- **LSS (Liminal Session Store)** - Conversation coherence tracking
  - In-memory session storage with automatic cleanup
  - Coherence calculation algorithm (0-1 score)
    - Intent similarity (40% weight) - cosine similarity between intent vectors
    - Affect stability (30% weight) - variance in PAD dimensions
    - Semantic alignment (30% weight) - topic consistency
  - Session statistics and metadata tracking
  - Configurable coherence window and message limits

- **CBOR Encoding** for IoT and bandwidth-constrained environments
  - Binary serialization 10-40% smaller than JSON
  - WebSocket frame encoding with 4-byte length prefix
  - Batch encoding/decoding for offline caching
  - Size comparison utilities
  - Validation helpers

- **gRPC Metadata Adapter** for microservices
  - LCE transmission via gRPC metadata/headers
  - Dual encoding support: JSON (base64) and CBOR (binary)
  - Client-side interceptors for automatic LCE injection
  - Server-side handler wrappers for LCE extraction
  - Support for unary and streaming calls

- **CLI Tool (lrictl)** for development and testing
  - `lrictl validate` - Validate LCE against JSON Schema
  - `lrictl encode/decode` - CBOR ↔ JSON conversion
  - `lrictl size` - Compare JSON vs CBOR sizes
  - `lrictl keygen` - Generate Ed25519 key pairs
  - `lrictl sign/verify` - Cryptographic signatures
  - `lrictl example` - Generate sample LCE files
  - JWK (JSON Web Key) format support

### WebSocket Implementation

- **LRIWSServer** - WebSocket server with LHS protocol
  - Automatic handshake negotiation
  - LCE frame parsing (length-prefixed)
  - Session management with LSS integration
  - Event-driven architecture
  - Configurable timeouts and limits

- **LRIWSClient** - WebSocket client
  - Automatic handshake initiation
  - Reconnection support
  - Frame encoding/decoding
  - Promise-based API

## 📚 Documentation

- Comprehensive Getting Started Guide
  - Installation instructions
  - First LCE message tutorial
  - WebSocket server/client setup
  - LTP signing examples
  - LSS coherence tracking
  - Express.js integration
  - Complete chat server example

## ✅ Testing

- **204 passing tests** across 13 test suites
  - WebSocket server tests (40+ tests)
  - WebSocket client tests (30+ tests)
  - LTP signing/verification tests (25+ tests)
  - LSS coherence calculation tests (25+ tests)
  - CBOR encoding tests (21 tests)
  - gRPC metadata tests (25 tests)
  - Middleware and validation tests (38+ tests)

## 🔧 Bug Fixes

- Fixed WebSocket test failures in CI environment
  - Resolved EADDRINUSE errors from port conflicts
  - Fixed IPv6 connection refused errors by forcing IPv4 (127.0.0.1)
  - Implemented PID-based port allocation for parallel test execution
  - Increased cleanup delays for test reliability

## 📊 Statistics

- **7 commits** (6 feature commits + 1 release commit)
- **41 files changed**
- **+8,990 lines added**
- **204 tests passing** ✅
- **13 test suites** all green

## 📝 Commits

```
aa07fe0 chore: Release v0.2.0
07e9709 feat: Add lrictl CLI tool for LRI operations
8684721 feat: Add gRPC metadata adapter for LCE
cdb73bc feat: Add CBOR encoding for IoT support
3a9dc0e docs: Add comprehensive Getting Started Guide
0addb24 fix: Use IPv4 (127.0.0.1) instead of localhost in WebSocket tests
```

## 🚀 Version Updates

- `node-lri`: 0.1.0 → 0.2.0
- `lrictl`: 0.1.0 → 0.2.0
- Status: Alpha → Beta

## 📖 Documentation Updates

- Updated CHANGELOG.md with detailed v0.2.0 release notes
- Updated README.md badges (version: 0.2.0, status: beta)
- Updated roadmap showing v0.1.0 and v0.2.0 as Complete ✅
- Updated Features section with all v0.2.0 capabilities

## 🎯 Next Steps

After merging:
- Tag release as v0.2.0
- Consider publishing to npm
- Python SDK parity (add WebSocket, LTP, LSS)
- Production features (rate limiting, auth, metrics)

---

**Ready for review and merge to main!** 🎉
