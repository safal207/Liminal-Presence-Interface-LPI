import { resetDeprecatedWarnings } from '../src/deprecation';

describe('deprecated LRI aliases', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    resetDeprecatedWarnings();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once when calling lriMiddleware', () => {
    const { lpiMiddleware, lriMiddleware } = require('../src/middleware') as typeof import('../src/middleware');

    expect(typeof lriMiddleware).toBe('function');
    lriMiddleware();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    lriMiddleware();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once when instantiating LRIWSClient', () => {
    const { LPIWSClient, LRIWSClient } = require('../src/ws/client') as typeof import('../src/ws/client');

    expect(LRIWSClient).not.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(0);

    const client = new LRIWSClient('ws://localhost:1234');
    expect(client).toBeInstanceOf(LPIWSClient);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once when calling parseLRIFrame', () => {
    const { parseLPIFrame, parseLRIFrame } = require('../src/ws/types') as typeof import('../src/ws/types');

    expect(typeof parseLRIFrame).toBe('function');
    expect(warnSpy).toHaveBeenCalledTimes(0);

    expect(() => parseLRIFrame(Buffer.alloc(0))).toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
