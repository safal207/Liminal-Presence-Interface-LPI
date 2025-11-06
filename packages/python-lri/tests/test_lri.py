"""Tests for LRI FastAPI integration"""

import base64
import json
import pytest
from fastapi import HTTPException, Request
from lri.lri import LRI
from lri.types import LCE, Intent, Policy


class MockRequest:
    """Mock FastAPI Request for testing"""

    def __init__(self, headers: dict = None):
        self.headers = headers or {}


class TestLRIInit:
    """Tests for LRI initialization"""

    def test_default_initialization(self):
        """LRI should initialize with defaults"""
        lri = LRI()
        assert lri.header_name == "LCE"
        assert lri.validate is True

    def test_custom_header_name(self):
        """LRI should accept custom header name"""
        lri = LRI(header_name="X-Custom-LCE")
        assert lri.header_name == "X-Custom-LCE"

    def test_validation_can_be_disabled(self):
        """LRI should allow disabling validation"""
        lri = LRI(validate=False)
        assert lri.validate is False


class TestLRICreateHeader:
    """Tests for create_header static method"""

    def test_create_header_basic(self):
        """create_header should create valid base64 header"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        header = LRI.create_header(lce)

        # Verify it's valid base64
        assert isinstance(header, str)
        decoded = base64.b64decode(header).decode("utf-8")
        data = json.loads(decoded)

        assert data["v"] == 1
        assert data["intent"]["type"] == "ask"
        assert data["policy"]["consent"] == "private"

    def test_create_header_excludes_none(self):
        """create_header should exclude None values"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        header = LRI.create_header(lce)

        decoded = base64.b64decode(header).decode("utf-8")
        data = json.loads(decoded)

        # Optional fields should not be present
        assert "affect" not in data
        assert "meaning" not in data
        assert "trust" not in data

    def test_create_header_with_all_fields(self):
        """create_header should handle LCE with all fields"""
        lce = LCE(
            v=1,
            intent=Intent(type="tell", goal="Test"),
            policy=Policy(consent="public"),
            sig="signature-data",
        )
        header = LRI.create_header(lce)

        decoded = base64.b64decode(header).decode("utf-8")
        data = json.loads(decoded)

        assert data["intent"]["goal"] == "Test"
        assert data["sig"] == "signature-data"

    def test_create_header_unicode(self):
        """create_header should handle unicode characters"""
        lce = LCE(
            v=1,
            intent=Intent(type="tell", goal="日本語テスト 🚀"),
            policy=Policy(consent="private"),
        )
        header = LRI.create_header(lce)

        decoded = base64.b64decode(header).decode("utf-8")
        data = json.loads(decoded)

        assert data["intent"]["goal"] == "日本語テスト 🚀"


class TestLRIParseRequest:
    """Tests for parse_request method"""

    @pytest.mark.asyncio
    async def test_parse_valid_lce(self):
        """parse_request should parse valid LCE header"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        header = LRI.create_header(lce)

        request = MockRequest(headers={"LCE": header})
        lri = LRI()

        result = await lri.parse_request(request)

        assert result is not None
        assert result.v == 1
        assert result.intent.type == "ask"
        assert result.policy.consent == "private"

    @pytest.mark.asyncio
    async def test_parse_request_no_header_not_required(self):
        """parse_request should return None when header missing and not required"""
        request = MockRequest(headers={})
        lri = LRI()

        result = await lri.parse_request(request, required=False)
        assert result is None

    @pytest.mark.asyncio
    async def test_parse_request_no_header_required(self):
        """parse_request should raise 428 when header missing and required"""
        request = MockRequest(headers={})
        lri = LRI()

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request, required=True)

        assert exc_info.value.status_code == 428
        assert "LCE header required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_parse_request_malformed_base64(self):
        """parse_request should raise 400 for malformed base64"""
        request = MockRequest(headers={"LCE": "not-valid-base64!!!"})
        lri = LRI()

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        assert exc_info.value.status_code == 400
        assert "Malformed LCE header" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_parse_request_invalid_json(self):
        """parse_request should raise 400 for invalid JSON"""
        invalid_json = base64.b64encode(b"{ invalid json }").decode("utf-8")
        request = MockRequest(headers={"LCE": invalid_json})
        lri = LRI()

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_parse_request_validation_failure(self):
        """parse_request should raise 422 for schema validation failure"""
        invalid_lce = {
            "v": 1,
            "intent": {"type": "invalid-intent"},
            "policy": {"consent": "private"},
        }
        header = base64.b64encode(json.dumps(invalid_lce).encode("utf-8")).decode(
            "utf-8"
        )
        request = MockRequest(headers={"LCE": header})
        lri = LRI(validate=True)

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        assert exc_info.value.status_code == 422
        assert "Invalid LCE" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_parse_request_skip_validation(self):
        """parse_request should skip validation when disabled"""
        # This LCE is invalid but should pass if validation is disabled
        invalid_lce = {
            "v": 1,
            "intent": {"type": "invalid-intent"},
            "policy": {"consent": "private"},
        }
        header = base64.b64encode(json.dumps(invalid_lce).encode("utf-8")).decode(
            "utf-8"
        )
        request = MockRequest(headers={"LCE": header})
        lri = LRI(validate=False)

        # Should still fail at Pydantic validation level
        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        # Pydantic validation happens after schema validation
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_parse_request_custom_header_name(self):
        """parse_request should use custom header name"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        header = LRI.create_header(lce)

        request = MockRequest(headers={"X-Custom-LCE": header})
        lri = LRI(header_name="X-Custom-LCE")

        result = await lri.parse_request(request)

        assert result is not None
        assert result.intent.type == "ask"

    @pytest.mark.asyncio
    async def test_parse_request_with_complete_lce(self):
        """parse_request should handle LCE with all optional fields"""
        lce = LCE(
            v=1,
            intent=Intent(type="tell", goal="Update"),
            policy=Policy(consent="team", share=["analytics@example.com"]),
        )
        header = LRI.create_header(lce)

        request = MockRequest(headers={"LCE": header})
        lri = LRI()

        result = await lri.parse_request(request)

        assert result is not None
        assert result.intent.goal == "Update"
        assert result.policy.share == ["analytics@example.com"]

    @pytest.mark.asyncio
    async def test_parse_request_missing_required_field(self):
        """parse_request should raise 422 for missing required fields"""
        incomplete = {
            "v": 1,
            "intent": {"type": "ask"},
            # Missing required 'policy' field
        }
        header = base64.b64encode(json.dumps(incomplete).encode("utf-8")).decode(
            "utf-8"
        )
        request = MockRequest(headers={"LCE": header})
        lri = LRI()

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_parse_request_wrong_version(self):
        """parse_request should raise 422 for wrong version"""
        wrong_version = {
            "v": 2,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
        }
        header = base64.b64encode(json.dumps(wrong_version).encode("utf-8")).decode(
            "utf-8"
        )
        request = MockRequest(headers={"LCE": header})
        lri = LRI()

        with pytest.raises(HTTPException) as exc_info:
            await lri.parse_request(request)

        assert exc_info.value.status_code == 422


class TestLRIRoundTrip:
    """Tests for round-trip encoding/decoding"""

    @pytest.mark.asyncio
    async def test_round_trip_minimal(self):
        """LCE should survive round-trip encoding/decoding"""
        original = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )

        # Encode
        header = LRI.create_header(original)

        # Decode
        request = MockRequest(headers={"LCE": header})
        lri = LRI()
        result = await lri.parse_request(request)

        # Compare
        assert result.v == original.v
        assert result.intent.type == original.intent.type
        assert result.policy.consent == original.policy.consent

    @pytest.mark.asyncio
    async def test_round_trip_complete(self):
        """Complete LCE should survive round-trip"""
        original = LCE(
            v=1,
            intent=Intent(type="tell", goal="Test goal"),
            policy=Policy(consent="public", share=["user@example.com"]),
            sig="test-signature",
        )

        header = LRI.create_header(original)
        request = MockRequest(headers={"LCE": header})
        lri = LRI()
        result = await lri.parse_request(request)

        assert result.intent.goal == original.intent.goal
        assert result.policy.share == original.policy.share
        assert result.sig == original.sig
