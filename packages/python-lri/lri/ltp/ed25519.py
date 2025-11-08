"""Ed25519 signing helpers for the Liminal Trust Protocol."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Dict, Mapping

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519


@dataclass
class Ed25519KeyPair:
    """In-memory Ed25519 key pair."""

    private_key: ed25519.Ed25519PrivateKey
    public_key: ed25519.Ed25519PublicKey


def _b64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def generate_key_pair() -> Ed25519KeyPair:
    """Generate a new random Ed25519 key pair."""

    private = ed25519.Ed25519PrivateKey.generate()
    public = private.public_key()
    return Ed25519KeyPair(private, public)


def jwk_to_key_pair(jwk: Mapping[str, Any]) -> Ed25519KeyPair:
    """Create a key pair instance from an Ed25519 JWK mapping."""

    if jwk.get("kty") != "OKP" or jwk.get("crv") != "Ed25519":
        msg = "Unsupported JWK parameters"
        raise ValueError(msg)

    if "d" not in jwk or "x" not in jwk:
        msg = "JWK must include both public (x) and private (d) components"
        raise ValueError(msg)

    private_bytes = _b64url_decode(str(jwk["d"]))
    public_bytes = _b64url_decode(str(jwk["x"]))

    private = ed25519.Ed25519PrivateKey.from_private_bytes(private_bytes)
    public = ed25519.Ed25519PublicKey.from_public_bytes(public_bytes)
    return Ed25519KeyPair(private, public)


def key_pair_to_jwk(keys: Ed25519KeyPair) -> Dict[str, str]:
    """Export a key pair into an Ed25519 OKP JWK mapping."""

    private_bytes = keys.private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = keys.public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return {
        "kty": "OKP",
        "crv": "Ed25519",
        "d": _b64url_encode(private_bytes),
        "x": _b64url_encode(public_bytes),
    }


def sign_canonical(canonical_json: str, private_key: ed25519.Ed25519PrivateKey) -> bytes:
    """Sign canonical JSON text and return the raw signature bytes."""

    return private_key.sign(canonical_json.encode("utf-8"))


def sign_canonical_base64(canonical_json: str, private_key: ed25519.Ed25519PrivateKey) -> str:
    """Return the Base64url-encoded signature for *canonical_json*."""

    signature = sign_canonical(canonical_json, private_key)
    return _b64url_encode(signature)


def verify_canonical(
    canonical_json: str,
    signature: bytes,
    public_key: ed25519.Ed25519PublicKey,
) -> bool:
    """Return ``True`` when *signature* is valid for *canonical_json*."""

    try:
        public_key.verify(signature, canonical_json.encode("utf-8"))
    except Exception:  # noqa: BLE001 - cryptography raises multiple error types
        return False
    return True


def verify_canonical_base64(
    canonical_json: str,
    signature: str,
    public_key: ed25519.Ed25519PublicKey,
) -> bool:
    """Verify a Base64url-encoded signature."""

    try:
        raw = _b64url_decode(signature)
    except Exception:  # noqa: BLE001
        return False
    return verify_canonical(canonical_json, raw, public_key)


__all__ = [
    "Ed25519KeyPair",
    "generate_key_pair",
    "jwk_to_key_pair",
    "key_pair_to_jwk",
    "sign_canonical",
    "sign_canonical_base64",
    "verify_canonical",
    "verify_canonical_base64",
]
