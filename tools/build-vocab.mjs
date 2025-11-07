#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const VOCAB_DIR = path.join(ROOT, 'vocab');
const OUTPUT_DIR = path.join(VOCAB_DIR, 'dist');

async function readYamlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'));
  return files.map((file) => path.join(dir, file.name));
}

async function buildVocab() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const yamlFiles = await readYamlFiles(VOCAB_DIR);
  if (yamlFiles.length === 0) {
    console.warn('No vocabulary YAML files found.');
    return;
  }

  const results = await Promise.all(
    yamlFiles.map(async (filePath) => {
      const source = await fs.readFile(filePath, 'utf8');
      const data = YAML.parse(source);
      const baseName = path.basename(filePath, path.extname(filePath));
      const targetPath = path.join(OUTPUT_DIR, `${baseName}.json`);
      const json = `${JSON.stringify(data, null, 2)}\n`;
      await fs.writeFile(targetPath, json, 'utf8');
      return { filePath, targetPath };
    })
  );

  for (const { filePath, targetPath } of results) {
    console.log(`Converted ${path.relative(ROOT, filePath)} → ${path.relative(ROOT, targetPath)}`);
  }

  console.log(`Vocabulary build complete. ${results.length} file(s) written.`);
}

buildVocab().catch((error) => {
  console.error('Failed to build vocabularies:', error);
  process.exitCode = 1;
});
