/**
 * Tests for Awareness Layer (Padmasambhava-inspired)
 *
 * Tests presence, clarity, distraction, and engagement metrics
 */

import { LSS, LSSMessage } from '../src/lss';
import { LCE } from '../src/types';

describe('Awareness Layer', () => {
  let lss: LSS;

  beforeEach(() => {
    lss = new LSS();
  });

  afterEach(() => {
    lss.destroy();
  });

  describe('calculateAwareness', () => {
    it('should return perfect awareness for empty history', () => {
      const awareness = lss.calculateAwareness([]);
      expect(awareness.presence).toBe(1.0);
      expect(awareness.clarity).toBe(1.0);
      expect(awareness.distraction).toBe(0.0);
      expect(awareness.engagement).toBe(1.0);
      expect(awareness.overall).toBe(1.0);
    });

    it('should track presence based on timing consistency', async () => {
      const threadId = 'test-presence';
      const now = Date.now();

      // Consistent timing = high presence
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          policy: { consent: 'private' },
        };

        await lss.store(threadId, lce);

        // Wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();
      expect(session!.awareness.presence).toBeGreaterThan(0.5);
    });

    it('should detect distraction from topic jumping', async () => {
      const threadId = 'test-distraction';

      // Jump between 5 different topics = higher distraction
      const topics = ['programming', 'cooking', 'sports', 'history', 'music'];
      for (const topic of topics) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'ask' },
          meaning: { topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();
      // Distraction increases with topic jumps (should be > 0.25)
      expect(session!.awareness.distraction).toBeGreaterThan(0.25);
    });

    it('should measure clarity from coherence', async () => {
      const threadId = 'test-clarity';

      // Same topic = high clarity
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'ask' },
          meaning: { topic: 'programming' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();
      expect(session!.awareness.clarity).toBeGreaterThan(0.7);
    });

    it('should track engagement from message patterns', async () => {
      const threadId = 'test-engagement';

      // Ask-tell pattern = high engagement
      const intents = ['ask', 'tell', 'ask', 'tell', 'ask', 'tell'];
      for (const intent of intents) {
        const lce: LCE = {
          v: 1,
          intent: { type: intent as any },
          meaning: { topic: 'programming' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();
      expect(session!.awareness.engagement).toBeGreaterThan(0.3);
    });

    it('should calculate overall awareness from components', async () => {
      const threadId = 'test-overall';

      // Coherent conversation
      for (let i = 0; i < 10; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: i % 2 === 0 ? 'ask' : 'tell' },
          meaning: { topic: 'programming' },
          affect: { pad: [0.7, 0.6, 0.5], tags: ['curious'] },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();

      // Overall should be combination of components
      const a = session!.awareness;
      const expected = ((a.presence + a.clarity + a.engagement) / 3) * (1 - a.distraction);
      expect(Math.abs(a.overall - expected)).toBeLessThan(0.01);
    });
  });

  describe('Presence calculation', () => {
    it('should decay presence over time', async () => {
      const threadId = 'test-presence-decay';

      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store(threadId, lce);

      // Presence should still be high immediately
      let session = await lss.getSession(threadId);
      expect(session!.awareness.presence).toBeGreaterThan(0.9);

      // Wait and add another message - presence might decay slightly
      await new Promise((resolve) => setTimeout(resolve, 200));
      await lss.store(threadId, lce);

      session = await lss.getSession(threadId);
      // Should still be high with recent activity
      expect(session!.awareness.presence).toBeGreaterThan(0.7);
    });

    it('should reward consistent timing', async () => {
      const threadId = 'test-timing';

      // Regular intervals
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.presence).toBeGreaterThan(0.5);
    });
  });

  describe('Clarity calculation', () => {
    it('should be high for semantically aligned conversation', async () => {
      const threadId = 'test-semantic-clarity';

      // All same topic
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic: 'typescript' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.clarity).toBeGreaterThan(0.7);
    });

    it('should be lower when topics jump around', async () => {
      const threadId = 'test-unclear';

      // Different topics
      const topics = ['a', 'b', 'c', 'd'];
      for (const topic of topics) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      // Clarity decreases with topic jumps
      expect(session!.awareness.clarity).toBeLessThan(0.7);
    });
  });

  describe('Distraction calculation', () => {
    it('should be low for focused conversation', async () => {
      const threadId = 'test-focused';

      // Same topic, same intent
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'ask' },
          meaning: { topic: 'programming' },
          affect: { pad: [0.7, 0.6, 0.5], tags: ['curious'] },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.distraction).toBeLessThan(0.3);
    });

    it('should be high for scattered conversation', async () => {
      const threadId = 'test-scattered';

      // Random topics, intents, affects
      const configs = [
        { topic: 'a', intent: 'ask', pad: [0.1, 0.2, 0.3] },
        { topic: 'b', intent: 'plan', pad: [0.9, 0.8, 0.1] },
        { topic: 'c', intent: 'notify', pad: [0.2, 0.9, 0.7] },
        { topic: 'd', intent: 'sync', pad: [0.8, 0.1, 0.9] },
        { topic: 'e', intent: 'reflect', pad: [0.3, 0.7, 0.2] },
      ];

      for (const config of configs) {
        const lce: LCE = {
          v: 1,
          intent: { type: config.intent as any },
          meaning: { topic: config.topic },
          affect: { pad: config.pad as [number, number, number], tags: [] },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.distraction).toBeGreaterThan(0.4);
    });
  });

  describe('Engagement calculation', () => {
    it('should reward ask-tell patterns', async () => {
      const threadId = 'test-patterns';

      // Alternating ask-tell
      for (let i = 0; i < 10; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: i % 2 === 0 ? 'ask' : 'tell' },
          meaning: { topic: 'programming' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.engagement).toBeGreaterThan(0.3);
    });

    it('should reward intent diversity (but not chaos)', async () => {
      const threadId = 'test-diversity';

      // Variety of intents on same topic
      const intents = ['ask', 'tell', 'propose', 'confirm'];
      for (const intent of intents) {
        const lce: LCE = {
          v: 1,
          intent: { type: intent as any },
          meaning: { topic: 'project' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const session = await lss.getSession(threadId);
      expect(session!.awareness.engagement).toBeGreaterThan(0.3);
    });
  });

  describe('Stats integration', () => {
    it('should include awareness in session stats', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce);
      await lss.store('thread-2', lce);

      const stats = lss.getStats();
      expect(stats.averageAwareness).toBeDefined();
      expect(stats.averageAwareness.presence).toBeGreaterThanOrEqual(0);
      expect(stats.averageAwareness.clarity).toBeGreaterThanOrEqual(0);
      expect(stats.averageAwareness.distraction).toBeGreaterThanOrEqual(0);
      expect(stats.averageAwareness.engagement).toBeGreaterThanOrEqual(0);
      expect(stats.averageAwareness.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle single message', async () => {
      const threadId = 'single';
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store(threadId, lce);
      const session = await lss.getSession(threadId);

      // Single message should have default/high awareness
      expect(session!.awareness.presence).toBe(1.0);
      expect(session!.awareness.clarity).toBe(1.0);
      expect(session!.awareness.distraction).toBe(0.0);
      expect(session!.awareness.engagement).toBe(1.0);
    });

    it('should clamp all values between 0 and 1', async () => {
      const threadId = 'clamp-test';

      // Extreme conditions
      for (let i = 0; i < 20; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: ['ask', 'tell', 'plan', 'sync', 'notify'][i % 5] as any },
          meaning: { topic: `topic-${i}` },
          affect: {
            pad: [Math.random(), Math.random(), Math.random()] as [number, number, number],
            tags: [],
          },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      const a = session!.awareness;

      expect(a.presence).toBeGreaterThanOrEqual(0);
      expect(a.presence).toBeLessThanOrEqual(1);
      expect(a.clarity).toBeGreaterThanOrEqual(0);
      expect(a.clarity).toBeLessThanOrEqual(1);
      expect(a.distraction).toBeGreaterThanOrEqual(0);
      expect(a.distraction).toBeLessThanOrEqual(1);
      expect(a.engagement).toBeGreaterThanOrEqual(0);
      expect(a.engagement).toBeLessThanOrEqual(1);
      expect(a.overall).toBeGreaterThanOrEqual(0);
      expect(a.overall).toBeLessThanOrEqual(1);
    });

    it('should handle missing optional fields', async () => {
      const threadId = 'minimal';

      // Minimal LCE without meaning, affect
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce);
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();

      // Should calculate awareness even with missing fields
      const a = session!.awareness;
      expect(a.presence).toBeGreaterThan(0);
      expect(a.clarity).toBeGreaterThan(0);
      expect(a.distraction).toBeGreaterThanOrEqual(0);
      expect(a.engagement).toBeGreaterThan(0);
      expect(a.overall).toBeGreaterThan(0);
    });
  });
});
