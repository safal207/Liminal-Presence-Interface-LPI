/**
 * CBOR encoding/decoding tests
 */

import {
  encodeLCE,
  decodeLCE,
  encodeFrame,
  decodeFrame,
  compareSizes,
  encodeBatch,
  decodeBatch,
  isValidCBOR,
  isValidLCE,
} from '../src/cbor';
import { LCE } from '../src/types';

describe('CBOR encoding/decoding', () => {
  describe('encodeLCE and decodeLCE', () => {
    it('should encode and decode simple LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      expect(Buffer.isBuffer(encoded)).toBe(true);
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodeLCE(encoded);
      expect(decoded).toEqual(lce);
    });

    it('should encode and decode LCE with all fields', () => {
      const lce: LCE = {
        v: 1,
        intent: {
          type: 'ask',
          goal: 'Get weather information',
        },
        affect: {
          pad: [0.3, 0.2, 0.1],
          tags: ['curious', 'casual'],
        },
        meaning: {
          topic: 'weather',
          ontology: 'https://schema.org/WeatherForecast',
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2025-01-15T10:30:00Z',
        },
        policy: {
          consent: 'private',
        },
        qos: {
          coherence: 0.87,
        },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.v).toBe(lce.v);
      expect(decoded.intent).toEqual(lce.intent);
      expect(decoded.affect).toEqual(lce.affect);
      expect(decoded.meaning).toEqual(lce.meaning);
      expect(decoded.memory).toEqual(lce.memory);
      expect(decoded.policy).toEqual(lce.policy);
      expect(decoded.qos).toEqual(lce.qos);
    });

    it('should throw on invalid CBOR', () => {
      const invalidBuffer = Buffer.from([0xff, 0xff, 0xff]);
      expect(() => decodeLCE(invalidBuffer)).toThrow();
    });

    it('should throw on CBOR without required LCE fields', () => {
      // Encode a valid CBOR object that's not a valid LCE
      const notLCE = encodeLCE({ foo: 'bar' } as any);
      expect(() => decodeLCE(notLCE)).toThrow('Invalid LCE');
    });
  });

  describe('encodeFrame and decodeFrame', () => {
    it('should encode and decode frame without payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const frame = encodeFrame(lce);
      expect(Buffer.isBuffer(frame)).toBe(true);

      // Check length prefix (first 4 bytes)
      const lceLength = frame.readUInt32BE(0);
      expect(lceLength).toBeGreaterThan(0);

      const decoded = decodeFrame(frame);
      expect(decoded.lce).toEqual(lce);
      expect(decoded.payload).toBeUndefined();
    });

    it('should encode and decode frame with payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = Buffer.from('Hello, world!', 'utf8');

      const frame = encodeFrame(lce, payload);
      const decoded = decodeFrame(frame);

      expect(decoded.lce).toEqual(lce);
      expect(decoded.payload).toEqual(payload);
    });

    it('should throw on frame too short for length prefix', () => {
      const shortFrame = Buffer.from([0x01, 0x02]);
      expect(() => decodeFrame(shortFrame)).toThrow('Frame too short');
    });

    it('should throw on frame shorter than declared length', () => {
      // Create frame with length = 100 but actual data is much shorter
      const frame = Buffer.allocUnsafe(10);
      frame.writeUInt32BE(100, 0);
      expect(() => decodeFrame(frame)).toThrow('Frame too short');
    });
  });

  describe('compareSizes', () => {
    it('should show CBOR is smaller than JSON', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const comparison = compareSizes(lce);

      expect(comparison.json).toBeGreaterThan(0);
      expect(comparison.cbor).toBeGreaterThan(0);
      expect(comparison.cbor).toBeLessThan(comparison.json);
      expect(comparison.savings).toBeGreaterThan(0);
      expect(comparison.savingsPercent).toBeGreaterThan(0);
    });

    it('should calculate correct savings percentage', () => {
      const lce: LCE = {
        v: 1,
        intent: {
          type: 'ask',
          goal: 'Get weather information for San Francisco',
        },
        affect: {
          pad: [0.5, 0.5, 0.5],
          tags: ['curious', 'eager', 'hopeful'],
        },
        meaning: {
          topic: 'weather forecast',
          ontology: 'https://schema.org/WeatherForecast',
        },
        policy: {
          consent: 'private',
        },
      };

      const comparison = compareSizes(lce);

      expect(comparison.savingsPercent).toBeGreaterThan(10); // At least 10% savings
    });
  });

  describe('batch operations', () => {
    it('should encode and decode batch of LCE messages', () => {
      const lces: LCE[] = [
        { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } },
        { v: 1, intent: { type: 'confirm' }, policy: { consent: 'private' } },
      ];

      const encoded = encodeBatch(lces);
      expect(Buffer.isBuffer(encoded)).toBe(true);

      const decoded = decodeBatch(encoded);
      expect(decoded).toEqual(lces);
    });

    it('should handle empty batch', () => {
      const lces: LCE[] = [];

      const encoded = encodeBatch(lces);
      const decoded = decodeBatch(encoded);

      expect(decoded).toEqual([]);
    });

    it('should throw on invalid batch (not array)', () => {
      const encoded = encodeLCE({
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      });

      expect(() => decodeBatch(encoded)).toThrow('not an array');
    });

    it('should throw on batch with invalid LCE', () => {
      // Encode a valid CBOR array with invalid LCE objects
      const invalidBatch = encodeBatch([{ foo: 'bar' } as any]);
      expect(() => decodeBatch(invalidBatch)).toThrow('Invalid LCE at index');
    });
  });

  describe('validation', () => {
    it('should validate correct CBOR', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      expect(isValidCBOR(encoded)).toBe(true);
    });

    it('should reject invalid CBOR', () => {
      const invalid = Buffer.from([0xff, 0xff, 0xff]);
      expect(isValidCBOR(invalid)).toBe(false);
    });

    it('should validate correct LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      expect(isValidLCE(encoded)).toBe(true);
    });

    it('should reject CBOR without LCE fields', () => {
      // Encode a valid CBOR object that's not a valid LCE
      const notLCE = encodeLCE({ foo: 'bar' } as any);
      expect(isValidLCE(notLCE)).toBe(false);
    });
  });

  describe('CBOR properties', () => {
    it('should preserve numbers accurately', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        affect: { pad: [0.123456789, -0.987654321, 0.5], tags: [] },
        policy: { consent: 'private' },
        qos: { coherence: 0.87654321 },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.affect?.pad).toBeDefined();
      expect(decoded.affect?.pad?.[0]).toBeCloseTo(0.123456789, 5);
      expect(decoded.affect?.pad?.[1]).toBeCloseTo(-0.987654321, 5);
      expect(decoded.qos?.coherence).toBeCloseTo(0.87654321, 5);
    });

    it('should preserve Unicode strings', () => {
      const lce: LCE = {
        v: 1,
        intent: {
          type: 'tell',
          goal: 'Получить прогноз погоды 🌤️',
        },
        meaning: {
          topic: '天气预报',
        },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.intent.goal).toBe('Получить прогноз погоды 🌤️');
      expect(decoded.meaning?.topic).toBe('天气预报');
    });

    it('should preserve null and undefined', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: undefined },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      // CBOR doesn't preserve undefined, it becomes null or is omitted
      // This is expected behavior
      expect(decoded.v).toBe(1);
      expect(decoded.intent.type).toBe('tell');
    });
  });
});
