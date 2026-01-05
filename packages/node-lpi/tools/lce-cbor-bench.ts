import { performance } from 'perf_hooks';
import nacl from 'tweetnacl';
import canonicalize from 'canonicalize';

import {
  base64UrlDecode,
  base64UrlEncode,
  createCoseSign1,
  verifyCoseSign1,
} from '../src/cbor/lce-cose';
import { LCE } from '../src/types';

const fixture: {
  seed: string;
  lce: LCE;
} = require('../../../tests/fixtures/lce-cose-vector.json');

function buildJWS(lce: LCE, secretKey: Uint8Array): string {
  const canonical = canonicalize(lce);
  if (!canonical) {
    throw new Error('Failed to canonicalize LCE');
  }

  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'bench' })));
  const payload = base64UrlEncode(Buffer.from(canonical));
  const signingInput = Buffer.from(`${header}.${payload}`);
  const signature = base64UrlEncode(
    Buffer.from(nacl.sign.detached(new Uint8Array(signingInput), secretKey)),
  );

  return `${header}.${payload}.${signature}`;
}

function runBenchmarks(iterations: number) {
  const seed = Buffer.from(fixture.seed, 'hex');
  const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  const lce: LCE = fixture.lce;

  // Precompute sanitized input (without sig)
  const baselineJws = buildJWS(lce, keyPair.secretKey);
  const { cose } = createCoseSign1(lce, keyPair.secretKey);

  const jsonSize = Buffer.byteLength(baselineJws, 'utf8');
  const cborSize = cose.length;

  const encodeJsonStart = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    buildJWS(lce, keyPair.secretKey);
  }
  const encodeJsonTime = (performance.now() - encodeJsonStart) / iterations;

  const encodeCborStart = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    createCoseSign1(lce, keyPair.secretKey);
  }
  const encodeCborTime = (performance.now() - encodeCborStart) / iterations;

  const verifyJsonStart = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const [header, payload, signature] = baselineJws.split('.');
    const signingInput = Buffer.from(`${header}.${payload}`);
    nacl.sign.detached.verify(
      new Uint8Array(signingInput),
      new Uint8Array(base64UrlDecode(signature)),
      keyPair.publicKey,
    );
  }
  const verifyJsonTime = (performance.now() - verifyJsonStart) / iterations;

  const verifyCborStart = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    verifyCoseSign1(cose, keyPair.publicKey);
  }
  const verifyCborTime = (performance.now() - verifyCborStart) / iterations;

  return {
    iterations,
    jsonSize,
    cborSize,
    sizeSavingsBytes: jsonSize - cborSize,
    sizeSavingsPercent: ((jsonSize - cborSize) / jsonSize) * 100,
    encodeJsonTime,
    encodeCborTime,
    verifyJsonTime,
    verifyCborTime,
  };
}

function formatMs(value: number): string {
  return `${(value * 1000).toFixed(2)} µs`;
}

function main() {
  const iterations = Number(process.env.BENCH_ITERATIONS ?? '5000');
  const results = runBenchmarks(iterations);

  console.log('LCE CBOR/COSE microbenchmarks');
  console.log(`Iterations: ${results.iterations}`);
  console.log(`JSON+JWS size: ${results.jsonSize} bytes`);
  console.log(`CBOR+COSE size: ${results.cborSize} bytes`);
  console.log(
    `Size savings: ${results.sizeSavingsBytes} bytes (${results.sizeSavingsPercent.toFixed(2)}%)`,
  );
  console.log(`JSON+JWS encode: ${formatMs(results.encodeJsonTime)}`);
  console.log(`CBOR+COSE encode: ${formatMs(results.encodeCborTime)}`);
  console.log(`JSON+JWS verify: ${formatMs(results.verifyJsonTime)}`);
  console.log(`CBOR+COSE verify: ${formatMs(results.verifyCborTime)}`);
}

main();
