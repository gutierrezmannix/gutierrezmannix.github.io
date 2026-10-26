// Count models: MASS::glm.nb (negative.binomial family, theta.ml, the alternating fit) and pscl::hurdle /
// pscl::zeroinfl (their log-likelihoods, analytic gradients, starting values and optim(BFGS) + optimhess).
import * as D from './dist.mjs';
import * as L from './linalg.mjs';
import { glm, families } from './models.mjs';
import { optimBFGS } from './regression-optim.mjs';

const EPS = 2.220446049250313e-16;
// digamma / trigamma with the asymptotic series started at x >= 12 (error < 1e-17)
export function digamma(x) { let r = 0; while (x < 12) { r -= 1 / x; x += 1; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f * (1 / 132 - f * 691 / 32760))))); }
export function trigamma(x) { let r = 0; while (x < 12) { r += 1 / (x * x); x += 1; } const f = 1 / (x * x); return r + 1 / x + f / 2 + f / x * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f * (1 / 30 - f * 5 / 66)))); }
const lgam = D.lgamma;
// make.link('logit') as R's C code (x_d_opx with the ±30 thresholds)
export const logitInv = e => { const t = e < -30 ? EPS : e > 30 ? 1 / EPS : Math.exp(e); return t / (1 + t); };
export const logitMuEta = e => { const o = 1 + Math.exp(e); return e > 30 || e < -30 ? EPS : Math.exp(e) / (o * o); };
const logExp = e => Math.max(Math.exp(e), EPS);
// log P(Y = 0) and log P(Y > 0) for NB(mu, theta) and Poisson(mu)
const nb0 = (mu, th) => th * (th < mu ? Math.log(th / (th + mu)) : Math.log1p(-mu / (th + mu)));
const lnb0 = (mu, th) => th * Math.log(th / (th + mu)), lnb0u = (mu, th) => { const l = lnb0(mu, th); return l > -Math.LN2 ? Math.log(-Math.expm1(l)) : Math.log1p(-Math.exp(l)); };
const lp0u = mu => mu < Math.LN2 ? Math.log(-Math.expm1(-mu)) : Math.log1p(-Math.exp(-mu));
const dnbLog = (y, th, mu) => D.dnbinomMu(y, th, mu, true);

// ---------- MASS::negative.binomial(theta) ----------
export function nbFamily(theta) {
  return { family: 'Negative Binomial(' + fmt4(theta) + ')', link: 'log', theta, linkfun: m => Math.log(m), linkinv: logExp, muEta: logExp, variance: m => m + m * m / theta,
    devResid: (y, m, w) => 2 * w * (y * Math.log(Math.max(1, y) / m) - (y + theta) * Math.log((y + theta) / (m + theta))), validMu: m => m > 0,
    init: y => y.map(v => v + (v === 0 ? 1 / 6 : 0)), aic: (y, n, mu, wt) => 2 * y.reduce((s, v, i) => s + wt[i] * ((v + theta) * Math.log(mu[i] + theta) - v * Math.log(mu[i]) + lgam(v + 1) - theta * Math.log(theta) + lgam(theta) - lgam(theta + v)), 0), dispersionFree: true };
}
const fmt4 = v => { const r = Math.round(v * 1e4) / 1e4; return String(Number(r.toPrecision(7))); };
export function thetaML(y, mu, n, w, limit = 10, warnings = []) {
  const eps = Math.pow(EPS, 0.25);
  const score = th => { let s = 0; for (let i = 0; i < y.length; i++) s += w[i] * (digamma(th + y[i]) - digamma(th) + Math.log(th) + 1 - Math.log(th + mu[i]) - (y[i] + th) / (mu[i] + th)); return s; };
  const info = th => { let s = 0; for (let i = 0; i < y.length; i++) s += w[i] * (-trigamma(th + y[i]) + trigamma(th) - 1 / th + 2 / (mu[i] + th) - (y[i] + th) / ((mu[i] + th) ** 2)); return s; };
  let t0 = n / y.reduce((s, v, i) => s + w[i] * (v / mu[i] - 1) ** 2, 0), it = 0, del = 1, inf = NaN;
  while ((it = it + 1) < limit && Math.abs(del) > eps) { t0 = Math.abs(t0); inf = info(t0); del = score(t0) / inf; t0 = t0 + del; }
  if (t0 < 0) { t0 = 0; warnings.push('estimate truncated at zero'); }
  if (it === limit) warnings.push('iteration limit reached');
  return { theta: t0, se: Math.sqrt(1 / inf) };
}
// models.mjs glm() recomputes the null deviance with an intercept + offset by calling itself, which recurses until
// the stack overflows (slow); the null deviance is not used here, so hide the intercept name from it.
function glmQuiet(des, fam, opts) {
  if (!des.offset || des.names[0] !== '(Intercept)') return glm(des, fam, opts);
  const m = glm({ ...des, names: ['.(Intercept)', ...des.names.slice(1)] }, fam, opts), fix = a => a.map(v => v === '.(Intercept)' ? '(Intercept)' : v);
  m.names = fix(m.names); m.coefTable.rownames = fix(m.coefTable.rownames); m.nullDeviance = NaN; return m;
}
// MASS::glm.nb(formula) with default control (maxit 25, epsilon 1e-8)
export function glmNB(des) {
  const { y } = des, n = y.length, w = new Array(n).fill(1), warnings = [], maxit = 25, epsilon = 1e-8;
  const loglik = (th, mu) => { let s = 0; for (let i = 0; i < n; i++) s += w[i] * (lgam(th + y[i]) - lgam(th) - lgam(y[i] + 1) + th * Math.log(th) + y[i] * Math.log(mu[i] + (y[i] === 0 ? 1 : 0)) - (th + y[i]) * Math.log(th + mu[i])); return s; };
  let fit = glmQuiet(des, families.poisson()); fit.warnings.forEach(v => warnings.push(v));
  let mu = fit.mu, tr = thetaML(y, mu, n, w, maxit, warnings), th = tr.theta, fam = nbFamily(th), iter = 0;
  const d1 = Math.sqrt(2 * Math.max(1, fit.dfResidual)), d2 = 1; let del = 1, Lm = loglik(th, mu), Lm0 = Lm + 2 * d1;
  while ((iter = iter + 1) <= maxit && (Math.abs(Lm0 - Lm) / d1 + Math.abs(del) / d2) > epsilon) {
    fit = glmQuiet(des, fam, { mustart: mu }); fit.warnings.forEach(v => warnings.push(v));
    const t0 = th; tr = thetaML(y, mu, n, w, maxit, warnings); th = tr.theta; fam = nbFamily(th);
    mu = fit.mu; del = t0 - th; Lm0 = Lm; Lm = loglik(th, mu);
  }
  if (iter > maxit) warnings.push('alternation limit reached');
  const m = fit; m.theta = th; m.SEtheta = tr.se; m.twologlik = 2 * Lm; m.warnings = warnings; m.nbFamily = fam;
  m.aic = -m.twologlik + 2 * m.rank + 2; m.dfLL = m.rank + 1; m.logLik = Lm; m.AIC = -2 * Lm + 2 * m.dfLL; m.BIC = -2 * Lm + Math.log(n) * m.dfLL;
  return m;
}

// ---------- pscl helpers ----------
const xb = (X, b, off, k0 = 0, k = X[0].length) => X.map((r, i) => { let s = 0; for (let j = 0; j < k; j++) s += r[j] * b[k0 + j]; return s + off[i]; });
const colSums = (X, f, idx) => { const k = X[0].length, o = new Array(k).fill(0); for (const i of idx) { const v = f(i); for (let j = 0; j < k; j++) o[j] += v * X[i][j]; } return o; };
function solveNeg(H) { const F = L.lu(H); if (F.singular) return null; const n = H.length; return L.t(L.ident(n).map(e => L.luSolve(F, e))).map(r => r.map(v => -v)); }
function lmwfitCoef(X, y) { const f = L.lsfit(X, y); return f.coef.map(v => Number.isNaN(v) ? 0 : v); }
function glmCoef(X, y, fam, off) { const g = glm({ X, y, names: X[0].map((_, j) => 'c' + j), offset: off }, fam); return g.coef.map(v => Number.isNaN(v) ? NaN : v); }
const binomZ = (y) => y.map(v => v > 0 ? 1 : 0);

// pscl::hurdle(y ~ x, dist) with zero.dist = 'binomial' (logit), separate = TRUE
export function hurdle(X, Z, Y, offx, offz, dist) {
  const n = Y.length, kx = X[0].length, kz = Z[0].length, Y1 = [], Y0 = []; Y.forEach((v, i) => (v > 0 ? Y1 : Y0).push(i));
  const nb = dist === 'negbin', ctl = { fnscale: -1, reltol: Math.pow(EPS, 1 / 1.6), maxit: 10000, hessian: true };
  const countLL = p => { const eta = xb(X, p, offx, 0, kx), th = nb ? Math.exp(p[kx]) : 0; let s1 = 0, s0 = 0; for (const i of Y1) { const mu = Math.exp(eta[i]); if (nb) { s1 += dnbLog(Y[i], th, mu); s0 += Math.log(1 - Math.exp(nb0(mu, th))); } else { s1 += D.dpois(Y[i], mu, true); s0 += Math.log(1 - Math.exp(-mu)); } } return s1 - s0; };
  const countGr = p => {
    const eta = xb(X, p, offx, 0, kx);
    if (!nb) return colSums(X, i => { const mu = Math.exp(eta[i]); return (Y[i] - mu) - Math.exp(-mu - lp0u(mu) + eta[i]); }, Y1);
    const th = Math.exp(p[kx]); let r2 = 0;
    const g = colSums(X, i => { const mu = Math.exp(eta[i]), lr = lnb0(mu, th) - lnb0u(mu, th); return (Y[i] - mu * (Y[i] + th) / (mu + th)) - Math.exp(lr + Math.log(th) - Math.log(mu + th) + eta[i]); }, Y1);
    for (const i of Y1) { const mu = Math.exp(eta[i]), lr = lnb0(mu, th) - lnb0u(mu, th); r2 += digamma(Y[i] + th) - digamma(th) + Math.log(th) - Math.log(mu + th) + 1 - (Y[i] + th) / (mu + th) + Math.exp(lr) * (Math.log(th) - Math.log(mu + th) + 1 - th / (mu + th)); }
    return [...g, r2 * th];
  };
  const zeroLL = p => { const eta = xb(Z, p, offz); let s0 = 0, s1 = 0; for (const i of Y0) s0 += Math.log(1 - logitInv(eta[i])); for (const i of Y1) s1 += Math.log(logitInv(eta[i])); return s0 + s1; };
  const zeroGr = p => { const eta = xb(Z, p, offz); return colSums(Z, i => { const mu = logitInv(eta[i]); return (Y[i] <= 0 ? -1 / (1 - mu) : 1 / mu) * logitMuEta(eta[i]); }, Y.map((_, i) => i)); };
  const sc = glmCoef(X, Y, families.poisson(), offx), sz = glmCoef(Z, binomZ(Y), families.binomial(), offz);
  const fc = optimBFGS([...sc, ...(nb ? [0] : [])], countLL, countGr, ctl), fz = optimBFGS(sz, zeroLL, zeroGr, ctl);
  const vcC = solveNeg(fc.hessian), vcZ = solveNeg(fz.hessian), warnings = [];
  if (!vcC || !vcZ) warnings.push('Lapack routine dgesv: system is exactly singular');
  const seC = vcC ? vcC.map((r, i) => Math.sqrt(r[i])) : new Array(kx + (nb ? 1 : 0)).fill(NaN), seZ = vcZ ? vcZ.map((r, i) => Math.sqrt(r[i])) : new Array(kz).fill(NaN);
  const coefc = fc.par.slice(0, kx), coefz = fz.par.slice(0, kz), theta = nb ? Math.exp(fc.par[kx]) : null;
  const etaz = xb(Z, coefz, offz), etax = xb(X, coefc, offx);
  const fitted = Y.map((_, i) => { const phi = logitInv(etaz[i]), mu = Math.exp(etax[i]), p0c = nb ? lnb0u(mu, theta) : lp0u(mu); return Math.exp((Math.log(phi) - p0c) + Math.log(mu)); });
  const np = kx + kz + (nb ? 1 : 0);
  return { kind: 'hurdle', n, nobs: n, coefc, coefz, theta, seC, seZ, nb, loglik: fc.value + fz.value, df: np, converged: fc.convergence < 1 && fz.convergence < 1, fitted, warnings, iterations: [fc.counts, fz.counts] };
}

// pscl::zeroinfl(y ~ x, dist) with a logit zero-inflation model, EM = FALSE
export function zeroinfl(X, Z, Y, offx, offz, dist) {
  const n = Y.length, kx = X[0].length, kz = Z[0].length, Y1 = [], Y0 = []; Y.forEach((v, i) => (v > 0 ? Y1 : Y0).push(i));
  const nb = dist === 'negbin', ctl = { fnscale: -1, reltol: Math.pow(EPS, 1 / 1.6), maxit: 10000 }, all = Y.map((_, i) => i);
  const ll = (p, trunc = false) => {
    const eta = xb(X, p, offx, 0, kx), etaz = trunc ? null : xb(Z, p, offz, kx, kz), th = nb ? Math.exp(p[kx + kz]) : 0;
    let s0 = 0, s1 = 0;
    const l0 = i => { const mu = Math.exp(eta[i]), phi = trunc ? 0 : logitInv(etaz[i]); return Math.log(phi + Math.exp(Math.log(1 - phi) + (nb ? nb0(mu, th) : -mu))); };
    const l1 = i => { const mu = Math.exp(eta[i]), phi = trunc ? 0 : logitInv(etaz[i]); return Math.log(1 - phi) + (nb ? dnbLog(Y[i], th, mu) : D.dpois(Y[i], mu, true)); };
    if (trunc) { for (const i of Y1) s1 += l1(i); for (const i of Y1) s0 += Math.log(1 - Math.exp(l0(i))); return s1 - s0; }
    for (const i of Y0) s0 += l0(i); for (const i of Y1) s1 += l1(i); return s0 + s1;
  };
  const grad = p => {
    const eta = xb(X, p, offx, 0, kx), etaz = xb(Z, p, offz, kx, kz), th = nb ? Math.exp(p[kx + kz]) : 0, gc = new Array(kx).fill(0), gz = new Array(kz).fill(0); let gt = 0;
    for (const i of all) {
      const mu = Math.exp(eta[i]), muz = logitInv(etaz[i]), me = logitMuEta(etaz[i]), y1 = Y[i] > 0, cl0 = nb ? D.dnbinomMu(0, th, mu, true) : -mu;
      const dens0 = muz * (y1 ? 0 : 1) + Math.exp(Math.log(1 - muz) + cl0);
      const wc = y1 ? (nb ? Y[i] - mu * (Y[i] + th) / (mu + th) : Y[i] - mu) : -Math.exp(-Math.log(dens0) + Math.log(1 - muz) + cl0 + (nb ? Math.log(th) - Math.log(mu + th) : 0) + Math.log(mu));
      const wz = y1 ? -1 / (1 - muz) * me : (me - Math.exp(cl0) * me) / dens0;
      for (let j = 0; j < kx; j++) gc[j] += wc * X[i][j]; for (let j = 0; j < kz; j++) gz[j] += wz * Z[i][j];
      if (nb) gt += th * (y1 ? digamma(Y[i] + th) - digamma(th) + Math.log(th) - Math.log(mu + th) + 1 - (Y[i] + th) / (mu + th) : Math.exp(-Math.log(dens0) + Math.log(1 - muz) + cl0) * (Math.log(th) - Math.log(mu + th) + 1 - th / (mu + th)));
    }
    return nb ? [...gc, ...gz, gt] : [...gc, ...gz];
  };
  const countGr = p => {
    const eta = xb(X, p, offx, 0, kx);
    if (!nb) return colSums(X, i => { const mu = Math.exp(eta[i]); return (Y[i] - mu) - Math.exp(-mu - lp0u(mu) + eta[i]); }, Y1);
    const th = Math.exp(p[kx]); let r2 = 0;
    const g = colSums(X, i => { const mu = Math.exp(eta[i]), lr = lnb0(mu, th) - lnb0u(mu, th); return (Y[i] - mu * (Y[i] + th) / (mu + th)) - Math.exp(lr + Math.log(th) - Math.log(mu + th) + eta[i]); }, Y1);
    for (const i of Y1) { const mu = Math.exp(eta[i]), lr = lnb0(mu, th) - lnb0u(mu, th); r2 += digamma(Y[i] + th) - digamma(th) + Math.log(th) - Math.log(mu + th) + 1 - (Y[i] + th) / (mu + th) + Math.exp(lr) * (Math.log(th) - Math.log(mu + th) + 1 - th / (mu + th)); }
    return [...g, r2 * th];
  };
  const sz = glmCoef(Z, Y.map(v => v <= 0 ? 1 : 0), families.binomial(), offz);
  const lmstart = lmwfitCoef(Y1.map(i => X[i]), Y1.map(i => Math.log(Y[i]) - offx[i]));
  let conv0 = 1, tfit = null;
  try { tfit = optimBFGS([...lmstart, ...(nb ? [0] : [])], p => ll([...p.slice(0, kx), ...new Array(kz).fill(0), ...p.slice(kx)], true), countGr, ctl); conv0 = tfit.convergence; } catch (e) { conv0 = 1; }
  let start;
  if (conv0 === 0) start = [...glmCoef(X, Y, families.poisson(), offx), ...sz, ...(nb ? [0] : [])];
  else start = [...(tfit ? tfit.par.slice(0, kx) : lmstart), ...sz, ...(nb ? [tfit && tfit.par.length > kx ? tfit.par[kx] : 0] : [])];
  const fit = optimBFGS(start, p => ll(p), grad, { ...ctl, hessian: true }), warnings = [];
  if (fit.convergence > 0) warnings.push('optimization failed to converge');
  const vc = solveNeg(fit.hessian); if (!vc) warnings.push('Lapack routine dgesv: system is exactly singular');
  const se = vc ? vc.map((r, i) => Math.sqrt(r[i])) : new Array(start.length).fill(NaN);
  const coefc = fit.par.slice(0, kx), coefz = fit.par.slice(kx, kx + kz), theta = nb ? Math.exp(fit.par[kx + kz]) : null;
  const etax = xb(X, coefc, offx), etaz = xb(Z, coefz, offz), fitted = Y.map((_, i) => (1 - logitInv(etaz[i])) * Math.exp(etax[i]));
  return { kind: 'zeroinfl', n, nobs: n, coefc, coefz, theta, seC: [...se.slice(0, kx), ...(nb ? [se[kx + kz]] : [])], seZ: se.slice(kx, kx + kz), nb, loglik: fit.value, df: start.length, converged: fit.convergence < 1, fitted, warnings, iterations: fit.counts };
}
