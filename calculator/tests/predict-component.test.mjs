// Predict tab (build .99) on the shipped bundle: node --test calculator/tests/predict-component.test.mjs
// The six steps on tests/data/predict-sim.csv with a stubbed React: outcome coding, leakage flag, the split cards, the
// inline run (no Worker in node), the leaderboard with the null model first, the locked test set, the test-set charts,
// importance / partial dependence / by-group, saving predictions, the model card and the R / Stata code.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import zlib from 'node:zlib';
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
const find = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => find(x, pred, out)); return out; } if (pred(n)) out.push(n); find(n.children, pred, out); return out; };
const btn = (t, re) => find(t, n => n.tag === 'button' && re.test(text(n)))[0];
async function make() {
  // the simulated survey, plus a near-copy of the outcome (leak) and value labels for sexo
  const b = fs.readFileSync(new URL('./data/predict-sim.csv', import.meta.url)), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
  const yi = raw.names.indexOf('y'), leak = new Float64Array(raw.n); for (let i = 0; i < raw.n; i++) leak[i] = raw.cols[yi].a[i] === 1 ? (i % 20 ? 1 : 2) : (i % 20 ? 2 : 1);
  raw.names.push('y_copy'); raw.labels.push('almost the outcome'); raw.cols.push({ k: 'n', a: leak });
  raw.vlabs = Object.assign({}, raw.vlabs, { sexo: new Map([[1, 'Hombre'], [2, 'Mujer']]), y: new Map([[0, 'No'], [1, 'Sí']]), y_copy: new Map([[1, 'a'], [2, 'b']]) });
  const c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = t => { c.message = t; }; c.pushLog = () => {}; c.stataLog = () => {};
  c.state = { ...c.state, screen: 'work', tab: 'predict', fileName: 'sim.csv', nRows: raw.n, cols: raw.names.map((_, i) => Object.assign(E.profileCol(raw, i, true), { idx: i })), autoScreen: true, genTags: {}, treat: {}, weightVar: 'w' };
  return c;
}
const render = c => c.renderVals().prEl;

test('Predict: the six steps on a yes / no outcome, inline run, locked test set, saving', async () => {
  const c = await make();
  let t = render(c); assert.match(text(t), /1 · What to predict/); assert.match(text(t), /Pick the outcome/);
  c.state.pr = { y: 'y', preds: ['sexo', 'edad', 'conf', 'ent', 'year', 'y_copy'] }; t = render(c); const s = text(t);
  assert.match(s, /Yes \/ no · 38\.\d% Sí among 1,200 rows/); assert.match(s, /The answer/); assert.match(s, /Possible leakage/); assert.match(s, /y_copy/);
  btn(t, /^Leave it out$/).props.onClick(); t = render(c); assert.ok(!c.state.pr.preds.includes('y_copy'), 'the leak is dropped'); assert.doesNotMatch(text(t), /Possible leakage/);
  c.state.pr = { ...c.state.pr, step: 'split' }; t = render(c); assert.match(text(t), /Training set · 960 rows/); assert.match(text(t), /Test set · 240 rows · locked/); assert.match(text(t), /Use w/);
  c.state.pr = { ...c.state.pr, step: 'models', models: ['logit', 'tree', 'knn'], groupBy: 'sexo' }; t = render(c); assert.match(text(t), /Run 3 models/); assert.match(text(t), /Logit \(baseline\)/);
  await c.prStart(); assert.equal(c._pr.status, 'done', c._pr.err); assert.equal(c.prS().step, 'evaluate');
  const R = c._pr.out; assert.deepEqual(R.results.map(r => r.kind), ['null', 'logit', 'tree', 'knn']); assert.equal(R.nTrain, 960); assert.equal(R.nTest, 240);
  t = render(c); const ev = text(t); assert.match(ev, /null model.*0\.500 \(by definition\)/); assert.match(ev, /best by AUC/); assert.match(ev, /Reading:\s+The/); assert.match(ev, /Reveal the test set/); assert.equal(find(t, n => n.tag === 'svg').length, 0, 'nothing from the test set before it is opened');
  btn(t, /Reveal the test set/).props.onClick(); t = render(c); assert.deepEqual(find(t, n => n.tag === 'svg').map(n => n.props['aria-label']), ['ROC curve', 'Calibration', 'Confusion matrix']); assert.match(text(t), /AUC\s+0\.\d+\s+\[0\.\d+, 0\.\d+\]\s*bootstrap/); assert.match(text(t), /Test set open/);
  // threshold slider: the confusion matrix follows it
  const m0 = text(t).match(/Sensitivity (0\.\d+)/)[1]; c.state.pr = { ...c.state.pr, thr: 0.8 }; t = render(c); const m1 = text(t).match(/Sensitivity (0\.\d+)/)[1]; assert.ok(+m1 < +m0, 'a higher threshold lowers sensitivity: ' + m0 + ' → ' + m1);
  c.state.pr = { ...c.state.pr, step: 'interpret', thr: null }; t = render(c); const it = text(t);
  assert.match(it, /Permutation importance/); assert.match(it, /Partial dependence on/); assert.match(it, /not what causes the outcome/); assert.match(it, /Hombre/); assert.match(it, /Mujer/);
  c.state.pr = { ...c.state.pr, pdpVar: 'edad', pdpBy: 'sexo' }; t = render(c); assert.ok(find(t, n => n.tag === 'svg' && /Partial dependence on edad by sexo/.test(n.props['aria-label'])).length === 1);
  c.state.pr = { ...c.state.pr, step: 'use' }; t = render(c); assert.match(text(t), /MODEL CARD · classification of y = Sí/); assert.match(text(t), /Test set, opened once: AUC/); assert.match(text(t), /Not for: causal claims/);
  const n0 = c._raw.names.length; btn(t, /^Add the variables$/).props.onClick(); assert.deepEqual(c._raw.names.slice(n0), ['p_y_' + R.best, 'y_' + R.best + '_hat', 'y_fold']);
  const p = c._raw.cols[n0].a, f = c._raw.cols[n0 + 2].a; assert.equal(Array.from(p).filter(isFinite).length, 1200); assert.equal(Array.from(f).filter(v => v === 0).length, 240, '240 rows marked as the test set'); assert.ok(Array.from(p).every(v => !isFinite(v) || (v >= 0 && v <= 1)));
  c.state.pr = { ...c.state.pr, code: true }; t = render(c); const code = text(t); assert.match(code, /cv\.glmnet|glm\(y01 ~ \./); assert.match(code, /splitsample, generate\(sample\)/); assert.match(code, /logit y01 i\.sexo c\.edad/); assert.match(code, /\[pw = w\]/);
  // settings changed → the results are stale until a new run
  c.state.pr = { ...c.state.pr, step: 'evaluate', seed: 7 }; t = render(c); assert.match(text(t), /settings changed since the last run/);
});

test('Predict: a numeric outcome and a split by time', async () => {
  const c = await make();
  c.state.pr = { y: 'ynum', preds: ['sexo', 'edad', 'conf', 'ent'], split: 'time', timeVar: 'year', cut: '2024', models: ['logit', 'tree'], folds: 5 };
  let t = render(c); assert.match(text(t), /A number · 1,200 rows with a value/);
  c.state.pr = { ...c.state.pr, step: 'split' }; t = render(c); assert.match(text(t), /By time/); assert.match(text(t), /2024 onwards/);
  await c.prStart(); assert.equal(c._pr.status, 'done', c._pr.err); const R = c._pr.out; assert.equal(R.metric, 'rmse'); assert.ok(R.results[1].label.startsWith('Linear regression')); assert.ok(R.results[1].test.r2 > 0.3);
  t = render(c); assert.match(text(t), /CV RMSE ± sd/); btn(t, /Reveal the test set/).props.onClick(); t = render(c); assert.match(text(t), /RMSE \d/); assert.ok(find(t, n => n.tag === 'svg' && n.props['aria-label'] === 'Predicted against observed').length === 1);
  c.state.pr = { ...c.state.pr, step: 'use' }; t = render(c); assert.match(text(t), /MODEL CARD · regression of ynum/); assert.match(text(t), /by time, test = year ≥ 2024/);
});
