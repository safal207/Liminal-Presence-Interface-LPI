"""
python-lpi: Python SDK for Liminal Presence Interface

This package provides tools for working with LPI/LCE in Python applications.
"""

__version__ = "0.1.0"

from .types import (
    LCE,
    Intent,
    Affect,
    Meaning,
    Trust,
    Memory,
    Policy,
    QoS,
    Trace,
    IntentType,
    ConsentLevel,
)
from . import ltp
from . import lss
from .cbor_cose import (
    CoseError,
    base64url_decode,
    base64url_encode,
    cose_from_signed_lce,
    create_cose_sign1,
    decode_cose_sign1,
    deserialize_signed_lce,
    encode_lce_cbor,
    sign_lce,
    verify_cose_sign1,
    verify_signed_lce,
)
from .lpi import LPI
from .validator import validate_lce

__all__ = [
    "LCE",
    "Intent",
    "Affect",
    "Meaning",
    "Trust",
    "Memory",
    "Policy",
    "QoS",
    "Trace",
    "IntentType",
    "ConsentLevel",
    "LPI",
    "validate_lce",
    "ltp",
    "lss",
    "encode_lce_cbor",
    "create_cose_sign1",
    "sign_lce",
    "verify_cose_sign1",
    "verify_signed_lce",
    "decode_cose_sign1",
    "deserialize_signed_lce",
    "cose_from_signed_lce",
    "base64url_encode",
    "base64url_decode",
    "CoseError",
]
