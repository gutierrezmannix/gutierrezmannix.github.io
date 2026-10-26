// Many-to-one (Dunnett) multivariate t probabilities by deterministic quadrature.
// P(max_i |T_i| <= c) for T_i = Z_i / S, corr(Z_i, Z_j) = lam_i lam_j (the one-way Dunnett structure), S = sqrt(chi2_nu / nu):
//   ∫ f_S(s) ∫ φ(w) Π_i [Φ((cs - lam_i w)/tau_i) - Φ((-cs - lam_i w)/tau_i)] dw ds,   tau_i = sqrt(1 - lam_i²).
// Replaces mvtnorm's randomized Genz–Bretz QMC (pmvt/qmvt) used by multcomp; accurate to ~1e-10 in probability.
import * as D from './dist.mjs';

const GL = new Map();
function gaussLegendre(n) {
  if (GL.has(n)) return GL.get(n);
  const x = [], w = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), pp = 0;
    for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = n * (z * p1 - p2) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break; }
    x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
  }
  const r = { x, w }; GL.set(n, r); return r;
}
function composite(a, b, panels, order = 10) {
  const g = gaussLegendre(order), h = (b - a) / panels, xs = [], ws = [];
  for (let p = 0; p < panels; p++) { const lo = a + p * h; for (let k = 0; k < order; k++) { xs.push(lo + h * (g.x[k] + 1) / 2); ws.push(g.w[k] * h / 2); } }
  return { xs, ws };
}
// first x (searching outward from 0) where f(x) < -46
function edge(f, dir) { let a = 0, b = dir; while (f(b) > -46) b *= 2; for (let i = 0; i < 60; i++) { const mid = (a + b) / 2; if (f(mid) > -46) a = mid; else b = mid; } return b; }

export function dunnettSetup(lam, nu, { outerW = nu < 5 ? 1 : 2, outerN = 8, innerW = 1.5, innerN = 8 } = {}) {
  const m = lam.length, tau = lam.map(l => Math.sqrt(1 - l * l));
  // outer rule over x = log s
  const ld = x => nu * (x - Math.exp(2 * x) / 2 + 0.5), lo = edge(x => ld(x) + m * x, -1), hi = edge(ld, 1), sig = 1 / Math.sqrt(2 * nu);
  const o = composite(lo, hi, Math.max(4, Math.ceil((hi - lo) / (sig * outerW))), outerN);
  const logC = Math.LN2 + (nu / 2) * Math.log(nu / 2) - D.lgamma(nu / 2);
  const s = o.xs.map(Math.exp), sw = o.xs.map((x, k) => o.ws[k] * Math.exp(logC + nu * x - nu * Math.exp(2 * x) / 2));
  // inner rule over w ≥ 0 (the integrand is even in w)
  const minScale = Math.min(...tau.map((t, i) => t / Math.max(lam[i], 1e-12)));
  const iw = composite(0, 8.6, Math.max(3, Math.ceil(8.6 / (innerW * Math.min(1, 1.5 * minScale)))), innerN);
  const phiw = iw.xs.map((w, k) => 2 * iw.ws[k] * D.dnorm(w));
  return { m, lam, tau, s, sw, iw: iw.xs, phiw, nu };
}
function inner(S, x) {
  const { m, lam, tau, iw, phiw } = S; let tot = 0;
  for (let k = 0; k < iw.length; k++) { const w = iw[k]; let pr = phiw[k]; for (let i = 0; i < m && pr > 1e-300; i++) pr *= D.pnorm((x - lam[i] * w) / tau[i]) - D.pnorm((-x - lam[i] * w) / tau[i]); tot += pr; }
  return tot;
}
export function pDunnett(S, c) { if (!(c > 0)) return 0; let tot = 0; for (let k = 0; k < S.s.length; k++) tot += S.sw[k] * inner(S, c * S.s[k]); return Math.min(1, tot); }
export function qDunnett(S, level) {
  const m = S.m, a = D.qt(1 - (1 - level) / 2, S.nu), b = D.qt(1 - (1 - level) / (2 * m), S.nu) * 1.001 + 1e-6;
  return D.uniroot(c => pDunnett(S, c) - level, a * 0.999, b, { tol: 1e-11 }).root;
}
