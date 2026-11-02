// Regression numerics and wording (build .64): node --test calculator/tests/regression-numerics.test.mjs
// - NIST StRD Longley (certified values) and agreement with R on tests/data/regression-numerics.csv, whose references
//   (tests/data/regression-numerics-reference.json) come from tests/regression-numerics-reference.R.
// - The same variable in other units is collinear (named), never an impossible fit; results do not depend on units.
// - Ordered logit with incomes in pesos, timestamps and rates of 0.001; logit / Poisson with values of 1e-6.
// - Weights as in Stata ([pw=] robust, [aw=] / [iw=] ordinary), clustered SEs, margins with the model's variance.
// - Yes/no outcomes coded 1/2 or text: the value modeled, and exported Stata / R code that runs.
// - Display (no 0.000 for small coefficients), wording for categories and interactions, one star convention.
// - Earlier fixes: the one-sided t-test command after a swap, ttest options, weighted correlation commands, default
//   variables of the correlation matrix, the imputation code, and means of values near 1e9.
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
const REF = JSON.parse(fs.readFileSync(new URL('./data/regression-numerics-reference.json', import.meta.url), 'utf8'));
const CSV = fs.readFileSync(new URL('./data/regression-numerics.csv', import.meta.url));
const parse = async buf => { const b = Buffer.from(buf); return E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}); };
const load = async (buf = CSV) => {
  const raw = await parse(buf), c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
  c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  c.state = { ...c.state, screen: 'work', tab: 'reg', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i)), autoScreen: false };
  return c;
};
const fit = (c, st) => { c.setState(st); c.clearMemo(); c._regRan = c.regSpec(); return c.renderVals(); };
const text = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(text).join('') : (el.children || []).map(text).join('');
const rel = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-300), what + ': ' + a + ' vs ' + b);
const c0 = await load();
const num = n => ({ name: n, kind: 'num', a: c0.numVals(n).a });
const cat = (n, levels) => ({ name: n, kind: 'cat', a: c0.vals(n).a.map(v => v == null ? null : String(v)), levels });
const Y = n => c0.numVals(n).a;

test('NIST StRD Longley: coefficients, standard errors, R² and residual SD to the certified values', async () => {
  const rows = '60323,83.0,234289,2356,1590,107608,1947\n61122,88.5,259426,2325,1456,108632,1948\n60171,88.2,258054,3682,1616,109773,1949\n61187,89.5,284599,3351,1650,110929,1950\n63221,96.2,328975,2099,3099,112075,1951\n63639,98.1,346999,1932,3594,113270,1952\n64989,99.0,365385,1870,3547,115094,1953\n63761,100.0,363112,3578,3350,116219,1954\n66019,101.2,397469,2904,3048,117388,1955\n67857,104.6,419180,2822,2857,118734,1956\n68169,108.4,442769,2936,2798,120445,1957\n66513,110.8,444546,4681,2637,121950,1958\n68655,112.6,482704,3813,2552,123366,1959\n69564,114.2,502601,3931,2514,125368,1960\n69331,115.7,518173,4806,2572,127852,1961\n70551,116.9,554894,4007,2827,130081,1962';
  const L = await parse('y,x1,x2,x3,x4,x5,x6\n' + rows), col = j => Float64Array.from(L.cols[j].a);
  const m = E.regress(col(0), [1, 2, 3, 4, 5, 6].map(j => ({ name: 'x' + j, kind: 'num', a: col(j) })), null, null);
  const b = [-3482258.63459582, 15.0618722713733, -0.358191792925910E-01, -2.02022980381683, -1.03322686717359, -0.511041056535807E-01, 1829.15146461355];
  const se = [890420.383607373, 84.9149257747669, 0.334910077722432E-01, 0.488399681651699, 0.214274163161675, 0.226073200069370, 455.478499142212];
  m.coefs.forEach((c, j) => { rel(c.b, b[j], 1e-10, 'b' + j); rel(c.se, se[j], 1e-10, 'se' + j); });
  rel(m.R2, 0.995479004577296, 1e-12, 'R²'); rel(m.rmse, 304.854073561965, 1e-11, 'residual SD');
  // NIST Wampler 1 and 2: fifth-degree polynomials (x up to 20, x^5 up to 3.2 million) fitted exactly; certified b
  for (const [k, cert] of [[1, [1, 1, 1, 1, 1, 1]], [2, [1, 0.1, 0.01, 0.001, 0.0001, 0.00001]]]) {
    const xs = Float64Array.from({ length: 21 }, (_, i) => i), y = Float64Array.from(xs, x => cert.reduce((s2, c, j) => s2 + c * x ** j, 0));
    const w = E.regress(y, [1, 2, 3, 4, 5].map(j => ({ name: 'x' + j, kind: 'num', a: Float64Array.from(xs, x => x ** j) })), null, null);
    w.coefs.forEach((c, j) => rel(c.b, cert[j], 1e-9, 'Wampler' + k + ' b' + j)); assert.ok(w.R2 > 1 - 1e-12);
  }
});

test('OLS agrees with R, does not depend on units, and names collinear predictors instead of an impossible fit', () => {
  const m = E.regress(Y('y'), [num('inc'), num('x2')], null, null);
  m.coefs.forEach((c, j) => { rel(c.b, REF.ols_b[j], 1e-10, 'b'); rel(c.se, REF.ols_se[j], 1e-10, 'se'); });
  rel(m.R2, REF.ols_r2[0], 1e-12, 'R²'); rel(m.rmse, REF.ols_rmse[0], 1e-12, 'root MSE');
  const k = E.regress(Y('y'), [num('inc_k'), num('x2')], null, null);
  rel(k.coefs[1].b, 1000 * m.coefs[1].b, 1e-10, 'thousands'); rel(k.coefs[1].t, m.coefs[1].t, 1e-10, 't'); rel(k.R2, m.R2, 1e-12, 'R²');
  for (const v of ['inc_k', 'inc_m', 'inc3', 'inc10', 'stamp']) {
    assert.equal(REF['alias_' + v][0], 1, 'R also drops ' + v);
    const r = E.regress(Y('y'), [num('inc'), num(v), num('x2')], null, null);
    assert.match(r.error || '', new RegExp('collinear: “' + v + '”'), v + ': ' + (r.error || 'R² ' + r.R2));
    for (const fam of ['logistic', 'poisson']) assert.match(E.glm(Y(fam === 'logistic' ? 'e' : 'cnt'), [num('inc'), num(v), num('x2')], null, fam).error || '', new RegExp('“' + v + '”'), fam + ' ' + v);
    assert.match(E.ologit(Y('o'), [num('inc'), num(v), num('x2')], null, null).error || '', new RegExp('“' + v + '”'), 'ologit ' + v);
  }
  // nearly but not exactly collinear (thousands rounded to 3 decimals): R keeps both, and so does the page
  const n = E.regress(Y('y'), [num('inc'), num('inc_r'), num('x2')], null, null);
  n.coefs.forEach((c, j) => { rel(c.b, REF.near_b[j], 1e-6, 'near b'); rel(c.se, REF.near_se[j], 1e-6, 'near se'); });
  assert.ok(n.R2 >= 0 && n.R2 <= 1); rel(n.R2, REF.near_r2[0], 1e-10, 'near R²');
  // a predictor that does not vary, and a category with no rows in the sample
  const flat = Float64Array.from(Y('y'), () => 5);
  assert.match(E.regress(Y('y'), [num('x2'), { name: 'flat', kind: 'num', a: flat }], null, null).error, /“flat” does not vary/);
  assert.match(E.regress(Y('y'), [num('x2'), cat('grupo', ['A', 'B', 'C', 'D'])], null, null).error, /“grupo = D” does not vary/);
});

test('weights and clusters as in Stata: [pw=] robust, [aw=] ordinary, clustered G/(G-1)(n-1)/(n-k)', () => {
  const w = Y('w');
  E.regress(Y('y'), [num('x2'), num('inc_k')], w, { type: 'robust' }).coefs.forEach((c, j) => { rel(c.b, REF.pw_b[j], 1e-10, 'pw b'); rel(c.se, REF.pw_se[j], 1e-9, 'pw se'); });
  E.regress(Y('y'), [num('x2'), num('inc_k')], w, null).coefs.forEach((c, j) => rel(c.se, REF.aw_se[j], 1e-9, 'aw se'));
  const cl = c0.vals('cl').a.map(v => v == null ? null : String(v));
  E.regress(Y('y'), [num('x2'), cat('grupo', ['A', 'B', 'C'])], null, { type: 'cluster', cl }).coefs.forEach((c, j) => rel(c.se, REF.cl_se[j], 1e-9, 'cluster se'));
  // the model F is unit-free: robust Wald F with income in pesos equals the one in thousands
  const F1 = E.regress(Y('y'), [num('inc'), num('x2')], null, { type: 'robust' }).F, F2 = E.regress(Y('y'), [num('inc_k'), num('x2')], null, { type: 'robust' }).F;
  assert.ok(Number.isFinite(F1)); rel(F1, F2, 1e-9, 'robust F');
});

test('logit and Poisson with income in pesos and a variable of about 1e-6 agree with R (classical and robust)', () => {
  for (const [fam, y, k] of [['logistic', 'e', 'logit'], ['poisson', 'cnt', 'poisson']]) {
    const P = [num('inc'), num('x2'), num('tiny')], m = E.glm(Y(y), P, null, fam), r = E.glm(Y(y), P, null, fam, { type: 'robust' });
    assert.ok(m.converged, fam);
    m.coefs.forEach((c, j) => { rel(c.b, REF[k + '_b'][j], 1e-7, fam + ' b'); rel(c.se, REF[k + '_se'][j], 1e-7, fam + ' se'); rel(r.coefs[j].se, REF[k + '_rse'][j], 1e-7, fam + ' robust se'); });
  }
});

test('ordered logit: pesos, x10, timestamps and rates of 0.001 converge to R’s estimates and standard errors', () => {
  for (const v of ['inc', 'inc3', 'inc10', 'stamp']) {
    const m = E.ologit(Y('o'), [num(v), num('x2')], null, null), b = [...m.coefs, ...m.cuts];
    assert.ok(m.converged, v + ' converged');
    b.forEach((c, j) => { rel(c.b, REF['ol_' + v + '_b'][j], 2e-6, v + ' b' + j); rel(c.se, REF['ol_' + v + '_se'][j], 2e-5, v + ' se' + j); });
  }
  const m = E.ologit(Y('o'), [num('rate'), num('x2'), cat('grupo', ['A', 'B', 'C'])], null, null);
  assert.ok(m.converged, 'a rate of 0.001 is not flagged as non-convergence or separation');
  [...m.coefs, ...m.cuts].forEach((c, j) => { rel(c.b, REF.ol_rate_b[j], 2e-6, 'rate b' + j); rel(c.se, REF.ol_rate_se[j], 2e-5, 'rate se' + j); });
});

test('margins use the model’s variance: robust bands differ from classical ones and match the delta method', () => {
  const vars = [num('x2'), cat('grupo', ['A', 'B', 'C'])], V = REF.mg_V, Vc = REF.mg_cls, b = REF.mg_b, sh = REF.mg_share;
  const se = (M, g) => { const x = [1, g, sh[0], sh[1]]; let s = 0; for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) s += x[r] * M[r * 4 + q] * x[q]; return Math.sqrt(s); };
  for (const [vce, M] of [[{ type: 'robust' }, V], [null, Vc]]) {
    const mg = E.margins({ family: 'ols', y: Y('y'), w: null, vars, ix: [], focus: 0, by: -1, at: 'avg', cat: -1, alpha: 0.05, vce });
    assert.ok(!mg.error, mg.error);
    for (const p of mg.series[0].pts) { rel(p.y, b[0] + b[1] * p.x + b[2] * sh[0] + b[3] * sh[1], 1e-9, 'margin'); rel(p.se, se(M, p.x), 1e-8, (vce ? 'robust' : 'classical') + ' margin se'); }
  }
});

test('the regression page: modeled value, exported code, weights, display, wording and stars', async () => {
  const c = await load();
  // the same yes/no outcome as 0/1, 1/2 and "no"/"sí": the page models 1, 2 and "sí" (as R and a Stata recode do)
  for (const y of ['e', 'e12', 'esi']) {
    const out = fit(c, { depVar: y, predictors: ['inc', 'x2', 'tiny'], regModel: 'logistic', regIx: [], regVce: 'classical', weightVar: '', treat: {} });
    assert.ok(!out.hasRegError, out.regError);
    const d = c.descFor(), st = c.cmdText(d, 'stata'), r = c.cmdText(d, 'r');
    assert.match(out.regNotes, y === 'e' ? /P\(E = "1"\)/ : y === 'e12' ? /P\(E12 = "2"\)/ : /P\(ESI = "sí"\)/);
    if (y === 'e12') { assert.match(st, /generate byte e12_1 = \(e12 == 2\) if !missing\(e12\)\nlogit e12_1 inc x2 tiny/); assert.match(r, /glm\(I\(e12 == 2\) ~ inc \+ x2 \+ tiny, family = binomial/); }
    if (y === 'esi') { assert.match(st, /generate byte esi_1 = \(esi == "sí"\) if !missing\(esi\)\nlogit esi_1 /); assert.match(r, /glm\(I\(esi == "sí"\) ~ /); }
    if (y === 'e') { assert.doesNotMatch(st, /generate/); assert.match(r, /glm\(e ~ inc/); }
  }
  // small coefficients keep their digits; the text describes income per +10,000
  let out = fit(c, { depVar: 'y', predictors: ['inc', 'x2'], regModel: 'ols', weightVar: '' });
  const inc = out.coefRows.find(x => x.raw === 'inc');
  assert.match(inc.b, /^0\.0000396\*\*\*$/); assert.match(inc.se, /^0\.00000291$/); assert.doesNotMatch(inc.ci, /0\.000[,\]]/);
  assert.match(out.regInterp, /inc \(\+, b = 0\.00004, i\.e\. 0\.396 per \+10,000/);
  out = fit(c, { depVar: 'cnt', predictors: ['inc', 'x2'], regModel: 'poisson' });
  assert.match(out.regInterp, /inc \(IRR 1\.\d\d per \+[\d,]+ — each \+[\d,]+ multiplies the expected count/);
  assert.match(out.coefRows.find(x => x.raw === 'inc').beta, /^1\.00000\d+$/, 'the IRR keeps its digits');
  // categories are compared with the reference category
  out = fit(c, { depVar: 'e', predictors: ['grupo', 'x2'], regModel: 'logistic', treat: { grupo: 'categorical' } });
  assert.match(out.regInterp, /grupo = C \(OR \d\.\d\d — the odds are \d\.\d\d× those of grupo = A\)/); assert.doesNotMatch(out.regInterp, /grupo = C \(OR [^)]*each \+1/);
  out = fit(c, { depVar: 'y', predictors: ['grupo', 'x2'], regModel: 'ols' });
  assert.match(out.regInterp, /grupo = C \(\+, b = [\d.]+ compared with grupo = A/); assert.match(out.regInterp, /for a category, b is the difference from its reference category/);
  // an interaction: main effects hold at the reference, the interaction is the change in the effect
  out = fit(c, { depVar: 'y', predictors: ['x2', 'sexo', 'grupo'], regModel: 'ols', regIx: [['x2', 'sexo']], treat: { grupo: 'categorical', sexo: 'categorical' } });
  assert.match(out.regInterp, /x2 \(\+, b = [\d.]+, when sexo = Hombre\)/); assert.match(out.regInterp, /how much the effect of x2 changes when sexo = Mujer/); assert.doesNotMatch(out.regInterp, /β =/);
  // stars: one convention (APA by default), switchable in Settings
  assert.match(out.regNotes, /\* p < \.05  \*\* p < \.01  \*\*\* p < \.001/);
  out = fit(c, { starSet: 'econ', regIx: [] }); assert.match(out.regNotes, /\* p < \.10  \*\* p < \.05  \*\*\* p < \.01/);
  assert.equal(c.starsOf(0.07), '*'); c.setState({ starSet: 'apa' }); assert.equal(c.starsOf(0.07), ''); assert.equal(c.starsOf(0.0005), '***');
  // a collinear pair is an error on the page, naming the variable
  out = fit(c, { depVar: 'y', predictors: ['inc', 'inc_k', 'x2'], regModel: 'ols', treat: {} });
  assert.ok(out.hasRegError); assert.match(out.regError, /“inc_k” is a combination of the other predictors/);
});

test('console weights follow Stata: [pw=] robust, [aweight=] ordinary, wrong weight types refused', async () => {
  const run = async cmd => { const c = await load(); c.state.tab = 'one'; c.runCmdLine(cmd); clearTimeout(c._mfOkT); return c; };
  let c = await run('regress y x2 inc_k [pw=w]');
  assert.equal(c.state.mfCmdErr, ''); assert.equal(c.state.regVce, 'robust');
  let out = fit(c, {}); out.coefRows.forEach(r => { const j = ['_cons', 'x2', 'inc_k'].indexOf(r.term); assert.ok(Math.abs(Number(r.se) - REF.pw_se[j]) <= 0.0005, 'shown pw se ' + r.se + ' vs ' + REF.pw_se[j]); });
  assert.match(c.cmdText(c.descFor(), 'stata'), /^regress y x2 inc_k \[pw=w\], vce\(robust\)$/);
  c = await run('regress y x2 inc_k [pweight=w]'); assert.equal(c.state.mfCmdErr, ''); assert.equal(c.state.regVce, 'robust');
  c = await run('regress y x2 inc_k [aweight=w]'); assert.equal(c.state.regVce, 'classical'); fit(c, {}); assert.match(c.cmdText(c.descFor(), 'stata'), /\[aw=w\]$/);
  c = await run('logit e x2 [iw=w]'); assert.equal(c.state.mfCmdErr, ''); fit(c, {}); assert.match(c.cmdText(c.descFor(), 'stata'), /^logit e x2 \[iw=w\]$/);
  for (const bad of ['logit e x2 [aw=w]', 'regress y x2 [fw=w]', 'regress y x2 [iw=w]']) { c = await run(bad); assert.notEqual(c.state.mfCmdErr, '', bad); }
});

test('earlier fixes: one-sided t-test after a swap, ttest options, weighted correlation, default variables, imputation code, big means', async () => {
  // swap (Mujer minus Hombre) and "first > second": R's order is Hombre minus Mujer, so its alternative is "less"
  const c = await load(); c.setState({ tab: 'ttest', ttMode: 'groups', exploreVar: 'y', ttG: 'sexo', ttSwap: true, ttAlt: 'gt', alphaSel: '' }); c.clearMemo(); c.renderVals();
  const D = c.cmData(), r = c.cmResult(D);
  assert.deepEqual(D.labels, ['Mujer', 'Hombre']); rel(r.p, REF.tt_less_p[0], 1e-9, 'one-sided p'); rel(r.t, -REF.tt_t[0], 1e-9, 't');
  assert.match(c._ttLast.r, /alternative = "less"\)/);
  c.state.tab = 'one'; c.runCmdLine('ttest y, by(sexo) foo(3)'); clearTimeout(c._mfOkT); assert.match(c.state.mfCmdErr, /option foo\(\) not allowed/);
  // weighted correlation: the page's r and rho equal R's cov.wt on the values and on the ranks; the commands say so
  const k = await load(); k.setState({ tab: 'corr', corVars: ['y', 'inc', 'x2'], weightVar: 'w' }); k.clearMemo(); k.renderVals();
  for (const sp of [false, true]) {
    k.setState({ corMethod: sp ? 'spearman' : 'pearson' }); k.clearMemo(); k.renderVals();
    const M = k.corCompute(['y', 'inc', 'x2']); rel(M.cells[1][0].r, REF[(sp ? 'wsp_' : 'wcor_') + 'inc'][0], 1e-10, 'weighted r'); rel(M.cells[2][0].r, REF[(sp ? 'wsp_' : 'wcor_') + 'x2'][0], 1e-10, 'weighted r x2');
    const d = k.corDesc(); assert.match(d.r, sp ? /cov\.wt\(cbind\(rank\(df\[\[i\]\]\[ok\]\), rank/ : /cov\.wt\(cbind\(df\[\[i\]\]\[ok\]/);
    if (sp) { assert.match(d.stata, /egen _ra = rank\(`a'\) if !missing\(`a', `b', w\)/); assert.match(d.stata, /pwcorr _ra _rb \[aw=w\], sig obs/); } else assert.match(d.stata, /^pwcorr y inc x2@IF@ \[aw=w\], sig obs$/);
  }
  // default variables: continuous measures whose values never repeat are kept; an integer identifier is left out
  const L = ['id,height,weight,age,yes']; for (let i = 0; i < 40; i++) L.push([i + 1, (150 + i * 0.731 + (i % 7) * 0.0137).toFixed(4), (60 + i * 0.517 - (i % 5) * 0.0219).toFixed(4), 20 + (i * 7) % 33, i % 2].join(','));
  const q = await load(L.join('\n')); q.setState({ tab: 'corr' }); assert.deepEqual(q.corVarsNow(), ['height', 'weight', 'age']);
  // imputation: a text yes/no outcome becomes 0/1 before Stata's logit; encode has its comma
  const m = await load(['empl,inc,educ,age', ...Array.from({ length: 60 }, (_, i) => [i % 7 === 0 ? '' : i % 3 ? 'yes' : 'no', i % 5 === 0 ? '' : 20 + i, i % 11 === 0 ? '' : ['prim', 'sec', 'univ'][i % 3], 20 + i % 40].join(','))].join('\n'));
  const info = m.asCatalog().find(x => x.id === 'impute'), pk = m.asPacket(info, { fields: { y: ['empl'], predictors: ['inc', 'educ', 'age'] }, options: { family: 'binomial' } }), cm = m.asCommands(info, pk), st = cm.stata ?? cm[0];
  assert.match(st, /generate byte empl_c = \(empl == "yes"\) if !missing\(empl\)/); assert.match(st, /encode educ, generate\(educ_c\)/); assert.match(st, /mi estimate: logit empl_c /);
  // a mean of values near 1e9 is exact to the last digit
  const big = Float64Array.from([1e9 + 0.1, 1e9 + 0.2, 1e9 + 0.3, 1e9 + 0.4, 1e9 + 0.7]);
  rel(E.descNum(big, null).mean - 1e9, 0.34, 1e-6, 'mean near 1e9');
});

// ---- build .65: the Regression steps and margins with chosen values
const gen = r => { if (r && typeof r.next === 'function') { let x; do { x = r.next(); } while (!x.done); return x.value; } return r; };
const grp = cat('grupo', ['A', 'B', 'C']), sex = cat('sexo', ['Hombre', 'Mujer']);
test('margins at chosen values and average marginal effects match the delta method in R', () => {
  const w = null, logit = { family: 'logistic', y: Y('e'), w, vars: [num('x2'), grp, num('inc_k'), sex], ix: [], alpha: 0.05 };
  let mg = gen(E.marginsGen({ ...logit, focus: 0, by: 3, at: 'avg', cat: -1, grid: [-2, -1, 0, 1, 2], byVals: ['Hombre', 'Mujer'] }));
  mg.series.flatMap(s => s.pts).forEach((p, k) => { rel(p.y, REF.mgl_y[k], 1e-8, 'margin'); rel(p.se, REF.mgl_se[k], 1e-6, 'margin se'); });
  assert.equal(mg.df, 0); rel(mg.series[0].pts[0].hi - mg.series[0].pts[0].y, 1.959963985 * mg.series[0].pts[0].se, 1e-6, 'z interval after logit');
  const ame = gen(E.marginsGen({ ...logit, ame: true })).ame;
  assert.deepEqual(ame.map(a => a.level ? a.name + '=' + a.level : a.name), ['x2', 'grupo=B', 'grupo=C', 'inc_k', 'sexo=Mujer']);
  ame.forEach((a, k) => { rel(a.est, REF.amel[k], 1e-6, 'AME ' + a.name); rel(a.se, REF.amel_se[k], 1e-5, 'AME se ' + a.name); });
  mg = gen(E.marginsGen({ ...logit, focus: 0, by: -1, at: 'means', cat: -1, grid: [-2, -1, 0, 1, 2] }));
  mg.series[0].pts.forEach((p, k) => { rel(p.y, REF.mgm_y[k], 1e-8, 'atmeans'); rel(p.se, REF.mgm_se[k], 1e-6, 'atmeans se'); });
  mg = gen(E.marginsGen({ family: 'logistic', y: Y('e'), w, vars: [num('x2'), num('inc_k')], ix: [], alpha: 0.05, focus: 0, by: 1, at: 'avg', cat: -1, grid: [-1, 0, 1], byVals: [50, 120] }));
  mg.series.flatMap(s => s.pts).forEach((p, k) => { rel(p.y, REF.mgn_y[k], 1e-8, 'lines at numeric values'); rel(p.se, REF.mgn_se[k], 1e-6, 'se'); });
  const ap = gen(E.marginsGen({ family: 'poisson', y: Y('cnt'), w, vars: [num('x2'), num('inc_k')], ix: [], alpha: 0.05, ame: true })).ame[0];
  rel(ap.est, REF.amep[0], 1e-6, 'Poisson AME'); rel(ap.se, REF.amep[1], 1e-5, 'Poisson AME se');
  // linear regression: t with the residual degrees of freedom, as Stata's margins after regress
  const m4 = E.regress(Y('y'), [num('x2'), grp], null, null);
  mg = gen(E.marginsGen({ family: 'ols', y: Y('y'), w, vars: [num('x2'), grp], ix: [], alpha: 0.05, focus: 0, by: -1, at: 'avg', cat: -1, grid: [-2, 0, 2], df: m4.dfT }));
  mg.series[0].pts.forEach((p, k) => { const r = REF.mgo.slice(4 * k, 4 * k + 4); rel(p.y, r[0], 1e-10, 'ols margin'); rel(p.se, r[1], 1e-8, 'ols se'); rel(p.lo, r[2], 1e-8, 't lower'); rel(p.hi, r[3], 1e-8, 't upper'); });
  // ordered logit: Pr(o = 4)
  mg = gen(E.marginsGen({ family: 'ologit', y: Y('o'), w, vars: [num('x2'), num('inc_k')], ix: [], alpha: 0.05, focus: 0, by: -1, at: 'avg', cat: 3, grid: [-2, 0, 2] }));
  mg.series[0].pts.forEach((p, k) => { rel(p.y, REF.mgo4_y[k], 1e-6, 'ologit Pr(4)'); rel(p.se, REF.mgo4_se[k], 2e-4, 'ologit se'); });
});

test('the Regression steps: outcome detection, model choice, panels by step, margins with chosen values, commands', async () => {
  const c = await load(), seenJobs = {}; c.jobMemo = (key, fn) => { const spec = fn(); return (seenJobs[key] = gen(E[spec.__work](...spec.args))); };
  const T = { grupo: 'categorical', sexo: 'categorical' };
  assert.equal(c.rgDetect('e').type, 'bin'); assert.equal(c.rgDetect('esi').type, 'bin'); assert.equal(c.rgDetect('o').type, 'ord'); assert.equal(c.rgDetect('cnt').type, 'count'); assert.equal(c.rgDetect('y').type, 'num'); assert.equal(c.rgDetect('grupo').type, 'cat');
  c.rgPickOutcome('cnt'); assert.equal(c.state.regModel, 'poisson'); c.rgPickModel('negbin'); assert.equal(c.state.rgModel, 'negbin'); assert.equal(c.rgNow().extra, 'negbin');
  // build .70: a model chosen first stays when the outcome changes, with the model that fits as a hint
  c.rgPickOutcome('e'); assert.equal(c.rgNow().model, 'negbin', 'a model chosen first stays');
  assert.match(text(c.rgStep1(c.rgNow())), /Negative binomial regression is for 0, 1, 2 …; Logistic regression \(logit\) fits e/);
  c.rgPickModel('logistic'); assert.equal(c.state.regModel, 'logistic'); assert.equal(c.state.rgModel, '');
  c.setState({ rgModelPicked: false }); c.rgPickOutcome('cnt'); assert.equal(c.state.regModel, 'poisson', 'no model chosen yet: the one that fits');
  c.rgPickOutcome('e'); assert.equal(c.state.regModel, 'logistic'); assert.equal(c.state.rgModel, '');
  assert.match(text(c.rgStep1(c.rgNow())), /Linear models.*Binary outcomes.*Ordinal outcomes.*Categorical outcomes.*Count outcomes/);
  assert.match(text(c.rgStep1(c.rgNow())), /Ordered logistic regressionologit/);
  const base = { depVar: 'e', predictors: ['x2', 'grupo', 'inc_k', 'sexo'], regModel: 'logistic', rgModel: '', treat: T };
  const flags = out => ['rgSetup', 'rgFit', 'rgPub', 'rgVifShow', 'rgHasModel', 'rgHasCoefPlot'].filter(k => out[k]).join(',');
  const seen = {}; for (let st = 1; st <= 8; st++) { const out = fit(c, { ...base, rgStep: st }); seen[st] = flags(out); assert.ok(out.rgEl, 'step ' + st); assert.ok(out.hasModel, 'the page’s own flag is untouched'); }
  assert.equal(seen[3], 'rgSetup'); assert.equal(seen[5], 'rgFit,rgHasModel,rgHasCoefPlot'); assert.equal(seen[6], 'rgVifShow,rgHasModel'); assert.equal(seen[8], 'rgPub,rgHasModel'); assert.equal(seen[1], '');
  // step 7: x2 from -2 to 2 every 1, one line per sexo — the table equals R's margins
  let out = fit(c, { ...base, rgStep: 7, rgMg: { x: 'x2', by: 'sexo', from: '-2', to: '2', every: '1', mode: 'step' }, rgPlot: { title: 'Chance by x2', ymin: '0', ymax: '1', ystep: '.2', xstep: '1' } });
  const t = text([out.rgEl, out.rgEl3]);
  assert.match(t, /margins sexo_c, at\(x2=\(-2\(1\)2\)\)/); assert.match(t, /marginsplot, recastci\(rarea\)[^\n]*ylabel\(0\(\.2\)1\) xlabel\(-2\(1\)2\) title\("Chance by x2"\)/);
  assert.match(t, /avg_predictions\(m, variables = list\(x2 = seq\(-2, 2, by = 1\), sexo = c\("Hombre", "Mujer"\)\)\)/);
  const rows = c._rgMgCmd && t.match(/The margins table · 10 rows/); assert.ok(rows, 'ten rows (5 values × 2 lines)');
  const mgKey = Object.keys(seenJobs).find(k => k.startsWith('rgmg|') && k.includes('[-2,-1,0,1,2]')); const mg = seenJobs[mgKey];
  mg.series.flatMap(s => s.pts).forEach((p, k) => rel(p.y, REF.mgl_y[k], 1e-8, 'page margins'));
  // the quick choices: every 2 / percentiles / typed values
  assert.deepEqual(c.rgGrid('x2', { mode: 'step', from: '20', to: '80', every: '5' }, Float64Array.from([18, 90])).vals, [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
  assert.equal(c.rgGrid('x2', { mode: 'step', from: '20', to: '80', every: '5' }, Float64Array.from([18, 90])).txt, '20(5)80');
  assert.deepEqual(c.rgGrid('x2', { mode: 'list', list: '20, 35 50' }, Float64Array.from([18, 90])).vals, [20, 35, 50]);
  // step 5: average marginal effects in percentage points
  out = fit(c, { ...base, rgStep: 5 }); assert.match(text([out.rgEl, out.rgEl3]), /each \+1 of x2\+9\.94 pts/); assert.match(text([out.rgEl, out.rgEl3]), /THE MODEL EXPLAINS SOMETHING/);
  // step 6: checks; a count outcome with overdispersion offers negative binomial
  out = fit(c, { depVar: 'cnt', predictors: ['x2', 'inc_k'], regModel: 'poisson', rgModel: '', treat: {}, rgStep: 6 }); const t6 = text([out.rgEl, out.rgEl3]);
  assert.match(t6, /Enough cases/); assert.match(t6, /Pearson χ² \/ df = /);
  // the console runs a model and opens step 5
  c.state.tab = 'one'; c.runCmdLine('regress y x2 i.grupo'); clearTimeout(c._mfOkT); assert.equal(c.state.rgStep, 5); assert.equal(c.state.tab, 'reg');
});
