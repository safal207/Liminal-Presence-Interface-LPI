"""Liminal Session Store (LSS) implementation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Callable, Dict, Iterable, List, Optional, Protocol

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


class SessionStorage(Protocol):
    """Persistence layer interface for the session store."""

    def load(self, thread_id: str) -> Optional[LSSSession]:
        ...

    def save(self, session: LSSSession, ttl_ms: int) -> None:
        ...

    def delete(self, thread_id: str) -> bool:
        ...

    def load_all(self) -> List[LSSSession]:
        ...

    def clear(self) -> None:
        ...

    def cleanup(self, now: datetime, ttl_ms: int) -> None:
        ...


class InMemorySessionStorage(SessionStorage):
    """Store sessions in memory."""

    def __init__(self) -> None:
        self._sessions: Dict[str, LSSSession] = {}

    def load(self, thread_id: str) -> Optional[LSSSession]:
        return self._sessions.get(thread_id)

    def save(self, session: LSSSession, ttl_ms: int) -> None:  # noqa: ARG002
        self._sessions[session.thread_id] = session

    def delete(self, thread_id: str) -> bool:
        return self._sessions.pop(thread_id, None) is not None

    def load_all(self) -> List[LSSSession]:
        return list(self._sessions.values())

    def clear(self) -> None:
        self._sessions.clear()

    def cleanup(self, now: datetime, ttl_ms: int) -> None:
        ttl = timedelta(milliseconds=ttl_ms)
        for thread_id, session in list(self._sessions.items()):
            if now - session.metadata.updated_at > ttl:
                self._sessions.pop(thread_id, None)


class RedisLike(Protocol):
    """Subset of Redis client commands needed by the store."""

    def get(self, key: str) -> Optional[str]:
        ...

    def set(self, key: str, value: str, *, px: Optional[int] = None) -> Any:
        ...

    def delete(self, *keys: str) -> int:
        ...

    def scan_iter(self, match: str) -> Iterable[str]:
        ...


class RedisSessionStorage(SessionStorage):
    """Redis-backed session storage."""

    def __init__(self, client: RedisLike, *, key_prefix: str = "lss:session:") -> None:
        self._client = client
        self._key_prefix = key_prefix

    def load(self, thread_id: str) -> Optional[LSSSession]:
        raw = self._client.get(self._key(thread_id))
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        data = json.loads(raw)
        return session_from_dict(data)

    def save(self, session: LSSSession, ttl_ms: int) -> None:
        payload = json.dumps(session_to_dict(session), default=_json_default)
        self._client.set(self._key(session.thread_id), payload, px=ttl_ms)

    def delete(self, thread_id: str) -> bool:
        return self._client.delete(self._key(thread_id)) > 0

    def load_all(self) -> List[LSSSession]:
        sessions: List[LSSSession] = []
        for key in self._client.scan_iter(match=f"{self._key_prefix}*"):
            raw = self._client.get(key)
            if raw is None:
                continue
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            sessions.append(session_from_dict(json.loads(raw)))
        return sessions

    def clear(self) -> None:
        keys = list(self._client.scan_iter(match=f"{self._key_prefix}*"))
        if keys:
            self._client.delete(*keys)

    def cleanup(self, now: datetime, ttl_ms: int) -> None:  # noqa: ARG002
        # Redis handles TTL expiration via PX option.
        return None

    def _key(self, thread_id: str) -> str:
        return f"{self._key_prefix}{thread_id}"


def session_to_dict(session: LSSSession) -> Dict[str, Any]:
    return {
        "thread_id": session.thread_id,
        "coherence": session.coherence,
        "messages": [
            {
                "lce": message.lce.model_dump(),
                "payload": message.payload,
                "timestamp": message.timestamp.isoformat(),
            }
            for message in session.messages
        ],
        "metrics": {
            "coherence": {
                "overall": session.metrics.coherence.overall,
                "intent_similarity": session.metrics.coherence.intent_similarity,
                "affect_stability": session.metrics.coherence.affect_stability,
                "semantic_alignment": session.metrics.coherence.semantic_alignment,
            },
            "previous_coherence": (
                {
                    "overall": session.metrics.previous_coherence.overall,
                    "intent_similarity": session.metrics.previous_coherence.intent_similarity,
                    "affect_stability": session.metrics.previous_coherence.affect_stability,
                    "semantic_alignment": session.metrics.previous_coherence.semantic_alignment,
                }
                if session.metrics.previous_coherence
                else None
            ),
            "drift_events": [
                {
                    "thread_id": event.thread_id,
                    "type": event.type,
                    "severity": event.severity,
                    "timestamp": event.timestamp.isoformat(),
                    "details": event.details,
                }
                for event in session.metrics.drift_events
            ],
            "updated_at": session.metrics.updated_at.isoformat(),
        },
        "metadata": {
            "created_at": session.metadata.created_at.isoformat(),
            "updated_at": session.metadata.updated_at.isoformat(),
            "message_count": session.metadata.message_count,
        },
    }


def session_from_dict(data: Dict[str, Any]) -> LSSSession:
    metrics_data = data["metrics"]
    previous = metrics_data.get("previous_coherence")
    previous_coherence = (
        CoherenceResult(
            overall=previous["overall"],
            intent_similarity=previous["intent_similarity"],
            affect_stability=previous["affect_stability"],
            semantic_alignment=previous["semantic_alignment"],
        )
        if previous
        else None
    )

    drift_events_data = metrics_data.get("drift_events", [])

    metrics = SessionMetrics(
        coherence=CoherenceResult(
            overall=metrics_data["coherence"]["overall"],
            intent_similarity=metrics_data["coherence"]["intent_similarity"],
            affect_stability=metrics_data["coherence"]["affect_stability"],
            semantic_alignment=metrics_data["coherence"]["semantic_alignment"],
        ),
        previous_coherence=previous_coherence,
        drift_events=[
            DriftEvent(
                thread_id=event.get("thread_id", data["thread_id"]),
                type=event["type"],
                severity=event["severity"],
                timestamp=_parse_datetime(event["timestamp"]),
                details=event.get("details"),
            )
            for event in drift_events_data
        ],
        updated_at=_parse_datetime(metrics_data["updated_at"]),
    )

    metadata = SessionMetadata(
        created_at=_parse_datetime(data["metadata"]["created_at"]),
        updated_at=_parse_datetime(data["metadata"]["updated_at"]),
        message_count=int(data["metadata"]["message_count"]),
    )

    messages = [
        LSSMessage(
            lce=LCE.model_validate(message["lce"]),
            payload=message.get("payload"),
            timestamp=_parse_datetime(message["timestamp"]),
        )
        for message in data["messages"]
    ]

    return LSSSession(
        thread_id=data["thread_id"],
        messages=messages,
        coherence=float(data["coherence"]),
        metrics=metrics,
        metadata=metadata,
    )


def _json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    return repr(obj)


def _parse_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class LSS:
    """In-memory or Redis-backed session store with coherence and drift detection."""

    def __init__(
        self,
        *,
        max_messages: int = 1000,
        session_ttl: int = 3_600_000,
        coherence_window: int = 10,
        drift_min_coherence: float = 0.6,
        drift_drop_threshold: float = 0.2,
        topic_shift_window: int = 5,
        storage: Optional[SessionStorage] = None,
    ) -> None:
        self.max_messages = max_messages
        self.session_ttl = session_ttl
        self.coherence_window = coherence_window
        self.drift_min_coherence = drift_min_coherence
        self.drift_drop_threshold = drift_drop_threshold
        self.topic_shift_window = topic_shift_window

        self.storage: SessionStorage = storage or InMemorySessionStorage()
        self._listeners: Dict[str, List[Callable[[DriftEvent], None]]] = {"drift": []}

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------
    def store(self, thread_id: str, lce: LCE, payload: Any | None = None) -> None:
        """Persist an LCE to the session."""

        now = datetime.now(timezone.utc)
        self.storage.cleanup(now, self.session_ttl)

        session = self.storage.load(thread_id)
        if session is None:
            session = LSSSession(
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

        if session.metadata.message_count >= 2:
            coherence = self.calculate_coherence(session.messages)
            drift_event = self._detect_drift(session, coherence, now)

            session.metrics.previous_coherence = session.metrics.coherence
            session.metrics.coherence = coherence
            session.metrics.updated_at = now
            session.coherence = coherence.overall

            if drift_event is not None:
                session.metrics.drift_events.append(drift_event)
                self._emit("drift", drift_event)
        else:
            session.metrics.updated_at = now

        self.storage.save(session, self.session_ttl)

    def get_session(self, thread_id: str) -> Optional[LSSSession]:
        """Return a session snapshot if it exists."""

        return self.storage.load(thread_id)

    def get_all_sessions(self) -> Iterable[LSSSession]:
        """Return all live sessions."""

        return list(self.storage.load_all())

    def delete_session(self, thread_id: str) -> bool:
        """Remove a session."""

        return self.storage.delete(thread_id)

    def clear(self) -> None:
        """Remove all sessions."""

        self.storage.clear()

    # ------------------------------------------------------------------
    # Metrics management
    # ------------------------------------------------------------------
    def get_metrics(self, thread_id: str) -> Optional[SessionMetrics]:
        session = self.storage.load(thread_id)
        return session.metrics if session else None

    def update_metrics(
        self,
        thread_id: str,
        *,
        coherence: Optional[CoherenceResult] = None,
        drift_events: Optional[List[DriftEvent]] = None,
    ) -> Optional[SessionMetrics]:
        session = self.storage.load(thread_id)
        if session is None:
            return None

        if coherence is not None:
            session.metrics.previous_coherence = session.metrics.coherence
            session.metrics.coherence = coherence
            session.coherence = coherence.overall

        if drift_events is not None:
            session.metrics.drift_events = [
                DriftEvent(
                    thread_id=thread_id,
                    type=event.type,
                    severity=event.severity,
                    timestamp=event.timestamp,
                    details=event.details,
                )
                for event in drift_events
            ]

        session.metrics.updated_at = datetime.now(timezone.utc)
        self.storage.save(session, self.session_ttl)
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
    def get_stats(self) -> Dict[str, float]:
        sessions = self.storage.load_all()
        return {
            "session_count": len(sessions),
            "total_messages": sum(len(session.messages) for session in sessions),
            "average_coherence": (
                sum(session.coherence for session in sessions) / len(sessions)
                if sessions
                else 0.0
            ),
        }

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
    "InMemorySessionStorage",
    "RedisSessionStorage",
    "SessionStorage",
]
