from __future__ import annotations

from datetime import datetime, timezone

import pytest

from lri.lss import (
    CoherenceResult,
    DriftEvent,
    LSS,
)
from lri.types import Affect, Intent, LCE, Meaning, Policy


def make_lce(intent: str, pad: tuple[float, float, float], topic: str) -> LCE:
    return LCE(
        intent=Intent(type=intent),
        affect=Affect(pad=pad),
        meaning=Meaning(topic=topic),
        policy=Policy(consent="team"),
    )


def test_store_and_metrics_roundtrip() -> None:
    store = LSS(coherence_window=5)
    store.store("thread-1", make_lce("ask", (0.2, 0.2, 0.2), "planning"))
    store.store("thread-1", make_lce("tell", (0.25, 0.25, 0.2), "planning"))

    session = store.get_session("thread-1")
    assert session is not None
    assert session.metadata.message_count == 2

    metrics = store.get_metrics("thread-1")
    assert metrics is not None
    assert 0 <= metrics.coherence.overall <= 1
    assert metrics.coherence.intent_similarity > 0


def test_coherence_drop_drift_event() -> None:
    store = LSS(drift_min_coherence=0.65, drift_drop_threshold=0.15)
    events: list[DriftEvent] = []
    store.on("drift", events.append)

    store.store("drift-thread", make_lce("ask", (0.9, 0.9, 0.9), "status"))
    store.store("drift-thread", make_lce("tell", (0.85, 0.88, 0.86), "status"))
    store.store("drift-thread", make_lce("plan", (-0.9, -0.9, -0.9), "off-topic"))

    assert events
    assert events[0].type == "coherence_drop"
    assert events[0].thread_id == "drift-thread"


def test_topic_shift_detection() -> None:
    store = LSS(topic_shift_window=4, drift_min_coherence=0.1)
    events: list[DriftEvent] = []
    store.on("drift", events.append)

    topics = ["alpha", "beta", "gamma", "delta"]
    for index, topic in enumerate(topics):
        intent = "ask" if index == 0 else "tell"
        store.store("topic-thread", make_lce(intent, (0.2, 0.2, 0.2), topic))

    assert any(event.type == "topic_shift" for event in events)


def test_update_metrics_replaces_values() -> None:
    store = LSS()
    store.store("metrics-thread", make_lce("ask", (0.3, 0.3, 0.3), "sync"))
    store.store("metrics-thread", make_lce("tell", (0.3, 0.3, 0.3), "sync"))

    replacement = CoherenceResult(
        overall=0.42,
        intent_similarity=0.5,
        affect_stability=0.38,
        semantic_alignment=0.35,
    )
    drift_events = [
        DriftEvent(
            thread_id="metrics-thread",
            type="coherence_drop",
            severity="low",
            timestamp=datetime.now(timezone.utc),
            details={"previous": 0.9, "current": 0.42},
        )
    ]

    metrics = store.update_metrics(
        "metrics-thread", coherence=replacement, drift_events=drift_events
    )
    assert metrics is not None
    assert metrics.coherence.overall == pytest.approx(0.42)
    assert metrics.previous_coherence is not None
    assert metrics.drift_events[0].thread_id == "metrics-thread"


def test_get_stats_returns_expected_totals() -> None:
    store = LSS()
    store.store("stats-1", make_lce("ask", (0.1, 0.1, 0.1), "alpha"))
    store.store("stats-2", make_lce("tell", (0.1, 0.1, 0.1), "beta"))
    store.store("stats-2", make_lce("plan", (0.15, 0.1, 0.1), "beta"))

    stats = store.get_stats()
    assert stats["session_count"] == 2
    assert stats["total_messages"] == 3
    assert 0 <= stats["average_coherence"] <= 1
