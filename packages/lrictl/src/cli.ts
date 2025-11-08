#!/usr/bin/env node
/**
 * lrictl - CLI Tool for Liminal Resonance Interface
 *
 * The Vajra Path - Direct tool for working with LCE
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { validate, validateFile } from './validator';
import { formatLCE, LCE } from './formatter';
import { encodeObject, decodeToObject, isValidBase64 } from './encoder';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('lrictl')
  .description('🗝️  CLI tool for Liminal Resonance Interface (LRI)')
  .version('0.1.0');

/**
 * Command: validate
 * Validates LCE against schema
 */
program
  .command('validate <file>')
  .description('Validate LCE file against schema')
  .option('-v, --verbose', 'Show detailed error information')
  .action((file: string, options: { verbose?: boolean }) => {
    console.log(chalk.cyan('\n🔍 Validating LCE...\n'));

    const result = validateFile(file);

    if (result.valid) {
      console.log(chalk.green('✓ Valid LCE'));
      console.log(chalk.gray('  Schema: LCE v0.1'));
      console.log(chalk.gray(`  File: ${file}`));
      console.log();
      process.exit(0);
    } else {
      console.log(chalk.red('✗ Invalid LCE'));
      console.log();

      if (result.errors && result.errors.length > 0) {
        console.log(chalk.yellow(`Found ${result.errors.length} error(s):\n`));

        result.errors.forEach((err, i) => {
          console.log(chalk.red(`  ${i + 1}. ${err.path}`));
          console.log(chalk.gray(`     ${err.message}`));

          if (options.verbose && err.keyword) {
            console.log(chalk.gray(`     keyword: ${err.keyword}`));
            if (err.params) {
              console.log(chalk.gray(`     params: ${JSON.stringify(err.params)}`));
            }
          }
          console.log();
        });
      }

      process.exit(1);
    }
  });

/**
 * Command: inspect
 * Display LCE in beautiful format
 */
program
  .command('inspect <file>')
  .description('Display LCE in beautiful format')
  .option('--no-color', 'Disable colors')
  .action((file: string, options: { color?: boolean }) => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lce = JSON.parse(content) as LCE;

      console.log();
      console.log(formatLCE(lce, { colors: options.color }));
      console.log();

      // Also validate
      const validation = validate(lce);
      if (!validation.valid) {
        console.log(chalk.yellow('⚠️  Warning: LCE has validation errors'));
        console.log(chalk.gray('   Run `lrictl validate` for details'));
        console.log();
      }
    } catch (err) {
      console.error(chalk.red('Error reading file:'));
      console.error(chalk.gray(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

/**
 * Command: encode
 * Encode JSON to Base64
 */
program
  .command('encode <file>')
  .description('Encode LCE JSON to Base64')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .action((file: string, options: { output?: string }) => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(content);

      // Validate first
      const validation = validate(data);
      if (!validation.valid) {
        console.error(chalk.yellow('⚠️  Warning: LCE has validation errors'));
        if (validation.errors) {
          validation.errors.forEach((err) => {
            console.error(chalk.gray(`   ${err.path}: ${err.message}`));
          });
        }
        console.error();
      }

      const encoded = encodeObject(data);

      if (options.output) {
        fs.writeFileSync(options.output, encoded);
        console.log(chalk.green(`✓ Encoded to ${options.output}`));
      } else {
        console.log(encoded);
      }
    } catch (err) {
      console.error(chalk.red('Error encoding file:'));
      console.error(chalk.gray(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

/**
 * Command: decode
 * Decode Base64 to JSON
 */
program
  .command('decode <input>')
  .description('Decode Base64 to LCE JSON')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .option('-p, --pretty', 'Pretty-print JSON')
  .action((input: string, options: { output?: string; pretty?: boolean }) => {
    try {
      let base64: string;

      // Check if input is a file or base64 string
      if (fs.existsSync(input)) {
        base64 = fs.readFileSync(input, 'utf-8').trim();
      } else {
        base64 = input;
      }

      if (!isValidBase64(base64)) {
        console.error(chalk.red('Error: Invalid Base64 string'));
        process.exit(1);
      }

      const decoded = decodeToObject(base64);
      const json = options.pretty
        ? JSON.stringify(decoded, null, 2)
        : JSON.stringify(decoded);

      if (options.output) {
        fs.writeFileSync(options.output, json);
        console.log(chalk.green(`✓ Decoded to ${options.output}`));
      } else {
        console.log(json);
      }

      // Validate decoded LCE
      const validation = validate(decoded);
      if (!validation.valid && options.output) {
        console.error(chalk.yellow('\n⚠️  Warning: Decoded LCE has validation errors'));
      }
    } catch (err) {
      console.error(chalk.red('Error decoding:'));
      console.error(chalk.gray(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

/**
 * Command: create
 * Interactive LCE creation
 */
program
  .command('create')
  .description('Create a new LCE interactively')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options: { output?: string }) => {
    console.log(chalk.cyan('\n🗝️  Creating new LCE...\n'));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'intent',
          message: 'What is the intent?',
          choices: [
            { name: '🙏 ask - Request information', value: 'ask' },
            { name: '💬 tell - Provide information', value: 'tell' },
            { name: '💡 propose - Suggest action', value: 'propose' },
            { name: '✓  confirm - Acknowledge', value: 'confirm' },
            { name: '🔔 notify - Alert', value: 'notify' },
            { name: '🔄 sync - Establish context', value: 'sync' },
            { name: '📋 plan - Outline strategy', value: 'plan' },
            { name: '👍 agree - Agree to proposal', value: 'agree' },
            { name: '👎 disagree - Disagree with proposal', value: 'disagree' },
            { name: '🤔 reflect - Introspection', value: 'reflect' },
          ],
        },
        {
          type: 'input',
          name: 'goal',
          message: 'Goal (optional):',
        },
        {
          type: 'list',
          name: 'consent',
          message: 'Consent level:',
          choices: [
            { name: '🔒 private - Private data', value: 'private' },
            { name: '👥 team - Share with team', value: 'team' },
            { name: '🌍 public - Public data', value: 'public' },
          ],
        },
        {
          type: 'confirm',
          name: 'addAffect',
          message: 'Add emotional affect?',
          default: false,
        },
      ]);

      const lce: LCE = {
        v: 1,
        intent: {
          type: answers.intent,
          ...(answers.goal && { goal: answers.goal }),
        },
        policy: {
          consent: answers.consent,
        },
      };

      // Add affect if requested
      if (answers.addAffect) {
        const affectAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'tags',
            message: 'Affect tags (comma-separated):',
          },
        ]);

        if (affectAnswers.tags) {
          lce.affect = {
            tags: affectAnswers.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
          };
        }
      }

      const json = JSON.stringify(lce, null, 2);

      if (options.output) {
        fs.writeFileSync(options.output, json);
        console.log(chalk.green(`\n✓ Created LCE: ${options.output}\n`));
      } else {
        console.log(chalk.gray('\n─────────────────────────────────'));
        console.log(json);
        console.log(chalk.gray('─────────────────────────────────\n'));
      }

      // Show formatted version
      console.log(formatLCE(lce));

    } catch (err) {
      if (err instanceof Error && err.message.includes('User force closed')) {
        console.log(chalk.yellow('\nCancelled.'));
        process.exit(0);
      }
      throw err;
    }
  });

// Parse arguments
program.parse();
