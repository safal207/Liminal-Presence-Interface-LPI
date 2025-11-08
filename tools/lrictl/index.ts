#!/usr/bin/env node
/**
 * lrictl - CLI tool for LRI operations
 *
 * Commands:
 * - validate: Validate LCE JSON against schema
 * - encode: Encode LCE to CBOR
 * - decode: Decode CBOR to LCE
 * - sign: Sign LCE with Ed25519
 * - verify: Verify signed LCE
 * - size: Compare JSON vs CBOR sizes
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { LCE } from '../../packages/node-lri/src/types';
import { validateLCE } from '../../packages/node-lri/src/validator';
import {
  encodeLCE,
  decodeLCE,
  compareSizes,
} from '../../packages/node-lri/src/cbor';
import { sign, verify, generateKeys } from '../../packages/node-lri/src/ltp';
import { exportJWK, importJWK } from 'jose';

const program = new Command();

program
  .name('lrictl')
  .description('CLI tool for LRI (Liminal Resonance Interface) operations')
  .version('0.2.0');

/**
 * Validate LCE command
 */
program
  .command('validate')
  .description('Validate LCE JSON against schema')
  .argument('<file>', 'Path to LCE JSON file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (file: string, options) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lce = JSON.parse(content) as LCE;

      const result = validateLCE(lce);

      if (result.valid) {
        console.log('✓ Valid LCE');
        if (options.verbose) {
          console.log('\nLCE content:');
          console.log(JSON.stringify(lce, null, 2));
        }
      } else {
        console.error('✗ Invalid LCE');
        console.error('\nErrors:');
        result.errors?.forEach((err) => console.error(`  - ${err.message}`));
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Encode to CBOR command
 */
program
  .command('encode')
  .description('Encode LCE JSON to CBOR binary')
  .argument('<input>', 'Input LCE JSON file')
  .argument('<output>', 'Output CBOR file')
  .action(async (input: string, output: string) => {
    try {
      const content = fs.readFileSync(input, 'utf8');
      const lce = JSON.parse(content) as LCE;

      // Validate first
      const result = validateLCE(lce);
      if (!result.valid) {
        console.error('✗ Invalid LCE');
        result.errors?.forEach((err) => console.error(`  - ${err.message}`));
        process.exit(1);
      }

      // Encode
      const encoded = encodeLCE(lce);
      fs.writeFileSync(output, encoded);

      console.log('✓ Encoded to CBOR');
      console.log(`  Input:  ${Buffer.byteLength(content, 'utf8')} bytes (JSON)`);
      console.log(`  Output: ${encoded.length} bytes (CBOR)`);
      console.log(`  Saved:  ${output}`);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Decode from CBOR command
 */
program
  .command('decode')
  .description('Decode CBOR binary to LCE JSON')
  .argument('<input>', 'Input CBOR file')
  .argument('[output]', 'Output JSON file (optional, prints to stdout if not provided)')
  .action(async (input: string, output?: string) => {
    try {
      const buffer = fs.readFileSync(input);
      const lce = decodeLCE(buffer);

      const json = JSON.stringify(lce, null, 2);

      if (output) {
        fs.writeFileSync(output, json);
        console.log('✓ Decoded from CBOR');
        console.log(`  Input:  ${buffer.length} bytes (CBOR)`);
        console.log(`  Output: ${Buffer.byteLength(json, 'utf8')} bytes (JSON)`);
        console.log(`  Saved:  ${output}`);
      } else {
        console.log(json);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Size comparison command
 */
program
  .command('size')
  .description('Compare JSON vs CBOR sizes')
  .argument('<file>', 'Path to LCE JSON file')
  .action(async (file: string) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lce = JSON.parse(content) as LCE;

      const comparison = compareSizes(lce);

      console.log('Size comparison:');
      console.log(`  JSON: ${comparison.json} bytes`);
      console.log(`  CBOR: ${comparison.cbor} bytes`);
      console.log(`  Savings: ${comparison.savings} bytes (${comparison.savingsPercent}%)`);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Generate keys command
 */
program
  .command('keygen')
  .description('Generate Ed25519 key pair for LTP signing')
  .argument('[output]', 'Output directory (default: current directory)')
  .action(async (outputDir: string = '.') => {
    try {
      const keys = await generateKeys();

      const privateKeyPath = path.join(outputDir, 'lri-private.key');
      const publicKeyPath = path.join(outputDir, 'lri-public.key');

      // Export keys as JWK (JSON Web Key)
      const privateKeyJWK = await exportJWK(keys.privateKey);
      const publicKeyJWK = keys.publicKeyJWK;

      fs.writeFileSync(privateKeyPath, JSON.stringify(privateKeyJWK, null, 2), 'utf8');
      fs.writeFileSync(publicKeyPath, JSON.stringify(publicKeyJWK, null, 2), 'utf8');

      console.log('✓ Generated Ed25519 key pair');
      console.log(`  Private key: ${privateKeyPath}`);
      console.log(`  Public key:  ${publicKeyPath}`);
      console.log('\n⚠️  Keep your private key secure!');
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Sign LCE command
 */
program
  .command('sign')
  .description('Sign LCE with Ed25519 private key')
  .argument('<lce-file>', 'Path to LCE JSON file')
  .argument('<private-key>', 'Path to private key file')
  .argument('[output]', 'Output file (optional, prints to stdout if not provided)')
  .action(async (lceFile: string, privateKeyFile: string, output?: string) => {
    try {
      const lceContent = fs.readFileSync(lceFile, 'utf8');
      const lce = JSON.parse(lceContent) as LCE;

      // Load private key JWK and import it
      const privateKeyJWK = JSON.parse(fs.readFileSync(privateKeyFile, 'utf8'));
      const privateKey = await importJWK(privateKeyJWK, 'EdDSA');

      const signed = await sign(lce, privateKey);
      const json = JSON.stringify(signed, null, 2);

      if (output) {
        fs.writeFileSync(output, json);
        console.log('✓ Signed LCE');
        console.log(`  Signature: ${(signed as any).sig?.slice(0, 50)}...`);
        console.log(`  Saved:     ${output}`);
      } else {
        console.log(json);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Verify signed LCE command
 */
program
  .command('verify')
  .description('Verify signed LCE with Ed25519 public key')
  .argument('<signed-lce>', 'Path to signed LCE JSON file')
  .argument('<public-key>', 'Path to public key file')
  .action(async (signedLceFile: string, publicKeyFile: string) => {
    try {
      const lceContent = fs.readFileSync(signedLceFile, 'utf8');
      const lce = JSON.parse(lceContent) as LCE;

      // Load public key JWK and import it
      const publicKeyJWK = JSON.parse(fs.readFileSync(publicKeyFile, 'utf8'));
      const publicKey = await importJWK(publicKeyJWK, 'EdDSA');

      const valid = await verify(lce, publicKey);

      if (valid) {
        console.log('✓ Valid signature');
        console.log('  The LCE is authentic and has not been tampered with.');
      } else {
        console.error('✗ Invalid signature');
        console.error('  The LCE may have been tampered with or signed with a different key.');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Create example LCE command
 */
program
  .command('example')
  .description('Generate example LCE JSON file')
  .argument('[output]', 'Output file (default: example-lce.json)')
  .option('-t, --type <type>', 'Intent type (ask|tell|propose|etc.)', 'ask')
  .action(async (output: string = 'example-lce.json', options) => {
    try {
      const lce: LCE = {
        v: 1,
        intent: {
          type: options.type,
          goal: 'Example LCE message',
        },
        affect: {
          pad: [0.5, 0.3, 0.2],
          tags: ['curious', 'friendly'],
        },
        meaning: {
          topic: 'example',
        },
        memory: {
          thread: '550e8400-e29b-41d4-a716-446655440000',
          t: new Date().toISOString(),
        },
        policy: {
          consent: 'private',
        },
        qos: {
          coherence: 1.0,
        },
      };

      const json = JSON.stringify(lce, null, 2);
      fs.writeFileSync(output, json);

      console.log('✓ Generated example LCE');
      console.log(`  Intent: ${lce.intent.type}`);
      console.log(`  File:   ${output}`);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
