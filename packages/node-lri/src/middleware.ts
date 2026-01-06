import { Request, Response, NextFunction } from 'express';
import { LCE } from './types';
import { validateLCE } from './validator';
import { defineDeprecatedExport } from './deprecation';

export interface LPIMiddlewareOptions {
  /** Require LCE header on all requests */
  required?: boolean;
  /** Custom header name (default: 'LCE') */
  headerName?: string;
  /** Validate schema */
  validate?: boolean;
}

export type LRIMiddlewareOptions = LPIMiddlewareOptions;

/**
 * Express middleware for LPI/LCE support
 *
 * Reads LCE from request header (Base64-encoded JSON)
 * Validates against schema
 * Attaches parsed LCE to req.lpi (and req.lri for backward compatibility)
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { lpiMiddleware } from 'node-lri';
 *
 * const app = express();
 * app.use(lpiMiddleware({ required: false, validate: true }));
 *
 * app.get('/api/data', (req: any, res) => {
 *   const lce = req.lpi?.lce;
 *   console.log('Intent:', lce?.intent.type);
 *   res.json({ ok: true });
 * });
 * ```
 */
export function lpiMiddleware(opts: LPIMiddlewareOptions = {}) {
  const {
    required = false,
    headerName = 'LCE',
    validate = true,
  } = opts;

  return (req: Request, res: Response, next: NextFunction) => {
    const b64 = req.header(headerName);

    if (b64) {
      try {
        const json = Buffer.from(b64, 'base64').toString('utf-8');
        const lce: LCE = JSON.parse(json);

        if (validate) {
          const validation = validateLCE(lce);
          if (!validation.valid) {
            return res.status(422).json({
              error: 'Invalid LCE',
              details: validation.errors,
            });
          }
        }

        // Attach to request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = {
          lce,
          raw: json,
        };

        (req as any).lpi = payload;
        (req as any).lri = payload;
      } catch (err) {
        return res.status(400).json({
          error: 'Malformed LCE header',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (required && !(req as any).lpi) {
      return res.status(428).json({
        error: 'LCE header required',
        header: headerName,
      });
    }

    // Set response content type
    res.setHeader('Content-Type', 'application/liminal.lce+json');
    next();
  };
}

/**
 * Helper to create LCE response header
 */
export function createLCEHeader(lce: LCE): string {
  const json = JSON.stringify(lce);
  return Buffer.from(json, 'utf-8').toString('base64');
}

const lriMiddleware = lpiMiddleware;
export { lriMiddleware };

defineDeprecatedExport(exports, 'lriMiddleware', 'lpiMiddleware', lpiMiddleware);
