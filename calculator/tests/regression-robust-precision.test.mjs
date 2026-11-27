// Build .114: robust / clustered standard errors keep full precision when a predictor is large relative to its
// spread, and a regression with one residual degree of freedom runs (as in Stata and R).
//   node --test calculator/tests/regression-robust-precision.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));

let s = 11; const u = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) + 0.5) / 4294967296; };
const z = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
const rel = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), what + ': ' + a + ' vs ' + b);

test('robust and clustered SEs do not change when a predictor is shifted far from zero (exact invariance)', () => {
  for (const [n, k] of [[6, 3], [10, 2], [60, 4], [400, 3]]) {
    const X = Array.from({ length: k }, () => Float64Array.from({ length: n }, () => z()));
    const y = Float64Array.from({ length: n }, (_, i) => 1 + X.reduce((a, x, j) => a + (j + 1) * 0.3 * x[i], 0) + Math.exp(0.6 * X[0][i]) * z());
    const cl = Array.from({ length: n }, (_, i) => String(i % Math.max(2, Math.floor(n / 3))));
    for (const vce of [{ type: 'robust' }, { type: 'cluster', cl }]) {
      const base = E.regress(y, X.map((a, j) => ({ name: 'x' + j, kind: 'num', a })), null, vce);
      for (const shift of [1e3, 1e5]) { // (much larger shifts reach the collinearity tolerance, as in R: the column is treated as constant)
        const far = E.regress(y, X.map((a, j) => ({ name: 'x' + j, kind: 'num', a: Float64Array.from(a, v => v + shift * (j + 1)) })), null, vce);
        for (let j = 1; j <= k; j++) {
          rel(far.coefs[j].se, base.coefs[j].se, 1e-7, `${vce.type} n=${n} shift ${shift} slope ${j} SE`);
          rel(far.coefs[j].t, base.coefs[j].t, 1e-7, `${vce.type} n=${n} shift ${shift} slope ${j} t`);
        }
        if (Number.isNaN(base.F)) assert.ok(Number.isNaN(far.F), 'model F missing in both (too few clusters, as Stata prints .)');
        else rel(far.F, base.F, 1e-7, `${vce.type} n=${n} shift ${shift} model F`);
      }
    }
  }
});

test('robust SEs agree with statsmodels HC1 (50-digit check) when values are around 1e5 with spread 1', () => {
  // y and x from a fixed recipe; statsmodels / mpmath give slope SE 0.06395489836 and robust F 14.68604468 (n = 12)
  const x = Float64Array.from([100000.3, 99999.1, 100001.7, 100000.0, 99998.6, 100002.2, 100000.9, 99999.5, 100001.1, 99997.9, 100000.4, 100001.5]);
  const y = Float64Array.from([3.1, 1.2, 4.9, 2.6, 0.4, 5.7, 3.3, 2.0, 4.1, 0.2, 2.9, 4.4]);
  const m = E.regress(y, [{ name: 'x', kind: 'num', a: x }], null, { type: 'robust' });
  const c = E.regress(y, [{ name: 'x', kind: 'num', a: Float64Array.from(x, v => v - 100000) }], null, { type: 'robust' });
  rel(m.coefs[1].se, c.coefs[1].se, 1e-10, 'slope SE equals the centred fit');
  rel(m.F, c.F, 1e-9, 'robust F equals the centred fit');
});

test('one residual degree of freedom is enough (n = parameters + 1), as in Stata and R', () => {
  const X = [[1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 6, 4], [5, 3, 2, 6, 1, 2], [1, 1, 2, 3, 5, 8]].map(a => Float64Array.from(a));
  const y = Float64Array.from([3, 4, 8, 7, 11, 12]);
  const m = E.regress(y, X.map((a, j) => ({ name: 'x' + j, kind: 'num', a })), null, null);
  assert.ok(!m.error, m.error); assert.equal(m.n, 6); assert.equal(m.df2, 1);
  m.coefs.forEach(c => assert.ok(Number.isFinite(c.se) && Number.isFinite(c.p), c.term));
  const r = E.regress(y.slice(0, 5), X.map((a, j) => ({ name: 'x' + j, kind: 'num', a: a.slice(0, 5) })), null, null);
  assert.match(r.error || '', /not enough complete rows \(5\) for 5 parameters/, 'no residual degree of freedom: refused');
});
