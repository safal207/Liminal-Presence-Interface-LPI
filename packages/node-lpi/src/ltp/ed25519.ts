import nacl from 'tweetnacl';

export interface Ed25519KeyPairBytes {
  publicKey: Uint8Array;
  /**
   * Secret key used by tweetnacl (private || public).
   * The first 32 bytes are the private scalar, the last 32 are the public key.
   */
  privateKey: Uint8Array;
}

export interface Ed25519Jwk {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  d?: string;
}

export type Ed25519PublicJwk = Omit<Ed25519Jwk, 'd'>;

function decodeBase64Url(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64url'));
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

export function jwkToKeyPair(jwk: Ed25519Jwk): Ed25519KeyPairBytes {
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error('Unsupported JWK');
  }
  const publicKey = decodeBase64Url(jwk.x);
  if (publicKey.length !== 32) {
    throw new Error('Invalid Ed25519 public key length');
  }
  if (!jwk.d) {
    throw new Error('Missing private key component (d)');
  }
  const privateComponent = decodeBase64Url(jwk.d);
  if (privateComponent.length !== 32) {
    throw new Error('Invalid Ed25519 private key length');
  }
  const secretKey = new Uint8Array(64);
  secretKey.set(privateComponent, 0);
  secretKey.set(publicKey, 32);
  return { publicKey, privateKey: secretKey };
}

export function jwkToPublicKey(jwk: Ed25519Jwk): Uint8Array {
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error('Unsupported JWK');
  }
  const publicKey = decodeBase64Url(jwk.x);
  if (publicKey.length !== 32) {
    throw new Error('Invalid Ed25519 public key length');
  }
  return publicKey;
}

export function bytesToJwk(keys: Ed25519KeyPairBytes): Ed25519Jwk {
  if (keys.privateKey.length !== 64) {
    throw new Error('Ed25519 secret key must be 64 bytes');
  }
  const privateComponent = keys.privateKey.slice(0, 32);
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: encodeBase64Url(keys.publicKey),
    d: encodeBase64Url(privateComponent),
  };
}

export function publicKeyToJwk(publicKey: Uint8Array): Ed25519PublicJwk {
  if (publicKey.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: encodeBase64Url(publicKey),
  };
}

export async function generateKeyPairBytes(): Promise<Ed25519KeyPairBytes> {
  const { publicKey, secretKey } = nacl.sign.keyPair();
  return {
    publicKey: Uint8Array.from(publicKey),
    privateKey: Uint8Array.from(secretKey),
  };
}

export async function signCanonical(
  canonicalJson: string,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  if (privateKey.length !== 64) {
    throw new Error('Ed25519 secret key must be 64 bytes');
  }
  const message = new TextEncoder().encode(canonicalJson);
  return nacl.sign.detached(message, privateKey);
}

export async function signCanonicalBase64(
  canonicalJson: string,
  privateKey: Uint8Array
): Promise<string> {
  const signature = await signCanonical(canonicalJson, privateKey);
  return encodeBase64Url(signature);
}

export async function verifyCanonical(
  canonicalJson: string,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const message = new TextEncoder().encode(canonicalJson);
  if (signature.length !== nacl.sign.signatureLength) {
    return false;
  }

  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export async function verifyCanonicalBase64(
  canonicalJson: string,
  signature: string,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    return verifyCanonical(
      canonicalJson,
      decodeBase64Url(signature),
      publicKey
    );
  } catch {
    return false;
  }
}

export function encodeSignature(signature: Uint8Array): string {
  return encodeBase64Url(signature);
}

export function decodeSignature(signature: string): Uint8Array {
  return decodeBase64Url(signature);
}

export default {
  jwkToKeyPair,
  jwkToPublicKey,
  bytesToJwk,
  publicKeyToJwk,
  generateKeyPairBytes,
  signCanonical,
  signCanonicalBase64,
  verifyCanonical,
  verifyCanonicalBase64,
  encodeSignature,
  decodeSignature,
};
