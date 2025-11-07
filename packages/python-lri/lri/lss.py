"""
LSS (Liminal Session Store) - Conversation coherence tracking

Tracks conversation context and calculates coherence scores.
"""

import math
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

from .types import LCE


@dataclass
class LSSMessage:
    """Stored message in session"""

    lce: LCE
    payload: Optional[dict] = None
    timestamp: datetime = datetime.now()


@dataclass
class CoherenceResult:
    """Coherence calculation result"""

    overall: float
    intent_similarity: float
    affect_stability: float
    semantic_alignment: float


# Intent vectors for similarity calculation
INTENT_VECTORS = {
    "ask": [1.0, 0.5, 0, 0, 0, 0.2],
    "tell": [0.5, 1.0, 0, 0, 0.1, 0.2],
    "propose": [0.1, 0.1, 1.0, 0.6, 0, 0.3],
    "confirm": [0, 0, 0.6, 1.0, 0, 0.1],
    "notify": [0, 0.4, 0, 0, 1.0, 0],
    "sync": [0.2, 0.4, 0.1, 0, 0.8, 0.3],
    "plan": [0.3, 0.3, 0.5, 0.3, 0, 1.0],
    "agree": [0, 0.1, 0.6, 0.9, 0, 0.1],
    "disagree": [0.2, 0.2, 0.4, 0.7, 0, 0.2],
    "reflect": [0.4, 0.6, 0.1, 0, 0, 0.8],
}


class LSS:
    """Liminal Session Store - In-memory session storage with coherence calculation"""

    def __init__(
        self,
        max_messages: int = 1000,
        session_ttl: int = 3600000,  # 1 hour in milliseconds
        coherence_window: int = 10,
    ):
        self.max_messages = max_messages
        self.session_ttl = session_ttl
        self.coherence_window = coherence_window
        self.sessions: dict[str, dict] = {}

    def store(self, thread_id: str, lce: LCE, payload: Optional[dict] = None):
        """Store message in session"""
        if thread_id not in self.sessions:
            # Create new session
            self.sessions[thread_id] = {
                "thread_id": thread_id,
                "messages": [],
                "coherence": 1.0,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            }

        session = self.sessions[thread_id]

        # Add message
        message = LSSMessage(lce=lce, payload=payload, timestamp=datetime.now())
        session["messages"].append(message)

        # Trim if too many messages
        if len(session["messages"]) > self.max_messages:
            session["messages"] = session["messages"][-self.max_messages :]

        # Update metadata
        session["updated_at"] = datetime.now()

        # Recalculate coherence
        if len(session["messages"]) >= 2:
            result = self.calculate_coherence(session["messages"])
            session["coherence"] = result.overall

    def get_session(self, thread_id: str) -> Optional[dict]:
        """Get session by thread ID"""
        return self.sessions.get(thread_id)

    def calculate_coherence(self, messages: list[LSSMessage]) -> CoherenceResult:
        """
        Calculate coherence for message history

        Formula: coherence = 0.4×intent_similarity + 0.3×affect_stability + 0.3×semantic_alignment
        """
        if len(messages) < 2:
            return CoherenceResult(1.0, 1.0, 1.0, 1.0)

        # Use last N messages for coherence window
        window = messages[-self.coherence_window :]

        intent_similarity = self._calculate_intent_similarity(window)
        affect_stability = self._calculate_affect_stability(window)
        semantic_alignment = self._calculate_semantic_alignment(window)

        overall = (
            0.4 * intent_similarity + 0.3 * affect_stability + 0.3 * semantic_alignment
        )

        return CoherenceResult(
            overall=max(0.0, min(1.0, overall)),
            intent_similarity=intent_similarity,
            affect_stability=affect_stability,
            semantic_alignment=semantic_alignment,
        )

    def _calculate_intent_similarity(self, messages: list[LSSMessage]) -> float:
        """Calculate intent similarity using cosine similarity"""
        if len(messages) < 2:
            return 1.0

        total_similarity = 0.0
        comparisons = 0

        for i in range(1, len(messages)):
            prev_intent = messages[i - 1].lce.intent.type
            curr_intent = messages[i].lce.intent.type

            vec1 = INTENT_VECTORS.get(prev_intent, INTENT_VECTORS["tell"])
            vec2 = INTENT_VECTORS.get(curr_intent, INTENT_VECTORS["tell"])

            similarity = self._cosine_similarity(vec1, vec2)
            total_similarity += similarity
            comparisons += 1

        return total_similarity / comparisons if comparisons > 0 else 1.0

    def _calculate_affect_stability(self, messages: list[LSSMessage]) -> float:
        """Calculate affect stability (low variance = high stability)"""
        pads = [m.lce.affect.pad for m in messages if m.lce.affect and m.lce.affect.pad]

        if len(pads) < 2:
            return 1.0

        # Calculate variance for each dimension
        variances = []
        for dim in range(3):
            values = [pad[dim] for pad in pads]
            var = self._variance(values)
            variances.append(var)

        # Average variance
        avg_variance = sum(variances) / len(variances)

        # Convert to stability: stability = e^(-variance)
        return math.exp(-avg_variance * 5)

    def _calculate_semantic_alignment(self, messages: list[LSSMessage]) -> float:
        """Calculate semantic alignment based on topic consistency"""
        topics = [
            m.lce.meaning.topic
            for m in messages
            if m.lce.meaning and m.lce.meaning.topic
        ]

        if len(topics) < 2:
            return 1.0

        # Count unique topics
        unique_topics = set(topics)

        # Fewer unique topics = higher alignment
        return 1.0 / len(unique_topics)

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(x * x for x in b))

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)

    def _variance(self, values: list[float]) -> float:
        """Calculate variance of array"""
        if len(values) == 0:
            return 0.0

        mean = sum(values) / len(values)
        squared_diffs = [(val - mean) ** 2 for val in values]
        return sum(squared_diffs) / len(values)

    def cleanup_expired(self):
        """Remove expired sessions"""
        now = datetime.now()
        ttl_delta = timedelta(milliseconds=self.session_ttl)

        expired = [
            thread_id
            for thread_id, session in self.sessions.items()
            if now - session["updated_at"] > ttl_delta
        ]

        for thread_id in expired:
            del self.sessions[thread_id]

        return len(expired)
