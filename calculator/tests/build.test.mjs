// index.html is a build output. tools/build.py must reproduce it, and the readable sources in src/app/, exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('index.html and src/app are up to date with the sources', t => {
  const r = spawnSync('python3', [fileURLToPath(new URL('../tools/build.py', import.meta.url)), '--check'], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (r.error && r.error.code === 'ENOENT') return t.skip('python3 is not installed');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
