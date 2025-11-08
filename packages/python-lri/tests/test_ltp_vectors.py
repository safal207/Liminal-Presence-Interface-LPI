"""Cross-language LTP fixtures shared with the Node SDK."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from lri.ltp import (
    canonicalize_ltp_payload,
    jwk_to_key_pair,
    sign_canonical_base64,
    verify_canonical_base64,
)


FIXTURE_PATH = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "ltp" / "vectors.json"


with FIXTURE_PATH.open("r", encoding="utf-8") as fp:
    VECTORS = json.load(fp)["vectors"]


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["name"])
def test_canonicalization_matches_fixture(vector):
    assert canonicalize_ltp_payload(vector["lce"]) == vector["canonical"]


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["name"])
def test_signature_matches_fixture(vector):
    keys = jwk_to_key_pair(vector["key"]["jwk"])
    assert (
        sign_canonical_base64(vector["canonical"], keys.private_key)
        == vector["signature"]
    )


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["name"])
def test_signature_verifies(vector):
    keys = jwk_to_key_pair(vector["key"]["jwk"])
    assert verify_canonical_base64(
        vector["canonical"], vector["signature"], keys.public_key
    )
