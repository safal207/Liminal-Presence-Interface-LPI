"""
Tests for LTP (Liminal Trust Protocol) - Cryptographic signing
"""

import pytest
from lri import LCE, Intent, Policy, ltp


def test_generate_keys():
    """Test Ed25519 key generation"""
    private_key, public_key = ltp.generate_keys()

    assert private_key is not None
    assert public_key is not None


def test_export_import_private_key():
    """Test private key export and import"""
    private_key, _ = ltp.generate_keys()

    # Export to PEM
    pem = ltp.export_private_key_pem(private_key)
    assert "BEGIN PRIVATE KEY" in pem

    # Import from PEM
    imported = ltp.import_private_key_pem(pem)
    assert imported is not None


def test_export_import_public_key():
    """Test public key export and import"""
    _, public_key = ltp.generate_keys()

    # Export to PEM
    pem = ltp.export_public_key_pem(public_key)
    assert "BEGIN PUBLIC KEY" in pem

    # Import from PEM
    imported = ltp.import_public_key_pem(pem)
    assert imported is not None


def test_sign_lce():
    """Test LCE signing"""
    private_key, _ = ltp.generate_keys()

    lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Test message"),
        policy=Policy(consent="private"),
    )

    # Sign
    signed = ltp.sign(lce, private_key)

    assert "sig" in signed
    assert signed["sig"].count(".") == 2  # JWS format: header.payload.signature


def test_verify_valid_signature():
    """Test verification of valid signature"""
    private_key, public_key = ltp.generate_keys()

    lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Test message"),
        policy=Policy(consent="private"),
    )

    # Sign and verify
    signed = ltp.sign(lce, private_key)
    is_valid = ltp.verify(signed, public_key)

    assert is_valid is True


def test_verify_invalid_signature():
    """Test verification fails with wrong key"""
    private_key1, _ = ltp.generate_keys()
    _, public_key2 = ltp.generate_keys()

    lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Test message"),
        policy=Policy(consent="private"),
    )

    # Sign with key1, verify with key2
    signed = ltp.sign(lce, private_key1)
    is_valid = ltp.verify(signed, public_key2)

    assert is_valid is False


def test_verify_tampered_message():
    """Test verification fails with tampered message"""
    private_key, public_key = ltp.generate_keys()

    lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Original message"),
        policy=Policy(consent="private"),
    )

    # Sign
    signed = ltp.sign(lce, private_key)

    # Tamper with message
    signed["intent"]["goal"] = "Tampered message"

    # Verify should fail
    is_valid = ltp.verify(signed, public_key)
    assert is_valid is False


def test_verify_missing_signature():
    """Test verification fails when signature is missing"""
    _, public_key = ltp.generate_keys()

    lce_dict = {
        "v": 1,
        "intent": {"type": "tell"},
        "policy": {"consent": "private"},
    }

    is_valid = ltp.verify(lce_dict, public_key)
    assert is_valid is False


def test_sign_preserves_lce_fields():
    """Test that signing preserves all LCE fields"""
    private_key, _ = ltp.generate_keys()

    lce = LCE(
        v=1,
        intent=Intent(type="ask", goal="Get weather"),
        affect={"pad": (0.5, 0.3, 0.2), "tags": ["curious"]},
        meaning={"topic": "weather"},
        policy=Policy(consent="private"),
    )

    signed = ltp.sign(lce, private_key)

    assert signed["v"] == 1
    assert signed["intent"]["type"] == "ask"
    assert signed["intent"]["goal"] == "Get weather"
    assert signed["affect"]["pad"] == (0.5, 0.3, 0.2)
    assert signed["meaning"]["topic"] == "weather"
    assert signed["policy"]["consent"] == "private"
