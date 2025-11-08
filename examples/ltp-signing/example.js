/**
 * LTP (Liminal Trust Protocol) Example
 *
 * Demonstrates:
 * - Ed25519 key generation
 * - JCS canonicalisation
 * - Detached Ed25519 signatures
 * - Signature verification
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
  const signed = await ltp.sign(lce, keys.privateKey);
  console.log('✓ LCE signed');
  console.log('  Signature (base64url):', signed.sig.substring(0, 80) + '...');
  console.log('  Signature length:', signed.sig.length, 'characters');
  console.log('');

  // 4. Verify signature
  console.log('4. Verifying signature...');
  const valid = await ltp.verify(signed, keys.publicKey);
  console.log('✓ Signature valid:', valid);
  console.log('');

  // 5. Test tampered message
  console.log('5. Testing tampered message detection...');
  const tampered = { ...signed, intent: { type: 'ask' } };
  const tamperedValid = await ltp.verify(tampered, keys.publicKey);
  console.log('✓ Tampered message valid:', tamperedValid, '(should be false)');
  console.log('');

  // 6. Test wrong key
  console.log('6. Testing wrong key detection...');
  const wrongKeys = await ltp.generateKeys();
  const wrongKeyValid = await ltp.verify(signed, wrongKeys.publicKey);
  console.log('✓ Wrong key valid:', wrongKeyValid, '(should be false)');
  console.log('');

  // 7. JSON round-trip
  console.log('7. Testing JSON serialization round-trip...');
  const json = JSON.stringify(signed);
  const deserialized = JSON.parse(json);
  const roundTripValid = await ltp.verify(deserialized, keys.publicKey);
  console.log('✓ After JSON round-trip, valid:', roundTripValid);
  console.log('');

  // 8. Multiple signatures
  console.log('8. Testing re-signing...');
  const resigned = await ltp.sign(signed, keys.privateKey);
  const resignedValid = await ltp.verify(resigned, keys.publicKey);
  console.log('✓ Re-signed message valid:', resignedValid);
  console.log('');

  console.log('=== Summary ===');
  console.log('✓ LTP provides cryptographic proof of:');
  console.log('  - Message authenticity (from holder of private key)');
  console.log('  - Message integrity (not tampered)');
  console.log('  - Message non-repudiation (cannot deny sending)');
  console.log('');
  console.log('✓ Uses industry-standard cryptography:');
  console.log('  - Ed25519 (EdDSA) signatures');
  console.log('  - RFC 8785 JSON Canonicalization Scheme (JCS)');
  console.log('');
  console.log('✓ Integration:');
  console.log('  - HTTP: Add sig field to LCE in X-LRI-Context header');
  console.log('  - WebSocket: Signature in LHS Seal step');
  console.log('  - gRPC: Signature in metadata');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
