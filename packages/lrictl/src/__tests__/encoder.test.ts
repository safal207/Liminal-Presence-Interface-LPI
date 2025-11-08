import { encode, decode, encodeObject, decodeToObject, isValidBase64 } from '../encoder';

describe('encoder', () => {
  describe('encode and decode', () => {
    it('should encode string to Base64', () => {
      const input = 'hello world';
      const encoded = encode(input);
      expect(encoded).toBe('aGVsbG8gd29ybGQ=');
    });

    it('should decode Base64 to string', () => {
      const input = 'aGVsbG8gd29ybGQ=';
      const decoded = decode(input);
      expect(decoded).toBe('hello world');
    });

    it('should round-trip encode/decode', () => {
      const original = 'test message';
      const encoded = encode(original);
      const decoded = decode(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe('encodeObject and decodeToObject', () => {
    it('should encode object to Base64', () => {
      const obj = { v: 1, test: true };
      const encoded = encodeObject(obj);
      expect(typeof encoded).toBe('string');
      expect(isValidBase64(encoded)).toBe(true);
    });

    it('should decode Base64 to object', () => {
      const obj = { v: 1, test: true };
      const encoded = encodeObject(obj);
      const decoded = decodeToObject(encoded);
      expect(decoded).toEqual(obj);
    });

    it('should round-trip with complex object', () => {
      const lce = {
        v: 1,
        intent: { type: 'ask', goal: 'test' },
        policy: { consent: 'private' },
      };

      const encoded = encodeObject(lce);
      const decoded = decodeToObject(encoded);
      expect(decoded).toEqual(lce);
    });
  });

  describe('isValidBase64', () => {
    it('should return true for valid Base64', () => {
      expect(isValidBase64('aGVsbG8=')).toBe(true);
      expect(isValidBase64('SGVsbG8gV29ybGQ=')).toBe(true);
    });

    it('should return false for invalid Base64', () => {
      expect(isValidBase64('not-base64!!!')).toBe(false);
      expect(isValidBase64('invalid characters @@')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isValidBase64('')).toBe(true); // Empty is technically valid Base64
    });
  });
});
