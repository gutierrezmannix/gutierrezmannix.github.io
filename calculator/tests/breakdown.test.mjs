// Univariate tab · Break down by groups, on the shipped bundle: node --test calculator/tests/breakdown.test.mjs
// tab / sum of a variable by year and sex, as in Stata: tab ss_dir if sexo == 2 & year == 2018
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

// survey-like data: years 2000-2010 with odd years missing, sex 1/2, ss_dir 0/1 with gaps, a weight
let seed = 7; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const rows = [['year', 'sexo', 'ss_dir', 'factor', 'ingreso']];
for (let i = 0; i < 3000; i++) {
  const year = 2000 + 2 * Math.floor(rnd() * 6), sexo = rnd() < 0.5 ? 1 : 2;
  const p = 0.1 + (year - 2000) * 0.01 + (sexo === 2 ? 0.04 : 0);
  rows.push([String(year), String(sexo), rnd() < 0.02 ? '' : String(rnd() < p ? 1 : 0), String(1 + Math.floor(rnd() * 9)), String(Math.round(1000 + rnd() * 9000))]);
}
const csv = rows.map(r => r.join(',')).join('\n');
const buf = s => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const data = rows.slice(1).map(r => r.map(x => x === '' ? NaN : +x));

async function make() {
  const raw = await E.parseCSV(buf(csv), () => {});
  const c = new Component(); c._E = E; c._raw = raw; c._engineP = Promise.resolve(E); c._svgs = {};
  c.state = { ...c.state, screen: 'work', tab: 'one', exploreVar: 'ss_dir', fileName: 'pobreza.csv', cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, autoScreen: false, genTags: {}, treat: {} };
  c.flash = t => { c.message = t; };
  return c;
}
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
const find = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => find(x, pred, out)); return out; } if (pred(n)) out.push(n); find(n.children, pred, out); return out; };
const expect = (pred, weighted) => { let num = 0, den = 0; for (const [y, s, d, w] of data) if (pred(y, s) && !Number.isNaN(d)) { const wi = weighted ? w : 1; den += wi; num += d === 1 ? wi : 0; } return { pct: 100 * num / den, n: den }; };

test('percent, counts and totals by year and sex match a direct count', async () => {
  const c = await make();
  c.state.ob = { rows: 'year', cols: 'sexo', stat: 'pct', level: '1' };
  const res = c.obCompute('ss_dir', 'year', 'sexo', 'pct', '1', true);
  assert.deepEqual(res.rows.map(r => r.label), Array.from({ length: 11 }, (_, i) => String(2000 + i)), 'every year in the range');
  assert.deepEqual(res.rows.filter(r => r.empty).map(r => r.label), ['2001', '2003', '2005', '2007', '2009']);
  assert.deepEqual(res.cols.map(r => r.label), ['1', '2']);
  const R = res.rows.length, C = res.cols.length;
  res.rows.forEach((r, ri) => res.cols.forEach((s, ci) => {
    const e = expect((y, x) => y === +r.label && x === +s.label), cell = res.grid[ri][ci];
    if (r.empty) assert.equal(cell.n, 0); else { assert.equal(cell.wN, e.n, r.label + '/' + s.label + ' N'); assert.ok(Math.abs(c.obValue(cell, 'pct') - e.pct) < 1e-9, r.label + '/' + s.label + ' %'); }
  }));
  const tot = expect(() => true);
  assert.equal(res.grid[R][C].wN, tot.n, 'grand total N');
  assert.ok(Math.abs(c.obValue(res.grid[R][C], 'pct') - tot.pct) < 1e-9);
  assert.equal(res.dropV, data.filter(r => Number.isNaN(r[2])).length, 'missing ss_dir left out and reported');
  assert.ok(Math.abs(c.obValue(res.grid[0][1], 'mean') - expect((y, x) => y === 2000 && x === 2).pct / 100) < 1e-9, 'mean of a 0/1 variable is the share');

  const tree = c.obRender(), t = text(tree);
  assert.match(t, /Break down by groups/);
  assert.match(t, /5 values of year in the range have no observations/);
  assert.match(t, /table year sexo, statistic\(mean _is\) statistic\(count _is\)/, 'Stata code');
  // the chart is drawn by the chart builder (same look and Customize panel as the Charts tab)
  const svg = find(tree, n => n.tag === 'svg' && n.props.dangerouslySetInnerHTML)[0], mk = svg.props.dangerouslySetInnerHTML.__html;
  const lines = mk.match(/<path d="M[^"]*" fill="none" stroke="[^"]*" stroke-width="[^"]*" stroke-linejoin/g) || [];
  assert.equal(lines.length, 3, 'one line per sex plus the total');
  assert.ok(!/NaN|undefined/.test(mk), 'no NaN in the chart');
  // the line runs through the empty years instead of breaking into dots
  assert.ok(lines.every(l => (l.match(/[ML]/g) || []).length === 6 + 0 || l.split('L').length === 6), 'six even years joined in one line');
  assert.match(mk, />Total</, 'the total line is named at its end');
  const tabs = find(tree, n => n.props && n.props.role === 'tab').map(text);
  assert.deepEqual(tabs, ['Labels', 'Values', 'Colors'], 'Customize this chart sits under it');

  // click a cell: tab ss_dir if year == 2006 & sexo == 2
  const ri = res.rows.findIndex(r => r.label === '2006'), e2006 = expect((y, x) => y === 2006 && x === 2);
  const cells = find(tree, n => n.tag === 'button' && /^ob-cell/.test(n.props.className || ''));
  assert.equal(cells.length, (6 + 1) * 3, 'a button for each filled cell, none for the empty years');
  cells.find(n => text(n).includes(e2006.pct.toFixed(1) + '%')).props.onClick();
  assert.deepEqual(c.state.ob.cell, [ri, 1]);
  const d = text(c.obRender()), e = expect((y, x) => y === 2006 && x === 2);
  assert.match(d, /\. tab ss_dir if year == 2006 & sexo == 2/);
  assert.match(d, new RegExp(e.pct.toFixed(2).replace('.', '\\.')));
  assert.match(d, /summarize ss_dir if year == 2006 & sexo == 2: mean/);
});

test('weights, sums, the full tabulation, R code and the subgroup filter', async () => {
  const c = await make();
  c.state.weightVar = 'factor';
  const res = c.obCompute('ss_dir', 'year', 'sexo', 'pct', '1', false);
  assert.equal(res.rows.length, 6, 'only years with data when the range is not filled');
  const e = expect((y, x) => y === 2010 && x === 1, true), cell = res.grid[5][0];
  assert.ok(Math.abs(cell.wN - e.n) < 1e-6, 'weighted total on the scale of the weights (population)');
  assert.equal(c.obValue(cell, 'n'), data.filter(r => r[0] === 2010 && r[1] === 1 && !Number.isNaN(r[2])).length, 'N is the number of observations');
  assert.ok(Math.abs(c.obValue(cell, 'pct') - e.pct) < 1e-9, 'weighted %');
  c.state.exploreVar = 'ss_dir'; c.state.ob = { rows: 'year', cols: 'sexo', stat: 'count', level: '1', fill: false, cell: [5, 0] };
  const wt = text(c.obRender());
  assert.match(wt, /Weighted total/); assert.match(wt, /population estimates/); assert.match(wt, /\[pw=factor\]/);
  // sum of income by year (no columns)
  c.state.weightVar = null; c.state.exploreVar = 'ingreso';
  const s = c.obCompute('ingreso', 'year', '', 'sum', '', false);
  s.rows.forEach((r, ri) => assert.equal(c.obValue(s.grid[ri][0], 'sum'), data.filter(x => x[0] === +r.label).reduce((a, x) => a + x[4], 0), 'sum ' + r.label));
  const all = data.map(x => x[4]).sort((a, b) => a - b);
  const m = c.obCompute('ingreso', 'year', '', 'median', '', false), tot = m.grid[m.rows.length][0];
  assert.equal(c.obValue(tot, 'min'), all[0]); assert.equal(c.obValue(tot, 'max'), all[all.length - 1]);
  assert.equal(c.obValue(tot, 'median'), all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2);
  // full tabulation and R code
  c.state.exploreVar = 'ss_dir'; c.state.dialect = 'r';
  c.state.ob = { rows: 'year', cols: 'sexo', stat: 'tab' };
  const t = text(c.obRender());
  assert.match(t, /sexo = 1/); assert.match(t, /group_by\(year, sexo, ss_dir\)/);
  // the IF subgroup applies: only women
  c.state.dialect = 'stata';
  c.state.flt = { on: true, v: 'sexo', op: '==', val: '2' };
  assert.equal(c.conds().length, 1);
  const f = c.obCompute('ss_dir', 'year', '', 'pct', '1', false);
  assert.equal(f.grid[f.rows.length][0].wN, expect((y, x) => x === 2).n, 'subgroup: women only');
  assert.match(text(c.obRender()), /if sexo == 2/, 'the code carries the subgroup');
});
