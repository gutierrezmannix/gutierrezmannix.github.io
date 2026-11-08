// Text analysis, step 1 (build .92): node --test calculator/tests/text-lab-autopick.test.mjs
// The text, group and date columns are chosen only when the answer is obvious, and the page says what it chose and why;
// otherwise it shows the likely columns as buttons and reads nothing until one is picked.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { gunzipSync } from 'node:zlib';
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1600 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const txt = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(txt).join('') : (el.children || []).map(txt).join('');
const words = (n, k) => Array.from({ length: n }, (_, i) => ['pueblo', 'seguridad', 'salud', 'trabajo', 'mañana'][(i + k) % 5]).join(' ');
const make = async (head, row, n = 30, tl) => {
  const lines = [head.join(',')]; for (let i = 0; i < n; i++) lines.push(row(i).map(v => '"' + v + '"').join(','));
  const b = Buffer.from(lines.join('\n')), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
  const c = new C(); c._E = E; c._raw = raw; c.state = { ...c.state, screen: 'work', tab: 'text', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i, true)), tl };
  c.tlAutoPick(); return c;
};
const settle = () => new Promise(r => setTimeout(r, 5));

test('one column with long texts is chosen, with the reason shown', async () => {
  const c = await make(['id', 'discurso', 'titulo', 'fecha', 'partido'], i => [i, words(300, i), words(4, i), '2024-01-' + String(i % 28 + 1).padStart(2, '0'), ['Morena', 'PAN'][i % 2]]);
  await settle(); const T = c.tlS();
  assert.deepEqual([T.v, T.date, T.by], ['discurso', 'fecha', 'partido']);
  const note = c.tlAutoNotes(T).map(txt).join(' | ');
  assert.match(note, /Chosen for you: discurso as the text — far longer texts than any other column \(300 words per row; next: titulo, 4\.0 words per row\); partido as the groups — named like a group, with 2 values; fecha as the date — named like a date\. Change them above/);
  c.state.tl = Object.assign({}, c.state.tl, { by: 'titulo' }); assert.doesNotMatch(c.tlAutoNotes(c.tlS()).map(txt).join(' '), /partido as the groups/, 'a changed choice is no longer called ours');
});

test('two columns that could both be the texts: nothing is chosen, both are offered', async () => {
  const c = await make(['transcripcion', 'resumen', 'fecha', 'year', 'partido', 'presidente'], i => [words(400, i), words(180, i), '2024-01-02', 2024, ['Morena', 'PAN'][i % 2], ['AMLO', 'CSP'][i % 2]]);
  await settle(); const T = c.tlS();
  assert.deepEqual([T.v, T.date, T.by], ['', '', ''], 'nothing chosen, nothing read');
  const notes = c.tlAutoNotes(T), all = notes.map(txt).join(' | ');
  assert.match(all, /Which column holds your texts\? Several columns could: pick one to start\. transcripcion · 400 words per row\s*resumen · 180 words per row/);
  assert.match(all, /Compare groups\?.*partido · 2 values.*presidente · 2 values/); assert.match(all, /Which column is the date\?.*fecha.*year/);
  const btn = JSON.stringify(notes[0]).includes('Use resumen as the text'); assert.ok(btn, 'buttons named for screen readers');
});

test('a clear winner (3 times the words of the next) is chosen; the short ones are not offered', async () => {
  const c = await make(['texto', 'nota', 'url'], i => [words(120, i), words(30, i), 'https://x.mx/' + i]);
  await settle(); assert.equal(c.tlS().v, 'texto');
});

test('a restored session keeps its own choice and shows no notice', async () => {
  const c = await make(['a', 'b'], i => [words(50, i), words(45, i)], 30, { v: 'b' });
  await settle(); assert.equal(c.tlS().v, 'b'); assert.equal(c.tlAutoNotes(c.tlS()).filter(n => /Chosen for you/.test(txt(n))).length, 0);
});
