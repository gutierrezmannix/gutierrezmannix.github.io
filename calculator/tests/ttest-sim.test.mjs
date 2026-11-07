// T-tests audit (build .88): node --test calculator/tests/ttest-sim.test.mjs
// 1. The page's own code against R on simulated data (tests/data/ttest-sim-reference.json, written by
//    tests/ttest-sim-reference.R with stats::t.test, effectsize::cohens_d and BSDA::tsum.test): t, df, p, both limits
//    and Cohen's d for two groups (Welch, Student), paired, one value and summary numbers, two- and one-sided.
// 2. The fixes of the audit: R and Stata commands use the codes of a labelled group (region %in% c(1, 3), not Norte);
//    text groups whose order differs between R and Stata (b/B, Ángela/Zoe) give R the levels; a test value typed with a
//    decimal comma (5,2); the R tab prints a one-sided test as R does; the Word table carries significance stars;
//    ttesti prints Stata's and BSDA's output; an if on a labelled variable is written with its code.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { gunzipSync } from 'node:zlib';
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const tpl = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]), code = tpl.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props, children }) }; globalThis.window = { innerWidth: 1440 }; globalThis.document = { documentElement: { style: { zoom: '' } } };
const C = new Function('DCLogic', code + ';return Component')(Base);
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const make = (raw, state, fileName) => { const c = new C(); c._E = E; c._raw = raw; c.state = { ...c.state, cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, screen: 'work', autoScreen: false, fileName: fileName || 'data.csv', ...state }; c.clearMemo(); c.renderVals(); return c; };
const csv = async s => E.parseCSV(ab(Buffer.from(s)), () => {});
const close = (a, b, tag) => { if (b === null || b === undefined) return; assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), tag + ': ' + a + ' vs R ' + b); };

test('the page agrees with R (t.test, effectsize, BSDA) on ' + 'simulated data', async () => {
  const cases = JSON.parse(fs.readFileSync(new URL('./data/ttest-sim-reference.json', import.meta.url), 'utf8'));
  assert.ok(cases.length > 300, 'cases: ' + cases.length);
  for (const K of cases) {
    const st = { tab: 'ttest', exploreVar: 'y', ttMode: K.mode, ttAlt: K.alt, ttEqual: K.equal, alphaSel: String(+(1 - K.level / 100).toFixed(2)) };
    if (K.mode === 'groups') Object.assign(st, { ttG: 'g' }, K.nlev === 2 ? { ttSwap: K.swap } : { ttA: K.A, ttB: K.B });
    if (K.mode === 'paired') st.ttY2 = 'y2'; if (K.mode === 'value') st.ttMu = K.muTxt;
    if (K.mode === 'summary') st.ttSum = { kind: K.sk, m1: String(K.m1), s1: String(K.s1), n1: String(K.n1), m2: String(K.m2), s2: String(K.s2), n2: String(K.n2), mu: K.sk === 'one' ? String(K.mu) : '0' };
    const c = make(await csv(K.mode === 'summary' ? 'y\n1\n2' : K.csv), st), tag = 'case ' + K.k + ' ' + K.mode + ' ' + K.alt + (K.equal ? ' student' : '') + ' ' + K.level + '%';
    const D = c.cmData(); assert.ok(!D.error, tag + ': ' + D.error); const r = c.cmResult(D);
    if (K.t === null) { assert.ok(r.error, tag + ': R gives no t (no variation), the page says why'); continue; }
    assert.ok(!r.error, tag + ': ' + r.error);
    if (K.mode === 'groups') assert.equal(D.gg.first, K.A, tag + ': first group in Stata’s order');
    const sh = K.mode === 'value' || (K.mode === 'summary' && K.sk === 'one') ? K.mu : 0;
    close(r.t, K.t, tag + ' t'); close(r.df, K.df, tag + ' df'); close(r.p, K.p, tag + ' p'); close(r.d, K.d, tag + ' d');
    if (Number.isFinite(K.lo)) close(r.lo + sh, K.lo, tag + ' lo'); if (Number.isFinite(K.hi)) close(r.hi + sh, K.hi, tag + ' hi');
    if (K.mode === 'value') assert.match(c._ttLast.r, new RegExp('mu = ' + String(K.mu).replace('.', '\\.') + '[,)]'), tag + ': the R command has the value with a decimal point');
  }
});

test('a labelled group: the R and Stata commands use the codes, the page the labels', async () => {
  const raw = await E.parseDTA(ab(fs.readFileSync(new URL('./data/ttest-labelled.dta', import.meta.url))), () => {});
  const c = make(raw, { tab: 'ttest', exploreVar: 'y', ttMode: 'groups', ttG: 'g', ttA: 'Sur', ttB: 'Norte', ttAlt: 'lt' }, 'regiones.dta');
  const D = c.cmData(); assert.deepEqual(D.labels, ['Sur', 'Norte']);
  c.cmRender({});
  assert.equal(c._ttLast.stata, 'ttest y if inlist(g, 1, 3), by(g) unequal');
  assert.match(c._ttLast.r, /^t\.test\(y ~ g, data = subset\(df, g %in% c\(1, 3\)\), var\.equal = FALSE, alternative = "greater"\)/);
  // R (on the same file): t = -6.0524, df = 17.939, CI -2.742949 to Inf for Norte minus Sur, "greater"
  assert.match(c._ttLast.tblR, /t = -6\.0524, df = 17\.939, p-value = 1\n/);
  assert.match(c._ttLast.tblR, /is greater than 0\n95 percent confidence interval:\n -2\.742949       Inf/);
  assert.equal(c.condExpr({ v: 'g', t: 'op', op: '==', val: 'Sur', cat: true }, 'stata'), 'g == 3');
  assert.equal(c.condExpr({ v: 'g', t: 'in', vals: ['Sur', 'Golfo'] }, 'r'), 'g %in% c(3, 4)');
});

test('text groups that R and Stata sort differently get their levels in the R command', async () => {
  const rows = ['y,g']; for (let i = 0; i < 20; i++) rows.push((10 + (i % 7) + (i % 2) * 3) + ',' + (i % 2 ? 'b' : 'B'));
  const c = make(await csv(rows.join('\n')), { tab: 'ttest', exploreVar: 'y', ttMode: 'groups', ttG: 'g', ttAlt: 'gt' });
  assert.equal(c.cmData().gg.first, 'B', 'Stata order: B before b');
  c.cmRender({}); c.cmRender({});
  assert.match(c._ttLast.r, /^t\.test\(y ~ factor\(g, levels = c\("B", "b"\)\), data = df, var\.equal = FALSE, alternative = "greater"\)$/);
  const plain = make(await csv('y,g\n1,Hombre\n2,Hombre\n4,Mujer\n6,Mujer'), { tab: 'ttest', exploreVar: 'y', ttMode: 'groups', ttG: 'g' });
  assert.equal(plain._ttLast.r, 't.test(y ~ g, data = df, var.equal = FALSE)', 'plain names keep the short command');
});

test('a test value typed with a decimal comma reaches the Stata and R tabs', async () => {
  const c = make(await csv('y\n4.1\n5.3\n4.8\n5.9\n4.4\n5.0'), { tab: 'ttest', exploreVar: 'y', ttMode: 'value', ttMu: '5,2', ttAlt: 'gt' });
  c.cmRender({});
  assert.ok(c._ttLast, 'the Stata and R tabs exist'); assert.match(c._ttLast.stata, /^ttest y == 5\.2$/);
  assert.match(c._ttLast.tblStata, /H0: mean = 5\.2 /); assert.match(c._ttLast.tblR, /true mean is greater than 5\.2\n/);
});

test('the Word table: the difference carries its stars, explained in the note', async () => {
  const c = make(await csv('y,y2\n50,52\n48,51\n55,58\n47,50\n52,53\n49,53\n51,55\n53,54'), { tab: 'ttest', exploreVar: 'y', ttMode: 'paired', ttY2: 'y2' });
  const D = c.cmData(), r = c.cmResult(D), T = c.cmTable(D, r), diff = T.rows.at(-1).c;
  assert.equal(diff[2], c.cmSigned(r.estimate) + '***', 'p = ' + r.p);
  assert.match(T.note, /\*p < \.05\. \*\*p < \.01\. \*\*\*p < \.001 \(two-sided\)\./);
  c.state.starSet = 'econ'; assert.match(c.cmTable(D, r).note, /\*p < \.10/);
});

test('ttesti: typed in the console it opens the summary test; Stata’s and BSDA’s printouts', async () => {
  const c = make(await csv('y\n1\n2\n3'), { tab: 'one', exploreVar: 'y' }); c.flash = () => {};
  c.runCmdLine('ttesti 30 72.5 8.1 28 68.2 9.4'); assert.equal(c.state.mfCmdErr || '', '');
  assert.equal(c.state.tab, 'ttest'); assert.equal(c.state.ttMode, 'summary'); assert.equal(c.state.ttEqual, true);
  assert.deepEqual([c.state.ttSum.n1, c.state.ttSum.m2, c.state.ttSum.kind], ['30', '68.2', 'two']);
  c.runCmdLine('ttesti 1 5 2 4'); assert.match(c.state.mfCmdErr, /2 or more/);
  c.runCmdLine('ttesti 25 4.2 1.1 4, unequal level(90)'); assert.equal(c.state.ttSum.kind, 'one');
  Object.assign(c.state, { ttAlt: 'gt', ttEqual: true, alphaSel: '0.05', ttSum: { kind: 'two', n1: '30', m1: '72.5', s1: '8.1', n2: '28', m2: '68.2', s2: '9.4', mu: '0', l1: 'x', l2: 'y' } }); c.clearMemo(); c.renderVals();
  const L = c._ttLast; assert.equal(L.stata, 'ttesti 30 72.5 8.1 28 68.2 9.4');
  // Stata 18 ttesti and R BSDA::tsum.test(..., var.equal = TRUE, alternative = "greater")
  assert.match(L.tblStata, /^Two-sample t test with equal variances\n/);
  assert.match(L.tblStata, /\n       x \|      30        72\.5    1\.478851         8\.1    69\.47541    75\.52459\n/);
  assert.match(L.tblStata, /\n    diff \|                 4\.3    2\.299474               -\.3063998      8\.9064\n/);
  assert.match(L.tblStata, /Degrees of freedom =       56\n/);
  assert.match(L.tblR, /\tStandard Two-Sample t-Test\n\ndata:  Summarized x and y\nt = 1\.87, df = 56, p-value = 0\.03336\nalternative hypothesis: true difference in means is greater than 0\n95 percent confidence interval:\n 0\.4540786        NA\n/);
});
