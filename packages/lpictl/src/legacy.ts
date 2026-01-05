#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

console.warn('⚠️  "lrictl" has been renamed to "lpictl". Please update your scripts.');

const cliPath = resolve(__dirname, 'cli.js');
const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
