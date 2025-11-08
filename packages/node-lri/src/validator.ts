import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { LCE } from './types';
import lceSchema from '../../../schemas/lce-v0.1.json';

let validateFn: ValidateFunction | null = null;

/**
 * Initialize AJV validator (lazy-loaded)
 */
function getValidator(): ValidateFunction {
  if (!validateFn) {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateSchema: false, // Skip meta-schema validation to support draft 2020-12
      validateFormats: true,
    });
    addFormats(ajv);
    // Remove $schema field to avoid draft validation issues
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...schemaWithoutMeta } = lceSchema;
    validateFn = ajv.compile(schemaWithoutMeta);
  }
  return validateFn;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Validate LCE against JSON Schema
 */
export function validateLCE(lce: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(lce) as boolean;

  if (valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: (validate.errors || []).map((err) => ({
      path: err.instancePath || '/',
      message: err.message || 'Validation error',
    })),
  };
}

/**
 * Type guard for LCE
 */
export function isLCE(obj: unknown): obj is LCE {
  return validateLCE(obj).valid;
}
