import { readFileSync } from 'fs';
import path from 'path';

import { canonicalizeLtpPayload } from '../ltp/jcs';
import {
  type Ed25519Jwk,
  jwkToKeyPair,
  signCanonicalBase64,
  verifyCanonicalBase64,
} from '../ltp/ed25519';

type Vector = {
  name: string;
  lce: unknown;
  canonical: string;
  key: { jwk: Ed25519Jwk };
  signature: string;
};

describe('LTP interoperability vectors', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../tests/fixtures/ltp/vectors.json'
  );
  const { vectors } = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    description: string;
    vectors: Vector[];
  };

  it.each(vectors)('canonicalises $name payloads identically', (vector) => {
    expect(canonicalizeLtpPayload(vector.lce)).toBe(vector.canonical);
  });

  it.each(vectors)('produces matching signatures for $name', async (vector) => {
    const keys = jwkToKeyPair(vector.key.jwk);
    await expect(
      signCanonicalBase64(vector.canonical, keys.privateKey)
    ).resolves.toBe(vector.signature);
  });

  it.each(vectors)('verifies signatures for $name', async (vector) => {
    const keys = jwkToKeyPair(vector.key.jwk);
    await expect(
      verifyCanonicalBase64(vector.canonical, vector.signature, keys.publicKey)
    ).resolves.toBe(true);
  });

  it('rejects signatures that fail Base64url decoding', async () => {
    const vector = vectors[0];
    const keys = jwkToKeyPair(vector.key.jwk);
    await expect(
      verifyCanonicalBase64(vector.canonical, '***not-base64***', keys.publicKey)
    ).resolves.toBe(false);
  });

  it('rejects signatures that do not match the payload', async () => {
    const vector = vectors[0];
    const keys = jwkToKeyPair(vector.key.jwk);
    const mutated = Buffer.from(vector.signature, 'base64url');
    mutated[0] ^= 0xff;
    const forged = Buffer.from(mutated).toString('base64url');

    await expect(
      verifyCanonicalBase64(vector.canonical, forged, keys.publicKey)
    ).resolves.toBe(false);
  });
});
