/**
 * WebSocket client tests
 */

import WebSocket from 'ws';
import { LRIWSClient } from '../src/ws/client';
import { LCE } from '../src/types';
import { encodeLRIFrame, parseLRIFrame } from '../src/ws/types';

describe('LRIWSClient', () => {
  let mockServer: WebSocket.Server;
  const TEST_PORT = 8766;
  const TEST_URL = `ws://localhost:${TEST_PORT}`;

  beforeEach(() => {
    mockServer = new WebSocket.Server({ port: TEST_PORT });
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
  });

  describe('connection', () => {
    it('should connect and perform LHS handshake', (done) => {
      // Mock server that responds to handshake
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            // Send mirror
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            // Send seal
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session-123',
              })
            );
            step++;
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.connect().then(() => {
        expect(client.isReady()).toBe(true);
        client.disconnect();
        done();
      });
    });

    it('should reject on connection failure', (done) => {
      const client = new LRIWSClient('ws://localhost:9999'); // Non-existent server

      // Handle connection error through onError handler
      client.onError = (error) => {
        expect(error).toBeDefined();
        done();
      };

      client.connect().catch(() => {
        // Also handle via catch in case onError doesn't fire
        if (!done) return;
        done();
      });
    });

    it('should handle server disconnect during handshake', (done) => {
      mockServer.on('connection', (ws) => {
        ws.on('message', () => {
          // Close immediately without completing handshake
          ws.close();
        });
      });

      const client = new LRIWSClient(TEST_URL);

      // Handle connection close through onClose handler
      client.onClose = () => {
        done();
      };

      client.connect().catch(() => {
        // Connection should fail or close
      });
    });
  });

  describe('sending messages', () => {
    it('should send LCE frames', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          if (step < 2) {
            const msg = JSON.parse(data.toString());

            if (step === 0 && msg.step === 'hello') {
              ws.send(
                JSON.stringify({
                  step: 'mirror',
                  lri_version: '0.1',
                  encoding: 'json',
                  features: [],
                })
              );
              step++;
            } else if (step === 1 && msg.step === 'bind') {
              ws.send(
                JSON.stringify({
                  step: 'seal',
                  session_id: 'test-session',
                })
              );
              step++;
            }
          } else {
            // This should be an LCE frame
            const frame = data as Buffer;
            const parsed = parseLRIFrame(frame);

            expect(parsed.lce.intent.type).toBe('tell');
            expect(parsed.lce.intent.goal).toBe('Test message');
            expect(parsed.payload.toString('utf-8')).toBe('Hello, server!');

            ws.close();
            done();
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.connect().then(() => {
        const lce: LCE = {
          v: 1,
          intent: { type: 'tell', goal: 'Test message' },
          policy: { consent: 'private' },
        };

        client.send(lce, 'Hello, server!');
      });
    });

    it('should throw when sending before connected', () => {
      const client = new LRIWSClient(TEST_URL);

      const lce: LCE = {
        v: 1,
        intent: { type: 'tell' },
        policy: { consent: 'private' },
      };

      expect(() => client.send(lce, 'test')).toThrow('Not connected');
    });
  });

  describe('receiving messages', () => {
    it('should receive and parse LCE frames', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );

            // Send an LCE frame to client
            setTimeout(() => {
              const lce: LCE = {
                v: 1,
                intent: { type: 'notify', goal: 'Server message' },
                policy: { consent: 'private' },
              };

              const frame = encodeLRIFrame(lce, 'Message from server');
              ws.send(frame);
            }, 50);
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.onMessage = (lce, payload) => {
        expect(lce.intent.type).toBe('notify');
        expect(lce.intent.goal).toBe('Server message');
        expect(payload.toString('utf-8')).toBe('Message from server');

        client.disconnect();
        done();
      };

      client.connect();
    });

    it('should call onError on invalid frame', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );

            // Send invalid frame
            setTimeout(() => {
              ws.send(Buffer.from([0x00, 0x01])); // Too small
            }, 50);
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.onError = (error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('Frame too small');
        client.disconnect();
        done();
      };

      client.connect();
    });
  });

  describe('disconnection', () => {
    it('should disconnect cleanly', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );
          }
        });

        ws.on('close', () => {
          done();
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.connect().then(() => {
        expect(client.isReady()).toBe(true);
        client.disconnect();
        expect(client.isReady()).toBe(false);
      });
    });

    it('should call onClose handler', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.onClose = () => {
        done();
      };

      client.connect().then(() => {
        client.disconnect();
      });
    });

    it('should handle server-initiated disconnect', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );

            // Server closes connection
            setTimeout(() => {
              ws.close();
            }, 50);
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      client.onClose = () => {
        expect(client.isReady()).toBe(false);
        done();
      };

      client.connect();
    });
  });

  describe('state management', () => {
    it('should report ready state correctly', (done) => {
      mockServer.on('connection', (ws) => {
        let step = 0;

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (step === 0 && msg.step === 'hello') {
            ws.send(
              JSON.stringify({
                step: 'mirror',
                lri_version: '0.1',
                encoding: 'json',
                features: [],
              })
            );
            step++;
          } else if (step === 1 && msg.step === 'bind') {
            ws.send(
              JSON.stringify({
                step: 'seal',
                session_id: 'test-session',
              })
            );
          }
        });
      });

      const client = new LRIWSClient(TEST_URL);

      expect(client.isReady()).toBe(false);

      client.connect().then(() => {
        expect(client.isReady()).toBe(true);

        client.disconnect();
        expect(client.isReady()).toBe(false);

        done();
      });
    });
  });
});
