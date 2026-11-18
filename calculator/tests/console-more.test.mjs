// Console build .106: macros, display, loops, prefixes and the inspection / statistics commands.
// Reference values from R 4.3.3 (cor.test, var.test, shapiro.test, binom.test, prop.test, t.test, qbeta) and Stata's
// documented formulas (proportion: logit interval with t(n − 1); xtile: _pctile's default definition).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props, children }) }; globalThis.window = { innerWidth: 1440 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1] + ';return Component')(Base);
const Y = [1.0, 14.0, 7.6, 9.6, 10.6, 14.6, 6.2, 12.2, 11.2, '', 8.8, 3.1, 5.5, 9.9, 12.0, 4.4, 7.7, 13.1, 2.2, 6.6];
const X = [0, 7.5, 2, 9.5, 2, 9.5, 4, 11.5, 4, 11.5, 6, 1, 3, 8, 10, 2.5, 5, 12, 0.5, 4.5];
const G = 'ABBABBABBABAABBAABAA'.split(''), Z = [0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1];
const CSV = 'y,x,g,z,k\n' + Y.map((y, i) => [y, X[i], G[i], Z[i], i + 1].join(',')).join('\n') + '\n';
const setup = async () => {
  const b = Buffer.from(CSV), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}), c = new C(); c._E = E; c._raw = raw; c.jumpArm = () => {};
  c.state = { ...c.state, cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, screen: 'work', tab: 'one', autoScreen: true };
  return c;
};
const run = (c, cmd) => { c.setState({ mfCmdErr: '' }); c.runCmdLine(cmd); clearTimeout(c._mfOkT); assert.equal(c.state.mfCmdErr, '', cmd + ': ' + c.state.mfCmdErr); return c.state.conLog.at(-1); };
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), a + ' vs ' + b);
const nums = s => (s.match(/-?\d*\.\d+(?:e[-+]?\d+)?|-?\d+/g) || []).map(Number);

test('spearman, sdtest, swilk, ci and proportion match R', async () => {
  const c = await setup();
  let d = run(c, 'spearman y x'); close(c._cpR.rho, 0.8072031600); close(c._cpR.p, 0.0000294932, 1e-4); assert.match(d.tbl, /Spearman's rho =\s+0\.8072/);
  d = run(c, 'sdtest y, by(g)'); close(c._cpR.F, 1.5073856064); close(c._cpR.p, 0.5525788426, 1e-5); assert.match(d.tbl, /Variance ratio test/); assert.match(d.tbl, /2\*Pr\(F > f\) = 0\.5526/);
  d = run(c, 'swilk y x'); assert.match(d.tbl, /Shapiro–Wilk W test/);
  const sw = c.cqSwilk(Y.filter(v => v !== '')); close(sw.w, 0.9699696253, 1e-5); close(sw.p, 0.7758527035, 1e-3);
  const sx = c.cqSwilk(X); close(sx.w, 0.9292967172, 1e-5); close(sx.p, 0.1496771176, 1e-3);
  d = run(c, 'ci proportions z'); close(c._cpR.lb, 0.3152781330); close(c._cpR.ub, 0.7694221032);
  run(c, 'ci proportions z, wilson'); close(c._cpR.lb, 0.3420853425); close(c._cpR.ub, 0.7418021417);
  run(c, 'ci proportions z, jeffreys'); close(c._cpR.lb, 0.3376649585); close(c._cpR.ub, 0.7489765568);
  d = run(c, 'ci means y'); close(c._cpR.lb, 6.4998736627); close(c._cpR.ub, 10.3738105479); assert.match(d.tbl, /Variable \|\s+Obs\s+Mean\s+Std\. err\./);
  d = run(c, 'proportion g'); const row = d.tbl.split('\n').find(l => /^\s+A \|/.test(l)); const v = nums(row.split('|')[1]);
  close(v[0], 0.5); close(v[1], 0.1147078669, 1e-5); close(v[2], 0.2768090656, 1e-5); close(v[3], 0.7231909344, 1e-5);
});

test('display, macros and Stata functions', async () => {
  const c = await setup(); const out = [];
  c.cqPrint = (s, text) => out.push(text);
  const pre = s => c.cqPre(s, () => {});
  pre('display 2/3'); assert.equal(out.at(-1), '.66666667');
  pre('display "x = " 3*2'); assert.equal(out.at(-1), 'x = 6');
  pre('display %9.2f 3.14159'); assert.equal(out.at(-1), '     3.14');
  pre('display normal(1.96)'); assert.equal(out.at(-1), '.9750021');
  pre('display invnormal(.975)'); assert.equal(out.at(-1), '1.959964');
  pre('display ttail(10, 2)'); close(Number(out.at(-1)), 0.0366940174, 1e-6);
  pre('display invttail(10, .025)'); close(Number(out.at(-1)), 2.2281388520, 1e-6);
  pre('display chi2tail(1, 3.84)'); close(Number(out.at(-1)), 0.0500435212, 1e-6);
  pre('display Ftail(2, 10, 4)'); close(Number(out.at(-1)), 0.0529221494, 1e-6);
  pre('local k 5'); pre('display `k\' * 2'); assert.equal(out.at(-1), '10');
  pre('local m = 1/4'); assert.equal(c._cqL.m, '.25');
  pre('global who "world"'); pre('display "hello $who"'); assert.equal(out.at(-1), 'hello world');
  pre('scalar s = 3'); pre('display s^2 + 1'); assert.equal(out.at(-1), '10');
  run(c, 'summarize y'); pre('display r(mean)'); close(Number(out.at(-1)), 160.3 / 19, 1e-6); pre('display r(N)'); assert.equal(out.at(-1), '19');
  assert.equal(c.cqExpand('summary(df$y)'), 'summary(df$y)', 'R code with $ is left alone');
  assert.deepEqual(c.cqNumlist('1/3 10(5)20'), ['1', '2', '3', '10', '15', '20']);
  assert.equal(c.cqAddIf('summarize y [aw=x], detail', 'g == "A"'), 'summarize y if g == "A" [aw=x], detail');
  assert.equal(c.cqAddIf('tab g if z == 1', 'k == 2'), 'tab g if z == 1 & k == 2');
});

test('egen, xtile, encode / decode, levelsof, table, isid, duplicates of the data commands', async () => {
  const c = await setup();
  run(c, 'egen my = mean(y), by(g)'); const a = c._raw.cols[c._raw.names.indexOf('my')].a;
  const mA = Y.filter((v, i) => v !== '' && G[i] === 'A').reduce((s, v, _, r) => s + v / r.length, 0); close(a[0], mA);
  run(c, 'egen r = rank(x)'); const r = c._raw.cols[c._raw.names.indexOf('r')].a; assert.equal(r[2], (r[4])); assert.equal(r[2], 4.5); // x = 2 twice → ranks 4 and 5 → 4.5
  run(c, 'egen gg = group(g)'); assert.deepEqual(Array.from(c._raw.cols[c._raw.names.indexOf('gg')].a.slice(0, 3)), [1, 2, 2]);
  run(c, 'egen t = tag(g)'); assert.equal(Array.from(c._raw.cols[c._raw.names.indexOf('t')].a).reduce((s, v) => s + v, 0), 2);
  run(c, 'egen rt = rowtotal(y x)'); assert.equal(c._raw.cols[c._raw.names.indexOf('rt')].a[9], 11.5);
  run(c, 'egen nm = rownonmiss(y x)'); assert.equal(c._raw.cols[c._raw.names.indexOf('nm')].a[9], 1);
  run(c, 'xtile q = k, nq(4)'); assert.deepEqual(Array.from(c._raw.cols[c._raw.names.indexOf('q')].a), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4]);
  run(c, 'encode g, gen(gn)'); const gi = c._raw.names.indexOf('gn'); assert.deepEqual(Array.from(c._raw.cols[gi].a.slice(0, 3)), [1, 2, 2]); assert.equal(c._raw.vlabs.gn.get(2), 'B');
  run(c, 'decode gn, gen(gs)'); assert.equal(c._raw.cols[c._raw.names.indexOf('gs')].a[1], 'B');
  let d = run(c, 'levelsof g'); assert.equal(d.tbl, '`"A"\' `"B"\'');
  d = run(c, 'levelsof z, local(zz)'); assert.equal(d.tbl, '0 1'); assert.equal(c._cqL.zz, '0 1');
  d = run(c, 'table g'); assert.match(d.tbl, /\|\s+Frequency/); assert.match(d.tbl, /Total\s+\|\s+20/);
  d = run(c, 'table g z'); assert.match(d.tbl, /Total\s+\|\s+9\s+11\s+20/);
  run(c, 'isid k'); c.setState({ mfCmdErr: '' }); c.runCmdLine('isid g'); assert.match(c.state.mfCmdErr, /does not uniquely identify/);
  c.setState({ mfCmdErr: '' }); c.runCmdLine('egen my = mean(x)'); assert.match(c.state.mfCmdErr, /already defined/);
  c.setState({ mfCmdErr: '' }); c.runCmdLine('collapse (mean) y, by(g)'); assert.match(c.state.mfCmdErr, /Break down by groups/);
  c.setState({ mfCmdErr: '' }); c.runCmdLine('table(df$g)'); assert.doesNotMatch(c.state.mfCmdErr || '', /variable \(df/);
});
