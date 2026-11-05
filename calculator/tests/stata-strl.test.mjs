// Stata files with long text (strL) and dates: node --test calculator/tests/stata-strl.test.mjs
// The test files were written by R haven 2.5 (Stata 13 / 14 / 15+ = releases 117 / 118 / 119) from known values.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const read = async f => { const b = fs.readFileSync(new URL('data/' + f, import.meta.url)); return E.parseDTA(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}); };
const long = i => Array(70 + i).fill('Buenos días, la economía — mañanera ' + i + '. ').join('');

for (const v of [13, 14, 15]) test('Stata ' + v + ': long text (strL) is read in full, with accents; dates are dates', async () => {
  const d = await read('stata-strl-v' + v + '.dta'), col = n => Array.from(d.cols[d.names.indexOf(n)].a);
  assert.deepEqual(d.names, ['id', 'text', 'short', 'day', 'when', 'mon']);
  assert.deepEqual(col('text'), [long(1), long(2), '', long(4)], 'every strL text complete (2,769–2,886 characters), the empty one empty');
  assert.deepEqual(col('short'), ['a', 'ñ', 'c', 'd']);
  assert.deepEqual(col('day'), ['2018-12-04', '2024-10-01', '', '1958-03-07'], '%td');
  assert.deepEqual(col('when'), ['2019-01-02 07:30:00', '2024-10-01', '', '2025-08-22 23:59:59'], '%tc');
  assert.deepEqual(col('mon'), ['2019-01', '2024-11', '', '1960-01'], '%tm');
  assert.deepEqual(col('id'), [1, 2, 3, 4]);
});
