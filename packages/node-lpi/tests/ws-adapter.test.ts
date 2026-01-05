/**
 * Integration tests for the LPI WebSocket adapter using node:test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { LCE } from '../src/types';
import { LPIWebSocketAdapter } from '../src/ws/adapter';
import type { LPIWSConnection } from '../src/ws/types';
type AdapterInstance = InstanceType<typeof LPIWebSocketAdapter>;

const createServer = async () => {
  const server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    if (server.address()) {
      resolve();
    } else {
      server.once('listening', () => resolve());
    }
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to obtain listening address');
  }

  return { server, port: address.port };
};

test('LPIWebSocketAdapter performs handshake and echoes frames', async (t) => {
  const { server, port } = await createServer();
  t.after(() =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    })
  );

  const clientId = 'adapter-test-client';
  const serverId = 'adapter-test-server';
  const sealDurationMs = 60_000;

  let serverAdapter: AdapterInstance | null = null;
  let frameResolve: ((value: { lce: LCE; payload: Buffer }) => void) | null = null;
  const serverFramePromise = new Promise<{ lce: LCE; payload: Buffer }>((resolve) => {
    frameResolve = resolve;
  });

  const serverReady = new Promise<LPIWSConnection>((resolve) => {
    server.on('connection', (socket) => {
      serverAdapter = new LPIWebSocketAdapter({
        role: 'server',
        ws: socket,
        features: ['lss'],
        serverId,
        sealDurationMs,
      });

      serverAdapter.once('ready', (connection) => {
        resolve(connection);
      });

      serverAdapter.once('frame', (lce, payload) => {
        frameResolve?.({ lce, payload });
        serverAdapter?.send(
          {
            v: 1,
            intent: { type: 'tell', goal: `Echo of: ${lce.intent.goal ?? 'message'}` },
            policy: { consent: 'private' },
          },
          `Echo: ${payload.toString()}`
        );
      });
    });
  });

  const clientSocket = new WebSocket(`ws://127.0.0.1:${port}`);
  const clientAdapter = new LPIWebSocketAdapter({
    role: 'client',
    ws: clientSocket,
    features: ['lss'],
    clientId,
  });

  const [serverConnection, clientConnection] = await Promise.all([
    serverReady,
    clientAdapter.ready,
  ]);

  assert.ok(serverConnection.ready);
  assert.ok(clientConnection.ready);
  assert.equal(serverConnection.sessionId, clientConnection.sessionId);
  assert.ok(serverConnection.features.has('lss'));
  assert.ok(clientConnection.features.has('lss'));
  assert.equal(serverConnection.peer?.clientId, clientId);
  assert.equal(clientConnection.peer?.serverId, serverId);
  assert.ok(serverConnection.expiresAt instanceof Date);
  assert.ok(clientConnection.expiresAt instanceof Date);
  assert.ok(serverConnection.expiresAt!.getTime() > Date.now());
  assert.ok(clientConnection.expiresAt!.getTime() > Date.now());
  assert.ok(
    Math.abs(serverConnection.expiresAt!.getTime() - clientConnection.expiresAt!.getTime()) < 50
  );

  const responsePromise = new Promise<{ lce: LCE; payload: Buffer }>((resolve) => {
    clientAdapter.once('frame', (lce, payload) => resolve({ lce, payload }));
  });

  clientAdapter.send(
    {
      v: 1,
      intent: { type: 'ask', goal: 'Ping' },
      policy: { consent: 'private' },
      memory: { thread: 'adapter-test', t: new Date().toISOString() },
    },
    'Hello'
  );

  const serverFrame = await serverFramePromise;
  assert.equal(serverFrame.lce.intent.type, 'ask');
  assert.equal(serverFrame.payload.toString(), 'Hello');

  const response = await responsePromise;
  assert.equal(response.lce.intent.type, 'tell');
  assert.match(response.lce.intent.goal ?? '', /Echo of:/);
  assert.equal(response.payload.toString(), 'Echo: Hello');

  clientAdapter.close(1000, 'done');
  await new Promise((resolve) => clientSocket.once('close', resolve));

});

test('LPIWebSocketAdapter rejects invalid handshake sequences', async (t) => {
  const { server, port } = await createServer();
  t.after(() =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    })
  );

  const handshakeError = new Promise<Error>((resolve) => {
    server.on('connection', (socket) => {
      const adapter = new LPIWebSocketAdapter({ role: 'server', ws: socket });
      adapter.on('error', () => {
        // prevent unhandled error events during negative handshake test
      });
      adapter.ready.catch((error) => resolve(error));
    });
  });

  const clientSocket = new WebSocket(`ws://127.0.0.1:${port}`);
  const closePromise = new Promise<number>((resolve) => {
    clientSocket.once('close', (code) => resolve(code));
  });

  await new Promise((resolve) => clientSocket.once('open', resolve));
  clientSocket.send(JSON.stringify({ step: 'bind' }));

  const error = await handshakeError;
  assert.match(error.message, /Unexpected handshake message/);

  const closeCode = await closePromise;
  assert.equal(closeCode, 1002);
});

test('LPIWebSocketAdapter rejects when the socket closes mid-handshake', async (t) => {
  const { server, port } = await createServer();
  t.after(() =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    })
  );

  server.on('connection', (socket) => {
    socket.close(1011, 'no handshake');
  });

  const clientSocket = new WebSocket(`ws://127.0.0.1:${port}`);
  const adapter = new LPIWebSocketAdapter({
    role: 'client',
    ws: clientSocket,
  });

  adapter.on('error', () => {
    // swallow error to avoid unhandled error event during test
  });

  const closePromise = new Promise<void>((resolve) => {
    clientSocket.once('close', () => resolve());
  });

  await assert.rejects(adapter.ready, (error) => {
    assert.match((error as Error).message, /Connection closed before handshake/);
    return true;
  });

  await closePromise;
});
