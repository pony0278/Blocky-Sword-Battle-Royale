import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('generated Action Studio entry is a classic script compatible with file URLs', async () => {
  const html = await readFile(new URL('../tools/action-studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="\.\/action-studio\.bundle\.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+type=["']module["']/i);
  assert.doesNotMatch(html, /src=["']\.\/action-studio\.js["']/i);
});

test('standalone bundle contains no browser ESM syntax', async () => {
  const bundle = await readFile(new URL('../tools/action-studio/action-studio.bundle.js', import.meta.url), 'utf8');
  assert.match(bundle, /Classic-script output intentionally supports direct file:\/\/ opening/);
  assert.match(bundle, /window\.__actionStudio\s*=/);
  assert.doesNotMatch(bundle, /^\s*import\s/m);
  assert.doesNotMatch(bundle, /^\s*export\s/m);
});

test('legacy compatibility entry redirects to an explicit HTML file', async () => {
  const html = await readFile(new URL('../tools/punch-studio.html', import.meta.url), 'utf8');
  assert.match(html, /\.\/action-studio\/index\.html/);
  assert.doesNotMatch(html, /\.\/action-studio\/["']/);
});

