/**
 * CBOR (Concise Binary Object Representation) encoding/decoding for LRI
 *
 * Provides compact binary serialization for IoT devices with limited bandwidth.
 *
 * Features:
 * - Binary encoding (smaller than JSON)
 * - LCE message encoding/decoding
 * - WebSocket frame encoding with length prefix
 * - Type-safe operations
 *
 * @example
 * ```typescript
 * import { encodeLCE, decodeLCE } from 'node-lri/cbor';
 *
 * const lce: LCE = {
 *   v: 1,
 *   intent: { type: 'ask' },
 *   policy: { consent: 'private' }
 * };
 *
 * // Encode to CBOR
 * const encoded = encodeLCE(lce);
 * console.log('Size:', encoded.length, 'bytes');
 *
 * // Decode from CBOR
 * const decoded = decodeLCE(encoded);
 * console.log('Intent:', decoded.intent.type);
 * ```
 */

import * as cbor from 'cbor';
import { LCE } from '../types';

/**
 * Encode LCE to CBOR binary format
 *
 * @param lce - LCE envelope to encode
 * @returns CBOR-encoded buffer
 */
export function encodeLCE(lce: LCE): Buffer {
  return cbor.encode(lce);
}

/**
 * Decode LCE from CBOR binary format
 *
 * @param buffer - CBOR-encoded buffer
 * @returns Decoded LCE envelope
 * @throws Error if buffer is invalid CBOR or doesn't match LCE schema
 */
export function decodeLCE(buffer: Buffer): LCE {
  const decoded = cbor.decode(buffer);

  // Validate basic LCE structure
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid CBOR: not an object');
  }

  if (!decoded.v || !decoded.intent || !decoded.policy) {
    throw new Error('Invalid LCE: missing required fields (v, intent, policy)');
  }

  return decoded as LCE;
}

/**
 * Encode WebSocket frame with CBOR payload
 *
 * Format: [4 bytes length][CBOR LCE][payload]
 *
 * @param lce - LCE envelope
 * @param payload - Optional binary payload
 * @returns Complete WebSocket frame
 */
export function encodeFrame(lce: LCE, payload?: Buffer): Buffer {
  const lceBuffer = encodeLCE(lce);
  const lceLength = lceBuffer.length;

  // Create length prefix (4 bytes, big-endian)
  const lengthPrefix = Buffer.allocUnsafe(4);
  lengthPrefix.writeUInt32BE(lceLength, 0);

  // Combine: [length][LCE][payload]
  if (payload) {
    return Buffer.concat([lengthPrefix, lceBuffer, payload]);
  }

  return Buffer.concat([lengthPrefix, lceBuffer]);
}

/**
 * Decode WebSocket frame with CBOR payload
 *
 * @param frame - Complete WebSocket frame
 * @returns Decoded LCE and optional payload
 * @throws Error if frame is malformed
 */
export function decodeFrame(frame: Buffer): { lce: LCE; payload?: Buffer } {
  if (frame.length < 4) {
    throw new Error('Frame too short: missing length prefix');
  }

  // Read length prefix
  const lceLength = frame.readUInt32BE(0);

  if (frame.length < 4 + lceLength) {
    throw new Error(`Frame too short: expected ${4 + lceLength} bytes, got ${frame.length}`);
  }

  // Extract LCE
  const lceBuffer = frame.slice(4, 4 + lceLength);
  const lce = decodeLCE(lceBuffer);

  // Extract payload if present
  const payload = frame.length > 4 + lceLength ? frame.slice(4 + lceLength) : undefined;

  return { lce, payload };
}

/**
 * Calculate size savings of CBOR vs JSON
 *
 * @param lce - LCE envelope
 * @returns Size comparison
 */
export function compareSizes(lce: LCE): {
  json: number;
  cbor: number;
  savings: number;
  savingsPercent: number;
} {
  const jsonSize = Buffer.byteLength(JSON.stringify(lce), 'utf8');
  const cborSize = encodeLCE(lce).length;
  const savings = jsonSize - cborSize;
  const savingsPercent = (savings / jsonSize) * 100;

  return {
    json: jsonSize,
    cbor: cborSize,
    savings,
    savingsPercent: Math.round(savingsPercent * 100) / 100,
  };
}

/**
 * Batch encode multiple LCE messages
 *
 * Useful for offline caching or bulk transmission.
 *
 * @param lces - Array of LCE envelopes
 * @returns Single CBOR buffer containing all messages
 */
export function encodeBatch(lces: LCE[]): Buffer {
  return cbor.encode(lces);
}

/**
 * Batch decode multiple LCE messages
 *
 * @param buffer - CBOR buffer containing multiple messages
 * @returns Array of decoded LCE envelopes
 */
export function decodeBatch(buffer: Buffer): LCE[] {
  const decoded = cbor.decode(buffer);

  if (!Array.isArray(decoded)) {
    throw new Error('Invalid CBOR batch: not an array');
  }

  return decoded.map((item, index) => {
    if (!item || !item.v || !item.intent || !item.policy) {
      throw new Error(`Invalid LCE at index ${index}: missing required fields`);
    }
    return item as LCE;
  });
}

/**
 * Check if buffer is valid CBOR
 *
 * @param buffer - Buffer to check
 * @returns true if valid CBOR
 */
export function isValidCBOR(buffer: Buffer): boolean {
  try {
    cbor.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if buffer is valid CBOR-encoded LCE
 *
 * @param buffer - Buffer to check
 * @returns true if valid LCE
 */
export function isValidLCE(buffer: Buffer): boolean {
  try {
    decodeLCE(buffer);
    return true;
  } catch {
    return false;
  }
}
