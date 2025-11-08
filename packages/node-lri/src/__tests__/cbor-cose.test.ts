import fs from 'fs';
import path from 'path';
import nacl from 'tweetnacl';

import { LCE } from '../types';
import {
  base64UrlDecode,
  base64UrlEncode,
  createCoseSign1,
  deserializeSignedLCE,
  signLCE,
  verifyCoseSign1,
  verifySignedLCE,
  coseFromSignedLCE,
} from '../cbor/lce-cose';

describe('CBOR + COSE LCE serialization', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../tests/fixtures/lce-cose-vector.json',
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    seed: string;
    lce: LCE;
    expectedCose: string;
  };

  const seed = Buffer.from(fixture.seed, 'hex');
  const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  const lce: LCE = fixture.lce;

  it('produces deterministic COSE_Sign1 envelope', () => {
    const { cose } = createCoseSign1(lce, keyPair.secretKey);
    const encoded = base64UrlEncode(cose);

    if (!fixture.expectedCose) {
      throw new Error(
        'Fixture missing expectedCose. Update tests/fixtures/lce-cose-vector.json with the generated value.',
      );
    }

    expect(encoded).toEqual(fixture.expectedCose);
  });

  it('signs LCE and embeds COSE signature', () => {
    const signed = signLCE(lce, keyPair.secretKey);
    expect(signed.sig).toBeDefined();
    expect(signed.sig).toEqual(fixture.expectedCose);
  });

  it('verifies signed LCE payload and signature', () => {
    const signed = signLCE(lce, keyPair.secretKey);
    const isValid = verifySignedLCE(signed, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('fails verification when payload is tampered', () => {
    const signed = signLCE(lce, keyPair.secretKey);
    signed.qos = { coherence: 0.5 };
    const isValid = verifySignedLCE(signed, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('decodes signed envelope back to LCE', () => {
    const signed = signLCE(lce, keyPair.secretKey);
    const { lce: decoded } = deserializeSignedLCE(signed, keyPair.publicKey);
    expect(decoded).toEqual(lce);
  });

  it('verifies COSE blob independently', () => {
    const { cose } = createCoseSign1(lce, keyPair.secretKey, { keyId: 'lri-test' });
    const { lce: decoded, kid } = verifyCoseSign1(cose, keyPair.publicKey);
    expect(decoded).toEqual(lce);
    expect(kid?.toString('utf8')).toEqual('lri-test');
  });

  it('exports raw COSE payload from signed LCE', () => {
    const signed = signLCE(lce, keyPair.secretKey);
    const cose = coseFromSignedLCE(signed);
    expect(base64UrlEncode(cose)).toEqual(fixture.expectedCose);
    expect(base64UrlDecode(signed.sig!)).toEqual(cose);
  });
});
