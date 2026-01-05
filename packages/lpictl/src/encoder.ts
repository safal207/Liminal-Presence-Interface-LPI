/**
 * LCE Encoder/Decoder - трансформация форм
 */

/**
 * Encode JSON to Base64
 */
export function encode(jsonString: string): string {
  return Buffer.from(jsonString, 'utf-8').toString('base64');
}

/**
 * Encode object to Base64
 */
export function encodeObject(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return encode(json);
}

/**
 * Decode Base64 to JSON string
 */
export function decode(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Decode Base64 to object
 */
export function decodeToObject(base64: string): unknown {
  const json = decode(base64);
  return JSON.parse(json);
}

/**
 * Check if string is valid Base64
 */
export function isValidBase64(str: string): boolean {
  try {
    const decoded = Buffer.from(str, 'base64').toString('base64');
    return decoded === str;
  } catch {
    return false;
  }
}
