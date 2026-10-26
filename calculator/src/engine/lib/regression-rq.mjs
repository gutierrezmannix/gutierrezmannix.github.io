// quantreg: rq(method = 'br') — a port of the Barrodale–Roberts simplex in quantreg's rqbr.f (Koenker–d'Orey;
// single-quantile path, no rank-inversion intervals) — and summary.rq(se = 'nid') with the Hall–Sheather bandwidth.
import * as L from './linalg.mjs';
import * as D from './dist.mjs';

const sgn = v => v < 0 || Object.is(v, -0) ? -1 : 1;
// returns { coef, flag } (flag 1 = solution may be nonunique, 2 = premature end)
export function rqbr(A, b, t) {
  const m = A.length, n = A[0].length, toler = Math.pow(2.220446049250313e-16, 2 / 3), big = Number.MAX_VALUE;
  const m1 = m + 1, m2 = m + 2, m3 = m + 3, m4 = m + 4, m5 = m + 5, n1 = n + 1, n2 = n + 2, n3 = n + 3, n4 = n + 4;
  const wa = Array.from({ length: m5 + 1 }, () => new Float64Array(n4 + 1)), wb = new Float64Array(m + 1), s = new Int32Array(m + 1), x = new Float64Array(n + 1);
  let ift = 0; wa[m2][n1] = 1;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) wa[i][j] = A[i - 1][j - 1];
    wa[i][n4] = n + i; wa[i][n2] = b[i - 1]; wa[i][n3] = 0; wa[i][n1] = wa[i][n2] - wa[i][n3];
    if (wa[i][n1] < 0) for (let j = 1; j <= n4; j++) wa[i][j] = -wa[i][j];
  }
  for (let j = 1; j <= n; j++) {
    wa[m4][j] = j; wa[m2][j] = 0; wa[m3][j] = 0;
    for (let i = 1; i <= m; i++) { const aux = sgn(wa[m4][j]) * wa[i][j]; wa[m2][j] += aux * (1 - sgn(wa[i][n4])); wa[m3][j] += aux * sgn(wa[i][n4]); }
    wa[m3][j] = 2 * wa[m3][j];
  }
  for (let j = 1; j <= n; j++) wa[m1][j] = wa[m2][j] + wa[m3][j] * t;
  let stage = true, kr = 1, kl = 1, kount = 0, inn = 0, out = 0, k = 0, test = false, pivot = 0, label = 30;
  const flipCol = c => { for (let i = 1; i <= m4; i++) wa[i][c] = -wa[i][c]; };
  for (;;) {
    switch (label) {
      case 23052: stage = false; label = 23055; break;
      case 23055: {
        let max = -big;
        for (let j = kr; j <= n; j++) { let d = wa[m1][j]; if (d < 0) { if (d > -2) continue; d = -d - 2; } if (d > max) { max = d; inn = j; } }
        if (max <= toler) { label = 23054; break; }
        if (wa[m1][inn] <= 0) { flipCol(inn); wa[m1][inn] -= 2; wa[m2][inn] -= 2; }
        label = 23072; break;
      }
      case 23072: {
        k = 0;
        for (let i = kl; i <= m; i++) { const d = wa[i][inn]; if (d > toler) { k++; wb[k] = wa[i][n1] / d; s[k] = i; test = true; } }
        label = 23079; break;
      }
      case 23079: {
        if (k <= 0) test = false;
        else { let min = big, jj = 0; for (let i = 1; i <= k; i++) if (wb[i] < min) { jj = i; min = wb[i]; out = s[i]; } wb[jj] = wb[k]; s[jj] = s[k]; k--; }
        if (!test && stage) { label = 23081; break; }
        if (!test) { label = 23047; break; }
        pivot = wa[out][inn];
        if (wa[m1][inn] - pivot - pivot <= toler) { label = 10; break; }
        for (let j = kr; j <= n3; j++) { const d = wa[out][j]; wa[m1][j] -= d + d; wa[m2][j] -= d + d; wa[out][j] = -d; }
        wa[out][n4] = -wa[out][n4];
        label = 23079; break;
      }
      case 23081: { for (let i = 1; i <= m4; i++) { const d = wa[i][kr]; wa[i][kr] = wa[i][inn]; wa[i][inn] = d; } kr++; label = 20; break; }
      case 10: {
        for (let j = kr; j <= n3; j++) if (j !== inn) wa[out][j] /= pivot;
        for (let i = 1; i <= m3; i++) if (i !== out) { const d = wa[i][inn]; for (let j = kr; j <= n3; j++) if (j !== inn) wa[i][j] -= d * wa[out][j]; }
        for (let i = 1; i <= m3; i++) if (i !== out) wa[i][inn] = -wa[i][inn] / pivot;
        wa[out][inn] = 1 / pivot;
        { const d = wa[out][n4]; wa[out][n4] = wa[m4][inn]; wa[m4][inn] = d; }
        kount++;
        if (!stage) { label = 23055; break; }
        kl++;
        for (let j = kr; j <= n4; j++) { const d = wa[out][j]; wa[out][j] = wa[kount][j]; wa[kount][j] = d; }
        label = 20; break;
      }
      case 20: if (kount + kr === n1) { label = 23052; break; } label = 30; break;
      case 30: {
        let max = -1;
        for (let j = kr; j <= n; j++) if (Math.abs(wa[m4][j]) <= n) { const d = Math.abs(wa[m1][j]); if (d > max) { max = d; inn = j; } }
        if (wa[m1][inn] < 0) flipCol(inn);
        label = 23072; break;
      }
      case 23054: {
        if (kr === 1) for (let j = 1; j <= n; j++) { const d = Math.abs(wa[m1][j]); if (d <= toler || 2 - d <= toler) { ift = 1; break; } }
        for (let i = 1; i <= kl - 1; i++) { const kk = Math.abs(wa[i][n4]); x[kk] = wa[i][n1] * sgn(wa[i][n4]); }
        return { coef: Array.from(x.slice(1)), flag: ift };
      }
      case 23047: return { coef: Array.from(x.slice(1)), flag: 2 };
      default: throw new Error('rqbr: bad label ' + label);
    }
  }
}
const Rho = (u, tau) => u * (tau - (u < 0 ? 1 : 0));
export function rqFit(X, y, tau, warnings = []) {
  const Q = L.qrR(X); if (Q.rank < X[0].length) throw new Error('Singular design matrix');
  const r = rqbr(X, y, tau); if (r.flag) warnings.push(r.flag === 1 ? 'Solution may be nonunique' : 'Premature end - possible conditioning problem in x');
  const fitted = X.map(row => L.dot(row, r.coef)), resid = y.map((v, i) => v - fitted[i]);
  return { coef: r.coef, fitted, resid, rho: resid.reduce((s, u) => s + Rho(u, tau), 0), tau };
}
export function bandwidthRq(p, n, hs = true, alpha = 0.05) {
  const x0 = D.qnorm(p), f0 = D.dnorm(x0);
  return hs ? Math.pow(n, -1 / 3) * Math.pow(D.qnorm(1 - alpha / 2), 2 / 3) * Math.pow((1.5 * f0 * f0) / (2 * x0 * x0 + 1), 1 / 3) : Math.pow(n, -0.2) * Math.pow((4.5 * f0 ** 4) / (2 * x0 * x0 + 1) ** 2, 0.2);
}
// summary.rq(fit, se = 'nid'): coefficient table columns Value, Std. Error, t value, Pr(>|t|)
export function summaryRqNid(X, y, fit, warnings = []) {
  const n = y.length, p = X[0].length, tau = fit.tau, eps = Math.sqrt(2.220446049250313e-16), rdf = n - p;
  let h = bandwidthRq(tau, n); while (tau - h < 0 || tau + h > 1) h /= 2;
  const bhi = rqFit(X, y, tau + h, warnings).coef, blo = rqFit(X, y, tau - h, warnings).coef;
  const dyhat = X.map(r => r.reduce((s, v, j) => s + v * (bhi[j] - blo[j]), 0)), nonpos = dyhat.filter(v => v <= 0).length;
  if (nonpos) warnings.push(nonpos + ' non-positive fis');
  const f = dyhat.map(v => Math.max(0, (2 * h) / (v - eps)));
  const Q = L.qrR(X.map((r, i) => r.map(v => v * Math.sqrt(f[i])))), R = L.zeros(p, p);
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) R[i][j] = Q.cols[j][i];
  const Ri = L.t(L.ident(p).map(e => L.backsolve(R, e))), fxx = L.mul(Ri, L.t(Ri)), xx = L.crossprod(X);
  const cov = L.mul(L.mul(fxx, xx), fxx).map(r => r.map(v => v * tau * (1 - tau)));
  return fit.coef.map((b, j) => { const se = Math.sqrt(cov[j][j]), tv = b / se; return [b, se, tv, rdf > 0 ? 2 * (1 - D.pt(Math.abs(tv), rdf)) : NaN]; });
}
