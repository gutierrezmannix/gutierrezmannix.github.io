// Descriptive statistics audit (build .91): node --test calculator/tests/descriptives-sim.test.mjs
// 1. The page's own code against R on simulated variables (tests/data/descriptives-sim-reference.json, written by
//    tests/descriptives-sim-reference.R): moments::skewness / kurtosis (and the same moments taken from the first value,
//    exact near 1e9), quantile(type = 2) = Stata's unweighted percentiles, Stata's weighted percentile rule, t.test's CI,
//    and survey::svymean / svyvar / confint for sampling weights (Stata's mean [pw=]). n from 1 to 100, missing values and
//    missing weights, values near 1e-6 and 1e9.
// 2. The fixes of the audit, on tests/data/descriptives-audit.dta: numbers never cut in their tiles, no empty chart boxes
//    (no value, one value), a box plot below 5 values says why, a constant sits in the middle of its charts, dates are
//    counted by month with the first / last / median date, chart labels near 1e9 (1,700.2M), skewness and kurtosis from 2
//    values, R tables of labelled variables print the labels, and a dataset with no variables says how to make one.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { gunzipSync } from 'node:zlib';
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1600 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const make = (raw, st, fileName) => { const c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {}; c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  c.state = { ...c.state, screen: 'work', tab: 'one', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i, true)), autoScreen: true, fileName: fileName || 'data.csv', ...st }; return c; };
const show = (c, st) => { Object.assign(c.state, st); c.clearMemo(); return c.renderVals(); };
const txt = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(txt).join('') : (el.children || []).map(txt).join('');
const flat = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(flat) : [n, ...(n.children || []).flatMap(flat)];

test('the panel agrees with R (moments, quantile, t.test, survey) on simulated variables', async () => {
  const cases = JSON.parse(fs.readFileSync(new URL('./data/descriptives-sim-reference.json', import.meta.url), 'utf8'));
  assert.ok(cases.length > 200, 'cases: ' + cases.length); let checked = 0;
  const near = (a, b, tag) => { if (b == null) return; assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(Math.abs(b) < 1e-3 ? Math.abs(b) : 1, Math.abs(b)) || (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12), tag + ': ' + a + ' vs R ' + b); };
  for (const K of cases) {
    const raw = await E.parseCSV(ab(Buffer.from(K.csv)), () => {}), c = make(raw, { weightVar: K.weighted ? 'w' : '', treat: { x: 'numeric' } });
    show(c, { exploreVar: 'x' }); const d = c.memoView()['desc|x'], tag = 'case ' + K.k + ' ' + K.kind + ' N=' + K.N + (K.weighted ? ' [pw]' : '');
    assert.equal(d.n, K.N, tag + ' n'); if (!K.N) continue;
    near(d.mean, K.mean, tag + ' mean'); near(d.mn, K.min, tag + ' min'); near(d.mx, K.max, tag + ' max');
    for (const p of [1, 5, 10, 25, 50, 75, 90, 95, 99]) near(d.pctl[p], K.pctl['p' + p], tag + ' p' + p);
    if (K.N >= 2) { near(d.sd, K.sd, tag + ' sd'); near(K.weighted ? d.sePw : d.sd / Math.sqrt(d.n), K.se, tag + ' se'); if (K.sk != null) { near(d.sk, K.sk, tag + ' skewness'); near(d.ku, K.ku, tag + ' kurtosis'); } }
    checked++;
  }
  assert.ok(checked > 200);
});

const audit = async () => make(await E.parseDTA(ab(fs.readFileSync(new URL('./data/descriptives-audit.dta', import.meta.url))), () => {}), {}, 'audit.dta');

test('tiles: a number is never cut ("288,4…"); sized to the narrowest tile', async () => {
  const c = await audit(), o = show(c, { exploreVar: 'ts' });
  for (const t of o.descCells) {
    const L = String(t.v).length, fs2 = +t.vs.match(/font-size: (\d+)px/)[1], room = /span 2/.test(t.ts) ? 172 : 74;
    assert.ok(0.69 * fs2 * L <= room + 0.5 || fs2 === 12, t.k + ' "' + t.v + '" at ' + fs2 + 'px in ' + room + 'px');
  }
});

test('no empty chart boxes: no value, one value; a box plot below 5 values says why; a constant sits in the middle', async () => {
  const c = await audit();
  let o = show(c, { exploreVar: 'vacia' });
  assert.match(o.exChartsStyle, /display: none/); assert.match(o.exInterp, /vacia has no values here/);
  o = show(c, { exploreVar: 'uno' }); assert.match(o.exChartsStyle, /display: none/); assert.match(o.exInterp, /nothing to chart/);
  o = show(c, { exploreVar: 'tres', treat: { tres: 'numeric' } }); assert.doesNotMatch(o.exChartsStyle, /display: none/); assert.ok(o.histChart, 'histogram from 2 values');
  assert.match(txt(o.boxChart), /A box plot needs at least 5 values; tres has 3/);
  const d = c.memoView()['desc|tres']; assert.ok(Number.isFinite(d.sk) && Number.isFinite(d.ku), 'skewness and kurtosis from 2 values, as Stata');
  o = show(c, { exploreVar: 'constante' });
  const ticks = flat(o.histChart).filter(n => n.tag === 'text').map(txt).filter(s => /^\d+$/.test(s));
  assert.ok(ticks.includes('5') && +ticks[0] < 5 && +ticks.at(-1) > 5, 'the axis goes round 5: ' + ticks.join(' '));
});

test('chart labels near 1e9 read 1,700.2M (not 1700200k)', () => {
  assert.equal(E.fmtTick(1700200000, { step: 200000 }), '1,700.2M');
  assert.equal(E.fmtTick(1700000000, { step: 1000000 }), '1,700M');
});

test('dates are counted by month, with the first, last and median date', async () => {
  const c = await audit(), o = show(c, { exploreVar: 'fecha' });
  assert.deepEqual(o.freqRows.map(r => r.level), ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12']);
  assert.match(o.exInterp, /fecha runs from 2024-01-01 to 2024-12-17 \(351 days\); half of the dates fall on or before 2024-06-20\. 40 valid dates on 40 different days, counted here by month\./);
  assert.match(o.freqNote, /DATES COUNTED BY MONTH \(40 DIFFERENT DAYS\)/);
});

test('R tables of a labelled variable print the labels, as Stata does (checked in R with haven)', async () => {
  const c = await audit();
  show(c, { exploreVar: 'voto', weightVar: '' }); let d = c.descFor();
  assert.equal(c.cmdText(d, 'r'), 'table(haven::as_factor(df$voto))'); assert.match(c.descRText(d), /Morena\s+PAN\s+PRI No sabe/);
  show(c, { exploreVar: 'voto', weightVar: 'peso' }); d = c.descFor();
  assert.equal(c.cmdText(d, 'r'), 'prop.table(xtabs(peso ~ haven::as_factor(voto), data = df)) * 100'); assert.match(c.descRText(d), /^haven::as_factor\(voto\)\n/);
});

test('a dataset with no variables says how to make one', async () => {
  const c = make({ n: 20, names: [], labels: [], cols: [], vlabs: {} }, {});
  const o = show(c, { exploreVar: '' });
  assert.equal(o.exEmptyTitle, 'This dataset has no variables yet'); assert.equal(o.exNoVars, true);
  o.exMakeVar(); assert.equal(c.state.tab, 'data'); assert.equal(c.state.deTask, 'new');
});

test('frequencies: a variable with value labels shows each code next to its label (build .94)', async () => {
  const c = await audit();
  let o = show(c, { exploreVar: 'voto', weightVar: '' });
  assert.equal(o.freqHasCode, true);
  assert.deepEqual(o.freqRows.map(r => [r.code, r.level]), [['1', 'Morena'], ['2', 'PAN'], ['3', 'PRI'], ['9', 'No sabe']]);
  assert.match(o.freqHeadStyle, /grid-template-columns: 56px /);
  o = show(c, { exploreVar: 'fecha' }); assert.equal(o.freqHasCode, false, 'dates and text: no code column');
});
