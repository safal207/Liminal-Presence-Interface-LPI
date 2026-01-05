/**
 * Type tests
 */

import { LCE, IntentType, ConsentLevel } from '../src/types';

describe('LCE types', () => {
  it('should allow minimal LCE', () => {
    const lce: LCE = {
      v: 1,
      intent: { type: 'tell' },
      policy: { consent: 'private' },
    };

    expect(lce.v).toBe(1);
    expect(lce.intent.type).toBe('tell');
    expect(lce.policy.consent).toBe('private');
  });

  it('should allow full LCE', () => {
    const lce: LCE = {
      v: 1,
      intent: {
        type: 'ask',
        goal: 'Test goal',
      },
      affect: {
        pad: [0.5, 0.3, 0.1],
        tags: ['curious', 'casual'],
      },
      meaning: {
        topic: 'weather',
        ontology: 'https://schema.org/WeatherForecast',
      },
      trust: {
        proof: 'proof-string',
        attest: ['attestation-1'],
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
        provenance: ['origin', 'gateway'],
      },
      sig: 'signature-string',
    };

    expect(lce).toBeDefined();
  });
});

describe('IntentType', () => {
  it('should include all intent types', () => {
    const validTypes: IntentType[] = [
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

    validTypes.forEach((type) => {
      const lce: LCE = {
        v: 1,
        intent: { type },
        policy: { consent: 'private' },
      };

      expect(lce.intent.type).toBe(type);
    });
  });
});

describe('ConsentLevel', () => {
  it('should include all consent levels', () => {
    const validLevels: ConsentLevel[] = ['private', 'team', 'public'];

    validLevels.forEach((consent) => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent },
      };

      expect(lce.policy.consent).toBe(consent);
    });
  });
});
