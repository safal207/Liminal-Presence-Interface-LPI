import canonicalize from 'canonicalize';

/**
 * Canonicalize an arbitrary value according to RFC 8785 (JCS).
 *
 * @param value - JavaScript value to canonicalize.
 * @returns Canonical JSON string.
 */
export function canonicalizeLtpPayload(value: unknown): string {
  const canonical = canonicalize(value);
  if (typeof canonical !== 'string') {
    throw new Error('Failed to canonicalize payload');
  }
  return canonical;
}

export default canonicalizeLtpPayload;
