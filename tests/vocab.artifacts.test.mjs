import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function loadYaml(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = await readFile(absolutePath, 'utf8');
  return YAML.parse(source);
}

async function loadJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = await readFile(absolutePath, 'utf8');
  return JSON.parse(source);
}

async function expectYamlAndJsonToMatch(stem) {
  const yaml = await loadYaml(`vocab/${stem}.yaml`);
  const json = await loadJson(`vocab/dist/${stem}.json`);
  assert.deepStrictEqual(json, yaml, `${stem} vocabulary JSON should mirror YAML source`);
}

test('intent vocabulary artifact mirrors YAML source', async () => {
  await expectYamlAndJsonToMatch('intent');
});

test('affect vocabulary artifact mirrors YAML source', async () => {
  await expectYamlAndJsonToMatch('affect');
});
