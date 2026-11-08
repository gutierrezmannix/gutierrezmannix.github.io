// Timeline for coded questions (build .95): node --test calculator/tests/timeline-coded.test.mjs
// On tests/data/timeline-coded.dta (written by tests/timeline-coded-reference.R; 7 survey years, 2019 not asked), the
// Charts → Timeline page against R's survey package (tests/data/timeline-coded-reference.json): the % giving each answer
// (No aplica and No sabe included, nothing left out by default), an answer left out of the 100%, one answer by sex, the
// pooled 3-year moving average (by position among the years in the data, hollow at the ends), the reversed mean score
// with the answers that can't be scored shown under it, weighted and unweighted means — estimates, survey standard
// errors (svymean) and t(n−1) intervals as Stata's mean [pw=].
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import zlib from 'node:zlib';
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const R = JSON.parse(fs.readFileSync(new URL('./data/timeline-coded-reference.json', import.meta.url), 'utf8'));
const b = fs.readFileSync(new URL('./data/timeline-coded.dta', import.meta.url)), raw = await E.parseDTA(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
const make = st => { const c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.pushLog = () => {};
  c.state = { ...c.state, screen: 'work', tab: 'plots', fileName: 'timeline.dta', nRows: raw.n, cols: raw.names.map((_, i) => Object.assign(E.profileCol(raw, i, true), { idx: i })), autoScreen: true, genTags: {}, treat: {}, weightVar: 'peso', ...st }; return c; };
const build = (c, id, pg) => { c.state = { ...c.state, plotKind: id, csPages: { [id]: pg } }; c.clearMemo(); return c.cbBuild(id); };
const near = (a, b, tag, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), tag + ': ' + a + ' vs R ' + b);
const ser = (res, key) => { const s = res.models[0].series.find(q => q.key === key); assert.ok(s, 'series ' + key + ' in ' + res.models[0].series.map(q => q.key)); return s; };
const flat = n => !n ? [] : Array.isArray(n) ? n.flatMap(flat) : typeof n === 'object' ? [n, ...flat(n.children)] : [];
const text = n => n == null ? '' : typeof n !== 'object' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);

test('a labelled question shows the % giving each answer, No aplica and No sabe included (as svymean)', () => {
  const c = make(), res = build(c, 'line', { x: 'anio', y: 'taxi' }), m = res.models[0];
  assert.deepEqual(m.series.map(s => s.key), ['Sí', 'No', 'No aplica', 'No sabe / no responde']);
  assert.match(m.subtitle, /nothing left out/); assert.equal(m.pct, true);
  R.forEach((r, i) => { for (const [k, a] of [['Sí', 1], ['No', 2], ['No aplica', 3], ['No sabe / no responde', 9]]) near(ser(res, k).pts[i].y, r['each' + a].y, r.year + ' ' + k); });
  assert.deepEqual(ser(res, 'Sí').pts.map(p => p.x), [2015, 2016, 2017, 2018, 2020, 2021, 2022]);
  assert.equal(res.autoColors['No aplica'], '#A79E8C', 'answers that are not answers are grey');
});

test('leave out: No sabe out of the chart and of the 100%; one answer by sex with the survey interval', () => {
  const c = make(); let res = build(c, 'line', { x: 'anio', y: 'taxi', drop: ['9'] });
  assert.deepEqual(res.models[0].series.map(s => s.key), ['Sí', 'No', 'No aplica']); assert.match(res.models[0].subtitle, /left out: No sabe/);
  R.forEach((r, i) => near(ser(res, 'Sí').pts[i].y, r.each_dropped.y, r.year + ' Sí without No sabe'));
  res = build(c, 'line', { x: 'anio', y: 'taxi', stat: 'one', ans: ['1'], drop: ['3', '9'], group: 'sexo', ci: true });
  const mu = ser(res, 'Mujer');
  R.forEach((r, i) => { near(mu.pts[i].y, r.one_m.y, r.year + ' Mujer %'); near(mu.pts[i].se, r.one_m.se, r.year + ' Mujer se'); near(mu.pts[i].lo, r.one_m.lo, r.year + ' lo'); near(mu.pts[i].hi, r.one_m.hi, r.year + ' hi'); assert.equal(mu.pts[i].n, r.one_m.n); });
  assert.equal(res.models[0].series[0].band, true);
  assert.throws(() => build(c, 'line', { x: 'anio', y: 'taxi', drop: ['1', '2', '3', '9'] }), /Every answer of taxi is left out/);
  assert.throws(() => build(c, 'line', { x: 'anio', y: 'taxi', stat: 'one', ans: ['3'], drop: ['3'] }), /left out/);
});

test('3-year moving average: pooled windows by position (2018 with 2017 and 2020), hollow at the ends', () => {
  const c = make(), res = build(c, 'line', { x: 'anio', y: 'taxi', stat: 'one', drop: ['3', '9'], smooth: '3', ci: true }), s = ser(res, 'All');
  R.forEach((r, i) => { near(s.pts[i].y, r.one3.y, r.year + ' pooled %'); near(s.pts[i].se, r.one3.se, r.year + ' pooled se'); near(s.pts[i].lo, r.one3.lo, r.year + ' pooled lo'); assert.equal(s.pts[i].win, r.one3.win); assert.equal(!!s.pts[i].part, r.one3.win < 3, r.year + ' hollow'); });
  assert.ok(s.pts.every(p => isFinite(p.single)), 'the single years stay as faint dots'); assert.equal(res.models[0].rawDots, true);
  assert.match(res.models[0].subtitle, /3-year moving average/); assert.match(res.models[0].note, /pooled estimate, not an average/);
  const svg = E.cbScene(res.models[0], {}).markup; assert.match(svg, /fill-opacity="\.32"/, 'faint dots drawn'); assert.match(svg, /fill="#FFFFFF" stroke="[^"]+" stroke-width="2"/, 'hollow end points');
  const hide = build(c, 'line', { x: 'anio', y: 'taxi', stat: 'one', drop: ['3', '9'], smooth: '3', raw: 'hide' }); assert.equal(hide.models[0].rawDots, false);
});

test('the mean score: reversed (Mucha = 4), No aplica and No sabe out of it but drawn under the chart', () => {
  const c = make(); let res = build(c, 'line', { x: 'anio', y: 'conf', stat: 'score', rev: '1', ci: true }); const s = ser(res, 'All');
  R.forEach((r, i) => { near(s.pts[i].y, r.score.y, r.year + ' score'); near(s.pts[i].se, r.score.se, r.year + ' score se'); });
  assert.match(res.models[0].subtitle, /1 = Nada … 4 = Mucha/); assert.match(res.models[0].subtitle, /left out of the score: No aplica, No sabe/); assert.match(res.models[0].subtitle, /axis zoomed/);
  assert.ok(res.strip, 'the left-out answers get their own small chart');
  R.forEach((r, i) => near(res.strip.series.find(q => q.key === 'No aplica').pts[i].y, r.strip5.y, r.year + ' % No aplica'));
  res = build(c, 'line', { x: 'anio', y: 'conf', stat: 'score', rev: '1', smooth: '3' }); R.forEach((r, i) => near(ser(res, 'All').pts[i].y, r.score3.y, r.year + ' pooled score'));
  res = build(c, 'line', { x: 'anio', y: 'conf', stat: 'score', axis: 'full' }); assert.deepEqual(res.models[0].yr, [1, 4]);
  // Sí / No has two answers: no score offered
  const o = (c.state = { ...c.state, plotKind: 'line', csPages: { line: { x: 'anio', y: 'taxi' } } }, c.clearMemo(), c.renderVals());
  const show = flat(o.chartSuiteEl).find(n => n.tag === 'select' && n.props['aria-label'] === 'Show');
  assert.ok(show && !text(show).includes('mean score'), 'no mean score for Sí / No'); assert.ok(text(show).includes('the % giving each answer'));
});

test('means of numbers: survey SE weighted, s/√n unweighted; counts; the mean of codes says what it is', () => {
  let c = make(), res = build(c, 'line', { x: 'anio', y: 'ingreso', ci: true }); R.forEach((r, i) => { near(ser(res, 'All').pts[i].se, r.ingreso.se, r.year + ' weighted se'); near(ser(res, 'All').pts[i].lo, r.ingreso.lo, r.year + ' weighted lo'); });
  assert.match(res.models[0].note, /sampling weight/);
  c = make({ weightVar: '' }); res = build(c, 'line', { x: 'anio', y: 'ingreso', ci: true }); R.forEach((r, i) => near(ser(res, 'All').pts[i].se, r.ingreso_u.se, r.year + ' unweighted se'));
  c = make(); res = build(c, 'line', { x: 'anio', y: 'taxi', stat: 'eachn' }); R.forEach((r, i) => near(ser(res, 'Sí').pts[i].y, r.count1, r.year + ' weighted count'));
  res = build(c, 'line', { x: 'anio', y: 'conf', stat: 'mean' }); assert.match(res.models[0].note, /These are means of the codes \(1 = Mucha/);
  res = build(c, 'area', { x: 'anio', y: 'taxi' }); assert.ok(res.models[0].series.at(-1).pts.every(p => Math.abs(p.y - 100) < 1e-9), 'stacked 100%');
});

test('the page: Show adapts, Leave out lists every answer with its code and count, Smooth', () => {
  const c = make(); c.state = { ...c.state, plotKind: 'line', csPages: { line: { x: 'anio', y: 'conf', stat: 'score' } } }; c.clearMemo();
  const nodes = flat(c.renderVals().chartSuiteEl), t = text(nodes.find(n => n.props && n.props.className === 'tl-panel cb-data'));
  assert.match(t, /Leave out of the score/); assert.match(t, /5 +No aplica/); assert.match(t, /can’t be scored/);
  assert.match(t, /3-year average/); assert.match(t, /Direction/);
  const boxes = nodes.filter(n => n.tag === 'input' && n.props.type === 'checkbox' && /^Leave out /.test(n.props['aria-label'] || ''));
  assert.equal(boxes.length, 6); assert.equal(boxes.filter(n => n.props.disabled).length, 2, 'No aplica and No sabe locked out of the score');
});

test('No aplica and No sabe stored as Stata .a and .b are answers too (Stata 15 and Stata 12 files)', async () => {
  for (const f of ['timeline-coded.dta', 'timeline-coded-v12.dta']) {
    const bb = fs.readFileSync(new URL('./data/' + f, import.meta.url)), rx = await E.parseDTA(bb.buffer.slice(bb.byteOffset, bb.byteOffset + bb.byteLength), () => {});
    const ix = rx.names.indexOf('taxi_x'); assert.ok(rx.cols[ix].x, f + ': the letters are kept');
    assert.equal(rx.vlabs.taxi_x.get(E.dtaXCode(1)), 'No aplica', f + ': .a keeps its label');
    const c = make(); c._raw = rx; c.state.cols = rx.names.map((_, i) => Object.assign(E.profileCol(rx, i, true), { idx: i }));
    let res = build(c, 'line', { x: 'anio', y: 'taxi_x' });
    assert.deepEqual(res.models[0].series.map(s => s.key), ['Sí', 'No', 'No aplica', 'No sabe / no responde'], f);
    R.forEach((r, i) => { near(ser(res, 'Sí').pts[i].y, r.each1.y, f + ' ' + r.year + ' Sí'); near(ser(res, 'No aplica').pts[i].y, r.each3.y, f + ' ' + r.year + ' No aplica (.a)'); });
    res = build(c, 'line', { x: 'anio', y: 'taxi_x', drop: ['.b'] }); R.forEach((r, i) => near(ser(res, 'Sí').pts[i].y, r.each_dropped.y, f + ' ' + r.year + ' Sí without .b'));
    c.state = { ...c.state, plotKind: 'line', csPages: { line: { x: 'anio', y: 'taxi_x' } } }; c.clearMemo();
    const t = text(flat(c.renderVals().chartSuiteEl).find(n => n.props && n.props.className === 'tl-panel cb-data'));
    assert.match(t, /\.a +No aplica/, f + ': the checklist shows the .a code');
  }
  // an integer column with the same codes reads as before
  const c = make(), res = build(c, 'line', { x: 'anio', y: 'taxi_b' }); R.forEach((r, i) => near(ser(res, 'No aplica').pts[i].y, r.each3.y, r.year + ' coded 3'));
});

test('SPSS user-missing codes (3 No aplica, 9 No sabe) are answers in the Timeline', async () => {
  const bb = fs.readFileSync(new URL('./data/timeline-coded.sav', import.meta.url)), rs = await E.parseSAV(bb.buffer.slice(bb.byteOffset, bb.byteOffset + bb.byteLength), () => {});
  const ix = rs.names.indexOf('taxi_s'); assert.ok(rs.cols[ix].um, 'the user-missing codes are kept'); assert.ok(Number.isNaN(rs.cols[ix].a[rs.cols[ix].um.findIndex(v => v === 3)]), 'still missing for every other analysis');
  const c = make(); c._raw = rs; c.state.cols = rs.names.map((_, i) => Object.assign(E.profileCol(rs, i, true), { idx: i }));
  const res = build(c, 'line', { x: 'anio', y: 'taxi_s' });
  assert.deepEqual(res.models[0].series.map(s => s.key), ['Sí', 'No', 'No aplica', 'No sabe / no responde']);
  R.forEach((r, i) => { near(ser(res, 'No aplica').pts[i].y, r.each3.y, r.year + ' No aplica (user-missing 3)'); near(ser(res, 'Sí').pts[i].y, r.each1.y, r.year + ' Sí'); });
});
