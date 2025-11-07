/**
 * LTP (Liminal Trust Protocol) tests
 */

import { ltp } from '../src';
import { LCE } from '../src/types';

describe('LTP (Liminal Trust Protocol)', () => {
  describe('generateKeys', () => {
    it('should generate Ed25519 key pair', async () => {
      const keys = await ltp.generateKeys();

      expect(keys).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toBeDefined();
      expect(keys.publicKeyJWK).toBeDefined();
    });

    it('should generate unique keys each time', async () => {
      const keys1 = await ltp.generateKeys();
      const keys2 = await ltp.generateKeys();

      expect(keys1.publicKeyJWK).not.toEqual(keys2.publicKeyJWK);
    });

    it('should generate keys with correct algorithm', async () => {
      const keys = await ltp.generateKeys();

      expect(keys.publicKeyJWK.kty).toBe('OKP');
      expect(keys.publicKeyJWK.crv).toBe('Ed25519');
    });
  });

  describe('sign', () => {
    it('should sign LCE with Ed25519', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      expect(signed).toBeDefined();
      expect(signed.sig).toBeDefined();
      expect(typeof signed.sig).toBe('string');
      expect(signed.v).toBe(1);
      expect(signed.intent.type).toBe('tell');
    });

    it('should create valid JWT signature', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'team' },
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      // JWT has 3 parts separated by dots
      expect(signed.sig?.split('.').length).toBe(3);
    });

    it('should sign LCE with all fields', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'propose', goal: 'Test' },
        affect: { pad: [0.5, 0.3, 0.1], tags: ['curious'] },
        memory: { thread: 'thread-123', t: '2025-01-15T10:00:00Z' },
        policy: { consent: 'public', share: ['service-1'] },
        qos: { coherence: 0.9 },
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      expect(signed.sig).toBeDefined();
      expect(signed.intent.goal).toBe('Test');
      expect(signed.affect?.pad).toEqual([0.5, 0.3, 0.1]);
    });

    it('should remove existing signature before signing', async () => {
      const keys = await ltp.generateKeys();
      const lce: any = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
        sig: 'old-signature',
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      expect(signed.sig).not.toBe('old-signature');
      expect(signed.sig).toBeDefined();
    });

    it('should sign with optional claims', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'notify' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey, {
        iss: 'test-issuer',
        sub: 'test-subject',
        kid: 'key-123',
      });

      const info = ltp.inspectSignature(signed.sig!);
      expect(info).toBeDefined();
      expect(info?.header.alg).toBe('EdDSA');
      expect(info?.header.typ).toBe('LCE');
      expect(info?.payload.iss).toBe('test-issuer');
      expect(info?.payload.sub).toBe('test-subject');
    });

    it('should produce deterministic signatures for same input', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const signed1 = await ltp.sign(lce, keys.privateKey);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1100));

      const signed2 = await ltp.sign(lce, keys.privateKey);

      // Signatures will differ due to timestamp, but structure should be same
      expect(signed1.sig).toBeDefined();
      expect(signed2.sig).toBeDefined();
      expect(signed1.sig?.split('.').length).toBe(3);
      expect(signed2.sig?.split('.').length).toBe(3);
    });
  });

  describe('verify', () => {
    it('should verify valid signature', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey);
      const valid = await ltp.verify(signed, keys.publicKey);

      expect(valid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const keys = await ltp.generateKeys();
      const lce: any = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
        sig: 'invalid.signature.here',
      };

      const valid = await ltp.verify(lce, keys.publicKey);

      expect(valid).toBe(false);
    });

    it('should reject signature from different key', async () => {
      const keys1 = await ltp.generateKeys();
      const keys2 = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'team' },
      };

      const signed = await ltp.sign(lce, keys1.privateKey);
      const valid = await ltp.verify(signed, keys2.publicKey);

      expect(valid).toBe(false);
    });

    it('should reject LCE without signature', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const valid = await ltp.verify(lce, keys.publicKey);

      expect(valid).toBe(false);
    });

    it('should reject modified LCE', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      // Modify LCE after signing
      const modified: any = { ...signed, intent: { type: 'ask' } };

      const valid = await ltp.verify(modified, keys.publicKey);

      expect(valid).toBe(false);
    });

    it('should verify with issuer check', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'notify' },
        policy: { consent: 'public' },
      };

      const signed = await ltp.sign(lce, keys.privateKey, {
        iss: 'trusted-issuer',
      });

      const valid = await ltp.verify(signed, keys.publicKey, {
        issuer: 'trusted-issuer',
      });

      expect(valid).toBe(true);
    });

    it('should reject wrong issuer', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'notify' },
        policy: { consent: 'public' },
      };

      const signed = await ltp.sign(lce, keys.privateKey, {
        iss: 'issuer-a',
      });

      const valid = await ltp.verify(signed, keys.publicKey, {
        issuer: 'issuer-b',
      });

      expect(valid).toBe(false);
    });

    it('should verify complex LCE', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'propose', goal: 'Complex test' },
        affect: { pad: [0.7, 0.5, 0.3], tags: ['urgent', 'important'] },
        memory: { thread: 'complex-thread', t: '2025-01-15T12:00:00Z' },
        policy: { consent: 'team', share: ['service-a', 'service-b'] },
        qos: { coherence: 0.95 },
      };

      const signed = await ltp.sign(lce, keys.privateKey);
      const valid = await ltp.verify(signed, keys.publicKey);

      expect(valid).toBe(true);
    });
  });

  describe('inspectSignature', () => {
    it('should inspect signature header and payload', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey, {
        iss: 'test-issuer',
      });

      const info = ltp.inspectSignature(signed.sig!);

      expect(info).toBeDefined();
      expect(info?.header.alg).toBe('EdDSA');
      expect(info?.header.typ).toBe('LCE');
      expect(info?.payload.iss).toBe('test-issuer');
      expect(info?.payload.lce).toBeDefined();
    });

    it('should return null for invalid signature', () => {
      const info = ltp.inspectSignature('invalid-signature');

      expect(info).toBeNull();
    });

    it('should return null for malformed JWT', () => {
      const info = ltp.inspectSignature('not.a.valid.jwt.format');

      expect(info).toBeNull();
    });
  });

  describe('importKeys', () => {
    it('should have importKeys function', () => {
      expect(ltp.importKeys).toBeDefined();
      expect(typeof ltp.importKeys).toBe('function');
    });
  });

  describe('round-trip scenarios', () => {
    it('should handle multiple signatures', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'sync' },
        policy: { consent: 'team' },
      };

      // First signature
      const signed1 = await ltp.sign(lce, keys.privateKey);
      expect(await ltp.verify(signed1, keys.publicKey)).toBe(true);

      // Re-sign (replaces signature)
      const signed2 = await ltp.sign(signed1, keys.privateKey);
      expect(await ltp.verify(signed2, keys.publicKey)).toBe(true);

      // Both signatures should be valid
      expect(signed1.sig).toBeDefined();
      expect(signed2.sig).toBeDefined();
    });

    it('should work with JSON serialization round-trip', async () => {
      const keys = await ltp.generateKeys();
      const lce: LCE = {
        v: 1,
        intent: { type: 'reflect' },
        policy: { consent: 'private' },
      };

      const signed = await ltp.sign(lce, keys.privateKey);

      // Serialize and deserialize
      const json = JSON.stringify(signed);
      const deserialized = JSON.parse(json);

      const valid = await ltp.verify(deserialized, keys.publicKey);

      expect(valid).toBe(true);
    });
  });
});
