/**
 * LTP (Liminal Trust Protocol) Example
 *
 * Demonstrates:
 * - Ed25519 key generation
 * - LCE signing with JWS
 * - Signature verification
 * - Signature inspection
 */

const { ltp } = require('node-lri');

async function main() {
  console.log('=== LTP (Liminal Trust Protocol) Example ===\n');

  // 1. Generate Ed25519 keys
  console.log('1. Generating Ed25519 key pair...');
  const keys = await ltp.generateKeys();
  console.log('✓ Keys generated');
  console.log('  Public key (JWK):');
  console.log('  ', JSON.stringify(keys.publicKeyJWK, null, 2).replace(/\n/g, '\n   '));
  console.log('');

  // 2. Create LCE message
  console.log('2. Creating LCE message...');
  const lce = {
    v: 1,
    intent: {
      type: 'tell',
      goal: 'Demonstrate LTP signatures',
    },
    affect: {
      pad: [0.7, 0.5, 0.3],
      tags: ['confident', 'clear'],
    },
    memory: {
      thread: 'demo-thread-123',
      t: new Date().toISOString(),
    },
    policy: {
      consent: 'public',
    },
  };
  console.log('✓ LCE created:');
  console.log('  ', JSON.stringify(lce, null, 2).replace(/\n/g, '\n   '));
  console.log('');

  // 3. Sign LCE
  console.log('3. Signing LCE with Ed25519...');
  const signed = await ltp.sign(lce, keys.privateKey, {
    iss: 'demo-issuer',
    sub: 'ltp-example',
  });
  console.log('✓ LCE signed');
  console.log('  Signature:', signed.sig.substring(0, 80) + '...');
  console.log('  Signature length:', signed.sig.length, 'characters');
  console.log('');

  // 4. Inspect signature
  console.log('4. Inspecting signature...');
  const info = ltp.inspectSignature(signed.sig);
  if (info) {
    console.log('✓ Signature structure:');
    console.log('  Header:');
    console.log('    alg:', info.header.alg);
    console.log('    typ:', info.header.typ);
    console.log('  Payload:');
    console.log('    iss:', info.payload.iss);
    console.log('    sub:', info.payload.sub);
    console.log('    iat:', new Date(info.payload.iat * 1000).toISOString());
  }
  console.log('');

  // 5. Verify signature
  console.log('5. Verifying signature...');
  const valid = await ltp.verify(signed, keys.publicKey, {
    issuer: 'demo-issuer',
  });
  console.log('✓ Signature valid:', valid);
  console.log('');

  // 6. Test tampered message
  console.log('6. Testing tampered message detection...');
  const tampered = { ...signed, intent: { type: 'ask' } };
  const tamperedValid = await ltp.verify(tampered, keys.publicKey);
  console.log('✓ Tampered message valid:', tamperedValid, '(should be false)');
  console.log('');

  // 7. Test wrong key
  console.log('7. Testing wrong key detection...');
  const wrongKeys = await ltp.generateKeys();
  const wrongKeyValid = await ltp.verify(signed, wrongKeys.publicKey);
  console.log('✓ Wrong key valid:', wrongKeyValid, '(should be false)');
  console.log('');

  // 8. Round-trip with JSON serialization
  console.log('8. Testing JSON serialization round-trip...');
  const json = JSON.stringify(signed);
  const deserialized = JSON.parse(json);
  const roundTripValid = await ltp.verify(deserialized, keys.publicKey);
  console.log('✓ After JSON round-trip, valid:', roundTripValid);
  console.log('');

  // 9. Multiple signatures
  console.log('9. Testing re-signing...');
  const resigned = await ltp.sign(signed, keys.privateKey);
  const resignedValid = await ltp.verify(resigned, keys.publicKey);
  console.log('✓ Re-signed message valid:', resignedValid);
  console.log('');

  console.log('=== Summary ===');
  console.log('✓ LTP provides cryptographic proof of:');
  console.log('  - Message authenticity (from holder of private key)');
  console.log('  - Message integrity (not tampered)');
  console.log('  - Message non-repudiation (can\'t deny sending)');
  console.log('');
  console.log('✓ Uses industry-standard cryptography:');
  console.log('  - Ed25519 (EdDSA) signatures');
  console.log('  - JWS (JSON Web Signature, RFC 7515)');
  console.log('  - JCS (JSON Canonicalization Scheme, RFC 8785)');
  console.log('');
  console.log('✓ Integration:');
  console.log('  - HTTP: Add sig field to LCE in X-LRI-Context header');
  console.log('  - WebSocket: Signature in LHS Seal step');
  console.log('  - gRPC: Signature in metadata');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
