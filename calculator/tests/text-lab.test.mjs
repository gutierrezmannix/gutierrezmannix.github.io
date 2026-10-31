// Text lab engine tests: node --test calculator/tests/text-lab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, '../src', f), 'utf8');
const src = read('text-lab-data.mjs') + '\n' + read('text-lab-stem.mjs') + '\n' + read('text-lab-engine.mjs');
const E = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const BASE = { url: 'remove', num: 'remove', emoji: 'remove', tag: 'keep', mention: 'keep', hyphen: 'keep', fold: true, langs: ['es', 'en'], stopSource: 'snowball', extra: [], minLen: 2, forms: 'none', phrases: [], minDoc: 0, maxDocPct: 100 };

test('stemmers match the Snowball reference exactly', () => {
  const ref = JSON.parse(fs.readFileSync(path.join(here, 'data/text-stem-reference.json'), 'utf8'));
  for (const [lang, fn] of [['es', E.tlStemEs], ['en', E.tlStemEn]]) {
    const [w, s] = ref[lang]; const bad = w.filter((x, i) => fn(x) !== s[i]);
    assert.deepEqual(bad, [], lang + ' stems differ');
  }
});

test('tokenizer keeps links, hashtags, mentions, inclusive spellings and hyphenated words whole', () => {
  const C = E.tlTokenize(['Becaremos a tod@s l@s estudiantes, como en la Ciudad de México. #DíaDelEstudiante https://t.co/mBmN3iFxD0', 'Gracias @lopezobrador_ 🇲🇽 covid-19: 3.59% más', '', null]);
  const toks = d => Array.from(C.tok.subarray(C.off[d], C.off[d + 1]), t => [C.types[t], C.kind[t]]);
  const d0 = toks(0);
  assert.ok(d0.some(([w, k]) => w === 'tod@s' && k === 1));
  assert.ok(d0.some(([w, k]) => w === 'l@s' && k === 1));
  assert.ok(d0.some(([w, k]) => w === '#díadelestudiante' && k === 2));
  assert.ok(d0.some(([w, k]) => w === 'https://t.co/mbmn3ifxd0' && k === 4));
  const d1 = toks(1);
  assert.ok(d1.some(([w, k]) => w === '@lopezobrador_' && k === 3));
  assert.ok(d1.some(([w, k]) => w === 'covid-19' && k === 1));
  assert.ok(d1.some(([w, k]) => w === '3.59' && k === 5));
  assert.deepEqual([C.blank[2], C.blank[3], C.docs], [1, 1, 2]);
  // a sentence break separates "méxico" from the next token
  const iMx = C.off[0] + d0.findIndex(([w]) => w === '#díadelestudiante');
  assert.equal(C.brk[iMx], 1);
});

test('dictionary: accents, wildcards, hashtags, hyphens, overlaps and exclusions (quanteda tokens_lookup semantics)', () => {
  const texts = ['La economía mexicana crece.', 'Más inversión económica.', 'La Guardia Nacional y la seguridad nacional.', 'Hoy #COVID19 y covid-19 en la CDMX', 'El terrorismo y el antiterrorismo', 'Seguro que la seguridad mejora', ''];
  const C = E.tlTokenize(texts);
  const count = (keys, fold = true) => Array.from(E.tlLookup(C, E.tlCompileDict(C, [{ name: 'x', keys }], fold))[0].counts).map(v => isNaN(v) ? null : v);
  assert.deepEqual(count('economia'), [1, 0, 0, 0, 0, 0, null]);
  assert.deepEqual(count('economia', false), [0, 0, 0, 0, 0, 0, null], 'exact matching when accents are respected');
  assert.deepEqual(count('econom*'), [1, 1, 0, 0, 0, 0, null]);
  assert.deepEqual(count('economía'.normalize('NFD')), [1, 0, 0, 0, 0, 0, null], 'decomposed accents in pasted keywords');
  assert.deepEqual(count('guardia nacional, nacional*'), [0, 0, 2, 0, 0, 0, null], 'phrase and word overlap count once');
  assert.deepEqual(count('#covid19'), [0, 0, 0, 1, 0, 0, null]);
  assert.deepEqual(count('covid19'), [0, 0, 0, 1, 0, 0, null], 'plain keywords also read hashtag text');
  assert.deepEqual(count('covid-19'), [0, 0, 0, 1, 0, 0, null]);
  assert.deepEqual(count('*terror*'), [0, 0, 0, 0, 2, 0, null]);
  assert.deepEqual(count('segur*, -seguro'), [0, 0, 1, 0, 0, 1, null]);
  assert.deepEqual(count('"la seguridad"'), [0, 0, 1, 0, 0, 1, null]);
  assert.deepEqual(count('mexicana, "la seguridad"'), [1, 0, 1, 0, 0, 1, null], 'a quoted phrase after a comma');
  // switched-off forms in the match list behave like exclusions
  const off = Array.from(E.tlLookup(C, E.tlCompileDict(C, [{ name: 'x', keys: 'segur*', off: new Set(['seguro']) }], true))[0].counts);
  assert.deepEqual(off.slice(0, 6), [0, 0, 1, 0, 0, 1]);
  // forms that matched are reported with counts
  const r = E.tlLookup(C, E.tlCompileDict(C, [{ name: 'x', keys: 'econom*' }], true))[0];
  assert.deepEqual([...r.forms.entries()].sort(), [['economía', 1], ['económica', 1]]);
  assert.equal(r.mentions, 2); assert.equal(r.docs, 2);
});

test('features: Spanish + English stopwords, accent merging, phrases, stems, hashtag modes, trimming', () => {
  const texts = ['La economia y la economía de la Ciudad de México', 'The economy of Mexico City #México', 'Trabajadores trabajando en el trabajo'];
  const C = E.tlTokenize(texts);
  const FT = E.tlFeatures(C, Object.assign({}, BASE, { phrases: [['ciudad', 'de', 'méxico']] }), E.tlStemEs);
  const lab = FT.order.map(f => [FT.label[f], FT.count[f]]);
  assert.ok(lab.some(([w, c]) => w === 'economía' && c === 2), 'accent variants merge under the most common written form');
  assert.ok(lab.some(([w, c]) => w === 'ciudad de méxico' && c === 1), 'phrase joined before stopword removal');
  assert.ok(!lab.some(([w]) => ['la', 'de', 'the', 'of', 'y', 'en', 'el'].includes(w)), 'es + en stopwords removed');
  assert.ok(lab.some(([w]) => w === '#méxico'));
  const st = E.tlFeatures(C, Object.assign({}, BASE, { forms: 'stem' }), E.tlStemEs);
  const trab = st.order.find(f => st.label[f] === 'trabaj');
  assert.equal(st.count[trab], 3, 'trabajadores/trabajando/trabajo share the stem trabaj'); assert.equal(st.nforms[trab], 3);
  const eco = st.order.find(f => st.label[f] === 'econom');
  assert.equal(st.count[eco], 2, 'economia (no accent) is stemmed from its accented spelling economía');
  const tw = E.tlFeatures(C, Object.assign({}, BASE, { tag: 'word' }), null);
  assert.ok(tw.order.some(f => tw.label[f] === 'méxico' && tw.count[f] === 3), 'hashtag read as a word merges with the word');
  const tr = E.tlFeatures(C, Object.assign({}, BASE, { minDoc: 2 }), null);
  assert.deepEqual(tr.order.map(f => tr.label[f]), ['méxico'], 'dfm_trim(min_docfreq = 2)');
  assert.equal(tr.total, tr.order.reduce((s, f) => s + tr.count[f], 0));
});

test('keyness χ² with Yates correction reproduces the hand computation', () => {
  // ciudad: Sheinbaum 5620 of 298965 words, López Obrador 177 of 86252 words
  const tc = Float64Array.from([5620, 298965 - 5620]), rc = Float64Array.from([177, 86252 - 177]);
  const k = E.tlKeyness(tc, rc, { minCount: 0 });
  const ciudad = k.rows.find(r => r.f === 0);
  const a = 5620, b = 177, c = 298965 - a, d = 86252 - b, N = a + b + c + d;
  const expect = (Math.abs(a * d - b * c) - N / 2) ** 2 * N / ((a + b) * (c + d) * (a + c) * (b + d));
  assert.ok(Math.abs(ciudad.stat - expect) < 1e-6 * expect);
  assert.ok(ciudad.p < 1e-10);
  const lr = E.tlKeyness(tc, rc, { minCount: 0, measure: 'lr' }).rows.find(r => r.f === 0);
  assert.ok(lr.stat > 0 && lr.p < 1e-10);
});

test('collocations: λ equals the smoothed log odds ratio for bigrams', () => {
  const texts = Array.from({ length: 40 }, (_, i) => i % 4 === 0 ? 'tren maya llega hoy' : i % 4 === 1 ? 'el tren llega tarde' : i % 4 === 2 ? 'cultura maya viva' : 'tren maya y cultura');
  const C = E.tlTokenize(texts);
  const res = E.tlCollocations(C, { size: 2, minCount: 2, langs: ['es'] });
  const tm = res.find(r => r.words.join(' ') === 'tren maya');
  // contingency of adjacent word pairs
  let n11 = 0, n1x = 0, nx1 = 0, N = 0;
  for (let d = 0; d < C.off.length - 1; d++) for (let i = C.off[d]; i + 1 < C.off[d + 1]; i++) { const a = C.types[C.tok[i]], b = C.types[C.tok[i + 1]]; N++; if (a === 'tren') n1x++; if (b === 'maya') nx1++; if (a === 'tren' && b === 'maya') n11++; }
  const n12 = n1x - n11, n21 = nx1 - n11, n22 = N - n11 - n12 - n21;
  const lam = Math.log(n11 + .5) - Math.log(n12 + .5) - Math.log(n21 + .5) + Math.log(n22 + .5);
  assert.ok(Math.abs(tm.lambda - lam) < 1e-9);
  assert.ok(Math.abs(tm.z - lam / Math.sqrt(1 / (n11 + .5) + 1 / (n12 + .5) + 1 / (n21 + .5) + 1 / (n22 + .5))) < 1e-9);
  const tri = E.tlCollocations(C, { size: 3, minCount: 2, langs: ['es'] });
  assert.ok(tri.some(r => r.words.join(' ') === 'tren maya llega'));
});

test('dates: ISO, d.m.y with detected order, month names in Spanish and English, Twitter, years', () => {
  const iso = d => isFinite(d) ? new Date(d * 86400000).toISOString().slice(0, 10) : null;
  const r = E.tlParseDates(['02.12.18', '18.01.25', '2025-02-13 07:44:54', 'Nov 1, 2011', '1 de enero de 2020', 'Wed Oct 10 20:19:24 +0000 2018', '2019', '', 'not a date']);
  assert.deepEqual(Array.from(r.day, iso), ['2018-12-02', '2025-01-18', '2025-02-13', '2011-11-01', '2020-01-01', '2018-10-10', '2019-01-01', null, null]);
  assert.equal(r.order, 'dmy'); assert.equal(r.ambiguous, false);
  const amb = E.tlParseDates(['02.03.18', '04.05.19']);
  assert.equal(amb.ambiguous, true);
  assert.deepEqual(Array.from(E.tlParseDates(['02.03.18'], 'mdy').day, iso), ['2018-02-03']);
  const y = E.tlParseDates(Float64Array.from([2014, 2015, NaN]));
  assert.equal(y.yearOnly, true);
});

test('hclust heights and cophenetic correlation match stats::hclust', () => {
  const x = [0, 1, 4, 10], n = 4, D = new Float64Array(16);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i * n + j] = Math.abs(x[i] - x[j]);
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(close(E.tlHclust(D, n, 'average').height, [1, 3.5, 25 / 3]));
  assert.ok(close(E.tlHclust(D, n, 'single').height, [1, 3, 6]));
  assert.ok(close(E.tlHclust(D, n, 'complete').height, [1, 4, 10]));
  assert.ok(close(E.tlHclust(D, n, 'ward.D2').height, [1, Math.sqrt(49 / 3), Math.sqrt(1250 / 12)]));
  const H = E.tlHclust(D, n, 'average');
  assert.deepEqual(Array.from(E.tlCutree(H, n, 2)), [1, 1, 1, 2]);
  assert.ok(H.coph > 0.9);
  const rows = [[1, 0, 0], [0.9, 0.1, 0], [0, 0, 1]], Dc = E.tlMatrixDist(rows, 'cosine');
  assert.ok(Math.abs(Dc[1] - (1 - 0.9 / Math.sqrt(0.82))) < 1e-12);
});

test('LDA recovers two planted topics; seeded LDA keeps seed words in their topic', () => {
  const A = ['salud', 'vacuna', 'hospital', 'medico', 'covid'], B = ['tren', 'obra', 'puente', 'carretera', 'via'];
  const docs = [];
  for (let d = 0; d < 120; d++) { const w = d % 2 ? A : B; docs.push(Array.from({ length: 30 }, (_, i) => w[(i * 7 + d) % 5]).join(' ')); }
  const C = E.tlTokenize(docs), FT = E.tlFeatures(C, BASE, null);
  const run = gen => { let r; while (!(r = gen.next()).done); return r.value; };
  const m = run(E.tlLDA(FT.ftok, FT.foff, FT.nF, 2, { iter: 200, seed: 3 }));
  const top = k => Array.from({ length: FT.nF }, (_, w) => w).sort((a, b) => m.phi[k * FT.nF + b] - m.phi[k * FT.nF + a]).slice(0, 5).map(w => FT.label[w]).sort();
  const t0 = top(0), t1 = top(1);
  assert.ok((t0.join() === [...A].sort().join() && t1.join() === [...B].sort().join()) || (t1.join() === [...A].sort().join() && t0.join() === [...B].sort().join()));
  assert.ok(Math.abs(m.size[0] + m.size[1] - 1) < 1e-9);
  const seeds = new Float64Array(FT.nF * 2), total = FT.total;
  FT.order.forEach(f => { if (B.includes(FT.label[f])) seeds[f * 2 + 0] = FT.count[f] * 0.01 * 100; });
  const s = run(E.tlLDA(FT.ftok, FT.foff, FT.nF, 2, { iter: 200, seed: 5, seeds }));
  const tren = FT.order.find(f => FT.label[f] === 'tren');
  assert.ok(s.phi[0 * FT.nF + tren] > s.phi[1 * FT.nF + tren], 'seed word stays in its seeded topic');
  const theta = E.tlLDAPredict(m, FT.ftok, FT.foff, { iter: 50 });
  assert.ok(Math.abs(theta[0] + theta[1] - 1) < 1e-9);
});

test('Naive Bayes, groups that differ only in capitals, safe variable names', () => {
  const texts = ['salud vacuna hospital', 'vacuna salud', 'tren obra', 'obra puente tren', 'salud hospital', 'puente tren'];
  const C = E.tlTokenize(texts), FT = E.tlFeatures(C, BASE, null);
  const y = Int32Array.from([0, 0, 1, 1, -1, -1]), train = Uint8Array.from([1, 1, 1, 1, 0, 0]);
  const nb = E.tlNaiveBayes(FT, y, ['health', 'works'], train);
  assert.deepEqual(Array.from(nb.pred), [0, 0, 1, 1, 0, 1]);
  const g = E.tlGroups(['Amlo', 'amlo', 'Sheinbaum', ' Amlo ', null], true);
  assert.deepEqual(Array.from(g.g), [0, 0, 1, 0, -1]); assert.equal(g.labels[0], 'Amlo'); assert.equal(g.merged.length, 1);
  const taken = new Set(['d_economia']);
  assert.equal(E.tlVarName('d_economía', taken), 'd_economia_2');
  assert.equal(E.tlVarName('d_salud pública', new Set()), 'd_salud_publica');
  assert.equal(E.tlVarName('d_niñez', new Set()), 'd_ninez');
  assert.equal(E.tlVarName('d_' + 'x'.repeat(40) + '_any', new Set()).length, 32);
});

test('fold keeps ñ and ç but drops other accents', () => {
  assert.equal(E.tlFold('Año Peña Économie Übermäßig façade'), 'Año Peña Economie Ubermaßig façade');
});
