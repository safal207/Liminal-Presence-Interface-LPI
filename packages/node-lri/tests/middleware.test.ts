/**
 * Middleware tests
 */

import { Request, Response } from 'express';
import { lriMiddleware, createLCEHeader } from '../src/middleware';
import { LCE } from '../src/types';

// Mock Express types
type MockRequest = Partial<Request> & {
  lri?: { lce: LCE; raw: string };
  header: jest.Mock;
};

type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
};

type NextFunction = jest.Mock;

describe('lriMiddleware', () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      header: jest.fn(),
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('with valid LCE header', () => {
    it('should parse and attach LCE to request', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask' },
        policy: { consent: 'private' },
      };

      const header = createLCEHeader(lce);
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.lri).toBeDefined();
      expect(mockReq.lri!.lce).toEqual(lce);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/liminal.lce+json'
      );
    });

    it('should handle full LCE', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'Test goal' },
        affect: { pad: [0.5, 0.3, 0.1], tags: ['curious'] },
        policy: { consent: 'team', share: ['service-1'] },
      };

      const header = createLCEHeader(lce);
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.lri!.lce).toEqual(lce);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('without LCE header', () => {
    it('should continue when not required', () => {
      mockReq.header = jest.fn().mockReturnValue(undefined);

      const middleware = lriMiddleware({ required: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.lri).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 428 when required', () => {
      mockReq.header = jest.fn().mockReturnValue(undefined);

      const middleware = lriMiddleware({ required: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(428);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'LCE header required',
        header: 'LCE',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('with invalid LCE', () => {
    it('should return 400 for malformed Base64', () => {
      mockReq.header = jest.fn().mockReturnValue('not-valid-base64!!!');

      const middleware = lriMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid JSON', () => {
      const invalidJson = Buffer.from('not json', 'utf-8').toString('base64');
      mockReq.header = jest.fn().mockReturnValue(invalidJson);

      const middleware = lriMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 422 for schema validation failure', () => {
      const invalidLce = {
        v: 1,
        intent: { type: 'invalid-type' },
        policy: { consent: 'private' },
      };

      const header = Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString(
        'base64'
      );
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware({ validate: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid LCE',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should continue when validation disabled', () => {
      const invalidLce = {
        v: 1,
        intent: { type: 'invalid-type' },
        policy: { consent: 'private' },
      };

      const header = Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString(
        'base64'
      );
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware({ validate: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('options', () => {
    it('should use custom header name', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const header = createLCEHeader(lce);
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware({ headerName: 'X-Custom-LCE' });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.header).toHaveBeenCalledWith('X-Custom-LCE');
    });

    it('should respect validate option', () => {
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      const header = createLCEHeader(lce);
      mockReq.header = jest.fn().mockReturnValue(header);

      const middleware = lriMiddleware({ validate: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('createLCEHeader', () => {
  it('should create valid Base64 header', () => {
    const lce: LCE = {
      v: 1,
      intent: { type: 'tell' },
      policy: { consent: 'private' },
    };

    const header = createLCEHeader(lce);

    // Should be valid Base64
    expect(() => Buffer.from(header, 'base64')).not.toThrow();

    // Should decode to original LCE
    const decoded = JSON.parse(
      Buffer.from(header, 'base64').toString('utf-8')
    );
    expect(decoded).toEqual(lce);
  });

  it('should handle full LCE', () => {
    const lce: LCE = {
      v: 1,
      intent: { type: 'ask', goal: 'Get data' },
      affect: { pad: [0.5, 0.3, 0.2], tags: ['urgent'] },
      meaning: { topic: 'test' },
      policy: { consent: 'team', share: ['s1', 's2'] },
      qos: { coherence: 0.9 },
    };

    const header = createLCEHeader(lce);
    const decoded = JSON.parse(
      Buffer.from(header, 'base64').toString('utf-8')
    );

    expect(decoded).toEqual(lce);
  });

  it('should be idempotent', () => {
    const lce: LCE = {
      v: 1,
      intent: { type: 'tell' },
      policy: { consent: 'private' },
    };

    const header1 = createLCEHeader(lce);
    const header2 = createLCEHeader(lce);

    expect(header1).toBe(header2);
  });
});
