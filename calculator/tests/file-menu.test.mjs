// Start page and File menu (build .67): node --test calculator/tests/file-menu.test.mjs
// Files that are not data get a reason (PDF, SPSS, R, LibreOffice, binary) while text in UTF-8, Windows-1252 and
// Excel's Unicode text (UTF-16) loads; saved CSV names drop any data extension; a new dataset opens on
// Make a new variable → Blank, and Fix a variable explains what to do when there are no variables yet.
// The browser side (file dialogs, confirmations, keeping the dataset on a failed load) is tests/file-menu-e2e.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1600 };
const downloads = [];
globalThis.document = { documentElement: { style: { zoom: '' } }, createElement: () => ({ click() { downloads.push(this.download); } }) };
globalThis.URL.createObjectURL = () => 'blob:x'; globalThis.URL.revokeObjectURL = () => {};
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const txt = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(txt).join('') : (el.children || []).map(txt).join('');
const ab = x => { const b = Buffer.from(x); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const comp = () => { const c = new C(); c._E = E; c._engineP = Promise.resolve(E); c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {}; c.autoBegin = () => {}; c.afterIngest = () => {}; return c; };

test('files that are not data get a clear reason; text data passes', () => {
  const c = comp();
  assert.match(c.notDataReason('informe.pdf', null), /"informe\.pdf" is not a data file this calculator can read\. Open a CSV/);
  assert.match(c.notDataReason('encuesta.sav', null), /is an SPSS file.*File → Export → CSV/);
  assert.match(c.notDataReason('df.rds', null), /is an R file.*write\.csv/);
  assert.match(c.notDataReason('hoja.ods', null), /LibreOffice spreadsheet\. Save it as Excel/);
  assert.equal(c.notDataReason('datos.csv', null), '');
  assert.match(c.notDataReason('x.dat', ab([0x4d, 0x5a, 0, 0, 3, 0, 0, 0])), /is not a text data file/);
  assert.equal(c.notDataReason('a.csv', ab('región,ingreso\nNoreste,1200\nSur,980\n')), '', 'UTF-8 with accents');
  assert.equal(c.notDataReason('a.csv', ab([0x72, 0xe9, 0x67, 0x69, 0xf3, 0x6e, 0x0a, 0x31, 0x0a])), '', 'Windows-1252 accents');
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a\tb\r\n1\t2\r\n', 'utf16le')]);
  assert.equal(c.notDataReason('unicode.txt', ab(u16)), '', 'UTF-16 (Excel Unicode text) is text');
});

test("Excel's Unicode text (UTF-16 with a byte-order mark) loads as data", async () => {
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('región\tingreso\r\nNoreste\t1200\r\nSur\t980\r\n', 'utf16le')]);
  const raw = await E.parseCSV(ab(u16), () => {});
  assert.deepEqual(raw.names, ['región', 'ingreso']); assert.equal(raw.n, 2);
  assert.deepEqual(Array.from(raw.cols[1].a), [1200, 980]); assert.deepEqual(Array.from(raw.cols[0].a), ['Noreste', 'Sur']);
});

test('saved CSV names drop the data extension (libro.xlsx → libro.csv)', async () => {
  const c = comp(); c._raw = await E.parseCSV(ab('a,b\n1,2\n'), () => {}); c.state = { ...c.state, hiddenVars: [] };
  for (const [name, want] of [['libro.xlsx', 'libro.csv'], ['encuesta.dta', 'encuesta.csv'], ['datos.tsv', 'datos.csv'], ['my-dataset', 'my-dataset.csv'], ['notas.v2.csv', 'notas.v2.csv']]) {
    c.state.fileName = name; c.saveCsv(); assert.equal(downloads.at(-1), want, name);
  }
});

test('a new dataset opens on Make a new variable → Blank; Fix a variable explains what to do', async () => {
  const c = comp(); c.state = { ...c.state, screen: 'upload' };
  c.newDataset(); await new Promise(r => setTimeout(r, 50));
  assert.equal(c.state.screen, 'work'); assert.equal(c._raw.n, 20); assert.equal(c._raw.names.length, 0);
  const D = c.deS(); assert.equal(D.task, 'new'); assert.equal(D.recipe, 'blank');
  assert.match(txt(c.deRender()), /Blank variable.*type the values yourself/);
  c.deGo('var'); const t = txt(c.deRender());
  assert.match(t, /this dataset has no variables yet/); assert.match(t, /Make a new variable →/);
});
