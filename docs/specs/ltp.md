# Liminal Trust Protocol (LTP)

LTP provides cryptographic integrity and provenance for Liminal Context Envelopes (LCE).  It standardises how JSON payloads are canonicalised and signed so that SDKs in different languages can interoperate.

## Canonical JSON (RFC 8785)

All LCE material destined for signing **must** be transformed with the JSON Canonicalization Scheme (JCS):

1. Remove the `sig` field if present.
2. Canonicalise the remaining object according to RFC 8785.
3. Encode the canonical form as UTF-8 prior to signing.

Reference implementations:

- **Node** – `packages/node-lri/src/ltp/jcs.ts` (`canonicalizeLtpPayload`).
- **Python** – `packages/python-lri/lri/ltp/jcs.py` (`canonicalize_ltp_payload`).

Shared fixtures in `tests/fixtures/ltp/vectors.json` verify that both SDKs emit identical canonical strings.

## Ed25519 Signatures

LTP uses detached Ed25519 signatures (EdDSA) over the canonical UTF-8 bytes.  Each SDK exposes helpers that operate on Base64url encodings compatible with JSON Web Keys (JWK).

### Key Material

- Keys are represented as OKP/Ed25519 JWKs with public (`x`) and private (`d`) components encoded in Base64url without padding.
- New keys can be generated with:
  - Node: `generateKeyPairBytes()` (`packages/node-lri/src/ltp/ed25519.ts`).
  - Python: `generate_key_pair()` (`packages/python-lri/lri/ltp/ed25519.py`).
- Persist only the private component (`d`) in secure storage; the public component (`x`) may be distributed to verifiers.

### Signature Lifetimes and Metadata

- Include temporal claims (e.g. `iat`, `exp`) in the LCE envelope or accompanying transport metadata to bound replay windows.
- Rotate key pairs on a fixed cadence (recommended ≤90 days) and update dependent services with the new public keys.
- Maintain a key identifier (`kid`) alongside the signature so verifiers can select the correct public key.

### Verification Flow

1. Parse and validate the LCE envelope.
2. Extract and base64url-decode the signature payload.
3. Remove the `sig` field, canonicalise the remaining payload, and verify using the Ed25519 public key.
4. Reject signatures that fail verification or exceed their declared lifetime.

Cross-language verification is exercised by the Node Jest suite (`npm run test:workspace -- node-lri`) and the Python pytest suite (`pytest packages/python-lri/tests`).

## Interoperability Test Vectors

`tests/fixtures/ltp/vectors.json` contains canonical LCE payloads, signing keys, and expected signatures.  Both SDKs consume these fixtures during their unit tests, ensuring deterministic behaviour across languages before release.

## Roadmap Status

Issue **#8 — LTP: подписи JWS + JCS (Ed25519)** is now in sync with the implementation.  Canonicalisation helpers, Ed25519 signing utilities, and bidirectional tests are in place, and the roadmap entry has been updated accordingly.
