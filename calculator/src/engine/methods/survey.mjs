// Design-based survey estimation: ports of survey::svydesign(ids, strata, weights, nest = TRUE) followed by
// subset() to the analytic domain, svymean/svytotal with Taylor-linearisation variances (svyrecvar/onestage:
// PSU totals of the influence values centred within strata, padded with zero rows for sampled PSUs outside the
// domain, scaled by nPSU/(nPSU-1)), confint(df = degf), svychisq(statistic = 'F') (Rao–Scott second-order
// correction) and the svyglm two-group design-based t-test.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import * as L from '../lib/linalg.mjs';
import { Factor, isFactor, need, cmpC } from '../lib/frame.mjs';
import { test } from '../lib/stats.mjs';

const isNumVec = v => Array.isArray(v) && v.every(x => typeof x === 'number');
// factor() of a column restricted to rows: only the levels present (factor/numeric/character order as in R)
function presentFactor(v, rows) {
  if (isFactor(v)) return v.subset(rows).droplevels();
  const vals = rows.map(i => v[i]);
  return isNumVec(vals) ? new Factor(vals) : new Factor(vals.map(String), [...new Set(vals.map(String))].sort(cmpC));
}

// The survey design on the full data, restricted to the domain rows S (design information kept from all rows)
function makeDesign(ctx) {
  const d = ctx.d, n = d.n, w = ctx.fields('weight'); need(w.length === 1, 'Select survey weights.');
  const psu = ctx.fields('psu'), strata = ctx.fields('strata'), designFields = [...new Set([w[0], ...psu, ...strata])];
  need(d.complete(designFields).length === n, 'Survey design variables must be nonmissing before domain estimation.');
  const dom = ctx.packet.domain && ctx.packet.domain.length ? ctx.packet.domain.map(Boolean) : new Array(n).fill(true);
  const others = ctx.allFields().filter(k => !designFields.includes(k) && d.has(k)), comp = new Set(d.complete(others));
  const S = []; for (let i = 0; i < n; i++) if (dom[i] && comp.has(i)) S.push(i);
  need(S.length > 0, 'No complete observations in the selected survey domain.'); ctx.used = S.length;
  const wt = d.get(w[0]); need(Array.from({ length: n }, (_, i) => wt[i]).every(v => v > 0), 'Survey weights must be positive.');
  const sv = strata.length ? d.get(strata[0]) : null, sf = sv ? (isFactor(sv) ? sv : new Factor(sv)) : null;
  const sc = sf ? sf.codes : new Array(n).fill(0), slab = sf ? sf.levels : ['1'];
  const pv = psu.length ? d.get(psu[0]) : null, pkey = i => pv ? (isFactor(pv) ? pv.codes[i] : pv[i]) : i;
  const cmap = new Map(), cl = new Array(n); for (let i = 0; i < n; i++) { const k = sc[i] + '\u0001' + pkey(i); if (!cmap.has(k)) cmap.set(k, cmap.size); cl[i] = cmap.get(k); }
  const nPSU = new Array(slab.length).fill(0), seen = new Set(); for (let i = 0; i < n; i++) if (!seen.has(cl[i])) { seen.add(cl[i]); nPSU[sc[i]]++; }
  const degf = new Set(S.map(i => cl[i])).size - new Set(S.map(i => sc[i])).size;
  ctx.note('Domain estimation retains the full sampled design before subsetting the analytic domain.');
  return { S, w: S.map(i => wt[i]), cl: S.map(i => cl[i]), sc: S.map(i => sc[i]), slab, nPSU, degf };
}
// svyrecvar(x) for the domain rows: x is an array of rows (one per domain row) with p columns
function recvar(des, x) {
  const p = x[0].length, V = L.zeros(p, p), byStr = new Map();
  des.sc.forEach((h, k) => { if (!byStr.has(h)) byStr.set(h, []); byStr.get(h).push(k); });
  for (const h of [...byStr.keys()].sort((a, b) => a - b)) {
    const rows = byStr.get(h), np = des.nPSU[h];
    need(np > 1, 'Stratum (' + des.slab[h] + ') has only one PSU at stage 1');
    const tot = new Map(); for (const k of rows) { const c = des.cl[k]; if (!tot.has(c)) tot.set(c, new Array(p).fill(0)); const t = tot.get(c); for (let j = 0; j < p; j++) t[j] += x[k][j]; }
    const Z = [...tot.values()]; while (Z.length < np) Z.push(new Array(p).fill(0));
    const mu = new Array(p).fill(0); for (const z of Z) for (let j = 0; j < p; j++) mu[j] += z[j] / np;
    const sc = np / (np - 1); for (const z of Z) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) V[a][b] += sc * (z[a] - mu[a]) * (z[b] - mu[b]);
  }
  return V;
}
function svymean(des, X) {
  const psum = des.w.reduce((a, b) => a + b, 0), p = X[0].length, avg = new Array(p).fill(0);
  X.forEach((r, k) => { for (let j = 0; j < p; j++) avg[j] += r[j] * des.w[k] / psum; });
  return { est: avg, V: recvar(des, X.map((r, k) => r.map((v, j) => (v - avg[j]) * des.w[k] / psum))) };
}
function svytotal(des, X) {
  const p = X[0].length, tot = new Array(p).fill(0); X.forEach((r, k) => { for (let j = 0; j < p; j++) tot[j] += r[j] * des.w[k]; });
  return { est: tot, V: recvar(des, X.map((r, k) => r.map(v => v * des.w[k]))) };
}
const qtDf = (p, df) => df > 0 ? D.qt(p, df) : NaN;

register(['survey_desc', 'survey_test'], ctx => {
  const des = makeDesign(ctx), d = ctx.d, S = des.S;
  if (ctx.id === 'survey_desc') {
    need(ctx.variables.length > 0, "'termlabels' must be a character vector of length at least one");
    const names = [], cols = [];
    for (const v of ctx.variables) {
      const c = d.get(v);
      if (isFactor(c)) c.levels.forEach((l, j) => { names.push(v + l); cols.push(S.map(i => c.codes[i] === j ? 1 : 0)); });
      else if (isNumVec(Array.from(c))) { names.push(v); cols.push(S.map(i => c[i])); }
      else { const f = presentFactor(c, S); f.levels.forEach((l, j) => { names.push(v + l); cols.push(f.codes.map(cc => cc === j ? 1 : 0)); }); }
    }
    const X = S.map((_, k) => cols.map(c => c[k])), s = ctx.opt('surveyStat', 'mean') === 'total' ? svytotal(des, X) : svymean(des, X);
    const a = (1 - ctx.level) / 2, lo = qtDf(a, des.degf), hi = qtDf(1 - a, des.degf);
    ctx.table('Design-based estimates', ['Term', 'Estimate', 'SE', 'Lower', 'Upper'], names.map((nm, j) => { const se = Math.sqrt(s.V[j][j]); return [nm, s.est[j], se, s.est[j] + se * lo, s.est[j] + se * hi]; }));
  } else if (ctx.opt('surveyTest', 'means') === 'categorical') {
    const yv = d.get(ctx.y[0]), gv = d.get(ctx.g[0]), fr = presentFactor(yv, S), fc = presentFactor(gv, S), nr = fr.nlevels, nc = fc.nlevels, N = S.length, K = nr * nc;
    const X = S.map((_, k) => { const r = new Array(K).fill(0), a = fr.codes[k], b = fc.codes[k]; if (a !== null && b !== null) r[a + nr * b] = 1; return r; });
    const m2 = svymean(des, X), mean2 = m2.est;
    // svytable(~y + g, Ntotal = N): weighted xtabs over all factor levels, rescaled to total N
    const Fr = isFactor(yv) ? yv.subset(S) : fr, Fc = isFactor(gv) ? gv.subset(S) : fc;
    const tb = Fr.levels.map(() => Fc.levels.map(() => 0)); S.forEach((_, k) => { const a = Fr.codes[k], b = Fc.codes[k]; if (a !== null && b !== null) tb[a][b] += des.w[k]; });
    const tot = tb.flat().reduce((x, y) => x + y, 0), O = tb.map(r => r.map(v => v * N / tot)), rs = O.map(r => r.reduce((x, y) => x + y, 0)), cs = O[0].map((_, j) => O.reduce((x, r) => x + r[j], 0));
    let X2 = 0, small = false; O.forEach((r, i) => r.forEach((o, j) => { const E = rs[i] * cs[j] / N; if (E < 5) small = true; X2 += (o - E) ** 2 / E; }));
    if (small) ctx.warn('Chi-squared approximation may be incorrect');
    // Cmat = residuals of the interaction columns on the main-effects design (cells: rows vary fastest)
    const cell = Array.from({ length: K }, (_, c) => [c % nr, Math.floor(c / nr)]);
    const X1 = cell.map(([a, b]) => [1, ...Array.from({ length: nr - 1 }, (_, i) => a === i + 1 ? 1 : 0), ...Array.from({ length: nc - 1 }, (_, j) => b === j + 1 ? 1 : 0)]);
    const Xi = cell.map(([a, b]) => { const r = []; for (let j = 1; j < nc; j++) for (let i = 1; i < nr; i++) r.push(a === i && b === j ? 1 : 0); return r; });
    const H = L.mul(L.mul(X1, L.inv(L.crossprod(X1))), L.t(X1)), C = L.mul(L.add(L.ident(K), L.scale(H, -1)), Xi);
    const iD = mean2.map(v => v === 0 ? 0 : 1 / v), iDC = C.map((r, i) => r.map(v => v * iD[i]));
    const denom = L.scale(L.mul(L.t(C), iDC), 1 / N), numr = L.mul(L.mul(L.t(iDC), m2.V), iDC), Delta = L.solve(denom, numr);
    const tr = L.diag(Delta).reduce((x, y) => x + y, 0), tr2 = L.diag(L.mul(Delta, Delta)).reduce((x, y) => x + y, 0), d0 = tr * tr / tr2, F = X2 / tr;
    test(ctx, { statistic: F, parameter: [d0, d0 * des.degf], p: D.pf(F, d0, d0 * des.degf, false), method: "Pearson's X^2: Rao & Scott adjustment", alternative: null });
  } else {
    const gg = ctx.group(presentFactor(d.get(ctx.g[0]), S), 2), yv = d.get(ctx.y[0]), y = S.map(i => yv[i]), c = gg.codes;
    const mw = des.w.reduce((a, b) => a + b, 0) / S.length, W = des.w.map(v => v / mw), Xm = c.map(v => [1, v]);
    const Ai = L.inv(L.crossprod(Xm, W)), b = L.mulVec(Ai, L.tmulVec(Xm, y.map((v, k) => v * W[k])));
    const infl = Xm.map((x, k) => { const e = (y[k] - x[0] * b[0] - x[1] * b[1]) * W[k]; return L.mulVec(Ai, [x[0] * e, x[1] * e]); });
    const V = recvar(des, infl), se = Math.sqrt(V[1][1]), df = des.degf - 1;
    need(Number.isFinite(se) && se > 0 && df > 0, 'The design has insufficient degrees of freedom for this comparison.');
    const tv = b[1] / se, q = D.qt(1 - ctx.alpha / 2, df);
    test(ctx, { statistic: tv, parameter: [df], p: 2 * D.pt(-Math.abs(tv), df), method: 'Design-based t-test', estimate: [['Difference..contrast', b[1]]], conf: [b[1] - q * se, b[1] + q * se], level: ctx.level, alternative: 'two.sided' });
    ctx.note('Contrast: ' + gg.levels[1] + ' minus ' + gg.levels[0]);
  }
  ctx.table('Survey design', ['Observations', 'Design.DF'], [[ctx.used, des.degf]]);
  ctx.note('Lonely-PSU strata require a defensible design-specific treatment; no automatic adjustment is imposed.');
});
