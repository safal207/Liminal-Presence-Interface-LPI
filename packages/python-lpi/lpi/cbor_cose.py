"""CBOR + COSE helpers for LCE envelopes."""

from __future__ import annotations

import base64
from typing import Any, Mapping, MutableMapping, Optional, Tuple

import cbor2
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from .types import LCE

COSE_ALG_EDDSA = -8
COSE_CONTEXT = "Signature1"
COSE_HEADER_ALG = 1
COSE_HEADER_KID = 4


class CoseError(ValueError):
    """Raised when COSE encoding or verification fails."""


def _to_bytes(value: Optional[bytes | bytearray | memoryview | str]) -> Optional[bytes]:
    if value is None:
        return None
    if isinstance(value, str):
        return value.encode("utf-8")
    return bytes(value)


def _clean_value(value: Any) -> Any | None:
    if value is None:
        return None

    if isinstance(value, list):
        cleaned_list = [item for item in (_clean_value(v) for v in value) if item is not None]
        return cleaned_list

    if isinstance(value, tuple):
        cleaned_tuple = tuple(item for item in (_clean_value(v) for v in value) if item is not None)
        return cleaned_tuple

    if isinstance(value, Mapping):
        cleaned_map: MutableMapping[str, Any] = {}
        for key, val in value.items():
            cleaned = _clean_value(val)
            if cleaned is not None:
                cleaned_map[str(key)] = cleaned
        return cleaned_map

    return value


def _normalize_lce(lce: LCE | Mapping[str, Any]) -> Mapping[str, Any]:
    if isinstance(lce, LCE):
        raw = lce.model_dump(mode="python", exclude_none=True)
    else:
        raw = {str(k): v for k, v in lce.items() if v is not None}

    raw.pop("sig", None)

    normalized: MutableMapping[str, Any] = {}
    for key, value in raw.items():
        cleaned = _clean_value(value)
        if cleaned is not None:
            normalized[key] = cleaned
    return normalized


def _encode_protected_header(key_id: Optional[bytes | str]) -> bytes:
    header: dict[int, Any] = {COSE_HEADER_ALG: COSE_ALG_EDDSA}
    key_bytes = _to_bytes(key_id)
    if key_bytes:
        header[COSE_HEADER_KID] = key_bytes
    return cbor2.dumps(header, canonical=True)


def _normalize_private_key(private_key: bytes | bytearray | memoryview) -> Ed25519PrivateKey:
    key_bytes = bytes(private_key)
    if len(key_bytes) == 64:
        key_bytes = key_bytes[:32]
    if len(key_bytes) != 32:
        raise ValueError("Ed25519 private key must be 32 or 64 bytes")
    return Ed25519PrivateKey.from_private_bytes(key_bytes)


def _normalize_public_key(public_key: bytes | bytearray | memoryview) -> Ed25519PublicKey:
    key_bytes = bytes(public_key)
    if len(key_bytes) != 32:
        raise ValueError("Ed25519 public key must be 32 bytes")
    return Ed25519PublicKey.from_public_bytes(key_bytes)


def _encode_sig_structure(
    protected_header: bytes, external_aad: bytes, payload: bytes
) -> bytes:
    return cbor2.dumps([COSE_CONTEXT, protected_header, external_aad, payload], canonical=True)


def _parse_cose_sign1(cose: bytes) -> Tuple[bytes, dict[int, Any], bytes, bytes]:
    decoded = cbor2.loads(cose)
    if not isinstance(decoded, list) or len(decoded) != 4:
        raise CoseError("Invalid COSE_Sign1 structure")

    protected, unprotected, payload, signature = decoded

    if not isinstance(protected, (bytes, bytearray)):
        raise CoseError("COSE protected header must be bytes")
    if not isinstance(payload, (bytes, bytearray)):
        raise CoseError("COSE payload must be bytes")
    if not isinstance(signature, (bytes, bytearray)):
        raise CoseError("COSE signature must be bytes")
    if unprotected is not None and not isinstance(unprotected, Mapping):
        raise CoseError("COSE unprotected header must be a map")

    header_map = cbor2.loads(bytes(protected))
    if header_map.get(COSE_HEADER_ALG) != COSE_ALG_EDDSA:
        raise CoseError("Unsupported COSE algorithm")

    return bytes(protected), header_map, bytes(payload), bytes(signature)


def encode_lce_cbor(lce: LCE | Mapping[str, Any]) -> bytes:
    """Encode an LCE envelope (sans signature) into canonical CBOR."""

    normalized = _normalize_lce(lce)
    return cbor2.dumps(normalized, canonical=True)


def create_cose_sign1(
    lce: LCE | Mapping[str, Any],
    private_key: bytes | bytearray | memoryview,
    *,
    key_id: Optional[bytes | str] = None,
    external_aad: Optional[bytes | bytearray | memoryview] = None,
) -> Tuple[bytes, bytes, bytes, bytes]:
    """Create a COSE_Sign1 envelope for the provided LCE."""

    payload = encode_lce_cbor(lce)
    protected_header = _encode_protected_header(key_id)
    aad = _to_bytes(external_aad) or b""
    sig_structure = _encode_sig_structure(protected_header, aad, payload)
    signer = _normalize_private_key(private_key)
    signature = signer.sign(sig_structure)
    cose = cbor2.dumps([protected_header, {}, payload, signature], canonical=True)
    return cose, payload, protected_header, signature


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def base64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - (len(value) % 4)) % 4)
    return base64.urlsafe_b64decode(value + padding)


def sign_lce(
    lce: LCE | Mapping[str, Any],
    private_key: bytes | bytearray | memoryview,
    *,
    key_id: Optional[bytes | str] = None,
    external_aad: Optional[bytes | bytearray | memoryview] = None,
) -> LCE:
    cose, _, _, _ = create_cose_sign1(lce, private_key, key_id=key_id, external_aad=external_aad)
    payload = _normalize_lce(lce)
    payload_with_sig = dict(payload)
    payload_with_sig["sig"] = base64url_encode(cose)
    return LCE.model_validate(payload_with_sig)


def decode_cose_sign1(cose: bytes) -> Tuple[LCE, Optional[bytes]]:
    protected_header, header_map, payload, _ = _parse_cose_sign1(cose)
    _ = protected_header  # maintained for parity with TypeScript implementation
    decoded = cbor2.loads(payload)
    if not isinstance(decoded, Mapping):
        raise CoseError("COSE payload must decode to a map")
    return LCE.model_validate(decoded), header_map.get(COSE_HEADER_KID)


def verify_cose_sign1(
    cose: bytes,
    public_key: bytes | bytearray | memoryview,
    *,
    external_aad: Optional[bytes | bytearray | memoryview] = None,
) -> Tuple[LCE, Optional[bytes]]:
    protected_header, header_map, payload, signature = _parse_cose_sign1(cose)
    aad = _to_bytes(external_aad) or b""
    sig_structure = _encode_sig_structure(protected_header, aad, payload)
    verifier = _normalize_public_key(public_key)

    try:
        verifier.verify(signature, sig_structure)
    except InvalidSignature as exc:  # pragma: no cover - exercised in tests
        raise CoseError("Invalid COSE signature") from exc

    decoded = cbor2.loads(payload)
    if not isinstance(decoded, Mapping):
        raise CoseError("COSE payload must decode to a map")

    return LCE.model_validate(decoded), header_map.get(COSE_HEADER_KID)


def verify_signed_lce(
    lce: LCE,
    public_key: bytes | bytearray | memoryview,
    *,
    external_aad: Optional[bytes | bytearray | memoryview] = None,
) -> bool:
    if lce.sig is None:
        raise CoseError("Missing sig field on LCE")

    cose = base64url_decode(lce.sig)
    _, _, payload, _ = _parse_cose_sign1(cose)
    expected_payload = encode_lce_cbor(lce)
    if payload != expected_payload:
        return False

    try:
        verify_cose_sign1(cose, public_key, external_aad=external_aad)
        return True
    except CoseError:
        return False


def deserialize_signed_lce(
    lce: LCE,
    public_key: Optional[bytes | bytearray | memoryview] = None,
    *,
    external_aad: Optional[bytes | bytearray | memoryview] = None,
) -> Tuple[LCE, Optional[bytes]]:
    if lce.sig is None:
        raise CoseError("Missing sig field on LCE")

    cose = base64url_decode(lce.sig)
    if public_key is None:
        return decode_cose_sign1(cose)
    return verify_cose_sign1(cose, public_key, external_aad=external_aad)


def cose_from_signed_lce(lce: LCE) -> bytes:
    if lce.sig is None:
        raise CoseError("Missing sig field on LCE")
    return base64url_decode(lce.sig)

