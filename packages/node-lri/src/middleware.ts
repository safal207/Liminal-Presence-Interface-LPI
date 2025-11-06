import { Request, Response, NextFunction } from 'express';
import { LCE } from './types';
import { validateLCE } from './validator';

export interface LRIMiddlewareOptions {
  /** Require LCE header on all requests */
  required?: boolean;
  /** Custom header name (default: 'LCE') */
  headerName?: string;
  /** Validate schema */
  validate?: boolean;
}

/**
 * Express middleware for LRI/LCE support
 *
 * Reads LCE from request header (Base64-encoded JSON)
 * Validates against schema
 * Attaches parsed LCE to req.lri
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { lriMiddleware } from 'node-lri';
 *
 * const app = express();
 * app.use(lriMiddleware({ required: false, validate: true }));
 *
 * app.get('/api/data', (req: any, res) => {
 *   const lce = req.lri?.lce;
 *   console.log('Intent:', lce?.intent.type);
 *   res.json({ ok: true });
 * });
 * ```
 */
export function lriMiddleware(opts: LRIMiddlewareOptions = {}) {
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
        (req as any).lri = {
          lce,
          raw: json,
        };
      } catch (err) {
        return res.status(400).json({
          error: 'Malformed LCE header',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (required && !(req as any).lri) {
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
