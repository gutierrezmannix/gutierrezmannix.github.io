// T-tests from summaries, proportions and categorical tests, nonparametric tests, power and precision,
// classification performance and missing-data summaries — ports of the corresponding blocks in
// src/analysis-methods.R and of R's prop.test, binom.test, chisq.test, fisher.test, mcnemar.test,
// wilcox.test, kruskal.test, friedman.test and pwr::pwr.*.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import { Factor, isFactor, isNA, need, fmtR } from '../lib/frame.mjs';
import { test, htestPrint, rank, tieCounts, sum, mean, quantile7, asChar } from '../lib/stats.mjs';
import { svgPlot } from '../lib/plot.mjs';
import { printTable } from '../lib/print.mjs';

// ---------- t-tests from summaries ----------
register(['summary_t1', 'summary_t2', 'summary_tp'], ctx => {
  const { id, num, alpha } = ctx; let est, se, df;
  if (id === 'summary_tp') { const m = num('meanDifference'), sdv = num('sdDifference', 0, { min: 0 }), n = num('pairs', 0, { min: 2, integer: true }); se = sdv / Math.sqrt(n); df = n - 1; est = m - num('null'); ctx.used = n; }
  else {
    const m1 = num('mean1'), s1 = num('sd1', 0, { min: 0 }), n1 = num('n1', 0, { min: 2, integer: true });
    if (id === 'summary_t1') { est = m1 - num('null'); se = s1 / Math.sqrt(n1); df = n1 - 1; ctx.used = n1; }
    else { const m2 = num('mean2'), s2 = num('sd2', 0, { min: 0 }), n2 = num('n2', 0, { min: 2, integer: true }), v1 = s1 * s1 / n1, v2 = s2 * s2 / n2; est = m1 - m2; se = Math.sqrt(v1 + v2); df = (v1 + v2) ** 2 / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1)); ctx.used = n1 + n2; }
  }
  need(se > 0, 'The summaries imply zero standard error.');
  const tv = est / se, q = D.qt(1 - alpha / 2, df);
  ctx.table('Results', ['Estimate', 'SE', 't', 'DF', 'P', 'Lower', 'Upper'], [[est, se, tv, df, 2 * D.pt(-Math.abs(tv), df), est - q * se, est + q * se]]);
});

// ---------- proportions ----------
export function binomTest(x, n, p, level) {
  const relErr = 1 + 1e-7, d = D.dbinom(x, n, p), m = n * p; let pv;
  if (x === m) pv = 1;
  else if (x < m) { let y = 0; for (let i = Math.ceil(m); i <= n; i++) if (D.dbinom(i, n, p) <= d * relErr) y++; pv = D.pbinom(x, n, p) + D.pbinom(n - y, n, p, false); }
  else { let y = 0; for (let i = 0; i <= Math.floor(m); i++) if (D.dbinom(i, n, p) <= d * relErr) y++; pv = D.pbinom(y - 1, n, p) + D.pbinom(x - 1, n, p, false); }
  const a = 1 - level, lo = x === 0 ? 0 : D.qbeta(a / 2, x, n - x + 1), hi = x === n ? 1 : D.qbeta(1 - a / 2, x + 1, n - x);
  return { statistic: x, statName: 'number of successes', parameter: [n], paramNames: ['number of trials'], p: Math.min(1, pv), method: 'Exact binomial test', estimate: [['probability of success', x / n]], conf: [lo, hi], level, alternative: 'two.sided', altText: 'probability of success', null: p };
}
function propTest(ctx, x, n, p, level) {
  const k = x.length, z = D.qnorm((1 + level) / 2); let est, cint, E, stat, param, method;
  if (k === 1) {
    const e = x[0] / n[0], z22n = z * z / (2 * n[0]);
    const pu = (e + z22n + z * Math.sqrt(e * (1 - e) / n[0] + z22n / (2 * n[0]))) / (1 + 2 * z22n), pl = (e + z22n - z * Math.sqrt(e * (1 - e) / n[0] + z22n / (2 * n[0]))) / (1 + 2 * z22n);
    est = [['p', e]]; cint = [Math.max(pl, 0), Math.min(pu, 1)]; E = [[n[0] * p, n[0] * (1 - p)]]; param = 1; method = '1-sample proportions test without continuity correction';
  } else {
    const e = x.map((v, i) => v / n[i]), delta = e[0] - e[1], width = z * Math.sqrt(sum(e.map((v, i) => v * (1 - v) / n[i])));
    est = e.map((v, i) => ['prop ' + (i + 1), v]); cint = [Math.max(delta - width, -1), Math.min(delta + width, 1)];
    const pp = sum(x) / sum(n); E = n.map(v => [v * pp, v * (1 - pp)]); param = k - 1; method = k + '-sample test for equality of proportions without continuity correction';
  }
  const obs = x.map((v, i) => [v, n[i] - v]); stat = 0; obs.forEach((r, i) => r.forEach((o, j) => { stat += (o - E[i][j]) ** 2 / E[i][j]; }));
  if (E.flat().some(v => v < 5)) ctx.warn('Chi-squared approximation may be incorrect');
  return { statistic: stat, statName: 'X-squared', parameter: [param], p: D.pchisq(stat, param, false), method, estimate: est, conf: cint, level, alternative: 'two.sided' };
}
register(['prop1', 'prop2', 'binomial'], ctx => {
  const { id, num, opt } = ctx; let sx, ns;
  if (opt('inputMode', 'raw') === 'summary') {
    sx = id === 'prop2' ? [num('successes1', 0, { min: 0, integer: true }), num('successes2', 0, { min: 0, integer: true })] : [num('successes', 0, { min: 0, integer: true })];
    ns = id === 'prop2' ? [num('trials1', 0, { min: 1, integer: true }), num('trials2', 0, { min: 1, integer: true })] : [num('trials', 0, { min: 1, integer: true })];
  } else {
    ctx.clean(); const yy = ctx.value('y'); need(!isFactor(yy) && yy.every(v => v === 0 || v === 1), 'Outcome must be coded 0/1.');
    if (id === 'prop2') { const gg = ctx.group(ctx.value('group'), 2); sx = gg.levels.map((_, j) => sum(yy.filter((_, i) => gg.codes[i] === j))); ns = gg.counts(); ctx.note('First minus second: ' + gg.levels.join(' minus ')); }
    else { sx = [sum(yy)]; ns = [yy.length]; }
  }
  need(sx.every((v, i) => v <= ns[i]), 'Successes cannot exceed trials.'); ctx.used = sum(ns);
  const h = id === 'binomial' ? binomTest(sx[0], ns[0], num('null', 0.5, { min: 0, max: 1 }), ctx.level) : propTest(ctx, sx, ns, id === 'prop2' ? null : num('null', 0.5, { min: 0, max: 1 }), ctx.level);
  test(ctx, h);
  ctx.table('Sample proportions', ['Group', 'Successes', 'Trials', 'Proportion'], sx.map((v, i) => [i + 1, v, ns[i], v / ns[i]]));
});

// ---------- goodness of fit, Fisher, McNemar ----------
function tab2(a, b, la = null, lb = null) {
  const mk = (v, lv) => lv ? new Factor(isFactor(v) ? v.values() : v.map(x => typeof x === 'number' ? fmtR(x) : x), lv) : isFactor(v) ? v : new Factor(v);
  const fa = mk(a, la), fb = mk(b, lb);
  const z = fa.levels.map(() => fb.levels.map(() => 0)); for (let i = 0; i < fa.codes.length; i++) { const r = fa.codes[i], c = fb.codes[i]; if (r !== null && c !== null) z[r][c]++; }
  return { z, rows: fa.levels, cols: fb.levels };
}
function fisherRxC(z) {
  const r = z.length, c = z[0].length, rs = z.map(row => sum(row)), cs = z[0].map((_, j) => sum(z.map(row => row[j]))), n = sum(rs);
  const lf = k => D.lgamma(k + 1), base = sum(rs.map(lf)) + sum(cs.map(lf)) - lf(n);
  const lp = t => base - sum(t.flat().map(lf)), pObs = lp(z), relErr = 1 + 1e-7;
  let total = 0, states = 0; const cur = rs.slice(), cells = z.map(row => row.map(() => 0)), limit = 1.5e6;
  const fill = (j) => {
    if (j === c - 1) { for (let i = 0; i < r; i++) cells[i][j] = cur[i]; const v = lp(cells); if (v <= pObs + Math.log(relErr)) total += Math.exp(v); return; }
    const split = (i, left) => {
      if (++states > limit) throw new RangeError('enumeration limit');
      if (i === r - 1) { if (left > cur[i]) return; cells[i][j] = left; cur[i] -= left; fill(j + 1); cur[i] += left; return; }
      const maxRest = sum(cur.slice(i + 1)); for (let v = Math.max(0, left - maxRest); v <= Math.min(cur[i], left); v++) { cells[i][j] = v; cur[i] -= v; split(i + 1, left - v); cur[i] += v; }
    };
    split(0, cs[j]);
  };
  try { fill(0); } catch (e) { if (e instanceof RangeError) return null; throw e; }
  return Math.min(1, total);
}
// R's fisher.test(simulate.p.value = TRUE): Patefield's AS 159 random tables (rcont2) with R's RNG
function fisherSim(z, B, rng) {
  const nrow = z.length, ncol = z[0].length, nrowt = z.map(r => sum(r)), ncolt = z[0].map((_, j) => sum(z.map(r => r[j]))), ntotal = sum(nrowt);
  const fact = new Float64Array(ntotal + 1); for (let i = 2; i <= ntotal; i++) fact[i] = fact[i - 1] + Math.log(i);
  const jwork = new Int32Array(ncol), mat = new Int32Array(nrow * ncol), nr_1 = nrow - 1, nc_1 = ncol - 1;
  const stat = -sum(z.flat().map(v => D.lgamma(v + 1))), almost1 = 1 + 64 * 2.220446049250313e-16; let hits = 0;
  for (let iter = 0; iter < B; iter++) {
    let ib = 0; for (let j = 0; j < nc_1; ++j) jwork[j] = ncolt[j];
    let jc = ntotal;
    for (let l = 0; l < nr_1; ++l) {
      let ia = nrowt[l], ic = jc; jc -= ia; let m;
      for (m = 0; m < nc_1; ++m) {
        const id = jwork[m], ie = ic; ib = ie - ia; const ii = ib - id; ic -= id;
        if (ie === 0) { for (let j = m; j < nc_1; ++j) mat[l + j * nrow] = 0; ia = 0; break; }
        let U = rng.unif(), nlm;
        outer: for (;;) {
          nlm = Math.trunc(ia * (id / ie) + 0.5);
          let x = Math.exp(fact[ia] + fact[ib] + fact[ic] + fact[id] - fact[ie] - fact[nlm] - fact[id - nlm] - fact[ia - nlm] - fact[ii + nlm]);
          if (x >= U) break;
          if (x === 0) throw new Error('rcont2 [' + l + ',' + m + ']: exp underflow to 0; algorithm failure');
          let sumprb = x, y = x, nll = nlm, lsp;
          do {
            let j = (id - nlm) * (ia - nlm); lsp = nlm === ia || nlm === id;
            if (!lsp) { ++nlm; x *= j / (nlm * (ii + nlm)); sumprb += x; if (sumprb >= U) break outer; }
            let lsm;
            do { j = nll * (ii + nll); lsm = nll === 0; if (!lsm) { --nll; y *= j / ((id - nll) * (ia - nll)); sumprb += y; if (sumprb >= U) { nlm = nll; break outer; } if (!lsp) break; } } while (!lsm);
          } while (!lsp);
          U = sumprb * rng.unif();
        }
        mat[l + m * nrow] = nlm; ia -= nlm; jwork[m] -= nlm;
      }
      mat[l + nc_1 * nrow] = ia;
    }
    for (let m = 0; m < nc_1; ++m) mat[nr_1 + m * nrow] = jwork[m];
    mat[nr_1 + nc_1 * nrow] = ib - mat[nr_1 + (nc_1 - 1) * nrow];
    let ans = 0; for (let k = 0; k < nrow * ncol; k++) ans -= fact[mat[k]];
    if (ans <= stat / almost1) hits++;
  }
  return (1 + hits) / (B + 1);
}
function fisher2x2(z, level) {
  const m = z[0][0] + z[1][0], n = z[0][1] + z[1][1], k = z[0][0] + z[0][1], x = z[0][0], lo = Math.max(0, k - n), hi = Math.min(k, m);
  const support = []; for (let s = lo; s <= hi; s++) support.push(s);
  const logdc = support.map(s => D.dhyper(s, m, n, k, true));
  const dnhyper = ncp => { const d = logdc.map((l, i) => l + Math.log(ncp) * support[i]), mx = Math.max(...d), e = d.map(v => Math.exp(v - mx)), s = sum(e); return e.map(v => v / s); };
  const mnhyper = ncp => ncp === 0 ? lo : ncp === Infinity ? hi : sum(support.map((s, i) => s * dnhyper(ncp)[i]));
  const phyper = (q, upper) => { let s = 0; support.forEach((v, i) => { if (upper ? v >= q : v <= q) s += Math.exp(logdc[i]); }); return s; };
  const pnhyper = (q, ncp, upper = false) => { if (ncp === 1) return upper ? phyper(x, true) : phyper(x, false); if (ncp === 0) return Number(upper ? q <= lo : q >= lo); if (ncp === Infinity) return Number(upper ? q <= hi : q >= hi); const d = dnhyper(ncp); return sum(d.filter((_, i) => upper ? support[i] >= q : support[i] <= q)); };
  const d1 = dnhyper(1), relErr = 1 + 1e-7, pv = sum(d1.filter(v => v <= d1[x - lo] * relErr));
  const root = (f, a, b) => D.uniroot(f, a, b).root, eps = 2.220446049250313e-16;
  const mle = () => { if (x === lo) return 0; if (x === hi) return Infinity; const mu = mnhyper(1); if (mu > x) return root(t => mnhyper(t) - x, 0, 1); if (mu < x) return 1 / root(t => mnhyper(1 / t) - x, eps, 1); return 1; };
  const ncpU = (a) => { if (x === hi) return Infinity; const p = pnhyper(x, 1); if (p < a) return root(t => pnhyper(x, t) - a, 0, 1); if (p > a) return 1 / root(t => pnhyper(x, 1 / t) - a, eps, 1); return 1; };
  const ncpL = (a) => { if (x === lo) return 0; const p = pnhyper(x, 1, true); if (p > a) return root(t => pnhyper(x, t, true) - a, 0, 1); if (p < a) return 1 / root(t => pnhyper(x, 1 / t, true) - a, eps, 1); return 1; };
  const a = (1 - level) / 2;
  return { statistic: null, parameter: null, p: Math.min(1, pv), method: "Fisher's Exact Test for Count Data", estimate: [['odds ratio', mle()]], conf: [ncpL(a), ncpU(a)], level, alternative: 'two.sided', altText: 'odds ratio', null: 1 };
}
register(['gof', 'fisher', 'mcnemar', 'mcnemar_exact'], ctx => {
  const { id, opt } = ctx; let z, rows = null, cols = null;
  if (opt('inputMode', 'raw') === 'summary') {
    if (id === 'gof') z = ctx.numbers(opt('counts', ''));
    else { z = ctx.countTable(opt('table', '')); if (z.length === 1 && z[0].length === 4) z = [[z[0][0], z[0][1]], [z[0][2], z[0][3]]]; }
  } else {
    ctx.clean();
    if (id === 'gof') { const gv = ctx.value('group'), f = isFactor(gv) ? gv : new Factor(gv); z = f.counts(); rows = f.levels; }
    else if (id === 'fisher') { const t = tab2(ctx.value('group'), ctx.value('group2')); z = t.z; rows = t.rows; cols = t.cols; }
    else { const a = ctx.value('y'), b = ctx.value('y2'); need(!isFactor(a) && !isFactor(b) && a.every(v => v === 0 || v === 1) && b.every(v => v === 0 || v === 1), 'Paired outcomes must be coded 0/1.'); const t = tab2(a, b, ['0', '1'], ['0', '1']); z = t.z; rows = t.rows; cols = t.cols; }
  }
  ctx.used = sum([].concat(...[z]).flat());
  let h;
  if (id === 'gof') {
    let p = opt('expected', ''); p = String(p).length ? ctx.numbers(p) : z.map(() => 1 / z.length);
    need(z.every(v => v >= 0 && v === Math.floor(v)) && sum(z) > 0, 'Observed counts must be nonnegative integers with a positive total.');
    need(p.length === z.length && p.every(v => v > 0) && Math.abs(sum(p) - 1) < 1e-7, 'Expected probabilities must match categories and sum to one.');
    const n = sum(z), E = p.map(v => n * v), stat = sum(z.map((o, i) => (o - E[i]) ** 2 / E[i]));
    if (E.some(v => v < 5)) ctx.warn('Chi-squared approximation may be incorrect');
    h = { statistic: stat, statName: 'X-squared', parameter: [z.length - 1], p: D.pchisq(stat, z.length - 1, false), method: 'Chi-squared test for given probabilities', alternative: null };
    ctx.table('Counts', ['Observed', 'Expected'], z.map((o, i) => [o, E[i]]));
  } else if (id === 'fisher') {
    need(z.length >= 2 && z[0].length >= 2, "'x' must have at least 2 rows and columns");
    if (z.length === 2 && z[0].length === 2) h = fisher2x2(z, ctx.level);
    else {
      let p = fisherRxC(z), method = "Fisher's Exact Test for Count Data";
      if (p === null) { const B = 1e5; p = fisherSim(z, B, ctx.rng); method += ' with simulated p-value\n\t (based on 1e+05 replicates)'; ctx.note('This table is too large to enumerate every possible table (R stops with an FEXACT workspace error), so the exact p-value is estimated from 100,000 random tables with the same margins, as fisher.test(simulate.p.value = TRUE, B = 1e5) does in R.'); }
      h = { statistic: null, parameter: null, p, method, alternative: 'two.sided' };
    }
  } else {
    need(z.length === 2 && z[0].length === 2, 'A 2×2 paired count table is required.'); need(z[0][1] + z[1][0] > 0, 'There are no discordant pairs.');
    if (id === 'mcnemar_exact') h = binomTest(z[0][1], z[0][1] + z[1][0], 0.5, ctx.level);
    else { const b = z[0][1], c = z[1][0], stat = (Math.abs(b - c) - 1) ** 2 / (b + c); h = { statistic: stat, statName: "McNemar's chi-squared", parameter: [1], p: D.pchisq(stat, 1, false), method: "McNemar's Chi-squared test with continuity correction", alternative: null }; }
  }
  if (id === 'mcnemar_exact') {
    // Discordant pairs, both directions and the exact p; the share and the conditional odds ratio with exact intervals.
    const b = z[0][1], c = z[1][0], [lo, hi] = h.conf;
    ctx.table('Exact McNemar test', ['Discordant.pairs', 'Changed.0.to.1', 'Changed.1.to.0', 'P.exact'], [[b + c, b, c, h.p]]);
    ctx.table('Effect size (' + 100 * ctx.level + '% exact interval)', ['Measure', 'Estimate', 'Lower', 'Upper'], [['Share of changes that go 0 to 1', b / (b + c), lo, hi], ['Odds ratio of change (0 to 1 / 1 to 0)', b / c, lo / (1 - lo), hi / (1 - hi)]]);
    ctx.note('Exact two-sided binomial test of the discordant pairs: under no change, moves 0 to 1 and 1 to 0 are equally likely. The odds ratio is the conditional odds ratio of matched pairs (as Stata mcc reports); its interval is the exact Clopper-Pearson interval for the share, transformed.');
    ctx.diag(htestPrint({ ...h, data: 'z[1, 2] and z[1, 2] + z[2, 1]' }));
  } else { test(ctx, h); if (h.alternative === null) ctx.diag(htestPrint(h)); }
  if (id !== 'gof') { const cn = cols || z[0].map((_, j) => 'V' + (j + 1)), rn = rows || z.map((_, i) => String(i + 1)); ctx.table('Count table', ['Term', ...cn], z.map((r, i) => [rn[i], ...r])); }
});

// ---------- nonparametric ----------
function wilcoxTwo(x, y, level) {
  const nx = x.length, ny = y.length, r = rank([...x, ...y]), W = sum(r.slice(0, nx)) - nx * (nx + 1) / 2;
  const sigmaOf = rr => Math.sqrt((nx * ny / 12) * ((nx + ny + 1) - sum(tieCounts(rr).map(t => t ** 3 - t)) / ((nx + ny) * (nx + ny - 1))));
  let z = W - nx * ny / 2; const SIG = sigmaOf(r), corr = Math.sign(z) * 0.5; z = (z - corr) / SIG;
  const p = 2 * Math.min(D.pnorm(z), D.pnorm(z, 0, 1, false));
  const mumin = Math.min(...x) - Math.max(...y), mumax = Math.max(...x) - Math.min(...y);
  let correct = true;
  const wdiff = (d, zq) => { const dr = rank([...x.map(v => v - d), ...y]), dz = sum(dr.slice(0, nx)) - nx * (nx + 1) / 2 - nx * ny / 2, cc = correct ? Math.sign(dz) * 0.5 : 0, s = sigmaOf(dr); if (s === 0) throw new Error('cannot compute confidence interval when all observations are tied'); return (dz - cc) / s - zq; };
  const root = zq => { const fl = wdiff(mumin, zq), fu = wdiff(mumax, zq); if (fl <= 0) return mumin; if (fu >= 0) return mumax; return D.uniroot(d => wdiff(d, zq), mumin, mumax, { tol: 1e-4 }).root; };
  const a = 1 - level, cint = [root(D.qnorm(a / 2, 0, 1, false)), root(D.qnorm(a / 2))];
  correct = false; const est = D.uniroot(d => wdiff(d, 0), mumin, mumax, { tol: 1e-4 }).root;
  return { statistic: W, statName: 'W', parameter: null, p, method: 'Wilcoxon rank sum test with continuity correction', estimate: [['difference in location', est]], conf: cint, level, alternative: 'two.sided', altText: 'location shift' };
}
function wilcoxSigned(x0, level) {
  let x = x0.filter(v => v !== 0); const n = x.length, r = rank(x.map(Math.abs)), V = sum(r.filter((_, i) => x[i] > 0));
  const sigOf = (nn, rr) => Math.sqrt(nn * (nn + 1) * (2 * nn + 1) / 24 - sum(tieCounts(rr).map(t => t ** 3 - t)) / 48);
  let z = V - n * (n + 1) / 4; const SIG = sigOf(n, r); z = (z - Math.sign(z) * 0.5) / SIG;
  const p = 2 * Math.min(D.pnorm(z), D.pnorm(z, 0, 1, false));
  const mumin = Math.min(...x), mumax = Math.max(...x); let correct = true;
  const wdiff = (d, zq) => { const xd = x.map(v => v - d).filter(v => v !== 0), nn = xd.length, dr = rank(xd.map(Math.abs)), zd = sum(dr.filter((_, i) => xd[i] > 0)) - nn * (nn + 1) / 4, s = sigOf(nn, dr); if (s === 0) throw new Error('cannot compute confidence interval when all observations are zero or tied'); const cc = correct ? Math.sign(zd) * 0.5 : 0; return (zd - cc) / s - zq; };
  const root = zq => { const fl = wdiff(mumin, zq), fu = wdiff(mumax, zq); if (fl <= 0) return mumin; if (fu >= 0) return mumax; return D.uniroot(d => wdiff(d, zq), mumin, mumax, { tol: 1e-4 }).root; };
  const a = 1 - level, cint = [root(D.qnorm(a / 2, 0, 1, false)), root(D.qnorm(a / 2))];
  correct = false; const est = D.uniroot(d => wdiff(d, 0), mumin, mumax, { tol: 1e-4 }).root;
  return { statistic: V, statName: 'V', parameter: null, p, method: 'Wilcoxon signed rank test with continuity correction', estimate: [['(pseudo)median', est]], conf: cint, level, alternative: 'two.sided', altText: 'location shift' };
}
register(['mannwhitney', 'signedrank', 'kruskal', 'friedman'], ctx => {
  const { id } = ctx; ctx.clean(); const yy = ctx.value('y'); need(!isFactor(yy), 'Choose a numeric outcome.');
  if (id === 'mannwhitney') {
    const gg = ctx.group(ctx.value('group'), 2), x = yy.filter((_, i) => gg.codes[i] === 0), y = yy.filter((_, i) => gg.codes[i] === 1), h = wilcoxTwo(x, y, ctx.level);
    test(ctx, h); const tb = gg.counts(); ctx.table('Effect size', ['Rank.biserial'], [[2 * h.statistic / (tb[0] * tb[1]) - 1]]);
    ctx.note('Rank-sum inference concerns distribution/location. A median interpretation requires additional shape assumptions.');
  } else if (id === 'signedrank') {
    const y2 = ctx.value('y2'); need(yy.some((v, i) => v !== y2[i]), 'All paired differences are zero.'); test(ctx, wilcoxSigned(yy.map((v, i) => v - y2[i]), ctx.level));
  } else if (id === 'kruskal') {
    const gg = ctx.group(ctx.value('group')), n = yy.length, r = rank(yy), k = gg.nlevels, sums = new Array(k).fill(0), cnt = gg.counts(); r.forEach((v, i) => { sums[gg.codes[i]] += v; });
    const ties = tieCounts(r), stat = ((12 * sum(sums.map((s, j) => s * s / cnt[j])) / (n * (n + 1)) - 3 * (n + 1)) / (1 - sum(ties.map(t => t ** 3 - t)) / (n ** 3 - n)));
    const h = { statistic: stat, statName: 'Kruskal-Wallis chi-squared', parameter: [k - 1], p: D.pchisq(stat, k - 1, false), method: 'Kruskal-Wallis rank sum test', alternative: null, data: ctx.y[0] + ' by ' + ctx.g[0] }; test(ctx, h); ctx.diag(htestPrint(h));
    ctx.table('Group summaries', ['Group', 'N', 'Median', 'Mean.rank', 'Rank.sum'], gg.levels.map((l, j) => { const ys = yy.filter((_, i) => gg.codes[i] === j); return [l, cnt[j], quantile7(ys, 0.5)[0], sums[j] / cnt[j], sums[j]]; }));
  } else {
    const gg = ctx.group(ctx.value('group')), sv = ctx.value('subject'), ss = isFactor(sv) ? sv : new Factor(sv), k = gg.nlevels, nb = ss.nlevels;
    const cell = Array.from({ length: nb }, () => new Array(k).fill(0)), Y = Array.from({ length: nb }, () => new Array(k).fill(NaN));
    for (let i = 0; i < yy.length; i++) { const b = ss.codes[i], g = gg.codes[i]; cell[b][g]++; Y[b][g] = yy[i]; }
    need(cell.every(r => r.every(v => v === 1)), 'Exactly one complete observation per subject × condition is required.');
    const R = Y.map(rank), cs = new Array(k).fill(0); R.forEach(r => r.forEach((v, j) => { cs[j] += v; }));
    const tiesSum = sum(R.map(r => sum(tieCounts(r).map(t => t ** 3 - t)))), stat = (12 * sum(cs.map(c => (c - nb * (k + 1) / 2) ** 2))) / (nb * k * (k + 1) - tiesSum / (k - 1));
    const h = { statistic: stat, statName: 'Friedman chi-squared', parameter: [k - 1], p: D.pchisq(stat, k - 1, false), method: 'Friedman rank sum test', alternative: null, data: ctx.y[0] + ', ' + ctx.g[0] + ' and ' + ctx.subject[0] }; test(ctx, h); ctx.diag(htestPrint(h));
  }
});

// ---------- power (pwr) and precision ----------
register(['power_t', 'power_prop', 'power_corr', 'power_anova'], ctx => {
  const { id, num, opt } = ctx, p = num('power', 0.8, { min: 0.01, max: 0.999 }), n = num('sample', 0, { min: 0 }), sig = ctx.alpha, design = opt('design', 'two.sample');
  const solve = (body, lo, hi) => D.uniroot(v => body(v) - p, lo, hi).root;
  let res, method, note = null;
  if (id === 'power_t') {
    const d = Math.abs(num('effect', 0.5)), ts = design === 'two.sample' ? 2 : 1;
    const body = nn => { const nu = (nn - 1) * ts; if (!(nu > 0)) { ctx.warn('NaNs produced'); return NaN; } const qu = D.qt(sig / 2, nu, false); return D.pnt(qu, nu, Math.sqrt(nn / ts) * d, false) + D.pnt(-qu, nu, Math.sqrt(nn / ts) * d, true); };
    const nn = n > 0 ? n : solve(body, 2 + 1e-10, 1e9), pw = n > 0 ? body(n) : p;
    res = [['n', nn], ['d', d], ['sig.level', sig], ['power', pw]]; method = (design === 'one.sample' ? 'One-sample' : design === 'paired' ? 'Paired' : 'Two-sample') + ' t test power calculation'; note = design === 'paired' ? 'n is number of *pairs*' : design === 'two.sample' ? 'n is number in *each* group' : null;
  } else if (id === 'power_prop') {
    const h = Math.abs(2 * Math.asin(Math.sqrt(num('p1', 0.5, { min: 0, max: 1 }))) - 2 * Math.asin(Math.sqrt(num('p2', 0.6, { min: 0, max: 1 })))), one = design === 'one.sample', f = one ? 1 : 2;
    if (n > 0) need(n >= 1, 'number of observations in each group must be at least 1');
    const body = nn => D.pnorm(D.qnorm(sig / 2, 0, 1, false) - h * Math.sqrt(nn / f), 0, 1, false) + D.pnorm(D.qnorm(sig / 2) - h * Math.sqrt(nn / f));
    const nn = n > 0 ? n : solve(body, 2 + 1e-10, 1e9), pw = n > 0 ? body(n) : p;
    res = [['h', h], ['n', nn], ['sig.level', sig], ['power', pw]]; method = one ? 'proportion power calculation for binomial distribution (arcsine transformation)' : 'Difference of proportion power calculation for binomial distribution (arcsine transformation)'; note = one ? null : 'same sample sizes';
  } else if (id === 'power_corr') {
    const r = Math.abs(num('effect', 0.3, { min: -0.999, max: 0.999 }));
    if (n > 0) need(n >= 4, 'number of observations must be at least 4');
    const body = nn => { const ttt = D.qt(sig / 2, nn - 2, false), rc = Math.sqrt(ttt * ttt / (ttt * ttt + nn - 2)), zr = Math.atanh(r) + r / (2 * (nn - 1)), zrc = Math.atanh(rc); return D.pnorm((zr - zrc) * Math.sqrt(nn - 3)) + D.pnorm((-zr - zrc) * Math.sqrt(nn - 3)); };
    const nn = n > 0 ? n : solve(body, 4 + 1e-10, 1e9), pw = n > 0 ? body(n) : p;
    res = [['n', nn], ['r', r], ['sig.level', sig], ['power', pw]]; method = 'approximate correlation power calculation (arctangh transformation)';
  } else {
    const k = num('groups', 3, { min: 2, integer: true }), f = num('effect', 0.25, { min: 0.0001 });
    if (n > 0) need(n >= 2, 'number of observations in each group must be at least 2');
    const body = nn => { const lambda = k * nn * f * f; return D.pnf(D.qf(sig, k - 1, (nn - 1) * k, false), k - 1, (nn - 1) * k, lambda, false); };
    const nn = n > 0 ? n : solve(body, 2 + 1e-10, 1e9), pw = n > 0 ? body(n) : p;
    res = [['k', k], ['n', nn], ['f', f], ['sig.level', sig], ['power', pw]]; method = 'Balanced one-way analysis of variance power calculation'; note = 'n is number in each group';
  }
  ctx.diag(['', '     ' + method, '', ...res.map(([k, v]) => k.padStart(14) + ' = ' + fmtR(Number(v.toPrecision(7)))), ...(id === 'power_anova' ? [] : ['   alternative = two.sided']), ...(note ? ['', 'NOTE: ' + note] : []), '']);
  ctx.table('Power and sample size', ['Quantity', 'Value'], res);
  ctx.note('For two-sample and balanced ANOVA designs, n denotes observations per group. Round planned sample sizes upward.'); ctx.used = 0;
});
register('precision', ctx => {
  const { num, opt, alpha } = ctx, z = D.qnorm(1 - alpha / 2), e = num('margin', 0.05, { min: 1e-10 });
  const n0 = opt('target', 'proportion') === 'proportion' ? z * z * num('proportion', 0.5, { min: 0, max: 1 }) * (1 - num('proportion', 0.5, { min: 0, max: 1 })) / e ** 2 : z * z * num('sd', 1, { min: 1e-10 }) ** 2 / e ** 2;
  const N = num('population', 0, { min: 0 }); let n = N > 0 ? n0 / (1 + (n0 - 1) / N) : n0; n = n * num('designEffect', 1, { min: 1e-10 });
  ctx.table('Precision planning', ['Completed', 'Invitations'], [[Math.ceil(n), Math.ceil(n / num('responseRate', 1, { min: 1e-10, max: 1 }))]]);
  ctx.note('Normal-approximation planning; the design effect and expected response rate must come from substantive knowledge.'); ctx.used = 0;
});

// ---------- classification ----------
// formatC(x, digits, format = "g") as used by cut() labels
export function formatG(x, digits) {
  if (x === Infinity) return 'Inf'; if (x === -Infinity) return '-Inf'; if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x))); let s;
  if (e < -4 || e >= digits) { s = x.toExponential(digits - 1); let [m, ex] = s.split('e'); if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, ''); const sign = ex[0] === '-' ? '-' : '+'; const dd = ex.replace(/^[-+]/, ''); s = m + 'e' + sign + dd.padStart(2, '0'); }
  else { s = x.toFixed(Math.max(0, digits - 1 - e)); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); }
  return s;
}
register('classification', ctx => {
  const { num } = ctx; ctx.clean(); const yy = ctx.value('y'), pp = ctx.value('probability');
  need(!isFactor(yy) && !isFactor(pp) && yy.every(v => v === 0 || v === 1) && new Set(yy).size === 2 && pp.every(v => v >= 0 && v <= 1), 'Require observed binary outcomes with both classes and probabilities in [0,1].');
  const th = num('threshold', 0.5, { min: 0, max: 1 }), pr = pp.map(v => v >= th ? 1 : 0); let tp = 0, tn = 0, fp = 0, fn = 0;
  pr.forEach((v, i) => { if (v === 1 && yy[i] === 1) tp++; else if (v === 0 && yy[i] === 0) tn++; else if (v === 1) fp++; else fn++; });
  const rk = rank(pp), n1 = sum(yy), auc = (sum(rk.filter((_, i) => yy[i] === 1)) - n1 * (n1 + 1) / 2) / (n1 * (yy.length - n1));
  ctx.table('Confusion matrix', ['Term', '0', '1'], [['0', tn, fp], ['1', fn, tp]]);
  ctx.table('Classification performance', ['Metric', 'Value'], [['AUC', auc], ['Brier score', mean(pp.map((v, i) => (v - yy[i]) ** 2))], ['Accuracy', mean(pr.map((v, i) => v === yy[i] ? 1 : 0))], ['Sensitivity', tp / (tp + fn)], ['Specificity', tn / (tn + fp)]]);
  const cuts = [...new Set(quantile7(pp, Array.from({ length: 11 }, (_, i) => i / 10)))], br = [...new Set([-Infinity, ...cuts, Infinity])];
  let labels; for (let dig = 3; dig <= 12; dig++) { const ch = br.map(b => formatG(b, dig)); if (ch.slice(1).every((v, i) => v !== ch[i])) { labels = ch.slice(1).map((v, i) => '(' + ch[i] + ',' + v + ']'); break; } }
  const bins = pp.map(v => br.findIndex((b, i) => i > 0 && v <= b) - 1), agg = [];
  for (let b = 0; b < br.length - 1; b++) { const ix = bins.map((v, i) => v === b ? i : -1).filter(i => i >= 0); if (ix.length) agg.push([labels[b], mean(ix.map(i => pp[i])), mean(ix.map(i => yy[i]))]); }
  ctx.table('Calibration groups', ['Bin', 'Predicted', 'Observed'], agg);
  const ix = pp.map((_, i) => i).sort((a, b) => pp[b] - pp[a] || a - b), ys = ix.map(i => yy[i]), ps = ix.map(i => pp[i]), ends = ps.map((v, i) => i === ps.length - 1 || ps[i + 1] !== v);
  let ctp = 0, cfp = 0; const sx = [0], sy = [0]; ys.forEach((v, i) => { ctp += v; cfp += 1 - v; if (ends[i]) { sx.push(cfp / (yy.length - n1)); sy.push(ctp / n1); } });
  ctx.plot('ROC curve', svgPlot({ xlab: 'False-positive rate', ylab: 'Sensitivity', xlim: [0, 1], ylim: [0, 1], layers: [{ type: 'line', x: sx, y: sy, color: '#194F39' }, { type: 'abline', a: 0, b: 1, dash: true }] }));
  ctx.note('Use predictions from held-out observations. Training-set metrics are optimistic.');
});

// ---------- missing data ----------
register('missing', ctx => {
  const vars = ctx.variables.filter(v => ctx.d.has(v)), d = ctx.d, n = d.n;
  const miss = v => { const c = d.get(v); return Array.from({ length: n }, (_, i) => isFactor(c) ? c.codes[i] === null : isNA(c[i])); };
  const M = vars.map(miss);
  ctx.table('Missingness', ['Variable', 'Missing', 'Percent'], vars.map((v, j) => { const k = M[j].filter(Boolean).length; return [v, k, 100 * k / n]; }));
  const pat = new Map(); for (let i = 0; i < n; i++) { const key = vars.map((_, j) => M[j][i] ? 'TRUE' : 'FALSE').join(' '); pat.set(key, (pat.get(key) || 0) + 1); }
  const keys = [...pat.keys()].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  ctx.table('Missing-data patterns', ['Var1', 'Freq'], keys.map(k => [k, pat.get(k)]));
  ctx.note('Observed missingness patterns do not establish MCAR, MAR or MNAR.');
});
export { printTable, asChar };
