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
    // saved variables appear in Over time; the dictionary has a timeline and a category word cloud
    c.state.tl = { ...c.state.tl, step: 'explore', sub: 'time', time: { what: 'var:d_economia', vmeasure: 'mean' } };
    const ot = c.tlRender(), otText = text(ot);
    assert.ok(find(ot, n => n.tag === 'option' && n.props.value === 'var:d_economia' && text(n) === 'd_economia').length === 1, 'saved variable listed in the dropdown');
    assert.match(otText, /d_economia · mean per text/);
    assert.ok(find(ot, n => n.tag === 'polyline').length >= 2, 'one line per author');
    // number of texts per period, one line per author; empty periods count as 0
    c.state.tl = { ...c.state.tl, time: { what: 'ntexts', unit: 'month', lines: 'author' } };
    const nt = c.tlRender(); assert.match(text(nt), /number of texts/); assert.equal(find(nt, n => n.tag === 'polyline').length >= 2, true);
    { const T0 = c.tlS(), C0 = c.tlCorpus(T0), F0 = c.tlFT(T0, C0), cx = { T: T0, C: C0, FT: F0, mask: null }, D0 = c.tlDates(T0, C0), first = c.tlFirstDoc(C0);
      const { G, defs } = c.tlGroupDefs(cx, d => first[d] ? 1 : NaN), agg = c.tlTimeAgg(cx, D0, 'month', defs, 'sum', true);
      agg.series.forEach((s, i) => { const expect = Array.from(G.g).filter((g, d) => G.labels[g] === s.name && !C0.blank[d]).length; const fin = s.pts.filter(Number.isFinite); assert.equal(fin.reduce((a, b) => a + b, 0), expect, s.name + ' total texts'); const a0 = s.pts.findIndex(Number.isFinite), b0 = s.pts.length - 1 - [...s.pts].reverse().findIndex(Number.isFinite); assert.ok(s.pts.slice(a0, b0 + 1).every(Number.isFinite), 'no gaps inside the active range: empty months are 0'); });
      const months = agg.xs.map(x => x.slice(0, 7)); assert.deepEqual(months, [...new Set(months)].sort(), 'every month in order'); }
    // by author and by variable/word/category together
    c.state.tl = { ...c.state.tl, time: { what: 'var:d_economia', vmeasure: 'mean', vars: ['d_corrupcion', 'd_seguridad'], lines: 'grid-author' } };
    let svgs = find(c.tlRender(), n => n.tag === 'svg');
    assert.equal(svgs.length, 2, 'one chart per author');
    assert.equal(find(svgs[0], n => n.tag === 'polyline').length >= 3, true, 'one line per variable');
    c.state.tl = { ...c.state.tl, time: { what: 'var:d_economia', vmeasure: 'pct', vars: ['d_corrupcion'], lines: 'grid-item' } };
    assert.equal(find(c.tlRender(), n => n.tag === 'svg').length, 2, 'one chart per variable');
    c.state.tl = { ...c.state.tl, q: 'econom*, corrup*', time: { what: 'search', measure: 'pct', lines: 'item' } };
    const st = c.tlRender(); svgs = find(st, n => n.tag === 'svg');
    assert.equal(svgs.length, 1); assert.ok(['econom*', 'corrup*'].every(w => find(svgs[0], n => n.tag === 'text').map(text).includes(w)), 'one line per search word');
    c.state.tl = { ...c.state.tl, time: { what: 'catall', measure: 'pct', lines: 'grid-item' } };
    assert.equal(find(c.tlRender(), n => n.tag === 'svg').length, 3, 'one chart per category, lines per author');
    c.state.tl = { ...c.state.tl, step: 'measure', msub: 'dict', dtime: { cat: 'all', measure: 'pct' }, dcloud: { show: true, mode: 'words', split: true } };
    const dtree = c.tlRender(), dtext = text(dtree);
    assert.match(dtext, /Timeline · each category over time by autor/);
    assert.match(dtext, /Category cloud/);
    // build .98: all categories by author draw one chart, a line per category with the authors' eras marked (plus the clouds per author)
    assert.ok(find(dtree, n => n.tag === 'svg').length >= 3, 'one timeline chart and category clouds per author');
    assert.match(dtext, /One line per category, autor marked/); assert.match(dtext, /category × autor/);
    { const tl = find(dtree, n => n.tag === 'svg' && /each category/.test(n.props['aria-label'] || ''))[0]; assert.ok(tl, 'the timeline chart'); const bold = find(tl, n => n.tag === 'text' && n.props.fontWeight === 700).map(text); assert.ok(bold.includes('Andrés Manuel') && bold.includes('Claudia Sheinbaum'), 'eras labelled: ' + bold.join(' | ')); }
    c.state.tl = { ...c.state.tl, dtime: { cat: 'all', measure: 'pct', lines: 'item-group' } };
    { const tl = find(c.tlRender(), n => n.tag === 'svg' && /each category/.test(n.props['aria-label'] || ''))[0]; const dashes = find(tl, n => n.tag === 'polyline').map(l => l.props.strokeDasharray || 'solid'); assert.ok(dashes.includes('solid') && dashes.includes('7 4'), 'category × autor: solid and dashed lines'); }
    c.state.tl = { ...c.state.tl, dtime: { cat: 'all', measure: 'pct', lines: 'grid-author' } };
    assert.ok(find(c.tlRender(), n => n.tag === 'svg' && /· %/.test(n.props['aria-label'] || '')).length >= 2, 'one chart per autor still available');
    c.state.tl = { ...c.state.tl, dcloud: { show: true, mode: 'names', split: false } };
    const names = find(c.tlRender(), n => n.tag === 'text').map(text);
    assert.ok(['economía', 'corrupción'].every(n => names.includes(n)), 'category names cloud');
    // results survive the data change (no re-tokenising, topic model kept)
    assert.equal(c.tlCorpus(c.tlS()).key, C.key);
    c.tlSaveRun(ctx, c.tlSavePlan(ctx));
    assert.equal(raw.names.filter(n => n.startsWith('d_economia')).length, 3, 'saving again updates instead of duplicating');
    const r = c.tlSaveR(ctx, plan);
    assert.match(r, /tokens_lookup\(toks, dict, nested_scope = "key"\)/);
    assert.match(r, /stri_trans_general/);
  }
});

test('build .98: Over time layouts with a group column, the length of the texts, and the kwic row link and passage', async () => {
  const c = await make(await E.parseCSV(buf(csvText), () => {}));
  c.state.tl = { v: 'texto', by: 'autor', date: 'fecha', step: 'explore', sub: 'time', q: 'corrup*, inversi*', time: { what: 'search', unit: 'auto', measure: 'pct', vmeasure: 'mean', order: 'auto', lines: 'auto', vars: [] } };
  const render = async () => { let t = c.tlRender(); for (let i = 0; i < 60; i++) { await tick(); t = c.tlRender(); if (!find(t, n => n.props && /tl-pending/.test(n.props.className || '')).length) break; } return t; };
  let t = await render(), s = text(t);
  // two words by author: the default is one line per word with the authors' eras marked
  const chips = find(t, n => n.props && n.props['aria-pressed'] === 'true').map(text);
  assert.ok(chips.includes('One line per word / category, autor marked'), 'default layout: ' + chips.join(' | '));
  assert.match(s, /word \/ category × autor/); assert.match(s, /groups pooled/);
  let svg = find(t, n => n.tag === 'svg')[0], bold = find(svg, n => n.tag === 'text' && n.props.fontWeight === 700).map(text);
  assert.ok(bold.includes('Andrés Manuel') && bold.includes('Claudia Sheinbaum') && bold.some(b => /^corrup/.test(b)) && bold.some(b => /^inversi/.test(b)), 'eras and both words on one chart: ' + bold.join(' | '));
  assert.equal(find(svg, n => n.tag === 'polyline').length, 2, 'one line per word');
  assert.doesNotMatch(s, /\+ `autor`/, 'the R code pools the authors for this layout');
  // word × author: colour by word, dashes by author, labels "word · author"
  c.state.tl.time.lines = 'item-group'; t = await render(); s = text(t); svg = find(t, n => n.tag === 'svg')[0];
  const lines = find(svg, n => n.tag === 'polyline'); assert.equal(lines.length, 4); assert.deepEqual([...new Set(lines.map(l => l.props.strokeDasharray || 'solid'))].sort(), ['7 4', 'solid']);
  assert.ok(find(svg, n => n.tag === 'text').map(text).some(x => /^corrup.* · Claudia/.test(x)), 'end labels name the word and the author'); assert.match(s, /\+ `autor`/);
  // the length of the texts: all words / kept / characters, mean / median / total
  c.state.tl.time = { ...c.state.tl.time, what: 'len', lines: 'auto' }; t = await render(); s = text(t);
  assert.match(s, /All words/); assert.match(s, /Words kept after cleaning/); assert.match(s, /Characters/); assert.match(s, /Median per text/); assert.match(s, /Total per/);
  svg = find(t, n => n.tag === 'svg')[0]; assert.equal(svg.props['aria-label'], 'Mean words per text'); assert.equal(find(svg, n => n.tag === 'polyline').length, 2, 'a line per author');
  assert.match(s, /df\$len <- ntoken\(toks\)/);
  const raw = c.tlRawWords(c.tlCtx ? c.tlCtx().C : c._tlJobs[Object.keys(c._tlJobs)[0]].value); assert.ok(raw.length >= 230 && raw[0] > 0 && raw[7] === 0, 'words per text before cleaning (the blank text has 0)');
  c.state.tl.time.lenOf = 'chars'; c.state.tl.time.lenAs = 'median'; t = await render(); s = text(t);
  assert.equal(find(t, n => n.tag === 'svg')[0].props['aria-label'], 'Median characters per text'); assert.match(s, /nchar\(df\$`texto`\)/); assert.match(s, /FUN = median/);
  { const ys = find(t, n => n.tag === 'svg')[0], tk = find(ys, n => n.tag === 'text').map(text).map(Number).filter(v => isFinite(v) && v > 0); assert.ok(Math.max(...tk) >= 60, 'characters, not words, on the axis: ' + tk.join(' ')); }
  c.state.tl.time.lenOf = 'kept'; c.state.tl.time.lenAs = 'sum'; t = await render(); assert.match(find(t, n => n.tag === 'svg')[0].props['aria-label'], /^Total words per (year|quarter|month|week|day) \(after cleaning\)$/);
  // kwic: wide sides, the row number opens the Data tab at that row, a click shows the passage
  c.state.tl = { ...c.state.tl, sub: 'context', q: 'corrup*', win: 12 }; t = await render();
  const pre = find(t, n => n.props && n.props.className === 'pre')[0]; assert.equal(pre.props.style.minWidth, '744px');
  const link = find(t, n => n.tag === 'button' && /^Open row \d+ in the Data tab$/.test(n.props['aria-label'] || ''))[0]; assert.ok(link, 'row link');
  link.props.onClick({ stopPropagation() {} }); assert.equal(c.state.tab, 'browse'); assert.equal(c.state.browseMode, 'data'); assert.equal(c.state.bRow + 1, Number(link.props['aria-label'].match(/\d+/)[0]));
  c.state.tab = 'text'; const tr = find(t, n => n.tag === 'tr')[0]; tr.props.onClick(); t = await render();
  const pass = find(t, n => n.props && n.props.className === 'tl-pass')[0]; assert.ok(pass, 'the passage opens'); assert.ok(find(pass, n => n.tag === 'mark').length === 1, 'with the keyword marked');
});
