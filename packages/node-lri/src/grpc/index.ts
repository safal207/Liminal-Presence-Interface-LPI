/**
 * gRPC metadata adapter for LRI
 *
 * Transmit LCE envelopes via gRPC metadata (headers) alongside RPC calls.
 *
 * gRPC metadata is key-value pairs sent before the RPC payload:
 * - Binary values: key must end with "-bin"
 * - Text values: must be ASCII
 *
 * We use two strategies:
 * 1. JSON encoding in "lce" metadata field (text, base64-encoded)
 * 2. CBOR encoding in "lce-bin" metadata field (binary, compact)
 *
 * @example
 * ```typescript
 * import * as grpc from '@grpc/grpc-js';
 * import { toLCEMetadata, fromLCEMetadata } from 'node-lri/grpc';
 *
 * // Server: extract LCE from incoming metadata
 * function handleRequest(call: grpc.ServerUnaryCall<any, any>) {
 *   const lce = fromLCEMetadata(call.metadata);
 *   console.log('Intent:', lce?.intent.type);
 * }
 *
 * // Client: attach LCE to outgoing call
 * const lce: LCE = {
 *   v: 1,
 *   intent: { type: 'ask' },
 *   policy: { consent: 'private' }
 * };
 * const metadata = toLCEMetadata(lce, 'cbor');
 * client.someMethod(request, metadata, callback);
 * ```
 */

import * as grpc from '@grpc/grpc-js';
import { LCE } from '../types';
import { encodeLCE as encodeLCECBOR, decodeLCE as decodeLCECBOR } from '../cbor';

/**
 * Encoding format for LCE in gRPC metadata
 */
export type LCEEncoding = 'json' | 'cbor';

/**
 * Metadata keys for LCE
 */
export const LCE_METADATA_KEY = 'lce'; // JSON, base64-encoded
export const LCE_METADATA_KEY_BIN = 'lce-bin'; // CBOR, binary

/**
 * Convert LCE to gRPC Metadata
 *
 * Adds LCE envelope to metadata using specified encoding:
 * - 'json': Base64-encoded JSON in "lce" field (default)
 * - 'cbor': Binary CBOR in "lce-bin" field
 *
 * @param lce - LCE envelope
 * @param encoding - Encoding format (default: 'json')
 * @param existingMetadata - Optional existing metadata to augment
 * @returns gRPC Metadata with LCE attached
 */
export function toLCEMetadata(
  lce: LCE,
  encoding: LCEEncoding = 'json',
  existingMetadata?: grpc.Metadata
): grpc.Metadata {
  const metadata = existingMetadata || new grpc.Metadata();

  if (encoding === 'json') {
    // JSON: base64-encode to ensure ASCII-only
    const json = JSON.stringify(lce);
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    metadata.set(LCE_METADATA_KEY, base64);
  } else if (encoding === 'cbor') {
    // CBOR: binary encoding in "-bin" field
    const cborBuffer = encodeLCECBOR(lce);
    metadata.set(LCE_METADATA_KEY_BIN, cborBuffer);
  } else {
    throw new Error(`Unsupported encoding: ${encoding}`);
  }

  return metadata;
}

/**
 * Extract LCE from gRPC Metadata
 *
 * Tries to decode LCE from metadata in this order:
 * 1. CBOR from "lce-bin" (if present)
 * 2. JSON from "lce" (if present)
 * 3. null (if neither present)
 *
 * @param metadata - gRPC Metadata
 * @returns Decoded LCE or null if not found
 */
export function fromLCEMetadata(metadata: grpc.Metadata): LCE | null {
  // Try CBOR first (more efficient)
  const cborValues = metadata.get(LCE_METADATA_KEY_BIN);
  if (cborValues.length > 0) {
    const buffer = cborValues[0] as Buffer;
    try {
      return decodeLCECBOR(buffer);
    } catch (error) {
      throw new Error(`Failed to decode CBOR LCE: ${error}`);
    }
  }

  // Try JSON
  const jsonValues = metadata.get(LCE_METADATA_KEY);
  if (jsonValues.length > 0) {
    const base64 = jsonValues[0] as string;
    try {
      const json = Buffer.from(base64, 'base64').toString('utf8');
      const lce = JSON.parse(json) as LCE;

      // Validate basic structure
      if (!lce.v || !lce.intent || !lce.policy) {
        throw new Error('Invalid LCE: missing required fields');
      }

      return lce;
    } catch (error) {
      throw new Error(`Failed to decode JSON LCE: ${error}`);
    }
  }

  // Not found
  return null;
}

/**
 * Create gRPC interceptor for automatic LCE injection (client-side)
 *
 * This interceptor automatically attaches LCE to every outgoing call.
 *
 * @param lceProvider - Function that returns LCE for each call
 * @param encoding - Encoding format (default: 'json')
 * @returns gRPC interceptor
 *
 * @example
 * ```typescript
 * const interceptor = createLCEInterceptor(() => ({
 *   v: 1,
 *   intent: { type: 'ask' },
 *   policy: { consent: 'private' }
 * }));
 *
 * const client = new MyServiceClient(
 *   'localhost:50051',
 *   grpc.credentials.createInsecure(),
 *   { interceptors: [interceptor] }
 * );
 * ```
 */
export function createLCEInterceptor(
  lceProvider: () => LCE,
  encoding: LCEEncoding = 'json'
): grpc.Interceptor {
  return (options, nextCall) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start: (metadata, listener, next) => {
        const lce = lceProvider();
        const augmentedMetadata = toLCEMetadata(lce, encoding, metadata);
        next(augmentedMetadata, listener);
      },
    });
  };
}

/**
 * Wrap gRPC handler to extract LCE automatically (server-side)
 *
 * This wrapper extracts LCE from metadata and passes it to your handler.
 *
 * @param handler - Your gRPC handler function
 * @returns Wrapped handler with LCE extraction
 *
 * @example
 * ```typescript
 * const wrappedHandler = wrapHandlerWithLCE((call, callback, lce) => {
 *   console.log('Intent:', lce?.intent.type);
 *   callback(null, { message: 'OK' });
 * });
 *
 * server.addService(MyService, {
 *   myMethod: wrappedHandler
 * });
 * ```
 */
export function wrapHandlerWithLCE<TRequest, TResponse>(
  handler: (
    call: grpc.ServerUnaryCall<TRequest, TResponse>,
    callback: grpc.sendUnaryData<TResponse>,
    lce: LCE | null
  ) => void
): grpc.handleUnaryCall<TRequest, TResponse> {
  return (call, callback) => {
    const lce = fromLCEMetadata(call.metadata);
    handler(call, callback, lce);
  };
}

/**
 * Wrap streaming gRPC handler to extract LCE (server-side)
 *
 * @param handler - Your streaming gRPC handler
 * @returns Wrapped handler with LCE extraction
 */
export function wrapStreamHandlerWithLCE<TRequest, TResponse>(
  handler: (
    call: grpc.ServerWritableStream<TRequest, TResponse>,
    lce: LCE | null
  ) => void
): grpc.handleServerStreamingCall<TRequest, TResponse> {
  return (call) => {
    const lce = fromLCEMetadata(call.metadata);
    handler(call, lce);
  };
}

/**
 * Check if metadata contains LCE
 *
 * @param metadata - gRPC Metadata
 * @returns true if LCE is present
 */
export function hasLCE(metadata: grpc.Metadata): boolean {
  return (
    metadata.get(LCE_METADATA_KEY_BIN).length > 0 || metadata.get(LCE_METADATA_KEY).length > 0
  );
}

/**
 * Remove LCE from metadata
 *
 * @param metadata - gRPC Metadata
 */
export function removeLCE(metadata: grpc.Metadata): void {
  metadata.remove(LCE_METADATA_KEY);
  metadata.remove(LCE_METADATA_KEY_BIN);
}
