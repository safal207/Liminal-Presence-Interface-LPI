/** RFC 8785 (JCS) canonicalization — avoids runtime ESM-CJS interop issues. */
function jcs(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => jcs(v) ?? 'null').join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const pairs: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const v = jcs(obj[key]);
      if (v !== undefined) {
        pairs.push(`${JSON.stringify(key)}:${v}`);
      }
    }
    return '{' + pairs.join(',') + '}';
  }
  return undefined;
}

export function canonicalizeLtpPayload(value: unknown): string {
  const canonical = jcs(value);
  if (typeof canonical !== 'string') {
    throw new Error('Failed to canonicalize payload');
  }
  return canonical;
}

export default canonicalizeLtpPayload;
