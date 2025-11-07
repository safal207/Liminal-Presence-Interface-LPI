/**
 * WebSocket types and frame encoding tests
 */

import { LCE } from '../src/types';
import { encodeLRIFrame, parseLRIFrame } from '../src/ws/types';

describe('LRI Frame Encoding', () => {
  describe('encodeLRIFrame', () => {
    it('should encode LCE and string payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = 'Hello, LRI!';

      const frame = encodeLRIFrame(lce, payload);

      expect(frame).toBeInstanceOf(Buffer);
      expect(frame.length).toBeGreaterThan(4);

      // First 4 bytes should be length
      const lceLength = frame.readUInt32BE(0);
      expect(lceLength).toBeGreaterThan(0);

      // LCE JSON should be parseable
      const lceJson = frame.subarray(4, 4 + lceLength).toString('utf-8');
      const parsedLce = JSON.parse(lceJson);
      expect(parsedLce).toEqual(lce);

      // Payload should match
      const payloadData = frame.subarray(4 + lceLength).toString('utf-8');
      expect(payloadData).toBe(payload);
    });

    it('should encode LCE and Buffer payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };
      const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      const frame = encodeLRIFrame(lce, payload);

      const lceLength = frame.readUInt32BE(0);
      const payloadData = frame.subarray(4 + lceLength);

      expect(payloadData).toEqual(payload);
    });

    it('should encode full LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'Test' },
        affect: { pad: [0.5, 0.3, 0.1], tags: ['curious'] },
        memory: { thread: 'test-thread', t: '2025-01-15T10:00:00Z' },
        policy: { consent: 'team', share: ['service-1'] },
        qos: { coherence: 0.9 },
      };
      const payload = 'Full LCE test';

      const frame = encodeLRIFrame(lce, payload);
      const lceLength = frame.readUInt32BE(0);
      const lceJson = frame.subarray(4, 4 + lceLength).toString('utf-8');
      const parsedLce = JSON.parse(lceJson);

      expect(parsedLce).toEqual(lce);
    });

    it('should handle empty payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'notify' },
        policy: { consent: 'private' },
      };
      const payload = '';

      const frame = encodeLRIFrame(lce, payload);
      const lceLength = frame.readUInt32BE(0);

      expect(frame.length).toBe(4 + lceLength);
    });

    it('should handle large payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = 'A'.repeat(10000);

      const frame = encodeLRIFrame(lce, payload);
      const lceLength = frame.readUInt32BE(0);
      const payloadData = frame.subarray(4 + lceLength).toString('utf-8');

      expect(payloadData).toBe(payload);
      expect(payloadData.length).toBe(10000);
    });
  });

  describe('parseLRIFrame', () => {
    it('should parse valid frame', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = 'Test payload';

      const frame = encodeLRIFrame(lce, payload);
      const parsed = parseLRIFrame(frame);

      expect(parsed.lce).toEqual(lce);
      expect(parsed.payload.toString('utf-8')).toBe(payload);
    });

    it('should parse frame with Buffer payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };
      const payload = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

      const frame = encodeLRIFrame(lce, payload);
      const parsed = parseLRIFrame(frame);

      expect(parsed.lce).toEqual(lce);
      expect(parsed.payload).toEqual(payload);
    });

    it('should throw on frame too small', () => {
      const tooSmall = Buffer.from([0x00, 0x00, 0x00]);

      expect(() => parseLRIFrame(tooSmall)).toThrow('Frame too small');
    });

    it('should throw on invalid LCE JSON', () => {
      const buffer = Buffer.alloc(100);
      buffer.writeUInt32BE(10, 0); // Length of 10
      buffer.write('not valid json', 4, 'utf-8');

      expect(() => parseLRIFrame(buffer)).toThrow();
    });

    it('should throw on LCE length mismatch', () => {
      const buffer = Buffer.alloc(100);
      buffer.writeUInt32BE(200, 0); // Claim 200 bytes but buffer is only 100

      expect(() => parseLRIFrame(buffer)).toThrow('Invalid frame');
    });

    it('should handle empty payload after LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'notify' },
        policy: { consent: 'private' },
      };

      const frame = encodeLRIFrame(lce, '');
      const parsed = parseLRIFrame(frame);

      expect(parsed.lce).toEqual(lce);
      expect(parsed.payload.length).toBe(0);
    });

    it('should round-trip encode/decode', () => {
      const testCases: Array<{ lce: LCE; payload: string | Buffer }> = [
        {
          lce: { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
          payload: 'Simple message',
        },
        {
          lce: {
            v: 1,
            intent: { type: 'ask', goal: 'Complex' },
            affect: { pad: [0.1, 0.2, 0.3], tags: ['test'] },
            policy: { consent: 'team' },
          },
          payload: 'Complex message',
        },
        {
          lce: { v: 1, intent: { type: 'sync' }, policy: { consent: 'public' } },
          payload: Buffer.from([1, 2, 3, 4, 5]),
        },
      ];

      testCases.forEach(({ lce, payload }) => {
        const frame = encodeLRIFrame(lce, payload);
        const parsed = parseLRIFrame(frame);

        expect(parsed.lce).toEqual(lce);

        if (typeof payload === 'string') {
          expect(parsed.payload.toString('utf-8')).toBe(payload);
        } else {
          expect(parsed.payload).toEqual(payload);
        }
      });
    });
  });
});
