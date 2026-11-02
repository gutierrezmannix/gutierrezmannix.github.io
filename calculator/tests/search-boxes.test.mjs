// Search boxes and rows that do not overlap (build .70): node --test calculator/tests/search-boxes.test.mjs
// - Every variable box ranks the exact name first, then names and labels that start with what was typed, so Enter
//   picks the row shown at the top; accents are ignored ("anos" finds "Años").
// - Variables with data in only part of the rows say how many (LAPOP: a question asked in one year only).
// - Regression: when the outcome, predictors and weight share no rows, the page names the variables and the years
//   each one covers, on the Predictors step and in place of the engine's message; it stays quiet when nothing is lost.
// The browser side is tests/regression-e2e.cjs and tests/chart-builder-e2e.cjs (pickBy in tests/e2e-pick.cjs).
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
const find = (el, pred, out = []) => { if (el && typeof el === 'object') { if (Array.isArray(el)) el.forEach(x => find(x, pred, out)); else { if (pred(el)) out.push(el); (el.children || []).forEach(x => find(x, pred, out)); } } return out; };

// four survey years; q1 and ed asked in 2004–2006, edad only in 2025, y in every year
let csv = 'year,y,q1,ed,q2,edad,wt\n';
for (const yr of [2004, 2006, 2021, 2025]) for (let i = 0; i < 40; i++) {
  const early = yr <= 2006, late = yr === 2025, age = 20 + ((i * 7) % 50);
  csv += [yr, 1 + (i % 5), early ? 1 + (i % 2) : '', early ? 6 + (i % 12) : '', early ? age : '', late ? age : '', 1 + (i % 3) / 2].join(',') + '\n';
}
const load = async () => {
  const b = Buffer.from(csv), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}), c = new C();
  c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
  c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  const cols = raw.names.map((_, i) => E.profileCol(raw, i)), L = { q1: 'Género', ed: 'Años de educación', q2: 'Edad', edad: 'Edad', wt: 'Factor de expansión', y: 'Satisfacción' };
  cols.forEach(m => { if (L[m.name]) m.label = L[m.name]; });
  c.state = { ...c.state, screen: 'work', tab: 'reg', nRows: raw.n, cols, autoScreen: false };
  return c;
};

test('a variable box ranks the exact name first, ignores accents and counts the rows of partial variables', async () => {
  const c = await load(), opts = c.state.cols.map(m => [m.name, m.name]);
  c.state.tlCombo = { id: 'Predictor', q: 'edad', hi: 0 };
  let el = c.tlSelect('', opts, () => {}, 'Predictor', { combo: true });
  let rows = find(el, e => e.props && e.props.role === 'option');
  assert.deepEqual(rows.map(r => r.props['data-value']), ['edad', 'q2'], 'edad (the name) before q2 (labelled Edad)');
  assert.match(text(rows[0]), /^edadEdad40 rows$/, 'edad has data in 40 of 160 rows');
  assert.match(text(rows[1]), /^q2Edad80 rows$/);
  c.state.tlCombo = { id: 'Predictor', q: 'anos de educacion', hi: 0 };
  rows = find(c.tlSelect('', opts, () => {}, 'Predictor', { combo: true }), e => e.props && e.props.role === 'option');
  assert.deepEqual(rows.map(r => r.props['data-value']), ['ed'], 'accents ignored');
  c.state.tlCombo = { id: 'Predictor', q: 'y', hi: 0 };
  rows = find(c.tlSelect('', opts, () => {}, 'Predictor', { combo: true }), e => e.props && e.props.role === 'option');
  assert.equal(rows[0].props['data-value'], 'y'); assert.doesNotMatch(text(rows[0]), /rows/, 'a variable with data in every row has no count');
});

test('the predictor picker lists the exact name first, so Enter picks the row shown at the top', async () => {
  const c = await load(); c.setState({ depVar: 'y', predictors: [], regModel: 'ols', rgStep: 3, pk: 'rx', pq: 'edad' });
  let out = c.renderVals();
  assert.deepEqual(out.rxPk.rows.slice(0, 2).map(r => r.name), ['edad', 'q2']);
  assert.match(out.rxPk.rows[0].sub, /^Edad · 40 rows$/);
  out.rxPk.key({ key: 'Enter', preventDefault() {}, target: {} });
  assert.deepEqual(c.state.predictors, ['edad']);
  c.setState({ pk: 'rx', pq: 'genero' }); out = c.renderVals(); out.rxPk.key({ key: 'Enter', preventDefault() {}, target: {} });
  assert.deepEqual(c.state.predictors, ['edad', 'q1'], 'no exact name: Enter takes the first match (q1, labelled Género)');
});

test('rows that do not overlap: the Predictors step and the results name the variables and their years', async () => {
  const c = await load(), fit = st => { c.setState(st); c.clearMemo(); c._regRan = c.regSpec(); return c.renderVals(); };
  let out = fit({ depVar: 'y', predictors: ['q1', 'edad'], weightVar: 'wt', regModel: 'ols', rgStep: 3 });
  const want = /^No row has data on all of y, q1, edad and wt\. edad is only in year 2025 \(40 rows\); q1 is in year 2004–2006 \(80 rows\)\. Remove one of them, or use a variable asked in the same years\.$/;
  assert.match(text(out.rgEl2).split('Predictions to show')[0], want);
  for (const regModel of ['ols', 'ologit', 'poisson']) { out = fit({ depVar: 'y', predictors: ['q1', 'edad'], weightVar: 'wt', regModel, rgStep: 5 }); assert.match(out.regError, want, regModel); }
  out = fit({ depVar: 'y', predictors: ['edad'], weightVar: '', regModel: 'ols', rgStep: 3 });
  assert.match(text(out.rgEl2), /^Only 40 of the 160 rows with y have data on every variable of the model\. edad is only in year 2025 \(40 rows\)\./);
  out = fit({ depVar: 'y', predictors: ['q1', 'ed'], weightVar: 'wt', regModel: 'ols', rgStep: 5 });
  assert.ok(!out.regError, 'q1 and ed overlap: the model runs'); assert.match(text(out.rgEl), /80 rows used of 160/);
  out = fit({ depVar: 'y', predictors: ['q1', 'ed'], weightVar: 'wt', regModel: 'ols', rgStep: 3 });
  assert.doesNotMatch(text(out.rgEl2), /rows with y|No row/, 'no note when half or more of the rows are used');
});

test('margins: the lines-by box keeps its "none" choice', async () => {
  const c = await load(); c.setState({ depVar: 'y', predictors: ['q1', 'ed'], regModel: 'ols', rgStep: 3 }); const out = c.renderVals();
  const boxes = find(out.rgEl2, e => e.props && e.props.role === 'combobox' && e.props['aria-label'] === 'Margins lines by');
  assert.equal(boxes.length, 1); assert.equal(boxes[0].props.placeholder, 'none');
});
