// Labelled numbers, missing values and factor levels as in Stata (build .71): node --test calculator/tests/labelled-codes.test.mjs
// Found while running the LAPOP class activities on the merged AmericasBarometer file (326,433 rows, 29 countries):
// - formulas use the codes of labelled numeric variables (m1: 1 = Very good … 5 = Very bad), as Stata does, instead of
//   refusing them as "text";
// - in conditions, missing is larger than any number: x < . means "not missing", x >= . means "missing";
// - generate … if … with a formula that cannot run leaves nothing behind (it used to leave an all-missing variable);
// - a categorical predictor's levels (i.year) come from the rows the model uses: a year with no outcome is not an empty
//   dummy, and the base is the first year with data;
// - with a subgroup on, the results say "N rows used of <subgroup rows> in the subgroup", not of the whole file.
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
globalThis.window = { innerWidth: 1600 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const text = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(text).join('') : (el.children || []).map(text).join('');
const wait = ms => new Promise(r => setTimeout(r, ms));

// two countries; the economy question (soct2) is not asked in 2004; m1 and soct2 are read as categories (labelled)
let csv = 'pais,year,m1,soct2\n';
for (const pais of [1, 2]) for (const yr of [2004, 2006, 2008]) for (let i = 0; i < 30; i++) {
  const s = yr === 2004 ? '' : 1 + (i % 3), m = 1 + ((i + (s === 3 ? 2 : 0) + (yr === 2008 ? 1 : 0)) % 5);
  csv += [pais, yr, m, s].join(',') + '\n';
}
const load = async () => {
  const b = Buffer.from(csv), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}), c = new C();
  c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
  c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  c.state = { ...c.state, screen: 'work', tab: 'reg', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i)), autoScreen: false, treat: { m1: 'categorical', soct2: 'categorical', pais: 'categorical' } };
  return c;
};

test('formulas use the codes of labelled numeric variables, as in Stata', async () => {
  const c = await load();
  assert.equal(c.valsCore('m1').kind, 'cat', 'm1 is shown by its labels');
  const r = c.evalExprAll('(5 - m1) / 4 * 100');
  assert.ok(!r.error, r.error); assert.equal(r.a[0], (5 - c._raw.cols[2].a[0]) / 4 * 100);
  c.setState({ genName: 'approve', genExpr: '(5 - m1) / 4 * 100', genErr: '' }); c.doGenerate();
  assert.equal(c.state.genErr, ''); assert.ok(c._raw.names.includes('approve'));
});

test('x < . means "not missing" and x >= . means "missing"', async () => {
  const c = await load(), n = k => { let s = 0; for (const v of c.condMask({ v: 'soct2', t: 'op', op: k, val: '.' })) s += v; return s; };
  assert.equal(n('<'), 120); assert.equal(n('!='), 120); assert.equal(n('>='), 60); assert.equal(n('=='), 60); assert.equal(n('>'), 0); assert.equal(n('<='), 180);
});

test('generate … if … runs the formula first: a failure leaves no variable behind', async () => {
  const c = await load(); let err = '';
  c.setState = (function (orig) { return function (p, cb) { if (p && p.mfCmdErr) err = p.mfCmdErr; return orig.call(this, p, cb); }; })(c.setState);
  c.runGenReplace('generate bad = nosuch + 1 if soct2 < .'); await wait(80);
  assert.ok(!c._raw.names.includes('bad'), 'no all-missing variable is left'); assert.match(err, /nosuch/);
  c.runGenReplace('generate econ_worse = soct2 == 3 if soct2 < .'); await wait(120);
  const i = c._raw.names.indexOf('econ_worse'), a = c._raw.cols[i].a, s = c._raw.cols[c._raw.names.indexOf('soct2')].a;
  let ones = 0, miss = 0; for (let k = 0; k < a.length; k++) { if (a[k] === 1) ones++; if (isNaN(a[k])) miss++; assert.ok(isNaN(s[k]) ? isNaN(a[k]) : a[k] === (s[k] === 3 ? 1 : 0)); }
  assert.equal(ones, 40); assert.equal(miss, 60);
});

test('i.year takes its levels from the rows the model uses; the results count the subgroup', async () => {
  const c = await load(); c._raw.names.push('econ'); c._raw.labels.push(''); const s = c._raw.cols[3].a;
  c._raw.cols.push({ k: 'n', a: Float64Array.from(s, v => isNaN(v) ? NaN : v === 3 ? 1 : 0) }); c.state.cols = c._raw.names.map((_, i) => E.profileCol(c._raw, i));
  c.state.treat = { ...c.state.treat, year: 'categorical' };
  c.state.subg = { all: [{ v: 'pais', t: 'in', vals: ['1'] }] };
  c.setState({ depVar: 'm1', predictors: ['econ', 'year'], regModel: 'ols', rgStep: 5, weightVar: '', treat: { ...c.state.treat, m1: 'numeric' } }); c.clearMemo(); c._regRan = c.regSpec();
  const out = c.renderVals();
  assert.ok(!out.regError, 'no "year = … is a combination of the other predictors": ' + out.regError);
  const t = text([out.rgEl, out.rgEl3]);
  assert.match(t, /60 rows used of 90 in the subgroup/);
  const terms = c._rgCtx.M.coefs.map(q => q.term);
  assert.deepEqual(terms, ['(constant)', 'econ = 1', 'year = 2008'], 'one dummy: 2006 is the base, 2004 (no economy question) is not a level');
});

test('a scale read as categories (every code labelled) is named in the results, with one click to use it as a number (build .73)', async () => {
  const c = await load(), find = (el, pred, out = []) => { if (el && typeof el === 'object') { if (Array.isArray(el)) el.forEach(x => find(x, pred, out)); else { if (pred(el)) out.push(el); (el.children || []).forEach(x => find(x, pred, out)); } } return out; };
  const meta = c.state.cols.find(m => m.name === 'soct2'); meta.treatAs = 'categorical'; // as for a .dta variable with a label on every code
  c.state.treat = { m1: 'numeric' };
  assert.equal(c.effMeta('soct2').treatAs, 'categorical');
  c.setState({ depVar: 'm1', predictors: ['soct2'], regModel: 'ols', rgStep: 5, weightVar: '' }); c.clearMemo(); c._regRan = c.regSpec();
  let out = c.renderVals();
  assert.deepEqual(c._rgCtx.M.coefs.map(q => q.term), ['(constant)', 'soct2 = 2', 'soct2 = 3'], 'one row per level, as i.soct2');
  assert.match(text([out.rgEl, out.rgEl3]), /soct2 is read as categories because every code has a label, so each level gets its own row compared with the first level \(as Stata’s i\.soct2\)/);
  const btn = find([out.rgEl, out.rgEl3], e => e.tag === 'button' && text(e) === 'Use soct2 as a number')[0]; assert.ok(btn, 'the button is there');
  btn.props.onClick(); await wait(20); out = c.renderVals();
  assert.ok(out.regRan, 'the model runs again at once');
  assert.deepEqual(c._rgCtx.M.coefs.map(q => q.term), ['(constant)', 'soct2'], 'one slope');
  assert.doesNotMatch(text([out.rgEl, out.rgEl3]), /read as categories/);
  c.setState({ treat: { m1: 'numeric', soct2: 'categorical' } }); c.clearMemo(); c._regRan = c.regSpec(); out = c.renderVals();
  assert.doesNotMatch(text([out.rgEl, out.rgEl3]), /read as categories/, 'no note when the C badge was chosen on purpose');
});
