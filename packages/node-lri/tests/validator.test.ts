/**
 * Validator tests
 */

import { validateLCE, isLCE } from '../src/validator';
import { LCE } from '../src/types';

describe('validateLCE', () => {
  describe('valid LCE', () => {
    it('should validate minimal LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate full LCE', () => {
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
        trust: {
          proof: 'test-proof',
          attest: ['test-attestation'],
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2025-01-15T10:30:00Z',
          ttl: 'PT1H',
        },
        policy: {
          consent: 'team',
          share: ['service-1', 'service-2'],
          dp: 'epsilon=1.0',
        },
        qos: {
          coherence: 0.87,
          stability: 'high',
        },
        trace: {
          hop: 2,
          provenance: ['client-v1', 'gateway-v2'],
        },
        sig: 'test-signature',
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(true);
    });

    it('should validate all intent types', () => {
      const intentTypes = [
        'ask',
        'tell',
        'propose',
        'confirm',
        'notify',
        'sync',
        'plan',
        'agree',
        'disagree',
        'reflect',
      ];

      intentTypes.forEach((type) => {
        const lce = {
          v: 1,
          intent: { type },
          policy: { consent: 'private' },
        };

        const result = validateLCE(lce);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate all consent levels', () => {
      const consentLevels = ['private', 'team', 'public'];

      consentLevels.forEach((consent) => {
        const lce = {
          v: 1,
          intent: { type: 'tell' },
          policy: { consent },
        };

        const result = validateLCE(lce);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('invalid LCE', () => {
    it('should reject missing version', () => {
      const lce = {
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject wrong version', () => {
      const lce = {
        v: 2,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject missing intent', () => {
      const lce = {
        v: 1,
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject missing policy', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject invalid intent type', () => {
      const lce = {
        v: 1,
        intent: { type: 'invalid-type' },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid consent level', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'invalid-consent' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject extra fields', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
        extraField: 'not-allowed',
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid PAD array length', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
        affect: {
          pad: [0.5, 0.3], // Should be 3 values
        },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject PAD values out of range', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
        affect: {
          pad: [2.0, 0.0, 0.0], // Should be in [-1, 1]
        },
        policy: { consent: 'private' },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });

    it('should reject coherence out of range', () => {
      const lce = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
        qos: {
          coherence: 1.5, // Should be in [0, 1]
        },
      };

      const result = validateLCE(lce);
      expect(result.valid).toBe(false);
    });
  });
});

describe('isLCE', () => {
  it('should return true for valid LCE', () => {
    const lce: LCE = {
      v: 1,
      intent: { type: 'tell' },
      policy: { consent: 'private' },
    };

    expect(isLCE(lce)).toBe(true);
  });

  it('should return false for invalid LCE', () => {
    const lce = {
      v: 1,
      intent: { type: 'invalid' },
      policy: { consent: 'private' },
    };

    expect(isLCE(lce)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isLCE(null)).toBe(false);
    expect(isLCE(undefined)).toBe(false);
    expect(isLCE('string')).toBe(false);
    expect(isLCE(123)).toBe(false);
    expect(isLCE([])).toBe(false);
  });
});
