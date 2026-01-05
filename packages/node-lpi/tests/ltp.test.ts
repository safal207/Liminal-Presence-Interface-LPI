import fs from 'fs';
import path from 'path';

import {
  LTP,
  canonicalizeLtpPayload,
  encodeSignature,
  decodeSignature,
  importKeys,
  importPublicKey,
  jwkToKeyPair,
  sign,
  signCanonicalBase64,
  verify,
  verifyCanonicalBase64,
} from '../src/ltp';
import { LCE } from '../src/types';

describe('LTP (Liminal Trust Protocol)', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../tests/fixtures/ltp/vectors.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as {
    vectors: Array<{
      name: string;
      lce: Record<string, unknown>;
      canonical: string;
      key: { jwk: { x: string; d: string; kty: string; crv: string } };
      signature: string;
    }>;
  };

  const table = fixture.vectors.map(vector => [vector.name, vector] as const);

  describe('shared fixture interoperability', () => {
    it.each(table)('canonicalises %s deterministically', (_, vector) => {
      const canonical = canonicalizeLtpPayload(vector.lce);
      expect(canonical).toBe(vector.canonical);
    });

    it.each(table)('matches signature bytes for %s', async (_, vector) => {
      const keys = jwkToKeyPair(vector.key.jwk as any);
      const signature = await signCanonicalBase64(
        vector.canonical,
        keys.privateKey
      );
      expect(signature).toBe(vector.signature);
      expect(encodeSignature(decodeSignature(signature))).toBe(signature);
    });

    it.each(table)('verifies fixture signature for %s', async (_, vector) => {
      const keys = jwkToKeyPair(vector.key.jwk as any);
      const valid = await verifyCanonicalBase64(
        vector.canonical,
        vector.signature,
        keys.publicKey
      );
      expect(valid).toBe(true);
    });
  });

  describe('high-level helpers', () => {
    it('sign() replaces existing signatures and returns Base64url text', async () => {
      const vector = fixture.vectors[0];
      const keyPair = importKeys(vector.key.jwk as any);
      const lce = vector.lce as unknown as LCE;
      const withOldSig: LCE & { sig?: string } = {
        ...lce,
        sig: 'old',
      };

      const signed = await sign(withOldSig, keyPair.privateKey);
      expect(signed.sig).toBe(vector.signature);
      expect(await verify(signed, keyPair.publicKey)).toBe(true);
    });

    it('verify() rejects altered payloads', async () => {
      const vector = fixture.vectors[0];
      const keyPair = importKeys(vector.key.jwk as any);
      const lce = vector.lce as unknown as LCE;
      const signed = await sign(lce, keyPair.privateKey);
      expect(await verify(signed, keyPair.publicKey)).toBe(true);

      const tampered = {
        ...signed,
        intent: { ...(signed.intent as any), type: 'ask' },
      } as LCE & { sig: string };
      expect(await verify(tampered, keyPair.publicKey)).toBe(false);
    });

    it('verify() rejects missing signatures', async () => {
      const vector = fixture.vectors[0];
      const keyPair = importKeys(vector.key.jwk as any);
      const unsigned = vector.lce as unknown as LCE;
      expect(await verify(unsigned, keyPair.publicKey)).toBe(false);
    });
  });

  describe('key management', () => {
    it('generateKeys() emits usable key material', async () => {
      const keys = await LTP.generateKeys();
      expect(keys.privateKey).toHaveLength(64);
      expect(keys.publicKey).toHaveLength(32);
      expect(keys.publicKeyJWK).toHaveProperty('x');
      expect(keys.jwk).toHaveProperty('d');
    });

    it('importPublicKey() returns the correct bytes', () => {
      const vector = fixture.vectors[0];
      const { publicKey } = importPublicKey(vector.key.jwk as any);
      const { publicKey: expected } = jwkToKeyPair(vector.key.jwk as any);
      expect(Buffer.from(publicKey)).toEqual(Buffer.from(expected));
    });
  });
});
