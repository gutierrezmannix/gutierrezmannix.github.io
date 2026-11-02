// The written interpretation of every regression, checked against R (build .74): node --test calculator/tests/regression-interp.test.mjs
// Data and references: tests/data/regression-interp.csv and regression-interp-reference.json, from
// tests/regression-interp-reference.R (lm, glm binomial / poisson, MASS::polr, and a clustered Wald test by hand).
// - linear: b with its sign, the reference category, per +1,000 for a tiny per-unit effect, per step of a 0 / 50 / 100 scale;
// - logit, ordered logit, Poisson: odds ratios, odds of a higher category, rate ratios — per step and per reference;
// - "and N more (see the table)" when more than four predictors are significant;
// - the main effects inside an interaction are read where the other variable is at its reference or 0;
// - robust / clustered / survey SEs: the Wald test (Stata), not the LR test, in the fit list and the verdict;
// - the "Keep in mind" note follows the model (association for linear, ratios for the others); F = 0 has p = 1.
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
const REF = JSON.parse(fs.readFileSync(new URL('./data/regression-interp-reference.json', import.meta.url), 'utf8'));
const buf = fs.readFileSync(new URL('./data/regression-interp.csv', import.meta.url));
const raw = await E.parseCSV(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), () => {});
const c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
c.state = { ...c.state, screen: 'work', tab: 'reg', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i)), autoScreen: false,
  treat: { g: 'categorical', x: 'numeric', s: 'numeric', inc: 'numeric', y: 'numeric', yo: 'numeric', yc: 'numeric', cl: 'categorical' } };
const fit = st => { c.setState({ rgStep: 5, weightVar: '', regVce: 'classical', regCl: '', regIx: [], ...st }); c.clearMemo(); c._regRan = c.regSpec(); return c.renderVals(); };
const num = s => Number(String(s).replace(/,/g, '').replace('−', '-'));
const grab = (txt, re) => { const m = txt.match(re); assert.ok(m, 'not found: ' + re + '\n' + txt); return m.slice(1).map(num); };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' vs R ' + b);
const nSig = (P, keys) => keys.filter(k => P[k] < 0.05).length;

test('linear regression: signs, reference category, per +1,000 and per step of a 0 / 50 / 100 scale, and N more', () => {
  const t = fit({ depVar: 'y', predictors: ['x', 'g', 's', 'inc'], regModel: 'ols' }).regInterp, R = REF.ols;
  near(...grab(t, /x \(\+, b = ([\d.-]+)/), R.x, 0.0006, 'x');
  const [bs, s50] = grab(t, /s \(\+, b = ([\d.-]+), i\.e\. ([\d.-]+) per \+50/); near(bs, R.s, 0.0006, 's'); near(s50, 50 * R.s, 0.0006, 's per +50');
  const [bc] = grab(t, /g = c \(−, b = ([\d.-]+) compared with g = a/); near(bc, R.gc, 0.0006, 'g = c');
  const [, i1k] = grab(t, /inc \(\+, b = ([\d.-]+), i\.e\. ([\d.-]+) per \+1,000/); near(i1k, 1000 * R.inc, 0.0006, 'inc per +1,000');
  const sig = nSig(REF.ols_p, ['x', 'gb', 'gc', 's', 'inc']); assert.ok(sig > 4);
  assert.match(t, new RegExp('; and ' + (sig - 4) + ' more \\(see the table\\)\\. '));
  assert.match(t, /is overall statistically significant \(p < \.001\)/);
  assert.match(t, new RegExp('explains ' + (100 * REF.r2).toFixed(1) + '% of the variation in y'));
});

test('logit: odds ratios per +1, per step, per +10,000 and against the reference category', () => {
  const out = fit({ depVar: 'yb', predictors: ['x', 'g', 's', 'inc'], regModel: 'logistic' }), t = out.regInterp, R = REF.logit;
  assert.match(t, /^This logistic model predicts the odds that yb = "1"/);
  near(...grab(t, /x \(OR ([\d.]+) — each \+1 multiplies the odds by/), Math.exp(R.x), 0.006, 'x');
  near(...grab(t, /g = c \(OR ([\d.]+) — the odds are [\d.]+× those of g = a\)/), Math.exp(R.gc), 0.006, 'g = c');
  near(...grab(t, /s \(OR ([\d.]+) per \+50 — each \+50 multiplies the odds by/), Math.exp(50 * R.s), 0.006, 's per +50');
  near(...grab(t, /inc \(OR ([\d.]+) per \+10,000/), Math.exp(1e4 * R.inc), 0.006, 'inc per +10,000');
  const sig = nSig(REF.logit_p, ['x', 'gb', 'gc', 's', 'inc']); if (sig > 4) assert.match(t, new RegExp('; and ' + (sig - 4) + ' more \\(see the table\\)\\.'));
  assert.doesNotMatch(t, /NaN|\)0\./); assert.match(out.iReg.tip, /^Odds or rate ratios/);
});

test('ordered logit: odds of a higher category; Poisson: rate ratios', () => {
  let t = fit({ depVar: 'yo', predictors: ['x', 'g', 's', 'inc'], regModel: 'ologit' }).regInterp, R = REF.ologit;
  assert.match(t, /predicts where yo falls among its 4 ordered levels/);
  near(...grab(t, /x \(OR ([\d.]+) — each \+1 multiplies the odds of a higher category by/), Math.exp(R.x), 0.006, 'ologit x');
  near(...grab(t, /s \(OR ([\d.]+) per \+50/), Math.exp(50 * R.s), 0.006, 'ologit s per +50');
  near(...grab(t, /g = c \(OR ([\d.]+) — the odds of a higher category are [\d.]+× those of g = a\)/), Math.exp(R.gc), 0.006, 'ologit g = c');
  near(...grab(t, /g = b \(OR ([\d.]+) —/), Math.exp(R.gb), 0.006, 'ologit g = b');
  t = fit({ depVar: 'yc', predictors: ['x', 'g', 's'], regModel: 'poisson' }).regInterp; R = REF.poisson;
  near(...grab(t, /x \(IRR ([\d.]+) — each \+1 multiplies the expected count by/), Math.exp(R.x), 0.006, 'poisson x');
  near(...grab(t, /g = c \(IRR ([\d.]+) — the expected count is [\d.]+× that of g = a\)/), Math.exp(R.gc), 0.006, 'poisson g = c');
  near(...grab(t, /s \(IRR ([\d.]+) per \+50/), Math.exp(50 * R.s), 0.006, 'poisson s per +50');
  assert.doesNotMatch(t, /NaN|\)0\./);
});

test('interactions: a main effect is read where the other variable is at its reference (or 0)', () => {
  const t = fit({ depVar: 'y', predictors: ['x', 'g'], regModel: 'ols', regIx: [['x', 'g']] }).regInterp;
  assert.match(t, /x \(\+, b = [\d.]+, when g = a\)/); assert.match(t, /g = c \(−, b = -[\d.]+ compared with g = a, when x = 0\)/);
  assert.match(t, /strongest evidence first/); assert.doesNotMatch(t, /β =/);
});

test('clustered SEs: the Wald chi2 (as Stata), not the LR test, in the fit list and the verdict', () => {
  const out = fit({ depVar: 'yb', predictors: ['x', 'g', 's', 'inc'], regModel: 'logistic', regVce: 'cluster', regCl: 'cl' });
  const cell = out.sumCells.find(x => x.k === 'WALD CHI²'); assert.ok(cell, 'Wald chi2 in the fit list');
  assert.equal(cell.lab, 'Wald chi2(' + REF.logit_cluster_wald.df + ')'); near(num(cell.v), REF.logit_cluster_wald.chi2, 0.01, 'clustered Wald chi2');
  assert.ok(!out.sumCells.some(x => /^LR CHI/.test(x.k)), 'no LR test with clustered SEs');
  assert.match(text([out.rgEl, out.rgEl3]), /THE MODEL EXPLAINS SOMETHING/);
});

test('a linear model with nothing to say keeps the linear note; F = 0 has p = 1', () => {
  const out = fit({ depVar: 'y', predictors: ['inc'], regModel: 'ols', regIx: [] });
  assert.match(out.iReg.tip, /^Each coefficient is an association/);
  assert.equal(E.pF(0, 2, 30), 1); assert.ok(Number.isNaN(E.pF(-1, 2, 30)));
});

test('a tiny per-unit effect is read per +10, +100 … but never beyond the variable\'s range (age: per +10 years)', async () => {
  let csv = 'yy,age\n'; for (let i = 0; i < 600; i++) { const age = 18 + (i % 72); csv += (0.003 * age + ((i * 37) % 11) / 100).toFixed(4) + ',' + age + '\n'; }
  const b = Buffer.from(csv), r2 = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}), d = new C();
  d._E = E; d._raw = r2; d._svgs = {}; d.flash = () => {}; d.jumpArm = () => {}; d.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  d.state = { ...d.state, screen: 'work', tab: 'reg', nRows: r2.n, cols: r2.names.map((_, i) => E.profileCol(r2, i)), autoScreen: false, treat: { age: 'numeric', yy: 'numeric' } };
  d.setState({ depVar: 'yy', predictors: ['age'], regModel: 'ols', rgStep: 5, weightVar: '', regVce: 'classical', regIx: [] }); d.clearMemo(); d._regRan = d.regSpec();
  const t = d.renderVals().regInterp, bAge = d._rgCtx.M.coefs.find(q => q.term === 'age').b;
  assert.ok(Math.abs(bAge) < 0.005, 'a tiny per-year effect (' + bAge + ')');
  const [per10] = grab(t, /age \(\+, b = [\d.]+, i\.e\. ([\d.]+) per \+10,/); near(per10, 10 * bAge, 0.0006, 'per +10 years');
  assert.doesNotMatch(t, /per \+100/, 'never per +100 years for ages 18–89');
});

test('the coefficient table prints as Stata: factor block with indented levels, Stata digits, plot numbers = table numbers (build .75)', () => {
  const out = fit({ depVar: 'y', predictors: ['x', 'g', 's', 'inc'], regModel: 'ols' }), rows = out.coefRows, R = REF.ols;
  const i = rows.findIndex(r => r.term === 'g' && r.b === ''); assert.ok(i >= 0, 'a row with the factor variable name and no numbers');
  assert.deepEqual(rows.slice(i + 1, i + 3).map(r => r.term), ['b', 'c'], 'its levels beneath it (the base level a is left out, as Stata)');
  assert.match(rows[i + 1].tStyle, /padding-left/); assert.match(rows[i].tStyle, /font-weight: 700/);
  for (const [term, key] of [['x', 'x'], ['b', 'gb'], ['c', 'gc'], ['s', 's'], ['inc', 'inc'], ['_cons', '(Intercept)']]) {
    const r = rows.find(q => q.term === term), v = Number(r.b); assert.ok(Math.abs(v - R[key]) <= 5e-7 * Math.max(1, Math.abs(R[key])) + 5e-8, term + ': ' + r.b + ' vs R ' + R[key]);
    assert.ok(!/\*/.test(r.b) && !/^-?0\.\d/.test(r.b), term + ' as Stata prints it (no stars, no leading zero): ' + r.b);
  }
  assert.equal(out.zHead, 't'); assert.equal(out.pHead, 'P>|t|'); assert.equal(out.coefHeadY, 'y');
  const plot = text(out.coefPlotEl); for (const term of ['x', 'b', 'c', 's']) assert.ok(plot.includes(rows.find(q => q.term === term).b), 'the plot prints ' + term + ' as in the table');
  assert.match(text(out.rgEl), /regress y x i\.g s inc/, 'the command line names i.g');
});
