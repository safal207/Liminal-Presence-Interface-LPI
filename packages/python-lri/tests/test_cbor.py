"""
Tests for CBOR encoding/decoding
"""

import pytest
from lri import LCE, Intent, Affect, Meaning, Memory, Policy, QoS, cbor


def test_encode_decode_simple_lce():
    """Test encoding and decoding simple LCE"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )

    # Encode
    encoded = cbor.encode_lce(lce)
    assert isinstance(encoded, bytes)
    assert len(encoded) > 0

    # Decode
    decoded = cbor.decode_lce(encoded)
    assert decoded.v == lce.v
    assert decoded.intent.type == lce.intent.type
    assert decoded.policy.consent == lce.policy.consent


def test_encode_decode_full_lce():
    """Test encoding and decoding LCE with all fields"""
    lce = LCE(
        v=1,
        intent=Intent(type="ask", goal="Get weather information"),
        affect=Affect(pad=(0.3, 0.2, 0.1), tags=["curious", "casual"]),
        meaning=Meaning(topic="weather", ontology="https://schema.org/WeatherForecast"),
        memory=Memory(thread="550e8400-e29b-41d4-a716-446655440000", t="2025-01-15T10:30:00Z"),
        policy=Policy(consent="private"),
        qos=QoS(coherence=0.87),
    )

    encoded = cbor.encode_lce(lce)
    decoded = cbor.decode_lce(encoded)

    assert decoded.v == lce.v
    assert decoded.intent.type == lce.intent.type
    assert decoded.intent.goal == lce.intent.goal
    assert decoded.affect.pad == lce.affect.pad
    assert decoded.meaning.topic == lce.meaning.topic
    assert decoded.policy.consent == lce.policy.consent


def test_decode_invalid_cbor():
    """Test decoding invalid CBOR raises error"""
    invalid_data = b"\xff\xff\xff"

    with pytest.raises(ValueError, match="Invalid CBOR"):
        cbor.decode_lce(invalid_data)


def test_decode_non_lce_cbor():
    """Test decoding valid CBOR but not LCE raises error"""
    import cbor2

    non_lce = {"foo": "bar"}
    encoded = cbor2.dumps(non_lce)

    with pytest.raises(ValueError, match="Invalid LCE"):
        cbor.decode_lce(encoded)


def test_encode_decode_frame_without_payload():
    """Test frame encoding without payload"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )

    frame = cbor.encode_frame(lce)
    assert isinstance(frame, bytes)
    assert len(frame) >= 4  # At least length prefix

    # Check length prefix
    lce_length = int.from_bytes(frame[:4], byteorder="big")
    assert lce_length > 0

    # Decode
    decoded_lce, payload = cbor.decode_frame(frame)
    assert decoded_lce.v == lce.v
    assert payload is None


def test_encode_decode_frame_with_payload():
    """Test frame encoding with payload"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )
    payload_data = b"Hello, world!"

    frame = cbor.encode_frame(lce, payload_data)
    decoded_lce, decoded_payload = cbor.decode_frame(frame)

    assert decoded_lce.v == lce.v
    assert decoded_payload == payload_data


def test_decode_frame_too_short():
    """Test decoding frame that's too short raises error"""
    short_frame = b"\x01\x02"

    with pytest.raises(ValueError, match="Frame too short"):
        cbor.decode_frame(short_frame)


def test_compare_sizes():
    """Test CBOR is smaller than JSON"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )

    sizes = cbor.compare_sizes(lce)

    assert sizes["json"] > 0
    assert sizes["cbor"] > 0
    assert sizes["cbor"] < sizes["json"]  # CBOR should be smaller
    assert sizes["savings"] > 0
    assert sizes["savings_percent"] > 0


def test_encode_decode_batch():
    """Test batch encoding and decoding"""
    lces = [
        LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="tell"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="confirm"), policy=Policy(consent="private")),
    ]

    encoded = cbor.encode_batch(lces)
    assert isinstance(encoded, bytes)

    decoded = cbor.decode_batch(encoded)
    assert len(decoded) == 3
    assert decoded[0].intent.type == "ask"
    assert decoded[1].intent.type == "tell"
    assert decoded[2].intent.type == "confirm"


def test_decode_batch_empty():
    """Test decoding empty batch"""
    encoded = cbor.encode_batch([])
    decoded = cbor.decode_batch(encoded)
    assert decoded == []


def test_decode_batch_not_array():
    """Test decoding non-array batch raises error"""
    import cbor2

    not_array = {"foo": "bar"}
    encoded = cbor2.dumps(not_array)

    with pytest.raises(ValueError, match="not an array"):
        cbor.decode_batch(encoded)


def test_decode_batch_invalid_lce():
    """Test decoding batch with invalid LCE raises error"""
    import cbor2

    invalid_batch = [{"foo": "bar"}]
    encoded = cbor2.dumps(invalid_batch)

    with pytest.raises(ValueError, match="Invalid LCE at index"):
        cbor.decode_batch(encoded)


def test_cbor_preserves_numbers():
    """Test CBOR preserves number accuracy"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        affect=Affect(pad=(0.123456789, -0.987654321, 0.5), tags=[]),
        policy=Policy(consent="private"),
        qos=QoS(coherence=0.87654321),
    )

    encoded = cbor.encode_lce(lce)
    decoded = cbor.decode_lce(encoded)

    assert abs(decoded.affect.pad[0] - 0.123456789) < 1e-6
    assert abs(decoded.affect.pad[1] - (-0.987654321)) < 1e-6
    assert abs(decoded.qos.coherence - 0.87654321) < 1e-6


def test_cbor_preserves_unicode():
    """Test CBOR preserves Unicode strings"""
    lce = LCE(
        v=1,
        intent=Intent(type="tell", goal="Получить прогноз погоды 🌤️"),
        meaning=Meaning(topic="天气预报"),
        policy=Policy(consent="private"),
    )

    encoded = cbor.encode_lce(lce)
    decoded = cbor.decode_lce(encoded)

    assert decoded.intent.goal == "Получить прогноз погоды 🌤️"
    assert decoded.meaning.topic == "天气预报"
