"""Tests for types module (Pydantic models)"""

import pytest
from pydantic import ValidationError
from lri.types import (
    LCE,
    Intent,
    Affect,
    Meaning,
    Trust,
    Memory,
    Policy,
    QoS,
    Trace,
)


class TestIntent:
    """Tests for Intent model"""

    def test_minimal_intent(self):
        """Intent with just type should be valid"""
        intent = Intent(type="ask")
        assert intent.type == "ask"
        assert intent.goal is None

    def test_intent_with_goal(self):
        """Intent with goal should be valid"""
        intent = Intent(type="tell", goal="Provide information")
        assert intent.type == "tell"
        assert intent.goal == "Provide information"

    def test_all_valid_intent_types(self):
        """All valid intent types should work"""
        valid_types = [
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
        for intent_type in valid_types:
            intent = Intent(type=intent_type)
            assert intent.type == intent_type

    def test_invalid_intent_type(self):
        """Invalid intent type should raise ValidationError"""
        with pytest.raises(ValidationError):
            Intent(type="invalid")


class TestAffect:
    """Tests for Affect model"""

    def test_empty_affect(self):
        """Empty affect should be valid"""
        affect = Affect()
        assert affect.pad is None
        assert affect.tags is None

    def test_affect_with_pad(self):
        """Affect with PAD values should be valid"""
        affect = Affect(pad=(0.5, 0.3, 0.7))
        assert affect.pad == (0.5, 0.3, 0.7)

    def test_affect_with_tags(self):
        """Affect with tags should be valid"""
        affect = Affect(tags=["curious", "confident"])
        assert affect.tags == ["curious", "confident"]

    def test_pad_boundary_values(self):
        """PAD boundary values should be valid"""
        test_cases = [(-1, -1, -1), (1, 1, 1), (0, 0, 0), (-1, 0, 1)]
        for pad in test_cases:
            affect = Affect(pad=pad)
            assert affect.pad == pad

    def test_pad_out_of_range(self):
        """PAD values out of range should fail"""
        with pytest.raises(ValidationError):
            Affect(pad=(1.5, 0, 0))
        with pytest.raises(ValidationError):
            Affect(pad=(0, -1.5, 0))

    def test_pad_wrong_length(self):
        """PAD with wrong length should fail"""
        with pytest.raises(ValidationError):
            Affect(pad=(0.5, 0.5))


class TestMeaning:
    """Tests for Meaning model"""

    def test_empty_meaning(self):
        """Empty meaning should be valid"""
        meaning = Meaning()
        assert meaning.topic is None
        assert meaning.ontology is None

    def test_meaning_with_topic(self):
        """Meaning with topic should be valid"""
        meaning = Meaning(topic="authentication")
        assert meaning.topic == "authentication"

    def test_meaning_with_ontology(self):
        """Meaning with ontology URI should be valid"""
        meaning = Meaning(ontology="https://schema.org/Action")
        assert meaning.ontology == "https://schema.org/Action"


class TestTrust:
    """Tests for Trust model"""

    def test_empty_trust(self):
        """Empty trust should be valid"""
        trust = Trust()
        assert trust.proof is None
        assert trust.attest is None

    def test_trust_with_proof(self):
        """Trust with proof should be valid"""
        trust = Trust(proof="signature-data")
        assert trust.proof == "signature-data"

    def test_trust_with_attestations(self):
        """Trust with attestations should be valid"""
        trust = Trust(attest=["issuer-1", "issuer-2"])
        assert trust.attest == ["issuer-1", "issuer-2"]


class TestMemory:
    """Tests for Memory model"""

    def test_empty_memory(self):
        """Empty memory should be valid"""
        memory = Memory()
        assert memory.thread is None
        assert memory.t is None
        assert memory.ttl is None

    def test_memory_with_thread(self):
        """Memory with thread UUID should be valid"""
        memory = Memory(thread="550e8400-e29b-41d4-a716-446655440000")
        assert memory.thread == "550e8400-e29b-41d4-a716-446655440000"

    def test_memory_with_timestamp(self):
        """Memory with timestamp should be valid"""
        memory = Memory(t="2024-01-15T10:30:00Z")
        assert memory.t == "2024-01-15T10:30:00Z"

    def test_memory_with_ttl(self):
        """Memory with TTL should be valid"""
        memory = Memory(ttl="PT1H")
        assert memory.ttl == "PT1H"


class TestPolicy:
    """Tests for Policy model"""

    def test_minimal_policy(self):
        """Policy with just consent should be valid"""
        policy = Policy(consent="private")
        assert policy.consent == "private"
        assert policy.share is None
        assert policy.dp is None

    def test_all_valid_consent_levels(self):
        """All valid consent levels should work"""
        for consent in ["private", "team", "public"]:
            policy = Policy(consent=consent)
            assert policy.consent == consent

    def test_invalid_consent_level(self):
        """Invalid consent level should raise ValidationError"""
        with pytest.raises(ValidationError):
            Policy(consent="invalid")

    def test_policy_with_share_list(self):
        """Policy with share list should be valid"""
        policy = Policy(consent="team", share=["analytics@example.com"])
        assert policy.share == ["analytics@example.com"]

    def test_policy_with_dp(self):
        """Policy with DP parameters should be valid"""
        policy = Policy(consent="public", dp="epsilon=0.1")
        assert policy.dp == "epsilon=0.1"


class TestQoS:
    """Tests for QoS model"""

    def test_empty_qos(self):
        """Empty QoS should be valid"""
        qos = QoS()
        assert qos.coherence is None
        assert qos.stability is None

    def test_qos_with_coherence(self):
        """QoS with coherence should be valid"""
        qos = QoS(coherence=0.95)
        assert qos.coherence == 0.95

    def test_coherence_boundary_values(self):
        """Coherence boundary values should be valid"""
        for coherence in [0, 0.5, 1]:
            qos = QoS(coherence=coherence)
            assert qos.coherence == coherence

    def test_coherence_out_of_range(self):
        """Coherence out of range should fail"""
        with pytest.raises(ValidationError):
            QoS(coherence=1.5)
        with pytest.raises(ValidationError):
            QoS(coherence=-0.1)

    def test_qos_with_stability(self):
        """QoS with stability should be valid"""
        qos = QoS(stability="high")
        assert qos.stability == "high"


class TestTrace:
    """Tests for Trace model"""

    def test_empty_trace(self):
        """Empty trace should be valid"""
        trace = Trace()
        assert trace.hop is None
        assert trace.provenance is None

    def test_trace_with_hop_count(self):
        """Trace with hop count should be valid"""
        trace = Trace(hop=2)
        assert trace.hop == 2

    def test_hop_cannot_be_negative(self):
        """Hop count cannot be negative"""
        with pytest.raises(ValidationError):
            Trace(hop=-1)

    def test_trace_with_provenance(self):
        """Trace with provenance chain should be valid"""
        trace = Trace(provenance=["service-a", "service-b"])
        assert trace.provenance == ["service-a", "service-b"]


class TestLCE:
    """Tests for LCE model"""

    def test_minimal_lce(self):
        """Minimal LCE should be valid"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        assert lce.v == 1
        assert lce.intent.type == "ask"
        assert lce.policy.consent == "private"

    def test_complete_lce(self):
        """Complete LCE with all fields should be valid"""
        lce = LCE(
            v=1,
            intent=Intent(type="tell", goal="Update status"),
            affect=Affect(pad=(0.5, 0.3, 0.7), tags=["confident"]),
            meaning=Meaning(topic="status", ontology="https://schema.org/Status"),
            trust=Trust(proof="signature", attest=["issuer-1"]),
            memory=Memory(
                thread="550e8400-e29b-41d4-a716-446655440000",
                t="2024-01-15T10:30:00Z",
                ttl="PT1H",
            ),
            policy=Policy(consent="team", share=["analytics@example.com"]),
            qos=QoS(coherence=0.95, stability="high"),
            trace=Trace(hop=2, provenance=["service-a"]),
            sig="signature-data",
        )
        assert lce.v == 1
        assert lce.intent.goal == "Update status"
        assert lce.affect.pad == (0.5, 0.3, 0.7)
        assert lce.qos.coherence == 0.95

    def test_lce_version_must_be_1(self):
        """LCE version must be 1"""
        with pytest.raises(ValidationError):
            LCE(
                v=2,
                intent=Intent(type="ask"),
                policy=Policy(consent="private"),
            )

    def test_lce_missing_required_fields(self):
        """LCE missing required fields should fail"""
        with pytest.raises(ValidationError):
            LCE(v=1)  # Missing intent and policy

    def test_lce_forbids_extra_fields(self):
        """LCE should not allow extra fields"""
        with pytest.raises(ValidationError):
            LCE(
                v=1,
                intent=Intent(type="ask"),
                policy=Policy(consent="private"),
                extra_field="not allowed",
            )

    def test_lce_model_dump(self):
        """LCE should serialize to dict correctly"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        data = lce.model_dump()
        assert data["v"] == 1
        assert data["intent"]["type"] == "ask"
        assert data["policy"]["consent"] == "private"

    def test_lce_model_dump_excludes_none(self):
        """LCE should exclude None values when serializing"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        data = lce.model_dump(exclude_none=True)
        assert "affect" not in data
        assert "meaning" not in data
        assert "trust" not in data

    def test_lce_model_dump_json(self):
        """LCE should serialize to JSON correctly"""
        lce = LCE(
            v=1,
            intent=Intent(type="ask"),
            policy=Policy(consent="private"),
        )
        json_str = lce.model_dump_json(exclude_none=True)
        assert '"v":1' in json_str or '"v": 1' in json_str
        assert '"type":"ask"' in json_str or '"type": "ask"' in json_str

    def test_lce_model_validate(self):
        """LCE should parse from dict correctly"""
        data = {
            "v": 1,
            "intent": {"type": "ask"},
            "policy": {"consent": "private"},
        }
        lce = LCE.model_validate(data)
        assert lce.v == 1
        assert lce.intent.type == "ask"
        assert lce.policy.consent == "private"

    def test_lce_from_json(self):
        """LCE should parse from JSON string"""
        json_str = '{"v": 1, "intent": {"type": "ask"}, "policy": {"consent": "private"}}'
        lce = LCE.model_validate_json(json_str)
        assert lce.v == 1
        assert lce.intent.type == "ask"
