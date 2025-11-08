import express, { type Express, type Request as ExpressRequest } from 'express';
import request from 'supertest';

import {
  lriMiddleware,
  createLCEHeader,
  type LRIMiddlewareOptions,
} from '../src/middleware';
import type { LCE } from '../src/types';

type InspectableRequest = ExpressRequest & {
  lri?: { lce: LCE; raw: string };
};

function createApp(opts?: LRIMiddlewareOptions): Express {
  const app = express();
  app.use(express.json());
  app.use(lriMiddleware(opts));

  app.get('/inspect', (req, res) => {
    const { lri } = req as InspectableRequest;
    res.json({
      lce: lri?.lce ?? null,
      raw: lri?.raw ?? null,
      header: res.get('Content-Type'),
    });
  });

  return app;
}

describe('Express middleware integration', () => {
  describe('successful requests', () => {
    it('parses Base64 LCE headers and attaches decoded payload to the request', async () => {
      const app = createApp();
      const lce: LCE = {
        v: 1,
        intent: { type: 'ask', goal: 'Integration test' },
        policy: { consent: 'private' },
        memory: {
          thread: '00000000-0000-4000-8000-000000000000',
          t: '2024-01-01T00:00:00.000Z',
        },
      };

      const response = await request(app)
        .get('/inspect')
        .set('LCE', createLCEHeader(lce));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(
        /application\/liminal\.lce\+json/
      );
      expect(response.body).toEqual({
        lce,
        raw: JSON.stringify(lce),
        header: 'application/liminal.lce+json',
      });
    });

    it('supports custom header names', async () => {
      const app = createApp({ headerName: 'X-LCE' });
      const lce: LCE = {
        v: 1,
        intent: { type: 'tell', goal: 'Custom header' },
        policy: { consent: 'team' },
      };

      const response = await request(app)
        .get('/inspect')
        .set('X-LCE', createLCEHeader(lce));

      expect(response.status).toBe(200);
      expect(response.body.lce).toEqual(lce);
      expect(response.body.raw).toBe(JSON.stringify(lce));
    });

    it('allows requests without LCE metadata when not required', async () => {
      const app = createApp({ required: false });

      const response = await request(app).get('/inspect');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(
        /application\/liminal\.lce\+json/
      );
      expect(response.body).toEqual({
        lce: null,
        raw: null,
        header: 'application/liminal.lce+json',
      });
    });
  });

  describe('validation failures', () => {
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
      expect(response.headers['content-type']).toMatch('application/json');
      expect(response.body).toMatchObject({
        error: 'Invalid LCE',
        details: expect.any(Array),
      });
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0]).toMatchObject({
        path: expect.stringMatching(/^\//),
        message: expect.any(String),
      });
    });
  });

  describe('malformed headers', () => {
    it('returns 400 when the LCE header is not valid Base64', async () => {
      const app = createApp();

      const response = await request(app)
        .get('/inspect')
        .set('LCE', '!!!not-base64!!!');

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch('application/json');
      expect(response.body).toMatchObject({
        error: 'Malformed LCE header',
        message: expect.any(String),
      });
    });

    it('returns 400 when the decoded payload is not valid JSON', async () => {
      const app = createApp();
      const invalidJsonHeader = Buffer.from('{not json}', 'utf-8').toString('base64');

      const response = await request(app)
        .get('/inspect')
        .set('LCE', invalidJsonHeader);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch('application/json');
      expect(response.body).toMatchObject({
        error: 'Malformed LCE header',
        message: expect.any(String),
      });
    });

    it('returns 428 when the header is required but missing', async () => {
      const app = createApp({ required: true });

      const response = await request(app).get('/inspect');

      expect(response.status).toBe(428);
      expect(response.headers['content-type']).toMatch('application/json');
      expect(response.body).toEqual({
        error: 'LCE header required',
        header: 'LCE',
      });
    });
  });
});
