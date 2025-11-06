/**
 * LTP (Liminal Trust Protocol)
 *
 * Cryptographic signing and verification of LCE messages using:
 * - JCS (JSON Canonicalization Scheme, RFC 8785)
 * - JWS (JSON Web Signature, RFC 7515)
 * - Ed25519 signatures (EdDSA)
 */

import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK } from 'jose';
import canonicalize from 'canonicalize';
import { LCE } from '../types';

/**
 * LTP Key Pair (Ed25519)
 */
export interface LTPKeyPair {
  /** Private key for signing (keep secret) */
  privateKey: any;
  /** Public key for verification (can be shared) */
  publicKey: any;
  /** Public key in JWK format for export */
  publicKeyJWK: any;
}

/**
 * LTP Signature options
 */
export interface LTPSignOptions {
  /** Key ID for key rotation */
  kid?: string;
  /** Issuer identifier */
  iss?: string;
  /** Subject identifier */
  sub?: string;
  /** Additional claims */
  claims?: Record<string, any>;
}

/**
 * LTP Verification options
 */
export interface LTPVerifyOptions {
  /** Expected issuer */
  issuer?: string;
  /** Expected subject */
  subject?: string;
  /** Maximum age in seconds */
  maxAge?: number;
}

/**
 * Generate Ed25519 key pair for LTP
 *
 * @example
 * ```typescript
 * const keys = await LTP.generateKeys();
 * console.log('Public key:', keys.publicKeyJWK);
 * ```
 */
export async function generateKeys(): Promise<LTPKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });

  const publicKeyJWK = await exportJWK(publicKey);

  return {
    privateKey,
    publicKey,
    publicKeyJWK,
  };
}

/**
 * Import key pair from JWK
 *
 * @param privateKeyJWK - Private key in JWK format
 * @param publicKeyJWK - Public key in JWK format
 */
export async function importKeys(
  privateKeyJWK: any,
  publicKeyJWK: any
): Promise<LTPKeyPair> {
  const privateKey = await importJWK(privateKeyJWK, 'EdDSA');
  const publicKey = await importJWK(publicKeyJWK, 'EdDSA');

  return {
    privateKey,
    publicKey,
    publicKeyJWK,
  };
}

/**
 * Sign LCE with LTP
 *
 * Process:
 * 1. Remove any existing signature from LCE
 * 2. Canonicalize JSON using JCS (RFC 8785)
 * 3. Create JWS signature with Ed25519
 * 4. Return LCE with signature in `sig` field
 *
 * @param lce - LCE to sign (without signature)
 * @param privateKey - Private key from generateKeys()
 * @param options - Signature options
 *
 * @example
 * ```typescript
 * const keys = await LTP.generateKeys();
 * const lce = { v: 1, intent: { type: 'tell' }, policy: { consent: 'private' } };
 * const signed = await LTP.sign(lce, keys.privateKey);
 * console.log('Signature:', signed.sig);
 * ```
 */
export async function sign(
  lce: LCE,
  privateKey: any,
  options: LTPSignOptions = {}
): Promise<LCE & { sig: string }> {
  // Remove existing signature if present
  const { sig: _, ...lceWithoutSig } = lce as any;

  // Canonicalize JSON (RFC 8785)
  const canonical = canonicalize(lceWithoutSig);
  if (!canonical) {
    throw new Error('Failed to canonicalize LCE');
  }

  // Create JWS with canonical JSON as payload
  const jwt = new SignJWT({ lce: canonical })
    .setProtectedHeader({
      alg: 'EdDSA',
      typ: 'LCE',
    })
    .setIssuedAt();

  // Add optional claims
  if (options.kid) {
    jwt.setProtectedHeader({ alg: 'EdDSA', typ: 'LCE', kid: options.kid });
  }
  if (options.iss) {
    jwt.setIssuer(options.iss);
  }
  if (options.sub) {
    jwt.setSubject(options.sub);
  }

  // Sign
  const signature = await jwt.sign(privateKey);

  // Return LCE with signature
  return {
    ...lceWithoutSig,
    sig: signature,
  } as LCE & { sig: string };
}

/**
 * Verify LCE signature
 *
 * Process:
 * 1. Extract signature from LCE
 * 2. Canonicalize LCE without signature
 * 3. Verify JWS signature with public key
 * 4. Return verification result
 *
 * @param lce - LCE with signature
 * @param publicKey - Public key from generateKeys()
 * @param options - Verification options
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * const keys = await LTP.generateKeys();
 * const signed = await LTP.sign(lce, keys.privateKey);
 *
 * const valid = await LTP.verify(signed, keys.publicKey);
 * console.log('Valid:', valid); // true
 * ```
 */
export async function verify(
  lce: LCE & { sig?: string },
  publicKey: any,
  options: LTPVerifyOptions = {}
): Promise<boolean> {
  if (!lce.sig) {
    return false;
  }

  try {
    // Extract LCE without signature
    const { sig, ...lceWithoutSig } = lce;

    // Canonicalize
    const canonical = canonicalize(lceWithoutSig);
    if (!canonical) {
      return false;
    }

    // Verify JWS
    const { payload } = await jwtVerify(sig, publicKey, {
      issuer: options.issuer,
      subject: options.subject,
      maxTokenAge: options.maxAge ? `${options.maxAge}s` : undefined,
    });

    // Check that canonical JSON matches
    const payloadLCE = (payload as any).lce;
    return payloadLCE === canonical;
  } catch (error) {
    // Signature verification failed
    return false;
  }
}

/**
 * Extract signature info without verification
 *
 * @param signature - JWS signature string
 * @returns Decoded header and payload (unverified)
 */
export function inspectSignature(signature: string): {
  header: any;
  payload: any;
} | null {
  try {
    // Decode JWT without verification (for inspection only)
    const parts = signature.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf-8')
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return { header, payload };
  } catch {
    return null;
  }
}

// Export all functions under LTP namespace
export const LTP = {
  generateKeys,
  importKeys,
  sign,
  verify,
  inspectSignature,
};

export default LTP;
