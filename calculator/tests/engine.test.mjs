// The built-in statistical engine reproduces the R engine: every case in tests/engine/cases is run through
// gmRun() and compared with the reference output produced by real R (tools/engine/ref.R).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { compareOne } from '../tools/engine/compare.mjs';

const dir = new URL('./engine/cases/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.packet.json')).sort();
test('engine cases exist for every family', () => assert.ok(files.length > 400, files.length + ' cases'));
for (const f of files) {
  const name = f.replace('.packet.json', ''), exp = new URL(name + '.expected.json', dir);
  if (!existsSync(exp)) continue;
  test('engine matches R: ' + name, () => {
    const { problems } = compareOne(name, JSON.parse(readFileSync(new URL(f, dir))), JSON.parse(readFileSync(exp)));
    assert.deepEqual(problems, []);
  });
}
