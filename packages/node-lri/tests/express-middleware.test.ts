import express from 'express';
import request from 'supertest';

import { lriMiddleware, createLCEHeader, type LRIMiddlewareOptions } from '../src/middleware';
import type { LCE } from '../src/types';

function createApp(opts?: LRIMiddlewareOptions) {
  const app = express();
  app.use(express.json());
  app.use(lriMiddleware(opts));

  app.get('/inspect', (req, res) => {
    const lri = (req as unknown as { lri?: { lce: LCE; raw: string } }).lri;
    res.json({
      lce: lri?.lce ?? null,
      raw: lri?.raw ?? null,
    });
  });

  return app;
}

describe('lriMiddleware integration', () => {
  it('parses the LCE header and exposes parsed/decoded payload', async () => {
    const app = createApp();
    const lce: LCE = {
      v: 1,
      intent: { type: 'ask', goal: 'Integration test' },
      policy: { consent: 'private' },
    };

    const response = await request(app)
      .get('/inspect')
      .set('LCE', createLCEHeader(lce));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      lce,
      raw: JSON.stringify(lce),
    });
  });

  it('validates schema when enabled and returns 422 on failure', async () => {
    const app = createApp({ validate: true });
    const invalidLce = {
      v: 1,
      intent: { type: 'invalid-intent' },
      policy: { consent: 'private' },
    };

    const header = Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString('base64');

    const response = await request(app).get('/inspect').set('LCE', header);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: 'Invalid LCE',
      details: expect.any(Array),
    });
  });

  it('returns 400 when the LCE header is not valid Base64', async () => {
    const app = createApp();

    const response = await request(app).get('/inspect').set('LCE', '!!!not-base64!!!');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Malformed LCE header',
    });
  });

  it('returns 428 when header is required but missing', async () => {
    const app = createApp({ required: true });

    const response = await request(app).get('/inspect');

    expect(response.status).toBe(428);
    expect(response.body).toEqual({
      error: 'LCE header required',
      header: 'LCE',
    });
  });
});
