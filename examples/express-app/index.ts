/**
 * Express + LRI Example
 *
 * Demonstrates LRI middleware usage with Express
 */

import express from 'express';
import { lriMiddleware, createLCEHeader, LCE } from '../../packages/node-lri/src';

const app = express();
const PORT = process.env.PORT || 3000;

// Apply LRI middleware globally
app.use(lriMiddleware({
  required: false,  // LCE is optional
  validate: true,   // Validate against schema
}));

// Simple ping endpoint
app.get('/ping', (req: any, res) => {
  const lce = req.lri?.lce;

  console.log('Intent:', lce?.intent.type);
  console.log('Affect:', lce?.affect?.tags);

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    receivedLCE: !!lce,
  });
});

// Echo endpoint - mirrors LCE with response
app.post('/echo', express.json(), (req: any, res) => {
  const requestLCE = req.lri?.lce;

  // Create response LCE
  const responseLCE: LCE = {
    v: 1,
    intent: {
      type: 'tell',
      goal: 'Echo response',
    },
    affect: {
      tags: ['helpful'],
    },
    memory: {
      thread: requestLCE?.memory?.thread,
      t: new Date().toISOString(),
    },
    policy: {
      consent: requestLCE?.policy?.consent || 'private',
    },
  };

  // Attach LCE to response header
  res.setHeader('LCE', createLCEHeader(responseLCE));

  res.json({
    echo: req.body,
    lce: responseLCE,
  });
});

// Intent-aware endpoint
app.get('/api/data', (req: any, res) => {
  const lce = req.lri?.lce;
  const intentType = lce?.intent.type || 'unknown';

  // Respond differently based on intent
  switch (intentType) {
    case 'ask':
      res.json({
        message: 'Here is the data you requested',
        data: [1, 2, 3, 4, 5],
      });
      break;

    case 'sync':
      res.json({
        message: 'Context synchronized',
        coherence: lce.qos?.coherence || 0.5,
      });
      break;

    default:
      res.json({
        message: 'Data endpoint',
        intent: intentType,
      });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Express + LRI server running on http://localhost:${PORT}`);
  console.log(`\nTry:\n  curl http://localhost:${PORT}/ping`);
});

export default app;
