// Text analysis tab (Design A) on the shipped bundle: node --test calculator/tests/text-lab-component.test.mjs
// Renders every step and sub-tab with a stubbed React, saves variables and checks their totals,
// and checks that the same data loads identically from CSV and from Excel (.xlsx).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const engine = zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64'));
const E = await import('data:text/javascript;base64,' + engine.toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 };
globalThis.document = { documentElement: { style: { zoom: '' } } };
const Component = new Function('DCLogic', code + ';return Component')(Base);

// a small Spanish corpus with accents, hashtags, links, inclusive spellings, two authors and dates
let seed = 11; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const A = ['La economía crece y la inversión llega', 'Más empleo y salario digno para tod@s', 'La economia mexicana es fuerte', 'Inversión pública en el Tren Maya', 'Gracias a la Ciudad de México #CDMX'];
const B = ['La corrupción del régimen anterior', 'Combatimos la corrupcion y los privilegios', 'Seguridad y paz con la Guardia Nacional', 'Conferencia matutina en Palacio Nacional', 'La mafia del poder y la corrupción https://t.co/abc123'];
const rows = [['texto', 'autor', 'fecha', 'likes']];
for (let i = 0; i < 240; i++) {
  const amlo = i % 3 === 0, src = amlo ? B : A, t = [src[Math.floor(rnd() * 5)], src[Math.floor(rnd() * 5)]].join('. ');
  rows.push([i === 7 ? '' : t, amlo ? 'Andrés Manuel' : 'Claudia Sheinbaum', (10 + (i % 18)) + '.0' + (1 + (i % 9)) + '.2' + (1 + (i % 4)), String(Math.floor(rnd() * 500))]);
}
const csvText = rows.map(r => r.map(x => /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x).join(',')).join('\n');
const buf = s => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

// minimal .xlsx writer (DEFLATE entries, shared strings) for the same rows
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = d => { let c = 0xFFFFFFFF; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function xlsx(table) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), sst = [], idx = new Map();
  const si = s => { if (!idx.has(s)) { idx.set(s, sst.length); sst.push(s); } return idx.get(s); };
  const col = c => String.fromCharCode(65 + c);
  const sheet = table.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => v === '' ? '' : /^\d+$/.test(v) && ri > 0 ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`).join('') + '</row>').join('');
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet ${NS}><sheetData>${sheet}</sheetData></worksheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst ${NS}>` + sst.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('') + '</sst>'
  };
  const parts = [], cd = []; let off = 0;
  const u16 = v => Buffer.from([v & 255, (v >> 8) & 255]), u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text), body = zlib.deflateRawSync(data), nm = Buffer.from(name), c = crc(data);
    const lh = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0), u32(c), u32(body.length), u32(data.length), u16(nm.length), u16(0), nm]);
    cd.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0), u32(c), u32(body.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nm]));
    parts.push(lh, body); off += lh.length + body.length;
  }
  const cdb = Buffer.concat(cd), b = Buffer.concat([...parts, cdb, u32(0x06054b50), u16(0), u16(0), u16(cd.length), u16(cd.length), u32(cdb.length), u32(off), u16(0)]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

async function make(raw) {
  const c = new Component(); c._E = E; c._raw = raw; c._engineP = Promise.resolve(E); c._svgs = {};
  c.state = { ...c.state, screen: 'work', tab: 'text', fileName: 'tuits.csv', cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, autoScreen: false, genTags: {}, treat: {} };
  c.pushLog = d => c.setState(s => ({ conLog: [...(s.conLog || []), d] }));
  c.flash = t => { c.message = t; };
  return c;
}
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
const find = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => find(x, pred, out)); return out; } if (pred(n)) out.push(n); find(n.children, pred, out); return out; };
const tick = () => new Promise(r => setTimeout(r, 0));

test('CSV and Excel give the same dataset', async () => {
  const a = await E.parseCSV(buf(csvText), () => {}), b = await E.parseXLSX(xlsx(rows), () => {});
  assert.deepEqual(b.names, a.names);
  assert.equal(b.n, a.n);
  a.cols.forEach((col, i) => assert.deepEqual(Array.from(b.cols[i].a), Array.from(col.a), 'column ' + a.names[i]));
});

test('every step and sub-tab renders; dictionary, topics, clusters and saving work', async () => {
  for (const [label, raw] of [['csv', await E.parseCSV(buf(csvText), () => {})], ['xlsx', await E.parseXLSX(xlsx(rows), () => {})]]) {
    const c = await make(raw);
    c.state.tl = { v: 'texto', by: 'autor', date: 'fecha' };
    let tree = c.tlRender(); await tick(); tree = c.tlRender();
    assert.match(text(tree), /Spanish detected/, label + ': language detected');
    assert.match(text(tree), /239/, label + ': 239 texts (one blank)');
    for (const step of ['clean', 'explore', 'measure', 'save']) { c.state.tl = { ...c.state.tl, step }; assert.ok(c.tlRender(), step); }
    for (const sub of ['words', 'phrases', 'compare', 'context', 'time', 'connections', 'clusters', 'stats']) {
      c.state.tl = { ...c.state.tl, step: 'explore', sub, q: 'corrup*' };
      c.tlRender(); await tick(); const t = text(c.tlRender());
      assert.ok(t.length > 50, label + ' ' + sub);
      if (sub === 'context') assert.match(t, /corrupcion/, 'accent-insensitive search finds the unaccented spelling');
      if (sub === 'compare') assert.match(t, /What this means/);
      if (sub === 'clusters') assert.match(t, /cophenetic/);
    }
    // dictionary with accents, wildcards, a phrase and an exclusion
    c.state.tl = { ...c.state.tl, step: 'measure', msub: 'dict', dict: [{ name: 'economía', keys: 'econom*, inversion*, empleo*', off: [] }, { name: 'corrupción', keys: 'corrup*', off: [] }, { name: 'seguridad', keys: 'seguridad, "guardia nacional", -paz', off: [] }] };
    const dt = text(c.tlRender());
    assert.match(dt, /Exact accents/);
    for (const m of ['sentiment', 'topics', 'classify', 'scale']) { c.state.tl = { ...c.state.tl, msub: m }; assert.ok(c.tlRender(), m); }
    // fit a small topic model (runs synchronously when no Worker exists)
    c.state.tl = { ...c.state.tl, msub: 'topics', top: { k: 3, iter: 60, min: 2, maxPct: 90 } };
    const run = find(c.tlRender(), n => n.tag === 'button' && text(n) === 'Run')[0];
    assert.ok(run, 'Run button'); run.props.onClick(); for (let i = 0; i < 5; i++) await tick();
    assert.match(text(c.tlRender()), /Topics found/);
    // save: counts, 1/0, per 100 words, word count and main topic
    c.state.tl = { ...c.state.tl, step: 'save', save: { count: true, any: true, p100: true, nwords: true, topic: true, rows: 'all', prefix: 'd_' } };
    const T = c.tlS(), C = c.tlCorpus(T), FT = c.tlFT(T, C), ctx = { T, C, FT, mask: null }; ctx.cnt = c.tlCounts(FT, C, null);
    const plan = c.tlSavePlan(ctx);
    assert.deepEqual(plan.problems, []);
    assert.deepEqual(plan.vars.map(v => v.name), ['d_economia', 'd_economia_any', 'd_economia_p100', 'd_corrupcion', 'd_corrupcion_any', 'd_corrupcion_p100', 'd_seguridad', 'd_seguridad_any', 'd_seguridad_p100', 'd_n_words', 'd_topic']);
    const L = c.tlDictLook(ctx);
    plan.vars.filter(v => v.kind === 'count' || v.kind === 'any').forEach(v => {
      const r = L.res[v.cat]; let s = 0, e = 0;
      for (let i = 0; i < raw.n; i++) { if (isFinite(v.a[i])) s += v.a[i]; const x = r.counts[i]; if (isFinite(x)) e += v.kind === 'any' ? (x > 0 ? 1 : 0) : x; }
      assert.equal(s, e, v.name + ' total');
    });
    const blank = rows.slice(1).findIndex(r => r[0] === '');
    assert.ok(plan.vars.every(v => Number.isNaN(v.a[blank])), 'blank text is missing, never 0');
    c.tlSaveRun(ctx, plan);
    assert.ok(raw.names.includes('d_economia') && raw.names.includes('d_topic'));
    assert.equal(c.state.genTags.d_economia, 'text');
    assert.ok(raw.vlabs.d_topic instanceof Map && raw.vlabs.d_topic.size === 3, 'main topic has value labels');
    // results survive the data change (no re-tokenising, topic model kept)
    assert.equal(c.tlCorpus(c.tlS()).key, C.key);
    c.tlSaveRun(ctx, c.tlSavePlan(ctx));
    assert.equal(raw.names.filter(n => n.startsWith('d_economia')).length, 3, 'saving again updates instead of duplicating');
    const r = c.tlSaveR(ctx, plan);
    assert.match(r, /tokens_lookup\(toks, dict, nested_scope = "key"\)/);
    assert.match(r, /stri_trans_general/);
  }
});
