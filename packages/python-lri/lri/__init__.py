"""
python-lri: Python SDK for Liminal Resonance Interface

This package provides tools for working with LRI/LCE in Python applications.
"""

__version__ = "0.2.0"

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
from .lri import LRI
from .validator import validate_lce

# WebSocket Support
from . import ws

# LTP (Trust Protocol)
from . import ltp

# LSS (Session Store)
from .lss import LSS, CoherenceResult

# CBOR Encoding
from . import cbor

__all__ = [
    # Core types
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
    # Core classes
    "LRI",
    "validate_lce",
    # WebSocket
    "ws",
    # LTP
    "ltp",
    # LSS
    "LSS",
    "CoherenceResult",
    # CBOR
    "cbor",
]
