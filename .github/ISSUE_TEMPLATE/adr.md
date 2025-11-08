---
name: ADR (Architecture Decision Record)
about: Document an important architectural decision
title: 'ADR-XXX: [Title]'
labels: adr, architecture
assignees: ''
---

# ADR-XXX: [Title]

## Status

<!-- Choose one: Proposed | Accepted | Rejected | Deprecated | Superseded -->
**Status:** Proposed

**Date:** YYYY-MM-DD

**Deciders:** @username1, @username2

**Supersedes:** ADR-XXX (if applicable)

**Superseded by:** ADR-XXX (if applicable)

## Context

<!-- What is the issue that we're seeing that is motivating this decision or change? -->

## Decision

<!-- What is the change that we're proposing and/or doing? -->

## Consequences

### Positive

<!-- What becomes easier or better after this decision? -->

- Benefit 1
- Benefit 2

### Negative

<!-- What becomes harder or worse? What are the tradeoffs? -->

- Tradeoff 1
- Tradeoff 2

### Neutral

<!-- What else is affected that is neither positive nor negative? -->

- Impact 1
- Impact 2

## Alternatives Considered

### Alternative 1: [Name]

**Description:**

**Pros:**
-

**Cons:**
-

**Reason for rejection:**

### Alternative 2: [Name]

**Description:**

**Pros:**
-

**Cons:**
-

**Reason for rejection:**

## Implementation Notes

<!-- Technical details, migration steps, or implementation guidance -->

## References

<!-- Links to related issues, RFCs, discussions, documentation -->

- Related issue: #XXX
- RFC: [RFC-XXX](../../docs/rfcs/rfc-xxx.md)
- Discussion: [Link]
- Documentation: [Link]

---

## ADR Template Guide

### When to create an ADR

Create an ADR for decisions that:
- Affect the architecture or design significantly
- Are hard to reverse
- Require explanation for future maintainers
- Involve significant tradeoffs
- Impact multiple components

### ADR Numbering

ADRs are numbered sequentially starting from 001. Find the last ADR number in the repository and increment by 1.

### ADR Workflow

1. **Propose**: Create ADR with status "Proposed"
2. **Discuss**: Team reviews and discusses
3. **Decide**: Team accepts or rejects
4. **Update**: Change status to "Accepted" or "Rejected"
5. **Implement**: If accepted, implement the decision
6. **Review**: Revisit periodically, update status if needed

### Status Definitions

- **Proposed**: Decision is being considered
- **Accepted**: Decision is approved and should be implemented
- **Rejected**: Decision was considered but not approved
- **Deprecated**: Decision is no longer relevant
- **Superseded**: Replaced by another ADR

### Example ADRs

**Good topics:**
- ADR-001: Choice of Ed25519 for cryptographic signatures
- ADR-002: JSON vs Protocol Buffers for LCE encoding
- ADR-003: Synchronous vs Asynchronous LSS coherence calculation
- ADR-004: WebSocket framing format (length-prefixed vs delimited)
- ADR-005: Consent policy enforcement (client vs server-side)

**Not suitable for ADR** (use issues instead):
- Bug fixes
- Minor refactoring
- Documentation updates
- Performance optimizations (unless architectural)

### Best Practices

1. **Be concise** - ADRs should be readable in <10 minutes
2. **Be specific** - Include concrete details, not vague statements
3. **Show tradeoffs** - Document both pros and cons
4. **Link evidence** - Reference benchmarks, discussions, research
5. **Update status** - Keep ADRs current as decisions evolve
6. **Cross-reference** - Link related ADRs and RFCs

### ADR vs RFC

| ADR | RFC |
|-----|-----|
| Internal decisions | Public specifications |
| Why we chose X | How X works |
| Tradeoffs and alternatives | Requirements and design |
| Team-facing | Community-facing |
| Implementation-focused | Protocol-focused |

Both can coexist. Example:
- RFC-002: LTP Specification (public)
- ADR-012: Why we chose Ed25519 over RSA for LTP (internal)

---

**Need help?** See [CONTRIBUTING.md](../../CONTRIBUTING.md) or ask in [Discussions](https://github.com/lri/lri/discussions)
