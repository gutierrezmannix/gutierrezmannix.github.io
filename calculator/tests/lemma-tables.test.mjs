// Lemma tables are embedded in a compact form (tools/build.py, compact_lemmas). For every language, the table the
// page decodes must equal the map the page used to build from the original spaCy JSON: lower-case word → first lemma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const ext = JSON.parse(page.match(/<script type="__bundler\/ext_resources">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));

for (const lang of ['es', 'en', 'pt', 'fr']) {
  test('lemma table ' + lang + ' decodes to the original lookup', () => {
    const id = ext.find(x => x.id === 'lemma_' + lang); assert.ok(id, 'embedded');
    const got = E.tlLemmaTable(gunzipSync(Buffer.from(manifest[id.uuid].data, 'base64')).toString('utf8'));
    const obj = JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/lemmas/' + lang + '_lemma_lookup.json.gz', import.meta.url))).toString('utf8'));
    const want = new Map(); for (const k in obj) { const v = obj[k]; want.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v); }
    assert.equal(got.size, want.size);
    let bad = 0, ex = ''; for (const [k, v] of want) if (got.get(k) !== v) { bad++; ex = ex || k + ' → ' + got.get(k) + ' (want ' + v + ')'; }
    assert.equal(bad, 0, ex);
  });
}
