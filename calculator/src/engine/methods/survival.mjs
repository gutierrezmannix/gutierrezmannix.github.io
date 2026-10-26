// Kaplan–Meier, Cox proportional hazards and parametric AFT models — ports of the km/cox/survreg block in
// src/analysis-methods.R and of survival 3.5's survfitKM (log CI), survdiff, coxph (coxfit6: Efron ties,
// Newton–Raphson with step halving, centring/scaling, cholesky2 tolerances), cox.zph (zph1, transform 'km')
// and survreg (survreg.distributions; Newton–Raphson on (beta, log scale)). Times are first passed through
// aeqSurv (timefix = TRUE) as survfit/coxph/survdiff do.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import { isFactor, need, rnum, fmtR, modelMatrix } from '../lib/frame.mjs';
import { fitout } from '../lib/models.mjs';
import { svgPlot } from '../lib/plot.mjs';
import { fmtSig, fmtP, printCoefmat, printTable } from '../lib/print.mjs';

const EPS = 2.220446049250313e-16;
const ord = t => t.map((_, i) => i).sort((a, b) => t[a] - t[b] || a - b);
const pchisqU = (x, df) => df === 0 ? (x > 0 ? 0 : 1) : D.pchisq(x, df, false);
const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
// aeqSurv: merge times closer than sqrt(eps) (absolute or relative to mean |t|)
export function aeq(t) {
  const tol = Math.sqrt(EPS), y = [...new Set(t)].filter(Number.isFinite).sort((a, b) => a - b); if (y.length < 2) return t.slice();
  const ma = y.reduce((s, v) => s + Math.abs(v), 0) / y.length, cuts = [y[0]];
  for (let i = 1; i < y.length; i++) { const dy = y[i] - y[i - 1]; if (!(dy <= tol || dy / ma <= tol)) cuts.push(y[i]); }
  if (cuts.length === y.length) return t.slice();
  return t.map(v => { let lo = 0, hi = cuts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cuts[m] <= v) lo = m; else hi = m - 1; } return cuts[lo]; });
}
// ---------- symmetric LDL' with survival's cholesky2 pivot tolerance; chsolve2; chinv2 ----------
function chol2(A, toler) {
  const n = A.length, a = A.map(r => r.slice()); let eps = 0, rank = 0, nonneg = 1;
  for (let i = 0; i < n; i++) if (a[i][i] > eps) eps = a[i][i];
  eps = eps === 0 ? toler : eps * toler;
  for (let i = 0; i < n; i++) {
    const piv = a[i][i];
    if (!Number.isFinite(piv) || piv < eps) { a[i][i] = 0; if (piv < -8 * eps) nonneg = -1; }
    else { rank++; for (let j = i + 1; j < n; j++) { const tt = a[j][i] / piv; a[j][i] = tt; a[j][j] -= tt * tt * piv; for (let k = j + 1; k < n; k++) a[k][j] -= tt * a[k][i]; } }
  }
  return { a, flag: rank * nonneg };
}
function chsolve(C, y) {
  const a = C.a, n = a.length, x = y.slice();
  for (let i = 0; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= x[j] * a[i][j]; x[i] = s; }
  for (let i = n - 1; i >= 0; i--) { if (a[i][i] === 0) { x[i] = 0; continue; } let s = x[i] / a[i][i]; for (let j = i + 1; j < n; j++) s -= x[j] * a[j][i]; x[i] = s; }
  return x;
}
function chinv(C) { const n = C.a.length, out = []; for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; out.push(chsolve(C, e)); } return out.map((r, i) => r.map((v, j) => C.a[i][i] === 0 || C.a[j][j] === 0 ? 0 : v)); }
// dense solve (partial pivoting) for small systems
export function solveLin(A, b) {
  const n = A.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) { let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i; [M[k], M[p]] = [M[p], M[k]]; if (!(Math.abs(M[k][k]) > 0)) throw new Error('Lapack routine dgesv: system is exactly singular'); for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; } }
  const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x;
}
const invLin = A => { const n = A.length, cols = A.map((_, j) => solveLin(A, A.map((_, i) => i === j ? 1 : 0))); return A.map((_, i) => cols.map(c => c[i])); };

// ---------- Kaplan–Meier (survfitKM, Greenwood se of log S) ----------
export function kmCurve(time, status) {
  const o = ord(time), out = { time: [], nrisk: [], nevent: [], ncensor: [], surv: [], se: [] }; let km = 1, v = 0, i = 0; const n = o.length;
  while (i < n) { const t = time[o[i]]; let d = 0, c = 0, j = i; while (j < n && time[o[j]] === t) { if (status[o[j]] === 1) d++; else c++; j++; } const nr = n - i; km *= (nr - d) / nr; v += d / (nr * (nr - d)); out.time.push(t); out.nrisk.push(nr); out.nevent.push(d); out.ncensor.push(c); out.surv.push(km); out.se.push(Math.sqrt(v)); i = j; }
  return out;
}
function logCI(p, se, level) { const z = D.qnorm(1 - (1 - level) / 2); if (p === 0) return [NaN, NaN]; return [Math.exp(Math.log(p) - z * se), Math.min(Math.exp(Math.log(p) + z * se), 1)]; }
function kmMedian(c, level) {
  const first = arr => { for (let i = 0; i < arr.length; i++) if (arr[i] <= 0.5 + 1e-12) { if (Math.abs(arr[i] - 0.5) < 1e-12 && i + 1 < arr.length) return (c.time[i] + c.time[i + 1]) / 2; return c.time[i]; } return NaN; };
  const ci = c.surv.map((s, i) => logCI(s, c.se[i], level)), lo = ci.map(r => Number.isNaN(r[0]) ? 0 : r[0]), up = ci.map(r => Number.isNaN(r[1]) ? 0 : r[1]);
  return [first(c.surv), first(up), first(lo)];
}
// ---------- log-rank (survdiff2, rho = 0) ----------
export function survdiff(time, status, grp, k) {
  const o = ord(time), n = o.length, obs = new Array(k).fill(0), exp = new Array(k).fill(0), V = zeros(k, k), risk = new Array(k).fill(0);
  for (let i = n - 1; i >= 0;) {
    let deaths = 0, j = i; for (; j >= 0 && time[o[j]] === time[o[i]]; j--) { const g = grp[o[j]]; deaths += status[o[j]]; risk[g] += 1; obs[g] += status[o[j]]; }
    i = j; const nrisk = n - (j + 1);
    if (deaths > 0) { for (let g = 0; g < k; g++) exp[g] += deaths * risk[g] / nrisk; if (nrisk === 1) continue; for (let a = 0; a < k; a++) { const tmp = deaths * risk[a] * (nrisk - deaths) / (nrisk * (nrisk - 1)); V[a][a] += tmp; for (let b = 0; b < k; b++) V[a][b] -= tmp * risk[b] / nrisk; } }
  }
  const keep = exp.map((e, g) => e > 0 ? g : -1).filter(g => g >= 0); let chi = 0;
  if (keep.length >= 2) { const idx = keep.slice(1), u = idx.map(g => obs[g] - exp[g]), vv = idx.map(a => idx.map(b => V[a][b])); const s = solveLin(vv, u); chi = s.reduce((acc, v, i) => acc + v * u[i], 0); }
  return { obs, exp, V, chi };
}

// ---------- Cox model (coxfit6 port; Efron, no strata, unit weights) ----------
function coxIter(T, S, Z, beta, nvar) {
  const n = T.length, u = new Array(nvar).fill(0), imat = zeros(nvar, nvar), a = new Array(nvar).fill(0), a2 = new Array(nvar).fill(0), cmat = zeros(nvar, nvar), cmat2 = zeros(nvar, nvar);
  let loglik = 0, denom = 0;
  for (let person = n - 1; person >= 0;) {
    const dtime = T[person]; let ndead = 0, denom2 = 0;
    while (person >= 0 && T[person] === dtime) {
      const z = Z[person]; let zb = 0; for (let i = 0; i < nvar; i++) zb += beta[i] * z[i]; const risk = Math.exp(zb);
      if (S[person] === 0) { denom += risk; for (let i = 0; i < nvar; i++) { a[i] += risk * z[i]; for (let j = 0; j <= i; j++) cmat[i][j] += risk * z[i] * z[j]; } }
      else { ndead++; denom2 += risk; loglik += zb; for (let i = 0; i < nvar; i++) { u[i] += z[i]; a2[i] += risk * z[i]; for (let j = 0; j <= i; j++) cmat2[i][j] += risk * z[i] * z[j]; } }
      person--;
    }
    if (ndead > 0) {
      if (ndead === 1) { denom += denom2; loglik -= Math.log(denom); for (let i = 0; i < nvar; i++) { a[i] += a2[i]; const t2 = a[i] / denom; u[i] -= t2; for (let j = 0; j <= i; j++) { cmat[i][j] += cmat2[i][j]; imat[j][i] += (cmat[i][j] - t2 * a[j]) / denom; } } }
      else for (let k = 0; k < ndead; k++) { denom += denom2 / ndead; loglik -= Math.log(denom); for (let i = 0; i < nvar; i++) { a[i] += a2[i] / ndead; const t2 = a[i] / denom; u[i] -= t2; for (let j = 0; j <= i; j++) { cmat[i][j] += cmat2[i][j] / ndead; imat[j][i] += (cmat[i][j] - t2 * a[j]) / denom; } } }
      for (let i = 0; i < nvar; i++) { a2[i] = 0; for (let j = 0; j < nvar; j++) cmat2[i][j] = 0; }
    }
  }
  for (let i = 0; i < nvar; i++) for (let j = 0; j < i; j++) imat[i][j] = imat[j][i];
  return { loglik, u, imat };
}
export function coxph(time, status, X, { eps = 1e-9, toler = Math.pow(EPS, 0.75), maxiter = 20, tolerInf = Math.sqrt(1e-9) } = {}) {
  const n = time.length, nvar = X[0].length, o = ord(time), T = o.map(i => time[i]), S = o.map(i => status[i]), warnings = [], means = [], scale = [];
  for (let j = 0; j < nvar; j++) { let m = 0; for (let i = 0; i < n; i++) m += X[i][j]; m /= n; let s = 0; for (let i = 0; i < n; i++) s += Math.abs(X[i][j] - m); means.push(m); scale.push(s > 0 ? n / s : 1); }
  const Z = o.map(i => X[i].map((v, j) => (v - means[j]) * scale[j]));
  let beta = new Array(nvar).fill(0), it = coxIter(T, S, Z, beta, nvar); const ll0 = it.loglik; let ll1 = ll0;
  let C = chol2(it.imat, toler), flag = C.flag, step = chsolve(C, it.u); const sctest = step.reduce((s, v, i) => s + v * it.u[i], 0);
  let newbeta = beta.map((b, i) => b + step[i]), halving = 0, iter, conv = false, V, u;
  for (iter = 1; iter <= maxiter; iter++) {
    it = coxIter(T, S, Z, newbeta, nvar); C = chol2(it.imat, toler); flag = C.flag;
    const notfinite = !it.u.every(Number.isFinite) || !it.imat.flat().every(Number.isFinite) || !Number.isFinite(it.loglik);
    if (!notfinite && Math.abs(1 - ll1 / it.loglik) <= eps) { ll1 = it.loglik; V = chinv(C); beta = newbeta; u = it.u; conv = true; break; }
    if (notfinite || it.loglik < ll1) { halving++; newbeta = newbeta.map((b, i) => (b + halving * beta[i]) / (halving + 1)); }
    else { halving = 0; ll1 = it.loglik; step = chsolve(C, it.u); beta = newbeta; newbeta = newbeta.map((b, i) => b + step[i]); }
  }
  if (!conv) { it = coxIter(T, S, Z, beta, nvar); ll1 = it.loglik; C = chol2(it.imat, toler); V = chinv(C); u = it.u; flag = 1000; iter = maxiter; }
  const coef = beta.map((b, i) => b * scale[i]), vr = V.map((r, i) => r.map((v, j) => v * scale[i] * scale[j])), uu = u.map((v, i) => v / scale[i]);
  const sing = flag < nvar ? vr.map((r, i) => r[i] === 0) : coef.map(() => false);
  const infs = vr.map((_, j) => Math.abs(uu.reduce((s, v, i) => s + v * vr[i][j], 0)));
  if (!conv) warnings.push('Ran out of iterations and did not converge');
  else { const bad = infs.map((v, i) => !Number.isFinite(uu[i]) || (v > eps && v > tolerInf * Math.abs(coef[i])) ? i + 1 : 0).filter(Boolean); if (bad.length) warnings.push('Loglik converged before variable  ' + bad.join(',') + ' ; coefficient may be infinite. '); }
  const cf = coef.map((b, i) => sing[i] ? NaN : b), c0 = coef.map((b, i) => sing[i] ? 0 : b), lp = X.map(r => r.reduce((s, v, j) => s + v * c0[j], 0) - c0.reduce((s, b, j) => s + b * means[j], 0));
  return { coef: cf, var: vr, loglik: [ll0, ll1], score: sctest, iter, lp, means, warnings, converged: conv };
}
// cox.zph: zph1 port (single stratum, Efron), transform 'km', per-term and GLOBAL score tests
function coxZph(time, status, X, eta, coef, assign, termNames) {
  const n = time.length, nvar = X[0].length;
  const km = kmCurve(time, status), ttimes = time.map(t => { let s = 1; for (let i = 0; i < km.time.length && km.time[i] < t; i++) s = km.surv[i]; return 1 - s; });
  const ev = status.map(s => s === 1), mt = ttimes.filter((_, i) => ev[i]), gm = mt.reduce((s, v) => s + v, 0) / mt.length, gt = ttimes.map(v => v - gm);
  const o = ord(time); let nevent = status.reduce((s, v) => s + v, 0); const nev0 = nevent;
  const used = X[0].map((_, j) => o.some(p => X[p][j] !== X[o[0]][j]) ? nev0 : 0);
  const means = X[0].map((_, j) => X.reduce((s, r) => s + r[j], 0) / n), Z = X.map(r => r.map((v, j) => v - means[j]));
  const P = 2 * nvar, u = new Array(P).fill(0), imat = zeros(P, P), schoen = zeros(nevent, nvar), a = new Array(nvar).fill(0), a2 = new Array(nvar).fill(0), cmat = zeros(nvar, nvar), cmat2 = zeros(nvar, nvar);
  let denom = 0;
  for (let ip = n - 1; ip >= 0;) {
    let person = o[ip]; const dtime = time[person], tw = gt[person]; let ndead = 0, denom2 = 0;
    for (; ip >= 0; ip--) {
      person = o[ip]; if (time[person] !== dtime) break; const risk = Math.exp(eta[person]), z = Z[person];
      if (status[person] === 0) { denom += risk; for (let i = 0; i < nvar; i++) { a[i] += risk * z[i]; for (let j = 0; j <= i; j++) cmat[i][j] += risk * z[i] * z[j]; } }
      else { ndead++; denom2 += risk; nevent--; for (let i = 0; i < nvar; i++) { schoen[nevent][i] = z[i]; u[i] += z[i]; u[i + nvar] += tw * z[i]; a2[i] += risk * z[i]; for (let j = 0; j <= i; j++) cmat2[i][j] += risk * z[i] * z[j]; } }
    }
    if (ndead > 0) {
      for (let i = 0; i < nvar; i++) { let tm = 0; for (let k = 0; k < ndead; k++) { const tq = (k + 1) / ndead; tm += (a[i] + a2[i] * tq) / (denom + denom2 * tq); } for (let j = 0; j < ndead; j++) schoen[nevent + j][i] -= tm / ndead; }
      for (let k = 0; k < ndead; k++) { denom += denom2 / ndead; for (let i = 0; i < nvar; i++) { a[i] += a2[i] / ndead; const t2 = a[i] / denom; u[i] -= t2; u[i + nvar] -= tw * t2; for (let j = 0; j <= i; j++) { cmat[i][j] += cmat2[i][j] / ndead; const tq = (cmat[i][j] - t2 * a[j]) / denom; imat[j][i] += tq; imat[j][i + nvar] += tw * tq; imat[j + nvar][i + nvar] += tw * tw * tq; } } }
      for (let i = 0; i < nvar; i++) { a2[i] = 0; for (let j = 0; j < nvar; j++) cmat2[i][j] = 0; }
    }
  }
  for (let i = 0; i < nvar; i++) for (let j = 0; j < i; j++) { imat[i][j] = imat[j][i]; imat[i][j + nvar] = imat[j][i + nvar]; imat[i + nvar][j + nvar] = imat[j + nvar][i + nvar]; }
  for (let i = 0; i < nvar; i++) for (let j = 0; j < nvar; j++) imat[i + nvar][j] = imat[j][i + nvar];
  const tIdx = termNames.map((_, t) => t).filter(t => assign.includes(t + 1)), asgn = tIdx.map(t => assign.map((a, j) => a === t + 1 ? j : -1).filter(j => j >= 0)), terms = tIdx.map(t => termNames[t]);
  const all = X[0].map((_, j) => j);
  const testOf = jj => { const kk = [...all, ...jj.map(j => j + nvar)], M = kk.map(r => kk.map(c => imat[r][c])), uv = [...new Array(nvar).fill(0), ...jj.map(j => u[j + nvar])]; return solveLin(M, uv).reduce((acc, v, i) => acc + v * uv[i], 0); };
  const rows = asgn.map((jj, t) => { const ch = testOf(jj); return [terms[t], ch, jj.length, D.pchisq(ch, jj.length, false)]; });
  const g = testOf(all); rows.push(['GLOBAL', g, nvar, D.pchisq(g, nvar, false)]);
  // scaled Schoenfeld residuals (as cox.zph's $y) for the plot
  const xs = o.filter(p => ev[p]).map(p => ttimes[p]);
  let sres = schoen, vmean = all.map(i => all.map(j => imat[i][j] / (Math.min(used[i], used[j]) || 1)));
  if (asgn.some(j => j.length > 1)) { const Tm = all.map(j => asgn.map(jj => jj.includes(j) ? (jj.length === 1 ? 1 : coef[j]) : 0)); sres = sres.map(r => asgn.map((_, t) => r.reduce((s, v, j) => s + v * Tm[j][t], 0))); vmean = asgn.map((_, a1) => asgn.map((_, b1) => { let s = 0; for (let i = 0; i < nvar; i++) for (let j = 0; j < nvar; j++) s += Tm[i][a1] * vmean[i][j] * Tm[j][b1]; return s; })); }
  let ys = null; try { const Vi = invLin(vmean); ys = sres.map(r => Vi.map(row => row.reduce((s, v, j) => s + v * r[j], 0)).map((v, t) => v + (asgn[t].length === 1 ? coef[asgn[t][0]] : 1))); } catch (e) { ys = null; }
  return { rows, x: xs, y: ys, terms };
}
function smooth(x, y, span = 2 / 3) { // local linear tricube smoother (display only)
  const n = x.length, q = Math.max(2, Math.ceil(span * n)), lo = Math.min(...x), hi = Math.max(...x), grid = Array.from({ length: 40 }, (_, i) => lo + (hi - lo) * i / 39);
  return { x: grid, y: grid.map(g => { const d = x.map(v => Math.abs(v - g)), h = (d.slice().sort((a, b) => a - b)[q - 1] || 1) * 1.0000001; let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { const r = d[i] / h, w = r < 1 ? (1 - r ** 3) ** 3 : 0; sw += w; sx += w * x[i]; sy += w * y[i]; sxx += w * x[i] * x[i]; sxy += w * x[i] * y[i]; } if (sw === 0) return NaN; const den = sw * sxx - sx * sx; if (Math.abs(den) < 1e-12 * sw * sw) return sy / sw; const b = (sw * sxy - sx * sy) / den; return (sy - b * sx) / sw + b * g; }) };
}
const stack = svgs => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 648 ' + 396 * svgs.length + '" width="648" height="' + 396 * svgs.length + '">' + svgs.map((s, i) => s.replace('<svg ', '<svg y="' + i * 396 + '" ')).join('') + '</svg>';

// ---------- parametric AFT (survreg) ----------
const lse1p = z => z > 0 ? z + Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z)); // log(1 + e^z)
// per standardized residual z: log f, log S, f'/f, f''/f, f/S
const BASE = {
  extreme: { name: 'Extreme value', f: z => { const w = Math.exp(z); return { lf: z - w, lS: -w, h1: 1 - w, h2: w * (w - 3) + 1, r: w }; }, q: p => Math.log(-Math.log(1 - p)) },
  logistic: { name: 'Logistic', f: z => { const w = Math.exp(z); return { lf: -Math.abs(z) - 2 * Math.log1p(Math.exp(-Math.abs(z))), lS: -lse1p(z), h1: -Math.tanh(z / 2), h2: Number.isFinite(w * w) ? (w * (w - 4) + 1) / ((1 + w) * (1 + w)) : 1, r: 1 / (1 + Math.exp(-z)) }; }, q: p => Math.log(p / (1 - p)) },
  gaussian: { name: 'Gaussian', f: z => { const S = D.pnorm(-z); return { lf: D.dnorm(z, 0, 1, true), lS: Math.log(S), h1: -z, h2: z * z - 1, r: D.dnorm(z) / S }; }, q: p => D.qnorm(p) },
  t: { name: 'Student-t', f: z => { const df = 4, S = D.pt(-z, df); return { lf: D.dt(z, df, true), lS: Math.log(S), h1: -(df + 1) * z / (df + z * z), h2: (df + 1) * (z * z * (df + 3) / (df + z * z) - 1) / (df + z * z), r: D.dt(z, df) / S }; }, q: p => D.qt(p, 4) },
};
// survreg.distributions: [base, transform, fixed scale, printed name]
const DISTS = { extreme: ['extreme'], logistic: ['logistic'], gaussian: ['gaussian'], weibull: ['extreme', true, null, 'Weibull'], exponential: ['extreme', true, 1, 'Exponential'], rayleigh: ['extreme', true, 0.5, 'Rayleigh'], loggaussian: ['gaussian', true, null, 'Log Normal'], lognormal: ['gaussian', true, null, 'Log Normal'], loglogistic: ['logistic', true, null, 'Log logistic'], t: ['t'] };
function matchArg(arg, choices) { // match.arg(arg, choices): exact, else unique partial match
  const msg = "'arg' should be one of " + choices.map(c => '“' + c + '”').join(', ');
  need(typeof arg === 'string' && arg.length > 0, msg); if (choices.includes(arg)) return arg;
  const m = choices.filter(c => c.startsWith(arg)); need(m.length === 1, msg); return m[0];
}
function aftLik(y, st, X, par, base, fixedScale) {
  const n = y.length, p = X[0].length, ls = fixedScale ? Math.log(fixedScale) : par[p], sig = Math.exp(ls), np = fixedScale ? p : p + 1;
  let ll = 0; const g = new Array(np).fill(0), H = zeros(np, np);
  for (let i = 0; i < n; i++) {
    let eta = 0; for (let j = 0; j < p; j++) eta += X[i][j] * par[j]; const z = (y[i] - eta) / sig, d = base.f(z);
    let l, lz, lzz; if (st[i] === 1) { l = d.lf - ls; lz = d.h1; lzz = d.h2 - d.h1 * d.h1; } else { l = d.lS; lz = -d.r; lzz = -d.r * d.h1 - d.r * d.r; }
    ll += l; const le = -lz / sig, lee = lzz / (sig * sig);
    for (let a = 0; a < p; a++) { g[a] += le * X[i][a]; for (let b = 0; b <= a; b++) H[a][b] += lee * X[i][a] * X[i][b]; }
    if (!fixedScale) { g[p] += -lz * z - (st[i] === 1 ? 1 : 0); H[p][p] += lzz * z * z + lz * z; const les = (lzz * z + lz) / sig; for (let a = 0; a < p; a++) H[p][a] += les * X[i][a]; }
  }
  for (let a = 0; a < np; a++) for (let b = 0; b < a; b++) H[b][a] = H[a][b];
  return { ll, g, H };
}
// maximum likelihood by damped Newton–Raphson, iterated to full convergence
function aftFit(y, st, X, base, fixedScale) {
  const n = y.length, p = X[0].length, np = fixedScale ? p : p + 1;
  const XtX = X[0].map((_, a) => X[0].map((_, b) => X.reduce((s, r) => s + r[a] * r[b], 0))), Xty = X[0].map((_, a) => X.reduce((s, r, i) => s + r[a] * y[i], 0));
  let beta; try { beta = solveLin(XtX, Xty); } catch (e) { beta = X[0].map((_, j) => j === 0 ? y.reduce((s, v) => s + v, 0) / n : 0); }
  const res = y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0)), s0 = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n) || 1;
  let par = fixedScale ? beta : [...beta, Math.log(s0)], cur = aftLik(y, st, X, par, base, fixedScale), iter, conv = false;
  for (iter = 1; iter <= 200; iter++) {
    const negH = cur.H.map(r => r.map(v => -v)); let step;
    try { step = solveLin(negH, cur.g); } catch (e) { step = null; }
    if (!step || !step.every(Number.isFinite) || step.reduce((s, v, i) => s + v * cur.g[i], 0) < 0) step = cur.g.map((v, i) => v / Math.max(1, Math.abs(negH[i][i])));
    let t = 1, next = null;
    for (let h = 0; h < 60; h++) { const cand = par.map((v, i) => v + t * step[i]), L = aftLik(y, st, X, cand, base, fixedScale); if (Number.isFinite(L.ll) && L.ll >= cur.ll - 1e-12 * Math.abs(cur.ll)) { next = { par: cand, L }; break; } t /= 2; }
    if (!next) { conv = Math.max(...cur.g.map(Math.abs)) < 1e-6; break; }
    const dpar = Math.max(...step.map((v, i) => Math.abs(t * v) / (1 + Math.abs(par[i]))));
    par = next.par; cur = next.L;
    if (dpar < 1e-11) { conv = true; break; }
  }
  return { par, ll: cur.ll, H: cur.H, iter, converged: conv, np };
}

// ---------- method handlers ----------
function survData(ctx) {
  ctx.clean();
  const tv = ctx.value('time'), ev = ctx.value('event');
  need(tv !== null && ev !== null && !isFactor(tv) && !isFactor(ev) && tv.every(v => v >= 0) && ev.every(v => v === 0 || v === 1), 'Duration must be nonnegative and event status must be 0/1.');
  return { time: aeq(Array.from(tv)), event: Array.from(ev), raw: Array.from(tv) };
}
const lvlLabel = l => rnum(Math.round(l * 100 * 100) / 100);

register('km', ctx => {
  const { time, event } = survData(ctx), level = ctx.level, gname = ctx.g[0];
  let groups;
  if (gname) { const gv = ctx.d.get(gname), lv = isFactor(gv) ? gv.levels : [...new Set(gv)].sort((a, b) => a - b).map(fmtR), codes = isFactor(gv) ? gv.codes : gv.map(v => lv.indexOf(fmtR(v))); groups = lv.map((l, k) => ({ label: gname + '=' + l, idx: codes.map((c, i) => c === k ? i : -1).filter(i => i >= 0) })).filter(g => g.idx.length); }
  else groups = [{ label: 'All', idx: time.map((_, i) => i) }];
  const curves = groups.map(g => ({ ...g, c: kmCurve(g.idx.map(i => time[i]), g.idx.map(i => event[i])) })), rows = [];
  for (const g of curves) g.c.time.forEach((t, i) => { if (g.c.nevent[i] > 0) { const [lo, up] = logCI(g.c.surv[i], g.c.se[i], level); rows.push([t, g.c.nrisk[i], g.c.nevent[i], g.c.surv[i], lo, up, g.label]); } });
  ctx.table('Survival table', ['Time', 'At.risk', 'Events', 'Survival', 'Lower', 'Upper', 'Group'], rows);
  if (gname) {
    need(curves.length >= 2, 'There is only 1 group');
    const grp = new Array(time.length); curves.forEach((g, k) => g.idx.forEach(i => { grp[i] = k; }));
    const lr = survdiff(time, event, grp, curves.length), df = curves.length - 1;
    ctx.table('Log-rank comparison', ['Chi.square', 'DF', 'P'], [[lr.chi, df, pchisqU(lr.chi, df)]]);
    ctx.diag(['Call:', 'survival::survdiff(formula = ff, data = d)', '', ...printTable(['N', 'Observed', 'Expected', '(O-E)^2/E', '(O-E)^2/V'], curves.map((g, k) => [g.idx.length, lr.obs[k], lr.exp[k], (lr.obs[k] - lr.exp[k]) ** 2 / lr.exp[k], (lr.obs[k] - lr.exp[k]) ** 2 / lr.V[k][k]]), curves.map(g => g.label)), '', ' Chisq= ' + fmtSig(lr.chi, 2) + '  on ' + df + ' degrees of freedom, p= ' + fmtP(pchisqU(lr.chi, df), 1), '']);
  }
  const cols = [ctx.accent, '#357F93', '#B0572F'], layers = [];
  curves.forEach((g, k) => {
    const xs = [0, ...g.c.time], ys = [1, ...g.c.surv], col = cols[k % 3], xend = g.c.time[g.c.time.length - 1];
    layers.push({ type: 'step', x: xs, y: ys, color: col, width: 2, xend });
    if (curves.length === 1) { const ci = g.c.surv.map((s, i) => logCI(s, g.c.se[i], level)); layers.push({ type: 'step', x: xs, y: [1, ...ci.map(r => r[0])], color: col, dash: true, xend }, { type: 'step', x: xs, y: [1, ...ci.map(r => r[1])], color: col, dash: true, xend }); }
    const cx = [], cy = []; g.c.time.forEach((t, i) => { if (g.c.ncensor[i] > 0) { cx.push(t); cy.push(g.c.surv[i]); } }); if (cx.length) layers.push({ type: 'text', x: cx, y: cy, labels: cx.map(() => '+'), color: col, size: 12 });
  });
  ctx.plot('Kaplan–Meier survival', svgPlot({ xlab: 'Time', ylab: 'Survival probability', ylim: [0, 1.02], layers, legend: curves.length > 1 ? curves.map((g, k) => ({ label: g.label, color: cols[k % 3] })) : null }));
  const pc = rnum(Math.round(level * 100) / 100);
  ctx.diag(['Call: survfit(formula = ff, data = d, conf.int = level)', '', ...printTable(['n', 'events', 'median', pc + 'LCL', pc + 'UCL'], curves.map(g => [g.idx.length, g.c.nevent.reduce((s, v) => s + v, 0), ...kmMedian(g.c, level)]), curves.length > 1 ? curves.map(g => g.label) : ['[1,]'])]);
});

register('cox', ctx => {
  const { time, event } = survData(ctx), nev = event.reduce((s, v) => s + v, 0);
  ctx.table('Survival sample', ['Complete.rows', 'Events', 'Censored'], [[ctx.d.n, nev, event.length - nev]]);
  need(nev > 0, 'At least one observed event is required.');
  const terms = ctx.rhs(ctx.x).map(v => ({ vars: [v] })), mm = modelMatrix(ctx.d, terms, { intercept: true });
  const X = mm.X.map(r => r.slice(1)), names = mm.names.slice(1), assign = mm.assign.slice(1), n = X.length;
  const fit = coxph(time, event, X); fit.warnings.forEach(w => ctx.warn(w));
  const se = fit.coef.map((b, i) => Number.isFinite(b) ? Math.sqrt(fit.var[i][i]) : NaN), z = fit.coef.map((b, i) => b / se[i]), pv = z.map(v => 2 * D.pnorm(-Math.abs(v)));
  const k = fit.coef.filter(Number.isFinite).length, ll = fit.loglik[1], lrt = 2 * (fit.loglik[1] - fit.loglik[0]), ki = fit.coef.map((v, i) => Number.isFinite(v) ? i : -1).filter(i => i >= 0);
  let wald = NaN; try { const bs = ki.map(i => fit.coef[i]); wald = solveLin(ki.map(a => ki.map(b => fit.var[a][b])), bs).reduce((s, v, i) => s + v * bs[i], 0); } catch (e) { wald = NaN; }
  const zq = D.qnorm(1 - (1 - ctx.level) / 2), lab = lvlLabel(ctx.level);
  const hr = names.map((nm, i) => [nm, Math.exp(fit.coef[i]), Math.exp(-fit.coef[i]), Math.exp(fit.coef[i] - zq * se[i]), Math.exp(fit.coef[i] + zq * se[i])]);
  fitout(ctx, {
    kind: 'coxph', n, crit: 'z', logLik: ll, AIC: -2 * ll + 2 * k, BIC: -2 * ll + Math.log(nev) * k,
    coefTable: { rownames: names, columns: ['coef', 'se(coef)', 'z', 'Pr(>|z|)'], rows: names.map((_, i) => [fit.coef[i], se[i], z[i], pv[i]]) },
    summaryText: () => ['Call:', 'survival::coxph(formula = ff, data = d, model = TRUE, x = TRUE)', '', '  n= ' + n + ', number of events= ' + nev + ' ', '',
      ...printCoefmat(names, ['coef', 'exp(coef)', 'se(coef)', 'z', 'Pr(>|z|)'], names.map((_, i) => [fit.coef[i], Math.exp(fit.coef[i]), se[i], z[i], pv[i]])), '---', "Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1", '',
      ...printTable(['exp(coef)', 'exp(-coef)', 'lower .' + lab, 'upper .' + lab], hr.map(r => r.slice(1)), names), '',
      'Likelihood ratio test= ' + fmtSig(lrt, 4) + '  on ' + k + ' df,   p=' + fmtP(D.pchisq(lrt, k, false), 1),
      'Wald test            = ' + fmtSig(wald, 4) + '  on ' + k + ' df,   p=' + fmtP(D.pchisq(wald, k, false), 1),
      'Score (logrank) test = ' + fmtSig(fit.score, 4) + '  on ' + k + ' df,   p=' + fmtP(D.pchisq(fit.score, k, false), 1), ''],
  });
  ctx.table('Hazard ratios', ['Term', 'exp(coef)', 'exp(-coef)', 'lower .' + lab, 'upper .' + lab], hr);
  const ph = coxZph(time, event, X, fit.lp, fit.coef, assign, terms.map(t => t.vars.join(':')));
  ctx.table('Proportional-hazards checks', ['Term', 'chisq', 'df', 'p'], ph.rows);
  const panels = ph.terms.map((tn, t) => { if (!ph.y) return svgPlot({ xlab: 'Time', ylab: 'Beta(t) for ' + tn }); const yy = ph.y.map(r => r[t]), sm = smooth(ph.x, yy); return svgPlot({ xlab: 'Time (KM scale)', ylab: 'Beta(t) for ' + tn, layers: [{ type: 'points', x: ph.x, y: yy, color: ctx.accent, alpha: 0.5 }, { type: 'line', x: sm.x, y: sm.y, color: '#194F39', width: 2 }] }); });
  ctx.plot('Schoenfeld residuals', panels.length === 1 ? panels[0] : stack(panels));
});

register('survreg', ctx => {
  const { raw, event } = survData(ctx), terms = ctx.rhs(ctx.x).map(v => ({ vars: [v] }));
  const dist = matchArg(ctx.opt('distribution', 'weibull'), Object.keys(DISTS)), [bname, trans, fixed, pname] = DISTS[dist], base = BASE[bname];
  let y = raw.slice(), logcorrect = 0;
  if (trans) { y = raw.map(Math.log); raw.forEach((t, i) => { if (event[i] === 1) logcorrect -= Math.log(t); }); need(y.every(Number.isFinite), 'Invalid survival times for this distribution'); }
  const mm = modelMatrix(ctx.d, terms, { intercept: true }), X = mm.X, p = X[0].length, n = X.length;
  const fit = aftFit(y, event, X, base, fixed), fit0 = aftFit(y, event, X.map(() => [1]), base, fixed);
  if (!fit.converged) ctx.warn('Ran out of iterations and did not converge');
  const ll = fit.ll + logcorrect, ll0 = fit0.ll + logcorrect, scale = fixed || Math.exp(fit.par[p]), chi = 2 * (ll - ll0);
  let V = null; try { V = invLin(fit.H.map(r => r.map(v => -v))); } catch (e) { V = null; }
  const names = [...mm.names, ...(fixed ? [] : ['Log(scale)'])], se = names.map((_, i) => V ? Math.sqrt(V[i][i]) : NaN);
  fitout(ctx, {
    kind: 'survreg', n, nobs: n, coefTable: null, logLik: ll, AIC: -2 * ll + 2 * fit.np, BIC: -2 * ll + Math.log(n) * fit.np,
    summaryText: () => ['', 'Call:', 'survival::survreg(formula = ff, data = d, dist = opt("distribution", ', '    "weibull"))', ...printCoefmat(names, ['Value', 'Std. Error', 'z', 'p'], names.map((_, i) => [fit.par[i], se[i], fit.par[i] / se[i], 2 * D.pnorm(-Math.abs(fit.par[i] / se[i]))])), '',
      fixed ? 'Scale fixed at ' + rnum(fixed) + ' ' : 'Scale= ' + fmtSig(scale, 3) + ' ', '', (pname || base.name) + ' distribution', 'Loglik(model)= ' + fmtSig(ll, 4) + '   Loglik(intercept only)= ' + fmtSig(ll0, 4),
      '\tChisq= ' + fmtSig(chi, 3) + ' on ' + (p - 1) + ' degrees of freedom, p= ' + fmtSig(D.pchisq(chi, p - 1, false), 2) + ' ', 'Number of Newton-Raphson Iterations: ' + fit.iter + ' ', 'n= ' + n + ' ', ''],
  });
  const qs = [0.25, 0.5, 0.75].map(base.q), rows = X.map(r => { const lp = r.reduce((s, v, j) => s + v * fit.par[j], 0); return qs.map(q => trans ? Math.exp(lp + q * scale) : lp + q * scale); });
  ctx.table('Predicted survival-time quantiles', ['V1', 'V2', 'V3'], rows.slice(0, 200), Math.min(200, rows.length));
  ctx.note('Accelerated-failure-time coefficients, not Cox log-hazard ratios.');
});
