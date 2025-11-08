"""JSON Canonicalization utilities for LTP."""

from __future__ import annotations

from typing import Any

import jcs


def canonicalize_ltp_payload(value: Any) -> str:
    """Return the RFC 8785 canonical JSON encoding of *value*."""

    canonical = jcs.canonicalize(value)
    if isinstance(canonical, bytes):
        return canonical.decode("utf-8")
    if isinstance(canonical, str):
        return canonical
    raise TypeError("jcs.canonicalize returned unsupported type")


__all__ = ["canonicalize_ltp_payload"]
