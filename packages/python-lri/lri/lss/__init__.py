"""Liminal Session Store (LSS) implementation."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Callable, Dict, Iterable, List, Optional

from ..types import LCE

IntentVector = Dict[str, List[float]]

INTENT_VECTORS: IntentVector = {
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


@dataclass
class CoherenceResult:
    """Breakdown of coherence measurements."""

    overall: float
    intent_similarity: float
    affect_stability: float
    semantic_alignment: float


@dataclass
class DriftEvent:
    """Detected drift signal."""

    thread_id: str
    type: str
    severity: str
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None


@dataclass
class SessionMetrics:
    """Session-level metrics."""

    coherence: CoherenceResult
    previous_coherence: Optional[CoherenceResult] = None
    drift_events: List[DriftEvent] = field(default_factory=list)
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SessionMetadata:
    """Metadata describing the session lifecycle."""

    created_at: datetime
    updated_at: datetime
    message_count: int = 0


@dataclass
class LSSMessage:
    """A message inside a session."""

    lce: LCE
    payload: Any = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class LSSSession:
    """Complete session snapshot."""

    thread_id: str
    messages: List[LSSMessage]
    coherence: float
    metrics: SessionMetrics
    metadata: SessionMetadata


class LSS:
    """In-memory session store with coherence and drift detection."""

    def __init__(
        self,
        *,
        max_messages: int = 1000,
        session_ttl: int = 3_600_000,
        coherence_window: int = 10,
        drift_min_coherence: float = 0.6,
        drift_drop_threshold: float = 0.2,
        topic_shift_window: int = 5,
    ) -> None:
        self.max_messages = max_messages
        self.session_ttl = session_ttl
        self.coherence_window = coherence_window
        self.drift_min_coherence = drift_min_coherence
        self.drift_drop_threshold = drift_drop_threshold
        self.topic_shift_window = topic_shift_window

        self._sessions: Dict[str, LSSSession] = {}
        self._listeners: Dict[str, List[Callable[[DriftEvent], None]]] = {"drift": []}

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------
    def store(self, thread_id: str, lce: LCE, payload: Any | None = None) -> None:
        """Persist an LCE to the session."""

        now = datetime.now(timezone.utc)
        session = self._sessions.get(thread_id)
        if session is None:
            session = self._sessions[thread_id] = LSSSession(
                thread_id=thread_id,
                messages=[],
                coherence=1.0,
                metrics=SessionMetrics(
                    coherence=CoherenceResult(
                        overall=1.0,
                        intent_similarity=1.0,
                        affect_stability=1.0,
                        semantic_alignment=1.0,
                    ),
                    updated_at=now,
                ),
                metadata=SessionMetadata(created_at=now, updated_at=now, message_count=0),
            )

        session.messages.append(LSSMessage(lce=lce, payload=payload, timestamp=now))
        if len(session.messages) > self.max_messages:
            session.messages = session.messages[-self.max_messages :]

        session.metadata.message_count = len(session.messages)
        session.metadata.updated_at = now

        # Perform TTL cleanup lazily
        self._cleanup_expired(now)

        if session.metadata.message_count >= 2:
            coherence = self.calculate_coherence(session.messages)
            drift_event = self._detect_drift(session, coherence, now)

            session.metrics.previous_coherence = session.metrics.coherence
            session.metrics.coherence = coherence
            session.metrics.updated_at = now
            session.coherence = coherence.overall

            if drift_event is not None:
                session.metrics.drift_events.append(drift_event)
                self._emit('drift', drift_event)

    def get_session(self, thread_id: str) -> Optional[LSSSession]:
        """Return a session snapshot if it exists."""

        return self._sessions.get(thread_id)

    def get_all_sessions(self) -> Iterable[LSSSession]:
        """Return all live sessions."""

        return list(self._sessions.values())

    def delete_session(self, thread_id: str) -> bool:
        """Remove a session."""

        return self._sessions.pop(thread_id, None) is not None

    def clear(self) -> None:
        """Remove all sessions."""

        self._sessions.clear()

    # ------------------------------------------------------------------
    # Metrics management
    # ------------------------------------------------------------------
    def get_metrics(self, thread_id: str) -> Optional[SessionMetrics]:
        session = self._sessions.get(thread_id)
        return session.metrics if session else None

    def update_metrics(
        self,
        thread_id: str,
        *,
        coherence: Optional[CoherenceResult] = None,
        drift_events: Optional[List[DriftEvent]] = None,
    ) -> Optional[SessionMetrics]:
        session = self._sessions.get(thread_id)
        if session is None:
            return None

        if coherence is not None:
            session.metrics.previous_coherence = session.metrics.coherence
            session.metrics.coherence = coherence
            session.coherence = coherence.overall

        if drift_events is not None:
            session.metrics.drift_events = drift_events

        session.metrics.updated_at = datetime.now(timezone.utc)
        return session.metrics

    # ------------------------------------------------------------------
    # Event handling
    # ------------------------------------------------------------------
    def on(self, event: str, callback: Callable[[DriftEvent], None]) -> None:
        """Register an event listener."""

        self._listeners.setdefault(event, []).append(callback)

    def off(self, event: str, callback: Callable[[DriftEvent], None]) -> None:
        """Remove an event listener."""

        listeners = self._listeners.get(event)
        if not listeners:
            return
        try:
            listeners.remove(callback)
        except ValueError:
            pass

    def _emit(self, event: str, payload: DriftEvent) -> None:
        for listener in self._listeners.get(event, []):
            listener(payload)

    # ------------------------------------------------------------------
    # Coherence and drift calculations
    # ------------------------------------------------------------------
    def calculate_coherence(self, messages: List[LSSMessage]) -> CoherenceResult:
        if len(messages) < 2:
            return CoherenceResult(1.0, 1.0, 1.0, 1.0)

        window = messages[-self.coherence_window :]
        intent_similarity = self._intent_similarity(window)
        affect_stability = self._affect_stability(window)
        semantic_alignment = self._semantic_alignment(window)

        overall = 0.4 * intent_similarity + 0.3 * affect_stability + 0.3 * semantic_alignment
        overall = max(0.0, min(1.0, overall))
        return CoherenceResult(
            overall=overall,
            intent_similarity=intent_similarity,
            affect_stability=affect_stability,
            semantic_alignment=semantic_alignment,
        )

    def _intent_similarity(self, messages: List[LSSMessage]) -> float:
        if len(messages) < 2:
            return 1.0

        total_similarity = 0.0
        comparisons = 0
        for previous, current in zip(messages[:-1], messages[1:]):
            prev_intent = previous.lce.intent.type
            curr_intent = current.lce.intent.type
            vec1 = INTENT_VECTORS.get(prev_intent, INTENT_VECTORS["tell"])
            vec2 = INTENT_VECTORS.get(curr_intent, INTENT_VECTORS["tell"])
            total_similarity += self._cosine_similarity(vec1, vec2)
            comparisons += 1

        return total_similarity / comparisons if comparisons else 1.0

    def _affect_stability(self, messages: List[LSSMessage]) -> float:
        pads = [m.lce.affect.pad for m in messages if m.lce.affect and m.lce.affect.pad is not None]
        if len(pads) < 2:
            return 1.0

        variances = [self._variance([pad[i] for pad in pads]) for i in range(3)]
        avg_variance = sum(variances) / 3
        return float(math.exp(-avg_variance * 5))

    def _semantic_alignment(self, messages: List[LSSMessage]) -> float:
        topics = [m.lce.meaning.topic for m in messages if m.lce.meaning and m.lce.meaning.topic]
        if len(topics) < 2:
            return 1.0

        unique_topics = len(set(topics))
        return 1.0 / unique_topics

    def _detect_drift(
        self, session: LSSSession, coherence: CoherenceResult, timestamp: datetime
    ) -> Optional[DriftEvent]:
        previous = session.metrics.coherence
        drop = previous.overall - coherence.overall

        if coherence.overall < self.drift_min_coherence and drop >= self.drift_drop_threshold:
            severity = "high" if drop > 0.4 else "medium" if drop > 0.25 else "low"
            return DriftEvent(
                thread_id=session.thread_id,
                type="coherence_drop",
                severity=severity,
                timestamp=timestamp,
                details={"previous": previous.overall, "current": coherence.overall},
            )

        topics = [
            m.lce.meaning.topic
            for m in session.messages[-self.topic_shift_window :]
            if m.lce.meaning and m.lce.meaning.topic
        ]
        if len(topics) >= 3:
            unique = len(set(topics))
            if unique >= min(len(topics), 3):
                severity = "high" if unique > 3 else "medium"
                return DriftEvent(
                    thread_id=session.thread_id,
                    type="topic_shift",
                    severity=severity,
                    timestamp=timestamp,
                    details={"window": topics, "unique_topics": unique},
                )

        return None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _cleanup_expired(self, now: datetime) -> None:
        ttl = timedelta(milliseconds=self.session_ttl)
        expired = [
            thread_id
            for thread_id, session in self._sessions.items()
            if now - session.metadata.updated_at > ttl
        ]
        for thread_id in expired:
            self._sessions.pop(thread_id, None)

    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = sum(a * a for a in vec1) ** 0.5
        mag2 = sum(b * b for b in vec2) ** 0.5
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot / (mag1 * mag2)

    @staticmethod
    def _variance(values: List[float]) -> float:
        if not values:
            return 0.0
        mean = sum(values) / len(values)
        return sum((val - mean) ** 2 for val in values) / len(values)


__all__ = [
    "LSS",
    "LSSSession",
    "LSSMessage",
    "SessionMetrics",
    "CoherenceResult",
    "DriftEvent",
]
