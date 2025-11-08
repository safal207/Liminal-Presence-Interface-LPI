# Changelog

All notable changes to the LRI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- N/A

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [0.2.0] - 2025-11-07

### Added

#### Core Protocol Features
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

#### WebSocket Implementation
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

#### Documentation
- Comprehensive Getting Started Guide
  - Installation instructions
  - First LCE message tutorial
  - WebSocket server/client setup
  - LTP signing examples
  - LSS coherence tracking
  - Express.js integration
  - Complete chat server example

#### Testing
- **204 passing tests** across 13 test suites
  - WebSocket server tests (40+ tests)
  - WebSocket client tests (30+ tests)
  - LTP signing/verification tests (25+ tests)
  - LSS coherence calculation tests (25+ tests)
  - CBOR encoding tests (21 tests)
  - gRPC metadata tests (25 tests)
  - Middleware and validation tests (38+ tests)

### Changed
- WebSocket tests now use IPv4 (127.0.0.1) instead of localhost
  - Fixes CI failures due to IPv6/IPv4 mismatch
  - Uses PID-based port allocation for parallel test execution
  - Increased cleanup delays for test reliability

### Fixed
- WebSocket test failures in CI environment
  - EADDRINUSE errors from port conflicts
  - IPv6 connection refused errors
  - Race conditions in parallel test execution

## [0.1.0] - 2025-01-XX (Planned)

### Added
- Core LRI specification (RFC-000)
- LCE schema v1 with validation
- Basic HTTP support (headers)
- Node.js and Python SDKs
- Example applications
- Documentation site

### Goals
- Establish foundational LRI protocol
- Provide working SDKs for two major ecosystems
- Enable developers to experiment with LRI

## [1.0.0] - 2025-XX-XX (Planned)

### Planned
- Production-ready SDKs
- Comprehensive test coverage
- Performance benchmarks
- Security audit
- Complete documentation
- Sidecar proxy
- Interactive demo
- Stable API guarantees

---

## Version History

- **0.1.0** (Alpha) - Initial release, experimental
- **0.2.0** (Beta) - Feature complete, API stabilizing
- **1.0.0** (Stable) - Production ready, API stable

## Upgrade Guides

### Upgrading to 0.2.0 (when released)

TBD

### Upgrading to 1.0.0 (when released)

TBD

---

**Note:** This project is currently in alpha (0.1.0-dev). APIs may change significantly before 1.0.0.
