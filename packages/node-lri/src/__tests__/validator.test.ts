import { validateLCE, isLCE } from '../validator';
import { LCE } from '../types';

describe('validator', () => {
  describe('validateLCE', () => {
    it('should validate a minimal valid LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a complete LCE with all fields', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: 'Provide status update' },
        affect: {
          pad: [0.5, 0.3, 0.7],
          tags: ['confident', 'analytical'],
        },
        meaning: {
          topic: 'system-status',
          ontology: 'https://schema.org/Status',
        },
        trust: {
          proof: 'signature-placeholder',
          attest: ['issuer-1', 'issuer-2'],
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2024-01-15T10:30:00Z',
          ttl: 'PT1H',
        },
        policy: {
          consent: 'team',
          share: ['analytics@example.com'],
          dp: 'epsilon=0.1',
        },
        qos: {
          coherence: 0.95,
          stability: 'high',
        },
        trace: {
          hop: 2,
          provenance: ['service-a', 'service-b'],
        },
        sig: 'eyJhbGciOiJFZERTQSJ9...',
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject LCE without required version field', () => {
      const invalid = {
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(e => e.path === '/')).toBe(true);
    });

    it('should reject LCE without required intent field', () => {
      const invalid = {
        v: 1,
        policy: { consent: 'private' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE without required policy field', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with wrong version number', () => {
      const invalid = {
        v: 2,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with invalid intent type', () => {
      const invalid = {
        v: 1,
        intent: { type: 'invalid-intent' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with invalid consent level', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'invalid-consent' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with PAD values out of range', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        affect: { pad: [1.5, 0, 0] }, // > 1 is invalid
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with PAD array wrong length', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        affect: { pad: [0.5, 0.5] }, // Should be 3 elements
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with invalid UUID format in memory.thread', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        memory: { thread: 'not-a-uuid' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with invalid date-time format in memory.t', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        memory: { t: 'not-a-datetime' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with invalid URI format in meaning.ontology', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        meaning: { ontology: 'not a valid uri' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with coherence out of range', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        qos: { coherence: 1.5 }, // > 1 is invalid
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with negative hop count', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        trace: { hop: -1 },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject LCE with additional properties', () => {
      const invalid = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
        extraField: 'not allowed',
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should provide detailed error messages', () => {
      const invalid = {
        v: 1,
        intent: { type: 'invalid' },
        policy: { consent: 'wrong' },
      };

      const result = validateLCE(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      result.errors!.forEach(error => {
        expect(error.path).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      });
    });
  });

  describe('isLCE', () => {
    it('should return true for valid LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      expect(isLCE(lce)).toBe(true);
    });

    it('should return false for invalid LCE', () => {
      const invalid = {
        v: 1,
        intent: { type: 'invalid' },
        policy: { consent: 'private' },
      };

      expect(isLCE(invalid)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isLCE(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isLCE(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isLCE('string')).toBe(false);
      expect(isLCE(123)).toBe(false);
      expect(isLCE(true)).toBe(false);
      expect(isLCE([])).toBe(false);
    });

    it('should act as type guard', () => {
      const unknown: unknown = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      if (isLCE(unknown)) {
        // TypeScript should allow accessing LCE properties
        expect(unknown.v).toBe(1);
        expect(unknown.intent.type).toBe('ask');
        expect(unknown.policy.consent).toBe('private');
      }
    });
  });
});
