/**
 * WebSocket server tests
 */

import WebSocket from 'ws';
import { LRIWSServer } from '../src/ws/server';
import { LCE } from '../src/types';
import { encodeLRIFrame } from '../src/ws/types';

// Increase timeout for slow CI environments
jest.setTimeout(10000);

describe('LRIWSServer', () => {
  let server: LRIWSServer;
  // Use PID-based port range to avoid conflicts between parallel Jest workers
  // Each worker gets 50 ports starting from a unique base
  // Range: 10000-14950 (supports up to 99 parallel workers)
  const PORT_BASE = 10000 + (process.pid % 100) * 50;
  let portCounter = PORT_BASE;

  // Helper function to get a unique port for each test
  const getTestPort = () => portCounter++;

  beforeEach(async () => {
    // Give time for any previous test's port to fully release
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      // Give extra time for socket cleanup - increased for CI reliability
      await new Promise((resolve) => setTimeout(resolve, 500));
      server = null as any;
    }
  });

  describe('initialization', () => {
    it('should create server with default options', () => {
      const port = getTestPort();
      server = new LRIWSServer({ port });
      expect(server).toBeInstanceOf(LRIWSServer);
      expect(server.sessions.size).toBe(0);
    });

    it('should start listening on specified port', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      client.on('open', () => {
        client.close();
        done();
      });
    });
  });

  describe('LHS handshake', () => {
    it('should perform hello-mirror-bind-seal sequence', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (step === 0) {
          // Expect mirror
          expect(msg.step).toBe('mirror');
          expect(msg.lri_version).toBe('0.1');
          expect(msg.encoding).toBe('json');

          // Send bind
          client.send(
            JSON.stringify({
              step: 'bind',
              thread: 'test-thread-123',
            })
          );
          step++;
        } else if (step === 1) {
          // Expect seal
          expect(msg.step).toBe('seal');
          expect(msg.session_id).toBeDefined();
          expect(msg.session_id.length).toBeGreaterThan(0);

          client.close();
          done();
        }
      });

      client.on('open', () => {
        // Send hello
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json', 'cbor'],
            features: ['ltp', 'lss'],
          })
        );
      });
    });

    it('should reject invalid hello', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);

      client.on('close', (code) => {
        expect(code).toBe(1002); // Protocol error
        done();
      });

      client.on('open', () => {
        // Send invalid hello (missing required fields)
        client.send(JSON.stringify({ step: 'hello' }));
      });
    });

    it('should reject handshake out of order', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);

      client.on('close', (code) => {
        expect(code).toBe(1002);
        done();
      });

      client.on('open', () => {
        // Skip hello, send bind directly
        client.send(JSON.stringify({ step: 'bind' }));
      });
    });
  });

  describe('message handling', () => {
    it('should receive and parse LCE frames', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      let receivedSessionId: string;
      let receivedLce: LCE;
      let receivedPayload: string;

      server.onMessage = (sessionId, lce, payload) => {
        receivedSessionId = sessionId;
        receivedLce = lce;
        receivedPayload = payload.toString('utf-8');
      };

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (step === 0 && msg.step === 'mirror') {
          client.send(JSON.stringify({ step: 'bind' }));
          step++;
        } else if (step === 1 && msg.step === 'seal') {
          // Handshake complete, send LCE frame
          const lce: LCE = {
            v: 1,
            intent: { type: 'tell', goal: 'Test message' },
            policy: { consent: 'private' },
          };

          const frame = encodeLRIFrame(lce, 'Hello, server!');
          client.send(frame);

          setTimeout(() => {
            expect(receivedSessionId).toBeDefined();
            expect(receivedLce).toEqual(lce);
            expect(receivedPayload).toBe('Hello, server!');
            client.close();
            done();
          }, 50);
        }
      });

      client.on('open', () => {
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json'],
            features: [],
          })
        );
      });
    });

    it('should call onConnect handler', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      let connectedSessionId: string;

      server.onConnect = (sessionId) => {
        connectedSessionId = sessionId;
      };

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (step === 0 && msg.step === 'mirror') {
          client.send(JSON.stringify({ step: 'bind' }));
          step++;
        } else if (step === 1 && msg.step === 'seal') {
          setTimeout(() => {
            expect(connectedSessionId).toBeDefined();
            expect(connectedSessionId).toBe(msg.session_id);
            client.close();
            done();
          }, 50);
        }
      });

      client.on('open', () => {
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json'],
            features: [],
          })
        );
      });
    });

    it('should call onDisconnect handler', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      let disconnectedSessionId: string;

      server.onDisconnect = (sessionId) => {
        disconnectedSessionId = sessionId;
        expect(disconnectedSessionId).toBeDefined();
        done();
      };

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (step === 0 && msg.step === 'mirror') {
          client.send(JSON.stringify({ step: 'bind' }));
          step++;
        } else if (step === 1 && msg.step === 'seal') {
          setTimeout(() => {
            client.close();
          }, 50);
        }
      });

      client.on('open', () => {
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json'],
            features: [],
          })
        );
      });
    });
  });

  describe('sending messages', () => {
    it('should send LCE frames to client', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;
      let sessionId: string;

      client.on('message', (data) => {
        if (step < 2) {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'mirror') {
            client.send(JSON.stringify({ step: 'bind' }));
            step++;
          } else if (step === 1 && msg.step === 'seal') {
            sessionId = msg.session_id;

            // Send a message from server to client
            const lce: LCE = {
              v: 1,
              intent: { type: 'notify', goal: 'Server notification' },
              policy: { consent: 'private' },
            };

            server.send(sessionId, lce, 'Message from server');
            step++;
          }
        } else {
          // This should be the LCE frame from server
          const frame = data as Buffer;
          expect(frame.length).toBeGreaterThan(4);

          const lceLength = frame.readUInt32BE(0);
          const lceJson = frame.subarray(4, 4 + lceLength).toString('utf-8');
          const lce = JSON.parse(lceJson);
          const payload = frame.subarray(4 + lceLength).toString('utf-8');

          expect(lce.intent.type).toBe('notify');
          expect(payload).toBe('Message from server');

          client.close();
          done();
        }
      });

      client.on('open', () => {
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json'],
            features: [],
          })
        );
      });
    });
  });

  describe('session management', () => {
    it('should track multiple sessions', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client1 = new WebSocket(`ws://127.0.0.1:${port}`);
      const client2 = new WebSocket(`ws://127.0.0.1:${port}`);

      let client1Ready = false;
      let client2Ready = false;

      const checkBothReady = () => {
        if (client1Ready && client2Ready) {
          expect(server.sessions.size).toBe(2);
          client1.close();
          client2.close();
          setTimeout(done, 100);
        }
      };

      const setupClient = (client: WebSocket) => {
        let step = 0;

        client.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'mirror') {
            client.send(JSON.stringify({ step: 'bind' }));
            step++;
          } else if (step === 1 && msg.step === 'seal') {
            if (client === client1) {
              client1Ready = true;
            } else {
              client2Ready = true;
            }
            checkBothReady();
          }
        });

        client.on('open', () => {
          client.send(
            JSON.stringify({
              step: 'hello',
              lri_version: '0.1',
              encodings: ['json'],
              features: [],
            })
          );
        });
      };

      setupClient(client1);
      setupClient(client2);
    });

    it('should remove session on disconnect', (done) => {
      const port = getTestPort();
      server = new LRIWSServer({ port });

      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (step === 0 && msg.step === 'mirror') {
          client.send(JSON.stringify({ step: 'bind' }));
          step++;
        } else if (step === 1 && msg.step === 'seal') {
          expect(server.sessions.size).toBe(1);
          client.close();

          setTimeout(() => {
            expect(server.sessions.size).toBe(0);
            done();
          }, 100);
        }
      });

      client.on('open', () => {
        client.send(
          JSON.stringify({
            step: 'hello',
            lri_version: '0.1',
            encodings: ['json'],
            features: [],
          })
        );
      });
    });
  });
});
