// Charts tab · chart builder (Design A), on the shipped bundle: node --test calculator/tests/chart-builder.test.mjs
// every chart kind draws through one renderer; names become value labels; colors, values and palettes reach the SVG;
// the numbers behind the charts match a direct count.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 };
globalThis.document = { documentElement: { style: { zoom: '' } } };
const Component = new Function('DCLogic', code + ';return Component')(Base);

let seed = 4; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const header = 'year,sexo,ss_dir,ent,ingreso,edad,q1,dur,ev,pre,post,est,lo,hi,term,model';
const rows = [];
for (let i = 0; i < 400; i++) {
  const y = 2008 + 2 * (i % 8), s = 1 + (Math.floor(i / 8) % 2);
  rows.push([y, s, rnd() < 0.2 + 0.05 * (s === 1) ? 1 : 0, ['Jalisco', 'Chiapas', 'Nuevo León', 'Ciudad de México'][i % 4], Math.round(5000 + rnd() * 9000), 18 + Math.floor(rnd() * 60), 1 + Math.floor(rnd() * 5), (rnd() * 10).toFixed(2), rnd() < 0.6 ? 1 : 0, (50 + rnd() * 10).toFixed(1), (55 + rnd() * 10).toFixed(1), (rnd() - 0.5).toFixed(3), -0.9, 0.9, 'T' + (i % 5), 'M' + (1 + (i % 2))]);
}
const csv = [header].concat(rows.map(r => r.join(','))).join('\n');

async function make() {
  const b = Buffer.from(csv), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
  const c = new Component(); c._E = E; c._raw = raw; c._svgs = {};
  c.state = { ...c.state, screen: 'work', tab: 'plots', fileName: 'encuesta.csv', nRows: raw.n, cols: raw.names.map((_, i) => Object.assign(E.profileCol(raw, i), { idx: i })), autoScreen: false, genTags: {}, treat: {} };
  c.pushLog = d => c.setState(s => ({ conLog: [...(s.conLog || []), d] }));
  c.flash = t => { c.message = t; };
  return c;
}
const flat = n => !n ? [] : Array.isArray(n) ? n.flatMap(flat) : typeof n === 'object' ? [n, ...flat(n.children)] : [];
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
function open(c, id, page) {
  c.state = { ...c.state, plotKind: id, csPages: { ...(c.state.csPages || {}), [id]: { ...((c.state.csPages || {})[id] || {}), ...page } } };
  const out = c.renderVals(), nodes = flat(out.chartSuiteEl);
  const svgs = nodes.filter(n => n.tag === 'svg' && n.props.dangerouslySetInnerHTML);
  return { out, nodes, svgs, markup: svgs.map(s => s.props.dangerouslySetInnerHTML.__html).join('\n'), alerts: nodes.filter(n => n.props && n.props.role === 'alert').map(text) };
}

const kinds = {
  pie: { x: 'ss_dir', facet: 'sexo' }, donut: { x: 'ent' }, bar: { x: 'ent', stat: 'percent' }, dot: { x: 'ent', stat: 'mean', y: 'ingreso' }, groupbar: { x: 'ent', y: 'sexo' }, stackcount: { x: 'ent', y: 'sexo', stat: 'percent' }, stack: { x: 'ent', y: 'sexo' }, likert: { x: 'sexo', y: 'q1' },
  hist: { x: 'edad' }, density: { x: 'edad', group: 'sexo' }, box: { x: 'edad' }, gbox: { x: 'ent', y: 'ingreso' }, violin: { x: 'sexo', y: 'edad' },
  line: { x: 'year', y: 'ss_dir', stat: 'sum', group: 'sexo' }, area: { x: 'year', y: 'ss_dir', stat: 'sum', group: 'sexo' }, panel: { x: 'year', y: 'ingreso', group: 'ent' }, multiline: { x: 'year', y: 'ingreso', ys: ['edad'] },
  scatterplain: { x: 'edad', y: 'ingreso', group: 'sexo' }, scatter: { x: 'edad', y: 'ingreso' }, smooth: { x: 'edad', y: 'ingreso' }, hexbin: { x: 'edad', y: 'ingreso' }, matrix: { vars: ['edad', 'ingreso', 'q1'] }, corrmap: { vars: ['edad', 'ingreso', 'q1'] }, heatmap: { x: 'ent', group: 'sexo', y: 'ingreso' },
  mean: { x: 'ent', y: 'edad' }, proportion: { x: 'ent', y: 'ss_dir' }, dumbbell: { x: 'ent', lo: 'pre', y: 'post' }, slope: { x: 'ent', lo: 'pre', y: 'post' }, paired: { x: 'pre', y: 'post' },
  coefficient: { x: 'term', y: 'est', lo: 'lo', hi: 'hi', group: 'model' }, modelcompare: { x: 'term', y: 'est', lo: 'lo', hi: 'hi', group: 'model' }, prediction: { x: 'year', y: 'est', lo: 'lo', hi: 'hi', group: 'model' }, marginal: { x: 'term', y: 'est', lo: 'lo', hi: 'hi' }, interaction: { x: 'year', y: 'est', lo: 'lo', hi: 'hi', group: 'model' }, event: { x: 'year', y: 'est', lo: 'lo', hi: 'hi' }, conjoint: { x: 'term', y: 'est', lo: 'lo', hi: 'hi' }, survival: { x: 'dur', y: 'ev', group: 'sexo' }
};

test('every chart kind draws through the builder, with the Customize panel and downloads under it', async () => {
  const c = await make();
  for (const [id, p] of Object.entries(kinds)) {
    assert.ok(c.cbHandles(id), id + ' is a builder page');
    const r = open(c, id, { ...p, values: 'all' });
    assert.ok(r.svgs.length >= 1, id + ' draws');
    assert.deepEqual(r.alerts, [], id + ' has no error');
    assert.ok(!/NaN|undefined|Infinity/.test(r.markup), id + ' has no NaN in the SVG');
    const t = text(r.out.chartSuiteEl);
    assert.match(t, /Customize/, id + ' has the Customize panel');
    assert.match(t, /PNG 300 dpi/, id + ' has the downloads');
  }
});

test('the gallery groups every chart by the question it answers', async () => {
  const c = await make();
  c.state = { ...c.state, plotKind: '__gallery' };
  const out = c.renderVals(), t = text(out.chartSuiteEl);
  assert.ok(out.isChartSuite);
  for (const f of E.CB_FAMILIES) assert.ok(t.includes(f.q), 'question: ' + f.q);
  const ids = E.CB_FAMILIES.flatMap(f => f.kinds.map(k => k[0]));
  for (const id of Object.keys(kinds)) assert.ok(ids.includes(id === 'multiline' ? 'line' : id), id + ' is in the gallery');
  const buttons = flat(out.chartSuiteEl).filter(n => n.tag === 'button');
  assert.ok(buttons.length >= Object.keys(kinds).length, 'a button per chart');
  buttons.find(b => text(b) === 'Pie').props.onClick();
  assert.equal(c.state.plotKind, 'pie');
});

test('names: coded values become value labels used by every chart; text values keep chart names', async () => {
  const c = await make();
  // sexo is coded 1/2: renaming writes value labels (as Stata label define … modify)
  c.cbRename('sexo', '1', 'Hombres', true); c.cbRename('sexo', '2', 'Mujeres', true);
  assert.equal(c._raw.vlabs.sexo.get(1), 'Hombres');
  assert.equal(c._raw.vlabs.sexo.get(2), 'Mujeres');
  assert.ok((c.state.conLog || []).some(d => d.stata === 'label define sexo_lb 1 "Hombres", modify'), 'logged as Stata code');
  const pie = open(c, 'pie', kinds.pie), bars = open(c, 'groupbar', kinds.groupbar);
  assert.match(pie.markup, /Hombres/, 'the pie panels use the label');
  assert.match(bars.markup, /Mujeres/, 'the grouped bars use the label');
  // ent is text: the name is kept per variable and reaches every chart of ent
  c.cbRename('ent', 'Ciudad de México', 'CDMX', true);
  assert.equal(c.state.cbNames.ent['Ciudad de México'], 'CDMX');
  assert.match(open(c, 'bar', kinds.bar).markup, /CDMX/);
  assert.match(open(c, 'donut', kinds.donut).markup, /CDMX/);
  // chart-only name: only on this page
  c.state.plotKind = 'bar'; c.cbRename('ent', 'Jalisco', 'Jal.', false);
  assert.match(open(c, 'bar', kinds.bar).markup, /Jal\./);
  assert.doesNotMatch(open(c, 'donut', kinds.donut).markup, /Jal\./);
  // saved with the session
  assert.match(code, /"plotKind","csPages","cbNames","cbColors"/);
});

test('colors and palettes reach the SVG', async () => {
  const c = await make();
  c.cbRecolor('sexo', '1', '#123456');
  assert.match(open(c, 'groupbar', kinds.groupbar).markup, /#123456/i, 'a category color is used');
  assert.match(open(c, 'line', kinds.line).markup, /#123456/i, 'and by every chart of that variable');
  const gray = open(c, 'donut', { ...kinds.donut, palette: 'gray' }).markup;
  assert.ok(E.CB_PALETTES.gray.slice(0, 3).every(col => gray.toLowerCase().includes(col.toLowerCase())), 'the gray palette is used');
  c.state.chartColor = '#B22222';
  assert.match(open(c, 'hist', { x: 'edad' }).markup, /#B22222/i, 'the chart color from Settings is the first color');
});

test('values on lines: every point, last point; every year on the axis', async () => {
  const c = await make();
  const vals = m => (m.match(/paint-order="stroke"[^>]*>[^<]*</g) || []).length;
  const all = open(c, 'line', { ...kinds.line, values: 'all' }).markup, last = open(c, 'line', { ...kinds.line, values: 'last' }).markup, none = open(c, 'line', { ...kinds.line, values: 'none' }).markup;
  assert.equal(vals(all) - vals(none), 16, 'two lines × eight years');
  assert.equal(vals(last) - vals(none), 2, 'one value at the end of each line');
  const every = open(c, 'line', { ...kinds.line, everyX: '1' }).markup;
  for (let y = 2008; y <= 2022; y += 2) assert.match(every, new RegExp('>' + y + '<'), 'year ' + y + ' on the axis');
});

test('the numbers: sums by year and sex, percents that add to 100, histogram counts that add to n', async () => {
  const c = await make();
  // sum of ss_dir by year and sexo
  c.state = { ...c.state, plotKind: 'line', csPages: { line: { ...kinds.line } } };
  const res = c.cbBuild('line'), m = res.models[0];
  for (const s of m.series) for (const p of s.pts) {
    const direct = rows.filter(r => r[0] === p.x && String(r[1]) === String(s.key)).reduce((t, r) => t + r[2], 0);
    assert.equal(p.y, direct, 'sum at ' + p.x + ' for sexo ' + s.key);
  }
  // % of rows by state adds to 100
  c.state = { ...c.state, plotKind: 'bar', csPages: { bar: { x: 'ent', stat: 'percent' } } };
  const bar = c.cbBuild('bar').models[0];
  assert.ok(Math.abs(bar.vals.reduce((t, v) => t + v[0].v, 0) - 100) < 1e-9);
  // within-group percents add to 100 in each bar
  c.state = { ...c.state, plotKind: 'stackcount', csPages: { stackcount: { x: 'ent', y: 'sexo', stat: 'percent' } } };
  for (const v of c.cbBuild('stackcount').models[0].vals) assert.ok(Math.abs(v.reduce((t, x) => t + (x ? x.v : 0), 0) - 100) < 1e-9);
  // histogram
  c.state = { ...c.state, plotKind: 'hist', csPages: { hist: { x: 'edad' } } };
  const hm = c.cbBuild('hist').models[0];
  assert.equal(hm.bins.reduce((t, b) => t + b.c, 0), rows.length);
});

test('number format, decimals, axis limits and the Charts menu', async () => {
  const c = await make();
  const k = open(c, 'dot', { ...kinds.dot, values: 'all', fmt: 'k' }).markup;
  assert.match(k, /\d+(\.\d)?k</, 'values in thousands');
  const d0 = open(c, 'dot', { ...kinds.dot, values: 'all', fmt: 'full', decimals: '0' }).markup;
  assert.match(d0, /\d{1,2},\d{3}</, 'full numbers with separators');
  const sc = E.cbScene({ type: 'xy', series: [{ key: 'a', pts: [{ x: 1, y: 1 }, { x: 9, y: 9 }], style: 'line' }], seriesKeys: ['a'] }, { xmin: 0, xmax: 10, ymin: -5, ymax: 20, values: 'none' });
  assert.ok(sc.markup.includes('>20<') && sc.markup.includes('>-5<'), 'y limits are exact');
  const menu = c.cbMenu(React), mt = text(menu);
  assert.match(mt, /What do you want to show\?/);
  for (const f of E.CB_FAMILIES) assert.ok(mt.includes(f.q));
});

test('Univariate breakdown chart: same renderer, names into value labels, colors, values at each year, link to Charts', async () => {
  const c = await make();
  c.state = { ...c.state, tab: 'one', exploreVar: 'ingreso', ob: { rows: 'year', cols: 'sexo', stat: 'mean', chart: { values: 'all', everyX: '1' } } };
  let tree = c.obRender(), nodes = flat(tree);
  const mk = () => flat(c.obRender()).filter(n => n.tag === 'svg' && n.props.dangerouslySetInnerHTML)[0].props.dangerouslySetInnerHTML.__html;
  let m = mk();
  assert.equal((m.match(/fill="none" stroke="[^"]*" stroke-width="[^"]*" stroke-linejoin/g) || []).length, 3, 'two sexes and the total');
  for (let y = 2008; y <= 2022; y += 2) assert.match(m, new RegExp('>' + y + '<'));
  assert.ok((m.match(/paint-order="stroke"/g) || []).length >= 24, 'a value at each year on each line');
  // rename 1 → Hombres from the panel under the chart
  c.setState(s => ({ ob: { ...s.ob, chart: { ...s.ob.chart, tab: 'labels' } } }));
  nodes = flat(c.obRender());
  const inp = nodes.find(n => n.tag === 'input' && n.props['aria-label'] === 'Name for 1');
  assert.ok(inp, 'a name box for sexo = 1');
  inp.props.onBlur({ target: { value: 'Hombres' } });
  assert.equal(c._raw.vlabs.sexo.get(1), 'Hombres', 'saved as a value label');
  m = mk(); assert.match(m, />Hombres</, 'the line is named Hombres');
  // color for the total line
  c.setState(s => ({ ob: { ...s.ob, chart: { ...s.ob.chart, tab: 'colors' } } }));
  nodes = flat(c.obRender());
  nodes.find(n => n.tag === 'input' && n.props['aria-label'] === 'Color for Total').props.onChange({ target: { value: '#0000aa' } });
  assert.match(mk(), /#0000aa/i);
  // values: last point only
  c.setState(s => ({ ob: { ...s.ob, chart: { ...s.ob.chart, values: 'last' } } }));
  assert.equal((mk().match(/paint-order="stroke"/g) || []).length, 3);
  // open in Charts: the same numbers on the multi-line page
  const link = flat(c.obRender()).find(n => n.tag === 'button' && text(n) === 'More options in Charts →');
  assert.ok(link, 'link to the Charts tab');
  link.props.onClick();
  assert.equal(c.state.tab, 'plots'); assert.equal(c.state.plotKind, 'multiline');
  const res = c.cbBuild('multiline'), want = c.obCompute('ingreso', 'year', 'sexo', 'mean', '', true);
  const s1 = res.models[0].series.find(s => s.key === 'Hombres');
  assert.ok(s1, 'the Hombres line is on the Charts page');
  want.rows.forEach((r, ri) => { const p = s1.pts.find(q => q.x === r.code); if (p) assert.ok(Math.abs(p.y - c.obValue(want.grid[ri][0], 'mean')) < 1e-9, 'mean at ' + r.label); });
});

test('charts in the analysis tabs link to the same chart in the Charts tab', async () => {
  const c = await make();
  const linkIn = out => { for (const [k, v] of Object.entries(out)) { if (!v || typeof v !== 'object') continue; const b = flat(v).find(n => n.props && n.props.className === 'cb-more'); if (b) return [k, b]; } return [null, null]; };
  const cases = [
    [{ tab: 'one', exploreVar: 'edad' }, 'histChart', 'hist', { x: 'edad' }],
    [{ tab: 'one', exploreVar: 'ent' }, 'barChartEl', 'bar', { x: 'ent' }],
    [{ tab: 'two', xVar: 'edad', yVar: 'ingreso' }, 'scatterChartEl', 'scatter', { x: 'edad', y: 'ingreso' }],
    [{ tab: 'two', xVar: 'ent', yVar: 'sexo' }, 'stackChartEl', 'stackcount', { x: 'ent', y: 'sexo' }],
    [{ tab: 'two', xVar: 'ingreso', yVar: 'ent' }, 'gboxChartEl', 'gbox', { x: 'ent', y: 'ingreso' }],
    [{ tab: 'ttest', exploreVar: 'ingreso', ttMode: 'groups', ttG: 'sexo', ttA: '1', ttB: '2' }, 'ttChartEl', 'mean', { x: 'sexo', y: 'ingreso' }],
    [{ tab: 'ttest', exploreVar: 'pre', ttMode: 'paired', ttY2: 'post' }, 'ttChartEl', 'paired', { x: 'pre', y: 'post' }],
    [{ tab: 'reg', depVar: 'ingreso', predictors: ['edad', 'q1'], regModel: 'ols', treat: { edad: 'numeric', q1: 'numeric' } }, 'coefPlotEl', 'coefficient', { source: 'current' }]
  ];
  for (const [st, slot, id, page] of cases) {
    c.state = { ...c.state, ...st, plotKind: '__gallery' }; c.clearMemo();
    if (st.tab === 'reg') { c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); }; c._regRan = c.regSpec(); }
    const out = c.renderVals(), [k, btn] = linkIn(out);
    assert.equal(k, slot, st.tab + ': the link sits under ' + slot);
    assert.match(text(btn), /customize .* in Charts/);
    btn.props.onClick();
    assert.equal(c.state.tab, 'plots'); assert.equal(c.state.plotKind, id);
    for (const [pk, pv] of Object.entries(page)) assert.equal(c.state.csPages[id][pk], pv, id + ' gets ' + pk);
    const r = open(c, id, {});
    assert.ok(r.svgs.length >= 1, id + ' draws in Charts');
    assert.deepEqual(r.alerts, [], id + ' has no error');
    assert.ok(!/NaN|undefined/.test(r.markup));
    if (id === 'coefficient') assert.match(r.markup, /edad/, 'the current model’s terms');
    c.state.tab = st.tab;
  }
});
