"""Liminal Trust Protocol (LTP) utilities."""

from __future__ import annotations

from typing import Any, Dict, Mapping

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from .jcs import canonicalize_ltp_payload
from .ed25519 import (
    Ed25519KeyPair,
    generate_key_pair,
    jwk_to_key_pair,
    key_pair_to_jwk,
    sign_canonical,
    sign_canonical_base64,
    verify_canonical,
    verify_canonical_base64,
)


def _strip_signature(lce: Mapping[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy of *lce* without the ``sig`` field."""

    return {k: v for k, v in lce.items() if k != "sig"}


def sign_lce(
    lce: Mapping[str, Any],
    private_key: Ed25519PrivateKey,
) -> Dict[str, Any]:
    """Sign an LCE mapping and return a new dict containing the ``sig`` field."""

    payload = _strip_signature(lce)
    canonical = canonicalize_ltp_payload(payload)
    signature = sign_canonical_base64(canonical, private_key)
    payload["sig"] = signature
    return payload


def verify_lce(
    lce: Mapping[str, Any],
    public_key: Ed25519PublicKey,
) -> bool:
    """Verify a signed LCE mapping."""

    signature = lce.get("sig")
    if not isinstance(signature, str) or not signature:
        return False
    payload = _strip_signature(lce)
    canonical = canonicalize_ltp_payload(payload)
    return verify_canonical_base64(canonical, signature, public_key)


__all__ = [
    "canonicalize_ltp_payload",
    "Ed25519KeyPair",
    "generate_key_pair",
    "jwk_to_key_pair",
    "key_pair_to_jwk",
    "sign_canonical",
    "sign_canonical_base64",
    "verify_canonical",
    "verify_canonical_base64",
    "sign_lce",
    "verify_lce",
]
