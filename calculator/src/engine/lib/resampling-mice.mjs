// Multiple imputation by chained equations: a port of mice::mice() with its default setup (all other columns as
// predictors, pmm for numeric, logreg for binary factors, polyreg for unordered factors with > 2 levels;
// remove.lindep, edit.setup's constant/collinear checks, augment() for the categorical models), followed by
// glm() per completed data set and mice::pool() (Rubin's rules, Barnard–Rubin df) as summary(pool, conf.int).
// Every random draw goes through R's RNG in mice's order (sample, rchisq, rnorm, runif, matchindex's sample()),
// and nnet::multinom is reproduced with nnet's network objective and R's vmmin (BFGS) from zero start values.
import * as D from './dist.mjs';
import * as L from './linalg.mjs';
import { Factor, Frame, isFactor, isNA, need } from './frame.mjs';
import { glm as glmFit, design, families } from './models.mjs';
import { svgPlot } from './plot.mjs';
import { printTable } from './print.mjs';

const EPS = 2.220446049250313e-16;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const variance = a => { const n = a.length; if (n < 2) return NaN; const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1); };
const cor = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const cholLower = A => L.chol(A.map((r, i) => r.map((v, j) => (v + A[j][i]) / 2))); // t(chol(sym(A)))
const lowerTimes = (Lc, z) => z.map((_, a) => { let s = 0; for (let b = 0; b <= a; b++) s += Lc[a][b] * z[b]; return s; });

// ---------- nnet::multinom (size 0, skip; softmax for > 2 classes, entropy logistic for 2) via R's vmmin ----------
function vmmin(b, fn, gr, mask, maxit = 100, abstol = 1e-4, reltol = 1e-8) {
  const l = []; mask.forEach((m, i) => { if (m) l.push(i); }); const n = l.length, stepredn = 0.2, acctol = 1e-4, reltest = 10;
  const t = new Array(n), X = new Array(n), c = new Array(n), B = Array.from({ length: n }, (_, i) => new Array(i + 1).fill(0));
  let f = fn(b); need(Number.isFinite(f), "initial value in 'vmmin' is not finite");
  let Fmin = f, gradcount = 1, iter = 1, ilast = gradcount, count, g = gr(b);
  do {
    if (ilast === gradcount) for (let i = 0; i < n; i++) { for (let j = 0; j < i; j++) B[i][j] = 0; B[i][i] = 1; }
    for (let i = 0; i < n; i++) { X[i] = b[l[i]]; c[i] = g[l[i]]; }
    let gradproj = 0;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s -= B[i][j] * g[l[j]]; for (let j = i + 1; j < n; j++) s -= B[j][i] * g[l[j]]; t[i] = s; gradproj += s * g[l[i]]; }
    if (gradproj < 0) {
      let steplength = 1, accpoint = false;
      do {
        count = 0; for (let i = 0; i < n; i++) { b[l[i]] = X[i] + steplength * t[i]; if (reltest + X[i] === reltest + b[l[i]]) count++; }
        if (count < n) { f = fn(b); accpoint = Number.isFinite(f) && f <= Fmin + gradproj * steplength * acctol; if (!accpoint) steplength *= stepredn; }
      } while (!(count === n || accpoint));
      if (!(f > abstol && Math.abs(f - Fmin) > reltol * (Math.abs(Fmin) + reltol))) { count = n; Fmin = f; }
      if (count < n) {
        Fmin = f; g = gr(b); gradcount++; iter++; let D1 = 0;
        for (let i = 0; i < n; i++) { t[i] *= steplength; c[i] = g[l[i]] - c[i]; D1 += t[i] * c[i]; }
        if (D1 > 0) {
          let D2 = 0; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s += B[i][j] * c[j]; for (let j = i + 1; j < n; j++) s += B[j][i] * c[j]; X[i] = s; D2 += s * c[i]; }
          D2 = 1 + D2 / D1; for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) B[i][j] += (D2 * t[i] * t[j] - X[i] * t[j] - t[i] * X[j]) / D1;
        } else ilast = gradcount;
      } else if (ilast < gradcount) { count = 0; ilast = gradcount; }
    } else { count = 0; if (ilast === gradcount) count = n; else ilast = gradcount; }
    if (iter >= maxit) break;
    if (gradcount - ilast > 2 * n) ilast = gradcount;
  } while (count !== n || ilast !== gradcount);
  return b;
}
// X: rows (with intercept column), yc: class codes 0..q-1, w: case weights → x ↦ class probabilities
export function multinom(X, yc, w, q) {
  const r = X[0].length, N = X.length, soft = q > 2, nout = soft ? q : 1, per = r + 1, nw = per * nout;
  const mask = Array.from({ length: nw }, (_, k) => soft ? k >= per && k % per !== 0 : k > 0);
  const sig = s => s < -15 ? 0 : s > 15 ? 1 : 1 / (1 + Math.exp(-s));
  const outs = (wv, x) => { const o = new Array(nout); for (let k = 0; k < nout; k++) { let s = wv[k * per]; for (let j = 0; j < r; j++) s += x[j] * wv[k * per + 1 + j]; o[k] = s; } return o; };
  const probs = o => { let t = o[0]; for (const v of o) if (v > t) t = v; const p = o.map(v => Math.exp(v - t)), s = p.reduce((a, b) => a + b, 0); return p.map(v => v / s); };
  const run = (wv, grad) => {
    let E = 0; const gv = grad ? new Array(nw).fill(0) : null;
    for (let i = 0; i < N; i++) {
      const o = outs(wv, X[i]), wx = w[i];
      if (soft) {
        const p = probs(o); if (p[yc[i]] > 0) E -= wx * Math.log(p[yc[i]]); else E += wx * 1000;
        if (grad) for (let k = 0; k < q; k++) { const e = p[k] - (yc[i] === k ? 1 : 0); gv[k * per] += wx * e; for (let j = 0; j < r; j++) gv[k * per + 1 + j] += wx * e * X[i][j]; }
      } else {
        const y = sig(o[0]), tt = yc[i] === 1 ? 1 : 0; E += wx * (tt > 0 ? -Math.log(y + 1e-80) : -Math.log(1 - y + 1e-80));
        if (grad) { const e = y - tt; gv[0] += wx * e; for (let j = 0; j < r; j++) gv[1 + j] += wx * e * X[i][j]; }
      }
    }
    return grad ? gv : E;
  };
  const wv = vmmin(new Array(nw).fill(0), b => run(b, false), b => run(b, true), mask);
  return x => soft ? probs(outs(wv, x)) : (p => [1 - p, p])(sig(outs(wv, x)[0]));
}

// ---------- mice() with the default setup ----------
export function mice(rng, cols, m, maxit, seed) {
  rng.setSeed(seed);
  const p = cols.length, n = cols[0].vals.length, names = cols.map(c => c.name), log = [];
  const isNum = c => c.type === 'num', R = cols.map(c => c.vals.map(v => isNum(c) ? !Number.isNaN(v) : v !== null)), nmis = R.map(r => r.filter(v => !v).length);
  const method = cols.map((c, j) => nmis[j] === 0 ? '' : isNum(c) ? 'pmm' : c.levels.length === 2 ? 'logreg' : 'polyreg');
  const pred = names.map((_, h) => names.map((_, j) => h === j ? 0 : 1));
  // edit.setup: constant and collinear variables are dropped as predictors and not imputed
  const asNum = c => c.vals.map(v => isNum(c) ? v : v === null ? NaN : v + 1);
  const dropVar = (j, why) => { let did = false; if (pred.some(r => r[j] !== 0)) { pred.forEach(r => { r[j] = 0; }); log.push([0, 0, '', why, names[j]]); did = true; } if (method[j] !== '') { pred[j].fill(0); if (!did) log.push([0, 0, '', why, names[j]]); method[j] = ''; } };
  cols.forEach((c, j) => { const v = variance(asNum(c).filter(x => !Number.isNaN(x))); if (Number.isNaN(v) || v < 1000 * EPS) dropVar(j, 'constant'); });
  const pc = names.map((_, j) => j).filter(j => pred.some(r => r[j] !== 0));
  if (pc.length) { // find.collinear: columns ordered by number observed, later member of a |r| >= 0.999 pair dropped
    const nr = pc.map(j => R[j].filter(Boolean).length), ord = pc.map((j, k) => k).sort((a, b) => nr[b] - nr[a] || a - b).map(k => pc[k]), drop = new Set();
    for (let b = 0; b < ord.length; b++) for (let a = 0; a < b; a++) {
      const xa = asNum(cols[ord[a]]), xb = asNum(cols[ord[b]]), ok = xa.map((v, i) => !Number.isNaN(v) && !Number.isNaN(xb[i]));
      if (Math.abs(cor(xa.filter((_, i) => ok[i]), xb.filter((_, i) => ok[i]))) >= 0.999) drop.add(ord[b]);
    }
    ord.filter(j => drop.has(j)).forEach(j => dropVar(j, 'collinear'));
  }
  need(pred.some(r => r.some(v => v !== 0)), '`mice` detected constant and/or collinear variables. No predictors were left after their removal.');
  // initialize.imp: mice.impute.sample for every variable and imputation
  const data = cols.map(c => c.vals.slice()), imp = cols.map(() => null), misIdx = R.map(r => r.map((v, i) => v ? -1 : i).filter(i => i >= 0));
  cols.forEach((c, j) => {
    if (method[j] === '') return; imp[j] = [];
    const obs = c.vals.filter((_, i) => R[j][i]), yry = obs.length === 1 ? [obs[0], obs[0]] : obs;
    for (let i = 0; i < m; i++) imp[j].push(obs.length < 1 ? rng.rnorm(nmis[j]) : rng.sampleInt(yry.length, nmis[j], true).map(k => yry[k - 1]));
  });
  const chain = () => names.map(() => Array.from({ length: maxit }, () => new Array(m).fill(NaN))), chainMean = chain(), chainVar = chain();
  for (let k = 1; k <= maxit; k++) {
    for (let i = 0; i < m; i++) {
      cols.forEach((c, j) => { if (imp[j]) misIdx[j].forEach((row, q) => { data[j][row] = imp[j][i][q]; }); });
      for (let j = 0; j < p; j++) {
        if (method[j] === '') continue;
        const xc = [], xn = []; // model.matrix of the other predictors (treatment dummies), intercept removed
        for (let v = 0; v < p; v++) { if (v === j || pred[j][v] === 0) continue; const c = cols[v]; if (isNum(c)) { xc.push(data[v]); xn.push(c.name); } else c.levels.slice(1).forEach((lv, l) => { xc.push(data[v].map(code => code === null ? NaN : code === l + 1 ? 1 : 0)); xn.push(c.name + lv); }); }
        const comp = Array.from({ length: n }, (_, r) => xc.every(col => !Number.isNaN(col[r]))), ry = R[j].map((v, r) => v && comp[r]), wy = R[j].map((v, r) => !v && comp[r]);
        const nobs = ry.filter(Boolean).length, lg = out => log.push([k, i + 1, names[j], method[j], out]);
        if (k === 1 && nobs - xc.length - 1 < 1 && nobs > 0) lg('df set to 1. # observed cases: ' + nobs + '  # predictors: ' + (xc.length + 1));
        const keep = removeLindep(xc, isNum(cols[j]), data[j], ry, lg, xn), X = Array.from({ length: n }, (_, r) => xc.filter((_, q) => keep[q]).map(col => col[r]));
        const res = method[j] === 'pmm' ? imputePmm(rng, data[j], ry, X, wy) : imputeCat(rng, data[j], ry, X, wy, method[j]);
        imp[j][i] = res; misIdx[j].forEach((row, q) => { data[j][row] = res[q]; });
      }
    }
    cols.forEach((c, j) => { if (!imp[j]) return; for (let i = 0; i < m; i++) { const v = isNum(c) ? imp[j][i] : imp[j][i].map(code => code + 1); chainMean[j][k - 1][i] = mean(v); chainVar[j][k - 1][i] = variance(v); } });
  }
  return { imp, misIdx, method, chainMean, chainVar, log, names };
}
function removeLindep(xc, numY, yv, ry, logf, xn) {
  const p = xc.length; if (!p) return [];
  const rows = ry.map((v, i) => v ? i : -1).filter(i => i >= 0); if (!rows.length) return new Array(p).fill(true);
  const yobs = rows.map(i => numY ? yv[i] : yv[i] + 1); if (variance(yobs) < 1e-4) return new Array(p).fill(false);
  const xo = xc.map(col => rows.map(i => col[i])), keep = xo.map((c, q) => variance(c) > 1e-4 && cor(c, yobs) < 0.99);
  if (keep.every(v => !v)) logf('All predictors are constant or have too high correlation.');
  let k = keep.filter(Boolean).length; if (k <= 1) return keep;
  const idx = () => keep.map((v, q) => v ? q : -1).filter(q => q >= 0), cx = () => { const id = idx(); return id.map(a => id.map(b => cor(xo[a], xo[b]))); };
  let eig = L.eigenSym(cx());
  while (eig.values[k - 1] / eig.values[0] < 1e-4) {
    const vec = eig.vectors.map(r => Math.abs(r[k - 1])); let jm = 0; vec.forEach((v, q) => { if (v > vec[jm]) jm = q; });
    keep[idx()[jm]] = false; k--; eig = L.eigenSym(cx());
  }
  if (!keep.every(Boolean)) logf(xn.filter((_, q) => !keep[q]).join(', '));
  return keep;
}
// mice.impute.pmm: .norm.draw (estimice with lm.fit, ridge fallback), matchtype 1, matchindex(donors = 5)
function imputePmm(rng, y, ry, X0, wy) {
  const X = X0.map(r => [1, ...r]), obs = [], mis = []; ry.forEach((v, i) => { if (v) obs.push(i); }); wy.forEach((v, i) => { if (v) mis.push(i); });
  const xo = obs.map(i => X[i]), yo = obs.map(i => y[i]), q = X[0].length, df = Math.max(yo.length - q, 1), fit = L.lsfit(xo, yo);
  let v; try { need(fit.rank === q, 'rank'); v = L.inv(L.crossprod(fit.R)); } catch (e) { const xtx = L.crossprod(xo); v = L.inv(xtx.map((r, a) => r.map((x, b) => a === b ? x * (1 + 1e-5) : x))); }
  const sigma = Math.sqrt(fit.resid.reduce((s, r) => s + r * r, 0) / rng.chisq(df)), z = rng.rnorm(q), c0 = fit.coef.map(x => Number.isNaN(x) ? 0 : x);
  const lz = lowerTimes(cholLower(v), z), beta = c0.map((cv, a) => cv + lz[a] * sigma);
  return matchindex(rng, xo.map(r => L.dot(r, c0)), mis.map(i => L.dot(X[i], beta)), 5).map(k => yo[k]);
}
function matchindex(rng, d, t, k) {
  const n1 = d.length, n0 = t.length, ishuf = rng.sampleInt(n1, n1, false).map(v => v - 1), yshuf = ishuf.map(i => d[i]);
  const id = yshuf.map((_, i) => i).sort((a, b) => yshuf[a] - yshuf[b] || a - b).map(i => ishuf[i]), ys = id.map(i => d[i]);
  k = Math.max(1, Math.min(k, n1)); const h = rng.sampleInt(k, n0, true), out = new Array(n0);
  for (let i = 0; i < n0; i++) {
    const val = t[i]; let lo = 0, hi = n1; while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid] < val) lo = mid + 1; else hi = mid; }
    let r = lo, l = r - 1, count = 0, res = 0;
    while (count < h[i] && l >= 0 && r < n1) { res = val - ys[l] < ys[r] - val ? id[l--] : id[r++]; count++; }
    while (count < h[i] && l >= 0) { res = id[l--]; count++; }
    while (count < h[i] && r < n1) { res = id[r++]; count++; }
    out[i] = res;
  }
  return out;
}
// augment() + mice.impute.logreg / mice.impute.polyreg; y holds factor codes (0-based)
function imputeCat(rng, y, ry, X0, wy, meth) {
  const n = y.length, icod = [...new Set(y.filter(v => v !== null))].sort((a, b) => a - b), k = icod.length, p = X0[0] ? X0[0].length : 0;
  const X = X0.map(r => r.slice()); let yy = y.slice(), ryA = ry.slice(), wyA = wy.slice(), w = new Array(n).fill(1);
  if (p > 0 && ry.filter(v => !v).length !== 1) {
    const mu = [], sd = [], mn = [], mx = []; for (let c = 0; c < p; c++) { const v = X0.map(r => r[c]); mu.push(mean(v)); sd.push(Math.sqrt(variance(v))); mn.push(Math.min(...v)); mx.push(Math.max(...v)); }
    const nr = 2 * p * k, pat = [...Array.from({ length: 2 * k }, (_, i) => i % 2 ? -0.5 : 0.5), ...new Array(nr).fill(0)];
    for (let i = 0; i < nr; i++) X.push(Array.from({ length: p }, (_, c) => { let v = mu[c] + pat[(c * nr + i) % pat.length] * sd[c]; if (Number.isNaN(v)) v = mn[c]; return Math.min(mx[c], Math.max(mn[c], v)); }));
    const e = []; for (let c = 0; c < p; c++) for (const ic of icod) e.push(ic, ic);
    yy = yy.concat(e); ryA = ryA.concat(new Array(nr).fill(true)); wyA = wyA.concat(new Array(nr).fill(false)); w = w.concat(new Array(nr).fill((p + 1) / nr));
  }
  // as.factor(levels(y)[c(y, e)]): the levels present, in the original level order
  const present = [...new Set(yy.filter(v => v !== null))].sort((a, b) => a - b), recode = new Map(present.map((v, i) => [v, i]));
  const yf = yy.map(v => recode.get(v)), Xi = X.map(r => [1, ...r]), obs = [], mis = []; ryA.forEach((v, i) => { if (v) obs.push(i); }); wyA.forEach((v, i) => { if (v) mis.push(i); });
  if (meth === 'logreg') { // glm.fit(quasibinomial) + draw from N(beta, cov.unscaled) + runif
    const fit = glmFit({ X: obs.map(i => Xi[i]), y: obs.map(i => yf[i] === 0 ? 0 : 1), names: Xi[0].map((_, j) => 'x' + j), offset: null }, families.binomial('logit'), { weights: obs.map(i => w[i]) });
    const beta = fit.coef.map(v => Number.isNaN(v) ? 0 : v), lz = lowerTimes(cholLower(fit.V), rng.rnorm(beta.length)), bs = beta.map((b, a) => b + lz[a]), u = rng.runif(mis.length);
    return mis.map((i, q) => present[u[q] <= 1 / (1 + Math.exp(-L.dot(Xi[i], bs))) ? 1 : 0]);
  }
  const nc = present.length, un = rng.runif(mis.length), cnt = new Array(nc).fill(0); obs.forEach(i => { cnt[yf[i]]++; });
  const all = cnt.findIndex(c => c === obs.length); if (all >= 0) return mis.map(() => present[all]);
  const pr = multinom(obs.map(i => Xi[i]), obs.map(i => yf[i]), obs.map(i => w[i]), nc);
  return mis.map((i, q) => { const post = pr(Xi[i]); let cum = 0, idx = 0; for (let c = 0; c < nc; c++) { cum += post[c]; if (un[q] > cum) idx++; } return present[idx]; });
}

// ---------- the R engine's impute branch ----------
export function imputeHandler(ctx) {
  const { num, opt } = ctx; need(ctx.y.length === 1 && ctx.x.length > 0, 'Choose outcome and predictors.');
  const vars = [ctx.y[0], ...ctx.x], d = ctx.d;
  const cols = vars.map(v => { const c = d.get(v); return isFactor(c) ? { name: v, type: 'fac', levels: c.levels, vals: c.codes.slice() } : { name: v, type: 'num', vals: Array.from(c, x => isNA(x) ? NaN : x) }; });
  need(cols.some(c => c.vals.some(v => c.type === 'num' ? Number.isNaN(v) : v === null)), 'There are no missing values in the selected variables.');
  const seed = num('seed', 1729, { integer: true }), m = num('imputations', 5, { min: 2, max: 50, integer: true }), maxit = num('iterations', 10, { min: 1, max: 100, integer: true });
  const mi = mice(ctx.rng, cols, m, maxit, seed);
  const famName = opt('family', 'gaussian'), fam = famName === 'binomial' ? families.binomial('logit') : famName === 'poisson' ? families.poisson() : families.gaussian();
  const fits = [];
  for (let i = 0; i < m; i++) { // glm(formula(), data = complete(imp, i), family)
    const cc = {}; cols.forEach((c, j) => { const v = c.vals.slice(); if (mi.imp[j]) mi.misIdx[j].forEach((row, q) => { v[row] = mi.imp[j][i][q]; }); cc[c.name] = c.type === 'num' ? v : new Factor(v.map(code => code === null ? null : c.levels[code]), c.levels); });
    let fr = new Frame(cc, d.n); fr = fr.rows(fr.complete(vars));
    const des = design(fr, null, ctx.x.map(v => ({ vars: [v] }))), yc = fr.get(ctx.y[0]);
    des.y = isFactor(yc) ? yc.codes.map(c => c === 0 ? 0 : 1) : Array.from(yc);
    const g = glmFit(des, fam); g.warnings.forEach(wm => ctx.warn(wm)); fits.push(g);
  }
  // pool(): Rubin's rules, Barnard–Rubin df with dfcom = df.residual of the first fit; summary(conf.int = TRUE)
  const dfcom = fits[0].dfResidual, a = (1 - ctx.level) / 2, pct = v => +(100 * v).toPrecision(3) + ' %';
  const rows = fits[0].names.map((tm, j) => {
    const est = fits.map(f => f.coef[j]), qbar = mean(est), ubar = mean(fits.map(f => f.se[j] ** 2)), b = variance(est), t = ubar + (1 + 1 / m) * b;
    let lambda = (1 + 1 / m) * b / t; if (lambda < 1e-4) lambda = 1e-4;
    const dfold = (m - 1) / lambda ** 2, dfobs = (dfcom + 1) / (dfcom + 3) * dfcom * (1 - lambda), df = Number.isFinite(dfcom) ? dfold * dfobs / (dfold + dfobs) : dfold, se = Math.sqrt(t), st = qbar / se;
    return [tm, qbar, se, st, df, 2 * D.pt(Math.abs(st), Math.max(df, 0.001), false), qbar + D.qt(a, df) * se, qbar + D.qt(1 - a, df) * se];
  });
  ctx.table('Rubin-pooled estimates', ['term', 'estimate', 'std.error', 'statistic', 'df', 'p.value', pct(a), pct(1 - a)], rows);
  if (mi.log.length) { ctx.diag(printTable(['it', 'im', 'dep', 'meth', 'out'], mi.log)); ctx.warn('Number of logged events: ' + mi.log.length); } else ctx.diag('NULL');
  const layers = [], legend = [], pal = [ctx.accent, '#B5562B', '#3C6E9E', '#7A5C99', '#8A8A3C', '#C0392B'];
  mi.names.forEach((nm, j) => { if (!mi.imp[j]) return; const col = pal[legend.length % pal.length]; legend.push({ label: (ctx.packet.data?.[nm]?.name || nm) + ' (chain means)', color: col }); for (let i = 0; i < m; i++) layers.push({ type: 'line', x: Array.from({ length: maxit }, (_, k) => k + 1), y: mi.chainMean[j].map(r => r[i]), color: col }); });
  ctx.plot('Imputation convergence', svgPlot({ xlab: 'Iteration', ylab: 'Mean of imputed values', layers, legend }));
  ctx.note('Rubin pooling combines within- and between-imputation uncertainty. Default conditional imputation models assume MAR given the included variables. Inspect diagnostics and model compatibility.');
}
