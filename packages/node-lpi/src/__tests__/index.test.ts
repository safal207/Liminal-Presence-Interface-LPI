import * as lpi from '../index';

describe('index exports', () => {
  it('should export all types', () => {
    // Type exports (these won't have runtime values but are important for TypeScript)
    expect(lpi).toBeDefined();
  });

  it('should export validator functions', () => {
    expect(lpi.validateLCE).toBeDefined();
    expect(typeof lpi.validateLCE).toBe('function');
    expect(lpi.isLCE).toBeDefined();
    expect(typeof lpi.isLCE).toBe('function');
  });

  it('should export middleware functions', () => {
    expect(lpi.lpiMiddleware).toBeDefined();
    expect(typeof lpi.lpiMiddleware).toBe('function');
    expect(lpi.createLCEHeader).toBeDefined();
    expect(typeof lpi.createLCEHeader).toBe('function');
  });

  it('should export LCE schema', () => {
    expect(lpi.lceSchema).toBeDefined();
    expect(typeof lpi.lceSchema).toBe('object');
    expect(lpi.lceSchema.$id).toBe('https://lpi.dev/schema/lce-v0.1.json');
    expect(lpi.lceSchema.title).toBe('Liminal Context Envelope');
  });

  it('should have proper schema structure', () => {
    expect(lpi.lceSchema.type).toBe('object');
    expect(Array.isArray(lpi.lceSchema.required)).toBe(true);
    expect(lpi.lceSchema.required).toContain('v');
    expect(lpi.lceSchema.required).toContain('intent');
    expect(lpi.lceSchema.required).toContain('policy');
  });
});
