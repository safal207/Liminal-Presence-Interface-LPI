/**
 * LTP (Liminal Trust Protocol)
 *
 * Provides helpers for canonicalising LCE payloads with RFC 8785 (JCS)
 * and signing/verifying them with detached Ed25519 signatures.
 */

import { canonicalizeLtpPayload } from './jcs';
import {
  Ed25519Jwk,
  Ed25519PublicJwk,
  Ed25519KeyPairBytes,
  bytesToJwk,
  generateKeyPairBytes,
  jwkToKeyPair,
  jwkToPublicKey,
  publicKeyToJwk,
  signCanonicalBase64,
  verifyCanonicalBase64,
} from './ed25519';
import { LCE } from '../types';

export interface LTPKeyPair {
  /** 64-byte secret key (private || public) used for signing */
  privateKey: Uint8Array;
  /** 32-byte Ed25519 public key */
  publicKey: Uint8Array;
  /** OKP/Ed25519 JWK containing both private (d) and public (x) components */
  jwk: Ed25519Jwk;
  /** Public-only JWK convenient for sharing with verifiers */
  publicKeyJWK: Ed25519PublicJwk;
}

export interface LTPPublicKey {
  /** 32-byte Ed25519 public key */
  publicKey: Uint8Array;
  /** Public-only JWK convenient for transport */
  publicKeyJWK: Ed25519PublicJwk;
}

function buildKeyPair(bytes: Ed25519KeyPairBytes, sourceJwk?: Ed25519Jwk): LTPKeyPair {
  const normalizedJwk = bytesToJwk(bytes);
  const jwk = sourceJwk
    ? {
        ...sourceJwk,
        ...normalizedJwk,
      }
    : normalizedJwk;
  const { d, ...publicJWK } = jwk;
  void d;
  return {
    privateKey: bytes.privateKey,
    publicKey: bytes.publicKey,
    jwk,
    publicKeyJWK: publicJWK as Ed25519PublicJwk,
  };
}

/**
 * Generate a fresh Ed25519 key pair for LTP usage.
 */
export async function generateKeys(): Promise<LTPKeyPair> {
  const bytes = await generateKeyPairBytes();
  return buildKeyPair(bytes);
}

/**
 * Import an Ed25519 key pair from a JWK that includes the private component (d).
 */
export function importKeys(jwk: Ed25519Jwk): LTPKeyPair {
  const bytes = jwkToKeyPair(jwk);
  return buildKeyPair(bytes, jwk);
}

/**
 * Import an Ed25519 public key from a JWK.
 */
export function importPublicKey(jwk: Ed25519Jwk): LTPPublicKey {
  const publicKey = jwkToPublicKey(jwk);
  const baseJwk = publicKeyToJwk(publicKey);
  const { d, ...rest } = jwk;
  void d;
  return {
    publicKey,
    publicKeyJWK: { ...baseJwk, ...rest } as Ed25519PublicJwk,
  };
}

function stripSignature<T extends { sig?: unknown }>(lce: T): Omit<T, 'sig'> {
  const { sig, ...rest } = lce;
  void sig;
  return rest;
}

/**
 * Sign an LCE envelope with a detached Ed25519 signature.
 */
export async function sign(
  lce: LCE & { sig?: string },
  privateKey: Uint8Array
): Promise<LCE & { sig: string }> {
  const payload = stripSignature(lce) as Omit<LCE, 'sig'>;
  const canonical = canonicalizeLtpPayload(payload);
  const signature = await signCanonicalBase64(canonical, privateKey);
  const signed: LCE & { sig: string } = { ...(payload as LCE), sig: signature };
  return signed;
}

/**
 * Verify an LCE envelope signed with {@link sign}.
 */
export async function verify(
  lce: LCE & { sig?: string },
  publicKey: Uint8Array
): Promise<boolean> {
  if (typeof lce.sig !== 'string' || lce.sig.length === 0) {
    return false;
  }

  const payload = stripSignature(lce) as Omit<LCE, 'sig'>;
  const canonical = canonicalizeLtpPayload(payload);
  return verifyCanonicalBase64(canonical, lce.sig, publicKey);
}

export const LTP = {
  generateKeys,
  importKeys,
  importPublicKey,
  sign,
  verify,
};

export * from './jcs';
export * from './ed25519';

export default LTP;
