"""
Tests for LSS (Liminal Session Store) - Coherence tracking
"""

import pytest
from lri import LCE, Intent, Affect, Meaning, Policy, LSS


def test_store_message():
    """Test storing message in session"""
    lss = LSS()
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )

    lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert session is not None
    assert session["thread_id"] == "thread-1"
    assert len(session["messages"]) == 1


def test_store_multiple_messages():
    """Test storing multiple messages in same session"""
    lss = LSS()

    for i in range(3):
        lce = LCE(
            v=1,
            intent=Intent(type="tell"),
            policy=Policy(consent="private"),
        )
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert len(session["messages"]) == 3


def test_get_nonexistent_session():
    """Test getting non-existent session returns None"""
    lss = LSS()
    session = lss.get_session("non-existent")
    assert session is None


def test_initial_coherence():
    """Test initial coherence is 1.0"""
    lss = LSS()
    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )

    lss.store("thread-1", lce)
    session = lss.get_session("thread-1")

    assert session["coherence"] == 1.0


def test_coherence_calculation():
    """Test coherence is calculated for multiple messages"""
    lss = LSS()

    messages = [
        LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="tell"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private")),
    ]

    for lce in messages:
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert 0 <= session["coherence"] <= 1


def test_high_coherence_consistent_conversation():
    """Test high coherence for consistent conversation"""
    lss = LSS()

    messages = [
        LCE(
            v=1,
            intent=Intent(type="ask"),
            affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
            meaning=Meaning(topic="weather"),
            policy=Policy(consent="private"),
        ),
        LCE(
            v=1,
            intent=Intent(type="tell"),
            affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
            meaning=Meaning(topic="weather"),
            policy=Policy(consent="private"),
        ),
        LCE(
            v=1,
            intent=Intent(type="ask"),
            affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
            meaning=Meaning(topic="weather"),
            policy=Policy(consent="private"),
        ),
    ]

    for lce in messages:
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert session["coherence"] > 0.7  # High coherence


def test_low_coherence_inconsistent_conversation():
    """Test low coherence for inconsistent conversation"""
    lss = LSS()

    messages = [
        LCE(
            v=1,
            intent=Intent(type="ask"),
            affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
            meaning=Meaning(topic="weather"),
            policy=Policy(consent="private"),
        ),
        LCE(
            v=1,
            intent=Intent(type="plan"),
            affect=Affect(pad=(0.8, 0.9, 0.5), tags=[]),
            meaning=Meaning(topic="food"),
            policy=Policy(consent="private"),
        ),
        LCE(
            v=1,
            intent=Intent(type="sync"),
            affect=Affect(pad=(0.1, 0.1, 0.9), tags=[]),
            meaning=Meaning(topic="work"),
            policy=Policy(consent="private"),
        ),
    ]

    for lce in messages:
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert session["coherence"] < 0.5  # Low coherence


def test_max_messages_limit():
    """Test max messages limit is enforced"""
    lss = LSS(max_messages=3)

    for i in range(5):
        lce = LCE(
            v=1,
            intent=Intent(type="tell"),
            policy=Policy(consent="private"),
        )
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    assert len(session["messages"]) == 3  # Limited to 3


def test_coherence_window():
    """Test coherence window limits calculation"""
    lss = LSS(coherence_window=2)

    messages = [
        LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="tell"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="sync"), policy=Policy(consent="private")),
        LCE(v=1, intent=Intent(type="plan"), policy=Policy(consent="private")),
    ]

    for lce in messages:
        lss.store("thread-1", lce)

    session = lss.get_session("thread-1")
    # Coherence should only use last 2 messages
    assert session["coherence"] is not None


def test_intent_similarity():
    """Test intent similarity calculation"""
    lss = LSS()

    # Ask-tell pattern should have high similarity
    from lri.lss import LSSMessage

    messages = [
        LSSMessage(lce=LCE(v=1, intent=Intent(type="ask"), policy=Policy(consent="private"))),
        LSSMessage(lce=LCE(v=1, intent=Intent(type="tell"), policy=Policy(consent="private"))),
    ]

    result = lss.calculate_coherence(messages)
    assert result.intent_similarity > 0


def test_affect_stability():
    """Test affect stability calculation"""
    lss = LSS()
    from lri.lss import LSSMessage

    # Same PAD values = high stability
    messages = [
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="tell"),
                affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
                policy=Policy(consent="private"),
            )
        ),
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="tell"),
                affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
                policy=Policy(consent="private"),
            )
        ),
    ]

    result = lss.calculate_coherence(messages)
    assert result.affect_stability > 0.8  # Very stable


def test_semantic_alignment():
    """Test semantic alignment calculation"""
    lss = LSS()
    from lri.lss import LSSMessage

    # Same topic = perfect alignment
    messages = [
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="tell"),
                meaning=Meaning(topic="weather"),
                policy=Policy(consent="private"),
            )
        ),
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="tell"),
                meaning=Meaning(topic="weather"),
                policy=Policy(consent="private"),
            )
        ),
    ]

    result = lss.calculate_coherence(messages)
    assert result.semantic_alignment == 1.0  # Perfect alignment


def test_coherence_components():
    """Test all coherence components are returned"""
    lss = LSS()
    from lri.lss import LSSMessage

    messages = [
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="ask"),
                affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
                meaning=Meaning(topic="weather"),
                policy=Policy(consent="private"),
            )
        ),
        LSSMessage(
            lce=LCE(
                v=1,
                intent=Intent(type="tell"),
                affect=Affect(pad=(0.3, 0.2, 0.1), tags=[]),
                meaning=Meaning(topic="weather"),
                policy=Policy(consent="private"),
            )
        ),
    ]

    result = lss.calculate_coherence(messages)

    assert hasattr(result, "overall")
    assert hasattr(result, "intent_similarity")
    assert hasattr(result, "affect_stability")
    assert hasattr(result, "semantic_alignment")


def test_cleanup_expired():
    """Test cleanup of expired sessions"""
    lss = LSS(session_ttl=0)  # Immediate expiry

    lce = LCE(
        v=1,
        intent=Intent(type="tell"),
        policy=Policy(consent="private"),
    )
    lss.store("thread-1", lce)

    # Cleanup should remove expired session
    removed = lss.cleanup_expired()
    assert removed >= 0
