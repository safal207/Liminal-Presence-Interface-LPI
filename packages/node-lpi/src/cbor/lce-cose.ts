import { encodeCanonical, decodeFirstSync } from 'cbor';
import nacl from 'tweetnacl';
import { LCE } from '../types';

export interface CoseOptions {
  keyId?: Uint8Array | Buffer | string;
  externalAAD?: Uint8Array | Buffer;
}

interface ParsedCoseSign1 {
  protectedHeader: Buffer;
  unprotectedHeader: Record<string | number, unknown>;
  payload: Buffer;
  signature: Buffer;
}

function assertIsLCE(value: unknown): asserts value is LCE {
  if (!value || typeof value !== 'object') {
    throw new Error('COSE payload must decode to an object');
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.v !== 1) {
    throw new Error('Invalid LCE payload: missing version');
  }

  if (typeof candidate.intent !== 'object' || candidate.intent === null) {
    throw new Error('Invalid LCE payload: missing intent');
  }

  if (typeof candidate.policy !== 'object' || candidate.policy === null) {
    throw new Error('Invalid LCE payload: missing policy');
  }
}

const COSE_ALG_EDDSA = -8;
const COSE_CONTEXT = 'Signature1';
const COSE_HEADER_ALG = 1;
const COSE_HEADER_KID = 4;

function getHeaderValue(
  header: unknown,
  label: number,
): unknown {
  if (header instanceof Map) {
    return header.get(label);
  }

  if (header && typeof header === 'object') {
    const record = header as Record<string | number, unknown>;
    return record[label] ?? record[label.toString()];
  }

  return undefined;
}

function toBuffer(input?: Uint8Array | Buffer | string): Buffer | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input === 'string') {
    return Buffer.from(input, 'utf8');
  }

  return Buffer.from(input);
}

function cleanValue<T>(value: T): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => cleanValue(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = cleanValue(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result as unknown as T;
  }

  return value;
}

function sanitizeLCE(lce: LCE): Record<string, unknown> {
  const { sig: _sig, ...rest } = lce;
  void _sig;
  const cleaned = cleanValue(rest);
  return cleaned ?? {};
}

function ensureEd25519KeyPair(privateKey: Uint8Array | Buffer): {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const key = Buffer.from(privateKey);

  if (key.length === 64) {
    return {
      secretKey: new Uint8Array(key),
      publicKey: new Uint8Array(key.slice(32)),
    };
  }

  if (key.length === 32) {
    const pair = nacl.sign.keyPair.fromSeed(new Uint8Array(key));
    return {
      secretKey: pair.secretKey,
      publicKey: pair.publicKey,
    };
  }

  throw new Error('Ed25519 private key must be 32 or 64 bytes');
}

function ensureEd25519PublicKey(publicKey: Uint8Array | Buffer): Uint8Array {
  const key = Buffer.from(publicKey);

  if (key.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }

  return new Uint8Array(key);
}

function buildProtectedHeader(options?: CoseOptions): Buffer {
  const header = new Map<number, unknown>();
  header.set(COSE_HEADER_ALG, COSE_ALG_EDDSA);

  const keyId = toBuffer(options?.keyId);
  if (keyId) {
    header.set(COSE_HEADER_KID, keyId);
  }

  return encodeCanonical(header);
}

function buildExternalAAD(options?: CoseOptions): Buffer {
  return toBuffer(options?.externalAAD) ?? Buffer.alloc(0);
}

function encodeSigStructure(
  protectedHeader: Buffer,
  externalAAD: Buffer,
  payload: Buffer,
): Buffer {
  return encodeCanonical([COSE_CONTEXT, protectedHeader, externalAAD, payload]);
}

function parseCoseSign1(cose: Buffer): ParsedCoseSign1 {
  const decoded = decodeFirstSync(cose);

  if (!Array.isArray(decoded) || decoded.length !== 4) {
    throw new Error('Invalid COSE_Sign1 structure');
  }

  const [protectedHeader, unprotectedHeader, payload, signature] = decoded;

  if (!Buffer.isBuffer(protectedHeader)) {
    throw new Error('COSE protected header must be a bstr');
  }

  if (!(payload instanceof Buffer)) {
    throw new Error('COSE payload must be a bstr');
  }

  if (!(signature instanceof Buffer)) {
    throw new Error('COSE signature must be a bstr');
  }

  if (unprotectedHeader && typeof unprotectedHeader !== 'object') {
    throw new Error('COSE unprotected header must be a map');
  }

  return {
    protectedHeader,
    unprotectedHeader: (unprotectedHeader as Record<string | number, unknown>) ?? {},
    payload,
    signature,
  };
}

export function encodeCanonicalLCE(lce: LCE): Buffer {
  const sanitized = sanitizeLCE(lce);
  return encodeCanonical(sanitized);
}

export function createCoseSign1(
  lce: LCE,
  privateKey: Uint8Array | Buffer,
  options?: CoseOptions,
): {
  cose: Buffer;
  payload: Buffer;
  protectedHeader: Buffer;
  signature: Buffer;
} {
  const sanitized = sanitizeLCE(lce);
  const payload = encodeCanonical(sanitized);
  const protectedHeader = buildProtectedHeader(options);
  const externalAAD = buildExternalAAD(options);
  const sigStructure = encodeSigStructure(protectedHeader, externalAAD, payload);
  const { secretKey } = ensureEd25519KeyPair(privateKey);
  const signature = Buffer.from(
    nacl.sign.detached(new Uint8Array(sigStructure), secretKey),
  );

  const cose = encodeCanonical([protectedHeader, {}, payload, signature]);

  return { cose, payload, protectedHeader, signature };
}

export function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64UrlDecode(value: string): Buffer {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

export function signLCE(
  lce: LCE,
  privateKey: Uint8Array | Buffer,
  options?: CoseOptions,
): LCE {
  const { cose } = createCoseSign1(lce, privateKey, options);
  return {
    ...sanitizeLCE(lce),
    sig: base64UrlEncode(cose),
  } as LCE;
}

export function decodeCoseSign1(cose: Buffer): {
  lce: LCE;
  kid?: Buffer;
} {
  const { protectedHeader, payload } = parseCoseSign1(cose);
  const headerMap = decodeFirstSync(protectedHeader);

  if (getHeaderValue(headerMap, COSE_HEADER_ALG) !== COSE_ALG_EDDSA) {
    throw new Error('Unsupported COSE algorithm');
  }

  const decoded = decodeFirstSync(payload);
  assertIsLCE(decoded);

  return {
    lce: decoded,
    kid: getHeaderValue(headerMap, COSE_HEADER_KID)
      ? Buffer.from(getHeaderValue(headerMap, COSE_HEADER_KID) as Buffer)
      : undefined,
  };
}

export function verifyCoseSign1(
  cose: Buffer,
  publicKey: Uint8Array | Buffer,
  options?: CoseOptions,
): {
  lce: LCE;
  kid?: Buffer;
} {
  const { protectedHeader, payload, signature } = parseCoseSign1(cose);
  const headerMap = decodeFirstSync(protectedHeader);

  if (getHeaderValue(headerMap, COSE_HEADER_ALG) !== COSE_ALG_EDDSA) {
    throw new Error('Unsupported COSE algorithm');
  }

  const externalAAD = buildExternalAAD(options);
  const sigStructure = encodeSigStructure(protectedHeader, externalAAD, payload);
  const publicKeyBytes = ensureEd25519PublicKey(publicKey);

  const valid = nacl.sign.detached.verify(
    new Uint8Array(sigStructure),
    new Uint8Array(signature),
    publicKeyBytes,
  );

  if (!valid) {
    throw new Error('Invalid COSE signature');
  }

  const decoded = decodeFirstSync(payload);
  assertIsLCE(decoded);

  return {
    lce: decoded,
    kid: getHeaderValue(headerMap, COSE_HEADER_KID)
      ? Buffer.from(getHeaderValue(headerMap, COSE_HEADER_KID) as Buffer)
      : undefined,
  };
}

export function verifySignedLCE(
  lce: LCE,
  publicKey: Uint8Array | Buffer,
  options?: CoseOptions,
): boolean {
  if (!lce.sig) {
    throw new Error('Missing sig field on LCE');
  }

  const cose = base64UrlDecode(lce.sig);
  const { payload } = parseCoseSign1(cose);
  const expectedPayload = encodeCanonicalLCE(lce);

  if (!payload.equals(expectedPayload)) {
    return false;
  }

  try {
    verifyCoseSign1(cose, publicKey, options);
    return true;
  } catch {
    return false;
  }
}

export function deserializeSignedLCE(
  lce: LCE,
  publicKey?: Uint8Array | Buffer,
  options?: CoseOptions,
): {
  lce: LCE;
  kid?: Buffer;
} {
  if (!lce.sig) {
    throw new Error('Missing sig field on LCE');
  }

  const cose = base64UrlDecode(lce.sig);

  if (publicKey) {
    return verifyCoseSign1(cose, publicKey, options);
  }

  return decodeCoseSign1(cose);
}

export function coseFromSignedLCE(lce: LCE): Buffer {
  if (!lce.sig) {
    throw new Error('Missing sig field on LCE');
  }

  return base64UrlDecode(lce.sig);
}
