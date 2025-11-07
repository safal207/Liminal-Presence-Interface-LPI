"""
LTP (Liminal Trust Protocol) - Cryptographic signing for LCE messages

Uses Ed25519 signatures with JWS (JSON Web Signature) format.
"""

import json
import base64
from typing import Optional
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization

from .types import LCE


def generate_keys() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """
    Generate Ed25519 key pair for signing

    Returns:
        Tuple of (private_key, public_key)
    """
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    return private_key, public_key


def export_private_key_pem(private_key: Ed25519PrivateKey) -> str:
    """Export private key to PEM format"""
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return pem.decode("utf-8")


def export_public_key_pem(public_key: Ed25519PublicKey) -> str:
    """Export public key to PEM format"""
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem.decode("utf-8")


def import_private_key_pem(pem: str) -> Ed25519PrivateKey:
    """Import private key from PEM format"""
    return serialization.load_pem_private_key(pem.encode("utf-8"), password=None)  # type: ignore


def import_public_key_pem(pem: str) -> Ed25519PublicKey:
    """Import public key from PEM format"""
    return serialization.load_pem_public_key(pem.encode("utf-8"))  # type: ignore


def _canonicalize_json(data: dict) -> str:
    """Canonicalize JSON for signing (similar to JCS RFC 8785)"""
    # Simplified version - in production use python-canonicaljson
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def sign(lce: LCE, private_key: Ed25519PrivateKey) -> dict:
    """
    Sign LCE message with private key

    Args:
        lce: LCE message to sign
        private_key: Ed25519 private key

    Returns:
        LCE dict with 'sig' field containing signature
    """
    # Convert LCE to dict (without signature)
    lce_dict = lce.model_dump(exclude_none=True)
    lce_dict.pop("sig", None)  # Remove any existing signature

    # Canonicalize JSON
    canonical = _canonicalize_json(lce_dict)

    # Create JWS header
    header = {"alg": "EdDSA", "typ": "LCE"}
    header_b64 = base64.urlsafe_b64encode(
        json.dumps(header).encode("utf-8")
    ).decode("utf-8").rstrip("=")

    # Create payload
    payload_b64 = base64.urlsafe_b64encode(canonical.encode("utf-8")).decode(
        "utf-8"
    ).rstrip("=")

    # Sign
    signing_input = f"{header_b64}.{payload_b64}"
    signature = private_key.sign(signing_input.encode("utf-8"))
    signature_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")

    # Create JWS compact serialization
    jws = f"{header_b64}.{payload_b64}.{signature_b64}"

    # Add signature to LCE
    lce_dict["sig"] = jws
    return lce_dict


def verify(lce_dict: dict, public_key: Ed25519PublicKey) -> bool:
    """
    Verify signed LCE message

    Args:
        lce_dict: LCE dict with 'sig' field
        public_key: Ed25519 public key

    Returns:
        True if signature is valid, False otherwise
    """
    sig = lce_dict.get("sig")
    if not sig:
        return False

    try:
        # Parse JWS
        parts = sig.split(".")
        if len(parts) != 3:
            return False

        header_b64, payload_b64, signature_b64 = parts

        # Verify the payload matches current LCE data
        # Remove signature from lce_dict before canonicalizing
        lce_copy = {k: v for k, v in lce_dict.items() if k != "sig"}
        expected_payload = _canonicalize_json(lce_copy)

        # Decode payload from JWS
        payload_b64_padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        actual_payload = base64.urlsafe_b64decode(payload_b64_padded).decode("utf-8")

        # Check if payload matches (tamper detection)
        if actual_payload != expected_payload:
            return False

        # Reconstruct signing input
        signing_input = f"{header_b64}.{payload_b64}"

        # Decode signature
        # Add padding if needed
        signature_b64_padded = signature_b64 + "=" * (4 - len(signature_b64) % 4)
        signature = base64.urlsafe_b64decode(signature_b64_padded)

        # Verify signature
        public_key.verify(signature, signing_input.encode("utf-8"))
        return True

    except Exception:
        return False
