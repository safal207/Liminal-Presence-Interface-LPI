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

  it('warns once when accessing lriMiddleware', () => {
    const { lpiMiddleware, lriMiddleware } = require('../src/middleware') as typeof import('../src/middleware');

    expect(lriMiddleware).toBe(lpiMiddleware);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const { lriMiddleware: lriMiddlewareAgain } = require('../src/middleware') as typeof import('../src/middleware');
    expect(lriMiddlewareAgain).toBe(lpiMiddleware);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once when accessing LRIWSClient', () => {
    const { LPIWSClient, LRIWSClient } = require('../src/ws/client') as typeof import('../src/ws/client');

    expect(LRIWSClient).toBe(LPIWSClient);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once when accessing parseLRIFrame', () => {
    const { parseLPIFrame, parseLRIFrame } = require('../src/ws/types') as typeof import('../src/ws/types');

    expect(parseLRIFrame).toBe(parseLPIFrame);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
