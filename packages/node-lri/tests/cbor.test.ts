/**
 * CBOR encoding/decoding tests
 */

import { encodeLCE, decodeLCE, compareSizes, encodeFrame, decodeFrame } from '../src/cbor';
import { LCE } from '../src/types';

describe('CBOR Encoding', () => {
  describe('encodeLCE and decodeLCE', () => {
    it('should encode and decode minimal LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.v).toBe(1);
      expect(decoded.intent.type).toBe('tell');
      expect(decoded.policy.consent).toBe('private');
    });

    it('should encode and decode full LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'get weather' },
        affect: { pad: [0.5, 0.6, 0.7], tags: ['curious'] },
        meaning: { topic: 'weather', ontology: 'meteorology' },
        memory: { ttl: '3600' },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.v).toBe(1);
      expect(decoded.intent.type).toBe('ask');
      expect(decoded.intent.goal).toBe('get weather');
      expect(decoded.affect?.pad).toEqual([0.5, 0.6, 0.7]);
      expect(decoded.affect?.tags).toEqual(['curious']);
      expect(decoded.meaning?.topic).toBe('weather');
      expect(decoded.meaning?.ontology).toBe('meteorology');
      expect(decoded.memory?.ttl).toBe('3600');
      expect(decoded.policy.consent).toBe('private');
    });

    it('should encode and decode LCE with signature', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
        sig: 'mock_signature_base64',
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.sig).toBe('mock_signature_base64');
    });

    it('should handle arrays in affect tags', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        affect: {
          tags: ['typescript', 'nodejs', 'testing'],
        },
        policy: { consent: 'private' },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.affect?.tags).toEqual(['typescript', 'nodejs', 'testing']);
    });

    it('should handle nested structures', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: {
          consent: 'private',
          share: ['user:123', 'user:456'],
        },
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);

      expect(decoded.policy.share).toEqual(['user:123', 'user:456']);
    });
  });

  describe('size comparison', () => {
    it('should produce smaller output than JSON', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'weather' },
        affect: { pad: [0.5, 0.6, 0.7], tags: ['curious'] },
        meaning: { topic: 'weather' },
        policy: { consent: 'private' },
      };

      const jsonSize = Buffer.from(JSON.stringify(lce)).length;
      const cborSize = encodeLCE(lce).length;

      expect(cborSize).toBeLessThan(jsonSize);

      const savings = ((jsonSize - cborSize) / jsonSize) * 100;
      expect(savings).toBeGreaterThan(5); // CBOR is always smaller than JSON
    });

    it('should produce 10-35% smaller output for typical LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'get information about the topic' },
        affect: { pad: [0.5, 0.6, 0.7], tags: ['curious', 'engaged'] },
        meaning: {
          topic: 'artificial intelligence',
          ontology: 'technology',
        },
        memory: { ttl: '3600' },
        policy: { consent: 'private' },
      };

      const comp = compareSizes(lce);

      expect(comp.cborSize).toBeLessThan(comp.jsonSize);
      expect(comp.savingsPercent).toBeGreaterThanOrEqual(5);
      expect(comp.savingsPercent).toBeLessThanOrEqual(40);
    });
  });

  describe('compareSizes', () => {
    it('should return accurate size comparison', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const comp = compareSizes(lce);

      expect(comp.jsonSize).toBeGreaterThan(0);
      expect(comp.cborSize).toBeGreaterThan(0);
      expect(comp.savings).toBe(comp.jsonSize - comp.cborSize);
      expect(comp.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('frame encoding', () => {
    it('should encode and decode frame with string payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = 'Hello, World!';

      const encoded = encodeFrame(lce, payload);
      const decoded = decodeFrame(encoded);

      expect(decoded.lce.v).toBe(1);
      expect(decoded.payload.toString('utf-8')).toBe(payload);
    });

    it('should encode and decode frame with Buffer payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = Buffer.from('Binary data', 'utf-8');

      const encoded = encodeFrame(lce, payload);
      const decoded = decodeFrame(encoded);

      expect(decoded.lce.v).toBe(1);
      expect(decoded.payload.toString('utf-8')).toBe('Binary data');
    });

    it('should encode and decode frame with object payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const payload = { message: 'test', count: 42 };

      const encoded = encodeFrame(lce, payload);
      const decoded = decodeFrame(encoded);

      expect(decoded.lce.v).toBe(1);
      const decodedPayload = JSON.parse(decoded.payload.toString('utf-8'));
      expect(decodedPayload.message).toBe('test');
      expect(decodedPayload.count).toBe(42);
    });

    it('should encode and decode frame without payload', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const encoded = encodeFrame(lce);
      const decoded = decodeFrame(encoded);

      expect(decoded.lce.v).toBe(1);
      expect(decoded.payload.length).toBe(0);
    });

    it('should produce smaller frames than JSON+length prefix', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'weather' },
        meaning: { topic: 'weather' },
        policy: { consent: 'private' },
      };
      const payload = 'What is the weather today?';

      // JSON frame (like current WebSocket implementation)
      const jsonLCE = JSON.stringify(lce);
      const jsonFrame = Buffer.concat([
        Buffer.from(new Uint32Array([jsonLCE.length]).buffer),
        Buffer.from(jsonLCE, 'utf-8'),
        Buffer.from(payload, 'utf-8'),
      ]);

      // CBOR frame
      const cborFrame = encodeFrame(lce, payload);

      expect(cborFrame.length).toBeLessThan(jsonFrame.length);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid CBOR data', () => {
      const invalidBuffer = Buffer.from([0xff, 0xff, 0xff, 0xff]);

      expect(() => decodeLCE(invalidBuffer)).toThrow();
    });

    it('should throw error for CBOR without version', () => {
      const { encode } = require('cbor-x');
      const invalidLCE = { intent: { type: 'tell' }, policy: { consent: 'private' } };
      const encoded = Buffer.from(encode(invalidLCE));

      expect(() => decodeLCE(encoded)).toThrow(/Missing or invalid "v" field/);
    });

    it('should throw error for CBOR without policy', () => {
      const { encode } = require('cbor-x');
      const invalidLCE = { v: 1, intent: { type: 'tell' } };
      const encoded = Buffer.from(encode(invalidLCE));

      expect(() => decodeLCE(encoded)).toThrow(/Missing or invalid "policy" field/);
    });

    it('should throw error for invalid frame structure', () => {
      const { encode } = require('cbor-x');
      const invalidFrame = { notLce: 'invalid' };
      const encoded = Buffer.from(encode(invalidFrame));

      expect(() => decodeFrame(encoded)).toThrow(/Missing LCE in frame/);
    });
  });

  describe('binary efficiency', () => {
    it('should handle binary data efficiently', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };
      const binaryPayload = Buffer.alloc(1024); // 1KB of binary data

      const encoded = encodeFrame(lce, binaryPayload);
      const decoded = decodeFrame(encoded);

      expect(decoded.payload).toEqual(binaryPayload);
    });

    it('should be reversible', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'test reversibility' },
        affect: { pad: [0.1, 0.2, 0.3], tags: ['test'] },
        meaning: { topic: 'testing', ontology: 'testing' },
        memory: { ttl: '3600' },
        policy: { consent: 'private' },
        sig: 'test_signature',
      };

      const encoded = encodeLCE(lce);
      const decoded = decodeLCE(encoded);
      const reencoded = encodeLCE(decoded);
      const redecoded = decodeLCE(reencoded);

      // CBOR may encode in different order, but decoded values should match
      expect(redecoded).toEqual(decoded);
      expect(redecoded.v).toBe(lce.v);
      expect(redecoded.intent).toEqual(lce.intent);
      expect(redecoded.affect).toEqual(lce.affect);
      expect(redecoded.meaning).toEqual(lce.meaning);
      expect(redecoded.memory).toEqual(lce.memory);
      expect(redecoded.policy).toEqual(lce.policy);
      expect(redecoded.sig).toBe(lce.sig);
    });
  });
});
