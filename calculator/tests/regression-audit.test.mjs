// Random regression audit (build .76): node --test calculator/tests/regression-audit.test.mjs
// 370 random models on the LAPOP Mexico class file were checked against R (lm, glm, MASS::polr, manual sandwich SEs).
// What it found, fixed here:
// - logit, ordered logit and Poisson use the weights as given, as Stata's [iw=] / [pw=]: the log likelihood, the LR
//   test and the classical SEs depend on their scale (they used the mean-1 weights of linear models);
// - a yes/no outcome stored as labelled codes models code 1 (y ≠ 0, as Stata's logit), whatever its labels say;
// - terms that are collinear with the others, constant, or empty interaction cells are left out and shown as
//   "0 (omitted)" / "0 (empty)" with Stata's note, instead of stopping the model; a categorical predictor with one
//   level in the rows used is left out too. Margins, VIF and the console printout use the model that was fitted.
// R references: tests/regression-audit-reference.R (the data below are generated, same seed).
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
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), what + ': ' + a + ' vs R ' + b);

// y = 1 + .5 x1 + g effect + h effect + noise; x2 = 2 x1; k = 5 everywhere; no row has g = c and h = v
export const makeCSV = () => {
  let csv = 'y,x1,x2,k,g,h,ord,bin,wt\n', s = 7; const r = () => (s = (s * 69069 + 1) % 4294967296) / 4294967296;
  for (let i = 0; i < 300; i++) {
    const x1 = Math.round(r() * 40) / 4, g = ['a', 'b', 'c'][i % 3], h = g === 'c' ? 'u' : ['u', 'v'][Math.floor(r() * 2)];
    const y = 1 + 0.5 * x1 + (g === 'b' ? 1 : g === 'c' ? -1 : 0) + (h === 'v' ? 0.7 : 0) + r() * 3, ord = y < 4 ? 1 : y < 6 ? 2 : 3, bin = y > 5 ? 1 : 0;
    csv += [y.toFixed(4), x1, 2 * x1, 5, g, h, ord, bin, (1 + r()).toFixed(3)].join(',') + '\n';
  }
  return csv;
};
const load = async (csv = makeCSV()) => {
  const b = Buffer.from(csv), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}), c = new C();
  c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
  c.jobMemo = (key, fn) => c.memo(key, () => { const spec = fn(); return E[spec.__work](...spec.args); });
  c.state = { ...c.state, screen: 'work', tab: 'reg', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i)), autoScreen: false, treat: { g: 'categorical', h: 'categorical' } };
  return c;
};
const fit = (c, st) => { c.clearMemo(); c.setState({ weightVar: '', regIx: [], regVce: 'classical', subg: { all: [] }, rgStep: 5, ...st }); c._regRan = c.regSpec(); const out = c.renderVals(); return { out, M: c._rgCtx && c._rgCtx.M }; };
const check = (M, ref, tolB, tolS, what) => { // ref: { term: [b, se] }
  assert.deepEqual(M.coefs.map(q => q.term).sort(), Object.keys(ref).sort(), what + ' terms');
  for (const q of M.coefs) { close(q.b, ref[q.term][0], tolB, what + ' ' + q.term + ' b'); close(q.se, ref[q.term][1], tolS, what + ' ' + q.term + ' se'); }
};

test('logit, ordered logit and Poisson use the weights as given ([iw=]): log likelihood and SEs as R', async () => {
  const c = await load();
  // R: glm(bin ~ x1 + g, binomial, weights = wt); the log likelihood is Σ wt·log p (the weights' mean is 1.516)
  let { M } = fit(c, { depVar: 'bin', predictors: ['x1', 'g'], regModel: 'logistic', weightVar: 'wt' });
  check(M, { '(constant)': [-4.164728686, 0.4817851313], x1: [0.8808422817, 0.08406836916], 'g = b': [2.300111368, 0.4079069371], 'g = c': [-1.808111882, 0.3817425926] }, 1e-7, 2e-6, 'logit');
  close(M.ll, -154.6579982, 1e-9, 'logit ll'); close(M.llNull, -314.3214449, 1e-9, 'logit null ll');
  ({ M } = fit(c, { depVar: 'ord', predictors: ['x1', 'g'], regModel: 'poisson', weightVar: 'wt' }));
  check(M, { '(constant)': [0.2615445193, 0.08296805344], x1: [0.08863846982, 0.01081054248], 'g = b': [0.1535181108, 0.07678793455], 'g = c': [-0.2176530487, 0.08372651068] }, 1e-8, 1e-6, 'poisson');
  close(M.ll, -613.5971136, 1e-9, 'poisson ll (with lgamma(y + 1), as Stata)');
  // R: MASS::polr(factor(ord) ~ x1 + g, weights = wt, Hess = TRUE, control = list(reltol = 1e-14))
  ({ M } = fit(c, { depVar: 'ord', predictors: ['x1', 'g'], regModel: 'ologit', weightVar: 'wt' }));
  check(M, { x1: [0.8522171001, 0.06141814853], 'g = b': [1.88931647, 0.296241087], 'g = c': [-2.016124163, 0.2891121516] }, 1e-7, 1e-5, 'ologit');
  close(M.cuts[0].b, 2.009538682, 1e-7, 'cut1'); close(M.cuts[1].b, 5.594565976, 1e-7, 'cut2'); close(M.ll, -274.9157626, 1e-9, 'ologit ll');
});

test('a yes/no outcome stored as labelled codes models code 1 (y ≠ 0), whatever the labels say', async () => {
  const c = await load();
  // labels that sort the other way round: 0 = "Ninguna", 1 = "Alguna" (alphabetically "Alguna" comes first)
  c._raw.vlabs.bin = new Map([[0, 'Ninguna'], [1, 'Alguna']]); c.state.cols = c._raw.names.map((_, i) => E.profileCol(c._raw, i));
  assert.equal(c.regBin('bin').one, 'Alguna', 'code 1 is modeled');
  const { out, M } = fit(c, { depVar: 'bin', predictors: ['x1', 'g'], regModel: 'logistic' });
  assert.ok(M.coefs.find(q => q.term === 'x1').b > 0, 'P(bin = 1) rises with x1, as in the data');
  close(M.coefs.find(q => q.term === 'x1').b, 0.8958895, 1e-6, 'same slope as logit bin x1 i.g');
  assert.match(out.regNotes, /MODELING P\(BIN = "Alguna"\)/);
});

test('collinear, constant and empty terms are left out as Stata: 0 (omitted) / 0 (empty), the rest as R', async () => {
  const c = await load();
  // R: lm(y ~ x1 + x2 + k + g) — x2 and k are NA (aliased); Stata: note: x2 omitted because of collinearity.
  let { out, M } = fit(c, { depVar: 'y', predictors: ['x1', 'x2', 'k', 'g'], regModel: 'ols' });
  assert.ok(!out.regError, out.regError);
  check(M, { '(constant)': [2.897167, 0.1262617], x1: [0.4812158, 0.01761973], 'g = b': [1.009541, 0.1312772], 'g = c': [-1.258418, 0.1313136] }, 1e-6, 1e-6, 'ols');
  assert.deepEqual(M.omitted, [{ term: 'x2', why: 'collinear' }, { term: 'k', why: 'constant' }]);
  assert.equal(M.df1, 3, 'F(3, 296), as Stata: the omitted terms are not counted'); assert.equal(M.df2, 296); close(M.F, 339.8575941, 1e-8, 'F');
  const rows = out.coefRows.map(r => [r.term, r.b, r.se]);
  assert.deepEqual(rows.slice(0, 3), [['x1', '.4812158', '.0176197'], ['x2', '0', '(omitted)'], ['k', '0', '(omitted)']], 'in their place, as Stata prints them');
  assert.match(out.regNotes, /NOTE: X2 OMITTED BECAUSE OF COLLINEARITY\. NOTE: K OMITTED BECAUSE OF COLLINEARITY\./);
  assert.match(text([out.rgEl, out.rgEl3]), /Left out of the model, as in Stata: note: x2 omitted because of collinearity\. note: k omitted because of collinearity\./);
  assert.ok(!out.hasMgErr, 'the margins plot works: ' + out.mgErr);
  assert.deepEqual(out.vifRows.map(v => v.term).sort(), ['g = b', 'g = c', 'x1'], 'estat vif lists the terms kept');
  const con = c.regStataText(c.descFor());
  assert.match(con, /^note: x2 omitted because of collinearity\.\nnote: k omitted because of collinearity\.\n/);
  assert.match(con, /\n {10}x2 \| {10}0 {2}\(omitted\)\n {11}k \| {10}0 {2}\(omitted\)\n/);
  // logit and ordered logit: the same terms are left out (R: glm, polr without x2 and k)
  ({ out, M } = fit(c, { depVar: 'bin', predictors: ['x1', 'x2', 'k', 'g'], regModel: 'logistic' }));
  check(M, { '(constant)': [-4.146675, 0.5931213], x1: [0.8958895, 0.1052635], 'g = b': [2.153333, 0.4981018], 'g = c': [-1.817826, 0.473227] }, 1e-6, 1e-5, 'logit');
  assert.equal(M.omitted.length, 2); assert.ok(!out.hasMgErr, out.mgErr);
  ({ out, M } = fit(c, { depVar: 'ord', predictors: ['x1', 'x2', 'k', 'g'], regModel: 'ologit' }));
  check(M, { x1: [0.8690254, 0.07747412], 'g = b': [1.843384, 0.3653194], 'g = c': [-2.143509, 0.3629957] }, 1e-6, 1e-5, 'ologit');
  close(M.cuts[0].b, 1.972519, 1e-6, 'cut1'); assert.ok(!out.hasMgErr, out.mgErr);
  assert.ok(out.coefRows.some(r => r.term === 'x2' && r.se === '(omitted)'));
  // an interaction cell with no rows: R lm(y ~ x1 + g + h + g:h) has gc:hv = NA; Stata prints c#v | 0 (empty)
  ({ out, M } = fit(c, { depVar: 'y', predictors: ['x1', 'g', 'h'], regModel: 'ols', regIx: [['g', 'h']] }));
  check(M, { '(constant)': [2.506669, 0.1438958], x1: [0.4955809, 0.01673824], 'g = b': [0.9264943, 0.1674598], 'g = c': [-0.9402479, 0.1419032], 'h = v': [0.8223583, 0.1805074], 'g = b × h = v': [-0.02988396, 0.2503418] }, 1e-6, 1e-6, 'interaction');
  assert.deepEqual(M.omitted, [{ term: 'g = c × h = v', why: 'empty' }]);
  assert.ok(out.coefRows.some(r => r.raw === 'g = c × h = v' && r.b === '0' && r.se === '(empty)'));
  assert.match(text([out.rgEl, out.rgEl3]), /No row has g = c and h = v at the same time, so that interaction cell is empty/);
  assert.ok(!out.hasMgErr, 'margins of g by h: ' + out.mgErr);
  // robust SEs on the reduced model (R: HC1 of lm(y ~ x1 + g))
  ({ M } = fit(c, { depVar: 'y', predictors: ['x1', 'x2', 'g'], regModel: 'ols', regVce: 'robust' }));
  check(M, { '(constant)': [2.897167, 0.1292728], x1: [0.4812158, 0.01688428], 'g = b': [1.009541, 0.1354493], 'g = c': [-1.258418, 0.1311232] }, 1e-6, 1e-6, 'robust');
});

test('a categorical predictor with one level in the rows used is left out, as Stata (only its base)', async () => {
  const c = await load();
  // R: lm(y ~ x1, subset = g == "a") — R refuses factor(g) there ("contrasts can be applied only to factors with 2 or more levels")
  const { out, M } = fit(c, { depVar: 'y', predictors: ['x1', 'g'], regModel: 'ols', subg: { all: [{ v: 'g', t: 'in', vals: ['a'] }] } });
  assert.ok(!out.regError, out.regError);
  check(M, { '(constant)': [2.823364634, 0.1886758355], x1: [0.4964093394, 0.03310898607] }, 1e-8, 1e-8, 'one level');
  assert.equal(M.n, 100); assert.deepEqual(M.oneLevel, ['g']);
  assert.match(text([out.rgEl, out.rgEl3]), /note: g has one category in the rows used and was left out\./);
});

test('the rows stay those of the full model when a left-out variable has missing values', async () => {
  const csv = makeCSV().split('\n').map((l, i) => i > 0 && i % 10 === 0 && l ? l.split(',').map((v, j) => j === 2 ? '' : v).join(',') : l).join('\n'); // x2 missing in 30 rows
  const c = await load(csv);
  const { M } = fit(c, { depVar: 'y', predictors: ['x1', 'x2', 'g'], regModel: 'ols' });
  assert.deepEqual(M.omitted, [{ term: 'x2', why: 'collinear' }]);
  assert.equal(M.n, 270, 'as Stata: the 30 rows without x2 stay out of the sample');
});
