/**
 * Tests for Obstacle Detector (antarāya - Buddhist concept of impediments)
 *
 * Tests vagueness, contradiction, semantic gaps, and comprehension barriers
 */

import { LSS, LSSMessage } from '../src/lss';
import { LCE } from '../src/types';

describe('Obstacle Detector', () => {
  let lss: LSS;

  beforeEach(() => {
    lss = new LSS();
  });

  afterEach(() => {
    lss.destroy();
  });

  describe('calculateObstacles', () => {
    it('should return zero obstacles for empty history', () => {
      const obstacles = lss.calculateObstacles([]);
      expect(obstacles.vagueness).toBe(0.0);
      expect(obstacles.contradiction).toBe(0.0);
      expect(obstacles.semanticGap).toBe(0.0);
      expect(obstacles.comprehensionBarrier).toBe(0.0);
      expect(obstacles.overall).toBe(0.0);
    });

    it('should track obstacles in session', async () => {
      const threadId = 'test-obstacles';

      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        meaning: { topic: 'test' },
        policy: { consent: 'private' },
      };

      await lss.store(threadId, lce, 'Test message');

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();
      expect(session!.obstacles).toBeDefined();
      expect(session!.obstacles.vagueness).toBeGreaterThanOrEqual(0);
      expect(session!.obstacles.contradiction).toBeGreaterThanOrEqual(0);
      expect(session!.obstacles.semanticGap).toBeGreaterThanOrEqual(0);
      expect(session!.obstacles.comprehensionBarrier).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Vagueness detection', () => {
    it('should detect vague words', async () => {
      const threadId = 'test-vagueness';

      // Messages with vague language
      const vagueMessages = [
        'I need to do something with that thing',
        'Maybe we should do stuff',
        'Kind of like whatever you think',
      ];

      for (const msg of vagueMessages) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic: 'general' }, // Generic topic
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, msg);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.vagueness).toBeGreaterThan(0.4);
    });

    it('should have low vagueness for specific messages', async () => {
      const threadId = 'test-specific';

      const specificMessages = [
        'I need to refactor the UserService class',
        'The bug is in line 42 of auth.ts',
        'Deploy version 2.1.3 to production',
      ];

      for (const msg of specificMessages) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic: 'software-development' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, msg);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.vagueness).toBeLessThan(0.3);
    });
  });

  describe('Contradiction detection', () => {
    it('should detect contradicting intents on same topic', async () => {
      const threadId = 'test-contradiction';

      // Propose then disagree on same topic
      const messages = [
        { intent: 'propose', topic: 'deployment', text: 'Let\'s deploy to production' },
        { intent: 'disagree', topic: 'deployment', text: 'Actually no, let\'s not' },
        { intent: 'agree', topic: 'testing', text: 'Yes, test it' },
        { intent: 'disagree', topic: 'testing', text: 'No, don\'t test' },
      ];

      for (const msg of messages) {
        const lce: LCE = {
          v: 1,
          intent: { type: msg.intent as any },
          meaning: { topic: msg.topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, msg.text);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.contradiction).toBeGreaterThan(0.3);
    });

    it('should detect affect polarity flips', async () => {
      const threadId = 'test-affect-flip';

      // Strong emotional swing
      const messages = [
        { pad: [-0.7, 0.5, 0.3], text: 'This is terrible' },
        { pad: [0.8, 0.6, 0.4], text: 'Actually it\'s great!' },
      ];

      for (const msg of messages) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          affect: { pad: msg.pad as [number, number, number], tags: [] },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, msg.text);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.contradiction).toBeGreaterThan(0.2);
    });

    it('should have low contradiction for consistent conversation', async () => {
      const threadId = 'test-consistent';

      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic: 'project' },
          affect: { pad: [0.6, 0.5, 0.4], tags: ['positive'] },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, `Message ${i} about project`);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.contradiction).toBeLessThan(0.2);
    });
  });

  describe('Semantic gap detection', () => {
    it('should detect abrupt topic changes', async () => {
      const threadId = 'test-gaps';

      // Completely unrelated topics
      const topics = ['quantum-physics', 'cooking-recipes', 'car-repair', 'poetry'];

      for (const topic of topics) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, `Message about ${topic}`);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.semanticGap).toBeGreaterThan(0.4);
    });

    it('should detect unanswered questions', async () => {
      const threadId = 'test-unanswered';

      // Ask but don't answer
      const messages = [
        { intent: 'ask', topic: 'deployment' },
        { intent: 'plan', topic: 'deployment' }, // Should be 'tell' to answer
        { intent: 'ask', topic: 'testing' },
        { intent: 'notify', topic: 'testing' }, // Not an answer
      ];

      for (const msg of messages) {
        const lce: LCE = {
          v: 1,
          intent: { type: msg.intent as any },
          meaning: { topic: msg.topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, 'Message');
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.semanticGap).toBeGreaterThan(0.3);
    });

    it('should have low gap for related topics with common words', async () => {
      const threadId = 'test-related';

      // Related topics with overlapping words
      const topics = ['react components', 'components testing', 'testing setup'];

      for (const topic of topics) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, `Message about ${topic}`);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.semanticGap).toBeLessThan(0.5);
    });
  });

  describe('Comprehension barrier detection', () => {
    it('should detect very long messages', async () => {
      const threadId = 'test-long';

      // Very long message (>100 words)
      const longMessage = 'word '.repeat(150); // 150 words

      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        meaning: { topic: 'explanation' },
        policy: { consent: 'private' },
      };

      await lss.store(threadId, lce, longMessage);

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.comprehensionBarrier).toBeGreaterThan(0.2);
    });

    it('should detect deeply nested structures', async () => {
      const threadId = 'test-nested';

      // Deeply nested object
      const complexPayload = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'deep',
                },
              },
            },
          },
        },
      };

      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        meaning: { topic: 'data' },
        policy: { consent: 'private' },
      };

      await lss.store(threadId, lce, complexPayload);

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.comprehensionBarrier).toBeGreaterThan(0.1);
    });

    it('should have low barrier for simple messages', async () => {
      const threadId = 'test-simple';

      const simpleMessages = ['Yes', 'No problem', 'Got it'];

      for (const msg of simpleMessages) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'confirm' },
          meaning: { topic: 'response' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, msg);
      }

      const session = await lss.getSession(threadId);
      expect(session!.obstacles.comprehensionBarrier).toBeLessThan(0.2);
    });
  });

  describe('Overall obstacles calculation', () => {
    it('should calculate overall from components', async () => {
      const threadId = 'test-overall';

      // Create messages with various obstacles
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          meaning: { topic: `topic-${i}` },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, 'maybe something stuff whatever');
      }

      const session = await lss.getSession(threadId);
      const o = session!.obstacles;

      // Overall should be average of components
      const expected = (o.vagueness + o.contradiction + o.semanticGap + o.comprehensionBarrier) / 4;
      expect(Math.abs(o.overall - expected)).toBeLessThan(0.01);
    });
  });

  describe('Stats integration', () => {
    it('should include obstacles in session stats', async () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      await lss.store('thread-1', lce, 'Test');
      await lss.store('thread-2', lce, 'Test');

      const stats = lss.getStats();
      expect(stats.averageObstacles).toBeDefined();
      expect(stats.averageObstacles.vagueness).toBeGreaterThanOrEqual(0);
      expect(stats.averageObstacles.contradiction).toBeGreaterThanOrEqual(0);
      expect(stats.averageObstacles.semanticGap).toBeGreaterThanOrEqual(0);
      expect(stats.averageObstacles.comprehensionBarrier).toBeGreaterThanOrEqual(0);
      expect(stats.averageObstacles.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge cases', () => {
    it('should clamp all values between 0 and 1', async () => {
      const threadId = 'test-clamp';

      // Extreme messages
      for (let i = 0; i < 20; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: i % 2 === 0 ? 'propose' : 'disagree' },
          meaning: { topic: `topic-${i}` },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, 'maybe stuff thing whatever');
      }

      const session = await lss.getSession(threadId);
      const o = session!.obstacles;

      expect(o.vagueness).toBeGreaterThanOrEqual(0);
      expect(o.vagueness).toBeLessThanOrEqual(1);
      expect(o.contradiction).toBeGreaterThanOrEqual(0);
      expect(o.contradiction).toBeLessThanOrEqual(1);
      expect(o.semanticGap).toBeGreaterThanOrEqual(0);
      expect(o.semanticGap).toBeLessThanOrEqual(1);
      expect(o.comprehensionBarrier).toBeGreaterThanOrEqual(0);
      expect(o.comprehensionBarrier).toBeLessThanOrEqual(1);
      expect(o.overall).toBeGreaterThanOrEqual(0);
      expect(o.overall).toBeLessThanOrEqual(1);
    });

    it('should handle messages without meaning or affect', async () => {
      const threadId = 'test-minimal';

      // Minimal LCE
      for (let i = 0; i < 5; i++) {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell' },
          policy: { consent: 'private' },
        };
        await lss.store(threadId, lce, 'Message');
      }

      const session = await lss.getSession(threadId);
      expect(session).not.toBeNull();

      const o = session!.obstacles;
      expect(o.vagueness).toBeGreaterThanOrEqual(0);
      expect(o.contradiction).toBeGreaterThanOrEqual(0);
      expect(o.semanticGap).toBeGreaterThanOrEqual(0);
      expect(o.comprehensionBarrier).toBeGreaterThanOrEqual(0);
      expect(o.overall).toBeGreaterThanOrEqual(0);
    });
  });
});
