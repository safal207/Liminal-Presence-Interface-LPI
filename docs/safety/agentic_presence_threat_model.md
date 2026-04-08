# Agentic Presence Threat Model

This document summarizes how LPI fits into a safety and oversight stack for human-AI communication.

## Focus

LPI does not decide whether a model answer is true. It structures the envelope around a message so downstream systems can reason about:

- message intent
- consent state
- trust and signature material
- transport handshake continuity
- session coherence and drift

## Safety-Relevant Failure Modes

### 1. Consent state lost across boundaries

A message may start as private and then be forwarded or logged without preserving its consent semantics.

LPI helps by carrying explicit policy fields that can be checked before forwarding, storing, or replaying content.

### 2. Semantic spoofing

An application may receive a payload that looks valid at the transport level but misrepresents intent, affect, or meaning.

LPI reduces this ambiguity by formalizing those fields into the LCE rather than leaving them implicit.

### 3. Context tampering

An attacker may modify envelope fields such as consent, intent, or session metadata in transit.

LPI addresses this through LTP signatures and deterministic serialization.

### 4. Replay of previously valid context

A signed envelope can still be unsafe if replayed outside its expected window or session.

LPI and LSS together provide the hooks for timestamp checks, nonce use, and thread continuity checks.

### 5. Session drift without detection

A conversation can drift away from its original task or user expectation even when each individual message looks harmless.

LSS gives applications a place to measure coherence, track degradation, and trigger clarifying actions.

### 6. Handshake state confusion

Transport upgrades and multi-step handshakes can lose or desynchronize semantic context.

LHS exists so the envelope state and transport state can be bound together rather than improvised ad hoc.

## What LPI Detects Well

LPI is strongest when used to validate:

- whether consent metadata is present and preserved
- whether signed context envelopes were tampered with
- whether session-level coherence is degrading
- whether transport handshakes preserved context correctly
- whether semantic metadata stayed attached across protocol boundaries

## What LPI Does Not Solve Alone

LPI is not a complete safety system by itself. It does not replace:

- model evaluation
- application authorization logic
- infrastructure security
- business-logic validation
- post-decision audit systems

Instead, it improves the communication layer so those systems receive better structured inputs.

## Relation to Other Oversight Layers

Within a broader agentic stack, LPI is best viewed as:

- the interface and context layer
- the carrier of consent and semantic routing state
- the bridge between raw transport and higher-level safety validation

This makes it a useful supporting artifact alongside trace-based evaluation, causal audit, execution permissioning, and decision accountability systems.