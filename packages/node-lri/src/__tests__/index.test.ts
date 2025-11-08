import * as lri from '../index';

describe('index exports', () => {
  it('should export all types', () => {
    // Type exports (these won't have runtime values but are important for TypeScript)
    expect(lri).toBeDefined();
  });

  it('should export validator functions', () => {
    expect(lri.validateLCE).toBeDefined();
    expect(typeof lri.validateLCE).toBe('function');
    expect(lri.isLCE).toBeDefined();
    expect(typeof lri.isLCE).toBe('function');
  });

  it('should export middleware functions', () => {
    expect(lri.lriMiddleware).toBeDefined();
    expect(typeof lri.lriMiddleware).toBe('function');
    expect(lri.createLCEHeader).toBeDefined();
    expect(typeof lri.createLCEHeader).toBe('function');
  });

  it('should export LCE schema', () => {
    expect(lri.lceSchema).toBeDefined();
    expect(typeof lri.lceSchema).toBe('object');
    expect(lri.lceSchema.$id).toBe('https://lri.dev/schema/lce-v0.1.json');
    expect(lri.lceSchema.title).toBe('Liminal Context Envelope');
  });

  it('should have proper schema structure', () => {
    expect(lri.lceSchema.type).toBe('object');
    expect(Array.isArray(lri.lceSchema.required)).toBe(true);
    expect(lri.lceSchema.required).toContain('v');
    expect(lri.lceSchema.required).toContain('intent');
    expect(lri.lceSchema.required).toContain('policy');
  });
});
