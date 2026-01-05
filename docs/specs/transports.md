# Transport Serialization: CBOR + COSE

## Overview

The transport layer now ships with deterministic CBOR encoding and COSE_Sign1 signing helpers for LCE envelopes in both the Node and Python SDKs. The helpers strip the mutable `sig` field, canonicalize payloads, and produce detached signatures encoded in base64url for storage in the existing schema. Verification mirrors this flow and enforces the Ed25519 algorithm label before reconstructing the payload.【F:packages/node-lpi/src/cbor/lce-cose.ts†L17-L307】【F:packages/python-lpi/lpi/cbor_cose.py†L17-L245】

## Cross-language compatibility

Shared test vectors exercise a fixed Ed25519 seed and compare the generated COSE blob across runtimes. Unit suites in both SDKs confirm deterministic encoding, signature embedding, verification, tamper detection, and raw COSE extraction using the same fixture under `tests/fixtures/lce-cose-vector.json`.【F:packages/node-lpi/src/__tests__/cbor-cose.test.ts†L17-L82】【F:packages/python-lpi/tests/test_cbor_cose.py†L22-L87】 The fixture’s base64 payload is now identical between implementations, ensuring round-trip compatibility when exchanging envelopes across languages.

## Microbenchmarks

Lightweight microbenchmarks compare the legacy JSON+JWS approach against the new CBOR+COSE path:

- **Node (200 iterations)** – JSON+JWS: 721 bytes, CBOR+COSE: 458 bytes (36.5% smaller). Average encode/verify times were ~7.6 ms / 19.6 ms for JSON and ~9.3 ms / 20.1 ms for CBOR, reflecting extra canonicalization overhead in JS.【F:packages/node-lpi/tools/lce-cbor-bench.ts†L18-L108】【14a3bb†L1-L9】
- **Python (200 iterations)** – JSON+JWS: 725 bytes, CBOR+COSE: 458 bytes (36.8% smaller). Encode/verify timings averaged 127 µs / 118 µs for JSON versus 174 µs / 169 µs for CBOR, showing similar trade-offs with a smaller absolute cost due to faster native bindings.【F:packages/python-lpi/tools/lce_cbor_bench.py†L32-L121】【29a4cb†L1-L9】

These measurements capture relative trends only—the canonical JSON baseline omits JOSE headers while CBOR+COSE includes full protected headers. For production deployments, consider re-running the benches with representative envelopes and keys.

## Limitations and next steps

- Ed25519 (-8) is the only COSE algorithm currently supported; broader algorithm agility and key management remain future work.【F:packages/node-lpi/src/cbor/lce-cose.ts†L272-L307】【F:packages/python-lpi/lpi/cbor_cose.py†L185-L206】
- Canonical encoding relies on in-memory normalization. Streaming serializers or chunked signing are not yet available, so large payloads may incur additional allocations.【F:packages/node-lpi/src/cbor/lce-cose.ts†L70-L219】【F:packages/python-lpi/lpi/cbor_cose.py†L35-L150】
- Microbenchmarks reveal higher encode latency for CBOR+COSE relative to compact JSON signatures, especially in Node. Follow-up work could explore caching canonical payloads, reusing Encoders, or lowering iteration counts in hot paths.
- Validation currently asserts the presence of required LCE fields but stops short of full schema enforcement. Integrating the shared validator into the signing pipeline would give earlier feedback on malformed payloads.【F:packages/node-lpi/src/cbor/lce-cose.ts†L17-L35】【F:packages/python-lpi/lpi/cbor_cose.py†L176-L206】

Planned improvements include optional detached payloads for binary bodies, support for alternate COSE structures (e.g., `COSE_Sign` for group attestations), and exposing streaming APIs that interleave payload encoding and signing for edge environments.
