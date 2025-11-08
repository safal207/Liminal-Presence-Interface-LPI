# LRI Versioning Policy

> Semantic versioning strategy for LRI protocol, schemas, and SDKs

**Version:** 1.0
**Date:** 2025-01-15
**Status:** Active

## Table of Contents

- [Overview](#overview)
- [Versioning Components](#versioning-components)
- [Semantic Versioning](#semantic-versioning)
- [LCE Schema Versioning](#lce-schema-versioning)
- [SDK Versioning](#sdk-versioning)
- [Protocol Versioning](#protocol-versioning)
- [Compatibility Matrix](#compatibility-matrix)
- [Deprecation Policy](#deprecation-policy)
- [Migration Guides](#migration-guides)

## Overview

LRI uses **Semantic Versioning 2.0.0** (SemVer) for all components with specific rules for protocol stability and backward compatibility.

**Key Principles:**
1. **Backward compatibility** is paramount
2. **Graceful degradation** for legacy clients
3. **Clear migration paths** for breaking changes
4. **Long-term support** for stable versions

## Versioning Components

LRI has three independently versioned components:

| Component | Current Version | Versioning Scope |
|-----------|----------------|------------------|
| **LCE Schema** | v1 | LCE structure and fields |
| **Protocol** | v0.2.0 | LHS, LTP, LSS subsystems |
| **SDKs** | node-lri@0.2.0<br>python-lri@0.1.0 | Implementation libraries |

## Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

### MAJOR version

**Increment when:**
- Breaking changes to LCE schema (required field added)
- Breaking changes to API surface
- Incompatible protocol changes
- Removal of deprecated features

**Examples:**
- Change `policy.consent` from optional to required
- Remove support for LCE v0 schema
- Change LHS handshake flow fundamentally

**Migration required:** YES

### MINOR version

**Increment when:**
- New features added (backward compatible)
- New optional LCE fields
- New SDK methods
- New subsystems (LTP, LSS, etc.)

**Examples:**
- Add `qos.stability` field (optional)
- Add CBOR encoding support
- Add new intent type to vocabulary

**Migration required:** NO (optional adoption)

### PATCH version

**Increment when:**
- Bug fixes
- Performance improvements
- Documentation updates
- Security patches (non-breaking)

**Examples:**
- Fix coherence calculation bug
- Improve WebSocket reconnection logic
- Update README examples

**Migration required:** NO

## LCE Schema Versioning

### Schema Version Field

The `v` field in LCE indicates schema version:

```json
{
  "v": 1,
  "intent": {...},
  "policy": {...}
}
```

### Version History

| Schema Version | Protocol Version | Status | Changes |
|----------------|-----------------|--------|---------|
| v1 | 0.1.0 - current | Active | Initial schema |
| v2 | Future | Planned | TBD |

### Schema Evolution Rules

**Adding fields:**
- ✅ **Allowed**: Optional fields can be added
- ❌ **Breaking**: Required fields cannot be added without MAJOR bump

**Removing fields:**
- ❌ **Breaking**: Fields cannot be removed until MAJOR bump
- ⚠️ **Deprecation**: Must deprecate for 2 versions before removal

**Changing types:**
- ❌ **Breaking**: Type changes always require MAJOR bump
- ✅ **Allowed**: Widen type constraints (e.g., string → string|null)

### Media Type Versioning

```http
Content-Type: application/liminal.lce+json; version=1
Accept: application/liminal.lce+json; version=1
```

Clients SHOULD specify version in media type. Servers MUST support version negotiation.

## SDK Versioning

### Node.js SDK (`node-lri`)

**Current:** 0.2.0 (Beta)

**Version Promise:**
- `0.x.y`: API may change (pre-stable)
- `1.x.y`: API stability guaranteed
- `2.x.y`: Breaking changes allowed

**Stability Levels:**
- `0.1.x` - Alpha (experimental)
- `0.2.x` - Beta (feature complete, API stabilizing)
- `1.0.x` - Stable (production ready)

### Python SDK (`python-lri`)

**Current:** 0.1.0 (Alpha)

**Catch-up Plan:**
- `0.2.0` - Add WebSocket, LTP, LSS (Q1 2026)
- `0.3.0` - Add CBOR, gRPC (Q2 2026)
- `1.0.0` - Feature parity with Node SDK (Q3 2026)

## Protocol Versioning

### LHS (Liminal Handshake Sequence)

Version negotiated in `Hello` message:

```json
{
  "lri_version": "0.2",
  "features": ["ltp", "lss", "cbor"]
}
```

**Negotiation Rules:**
1. Client proposes version + features
2. Server responds with supported subset
3. Connection uses intersection of capabilities

### Feature Flags

**Supported Features:**
- `ltp` - Cryptographic signatures (v0.2.0+)
- `lss` - Session storage (v0.2.0+)
- `cbor` - Binary encoding (v0.2.0+)
- `grpc` - gRPC adapter (v0.2.0+)

Clients MUST handle missing features gracefully.

## Compatibility Matrix

### LCE Schema Compatibility

| Client Schema | Server Schema | Compatible | Notes |
|---------------|---------------|------------|-------|
| v1 | v1 | ✅ Yes | Perfect match |
| v1 | v2 | ✅ Yes | Server ignores v2 fields |
| v2 | v1 | ⚠️ Partial | Client may send unknown fields |
| v0 | v1 | ❌ No | v0 deprecated |

### SDK Compatibility

| Node SDK | Python SDK | LCE Schema | Status |
|----------|-----------|------------|--------|
| 0.2.x | 0.1.x | v1 | ✅ Compatible |
| 0.2.x | 0.2.x | v1 | ✅ Compatible (future) |
| 1.0.x | 1.0.x | v1-v2 | ✅ Compatible (future) |

### Protocol Compatibility

**Forward Compatibility:**
- Old clients MUST ignore unknown LCE fields
- Old servers MUST ignore unknown LCE fields
- Feature negotiation prevents unsupported features

**Backward Compatibility:**
- New clients MUST support old LCE versions (v1)
- New servers MUST support old clients (graceful degradation)

**Example:**

```typescript
// Server supports v1 and v2
function parseLCE(data: unknown): LCE {
  if (typeof data.v === 'number' && data.v === 2) {
    return parseLCEv2(data);
  } else {
    return parseLCEv1(data); // Fallback to v1
  }
}
```

## Deprecation Policy

### Timeline

**Pre-1.0 (Alpha/Beta):**
- ⚠️ **Deprecation notice:** 1 version (3 months)
- ❌ **Removal:** Next MINOR version

**Post-1.0 (Stable):**
- ⚠️ **Deprecation notice:** 2 MINOR versions (6 months)
- ❌ **Removal:** Next MAJOR version

### Deprecation Process

1. **Announce**: Mark feature as deprecated in docs
2. **Warn**: Add deprecation warnings in code
3. **Guide**: Provide migration guide
4. **Wait**: Maintain for deprecation period
5. **Remove**: Remove in breaking version

### Example

```typescript
// v0.2.0 - Feature works
function oldMethod() { ... }

// v0.3.0 - Deprecated
/**
 * @deprecated Use newMethod() instead. Will be removed in v1.0.0
 * @see newMethod
 */
function oldMethod() {
  console.warn('oldMethod() is deprecated. Use newMethod()');
  return newMethod();
}

// v1.0.0 - Removed
// oldMethod() no longer exists
```

### Currently Deprecated

| Feature | Since | Removal | Alternative |
|---------|-------|---------|-------------|
| _(none)_ | - | - | - |

## Migration Guides

### Upgrading Between Versions

#### From 0.1.x to 0.2.x (Node SDK)

**Breaking Changes:** None

**New Features:**
- WebSocket support
- LTP signatures
- LSS coherence
- CBOR encoding
- gRPC adapter

**Migration Steps:**

1. Update package:
```bash
npm install node-lri@^0.2.0
```

2. Optional: Add WebSocket support:
```typescript
import { LRIWSServer } from 'node-lri/ws';

const server = new LRIWSServer({ port: 8080 });
```

3. Optional: Add LTP signatures:
```typescript
import { ltp } from 'node-lri';

const keys = await ltp.generateKeys();
const signed = await ltp.sign(lce, keys.privateKey);
```

4. Test thoroughly in development

#### From 0.1.x to 0.2.x (Python SDK)

**Status:** Not yet released (Q1 2026)

**Planned Changes:**
- WebSocket support
- LTP signatures
- LSS coherence

**Migration Guide:** TBD

#### From 0.2.x to 1.0.0 (Future)

**Planned Changes:**
- API stabilization
- Possible breaking changes
- Full production readiness

**Migration Guide:** Will be provided 3 months before release

### Schema Migrations

#### If LCE v2 is introduced:

**Backward Compatible Approach:**

```typescript
// Server accepts both v1 and v2
function handleLCE(lce: LCE): Response {
  switch (lce.v) {
    case 1:
      return handleLCEv1(lce);
    case 2:
      return handleLCEv2(lce);
    default:
      throw new Error(`Unsupported LCE version: ${lce.v}`);
  }
}

// Client sends v2, falls back to v1
async function sendLCE(lce: LCE): Promise<void> {
  try {
    await sendLCEv2(lce);
  } catch (error) {
    if (error.code === 'UNSUPPORTED_VERSION') {
      await sendLCEv1(convertToV1(lce));
    } else {
      throw error;
    }
  }
}
```

## Support Policy

### Support Lifecycle

| Version | Status | Support Period | Security Fixes |
|---------|--------|----------------|----------------|
| 0.1.x | Legacy | Until 1.0.0 | Critical only |
| 0.2.x | Current | Ongoing | Yes |
| 1.0.x | Future Stable | 24 months | Yes |
| 2.0.x | Future | TBD | TBD |

### Long-Term Support (LTS)

Starting from v1.0.0:
- **LTS versions**: Supported for 24 months
- **Security fixes**: Throughout LTS period
- **Bug fixes**: First 12 months
- **New features**: Not backported

### End-of-Life (EOL)

**Warning Period:** 6 months before EOL

**After EOL:**
- No security fixes
- No bug fixes
- No support
- Remove from docs

**Current EOL Schedule:**
- v0.1.x: EOL with release of v1.0.0

## Version Negotiation

### HTTP

```http
GET /api/data HTTP/1.1
Accept: application/liminal.lce+json; version=1
```

Server responds with supported version:

```http
HTTP/1.1 200 OK
Content-Type: application/liminal.lce+json; version=1
```

If version not supported:

```http
HTTP/1.1 406 Not Acceptable
Content-Type: application/json

{
  "error": "Unsupported LCE version",
  "supported": ["1"],
  "requested": "2"
}
```

### WebSocket (LHS)

```json
// Client Hello
{
  "type": "hello",
  "lri_version": "0.2",
  "lce_versions": ["1", "2"]
}

// Server Mirror
{
  "type": "mirror",
  "lri_version": "0.2",
  "lce_version": "1"
}
```

## Changelog Maintenance

All releases MUST update [CHANGELOG.md](../CHANGELOG.md) following [Keep a Changelog](https://keepachangelog.com/) format.

### Changelog Sections

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be-removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

### Example Entry

```markdown
## [0.3.0] - 2025-03-15

### Added
- WebSocket reconnection support (#123)
- CBOR encoding for IoT devices (#145)

### Changed
- Improved coherence calculation algorithm (#156)

### Deprecated
- `oldMethod()` - Use `newMethod()` instead

### Fixed
- Race condition in LSS cleanup (#167)
- Memory leak in WebSocket server (#178)
```

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [API Versioning Best Practices](https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/)

---

**Document Owner:** LRI Core Team
**Review Cycle:** Quarterly
**Next Review:** 2025-04-15
