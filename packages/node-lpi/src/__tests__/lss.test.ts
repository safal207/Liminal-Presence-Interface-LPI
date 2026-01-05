import { LSS } from '../lss';
import { LCE } from '../types';

describe('LSS', () => {
  const baseLce = (intentType: LCE['intent']['type'], pad: [number, number, number], topic: string): LCE => ({
    v: 1,
    intent: { type: intentType },
    affect: { pad },
    meaning: { topic },
    policy: { consent: 'team' },
  });

  const createStore = () => new LSS({ coherenceWindow: 5, driftMinCoherence: 0.6, driftDropThreshold: 0.15 });

  it('stores messages and calculates coherence metrics', async () => {
    const store = createStore();
    await store.store('thread-1', baseLce('ask', [0.1, 0.1, 0.1], 'planning'));
    await store.store('thread-1', baseLce('tell', [0.15, 0.12, 0.1], 'planning'));

    const session = await store.getSession('thread-1');
    expect(session).not.toBeNull();
    expect(session?.messages).toHaveLength(2);

    const metrics = await store.getMetrics('thread-1');
    expect(metrics).not.toBeNull();
    expect(metrics?.coherence.overall).toBeGreaterThan(0);
    expect(metrics?.coherence.intentSimilarity).toBeGreaterThan(0);

    store.destroy();
  });

  it('emits drift events when coherence drops', async () => {
    const store = createStore();
    const events: any[] = [];
    store.on('drift', (event) => events.push(event));

    await store.store('thread-2', baseLce('ask', [0.9, 0.9, 0.9], 'status'));
    await store.store('thread-2', baseLce('tell', [0.1, 0.1, 0.1], 'status'));
    await store.store('thread-2', baseLce('plan', [0.9, -0.9, 0.5], 'unrelated'));

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'coherence_drop', threadId: 'thread-2' });

    store.destroy();
  });

  it('detects topic shift drift events within the configured window', async () => {
    const store = new LSS({ topicShiftWindow: 4, driftMinCoherence: 0.1 });
    const events: Array<{ type: string }> = [];
    store.on('drift', (event) => events.push(event));

    const topics = ['alpha', 'beta', 'gamma', 'delta'];
    for (const [index, topic] of topics.entries()) {
      const intent = index === 0 ? 'ask' : 'tell';
      await store.store('topic-thread', baseLce(intent, [0.2, 0.2, 0.2], topic));
    }

    expect(events.some((event) => event.type === 'topic_shift')).toBe(true);

    await store.destroy();
  });

  it('allows manual metric updates', async () => {
    const store = createStore();
    await store.store('thread-3', baseLce('ask', [0.1, 0.1, 0.1], 'sync'));
    await store.store('thread-3', baseLce('tell', [0.1, 0.1, 0.1], 'sync'));

    await store.updateMetrics('thread-3', {
      coherence: {
        overall: 0.75,
        intentSimilarity: 0.7,
        affectStability: 0.8,
        semanticAlignment: 0.75,
      },
    });

    const metrics = await store.getMetrics('thread-3');
    expect(metrics?.coherence.overall).toBeCloseTo(0.75);
    expect(metrics?.previousCoherence?.overall).toBeLessThanOrEqual(1);

    store.destroy();
  });
});
