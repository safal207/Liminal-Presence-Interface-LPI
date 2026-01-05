/**
 * gRPC metadata adapter tests
 */

import * as grpc from '@grpc/grpc-js';
import {
  toLCEMetadata,
  fromLCEMetadata,
  hasLCE,
  removeLCE,
  LCE_METADATA_KEY,
  LCE_METADATA_KEY_BIN,
} from '../src/grpc';
import { LCE } from '../src/types';

describe('gRPC metadata adapter', () => {
  const sampleLCE: LCE = {
    v: 1,
    intent: { type: 'ask', goal: 'Get weather information' },
    affect: { pad: [0.3, 0.2, 0.1], tags: ['curious'] },
    meaning: { topic: 'weather' },
    policy: { consent: 'private' },
  };

  describe('toLCEMetadata', () => {
    it('should encode LCE as JSON in metadata (default)', () => {
      const metadata = toLCEMetadata(sampleLCE);

      expect(metadata).toBeInstanceOf(grpc.Metadata);
      const values = metadata.get(LCE_METADATA_KEY);
      expect(values.length).toBe(1);
      expect(typeof values[0]).toBe('string');

      // Verify it's base64-encoded JSON
      const base64 = values[0] as string;
      const json = Buffer.from(base64, 'base64').toString('utf8');
      const decoded = JSON.parse(json);
      expect(decoded).toMatchObject(sampleLCE);
    });

    it('should encode LCE as JSON when explicitly specified', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');

      const values = metadata.get(LCE_METADATA_KEY);
      expect(values.length).toBe(1);
    });

    it('should encode LCE as CBOR in binary metadata', () => {
      const metadata = toLCEMetadata(sampleLCE, 'cbor');

      const values = metadata.get(LCE_METADATA_KEY_BIN);
      expect(values.length).toBe(1);
      expect(Buffer.isBuffer(values[0])).toBe(true);
    });

    it('should augment existing metadata', () => {
      const existingMetadata = new grpc.Metadata();
      existingMetadata.set('custom-header', 'custom-value');

      const metadata = toLCEMetadata(sampleLCE, 'json', existingMetadata);

      expect(metadata.get('custom-header')).toEqual(['custom-value']);
      expect(metadata.get(LCE_METADATA_KEY).length).toBe(1);
    });

    it('should throw on unsupported encoding', () => {
      expect(() => {
        toLCEMetadata(sampleLCE, 'unsupported' as any);
      }).toThrow('Unsupported encoding');
    });
  });

  describe('fromLCEMetadata', () => {
    it('should decode LCE from JSON metadata', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toMatchObject(sampleLCE);
    });

    it('should decode LCE from CBOR metadata', () => {
      const metadata = toLCEMetadata(sampleLCE, 'cbor');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toMatchObject(sampleLCE);
    });

    it('should prefer CBOR over JSON when both present', () => {
      const metadata = new grpc.Metadata();

      // Add both JSON and CBOR
      const jsonMetadata = toLCEMetadata(sampleLCE, 'json');
      const cborMetadata = toLCEMetadata(
        { ...sampleLCE, intent: { type: 'tell' } },
        'cbor'
      );

      metadata.set(LCE_METADATA_KEY, jsonMetadata.get(LCE_METADATA_KEY)[0] as string);
      metadata.set(
        LCE_METADATA_KEY_BIN,
        cborMetadata.get(LCE_METADATA_KEY_BIN)[0] as Buffer
      );

      const decoded = fromLCEMetadata(metadata);

      // Should decode CBOR (which has "tell" intent, not "ask")
      expect(decoded?.intent.type).toBe('tell');
    });

    it('should return null when no LCE in metadata', () => {
      const metadata = new grpc.Metadata();
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toBeNull();
    });

    it('should throw on invalid JSON LCE', () => {
      const metadata = new grpc.Metadata();
      metadata.set(LCE_METADATA_KEY, Buffer.from('invalid json').toString('base64'));

      expect(() => fromLCEMetadata(metadata)).toThrow('Failed to decode JSON LCE');
    });

    it('should throw on JSON without required LCE fields', () => {
      const metadata = new grpc.Metadata();
      const invalidLCE = { foo: 'bar' };
      const base64 = Buffer.from(JSON.stringify(invalidLCE)).toString('base64');
      metadata.set(LCE_METADATA_KEY, base64);

      expect(() => fromLCEMetadata(metadata)).toThrow('Invalid LCE');
    });

    it('should throw on invalid CBOR LCE', () => {
      const metadata = new grpc.Metadata();
      metadata.set(LCE_METADATA_KEY_BIN, Buffer.from([0xff, 0xff, 0xff]));

      expect(() => fromLCEMetadata(metadata)).toThrow('Failed to decode CBOR LCE');
    });
  });

  describe('hasLCE', () => {
    it('should return true when JSON LCE present', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');
      expect(hasLCE(metadata)).toBe(true);
    });

    it('should return true when CBOR LCE present', () => {
      const metadata = toLCEMetadata(sampleLCE, 'cbor');
      expect(hasLCE(metadata)).toBe(true);
    });

    it('should return false when no LCE present', () => {
      const metadata = new grpc.Metadata();
      expect(hasLCE(metadata)).toBe(false);
    });
  });

  describe('removeLCE', () => {
    it('should remove JSON LCE from metadata', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');
      expect(hasLCE(metadata)).toBe(true);

      removeLCE(metadata);
      expect(hasLCE(metadata)).toBe(false);
    });

    it('should remove CBOR LCE from metadata', () => {
      const metadata = toLCEMetadata(sampleLCE, 'cbor');
      expect(hasLCE(metadata)).toBe(true);

      removeLCE(metadata);
      expect(hasLCE(metadata)).toBe(false);
    });

    it('should remove both JSON and CBOR when present', () => {
      const metadata = new grpc.Metadata();
      const jsonMetadata = toLCEMetadata(sampleLCE, 'json');
      const cborMetadata = toLCEMetadata(sampleLCE, 'cbor');

      metadata.set(LCE_METADATA_KEY, jsonMetadata.get(LCE_METADATA_KEY)[0] as string);
      metadata.set(
        LCE_METADATA_KEY_BIN,
        cborMetadata.get(LCE_METADATA_KEY_BIN)[0] as Buffer
      );

      expect(hasLCE(metadata)).toBe(true);
      removeLCE(metadata);
      expect(hasLCE(metadata)).toBe(false);
    });

    it('should preserve other metadata fields', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');
      metadata.set('custom-header', 'custom-value');

      removeLCE(metadata);

      expect(metadata.get('custom-header')).toEqual(['custom-value']);
    });
  });

  describe('round-trip encoding', () => {
    it('should preserve all LCE fields with JSON encoding', () => {
      const metadata = toLCEMetadata(sampleLCE, 'json');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toEqual(sampleLCE);
    });

    it('should preserve all LCE fields with CBOR encoding', () => {
      const metadata = toLCEMetadata(sampleLCE, 'cbor');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toEqual(sampleLCE);
    });

    it('should handle minimal LCE', () => {
      const minimalLCE: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const metadata = toLCEMetadata(minimalLCE, 'json');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toEqual(minimalLCE);
    });

    it('should handle LCE with all optional fields', () => {
      const fullLCE: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'Get weather' },
        affect: { pad: [0.5, 0.5, 0.5], tags: ['happy', 'curious'] },
        meaning: {
          topic: 'weather',
          ontology: 'https://schema.org/WeatherForecast',
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2025-01-15T10:30:00Z',
        },
        policy: { consent: 'team' },
        qos: { coherence: 0.95 },
      };

      const metadata = toLCEMetadata(fullLCE, 'cbor');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded).toEqual(fullLCE);
    });

    it('should preserve Unicode strings', () => {
      const unicodeLCE: LCE = {
        v: 1,
        intent: { type: 'tell', goal: 'Получить прогноз погоды 🌤️' },
        meaning: { topic: '天气预报' },
        policy: { consent: 'private' },
      };

      const metadata = toLCEMetadata(unicodeLCE, 'json');
      const decoded = fromLCEMetadata(metadata);

      expect(decoded?.intent.goal).toBe('Получить прогноз погоды 🌤️');
      expect(decoded?.meaning?.topic).toBe('天气预报');
    });
  });

  describe('size comparison', () => {
    it('should show CBOR is more compact than JSON', () => {
      const jsonMetadata = toLCEMetadata(sampleLCE, 'json');
      const cborMetadata = toLCEMetadata(sampleLCE, 'cbor');

      const jsonSize = (jsonMetadata.get(LCE_METADATA_KEY)[0] as string).length;
      const cborSize = (cborMetadata.get(LCE_METADATA_KEY_BIN)[0] as Buffer).length;

      // CBOR should be smaller (base64 encoding adds 33% overhead to JSON)
      expect(cborSize).toBeLessThan(jsonSize);
    });
  });
});
