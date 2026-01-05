from __future__ import annotations

import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from lpi import (
    LCE,
    base64url_decode,
    base64url_encode,
    create_cose_sign1,
    deserialize_signed_lce,
    sign_lce,
    verify_cose_sign1,
    verify_signed_lce,
    cose_from_signed_lce,
)


def load_fixture() -> tuple[LCE, bytes, str]:
    fixture_path = (
        Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "lce-cose-vector.json"
    )
    fixture_data = json.loads(fixture_path.read_text())
    seed = bytes.fromhex(fixture_data["seed"])
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    lce = LCE.model_validate(fixture_data["lce"])
    expected_cose = fixture_data["expectedCose"]
    return lce, seed, expected_cose


def test_cose_sign1_matches_fixture():
    lce, seed, expected = load_fixture()
    cose, *_ = create_cose_sign1(lce, seed)
    encoded = base64url_encode(cose)
    if not expected:
        raise AssertionError(
            "Fixture missing expectedCose. Update tests/fixtures/lce-cose-vector.json with the generated value."
        )
    assert encoded == expected


def test_sign_and_verify_round_trip():
    lce, seed, expected = load_fixture()
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    signed = sign_lce(lce, seed)
    assert signed.sig == expected
    assert verify_signed_lce(signed, public_key)

    decoded, _ = deserialize_signed_lce(signed, public_key)
    assert decoded == lce


def test_verification_fails_when_payload_mutated():
    lce, seed, _ = load_fixture()
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    signed = sign_lce(lce, seed)
    signed.qos = None
    assert not verify_signed_lce(signed, public_key)


def test_cose_helpers_are_consistent():
    lce, seed, expected = load_fixture()
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    cose, *_ = create_cose_sign1(lce, seed, key_id=b"lpi-test")
    decoded, kid = verify_cose_sign1(cose, public_key)
    assert decoded == lce
    assert kid == b"lpi-test"

    signed = sign_lce(lce, seed)
    cose_blob = cose_from_signed_lce(signed)
    assert base64url_encode(cose_blob) == expected
    assert base64url_decode(signed.sig or "") == cose_blob
