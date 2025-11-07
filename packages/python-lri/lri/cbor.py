"""
CBOR (Concise Binary Object Representation) encoding/decoding for LRI

Provides compact binary serialization for IoT devices with limited bandwidth.
"""

import cbor2
from typing import Optional

from .types import LCE


def encode_lce(lce: LCE) -> bytes:
    """
    Encode LCE to CBOR binary format

    Args:
        lce: LCE envelope to encode

    Returns:
        CBOR-encoded bytes
    """
    lce_dict = lce.model_dump(exclude_none=True)
    return cbor2.dumps(lce_dict)


def decode_lce(data: bytes) -> LCE:
    """
    Decode LCE from CBOR binary format

    Args:
        data: CBOR-encoded bytes

    Returns:
        Decoded LCE envelope

    Raises:
        ValueError: If data is invalid CBOR or doesn't match LCE schema
    """
    try:
        lce_dict = cbor2.loads(data)
    except Exception as e:
        raise ValueError(f"Invalid CBOR: {e}")

    if not isinstance(lce_dict, dict):
        raise ValueError("Invalid CBOR: not an object")

    # Validate LCE structure
    if not all(key in lce_dict for key in ["v", "intent", "policy"]):
        raise ValueError("Invalid LCE: missing required fields (v, intent, policy)")

    return LCE.model_validate(lce_dict)


def encode_frame(lce: LCE, payload: Optional[bytes] = None) -> bytes:
    """
    Encode WebSocket frame with CBOR payload

    Format: [4 bytes length][CBOR LCE][payload]

    Args:
        lce: LCE envelope
        payload: Optional binary payload

    Returns:
        Complete WebSocket frame
    """
    lce_bytes = encode_lce(lce)
    lce_length = len(lce_bytes)

    # Create length prefix (4 bytes, big-endian)
    length_prefix = lce_length.to_bytes(4, byteorder="big")

    # Combine: [length][LCE][payload]
    if payload:
        return length_prefix + lce_bytes + payload

    return length_prefix + lce_bytes


def decode_frame(frame: bytes) -> tuple[LCE, Optional[bytes]]:
    """
    Decode WebSocket frame with CBOR payload

    Args:
        frame: Complete WebSocket frame

    Returns:
        Tuple of (LCE, optional payload)

    Raises:
        ValueError: If frame is malformed
    """
    if len(frame) < 4:
        raise ValueError("Frame too short: missing length prefix")

    # Read length prefix
    lce_length = int.from_bytes(frame[:4], byteorder="big")

    if len(frame) < 4 + lce_length:
        raise ValueError(
            f"Frame too short: expected {4 + lce_length} bytes, got {len(frame)}"
        )

    # Extract LCE
    lce_bytes = frame[4 : 4 + lce_length]
    lce = decode_lce(lce_bytes)

    # Extract payload if present
    payload = frame[4 + lce_length :] if len(frame) > 4 + lce_length else None

    return lce, payload


def compare_sizes(lce: LCE) -> dict:
    """
    Calculate size savings of CBOR vs JSON

    Args:
        lce: LCE envelope

    Returns:
        Size comparison dict
    """
    import json

    json_size = len(json.dumps(lce.model_dump(exclude_none=True)))
    cbor_size = len(encode_lce(lce))
    savings = json_size - cbor_size
    savings_percent = round((savings / json_size) * 100, 2)

    return {
        "json": json_size,
        "cbor": cbor_size,
        "savings": savings,
        "savings_percent": savings_percent,
    }


def encode_batch(lces: list[LCE]) -> bytes:
    """
    Batch encode multiple LCE messages

    Useful for offline caching or bulk transmission.

    Args:
        lces: List of LCE envelopes

    Returns:
        Single CBOR buffer containing all messages
    """
    lce_dicts = [lce.model_dump(exclude_none=True) for lce in lces]
    return cbor2.dumps(lce_dicts)


def decode_batch(data: bytes) -> list[LCE]:
    """
    Batch decode multiple LCE messages

    Args:
        data: CBOR buffer containing multiple messages

    Returns:
        List of decoded LCE envelopes

    Raises:
        ValueError: If data is invalid
    """
    try:
        lce_dicts = cbor2.loads(data)
    except Exception as e:
        raise ValueError(f"Invalid CBOR: {e}")

    if not isinstance(lce_dicts, list):
        raise ValueError("Invalid CBOR batch: not an array")

    lces = []
    for i, lce_dict in enumerate(lce_dicts):
        if not all(key in lce_dict for key in ["v", "intent", "policy"]):
            raise ValueError(f"Invalid LCE at index {i}: missing required fields")
        lces.append(LCE.model_validate(lce_dict))

    return lces
