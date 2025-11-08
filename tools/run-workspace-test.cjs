#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const [, , workspace] = process.argv;

if (!workspace) {
  console.error('Usage: npm run test:workspace -- <workspace>');
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'test', '--workspace', workspace], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
