/**
 * LCE Validator - проверка правильности формы
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

let validateFn: ValidateFunction | null = null;

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Load LCE schema from file
 */
function loadSchema(): Record<string, unknown> {
  const schemaPath = path.join(__dirname, '../../../schemas/lce-v0.1.json');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

/**
 * Initialize validator (lazy)
 */
function getValidator(): ValidateFunction {
  if (!validateFn) {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateSchema: false, // Support draft 2020-12
    });
    addFormats(ajv);

    const schema = loadSchema();
    validateFn = ajv.compile(schema);
  }
  return validateFn;
}

/**
 * Validate LCE data
 */
export function validate(data: unknown): ValidationResult {
  const validator = getValidator();
  const valid = validator(data) as boolean;

  if (valid) {
    return { valid: true };
  }

  const errors: ValidationError[] = (validator.errors || []).map((err) => ({
    path: err.instancePath || '/',
    message: err.message || 'Validation error',
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return { valid: false, errors };
}

/**
 * Validate LCE from file
 */
export function validateFile(filePath: string): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validate(data);
  } catch (err) {
    return {
      valid: false,
      errors: [{
        path: '/',
        message: err instanceof Error ? err.message : 'Failed to read or parse file',
      }],
    };
  }
}
