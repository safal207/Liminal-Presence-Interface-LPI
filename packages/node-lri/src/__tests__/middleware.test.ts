import { Request, Response, NextFunction } from 'express';
import { lriMiddleware, createLCEHeader } from '../middleware';
import { LCE } from '../types';

// Mock request/response helpers
const createMockRequest = (lceHeader?: string): Partial<Request> => ({
  header: ((name: string) => {
    if (name === 'LCE') return lceHeader;
    return undefined;
  }) as any,
});

const createMockResponse = (): Partial<Response> & {
  statusCode?: number;
  jsonData?: any;
  headers: Record<string, string>;
} => {
  const res: any = {
    statusCode: 200,
    jsonData: null,
    headers: {},
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((data: any) => {
      res.jsonData = data;
      return res;
    }),
    setHeader: jest.fn((key: string, value: string) => {
      res.headers[key] = value;
      return res;
    }),
  };
  return res;
};

const createMockNext = (): jest.Mock<NextFunction> => jest.fn();

describe('middleware', () => {
  describe('lriMiddleware', () => {
    it('should parse valid LCE header and attach to request', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };
      const header = createLCEHeader(lce);

      const req = createMockRequest(header) as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware();
      middleware(req, res, next);

      expect(req.lri).toBeDefined();
      expect(req.lri.lce).toEqual(lce);
      expect(req.lri.raw).toBe(JSON.stringify(lce));
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/liminal.lce+json');
    });

    it('should pass through when no LCE header present (not required)', () => {
      const req = createMockRequest() as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ required: false });
      middleware(req, res, next);

      expect(req.lri).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 428 when LCE header required but missing', () => {
      const req = createMockRequest() as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ required: true });
      middleware(req, res, next);

      expect(res.statusCode).toBe(428);
      expect(res.jsonData).toEqual({
        error: 'LCE header required',
        header: 'LCE',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 on malformed base64', () => {
      const req = createMockRequest('not-valid-base64!!!') as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware();
      middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toHaveProperty('error', 'Malformed LCE header');
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 on invalid JSON', () => {
      const invalidJson = Buffer.from('{ invalid json }', 'utf-8').toString('base64');
      const req = createMockRequest(invalidJson) as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware();
      middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toHaveProperty('error', 'Malformed LCE header');
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 422 on schema validation failure', () => {
      const invalidLce = {
        v: 1,
        intent: { type: 'invalid-intent' },
        policy: { consent: 'private' },
      };
      const header = Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString('base64');

      const req = createMockRequest(header) as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ validate: true });
      middleware(req, res, next);

      expect(res.statusCode).toBe(422);
      expect(res.jsonData).toHaveProperty('error', 'Invalid LCE');
      expect(res.jsonData).toHaveProperty('details');
      expect(Array.isArray(res.jsonData.details)).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip validation when validate option is false', () => {
      const invalidLce = {
        v: 1,
        intent: { type: 'invalid-intent' },
        policy: { consent: 'private' },
      };
      const header = Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString('base64');

      const req = createMockRequest(header) as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ validate: false });
      middleware(req, res, next);

      expect(req.lri).toBeDefined();
      expect(req.lri.lce).toEqual(invalidLce);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should use custom header name', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };
      const header = createLCEHeader(lce);

      const req = {
        header: jest.fn((name: string) => {
          if (name === 'X-Custom-LCE') return header;
          return undefined;
        }),
      } as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ headerName: 'X-Custom-LCE' });
      middleware(req, res, next);

      expect(req.lri).toBeDefined();
      expect(req.lri.lce).toEqual(lce);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle LCE with all optional fields', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: 'Update status' },
        affect: {
          pad: [0.5, 0.3, 0.7],
          tags: ['confident'],
        },
        meaning: {
          topic: 'status',
          ontology: 'https://schema.org/Status',
        },
        trust: {
          proof: 'signature',
          attest: ['issuer'],
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2024-01-15T10:30:00Z',
          ttl: 'PT1H',
        },
        policy: {
          consent: 'team',
          share: ['analytics@example.com'],
          dp: 'epsilon=0.1',
        },
        qos: {
          coherence: 0.95,
          stability: 'high',
        },
        trace: {
          hop: 2,
          provenance: ['service-a'],
        },
        sig: 'signature-data',
      };
      const header = createLCEHeader(lce);

      const req = createMockRequest(header) as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware();
      middleware(req, res, next);

      expect(req.lri).toBeDefined();
      expect(req.lri.lce).toEqual(lce);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always set Content-Type header', () => {
      const req = createMockRequest() as any;
      const res = createMockResponse() as any;
      const next = createMockNext();

      const middleware = lriMiddleware({ required: false });
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/liminal.lce+json');
    });
  });

  describe('createLCEHeader', () => {
    it('should create valid base64-encoded header', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const header = createLCEHeader(lce);

      // Verify it's valid base64
      expect(typeof header).toBe('string');
      expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Verify it decodes back to original
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      expect(parsed).toEqual(lce);
    });

    it('should create consistent headers for same input', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const header1 = createLCEHeader(lce);
      const header2 = createLCEHeader(lce);

      expect(header1).toBe(header2);
    });

    it('should handle LCE with all fields', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: 'Test' },
        affect: { pad: [0, 0, 0], tags: ['neutral'] },
        meaning: { topic: 'test' },
        trust: { proof: 'sig' },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: '2024-01-15T10:30:00Z',
        },
        policy: { consent: 'public' },
        qos: { coherence: 1 },
        trace: { hop: 0 },
        sig: 'signature',
      };

      const header = createLCEHeader(lce);
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      expect(parsed).toEqual(lce);
    });

    it('should preserve unicode characters', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: '日本語テスト 🚀' },
        policy: { consent: 'private' },
      };

      const header = createLCEHeader(lce);
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      expect(parsed.intent.goal).toBe('日本語テスト 🚀');
    });
  });
});
