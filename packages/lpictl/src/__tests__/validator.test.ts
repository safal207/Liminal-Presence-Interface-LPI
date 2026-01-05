import { validate } from '../validator';

describe('validator', () => {
  it('should validate minimal valid LCE', () => {
    const lce = {
      v: 1,
      intent: { type: 'ask' },
      policy: { consent: 'private' },
    };

    const result = validate(lce);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject LCE with wrong version', () => {
    const lce = {
      v: 2,
      intent: { type: 'ask' },
      policy: { consent: 'private' },
    };

    const result = validate(lce);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject LCE with invalid intent type', () => {
    const lce = {
      v: 1,
      intent: { type: 'invalid-type' },
      policy: { consent: 'private' },
    };

    const result = validate(lce);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject LCE without required fields', () => {
    const lce = {
      v: 1,
    };

    const result = validate(lce);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
