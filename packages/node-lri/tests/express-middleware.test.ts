import express, { type Express } from 'express';
import request from 'supertest';

import { lriMiddleware, createLCEHeader, type LRIMiddlewareOptions } from '../src/middleware';
import type { LCE } from '../src/types';

function createApp(opts?: LRIMiddlewareOptions): Express {
  const app = express();
  app.use(express.json());
  app.use(lriMiddleware(opts));

  app.get('/inspect', (req, res) => {
    const lri = (req as unknown as { lri?: { lce: LCE; raw: string } }).lri;
    res.json({
      lce: lri?.lce ?? null,
      raw: lri?.raw ?? null,
      header: res.get('Content-Type'),
    });
  });

  return app;
}

describe('lriMiddleware integration', () => {
  describe('successful requests', () => {
    it('parses a Base64 LCE header and exposes decoded payload on the request', async () => {
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
        header: 'application/liminal.lce+json',
      });
    });

    it('allows optional requests without LCE metadata', async () => {
      const app = createApp({ required: false });

      const response = await request(app).get('/inspect');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        lce: null,
        raw: null,
        header: 'application/liminal.lce+json',
      });
    });
  });

  describe('validation errors', () => {
    it('returns 422 with validation details when schema validation fails', async () => {
      const app = createApp({ validate: true });
      const invalidLce = {
        v: 1,
        intent: { type: 'invalid-intent' },
        policy: { consent: 'private' },
      };

      const response = await request(app)
        .get('/inspect')
        .set('LCE', Buffer.from(JSON.stringify(invalidLce), 'utf-8').toString('base64'));

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: 'Invalid LCE',
        details: expect.any(Array),
      });
      expect(response.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('malformed headers', () => {
    it('returns 400 when the LCE header is not valid Base64', async () => {
      const app = createApp();

      const response = await request(app).get('/inspect').set('LCE', '!!!not-base64!!!');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Malformed LCE header',
        message: expect.any(String),
      });
    });

    it('returns 400 when the decoded payload is not valid JSON', async () => {
      const app = createApp();
      const invalidJsonHeader = Buffer.from('{not json}', 'utf-8').toString('base64');

      const response = await request(app).get('/inspect').set('LCE', invalidJsonHeader);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Malformed LCE header',
        message: expect.any(String),
      });
    });

    it('returns 428 when the header is required but missing', async () => {
      const app = createApp({ required: true });

      const response = await request(app).get('/inspect');

      expect(response.status).toBe(428);
      expect(response.body).toEqual({
        error: 'LCE header required',
        header: 'LCE',
      });
    });
  });
});
