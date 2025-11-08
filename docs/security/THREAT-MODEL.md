# LRI Threat Model

> STRIDE threat analysis and security mitigations for the Liminal Resonance Interface

**Version:** 1.0
**Date:** 2025-01-15
**Status:** Active

## Table of Contents

- [Overview](#overview)
- [Threat Model Summary](#threat-model-summary)
- [STRIDE Analysis](#stride-analysis)
- [Attack Vectors](#attack-vectors)
- [Mitigations](#mitigations)
- [Security Requirements](#security-requirements)
- [Implementation Guidelines](#implementation-guidelines)
- [Incident Response](#incident-response)

## Overview

This document provides a comprehensive threat model for LRI (Liminal Resonance Interface) using the **STRIDE** framework:

- **S**poofing - Impersonating another user or system
- **T**ampering - Modifying data or code
- **R**epudiation - Denying actions taken
- **I**nformation Disclosure - Exposing information to unauthorized parties
- **D**enial of Service - Disrupting availability
- **E**levation of Privilege - Gaining unauthorized permissions

### Threat Model Scope

**In Scope:**
- LCE message processing
- LHS handshake protocol
- LTP cryptographic signatures
- LSS session storage
- HTTP/WebSocket/gRPC transport
- SDK implementations (Node.js, Python)

**Out of Scope:**
- Underlying transport security (TLS)
- Application business logic
- Infrastructure security
- Physical security

## Threat Model Summary

| Threat Category | Risk Level | Primary Mitigations |
|----------------|------------|---------------------|
| Spoofing | **HIGH** | LTP signatures, PKI, mutual TLS |
| Tampering | **HIGH** | JCS canonicalization, detached Ed25519 signatures |
| Repudiation | **MEDIUM** | Audit logs, non-repudiation signatures |
| Info Disclosure | **HIGH** | Consent policy, encryption, data minimization |
| Denial of Service | **MEDIUM** | Rate limiting, size limits, TTL |
| Elevation | **LOW** | Least privilege, consent validation |

## STRIDE Analysis

### S - Spoofing Identity

#### Threat: Fake LCE Messages

**Description:** Attacker crafts LCE messages impersonating a legitimate user or system.

**Attack Scenarios:**
1. Attacker sends unsigned LCE with spoofed identity
2. Attacker replays captured signed LCE from another user
3. Man-in-the-middle modifies sender identity

**Risk:** **HIGH**

**Impact:**
- Unauthorized actions performed
- Privacy violations
- Trust erosion
- Compliance violations

**Mitigations:**

**Primary:**
- ✅ **LTP Signatures** - All messages MUST be signed with Ed25519
- ✅ **Detached Ed25519 signatures** - Cryptographic proof of origin
- ✅ **PKI Infrastructure** - Public key distribution

**Secondary:**
- ⚠️ **Mutual TLS** - Transport-level authentication
- ⚠️ **Nonce + Timestamp** - Replay protection
- ⚠️ **JTI (JWT ID)** - Unique message identifiers

**Implementation:**

```typescript
// REQUIRED: Sign all outgoing LCE
const keys = await ltp.generateKeys();
const signed = await ltp.sign(lce, keys.privateKey);

// REQUIRED: Verify all incoming LCE
if (lce.sig) {
  const valid = await ltp.verify(lce, trustedPublicKey);
  if (!valid) {
    throw new UnauthorizedError('Invalid signature');
  }
}
```

**Detection:**
- Signature verification failures
- Unknown public keys
- Expired certificates

**Status:** ✅ Mitigated in v0.2.0

---

### T - Tampering with Data

#### Threat: Modified LCE Messages

**Description:** Attacker modifies LCE fields in transit or at rest.

**Attack Scenarios:**
1. MITM modifies `consent` from `private` to `public`
2. Attacker changes `intent.type` from `ask` to `tell`
3. Modified `policy.share` to add unauthorized recipients

**Risk:** **HIGH**

**Impact:**
- Privacy violations (consent bypass)
- Incorrect behavior (intent manipulation)
- Data leakage (share list modification)
- Integrity loss

**Mitigations:**

**Primary:**
- ✅ **JCS Canonicalization** - Deterministic JSON serialization
- ✅ **Ed25519 Signatures** - Detect any modifications
- ✅ **Signature Verification** - Reject tampered messages

**Secondary:**
- ⚠️ **TLS** - Protect in-transit
- ⚠️ **Immutable Audit Log** - Detect post-delivery tampering

**Implementation:**

```typescript
// Canonical JSON before signing
import { canonicalize } from 'json-canonicalization-scheme';

const canonical = canonicalize(lce);
const signature = sign(canonical, privateKey);

// Verify detects ANY modification
const {sig, ...lceWithoutSig} = receivedLCE;
const valid = verify(sig, canonicalize(lceWithoutSig), publicKey);

if (!valid) {
  auditLog.write({
    event: 'TAMPERING_DETECTED',
    lce: receivedLCE,
    timestamp: new Date()
  });
  throw new TamperingError('Message integrity violated');
}
```

**Detection:**
- Signature verification failures
- Hash mismatches
- Audit log discrepancies

**Status:** ✅ Mitigated in v0.2.0

---

### R - Repudiation

#### Threat: Denying Actions

**Description:** User or system denies sending a message or performing an action.

**Attack Scenarios:**
1. User denies sending sensitive data
2. System denies receiving consent
3. No proof of message exchange

**Risk:** **MEDIUM**

**Impact:**
- Legal disputes
- Compliance issues
- Accountability loss
- Trust erosion

**Mitigations:**

**Primary:**
- ✅ **Non-repudiation Signatures** - Cryptographic proof
- ✅ **Audit Trail** - Immutable log of all exchanges
- ✅ **Timestamping** - Prove when action occurred

**Secondary:**
- ⚠️ **Third-party Witnesses** - External attestations
- ⚠️ **Blockchain Anchoring** - Immutable timestamps

**Implementation:**

```typescript
// Audit log entry
interface AuditEntry {
  timestamp: string;        // ISO 8601
  from: string;             // Sender identity
  to: string;               // Recipient identity
  lce: LCE;                 // Full LCE message
  consent: string;          // Policy.consent value
  sig: string;              // Signature for non-repudiation
  hash: string;             // SHA-256 of canonical LCE
}

// Append-only audit log
class AuditLog {
  async append(entry: AuditEntry) {
    // Verify signature
    const valid = await ltp.verify(entry.lce, entry.from);
    if (!valid) throw new Error('Invalid signature');

    // Calculate hash
    entry.hash = sha256(canonicalize(entry.lce));

    // Sign audit entry itself
    entry.sig = await ltp.sign(entry, auditPrivateKey);

    // Append to immutable log
    await db.auditLog.insert(entry);
  }

  async prove(messageHash: string): Promise<AuditEntry> {
    return await db.auditLog.findOne({ hash: messageHash });
  }
}
```

**Detection:**
- Missing audit entries
- Signature mismatches
- Timeline inconsistencies

**Status:** ⚠️ Partially implemented (audit trail planned)

---

### I - Information Disclosure

#### Threat: Unauthorized Data Access

**Description:** Sensitive information exposed to unauthorized parties.

**Attack Scenarios:**
1. LCE with `consent: private` shared publicly
2. Session data leaked (LSS)
3. Cryptographic keys exposed
4. Affect/meaning fields reveal sensitive context

**Risk:** **HIGH**

**Impact:**
- Privacy violations
- GDPR/CCPA violations
- Reputation damage
- Legal liability

**Mitigations:**

**Primary:**
- ✅ **Consent Policy** - Explicit consent on every message
- ✅ **Policy Enforcement** - Validate before sharing
- ✅ **Data Minimization** - Only include necessary fields

**Secondary:**
- ⚠️ **Encryption at Rest** - Protect stored sessions
- ⚠️ **TLS** - Protect in transit
- ⚠️ **Differential Privacy** - Noise injection for analytics

**Implementation:**

```typescript
// REQUIRED: Check consent before sharing
function canShare(lce: LCE, recipient: string): boolean {
  switch (lce.policy.consent) {
    case 'private':
      // NEVER share
      return false;

    case 'team':
      // Check whitelist
      return lce.policy.share?.includes(recipient) ?? false;

    case 'public':
      // Always shareable
      return true;

    default:
      // Deny by default
      return false;
  }
}

// REQUIRED: Enforce before forwarding
app.post('/api/forward', async (req, res) => {
  const lce = req.lri.lce;
  const recipient = req.body.recipient;

  if (!canShare(lce, recipient)) {
    auditLog.write({
      event: 'CONSENT_VIOLATION_BLOCKED',
      lce,
      recipient,
      timestamp: new Date()
    });

    return res.status(403).json({
      error: 'Consent policy violation'
    });
  }

  // Forward...
});

// Differential privacy for analytics
function addNoise(coherence: number, epsilon: number = 1.0): number {
  const noise = laplacianNoise(1 / epsilon);
  return Math.max(0, Math.min(1, coherence + noise));
}
```

**Detection:**
- Consent policy violations
- Unauthorized access attempts
- Data leak monitoring

**Status:** ✅ Mitigated in v0.1.0 (policy), ⚠️ DP planned

---

### D - Denial of Service

#### Threat: Availability Disruption

**Description:** Attacker overwhelms system with malicious LCE messages.

**Attack Scenarios:**
1. Massive LCE message flood
2. Extremely large LCE payloads
3. LSS memory exhaustion (many sessions)
4. Expensive coherence calculations

**Risk:** **MEDIUM**

**Impact:**
- Service unavailability
- Resource exhaustion
- Degraded performance
- Operational costs

**Mitigations:**

**Primary:**
- ✅ **Size Limits** - Max 10KB per LCE
- ✅ **Rate Limiting** - Per-IP, per-user limits
- ✅ **TTL** - Auto-expire old sessions

**Secondary:**
- ⚠️ **Input Validation** - Reject malformed LCE
- ⚠️ **Resource Quotas** - Limit session count
- ⚠️ **Backpressure** - Slow down aggressive clients

**Implementation:**

```typescript
// Size limits
const MAX_LCE_SIZE = 10 * 1024; // 10KB

app.use((req, res, next) => {
  const lceHeader = req.headers['lce'];
  if (lceHeader && lceHeader.length > MAX_LCE_SIZE) {
    return res.status(413).json({
      error: 'LCE too large'
    });
  }
  next();
});

// Rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests'
});

app.use('/api', limiter);

// LSS resource limits
const store = new lss.LSS({
  maxMessages: 50,           // Per session
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  autoCleanup: true,
  cleanupInterval: 3600000   // Cleanup every hour
});

// Validation timeout
const VALIDATION_TIMEOUT = 100; // ms

async function validateWithTimeout(lce: unknown) {
  return Promise.race([
    validateLCE(lce),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Validation timeout')), VALIDATION_TIMEOUT)
    )
  ]);
}
```

**Detection:**
- Spike in request volume
- Memory/CPU usage spikes
- Slow response times

**Status:** ✅ Mitigated in v0.2.0

---

### E - Elevation of Privilege

#### Threat: Unauthorized Permission Gain

**Description:** Attacker gains unauthorized access or permissions.

**Attack Scenarios:**
1. Modify `consent` field to gain access
2. Impersonate high-privilege user
3. Bypass consent validation

**Risk:** **LOW** (depends on application enforcement)

**Impact:**
- Unauthorized data access
- Privacy violations
- Compliance violations

**Mitigations:**

**Primary:**
- ✅ **Least Privilege** - Minimal default permissions
- ✅ **Consent Validation** - Server-side enforcement
- ✅ **Signature Verification** - Prevent impersonation

**Secondary:**
- ⚠️ **Authorization Middleware** - Centralized checks
- ⚠️ **Audit All Actions** - Detect privilege abuse

**Implementation:**

```typescript
// CRITICAL: Server-side consent enforcement
// NEVER trust client-provided consent values

app.post('/api/data', async (req, res) => {
  const lce = req.lri.lce;
  const user = req.user; // From authentication

  // Verify signature matches authenticated user
  if (lce.sig) {
    const valid = await ltp.verify(lce, user.publicKey);
    if (!valid) {
      return res.status(403).json({ error: 'Signature mismatch' });
    }
  }

  // Enforce consent server-side
  const effectiveConsent = determineConsent(user, lce);

  // Override client-provided consent if needed
  lce.policy.consent = effectiveConsent;

  // Audit
  auditLog.write({
    event: 'DATA_ACCESS',
    user: user.id,
    consent: effectiveConsent,
    requested: lce.policy.consent,
    timestamp: new Date()
  });

  // Process...
});
```

**Detection:**
- Consent mismatches
- Unauthorized access attempts
- Privilege escalation patterns

**Status:** ⚠️ Application-dependent

---

## Attack Vectors

### 1. Man-in-the-Middle (MITM)

**Threat:** Intercept and modify LCE messages

**Mitigations:**
- TLS for transport
- LTP signatures for end-to-end integrity
- Certificate pinning (optional)

### 2. Replay Attacks

**Threat:** Resend captured signed LCE messages

**Mitigations:**
- `memory.t` timestamp validation
- `memory.ttl` expiration
- Nonce tracking (optional)

```typescript
// Replay protection
const MAX_AGE = 5 * 60 * 1000; // 5 minutes

function isReplay(lce: LCE): boolean {
  const timestamp = new Date(lce.memory?.t || 0).getTime();
  const age = Date.now() - timestamp;

  if (age > MAX_AGE) {
    return true; // Too old
  }

  // Check nonce (if implemented)
  if (lce.memory?.nonce && nonceCache.has(lce.memory.nonce)) {
    return true; // Already seen
  }

  // Store nonce
  if (lce.memory?.nonce) {
    nonceCache.set(lce.memory.nonce, true, MAX_AGE);
  }

  return false;
}
```

### 3. Injection Attacks

**Threat:** Malicious content in LCE fields

**Mitigations:**
- Schema validation
- Input sanitization
- Output encoding

```typescript
// Sanitize user-provided strings
import DOMPurify from 'isomorphic-dompurify';

function sanitizeLCE(lce: LCE): LCE {
  return {
    ...lce,
    intent: {
      ...lce.intent,
      goal: lce.intent.goal ? DOMPurify.sanitize(lce.intent.goal) : undefined
    },
    meaning: {
      ...lce.meaning,
      topic: lce.meaning?.topic ? DOMPurify.sanitize(lce.meaning.topic) : undefined
    }
  };
}
```

### 4. Session Hijacking

**Threat:** Steal session context from LSS

**Mitigations:**
- Encrypt sessions at rest
- Require authentication for LSS access
- Session binding to connection

### 5. Resource Exhaustion

**Threat:** Exhaust server resources

**Mitigations:**
- Size limits
- Rate limiting
- Resource quotas
- Auto-cleanup

---

## Security Requirements

### MUST (Required)

1. ✅ **Validate all LCE** against JSON Schema
2. ✅ **Enforce consent** before sharing data
3. ✅ **Use TLS** for all transport
4. ✅ **Implement size limits** (< 10KB per LCE)
5. ✅ **Log consent decisions** for audit
6. ✅ **Sign sensitive LCE** with LTP
7. ✅ **Verify signatures** on incoming LCE

### SHOULD (Recommended)

1. ⚠️ **Sign all LCE** (not just sensitive)
2. ⚠️ **Implement replay protection** (nonce + timestamp)
3. ⚠️ **Rate limit** LCE validation
4. ⚠️ **Sanitize user-provided fields**
5. ⚠️ **Encrypt sessions at rest**
6. ⚠️ **Use mutual TLS** for production
7. ⚠️ **Implement audit trail**

### MAY (Optional)

1. CBOR for bandwidth savings
2. Differential privacy for analytics
3. Blockchain anchoring for timestamps
4. Custom ontologies
5. Extended fields (prefixed with `x-`)

---

## Implementation Guidelines

### Node.js SDK

```typescript
// 1. Enable validation
app.use(lriMiddleware({ validate: true, required: true }));

// 2. Sign outgoing LCE
const keys = await ltp.generateKeys();
const signed = await ltp.sign(lce, keys.privateKey);
res.setHeader('LCE', createLCEHeader(signed));

// 3. Verify incoming LCE
if (lce.sig) {
  const valid = await ltp.verify(lce, publicKey);
  if (!valid) throw new UnauthorizedError();
}

// 4. Enforce consent
if (!canShare(lce, recipient)) {
  throw new ForbiddenError('Consent violation');
}

// 5. Rate limit
app.use(rateLimit({ windowMs: 900000, max: 100 }));
```

### Python SDK

```python
# 1. Enable validation
lri = LRI(validate=True)

# 2. Enforce consent
def can_share(lce: LCE, recipient: str) -> bool:
    if lce.policy.consent == "private":
        return False
    elif lce.policy.consent == "team":
        return recipient in (lce.policy.share or [])
    return True

# 3. Rate limit (using slowapi)
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/data")
@limiter.limit("100/minute")
async def endpoint(request: Request):
    lce = await lri.parse_request(request)
    # ...
```

---

## Incident Response

### Detection

**Monitoring Metrics:**
- Signature verification failures
- Consent policy violations
- Rate limit breaches
- Unusual coherence patterns
- Spike in request volume

**Alerting:**
- Alert on >10 signature failures/minute
- Alert on consent violations
- Alert on DoS patterns

### Response Procedures

**1. Signature Verification Failure**
```
→ Log event with full context
→ Block source IP temporarily (5 min)
→ Notify security team if persistent
→ Review public key infrastructure
```

**2. Consent Violation**
```
→ Block request immediately
→ Log violation with full audit trail
→ Notify data protection officer
→ Review and document incident
```

**3. DoS Attack**
```
→ Enable aggressive rate limiting
→ Scale infrastructure if possible
→ Block malicious IPs
→ Notify operations team
```

### Post-Incident

1. Root cause analysis
2. Update threat model
3. Improve mitigations
4. Document lessons learned
5. Update security training

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-15 | Initial threat model |

---

## References

- [STRIDE Threat Model (Microsoft)](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
- [RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)](https://datatracker.ietf.org/doc/html/rfc8032)
- [RFC 8785: JSON Canonicalization Scheme (JCS)](https://datatracker.ietf.org/doc/html/rfc8785)

---

**Document Owner:** LRI Security Team
**Review Cycle:** Quarterly
**Next Review:** 2025-04-15
