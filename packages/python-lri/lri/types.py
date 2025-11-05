"""
LRI Core Types
Based on LCE v0.1 schema
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

IntentType = Literal[
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

ConsentLevel = Literal["private", "team", "public"]


class Intent(BaseModel):
    """Communicative intent"""

    type: IntentType
    goal: Optional[str] = None


class Affect(BaseModel):
    """Emotional and affective context"""

    pad: Optional[tuple[float, float, float]] = Field(
        None, description="PAD model: [Pleasure, Arousal, Dominance]"
    )
    tags: Optional[list[str]] = Field(None, description="Human-readable affect tags")

    @field_validator("pad")
    @classmethod
    def validate_pad(cls, v: Optional[tuple[float, float, float]]):
        if v is not None:
            if len(v) != 3:
                raise ValueError("PAD must have exactly 3 values")
            if not all(-1 <= x <= 1 for x in v):
                raise ValueError("PAD values must be in range [-1, 1]")
        return v


class Meaning(BaseModel):
    """Semantic meaning context"""

    topic: Optional[str] = None
    ontology: Optional[str] = Field(None, description="Reference ontology URI")


class Trust(BaseModel):
    """Trust and authenticity"""

    proof: Optional[str] = Field(None, description="Cryptographic proof")
    attest: Optional[list[str]] = Field(None, description="Third-party attestations")


class Memory(BaseModel):
    """Session and temporal context"""

    thread: Optional[str] = Field(None, description="Conversation thread UUID")
    t: Optional[str] = Field(None, description="Timestamp (ISO 8601)")
    ttl: Optional[str] = Field(None, description="Time-to-live duration")


class Policy(BaseModel):
    """Privacy and consent policy"""

    consent: ConsentLevel
    share: Optional[list[str]] = Field(None, description="Sharing whitelist")
    dp: Optional[str] = Field(None, description="Differential privacy parameters")


class QoS(BaseModel):
    """Quality of Service metrics"""

    coherence: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Semantic coherence score"
    )
    stability: Optional[str] = Field(None, description="Context stability indicator")


class Trace(BaseModel):
    """Provenance and tracing"""

    hop: Optional[int] = Field(None, ge=0, description="Number of hops")
    provenance: Optional[list[str]] = Field(None, description="Chain of custody")


class LCE(BaseModel):
    """
    Liminal Context Envelope (LCE)

    Layer 8 semantic context envelope for human-AI communication.
    """

    v: Literal[1] = Field(1, description="LCE schema version")
    intent: Intent
    affect: Optional[Affect] = None
    meaning: Optional[Meaning] = None
    trust: Optional[Trust] = None
    memory: Optional[Memory] = None
    policy: Policy
    qos: Optional[QoS] = None
    trace: Optional[Trace] = None
    sig: Optional[str] = Field(None, description="JWS signature")

    model_config = {"extra": "forbid"}
