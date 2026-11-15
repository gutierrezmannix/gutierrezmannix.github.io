// Predict engine (build .99) against R: node --test calculator/tests/predict.test.mjs
// tests/data/predict-sim.csv and predict-reference.json are written by tests/predict-reference.R (glmnet, rpart, ranger,
// class, pROC). The engine is imported from its source so the checks do not need a build.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import * as P from '../src/predict-engine.mjs';
const R = JSON.parse(fs.readFileSync(new URL('./data/predict-reference.json', import.meta.url), 'utf8'));
const csv = fs.readFileSync(new URL('./data/predict-sim.csv', import.meta.url), 'utf8').trim().split('\n').map(l => l.split(','));
const H = csv[0].map(s => s.replace(/"/g, '')), col = name => csv.slice(1).map(r => { const v = r[H.indexOf(name)]; return v === '' || v == null ? NaN : Number(v); });
const N = csv.length - 1, rows = Int32Array.from({ length: N }, (_, i) => i);
const num = name => ({ name, kind: 'num', a: Float64Array.from(col(name)) }), cat = name => ({ name, kind: 'cat', a: col(name).map(v => isFinite(v) ? v : null) });
const vars = [cat('sexo'), num('edad'), cat('conf'), cat('ent'), num('year')];
const D = P.prDesign(vars, rows), y = Float64Array.from(col('y')), ynum = Float64Array.from(col('ynum')), w = Float64Array.from(col('w'));
// R's columns are 'sexo[rows]=2', 'edad', …; the engine's are 'sexo = 2', 'edad', …: align them by name
const rName = s => s.replace('[rows]', '').replace('=', ' = '), order = R.colnames.map(rName).map(nm => { const j = D.feats.findIndex(f => f.name === nm); assert.ok(j >= 0, 'column ' + nm + ' in ' + D.feats.map(f => f.name)); return j; });
const near = (a, b, tol, tag) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), tag + ': ' + a + ' vs R ' + b);

test('the design matches R: dummies against the most frequent level, the median for missing ages', () => {
  assert.equal(D.feats.length, R.colnames.length); assert.deepEqual(D.groups.map(g => g.length), [1, 1, 4, 5, 1]);
  const ed = D.feats.find(f => f.name === 'edad'); assert.equal(ed.miss, 40);
});

test('logit and linear regression: coefficients as R glm / lm (weighted)', () => {
  const m = P.prFitGlm(D.X, y, w, rows, true);
  // the engine fits on standardised columns: back-transform to R's scale
  const raw = j => m.st[j].sd > 0 ? m.beta[j + 1] / m.st[j].sd : 0; let b0 = m.beta[0]; D.X.forEach((_, j) => { b0 -= raw(j) * m.st[j].mean; });
  near(b0, R.glm.coef[0], 1e-5, 'logit intercept'); order.forEach((j, k) => near(raw(j), R.glm.coef[k + 1], 1e-5, 'logit ' + R.colnames[k]));
  const l = P.prFitGlm(D.X, ynum, w, rows, false), rawL = j => l.st[j].sd > 0 ? l.beta[j + 1] / l.st[j].sd : 0; let c0 = l.beta[0]; D.X.forEach((_, j) => { c0 -= rawL(j) * l.st[j].mean; });
  near(c0, R.lm.coef[0], 1e-6, 'lm intercept'); order.forEach((j, k) => near(rawL(j), R.lm.coef[k + 1], 1e-6, 'lm ' + R.colnames[k]));
});

test('lasso: glmnet\'s lambda_max and coefficients along the path (binomial and gaussian, weighted)', () => {
  for (const [key, yy, binary] of [['glmnet_binomial', y, true], ['glmnet_gaussian', ynum, false]]) {
    const ref = R[key], m = P.prFitLasso(D.X, yy, w, rows, binary, { lambdas: ref.lambdas, cv: false, rule: 'min' });
    near(m.path[0], ref.lambda_max, 1e-6, key + ' lambda_max');
    ref.lambdas.forEach((lam, L) => { const f = P.prFitLasso(D.X, yy, w, rows, binary, { lambdas: ref.lambdas.slice(0, L + 1), cv: false, rule: 'min' }); near(f.lambda, lam, 1e-12, 'lambda');
      near(f.beta[0], ref.coef[L][0], binary ? 2e-3 : 1e-4, key + ' λ' + L + ' intercept'); order.forEach((j, k) => near(f.beta[j + 1], ref.coef[L][k + 1], binary ? 2e-3 : 1e-4, key + ' λ' + L + ' ' + R.colnames[k])); });
  }
});

test('decision tree: rpart\'s probabilities and means (CART, no pruning, depth 3, minbucket 10, weights)', () => {
  const t = P.prFitTree(D.X, y, w, rows, true, { maxDepth: 3, minLeaf: 10 }), p = P.prPredict(t, D.X, rows);
  let off = 0; R.rpart.prob.forEach((v, i) => { if (Math.abs(p[i] - v) > 1e-9) off++; }); assert.ok(off <= N * 0.02, 'class tree: ' + off + ' of ' + N + ' rows differ from rpart');
  assert.equal(t.nodes.filter(n => !n.leaf).length, R.rpart.nsplit, 'same number of splits');
  const a = P.prFitTree(D.X, ynum, w, rows, false, { maxDepth: 3, minLeaf: 10 }), q = P.prPredict(a, D.X, rows);
  off = 0; R.rpart_anova.pred.forEach((v, i) => { if (Math.abs(q[i] - v) > 1e-6) off++; }); assert.ok(off <= N * 0.02, 'anova tree: ' + off + ' rows differ from rpart');
});

test('k-nearest neighbours: class::knn probabilities (k = 15, standardised columns)', () => {
  const tr = Int32Array.from(R.knn.train.map(i => i - 1)), te = R.knn.test.map(i => i - 1), m = P.prFitKnn(D.X, y, null, tr, true, { k: 15 }), p = P.prPredict(m, D.X, Int32Array.from(te));
  let same = 0; te.forEach((i, k) => { if (Math.abs(p[k] - R.knn.prob[k]) < 1e-9) same++; }); assert.ok(same >= te.length * 0.95, 'knn: ' + same + ' of ' + te.length + ' match (ties aside)');
});

test('weighted AUC is the weighted Mann–Whitney statistic; unweighted it is pROC\'s', () => {
  const p = Float64Array.from(R.auc.prob); near(P.prAuc(y, p, w, Array.from(rows)), R.auc.weighted, 1e-12, 'weighted'); near(P.prAuc(y, p, null, Array.from(rows)), R.auc.unweighted, 1e-12, 'unweighted');
});

test('random forest: AUC on the same test set within 0.05 of ranger (500 trees, mtry 3, case weights)', () => {
  const tr = Int32Array.from(R.knn.train.map(i => i - 1)), te = Array.from(R.knn.test, i => i - 1), rng = P.prRng(7);
  const g = P.prFitForest(D.X, y, w, tr, true, { trees: 500, mtry: 3, minLeaf: 5 }, rng, null); let r; while (!(r = g.next()).done); const m = r.value;
  const p = new Float64Array(N); const pp = P.prPredict(m, D.X, Int32Array.from(te)); te.forEach((i, k) => { p[i] = pp[k]; });
  const auc = P.prAuc(y, p, null, te); assert.ok(Math.abs(auc - R.ranger.auc) < 0.05, 'forest AUC ' + auc + ' vs ranger ' + R.ranger.auc);
  assert.ok(m.oob.filter(isFinite).length > 800, 'out-of-bag predictions for the training rows');
});

test('the whole run: split, folds, leaderboard, test metrics, importance, partial dependence, groups; a numeric outcome too', () => {
  const spec = { binary: true, split: { kind: 'random', testShare: 0.25 }, folds: 4, models: ['logit', 'lasso', 'tree', 'forest', 'boost', 'knn'], seed: 11, trees: 60, groupBy: col('sexo').map(v => v === 2 ? 'Mujer' : 'Hombre') };
  const g = P.prRun(D, y, w, spec); let r, last = 0, steps = 0; while (!(r = g.next()).done) { assert.ok(r.value.p >= last - 1e-9 && r.value.p <= 1.0001, 'progress goes up'); last = r.value.p; steps++; } const out = r.value;
  assert.ok(steps > 20); assert.equal(out.nTrain + out.nTest, N); assert.ok(Math.abs(out.nTest / N - 0.25) < 0.01, 'a quarter in the test set');
  // stratified: the share of 1s is the same in both halves
  const share = idx => Array.from(idx).reduce((s, i) => s + y[i], 0) / idx.length; assert.ok(Math.abs(share(out.train) - share(out.test)) < 0.02);
  const folds = new Set(Array.from(out.train, i => out.fold[i])); assert.equal(folds.size, 4); assert.ok(Array.from(out.test).every(i => out.fold[i] === -1));
  assert.deepEqual(out.results.map(q => q.kind), ['null', 'logit', 'lasso', 'tree', 'forest', 'boost', 'knn']);
  for (const q of out.results.slice(1)) { assert.ok(q.cv.mean > 0.5 && q.cv.mean < 1, q.kind + ' CV AUC ' + q.cv.mean); assert.ok(isFinite(q.cv.sd)); assert.ok(q.test.auc > 0.5, q.kind + ' test AUC ' + q.test.auc); assert.ok(q.pred.length === N && q.pred.every(v => v >= 0 && v <= 1), q.kind + ' probabilities'); assert.ok(q.model); }
  assert.equal(out.results[0].test.auc, 0.5, 'the null model has AUC 0.5'); assert.ok(out.best); assert.ok(out.thr > 0.3 && out.thr < 0.5, 'threshold = base rate');
  const E = out.extras; assert.ok(E.roc.length > 10 && E.calib.length === 10 && E.ci[0] <= E.ci[1]); assert.equal(E.importance.length, 5); assert.ok(E.importance[0].drop > 0, 'the top variable matters: ' + JSON.stringify(E.importance[0]));
  assert.ok(E.groups.length === 2 && E.groups.every(gq => gq.n >= 20 && isFinite(gq.auc)));
  const best = out.results.find(q => q.kind === out.best), pd = P.prPdp(D, best.model, 1, out.test); assert.ok(pd.numeric && pd.grid.length > 5 && pd.curves[0].pts.length === pd.grid.length && pd.curves[0].ice.length === 60);
  const pd2 = P.prPdp(D, best.model, 0, out.test, { by: spec.groupBy }); assert.equal(pd2.curves.length, 2); assert.deepEqual(pd2.grid.length, 2);
  // the tuned text and the lasso's chosen lambda
  const lasso = out.results.find(q => q.kind === 'lasso'); assert.match(lasso.tuned, /λ = .* \(1-se\) · \d+ of 12 terms kept/); assert.ok(lasso.model.lambda >= lasso.model.lambdaMin);
  // a numeric outcome: RMSE ranking, R²
  const spec2 = { binary: false, split: { kind: 'time', t: col('year'), cut: 2024 }, folds: 3, models: ['logit', 'lasso', 'tree', 'knn'], seed: 3 };
  const g2 = P.prRun(D, ynum, w, spec2); let r2; while (!(r2 = g2.next()).done); const o2 = r2.value;
  assert.ok(Array.from(o2.test).every(i => col('year')[i] === 2024) && o2.nTest > 100, 'time split: 2024 is the test set');
  assert.equal(o2.metric, 'rmse'); for (const q of o2.results.slice(1)) { assert.ok(q.test.rmse > 0 && q.test.r2 > 0.2, q.kind + ' R² ' + q.test.r2); } assert.ok(o2.results[0].test.r2 <= 0.01);
  assert.ok(o2.extras.importance[0].drop > 0 && !o2.extras.roc);
});

test('leakage check: a near-copy of the outcome, an identifier and the weight are flagged', () => {
  const leak = col('y').map(v => v === 1 ? (Math.random() < 0.95 ? 'A' : 'B') : (Math.random() < 0.95 ? 'B' : 'A'));
  const flags = P.prLeakage(vars.concat([{ name: 'copia', kind: 'cat', a: leak }, { name: 'folio', kind: 'cat', a: Array.from(rows, i => 'F' + i) }, { name: 'w', kind: 'num', a: w }]), y, Array.from(rows), true, 'w');
  assert.deepEqual(flags.map(f => f.name).sort(), ['copia', 'folio', 'w']); assert.match(flags.find(f => f.name === 'copia').why, /9\d% agreement/);
});
