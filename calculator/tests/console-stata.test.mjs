// Console commands as Stata prints them (build .55): reference values from SciPy / pandas (Stata's definitions).
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
const parse = async source => { const b = Buffer.from(source); return E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {}); };
const CSV = "y,g,x,z,hi\n1.0,A,0.0,0,no\n14.0,B,7.5,1,no\n7.6,B,2.0,4,no\n9.6,A,9.5,9,yes\n10.6,B,2.0,,no\n14.6,B,9.5,3,no\n6.2,A,4.0,3,no\n12.2,B,11.5,5,no\n11.2,B,4.0,9,yes\n,A,11.5,4,no\n8.8,B,6.0,1,no\n19.8,B,13.5,0,no\n9.8,A,6.0,1,no\n5.4,B,0.5,4,no\n9.4,B,8.0,9,yes\n8.0,A,2.5,5,no\n12.4,B,8.0,3,no\n6.0,B,2.5,3,no\n15.0,A,10.0,5,no\n,B,4.5,9,yes\n13.0,B,10.0,4,no\n4.6,A,4.5,1,no\n17.6,B,12.0,0,no\n11.2,B,6.5,1,no\n11.6,A,12.0,4,no\n14.2,B,6.5,9,yes\n7.8,B,1.0,5,no\n9.8,A,8.5,3,no\n3.8,B,1.0,3,no\n,B,8.5,5,no\n6.4,A,3.0,9,yes\n12.4,B,10.5,4,no\n11.4,B,3.0,1,no\n13.4,A,10.5,0,no\n9.0,B,5.0,1,no\n13.0,B,12.5,4,no\n10.0,A,5.0,9,yes\n16.0,B,12.5,5,no\n9.6,B,7.0,3,no\n,A,1.5,3,no";
const setup = async (csv = CSV) => {
  const raw = await parse(csv), c = new C(); c._E = E; c._raw = raw; c.jumpArm = () => {};
  c.state = { ...c.state, cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, screen: 'work', tab: 'one', autoScreen: true };
  return c;
};
const run = (c, cmd) => { c.runCmdLine(cmd); clearTimeout(c._mfOkT); assert.equal(c.state.mfCmdErr, '', cmd + ': ' + c.state.mfCmdErr); return c.state.conLog.at(-1); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const num = (text, label) => { const m = text.match(new RegExp(esc(label) + '\\s*\\|?\\s*(-?[\\d.,]+(?:e[-+]?\\d+)?)')); assert.ok(m, label + ' in\n' + text); return Number(m[1].replace(/,/g, '')); };
const close = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), a + ' vs ' + b);

test('summarize keeps every variable; detail prints Stata percentiles, skewness and kurtosis', async () => {
  const c = await setup();
  let d = run(c, 'summarize y x z');
  assert.equal(d.t, 'cx'); assert.equal(c.cmdText(d, 'stata'), 'summarize y x z');
  for (const v of ['y', 'x', 'z']) assert.match(d.tbl, new RegExp('\\n\\s+' + v + ' \\|'));
  assert.match(d.tbl, /\s+y \|\s+36\s+10\.45556\s+3\.952464\s+1\s+19\.8/);
  d = run(c, 'summarize y, detail');
  for (const [lab, v] of [[' 1%', 1], [' 5%', 3.8], ['10%', 5.4], ['25%', 7.9], ['50%', 10.3], ['75%', 13], ['90%', 15], ['95%', 17.6], ['99%', 19.8]]) close(num(d.tbl, lab), v);
  close(num(d.tbl, 'Skewness'), -0.0352751485818799); close(num(d.tbl, 'Kurtosis'), 3.0581014523925387); close(num(d.tbl, 'Obs'), 36);
  d = run(c, 'mean y'); assert.match(d.tbl, /Number of obs =\s+36/); assert.match(d.tbl, /y \|\s+10\.45556\s+\.6587439\s+9\.118234\s+11\.79288/);
  d = run(c, 'tabstat y x, stats(mean n p50)'); assert.match(d.tbl, /Mean \|\s+10\.45556/); assert.match(d.tbl, /N \|\s+36\s+40/);
});

test('an if typed in the console applies to that command only', async () => {
  const c = await setup();
  c.runCmdLine('summarize y if g == "A"'); clearTimeout(c._mfOkT);
  assert.equal(c.state.subg.all.length, 1, 'the page shows the subgroup while the command runs');
  run(c, 'summarize x');
  assert.equal((c.state.subg.all || []).length, 0, 'the next command puts back the Subgroup bar');
  let d = run(c, 'count if g == "B"'); assert.equal(d.res, 'count = 26');
  d = run(c, 'summarize y x if g == "A"'); assert.match(d.tbl, /\s+y \|\s+12\s+8\.783333/); assert.equal(c.cmdText(d, 'stata'), 'summarize y x if g == "A"');
  assert.equal((c.state.subg.all || []).length, 0, 'console-only commands never touch the Subgroup bar');
  c.runCmdLine('summarize y if x >= 2 & x <= 5'); clearTimeout(c._mfOkT); assert.equal(c.state.subg.all.length, 2, 'two conditions on the same variable both apply');
});

test('two-way tabulate, correlate, pwcorr and the pooled t-test print what Stata prints', async () => {
  const c = await setup();
  let d = c.cxTab2('g', 'hi', null, null, { row: true, chi2: true });
  assert.match(d.tbl, /A \|\s+11\s+3 \|\s+14/); assert.match(d.tbl, /B \|\s+22\s+4 \|\s+26/); assert.match(d.tbl, /\| row percentage \|/);
  assert.match(d.tbl, /78\.57\s+21\.43 \|\s+100\.00/); assert.match(d.tbl, /Pearson chi2\(1\) =\s+0\.2302\s+Pr = 0\.631/);
  d = run(c, 'correlate y x z'); assert.match(d.tbl, /^\(obs=35\)/); assert.match(d.tbl, /x \|\s+0\.8292\s+1\.0000/); assert.match(d.tbl, /z \|\s+-0\.0478\s+-0\.0562\s+1\.0000/);
  d = run(c, 'pwcorr y x z, sig obs'); assert.match(d.tbl, /x \|\s+0\.8112\s+1\.0000/); assert.match(d.tbl, /\|\s+36\s+40/); assert.match(d.tbl, /\|\s+0\.7850\s+0\.7128/);
  d = run(c, 'ttest y, by(g)'); assert.match(d.tbl, /^Two-sample t test with equal variances/); assert.match(d.tbl, /t =\s+-1\.8567/); assert.match(d.tbl, /Degrees of freedom =\s+34/); assert.match(d.tbl, /Pr\(\|T\| > \|t\|\) = 0\.0720/); assert.match(d.tbl, /Combined \|\s+36/);
  assert.equal(c.cmdText(d, 'r'), 't.test(y ~ g, data = df, var.equal = TRUE)');
  d = run(c, 't.test(y ~ g, data = df, var.equal = TRUE)'); assert.match(d.tbl, /t =\s+-1\.8567/);
  c.runCmdLine('tab g hi x'); clearTimeout(c._mfOkT); assert.match(c.state.mfCmdErr, /tab2/);
});

test('numeric predictors typed without i. are continuous; factor levels in code order', async () => {
  const c = await setup();
  c.runCmdLine('regress y x i.g'); clearTimeout(c._mfOkT);
  assert.equal(c.state.treat.x, 'numeric'); assert.equal(c.state.treat.g, 'categorical');
  c.runCmdLine('regress y z'); clearTimeout(c._mfOkT); assert.equal(c.state.treat.z, 'numeric', 'z (read as categories) is a slope when typed without i.');
  const labelled = await setup('v,y\n0,1\n4,2\n4,3\n4,5\n2,4\n2,6'); labelled._raw.vlabs.v = new Map([[0, 'None'], [2, 'Ambiguous'], [4, 'Yes']]);
  assert.deepEqual(labelled.descOrder('v', [{ label: 'Yes' }, { label: 'Ambiguous' }, { label: 'None' }]).map(r => r.label), ['None', 'Ambiguous', 'Yes']);
});

test('destring follows Stata: refuses text without force; dpcomma and ignore() read commas', async () => {
  const c = await setup('a,b,t\n"1,5","1,234",x\n"2,25","12,000",y\n"3,0","5",z');
  c.runCmdLine('destring a, replace'); clearTimeout(c._mfOkT); assert.match(c.state.mfCmdErr, /nonnumeric characters/); assert.match(c.state.mfCmdErr, /dpcomma/); assert.equal(c._raw.cols[0].k, 's', 'nothing changed');
  run(c, 'destring a, replace dpcomma'); assert.deepEqual(Array.from(c._raw.cols[0].a), [1.5, 2.25, 3]);
  const d = c.state.conLog.at(-1); assert.equal(c.cmdText(d, 'stata'), 'destring a, replace dpcomma'); assert.equal(c.cmdText(d, 'r'), 'df$a <- as.numeric(sub(",", ".", df$a, fixed = TRUE))');
  run(c, 'destring b, generate(b2) ignore(",")'); assert.deepEqual(Array.from(c._raw.cols[c._raw.names.indexOf('b2')].a), [1234, 12000, 5]);
  c.runCmdLine('destring t, replace'); clearTimeout(c._mfOkT); assert.match(c.state.mfCmdErr, /force/);
  run(c, 'destring t, replace force'); assert.ok(Array.from(c._raw.cols[2].a).every(Number.isNaN));
  c.runCmdLine('destring a, replace'); clearTimeout(c._mfOkT); assert.match(c.state.mfCmdErr, /already numeric/);
});

test('files: decimal commas in semicolon files, scripts that read them, and missing-value codes', async () => {
  const raw = await parse('país;nota;ingreso\nMéxico;7,5;1.234,5\nPerú;8,25;980\nChile;;2.000');
  assert.deepEqual(raw.csv, { delim: ';', decComma: true }); assert.deepEqual(Array.from(raw.cols[1].a).map(v => Number.isNaN(v) ? null : v), [7.5, 8.25, null]); assert.deepEqual(Array.from(raw.cols[2].a), [1234.5, 980, 2000]);
  const c = await setup('país;nota\nMéxico;7,5\nPerú;8,25'); c.state.fileName = 'notas.csv';
  assert.equal(c.cxImportCmd('stata'), 'import delimited "notas.csv", delimiters(";") decimalseparator(,) groupseparator(.) clear');
  assert.equal(c.cxImportCmd('r'), 'df <- read.csv2("notas.csv", na.strings = c("", "NA"))');
  c.state.fileName = 'datos.xlsx'; assert.equal(c.cxImportCmd('stata'), 'import excel "datos.xlsx", firstrow clear');
  // a value that looks like a code is kept when screening it would leave a single value (0 / 66: a 66% supermajority)
  const keep = await parse('v\n0\n0\n0\n0\n66'); assert.deepEqual(E.profileCol(keep, 0, true).autoCodes, []);
  const code = await parse('v\n1\n2\n3\n4\n5\n99\n2\n3'); assert.deepEqual(E.profileCol(code, 0, true).autoCodes, [99]);
});
