# Liminal Session Store (LSS)

LSS provides lightweight session state for Liminal Resonance Interface
clients. It tracks message history, calculates coherence, and emits drift
signals when the dialogue diverges from the established context. The store
ships with pluggable backends so you can keep state in memory for local
experiments or in Redis for multi-process deployments.

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

## Metrics API

Both SDKs expose the same operations for reading and adjusting telemetry:

| Operation        | Node.js                         | Python                           | Notes |
|------------------|---------------------------------|----------------------------------|-------|
| Store message    | `lss.store(threadId, lce, payload?)` | `lss.store(thread_id, lce, payload=None)` | Appends to history and recalculates metrics. |
| Read metrics     | `lss.getMetrics(threadId)` | `lss.get_metrics(thread_id)` | Returns `CoherenceResult` plus drift history. |
| Update metrics   | `lss.updateMetrics(threadId, { coherence, driftEvents })` | `lss.update_metrics(thread_id, coherence=..., drift_events=...)` | Override values when an external service provides better estimates. |
| Enumerate stats  | `lss.getStats()` | `lss.get_stats()` | Aggregated counts and average coherence. |
| Listen for drift | `lss.on('drift', listener)` | `lss.on('drift', callback)` | Receives `DriftEvent` objects for real-time mitigation. |

Metrics are persisted alongside the session and include `previousCoherence`
(`previous_coherence`) so downstream components can inspect the trend even if
no event fired.

## Session expiry and cleanup

- **In-memory** storage prunes expired sessions every time a new message is
  stored. The TTL is derived from `sessionTTL` / `session_ttl` and compared with
  the session's `updatedAt`.
- **Redis** storage delegates expiration to native TTL support via the `PX`
  option. Cleanup is therefore a no-op on the client side.

When running clustered deployments it is safe to instantiate multiple LSS
instances against the same Redis namespace because updates are idempotent.

## Storage adapters

- **In-memory** – default `Map`/`dict` backend, fast and lightweight.
- **Redis** – persistence across workers. Uses simple JSON blobs per session
  with key prefix `lss:session:*` (Node) / `lss:session:` (Python). Payloads
  should remain JSON-serializable when Redis persistence is enabled.

Both adapters honor the SDK options (`sessionTTL`, `maxMessages`, etc.). TTL is
handled via background cleanup for memory and Redis `PX` expiry for remote
storage.

## SDK API surface

### Node.js

```ts
import { LSS, RedisSessionStorage } from 'node-lri/lss';
import Redis from 'ioredis';

const redis = new Redis();
const storage = new RedisSessionStorage(redis);
const lss = new LSS({ coherenceWindow: 8, storage });

await lss.store('thread-42', lce);
const metrics = await lss.getMetrics('thread-42');

lss.on('drift', (event) => console.log(event.type, event.details));
await lss.updateMetrics('thread-42', { coherence: metrics!.coherence });

const stats = await lss.getStats();
```

### Python

```python
from redis import Redis

from lri.lss import LSS, RedisSessionStorage
from lri.types import LCE, Intent, Policy

redis = Redis.from_url("redis://localhost:6379/0")
lss = LSS(coherence_window=8, storage=RedisSessionStorage(redis))

lss.store("thread-42", LCE(intent=Intent(type="ask"), policy=Policy(consent="team")))
metrics = lss.get_metrics("thread-42")

lss.on("drift", lambda event: print(event.type, event.details))
lss.update_metrics("thread-42", coherence=metrics.coherence)

stats = lss.get_stats()
```

## Message flow example

1. Client produces an `LCE` for each utterance and writes it into LSS using the
   thread identifier.
2. LSS recalculates coherence after every message and emits drift events when
   thresholds are crossed.
3. Application logic can inspect `getMetrics` to adapt responses (e.g. request
   clarification when coherence drops) or archive sessions when `getStats`
   shows stale activity.

## Integration example

```ts
// Express middleware snippet
import type { Request, Response, NextFunction } from 'express';
import { LSS } from 'node-lri/lss';

const lss = new LSS();

export async function attachLss(req: Request, res: Response, next: NextFunction) {
  const threadId = req.body?.lce?.memory?.thread;
  if (threadId) {
    await lss.store(threadId, req.body.lce);
    const metrics = await lss.getMetrics(threadId);
    res.locals.coherence = metrics?.coherence.overall ?? 1;

    res.on('finish', async () => {
      const stats = await lss.getStats();
      console.log('live sessions', stats.sessionCount);
    });
  }

  next();
}
```

```python
# FastAPI dependency example
from fastapi import Depends, FastAPI, Request

from lri.lss import LSS
from lri.types import LCE

lss = LSS()
app = FastAPI()


async def session_context(request: Request) -> dict[str, float]:
    payload = await request.json()
    lce = payload.get("lce")
    thread = lce.get("memory", {}).get("thread") if lce else None
    if thread:
        lss.store(thread, LCE.model_validate(lce))
        metrics = lss.get_metrics(thread)
        return {"coherence": metrics.coherence.overall if metrics else 1.0}
    return {"coherence": 1.0}


@app.post("/respond")
async def respond(ctx = Depends(session_context)):
    if ctx["coherence"] < 0.5:
        return {"message": "Could you clarify?"}
    return {"message": "Acknowledged."}
```
