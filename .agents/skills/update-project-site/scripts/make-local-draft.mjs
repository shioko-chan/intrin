#!/usr/bin/env node
import { cp, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.length !== 2) {
  console.error('Usage: node .agents/skills/update-project-site/scripts/make-local-draft.mjs');
  process.exit(2);
}

const source = fileURLToPath(new URL('../../../../', import.meta.url));
const required = [
  'package.json',
  'content/en/site.json',
  'content/en/projects.json',
  'content/en/updates.json',
  'scripts/build.mjs',
  'scripts/check.mjs',
  'scripts/serve.mjs',
  'public',
];
for (const item of required) await stat(path.join(source, item));

const draft = await mkdtemp(path.join(tmpdir(), 'intrin-site-draft-'));
try {
  await mkdir(path.join(draft, 'scripts'));
  await mkdir(path.join(draft, 'content', 'en'), { recursive: true });
  for (const item of required) {
    const target = path.join(draft, item);
    await cp(path.join(source, item), target, { recursive: true });
  }
  console.log(draft);
} catch (error) {
  await rm(draft, { recursive: true, force: true });
  throw error;
}
