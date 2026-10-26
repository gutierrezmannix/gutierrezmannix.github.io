import * as D from '../../src/engine/lib/dist.mjs';
import { readFileSync } from 'node:fs';
const ref = JSON.parse(readFileSync(new URL('../../tests/engine/dist-ref.json', import.meta.url)));
const fn = {
  pnorm: x => D.pnorm(x), qnorm: p => D.qnorm(p), pt: (t, df) => D.pt(t, df), qt: (p, df) => D.qt(p, df), pchisq: (x, df) => D.pchisq(x, df, false), qchisq: (p, df) => D.qchisq(p, df),
  pf: (f, a, b) => D.pf(f, a, b, false), qf: (p, a, b) => D.qf(p, a, b), pbeta: (x, a, b) => D.pbeta(x, a, b), qbeta: (p, a, b) => D.qbeta(p, a, b), dbinom: (k, n, p) => D.dbinom(k, n, p), dhyper: (x, r, b, n) => D.dhyper(x, r, b, n),
  pnt: (t, df, ncp) => D.pnt(t, df, ncp), pnf: (f, a, b, n) => D.pnf(f, a, b, n, false), pnchisq: (x, df, n) => D.pnchisq(x, df, n), ptukey: (q, r, k, df) => D.ptukey(q, r, k, df), qtukey: (p, r, k, df) => D.qtukey(p, r, k, df),
  lgamma: x => D.lgamma(x), pgamma: (x, a) => D.pgamma(x, a), dnbinomMu: (x, s, m) => D.dnbinomMu(x, s, m), ppois: (x, l) => D.ppois(x, l),
  padjust_holm: p => D.padjust(p, 'holm'), padjust_hommel: p => D.padjust(p, 'hommel'), padjust_BY: p => D.padjust(p, 'BY'), padjust_hochberg: p => D.padjust(p, 'hochberg'), padjust_BH: p => D.padjust(p, 'BH'),
  uniroot: () => D.uniroot(x => x ** 3 - 2 * x - 5, 2, 3).root,
};
const tolOf = f => ({ pf: 1e-11, qf: 1e-11, pnt: 1e-9, pnf: 1e-7, pnchisq: 1e-9, ptukey: 1e-9, qtukey: 1e-9 })[f] || 1e-12;
const worst = {}; let bad = 0;
for (const r of ref) {
  if (!fn[r.f]) continue; const got = fn[r.f](...[].concat(r.args.length ? r.args : [])), exp = r.v;
  const g = [].concat(got), e = [].concat(exp);
  for (let i = 0; i < e.length; i++) {
    const err = e[i] === 0 ? Math.abs(g[i]) : Math.abs(g[i] - e[i]) / Math.abs(e[i]);
    worst[r.f] = Math.max(worst[r.f] || 0, err);
    if (!(err <= tolOf(r.f)) && !(Math.abs(g[i] - e[i]) < 1e-300)) { bad++; if (bad < 40) console.log('MISMATCH', r.f, JSON.stringify(r.args), 'got', g[i], 'R', e[i], 'rel', err); }
  }
}
console.log('worst relative error by function:'); for (const [k, v] of Object.entries(worst)) console.log(k.padEnd(18), v.toExponential(2));
console.log(bad ? bad + ' mismatches' : 'all within tolerance');
