"""
python-lri: Python SDK for Liminal Resonance Interface

This package provides tools for working with LRI/LCE in Python applications.
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
from .lri import LRI
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
    "LRI",
    "validate_lce",
    "ltp",
    "lss",
]
