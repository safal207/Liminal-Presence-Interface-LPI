from datetime import datetime

from lri.lss import LSS, CoherenceResult
from lri.types import Affect, Intent, LCE, Meaning, Policy


def make_lce(intent_type: str, pad: tuple[float, float, float], topic: str) -> LCE:
    return LCE(
        intent=Intent(type=intent_type),
        affect=Affect(pad=pad),
        meaning=Meaning(topic=topic),
        policy=Policy(consent="team"),
    )


def test_store_and_metrics_calculation() -> None:
    store = LSS(coherence_window=5)
    store.store("thread-a", make_lce("ask", (0.1, 0.1, 0.1), "sync"))
    store.store("thread-a", make_lce("tell", (0.2, 0.1, 0.05), "sync"))

    session = store.get_session("thread-a")
    assert session is not None
    assert session.metadata.message_count == 2

    metrics = store.get_metrics("thread-a")
    assert metrics is not None
    assert 0 <= metrics.coherence.overall <= 1
    assert metrics.coherence.intent_similarity > 0


def test_drift_event_emission() -> None:
    store = LSS(coherence_window=5, drift_min_coherence=0.6, drift_drop_threshold=0.15)
    captured: list = []
    store.on("drift", lambda event: captured.append(event))

    store.store("thread-b", make_lce("ask", (0.9, 0.8, 0.8), "status"))
    store.store("thread-b", make_lce("tell", (0.1, 0.1, 0.1), "status"))
    store.store("thread-b", make_lce("plan", (0.9, -0.9, 0.6), "unrelated"))

    assert captured
    assert captured[0].thread_id == "thread-b"
    assert captured[0].type == "coherence_drop"


def test_manual_metrics_update() -> None:
    store = LSS()
    store.store("thread-c", make_lce("ask", (0.1, 0.1, 0.1), "topic1"))
    store.store("thread-c", make_lce("tell", (0.1, 0.1, 0.1), "topic1"))

    override = CoherenceResult(overall=0.9, intent_similarity=0.85, affect_stability=0.9, semantic_alignment=0.95)
    updated = store.update_metrics("thread-c", coherence=override)

    assert updated is not None
    assert updated.coherence.overall == 0.9
    assert updated.previous_coherence is not None
    assert isinstance(updated.updated_at, datetime)
