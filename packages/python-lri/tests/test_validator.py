"""Tests for validator module"""

import pytest
from lri.validator import validate_lce, load_schema


class TestLoadSchema:
    """Tests for load_schema function"""

    def test_load_schema_returns_dict(self):
        """Schema should be loaded as a dictionary"""
        schema = load_schema()
        assert isinstance(schema, dict)
        assert "$id" in schema
        assert schema["$id"] == "https://lri.dev/schema/lce-v0.1.json"
        assert schema["title"] == "Liminal Context Envelope"

    def test_schema_has_required_fields(self):
        """Schema should define required fields"""
        schema = load_schema()
        assert "required" in schema
        assert "v" in schema["required"]
        assert "intent" in schema["required"]
        assert "policy" in schema["required"]


class TestValidateLCE:
    """Tests for validate_lce function"""

    def test_validate_minimal_valid_lce(self):
        """Minimal valid LCE should pass validation"""
        lce = {
            "v": 1,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
        }
        errors = validate_lce(lce)
        assert errors is None

    def test_validate_complete_lce(self):
        """Complete LCE with all fields should pass validation"""
        lce = {
            "v": 1,
            "intent": {"type": "tell", "goal": "Update status"},
            "affect": {"pad": [0.5, 0.3, 0.7], "tags": ["confident", "analytical"]},
            "meaning": {
                "topic": "system-status",
                "ontology": "https://schema.org/Status",
            },
            "trust": {"proof": "signature", "attest": ["issuer-1"]},
            "memory": {
                "thread": "550e8400-e29b-41d4-a716-446655440000",
                "t": "2024-01-15T10:30:00Z",
                "ttl": "PT1H",
            },
            "policy": {
                "consent": "team",
                "share": ["analytics@example.com"],
                "dp": "epsilon=0.1",
            },
            "qos": {"coherence": 0.95, "stability": "high"},
            "trace": {"hop": 2, "provenance": ["service-a", "service-b"]},
            "sig": "eyJhbGciOiJFZERTQSJ9...",
        }
        errors = validate_lce(lce)
        assert errors is None

    def test_missing_version(self):
        """Missing version field should fail validation"""
        lce = {"intent": {"type": "ask"}, "policy": {"consent": "private"}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/v" for e in errors)

    def test_wrong_version(self):
        """Wrong version number should fail validation"""
        lce = {
            "v": 2,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/v" and "1" in e["message"] for e in errors)

    def test_missing_intent(self):
        """Missing intent field should fail validation"""
        lce = {"v": 1, "policy": {"consent": "private"}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/intent" for e in errors)

    def test_intent_not_object(self):
        """Intent must be an object"""
        lce = {"v": 1, "intent": "ask", "policy": {"consent": "private"}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/intent" for e in errors)

    def test_missing_intent_type(self):
        """Intent must have a type field"""
        lce = {"v": 1, "intent": {}, "policy": {"consent": "private"}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/intent/type" for e in errors)

    def test_invalid_intent_type(self):
        """Invalid intent type should fail validation"""
        lce = {
            "v": 1,
            "intent": {"type": "invalid"},
            "policy": {"consent": "private"},
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/intent/type" for e in errors)

    def test_all_valid_intent_types(self):
        """All valid intent types should pass"""
        valid_intents = [
            "ask",
            "tell",
            "propose",
            "confirm",
            "notify",
            "sync",
            "plan",
            "agree",
            "disagree",
            "reflect",
        ]
        for intent_type in valid_intents:
            lce = {
                "v": 1,
                "intent": {"type": intent_type},
                "policy": {"consent": "private"},
            }
            errors = validate_lce(lce)
            assert errors is None, f"Intent type '{intent_type}' should be valid"

    def test_missing_policy(self):
        """Missing policy field should fail validation"""
        lce = {"v": 1, "intent": {"type": "ask"}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/policy" for e in errors)

    def test_policy_not_object(self):
        """Policy must be an object"""
        lce = {"v": 1, "intent": {"type": "ask"}, "policy": "private"}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/policy" for e in errors)

    def test_missing_consent(self):
        """Policy must have consent field"""
        lce = {"v": 1, "intent": {"type": "ask"}, "policy": {}}
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/policy/consent" for e in errors)

    def test_invalid_consent_level(self):
        """Invalid consent level should fail validation"""
        lce = {
            "v": 1,
            "intent": {"type": "ask"},
            "policy": {"consent": "invalid"},
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/policy/consent" for e in errors)

    def test_all_valid_consent_levels(self):
        """All valid consent levels should pass"""
        for consent in ["private", "team", "public"]:
            lce = {
                "v": 1,
                "intent": {"type": "ask"},
                "policy": {"consent": consent},
            }
            errors = validate_lce(lce)
            assert errors is None, f"Consent level '{consent}' should be valid"

    def test_pad_not_array(self):
        """PAD must be an array"""
        lce = {
            "v": 1,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
            "affect": {"pad": "not-an-array"},
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/affect/pad" for e in errors)

    def test_pad_wrong_length(self):
        """PAD must have exactly 3 elements"""
        lce = {
            "v": 1,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
            "affect": {"pad": [0.5, 0.5]},
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert any(e["path"] == "/affect/pad" and "3" in e["message"] for e in errors)

    def test_pad_values_out_of_range(self):
        """PAD values must be in range [-1, 1]"""
        test_cases = [
            [1.5, 0, 0],  # > 1
            [0, -1.5, 0],  # < -1
            [0, 0, 2],  # > 1
        ]
        for pad in test_cases:
            lce = {
                "v": 1,
                "intent": {"type": "ask"},
                "policy": {"consent": "private"},
                "affect": {"pad": pad},
            }
            errors = validate_lce(lce)
            assert errors is not None, f"PAD {pad} should fail validation"
            assert any(
                e["path"] == "/affect/pad" and "range" in e["message"].lower()
                for e in errors
            )

    def test_pad_valid_edge_cases(self):
        """PAD boundary values should be valid"""
        test_cases = [
            [-1, -1, -1],
            [1, 1, 1],
            [0, 0, 0],
            [-1, 0, 1],
        ]
        for pad in test_cases:
            lce = {
                "v": 1,
                "intent": {"type": "ask"},
                "policy": {"consent": "private"},
                "affect": {"pad": pad},
            }
            errors = validate_lce(lce)
            assert errors is None, f"PAD {pad} should be valid"

    def test_coherence_out_of_range(self):
        """Coherence must be in range [0, 1]"""
        test_cases = [-0.1, 1.5, 2]
        for coherence in test_cases:
            lce = {
                "v": 1,
                "intent": {"type": "ask"},
                "policy": {"consent": "private"},
                "qos": {"coherence": coherence},
            }
            errors = validate_lce(lce)
            assert errors is not None, f"Coherence {coherence} should fail validation"
            assert any(
                e["path"] == "/qos/coherence" and "range" in e["message"].lower()
                for e in errors
            )

    def test_coherence_valid_edge_cases(self):
        """Coherence boundary values should be valid"""
        for coherence in [0, 0.5, 1]:
            lce = {
                "v": 1,
                "intent": {"type": "ask"},
                "policy": {"consent": "private"},
                "qos": {"coherence": coherence},
            }
            errors = validate_lce(lce)
            assert errors is None, f"Coherence {coherence} should be valid"

    def test_multiple_errors(self):
        """Multiple validation errors should all be reported"""
        lce = {
            "v": 2,  # Wrong version
            "intent": {"type": "invalid"},  # Invalid intent
            "policy": {"consent": "wrong"},  # Invalid consent
        }
        errors = validate_lce(lce)
        assert errors is not None
        assert len(errors) >= 3
        paths = [e["path"] for e in errors]
        assert "/v" in paths
        assert "/intent/type" in paths
        assert "/policy/consent" in paths
