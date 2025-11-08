/**
 * Tests for Terma System (hidden insights)
 */

import { LSS } from '../src/lss';
import type { LCE } from '../src/types';

describe('Terma System', () => {
  let lss: LSS;
  const threadId = 'test-thread';

  beforeEach(() => {
    lss = new LSS();
  });

  const createLCE = (intent: string, topic?: string): LCE => ({
    v: 1,
    intent: { type: intent as any },
    meaning: topic ? { topic } : undefined,
    policy: { consent: 'private' },
  });

  describe('hideTerma()', () => {
    it('should hide a terma with current context', async () => {
      // Store a message first
      await lss.store(threadId, createLCE('ask', 'machine learning'), 'What is ML?');

      // Hide a terma
      const termaId = await lss.hideTerma(
        threadId,
        'Machine learning is about training algorithms on data',
        'insight',
        { topicMatch: 0.5 },
        7
      );

      expect(termaId).toMatch(/^terma_\d+_/);

      const termas = await lss.getTermas(threadId);
      expect(termas).toHaveLength(1);
      expect(termas[0]).toMatchObject({
        id: termaId,
        type: 'insight',
        content: 'Machine learning is about training algorithms on data',
        priority: 7,
        revealed: false,
        hiddenContext: {
          topic: 'machine learning',
          intent: 'ask',
        },
      });
    });

    it('should capture current coherence and awareness in context', async () => {
      await lss.store(threadId, createLCE('ask', 'testing'), 'Question 1');
      await lss.store(threadId, createLCE('tell', 'testing'), 'Answer 1');

      const termaId = await lss.hideTerma(threadId, 'Some insight', 'pattern', {}, 5);

      const termas = await lss.getTermas(threadId);
      expect(termas[0].hiddenContext.coherence).toBeGreaterThan(0);
      expect(termas[0].hiddenContext.awareness).toBeGreaterThan(0);
      expect(termas[0].hiddenContext.obstacles).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        lss.hideTerma('non-existent', 'content', 'insight', {}, 5)
      ).rejects.toThrow('Session non-existent not found');
    });
  });

  describe('revealTermas()', () => {
    it('should not reveal terma when conditions not met', async () => {
      await lss.store(threadId, createLCE('ask', 'react'), 'About React?');

      // Hide terma requiring 'vue' topic
      await lss.hideTerma(
        threadId,
        'React uses virtual DOM',
        'insight',
        { topicMatch: 0.8 }, // Need high similarity to 'react'
        5
      );

      // Switch to completely different topic
      await lss.store(threadId, createLCE('ask', 'python django'), 'About Django?');

      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(0);
    });

    it('should reveal terma when topic matches', async () => {
      await lss.store(threadId, createLCE('ask', 'react components'), 'About React?');

      await lss.hideTerma(
        threadId,
        'React uses virtual DOM',
        'insight',
        { topicMatch: 0.3 }, // Low threshold
        5
      );

      // Return to similar topic
      await lss.store(threadId, createLCE('ask', 'react hooks'), 'What about hooks?');

      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
      expect(revealed[0].content).toBe('React uses virtual DOM');
      expect(revealed[0].revealed).toBe(true);
      expect(revealed[0].revealedAt).toBeInstanceOf(Date);
    });

    it('should reveal terma when intent matches', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question?');

      await lss.hideTerma(
        threadId,
        'Important insight',
        'warning',
        { intentMatch: ['tell', 'propose'] },
        5
      );

      // Try with wrong intent
      await lss.store(threadId, createLCE('ask', 'topic2'), 'Another question?');
      let revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(0);

      // Try with correct intent
      await lss.store(threadId, createLCE('tell', 'topic3'), 'Here is info');
      revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
      expect(revealed[0].content).toBe('Important insight');
    });

    it('should reveal terma when coherence threshold met', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question 1');

      await lss.hideTerma(
        threadId,
        'Coherence insight',
        'pattern',
        { coherenceThreshold: 0.7 },
        5
      );

      // Add messages to maintain coherence
      await lss.store(threadId, createLCE('tell', 'topic1'), 'Answer 1');
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Follow-up');

      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
    });

    it('should reveal terma only when obstacles are low enough', async () => {
      // Start with clear messages (low obstacles)
      await lss.store(threadId, createLCE('ask', 'react'), 'What is React?');
      await lss.store(
        threadId,
        createLCE('tell', 'react'),
        'React is a JavaScript library for building user interfaces'
      );

      await lss.hideTerma(
        threadId,
        'Clarity insight',
        'breakthrough',
        { obstaclesThreshold: 0.3 }, // Reveal only when obstacles < 0.3
        5
      );

      // Continue with clear messages (should reveal)
      await lss.store(
        threadId,
        createLCE('ask', 'react'),
        'How does React work?'
      );

      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
      expect(revealed[0].content).toBe('Clarity insight');
    });

    it('should respect time delay condition', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');

      await lss.hideTerma(
        threadId,
        'Delayed insight',
        'insight',
        { timeDelay: 2000 }, // 2 seconds
        5
      );

      // Immediate reveal should not work
      let revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(0);

      // Wait 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2100));

      revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
    });

    it('should reveal termas in priority order', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');

      await lss.hideTerma(threadId, 'Low priority', 'insight', {}, 3);
      await lss.hideTerma(threadId, 'Medium priority', 'pattern', {}, 5);
      await lss.hideTerma(threadId, 'High priority', 'warning', {}, 9);

      await lss.store(threadId, createLCE('tell', 'topic1'), 'Answer');

      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(3);
      expect(revealed[0].content).toBe('High priority');
      expect(revealed[1].content).toBe('Medium priority');
      expect(revealed[2].content).toBe('Low priority');
    });

    it('should not reveal already revealed termas', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');

      await lss.hideTerma(threadId, 'Once only', 'insight', {}, 5);

      await lss.store(threadId, createLCE('tell', 'topic1'), 'Answer');

      let revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);

      // Second call should not reveal again
      revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(0);
    });
  });

  describe('getTermas() and getUnrevealedTermas()', () => {
    it('should get all termas including revealed', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');

      await lss.hideTerma(threadId, 'Terma 1', 'insight', {}, 5);
      await lss.hideTerma(threadId, 'Terma 2', 'pattern', {}, 5);

      await lss.store(threadId, createLCE('tell', 'topic1'), 'Answer');
      await lss.revealTermas(threadId);

      const all = await lss.getTermas(threadId);
      expect(all).toHaveLength(2);
      expect(all.every((t) => t.revealed)).toBe(true);
    });

    it('should get only unrevealed termas', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');

      await lss.hideTerma(threadId, 'Terma 1', 'insight', {}, 5);
      await lss.hideTerma(
        threadId,
        'Terma 2',
        'pattern',
        { intentMatch: ['propose'] },
        5
      );

      await lss.store(threadId, createLCE('tell', 'topic1'), 'Answer');
      await lss.revealTermas(threadId); // Only Terma 1 will be revealed

      const unrevealed = await lss.getUnrevealedTermas(threadId);
      expect(unrevealed).toHaveLength(1);
      expect(unrevealed[0].content).toBe('Terma 2');
    });
  });

  describe('Combined conditions', () => {
    it('should require all conditions to be met', async () => {
      await lss.store(threadId, createLCE('ask', 'machine learning'), 'About ML?');

      await lss.hideTerma(
        threadId,
        'Complex insight',
        'breakthrough',
        {
          topicMatch: 0.5,
          intentMatch: ['tell'],
          coherenceThreshold: 0.6,
        },
        8
      );

      // Topic matches but not intent
      await lss.store(threadId, createLCE('ask', 'machine learning models'), 'More questions?');
      let revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(0);

      // Both topic and intent match
      await lss.store(
        threadId,
        createLCE('tell', 'machine learning algorithms'),
        'ML algorithms learn from data'
      );
      revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty session', async () => {
      await lss.store(threadId, createLCE('ask'), 'Question without topic');

      const termaId = await lss.hideTerma(threadId, 'Insight', 'insight', {}, 5);
      expect(termaId).toBeDefined();

      const termas = await lss.getTermas(threadId);
      expect(termas[0].hiddenContext.topic).toBeUndefined();
    });

    it('should handle no conditions (always reveal)', async () => {
      await lss.store(threadId, createLCE('ask', 'topic1'), 'Question');
      await lss.hideTerma(threadId, 'Always reveal', 'insight', {}, 5);

      await lss.store(threadId, createLCE('tell', 'topic2'), 'Answer');
      const revealed = await lss.revealTermas(threadId);
      expect(revealed).toHaveLength(1);
    });
  });
});
