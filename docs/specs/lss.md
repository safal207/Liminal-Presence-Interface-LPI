# Liminal Session Store (LSS)

LSS provides lightweight in-memory session state for Liminal Resonance Interface
clients. It tracks message history, calculates coherence, and emits drift
signals when the dialogue diverges from the established context.

## Core concepts

- **Session** – keyed by `threadId`, maintains message history and metadata.
- **Message** – stores the raw `LCE` envelope, optional payload, and timestamp.
- **Coherence result** – weighted average of intent similarity, affect stability,
  and semantic alignment across the most recent messages.
- **Drift events** – emitted when coherence drops sharply or topics thrash
  within a short window.

## Coherence formula

```
coherence = 0.4 × intent_similarity
           + 0.3 × affect_stability
           + 0.3 × semantic_alignment
```

- **Intent similarity** – cosine similarity between consecutive intent vectors.
- **Affect stability** – inverse variance of PAD values (Pleasure/Arousal/
  Dominance).
- **Semantic alignment** – fewer unique topics yield higher scores.

## Drift detection

Two baseline signals are available out of the box:

- `coherence_drop` – triggers when the new coherence score falls below
  `driftMinCoherence` and the drop since the previous measurement exceeds
  `driftDropThreshold`.
- `topic_shift` – triggers when the last `topicShiftWindow` messages contain at
  least three distinct topics.

Both SDKs emit a structured event (`type`, `severity`, `timestamp`, `details`)
through an event emitter/observer interface. Events are also recorded on the
session metrics for later inspection.

## SDK API surface

### Node.js

```ts
import { LSS } from 'node-lri/lss';

const lss = new LSS({ coherenceWindow: 8 });

await lss.store('thread-42', lce);
const metrics = await lss.getMetrics('thread-42');

lss.on('drift', (event) => console.log(event.type, event.details));
await lss.updateMetrics('thread-42', { coherence: metrics.coherence });
```

### Python

```python
from lri.lss import LSS
from lri.types import LCE, Intent, Policy

lss = LSS(coherence_window=8)

lss.store("thread-42", LCE(intent=Intent(type="ask"), policy=Policy(consent="team")))
metrics = lss.get_metrics("thread-42")

lss.on("drift", lambda event: print(event.type, event.details))
lss.update_metrics("thread-42", coherence=metrics.coherence)
```

## Message flow example

1. Client produces an `LCE` for each utterance and writes it into LSS using the
   thread identifier.
2. LSS recalculates coherence after every message and emits drift events when
   thresholds are crossed.
3. Application logic can inspect `getMetrics` to adapt responses (e.g. request
   clarification when coherence drops) or archive sessions when `getStats`
   shows stale activity.
