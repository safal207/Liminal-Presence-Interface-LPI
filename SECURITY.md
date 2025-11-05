# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

**Note:** LRI is currently in alpha (0.1.0). Security guarantees are limited until 1.0.0 release.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in LRI, please report it responsibly:

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead:

1. **Email:** Send details to [security@lri.dev](mailto:security@lri.dev) (or create a GitHub Security Advisory)
2. **Encrypt:** Use our PGP key if possible (coming soon)
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions/components
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix timeline:** Depends on severity
  - Critical: 1-7 days
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Best effort
- **Credit:** You'll be credited in release notes (if desired)

## Security Considerations

### LRI Protocol

#### 1. Trust & Authentication (LTP)

**Current status (v0.1):** Not implemented

**Planned (v0.2):**
- JWS signatures with Ed25519
- JCS (JSON Canonicalization Scheme) for tamper-proof payloads
- PKI for identity verification

**Threat:** Spoofing, tampering
**Mitigation (now):** Use TLS, verify origin at application level
**Mitigation (future):** Cryptographic signatures via LTP

#### 2. Privacy & Consent

**Current:**
- `policy.consent` field specifies data sharing level
- No enforcement - application responsibility

**Best practices:**
- Always check `policy.consent` before sharing data
- Log consent decisions for audit
- Implement consent revocation

**Threat:** Privacy leaks, unauthorized data sharing
**Mitigation:** Application-level policy enforcement, audit logging

#### 3. Injection Attacks

**LCE is JSON:** Vulnerable to injection if not properly validated

**Mitigations:**
- Always validate against JSON Schema
- Never execute code from LCE fields
- Sanitize user-provided intent/affect tags
- Use type-safe SDKs

**Example attack:**
```json
{
  "intent": {
    "type": "ask",
    "goal": "<script>alert('XSS')</script>"
  }
}
```

**Defense:**
- Validate `intent.type` against enum
- Sanitize `goal` field before displaying
- Use Content Security Policy (CSP)

#### 4. Denial of Service (DoS)

**Threats:**
- Large LCE payloads
- Deeply nested objects
- Signature verification overhead

**Mitigations:**
- Set size limits (default: 10KB)
- Limit validation depth
- Rate limit signature verification
- Set TTL for memory/sessions

#### 5. Replay Attacks

**Current status:** Vulnerable

**Planned (v0.2):**
- `memory.t` timestamp validation
- `memory.ttl` expiration
- Nonce in trust signatures

**Mitigation (now):** Implement application-level replay protection

### SDK Security

#### Node.js SDK

- Dependencies: Regularly updated
- Validation: Uses AJV (trusted library)
- No eval() or dynamic code execution

#### Python SDK

- Dependencies: Pydantic (trusted)
- Validation: Type-safe
- No pickle or unsafe deserialization

### Deployment Security

#### Sidecar Proxy (Planned)

**Security features:**
- Audit logging
- Policy enforcement
- Metrics collection
- TLS termination

**Risks:**
- Single point of failure
- Misconfiguration
- Log leakage

#### WebSocket (Planned)

**LHS Handshake:**
- Prevents unauthorized connections
- Negotiates security parameters
- Establishes shared context

**Risks:**
- Handshake bypass
- Man-in-the-middle
- Connection hijacking

**Mitigations:**
- Always use WSS (WebSocket Secure)
- Validate handshake signatures
- Implement connection timeouts

## Threat Model

See [Issue #17](docs/issues/ALL-ISSUES.md#issue-17) for detailed STRIDE analysis.

| Threat | Severity | Status |
|--------|----------|--------|
| Spoofing | High | Planned (LTP) |
| Tampering | High | Planned (JCS+JWS) |
| Repudiation | Medium | Planned (audit) |
| Info Disclosure | High | Partial (consent) |
| Denial of Service | Medium | Partial (rate limiting) |
| Elevation of Privilege | Low | N/A |

## Best Practices

### For Application Developers

1. **Always use TLS/HTTPS** - LCE alone doesn't provide transport security
2. **Validate LCE** - Use SDK validation, don't trust raw input
3. **Check consent** - Respect `policy.consent` before sharing data
4. **Sanitize output** - Don't blindly render user-provided fields
5. **Implement rate limiting** - Prevent DoS
6. **Audit logs** - Track who sent what consent level
7. **Use latest SDK** - Security fixes in updates

### For SDK Maintainers

1. **Keep dependencies updated** - Monitor CVEs
2. **Validate strictly** - Fail closed, not open
3. **No unsafe operations** - No eval, exec, pickle
4. **Clear error messages** - Don't leak sensitive info
5. **Document security** - Make threats/mitigations clear
6. **Fuzz testing** - Test with malicious inputs

### For Protocol Designers

1. **Threat modeling** - Document attack vectors
2. **Defense in depth** - Multiple layers of security
3. **Fail secure** - Default to most restrictive
4. **Privacy by default** - Opt-in, not opt-out
5. **Versioning** - Allow security upgrades
6. **Cryptographic agility** - Support algorithm updates

## Security Roadmap

### v0.1 (Current)

- [x] Basic schema validation
- [x] Consent levels defined
- [ ] Security documentation (this file)

### v0.2 (Q2 2025)

- [ ] LTP signatures (JWS + Ed25519)
- [ ] Replay protection (nonce + timestamp)
- [ ] Audit logging
- [ ] Rate limiting

### v1.0 (Q3 2025)

- [ ] Security audit (external)
- [ ] Threat model documentation
- [ ] Penetration testing
- [ ] CVE process
- [ ] Bug bounty program

## Known Issues

None currently. This is an alpha release - expect security gaps.

## Security Hall of Fame

We recognize security researchers who responsibly disclose vulnerabilities:

- (None yet - be the first!)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [RFC 8725: JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Stay secure!** Questions? Email security@lri.dev
