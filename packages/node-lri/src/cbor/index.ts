/**
 * CBOR Encoding for LRI
 *
 * Implements RFC 8949 CBOR encoding for LCE (Liminal Context Envelope).
 * Provides 30-33% size reduction compared to JSON.
 *
 * Media type: application/liminal.lce+cbor
 */

import { encode as cborEncode, decode as cborDecode } from 'cbor-x';
import { LCE } from '../types';

/**
 * Encode LCE to CBOR binary format
 *
 * @param lce - Liminal Context Envelope
 * @returns CBOR-encoded Buffer
 *
 * @example
 * ```typescript
 * const lce = { v: 1, intent: { type: 'ask' }, policy: { consent: 'private' } };
 * const cbor = encodeLCE(lce);
 * console.log(`CBOR size: ${cbor.length} bytes`);
 * ```
 */
export function encodeLCE(lce: LCE): Buffer {
  try {
    const encoded = cborEncode(lce);
    return Buffer.from(encoded);
  } catch (error) {
    throw new Error(`Failed to encode LCE to CBOR: ${error}`);
  }
}

/**
 * Decode CBOR binary to LCE
 *
 * @param buffer - CBOR-encoded buffer
 * @returns Decoded LCE
 *
 * @example
 * ```typescript
 * const lce = decodeLCE(cborBuffer);
 * console.log('Intent:', lce.intent?.type);
 * ```
 */
export function decodeLCE(buffer: Buffer): LCE {
  try {
    const decoded = cborDecode(buffer);

    // Validate required fields
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Decoded CBOR is not an object');
    }

    if (typeof decoded.v !== 'number') {
      throw new Error('Missing or invalid "v" field');
    }

    if (typeof decoded.policy !== 'object' || decoded.policy === null) {
      throw new Error('Missing or invalid "policy" field');
    }

    return decoded as LCE;
  } catch (error) {
    throw new Error(`Failed to decode CBOR to LCE: ${error}`);
  }
}

/**
 * Calculate size savings of CBOR vs JSON
 *
 * @param lce - Liminal Context Envelope
 * @returns Size comparison object
 *
 * @example
 * ```typescript
 * const comparison = compareSizes(lce);
 * console.log(`CBOR is ${comparison.savingsPercent}% smaller`);
 * ```
 */
export function compareSizes(lce: LCE): {
  jsonSize: number;
  cborSize: number;
  savings: number;
  savingsPercent: number;
} {
  const jsonSize = Buffer.from(JSON.stringify(lce)).length;
  const cborSize = encodeLCE(lce).length;
  const savings = jsonSize - cborSize;
  const savingsPercent = Math.round((savings / jsonSize) * 100);

  return {
    jsonSize,
    cborSize,
    savings,
    savingsPercent,
  };
}

/**
 * Encode LCE with payload to CBOR frame
 *
 * Frame format: [LCE, payload]
 * This matches the structure used in WebSocket frames.
 *
 * @param lce - Liminal Context Envelope
 * @param payload - Optional payload (Buffer, string, or object)
 * @returns CBOR-encoded frame
 */
export function encodeFrame(lce: LCE, payload?: Buffer | string | unknown): Buffer {
  const payloadData =
    payload instanceof Buffer ? payload :
    typeof payload === 'string' ? Buffer.from(payload, 'utf-8') :
    payload !== undefined ? Buffer.from(JSON.stringify(payload), 'utf-8') :
    Buffer.alloc(0);

  const frame = {
    lce,
    payload: payloadData,
  };

  return Buffer.from(cborEncode(frame));
}

/**
 * Decode CBOR frame to LCE and payload
 *
 * @param buffer - CBOR-encoded frame
 * @returns LCE and payload
 */
export function decodeFrame(buffer: Buffer): {
  lce: LCE;
  payload: Buffer;
} {
  try {
    const decoded = cborDecode(buffer);

    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Invalid frame structure');
    }

    if (!decoded.lce || typeof decoded.lce !== 'object') {
      throw new Error('Missing LCE in frame');
    }

    const payloadBuffer =
      decoded.payload instanceof Buffer ? decoded.payload :
      decoded.payload instanceof Uint8Array ? Buffer.from(decoded.payload) :
      decoded.payload !== undefined ? Buffer.from(JSON.stringify(decoded.payload), 'utf-8') :
      Buffer.alloc(0);

    return {
      lce: decoded.lce as LCE,
      payload: payloadBuffer,
    };
  } catch (error) {
    throw new Error(`Failed to decode CBOR frame: ${error}`);
  }
}
