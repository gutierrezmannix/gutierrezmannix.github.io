// Univariate descriptives tab (build .66): node --test calculator/tests/descriptives.test.mjs
// On tests/data/descriptives.csv (tests/descriptives-data.R), against R references written out with Stata's rules
// (tests/descriptives-reference.R → tests/data/descriptives-reference.json):
// - every statistic of the panel, with and without a weight: N, mean, SD, CI (ci means / mean [pw=]), percentiles,
//   skewness, kurtosis; the group table's SD for values near 1e9 and its weighted medians;
// - display: values near 1e-6 and 1e9 readable, one format per panel, tiles that fit;
// - the frequency table in value order with a sort-by-frequency switch, real N with a weight;
// - box plot outliers all drawn, chart ticks that differ, the histogram's y title;
// - the logged Stata / R commands and their printouts reproduce the panel.
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
const REF = JSON.parse(fs.readFileSync(new URL('./data/descriptives-reference.json', import.meta.url), 'utf8'));
const CSV = fs.readFileSync(new URL('./data/descriptives.csv', import.meta.url));
const R = globalThis.React;

const load = async (weightVar = '') => {
  const b = Buffer.from(CSV), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
  const c = new C(); c._E = E; c._raw = raw; c._svgs = {}; c.flash = () => {}; c.jumpArm = () => {};
  c.jobMemo = (key, fn) => { const spec = fn(); return E[spec.__work](...spec.args); };
  c.state = { ...c.state, screen: 'work', tab: 'one', nRows: raw.n, cols: raw.names.map((_, i) => E.profileCol(raw, i, true)), autoScreen: true, weightVar };
  return c;
};
const view = (c, st) => { c.setState(st); c.clearMemo(); return c.renderVals(); };
const txt = el => el == null || el === false ? '' : typeof el !== 'object' ? String(el) : Array.isArray(el) ? el.map(txt).join('') : (el.children || []).map(txt).join('');
const flat = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(flat) : [n, ...(n.children || []).flatMap(flat)];
const texts = svg => flat(svg).filter(n => n.tag === 'text').map(n => txt(n));
const near = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), what + ': ' + a + ' vs R ' + b);
const tile = (o, k) => (o.descCells.find(t => t.k === k) || {}).v;

test('every statistic of the panel matches R (Stata rules), with and without a weight', async () => {
  for (const wv of ['', 'w']) {
    const c = await load(wv);
    for (const v of ['x', 'skew', 'tiny', 'big']) {
      view(c, { exploreVar: v });
      const d = c.memoView()['desc|' + v], r = REF[v + '|' + (wv || 'none')], tag = v + (wv ? ' [w]' : '');
      assert.equal(d.n, r.n, tag + ' n');
      for (const [k, rk] of [['mean', 'mean'], ['sd', 'sd'], ['mn', 'min'], ['mx', 'max'], ['sk', 'sk'], ['ku', 'ku']]) near(d[k], r[rk], 1e-9, tag + ' ' + k);
      near(wv ? d.sePw : d.sd / Math.sqrt(d.n), r.se, 1e-9, tag + ' standard error of the mean');
      for (const p of [1, 5, 10, 25, 50, 75, 90, 95, 99]) near(d.pctl[p], r['p' + p], 1e-12, tag + ' p' + p);
      assert.equal(d.q1, d.pctl[25]); assert.equal(d.med, d.pctl[50]); assert.equal(d.q3, d.pctl[75]);
      // the CI tiles show R's interval in the panel's format
      const o = c.renderVals(), F = c.descFmt(d);
      assert.equal(tile(o, '95% CI LO'), F(r.lo), tag + ' CI low'); assert.equal(tile(o, '95% CI HI'), F(r.hi), tag + ' CI high');
      assert.equal(tile(o, 'SKEWNESS'), r.sk.toFixed(2).replace(/^-0\.00$/, '0.00')); assert.equal(tile(o, 'KURTOSIS'), r.ku.toFixed(2));
    }
  }
});

test('display: values near 1e-6 and 1e9 stay readable, one format per panel, tiles fit', async () => {
  const c = await load();
  let o = view(c, { exploreVar: 'tiny' });
  assert.ok(o.descCells.filter(t => !/MISSING|SKEWNESS|KURTOSIS|N VALID/.test(t.k)).every(t => !/^0(\.0+)?$/.test(t.v)), 'no 0.00 for a rate near 1e-6: ' + o.descCells.map(t => t.v).join(' '));
  assert.equal(tile(o, 'MEAN'), '9.92e−7'); assert.match(o.exInterp, /around 9\.92e−7 \(median 9\.91e−7\)/);
  o = view(c, { exploreVar: 'big' });
  assert.notEqual(tile(o, '95% CI LO'), tile(o, '95% CI HI'), 'the CI of values near 1e9 is not one number');
  assert.equal(tile(o, '95% CI LO'), '999,999,999.95'); assert.equal(tile(o, 'SD'), '1.07');
  const mt = o.descCells.find(t => t.k === 'MEAN'), sd = o.descCells.find(t => t.k === 'SD');
  assert.ok(/grid-column: span 2/.test(mt.ts) && /white-space: nowrap/.test(mt.vs) && !/span 2/.test(sd.ts), 'long numbers take two tile widths on one line');
  o = view(c, { exploreVar: 'skew' });
  for (const k of ['MEAN', 'MEDIAN', 'MIN', 'Q1', 'MAX', '95% CI LO']) assert.match(tile(o, k), /^\d{1,3}(,\d{3})*$/, k + ' as whole numbers with thousands separators: ' + tile(o, k));
  assert.equal(tile(o, 'MEDIAN'), '83,180'); assert.equal(tile(o, 'MIN'), '6,785');
  assert.match(c.keyLineFor({ t: 'sum', x: 'skew' }).text, /^Mean skew = 116,645 \(SD 151,851, median 83,180, range 6,785 to 2,012,262\)/);
  o = view(c, { exploreVar: 'x' });
  assert.equal(tile(o, 'MEAN'), '49.20'); assert.equal(tile(o, 'SD'), '10.16'); // ordinary variables keep the Settings decimals
});

test('the skew remark follows the skewness; no remark for a symmetric variable', async () => {
  const c = await load();
  assert.match(view(c, { exploreVar: 'skew' }).exInterp, /strongly skewed \(skewness 7\.56\): a few very high values pull the mean above the median/);
  assert.doesNotMatch(view(c, { exploreVar: 'x' }).exInterp, /skew/);
});

test('frequency table: value order (Stata tab) with a sort-by-frequency switch; with a weight, real N and weighted %', async () => {
  const c = await load();
  c.setState({ treat: { likert: 'categorical' } }); c.clearMemo(); c.setState({ cols: c.state.cols.map(m => m.name === 'likert' ? { ...m, treatAs: 'categorical' } : m) });
  let o = view(c, { exploreVar: 'likert' });
  assert.deepEqual(o.freqRows.map(r => r.level), ['1', '2', '3', '4', '5']);
  assert.deepEqual(o.freqRows.map(r => +r.count), Object.values(REF['likert|counts']));
  const cum = o.freqRows.map(r => parseFloat(r.cum)); assert.ok(cum.every((x, i) => !i || x > cum[i - 1]) && cum[4] === 100, 'CUM adds up the scale in order');
  assert.deepEqual(o.freqSortBtns.map(b => b.label), ['BY VALUE', 'BY FREQUENCY']);
  o.freqSortBtns[1].click(); o = view(c, {});
  assert.deepEqual(o.freqRows.map(r => r.level), ['4', '5', '3', '2', '1']);
  assert.deepEqual(texts(o.barChartEl).filter(t => /^[1-5]$/.test(t)), ['4', '5', '3', '2', '1'], 'the bar chart follows the order');
  c.setState({ freqSort: 'value', weightVar: 'w' }); o = view(c, {});
  assert.equal(o.freqHeadN, 'N (OBS.)'); assert.equal(o.freqHeadPct, 'PCT (W)');
  assert.deepEqual(o.freqRows.map(r => +r.count), Object.values(REF['likert|counts']), 'N is the number of observations, not a weighted sum');
  o.freqRows.forEach((r, i) => assert.equal(r.pct, Object.values(REF['likert|wpct'])[i].toFixed(1) + '%', 'weighted % ' + r.level));
  assert.match(o.freqNote, /N IS THE NUMBER OF OBSERVATIONS; PCT AND CUM USE THE WEIGHTS/);
});

test('cross-tab chi-square matches R, weighted (rescaled to the observations) and not; the R command uses the weights', async () => {
  for (const wv of ['', 'w']) {
    const c = await load(wv), o = view(c, { exploreVar: 'likert', oneCt: 'grp' }), r = REF['chi2|' + (wv || 'none')];
    assert.equal(o.oxChi.find(x => x.k === 'CHI²').v, r.stat.toFixed(2)); assert.equal(o.oxChi.find(x => x.k === 'P').v, c.fmtP(r.p));
    const cmd = c.cmdText({ t: 'ct', x: 'grp', y: 'likert', w: wv || undefined }, 'r');
    assert.match(cmd, wv ? /^tb <- xtabs\(w ~ likert \+ grp, data = df\)[\s\S]*chisq\.test\(tb \* sum\(complete\.cases/ : /^tb <- table\(df\$likert, df\$grp\)[\s\S]*chisq\.test\(tb, correct = FALSE\)/);
  }
});

test('group table: SD of values near 1e9 and weighted medians as R; Stata asks for the statistic on screen with one weight type', async () => {
  for (const wv of ['', 'w']) {
    const c = await load(wv), wk = wv || 'none';
    const cell = (v, stat) => { const o = view(c, { exploreVar: v, ob: { rows: 'grp', cols: '', stat, level: '', fill: true, showN: true, totals: true, cell: null } }); return { o, t: txt(o.obEl).replace(/\s+/g, ' ') }; };
    let { t } = cell('big', 'sd');
    for (const g of ['centro', 'norte', 'sur']) assert.match(t, new RegExp(g + REF['big|' + wk + '|' + g].sd.toFixed(2).replace('.', '\\.') + 'N'), 'SD of big in ' + g + (wv ? ' [w]' : ''));
    assert.match(t, new RegExp('Total' + REF['big|' + wk].sd.toFixed(2).replace('.', '\\.') + 'N'));
    ({ t } = cell('skew', 'median'));
    for (const g of ['centro', 'norte', 'sur']) assert.match(t, new RegExp(g + Math.round(REF['skew|' + wk + '|' + g].median).toLocaleString('en-US') + 'N'), 'median of skew in ' + g + (wv ? ' [w]' : ''));
    assert.match(t, wv ? /table grp \[aw=w\], statistic\(median skew\) statistic\(count skew\) tabstat skew \[aw=w\], by\(grp\) statistics\(median n\)/ : /table grp, statistic\(median skew\) statistic\(count skew\) tabstat skew, by\(grp\) statistics\(median n\)/);
    if (wv) {
      assert.doesNotMatch(t, /median unweighted/); assert.match(t, /medians use the weights/);
      ({ t } = cell('x', 'sum')); assert.match(t, /table grp \[pw=w\], statistic\(total x\)/); assert.doesNotMatch(t, /tabstat x/);
      c.setState({ dialect: 'r' }); ({ t } = cell('x', 'median')); c.setState({ dialect: 'stata' });
      assert.match(t, /wmed <- function\(x, w\)/); assert.match(t, /summarise\(value = wmed\(x, w\)/);
    }
  }
});

test('the logged commands reproduce the panel: summarize, detail with ci means / mean [pw=]; R prints the same numbers', async () => {
  for (const wv of ['', 'w']) {
    const c = await load(wv); view(c, { exploreVar: 'x' });
    const d = { t: 'sum', x: 'x', w: wv || undefined }, r = REF['x|' + (wv || 'none')], G = v => c.stataG(v);
    const st = c.cmdText(d, 'stata'), so = c.descStataText(d), rc = c.cmdText(d, 'r'), ro = c.descRText(d);
    assert.equal(st, wv ? 'summarize x [aw=w], detail\nmean x [pw=w]' : 'summarize x, detail\nci means x');
    for (const lab of ['Percentiles', 'Smallest', 'Largest', 'Obs', 'Sum of wgt.', 'Mean', 'Std. dev.', 'Variance', 'Skewness', 'Kurtosis']) assert.ok(so.includes(lab), 'summarize, detail shows ' + lab);
    assert.ok(so.includes(G(r.lo)) && so.includes(G(r.hi)) && so.includes(G(r.se)), 'the CI command shows R\'s interval: ' + G(r.lo) + ' ' + G(r.hi));
    assert.ok(so.includes(wv ? 'Mean estimation' : '[95% conf. interval]'));
    assert.match(rc, wv ? /se <- sqrt\(n \/ \(n - 1\) \* sum\(\(w \* \(x - m\)\)\^2\)\) \/ sum\(w\)/ : /t\.test\(x, conf\.level = 0\.95\)\$conf\.int/);
    assert.ok(ro.includes('[1] ' + c.rFormat([r.lo, r.hi]).map(s => s.trim()).join(' ')), 'R prints the interval');
    if (!wv) assert.match(ro, /sd\s+skewness\s+kurtosis/);
  }
});

test('charts: every box-plot outlier drawn (the extremes included), ticks that differ, the histogram y title', async () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const a = new Float64Array(20000); for (let i = 0; i < a.length; i++) a[i] = Math.exp(2 + 1.1 * Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd()));
  const d = E.descNum(a, null), iqr = d.q3 - d.q1; let nOut = 0; for (const x of a) if (x > d.q3 + 1.5 * iqr || x < d.q1 - 1.5 * iqr) nOut++;
  const nodes = flat(E.boxChart(R, d, { key: 'b', ax: {} })), dots = nodes.filter(n => n.tag === 'circle');
  assert.equal(dots.length, nOut, 'all ' + nOut + ' outliers');
  assert.equal(Math.max(...dots.map(n => n.props.cx)), 680 - 24, 'the maximum is drawn at the right end');
  const c = await load();
  for (const v of ['tiny', 'big', 'x']) {
    const o = view(c, { exploreVar: v }), ht = texts(o.histChart), bt = texts(o.boxChart);
    const nums = bt.filter(t => /\d/.test(t) && !/rows/.test(t)); assert.equal(new Set(nums).size, nums.length, v + ': box ticks all differ: ' + nums.join(' | '));
    assert.ok(ht.includes('Frequency'), v + ': histogram y title');
  }
  assert.deepEqual(texts(view(c, { exploreVar: 'big' }).boxChart).filter(t => /^\d/.test(t)).slice(0, 2), ['999,999,998', '1,000,000,000'], 'fewer ticks when labels are long');
  c.setState({ weightVar: 'w' }); assert.ok(texts(view(c, { exploreVar: 'x' }).histChart).includes('Frequency (weighted by w)'));
  const T = E.ticks(9e-7, 2e-6, 6); assert.deepEqual(T.map(v => E.fmtTick(v, T)), ['1.0e−6', '1.2e−6', '1.4e−6', '1.6e−6', '1.8e−6', '2.0e−6']);
  const Y = E.ticks(1990, 2024, 6); assert.deepEqual(Y.map(v => E.fmtTick(v, Y)), ['1990', '2000', '2010', '2020'], 'years without separators');
});

test('levels of values below 0.001 keep 4 significant digits', async () => {
  const c = await load();
  assert.ok(c.state.cols.find(m => m.name === 'tiny').distinct > 250, 'a rate near 1e-6 has hundreds of levels, not 1');
  assert.equal(E.numLab(9.46606e-7), '9.466e-7'); assert.equal(E.numLab(0.12345), '0.1235'); assert.equal(E.numLab(2.5), '2.5');
});
