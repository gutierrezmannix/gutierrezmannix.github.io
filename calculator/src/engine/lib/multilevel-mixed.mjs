// Linear and generalized linear mixed models with one grouping factor, as lme4::lmer / glmer / glmer.nb fit them:
// relative covariance factor Λθ (lower-triangular T per group), profiled (RE)ML deviance for LMMs, Laplace
// deviance with penalized IRLS conditional modes for GLMMs, lme4's deriv12 finite-difference derivatives,
// checkConv convergence checks and the Hessian-based fixed-effect covariance glmer reports.
import * as L from './linalg.mjs';
import * as D from './dist.mjs';

const EPS = 2.220446049250313e-16;
export const thetaT = (th, q) => { const T = L.zeros(q, q); let k = 0; for (let j = 0; j < q; j++) for (let i = j; i < q; i++) T[i][j] = th[k++]; return T; };
export const thetaLower = q => { const lo = []; for (let j = 0; j < q; j++) for (let i = j; i < q; i++) lo.push(i === j ? 0 : -Infinity); return lo; };
export const thetaStart = q => thetaLower(q).map(v => v === 0 ? 1 : 0);
// lower Cholesky of a small SPD matrix, null when not PD
function cholL(A) { try { return L.chol(A); } catch (e) { return null; } }
const fwd = (Lm, b) => { const n = Lm.length, y = new Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= Lm[i][k] * y[k]; y[i] = s / Lm[i][i]; } return y; };
const bwd = (Lm, b) => { const n = Lm.length, x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= Lm[k][i] * x[k]; x[i] = s / Lm[i][i]; } return x; };

// S = { X (n×p rows), y, Zr (n×q rows), gid (0-based group per row), G }
export function mixedSetup(X, y, Zr, gid, G) {
  const n = X.length, p = X[0].length, q = Zr[0].length, groups = Array.from({ length: G }, () => []);
  gid.forEach((g, i) => groups[g].push(i));
  const grp = groups.map(idx => {
    const A = L.zeros(q, q), B = L.zeros(q, p), c = new Array(q).fill(0);
    for (const i of idx) { const z = Zr[i], x = X[i]; for (let a = 0; a < q; a++) { for (let b = 0; b < q; b++) A[a][b] += z[a] * z[b]; for (let b = 0; b < p; b++) B[a][b] += z[a] * x[b]; c[a] += z[a] * y[i]; } }
    return { idx, A, B, c };
  });
  const XtX = L.crossprod(X), Xty = L.tmulVec(X, y);
  return { n, p, q, X, y, Zr, gid, G, groups, grp, XtX, Xty, ntheta: q * (q + 1) / 2 };
}

// ---------- LMM: profiled deviance and its pieces ----------
export function lmmFit(S, th, reml) {
  const { q, p, n } = S, T = thetaT(th, q), Tt = L.t(T);
  let ldL2 = 0; const XtXs = S.XtX.map(r => r.slice()), rhs = S.Xty.slice(), per = [];
  for (const gr of S.grp) {
    const M = L.mul(L.mul(Tt, gr.A), T); for (let a = 0; a < q; a++) M[a][a] += 1;
    const Lj = cholL(M); if (!Lj) return null;
    for (let a = 0; a < q; a++) ldL2 += 2 * Math.log(Lj[a][a]);
    const TB = L.mul(Tt, gr.B), RZX = L.zeros(q, p), cu = fwd(Lj, L.mulVec(Tt, gr.c));
    for (let b = 0; b < p; b++) { const col = fwd(Lj, TB.map(r => r[b])); for (let a = 0; a < q; a++) RZX[a][b] = col[a]; }
    for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) { let s = 0; for (let k = 0; k < q; k++) s += RZX[k][a] * RZX[k][b]; XtXs[a][b] -= s; } let s = 0; for (let k = 0; k < q; k++) s += RZX[k][a] * cu[k]; rhs[a] -= s; }
    per.push({ Lj, RZX, cu });
  }
  const RX = cholL(XtXs); if (!RX) return null;
  const beta = bwd(RX, fwd(RX, rhs)); let ldRX2 = 0; for (let a = 0; a < p; a++) ldRX2 += 2 * Math.log(RX[a][a]);
  let pwrss = 0; const b = [], fitted = new Array(n);
  per.forEach((pj, j) => {
    const r = pj.cu.map((v, a) => v - L.dot(pj.RZX[a], beta)), u = bwd(pj.Lj, r), bj = L.mulVec(T, u);
    pwrss += L.dot(u, u); b.push(bj);
    for (const i of S.grp[j].idx) { const f = L.dot(S.X[i], beta) + L.dot(S.Zr[i], bj); fitted[i] = f; pwrss += (S.y[i] - f) ** 2; }
  });
  const nmp = reml ? n - p : n;
  const dev = ldL2 + (reml ? ldRX2 : 0) + nmp * (1 + Math.log(2 * Math.PI * pwrss / nmp));
  return { dev, beta, b, fitted, pwrss, ldL2, ldRX2, RX, sigma2: pwrss / nmp };
}
export const lmmDeviance = (S, reml) => th => { const r = lmmFit(S, th, reml); return r ? r.dev : Infinity; };

// ---------- GLMM: lme4's PIRLS (pwrssUpdate) and Laplace deviance ----------
// fam: { linkfun, linkinv, muEta, variance, devResid(y, mu), aic(y, mu) (per observation), mustart(y) } as lme4's C++ glmFamily
export function glmmFamily(name, theta = null) {
  const bexp = e => Math.max(Math.exp(e), EPS), ylogy = (y, m) => { const v = y / m; return y * (v ? Math.log(v) : v); };
  if (name === 'binomial') return {
    name, linkfun: m => Math.log(m / (1 - m)), linkinv: e => Math.max(EPS, Math.min(1 - EPS, D.plogis(e))), muEta: e => { const o = Math.exp(-Math.abs(e)); return Math.max(EPS, o / ((1 + o) * (1 + o))); }, variance: m => Math.max(EPS, m * (1 - m)),
    devResid: (y, m) => 2 * (ylogy(y, m) + ylogy(1 - y, 1 - m)), aic: (y, m) => -2 * D.dbinom(Math.round(y), 1, m, true), mustart: y => (y + 0.5) / 2,
  };
  if (name === 'poisson') return { name, logLink: true, linkfun: Math.log, linkinv: bexp, muEta: bexp, variance: m => m, devResid: (y, m) => 2 * (ylogy(y, m) - (y - m)), aic: (y, m) => -2 * D.dpois(y, m, true), mustart: y => y + 0.1 };
  const cache = new Map(), cst = y => { let c = cache.get(y); if (c === undefined) { c = D.lgamma(y + 1) - theta * Math.log(theta) + D.lgamma(theta) - D.lgamma(theta + y); cache.set(y, c); } return c; };
  return { name: 'negbin', theta, logLink: true, linkfun: Math.log, linkinv: bexp, muEta: bexp, variance: m => m + m * m / theta,
    devResid: (y, m) => 2 * (ylogy(y, m) - (y + theta) * Math.log((y + theta) / (m + theta))),
    aic: (y, m) => 2 * ((y + theta) * Math.log(m + theta) - (y > 0 ? y * Math.log(m) : 0) + cst(y)), mustart: y => y + (y === 0 ? 1 / 6 : 0) };
}
// One pwrssUpdate from linear predictor eta0 (resp$updateMu(lp0)), with offset (X beta in the second stage) and
// u0 = beta0 = 0 as in glmer; uOnly = Laplace stage (nAGQ = 1), joint (u, beta) = nAGQ = 0 stage. Returns the Laplace value.
export function pirls(S, fam, th, offset, eta0, uOnly, { tol = 1e-7, maxit = 100 } = {}) {
  const { n, p, q, G, X, y, Zr, grp } = S, T = thetaT(th, q), A = new Float64Array(n * q);
  for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) { let s = 0; for (let k = a; k < q; k++) s += T[k][a] * Zr[i][k]; A[i * q + a] = s; } // Λ'z
  const offA = offset || new Float64Array(n), off = i => offA[i], gid = S.gid;
  const eta = Float64Array.from(eta0), mu = new Float64Array(n); for (let i = 0; i < n; i++) mu[i] = fam.linkinv(eta[i]);
  let delu = new Float64Array(G * q), delb = new Float64Array(p), ldL2 = 0, oldpdev = Number.MAX_VALUE, pdev = oldpdev, cvgd = false, Mflat = null, RXm = null;
  const lin = () => { let s = 0; for (let i = 0; i < n; i++) { let e = off(i), g = gid[i] * q; if (!uOnly) for (let b = 0; b < p; b++) e += X[i][b] * delb[b]; for (let a = 0; a < q; a++) e += A[i * q + a] * delu[g + a]; eta[i] = e; mu[i] = fam.linkinv(e); s += fam.devResid(y[i], mu[i]); } for (let k = 0; k < G * q; k++) s += delu[k] * delu[k]; return s; };
  const w = new Float64Array(n), z = new Float64Array(n), Lf = new Float64Array(G * q * q), cu = new Float64Array(G * q), RZX = uOnly ? null : new Float64Array(G * q * p);
  // in-place lower Cholesky of the q×q block at offset o; returns false when not PD
  const chol = (M, o) => { for (let i = 0; i < q; i++) for (let j = 0; j <= i; j++) { let s = M[o + i * q + j]; for (let k = 0; k < j; k++) s -= M[o + i * q + k] * M[o + j * q + k]; if (i === j) { if (!(s > 0)) return false; M[o + i * q + i] = Math.sqrt(s); } else M[o + i * q + j] = s / M[o + j * q + j]; } for (let i = 0; i < q; i++) for (let j = i + 1; j < q; j++) M[o + i * q + j] = 0; return true; };
  const fw = (o, v, vo) => { for (let i = 0; i < q; i++) { let s = v[vo + i]; for (let k = 0; k < i; k++) s -= Lf[o + i * q + k] * v[vo + k]; v[vo + i] = s / Lf[o + i * q + i]; } };
  const bw = (o, v, vo) => { for (let i = q - 1; i >= 0; i--) { let s = v[vo + i]; for (let k = i + 1; k < q; k++) s -= Lf[o + k * q + i] * v[vo + k]; v[vo + i] = s / Lf[o + i * q + i]; } };
  for (let it = 0; it < maxit; it++) {
    const olddelu = delu.slice(), olddelb = delb.slice();
    for (let i = 0; i < n; i++) { const me = fam.logLink ? mu[i] : fam.muEta(eta[i]); w[i] = me * me / fam.variance(mu[i]); z[i] = eta[i] - off(i) + (y[i] - mu[i]) / me; }
    Lf.fill(0); cu.fill(0); if (RZX) RZX.fill(0);
    const XtWX = uOnly ? null : L.zeros(p, p), Vtr = uOnly ? null : new Array(p).fill(0);
    for (let j = 0; j < G; j++) { const o = j * q * q; for (let a = 0; a < q; a++) Lf[o + a * q + a] = 1; }
    for (let i = 0; i < n; i++) {
      const g = gid[i], o = g * q * q, wi = w[i], ai = i * q;
      for (let r = 0; r < q; r++) { const war = wi * A[ai + r]; cu[g * q + r] += war * z[i]; for (let c = 0; c <= r; c++) Lf[o + r * q + c] += war * A[ai + c]; if (RZX) { const ro = (g * q + r) * p; for (let c = 0; c < p; c++) RZX[ro + c] += war * X[i][c]; } }
      if (!uOnly) { const x = X[i]; for (let r = 0; r < p; r++) { const wx = wi * x[r]; Vtr[r] += wx * z[i]; for (let c = 0; c <= r; c++) XtWX[r][c] += wx * x[c]; } }
    }
    ldL2 = 0; Mflat = Lf.slice();
    for (let j = 0; j < G; j++) { const o = j * q * q; for (let r = 0; r < q; r++) for (let c = r + 1; c < q; c++) Mflat[o + r * q + c] = Mflat[o + c * q + r]; if (!chol(Lf, o)) throw new Error('Cholmod error: not positive definite'); for (let a = 0; a < q; a++) ldL2 += 2 * Math.log(Lf[o + a * q + a]); fw(o, cu, j * q); if (RZX) { const col = new Float64Array(q); for (let c = 0; c < p; c++) { for (let r = 0; r < q; r++) col[r] = RZX[(j * q + r) * p + c]; fw(o, col, 0); for (let r = 0; r < q; r++) RZX[(j * q + r) * p + c] = col[r]; } } }
    if (uOnly) { delu = cu.slice(); for (let j = 0; j < G; j++) bw(j * q * q, delu, j * q); delb = new Float64Array(p); }
    else {
      for (let r = 0; r < p; r++) for (let c = 0; c < r; c++) XtWX[c][r] = XtWX[r][c];
      const rhs = Vtr.slice();
      for (let k = 0; k < G * q; k++) { const ro = k * p; for (let a = 0; a < p; a++) { const ra = RZX[ro + a]; if (!ra) continue; rhs[a] -= ra * cu[k]; for (let b = 0; b < p; b++) XtWX[a][b] -= ra * RZX[ro + b]; } }
      RXm = cholL(XtWX); if (!RXm) throw new Error('Downdated VtV is not positive definite');
      delb = Float64Array.from(bwd(RXm, fwd(RXm, rhs))); delu = cu.slice();
      for (let k = 0; k < G * q; k++) { let s = 0; for (let b = 0; b < p; b++) s += RZX[k * p + b] * delb[b]; delu[k] -= s; }
      for (let j = 0; j < G; j++) bw(j * q * q, delu, j * q);
    }
    pdev = lin();
    if (Math.abs((oldpdev - pdev) / pdev) < tol) { cvgd = true; break; }
    if (Number.isNaN(pdev) || pdev > oldpdev) {
      for (let k = 0; k < 20 && (Number.isNaN(pdev) || pdev > oldpdev); k++) { for (let a = 0; a < G * q; a++) delu[a] = (olddelu[a] + delu[a]) / 2; if (!uOnly) for (let a = 0; a < p; a++) delb[a] = (olddelb[a] + delb[a]) / 2; pdev = lin(); }
      if (Number.isNaN(pdev)) throw new Error('PIRLS loop resulted in NaN value');
      if (pdev - oldpdev > tol) throw new Error('(maxstephalfit) PIRLS step-halvings failed to reduce deviance in pwrssUpdate');
    }
    oldpdev = pdev;
  }
  if (!cvgd) throw new Error('pwrssUpdate did not converge in (maxit) iterations');
  let aic = 0; for (let i = 0; i < n; i++) aic += fam.aic(y[i], mu[i]);
  let sqrL = 0; for (let k = 0; k < G * q; k++) sqrL += delu[k] * delu[k];
  const u = () => Array.from({ length: G }, (_, j) => Array.from(delu.subarray(j * q, j * q + q)));
  return { dev: ldL2 + sqrL + aic, get eta() { return Array.from(eta); }, get mu() { return Array.from(mu); }, get u() { return u(); }, get b() { return u().map(v => L.mulVec(T, v)); }, beta: Array.from(delb), RX: RXm,
    get Ms() { return Array.from({ length: G }, (_, j) => Array.from({ length: q }, (_, r) => Array.from(Mflat.subarray(j * q * q + r * q, j * q * q + r * q + q)))); } };
}
// glmer: coarse joint PIRLS at the starting theta from mustart, stage 1 (nAGQ = 0) over theta, then the Laplace
// deviance over (theta, beta) starting each PIRLS at the stage-1 linear predictor lp0.
export function glmerSetup(S, fam) {
  const eta0 = S.y.map(v => fam.linkfun(fam.mustart(v)));
  const init = pirls(S, fam, thetaStart(S.q), null, eta0, false), lp0init = init.eta.slice();
  const dev0 = th => pirls(S, fam, th, null, lp0init, false).dev;
  return { dev0, lp0init };
}
export function glmerStage2(S, fam, lp0) {
  const nt = S.ntheta, off = new Array(S.n);
  const evalAt = par => { const beta = par.slice(nt); for (let i = 0; i < S.n; i++) off[i] = L.dot(S.X[i], beta); return pirls(S, fam, par.slice(0, nt), off.slice(), lp0, true); };
  return { f: par => evalAt(par).dev, evalAt };
}
// RX-based unscaled covariance at the mode (fallback when the Hessian is unusable)
export function glmmUnsc(S, fam, par, fit) {
  const { q, p, ntheta } = S, T = thetaT(par.slice(0, ntheta), q), Tt = L.t(T), XtWX = L.zeros(p, p);
  S.grp.forEach((gr, j) => {
    const C = L.zeros(q, p);
    for (const i of gr.idx) { const e = fit.eta[i], mk = fit.mu[i], me = fam.muEta(e), w = me * me / fam.variance(mk), a = L.mulVec(Tt, S.Zr[i]), x = S.X[i]; for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) XtWX[r][c] += w * x[r] * x[c]; for (let r = 0; r < q; r++) for (let c = 0; c < p; c++) C[r][c] += w * a[r] * x[c]; }
    const Mi = L.inv(fit.Ms[j]), K = L.mul(L.mul(L.t(C), Mi), C); for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) XtWX[r][c] -= K[r][c];
  });
  return L.inv(XtWX);
}

// ---------- derivatives (lme4::deriv12, central differences, no bounds) ----------
export function deriv12(f, x, fx, delta = 1e-4) {
  const nx = x.length, H = L.zeros(nx, nx), g = new Array(nx), at = mods => { const z = x.slice(); for (const [i, d] of mods) z[i] += d; return f(z); };
  for (let j = 0; j < nx; j++) {
    const fadd = at([[j, delta]]), fsub = at([[j, -delta]]);
    H[j][j] = fadd / delta ** 2 - 2 * fx / (delta * delta) + fsub / delta ** 2; g[j] = (fadd - fsub) / (2 * delta);
    for (let i = 0; i < j; i++) H[i][j] = H[j][i] = at([[i, delta], [j, delta]]) / (2 * delta) ** 2 - at([[i, delta], [j, -delta]]) / (2 * delta) ** 2 - at([[i, -delta], [j, delta]]) / (2 * delta) ** 2 + at([[i, -delta], [j, -delta]]) / (2 * delta) ** 2;
  }
  return { gradient: g, Hessian: H };
}
// lme4::checkConv → messages (singular message included)
export function checkConv(derivs, coefs, lower, ntheta) {
  const msgs = [], bcoefs = lower.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
  if (bcoefs.some(i => coefs[i] < 1e-4)) return ["boundary (singular) fit: see help('isSingular')"];
  const { gradient: g, Hessian: H } = derivs;
  if (g.some(v => !Number.isFinite(v))) return ['Gradient contains NAs'];
  let sc = null; try { const R = L.t(L.chol(H)); sc = L.backsolve(R, g); } catch (e) { sc = null; }
  if (!sc || sc.some(v => !Number.isFinite(v))) msgs.push('unable to evaluate scaled gradient');
  else { const mm = Math.max(...sc.map((v, i) => Math.min(Math.abs(v), Math.abs(g[i])))); if (mm > 0.002) msgs.push('Model failed to converge with max|grad| = ' + mm.toPrecision(6) + ' (tol = 0.002, component 1)'); }
  const hess = (Hm, type) => {
    const ev = L.eigenSym(Hm).values, out = [];
    if (ev.some(v => !Number.isFinite(v))) return ['Problem with Hessian check (infinite or missing values?)'];
    const neg = ev.filter(v => v < -1e-6).length;
    if (neg) return ['Model failed to converge: degenerate ' + type + ' Hessian with ' + neg + ' negative eigenvalues'];
    if (ev.some(v => Math.abs(v) < 1e-6) || !cholL(Hm)) return [type + ' Hessian is numerically singular: parameters are not uniquely determined'];
    const mx = Math.max(...ev), mn = Math.min(...ev);
    if (mx * 1e-6 > 1) out.push('Model is nearly unidentifiable: very large eigenvalue\n - Rescale variables?');
    if (mn / mx < 1e-6) out.push('Model is nearly unidentifiable: large eigenvalue ratio\n - Rescale variables?');
    return out;
  };
  if (coefs.length > ntheta) { const idx = coefs.map((_, i) => i).slice(ntheta); msgs.push(...hess(L.sub(H, idx, idx), 'fixed-effect')); }
  msgs.push(...hess(H, ''));
  return msgs;
}

// ---------- bounded minimizer: projected BFGS with central-difference gradients, then Newton polishing ----------
export function minimize(f, x0, lower, { maxit = 400, maxStep = 0.25 } = {}) {
  const d = x0.length, proj = x => x.map((v, i) => Math.max(v, lower[i]));
  let x = proj(x0), fx = f(x);
  const hOf = v => 1e-6 * Math.max(1, Math.abs(v));
  const grad = (z, fz) => z.map((v, i) => { const h = hOf(v), a = z.slice(), b = z.slice(); a[i] += h; b[i] -= h; const fa = f(a), fb = f(b); return Number.isFinite(fa) && Number.isFinite(fb) ? (fa - fb) / (2 * h) : Number.isFinite(fa) ? (fa - fz) / h : (fz - fb) / h; });
  const diagInit = z => z.map((v, i) => { const h = 1e-3 * Math.max(1, Math.abs(v)), a = z.slice(), b = z.slice(); a[i] += h; b[i] -= h; const c = (f(a) - 2 * f(z) + f(b)) / (h * h); return Number.isFinite(c) && c > 1e-8 ? 1 / c : 1; });
  const initB = z => { const di = diagInit(z), B = L.zeros(d, d); di.forEach((v, i) => { B[i][i] = v; }); return B; };
  let g = grad(x, fx), B = initB(x), stall = 0;
  for (let it = 0; it < maxit; it++) {
    const free = x.map((v, i) => !(v <= lower[i] && g[i] > 0));
    let dir = x.map((_, i) => free[i] ? -B[i].reduce((s, b, j) => s + (free[j] ? b * g[j] : 0), 0) : 0);
    if (L.dot(dir, g) >= 0) { B = initB(x); dir = x.map((_, i) => free[i] ? -B[i][i] * g[i] : 0); }
    if (dir.every(v => v === 0)) break;
    { const mx = Math.max(...dir.map(Math.abs)); if (mx > maxStep) dir = dir.map(v => v * maxStep / mx); } // small steps: follow the valley like a trust region
    let t = 1, xn = null, fn = Infinity, ok = false;
    for (let ls = 0; ls < 60; ls++) { xn = proj(x.map((v, i) => v + t * dir[i])); fn = f(xn); if (Number.isFinite(fn) && fn <= fx + 1e-4 * L.dot(g, xn.map((v, i) => v - x[i]))) { ok = true; break; } t /= 2; }
    if (!ok) { if (fn < fx) { ok = true; } else break; }
    const s = xn.map((v, i) => v - x[i]), gn = grad(xn, fn), yv = gn.map((v, i) => v - g[i]), sy = L.dot(s, yv);
    if (sy > 1e-18) { const By = L.mulVec(B, yv), yBy = L.dot(yv, By); for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) B[i][j] += ((sy + yBy) * s[i] * s[j]) / (sy * sy) - (By[i] * s[j] + s[i] * By[j]) / sy; }
    const df = fx - fn; x = xn; fx = fn; g = gn;
    const smallStep = s.every((v, i) => Math.abs(v) <= 1e-10 * Math.max(1, Math.abs(x[i])));
    if (df <= 1e-14 * Math.max(1, Math.abs(fx)) || smallStep) { if (++stall >= 3) break; } else stall = 0;
  }
  // Newton polishing on the free coordinates
  for (let k = 0; k < 4; k++) {
    const H = deriv12(f, x, fx, 1e-4).Hessian, gg = grad(x, fx), free = x.map((v, i) => !(v <= lower[i] && gg[i] > 0)), fi = free.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (!fi.length) break;
    let step; try { step = L.solve(L.sub(H, fi, fi), fi.map(i => -gg[i])); } catch (e) { break; }
    let t = 1, improved = false;
    for (let ls = 0; ls < 30; ls++) { const xn = x.slice(); fi.forEach((i, a) => { xn[i] += t * step[a]; }); const xp = proj(xn), fn = f(xp); if (fn < fx) { x = xp; fx = fn; improved = true; break; } t /= 2; }
    if (!improved) break;
  }
  return { par: x, value: fx };
}

// ---------- R's optimize() (Brent_fmin) ----------
export function brentFmin(f, ax, bx, tol) {
  const c = (3 - Math.sqrt(5)) * 0.5, eps = Math.sqrt(EPS);
  let a = ax, b = bx, v = a + c * (b - a), w = v, x = v, d = 0, e = 0, fx = f(x), fv = fx, fw = fx, tol1, t2, xm, p, q, r, u, fu, last = x;
  const tol3 = tol / 3;
  for (;;) {
    xm = (a + b) * 0.5; tol1 = eps * Math.abs(x) + tol3; t2 = tol1 * 2;
    if (Math.abs(x - xm) <= t2 - (b - a) * 0.5) break;
    p = 0; q = 0; r = 0;
    if (Math.abs(e) > tol1) { r = (x - w) * (fx - fv); q = (x - v) * (fx - fw); p = (x - v) * q - (x - w) * r; q = (q - r) * 2; if (q > 0) p = -p; else q = -q; r = e; e = d; }
    if (Math.abs(p) >= Math.abs(q * 0.5 * r) || p <= q * (a - x) || p >= q * (b - x)) { e = x < xm ? b - x : a - x; d = c * e; }
    else { d = p / q; u = x + d; if (u - a < t2 || b - u < t2) { d = tol1; if (x >= xm) d = -d; } }
    u = Math.abs(d) >= tol1 ? x + d : d > 0 ? x + tol1 : x - tol1;
    fu = f(u); last = u;
    if (fu <= fx) { if (u < x) b = x; else a = x; v = w; w = x; x = u; fv = fw; fw = fx; fx = fu; }
    else { if (u < x) a = u; else b = u; if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; } else if (fu <= fv || v === x || v === w) { v = u; fv = fu; } }
  }
  return { minimum: x, objective: fx, last };
}

// MASS::theta.ml
export function thetaML(y, mu, { limit = 10, eps = Math.pow(EPS, 0.25) } = {}) {
  const n = y.length, warnings = [];
  let t0 = n / y.reduce((s, v, i) => s + (v / mu[i] - 1) ** 2, 0), it = 0, del = 1, info = NaN;
  while (++it < limit && Math.abs(del) > eps) {
    t0 = Math.abs(t0); let sc = 0, inf = 0;
    for (let i = 0; i < n; i++) { const th = t0, yi = y[i], m = mu[i]; sc += D.digamma(th + yi) - D.digamma(th) + Math.log(th) + 1 - Math.log(th + m) - (yi + th) / (m + th); inf += -D.trigamma(th + yi) + D.trigamma(th) - 1 / th + 2 / (m + th) - (yi + th) / (m + th) ** 2; }
    info = inf; del = sc / inf; t0 += del;
  }
  if (t0 < 0) { t0 = 0; warnings.push('estimate truncated at zero'); }
  if (it === limit) warnings.push('iteration limit reached');
  return { theta: t0, warnings, info };
}

// ---------- lme4's Nelder_Mead (C++ class NelderMead, an nlopt descendant): same simplex, moves and stopping ----------
export function nelderMead(f, x0, lower, xst, xt, { maxfun = 10000 } = {}) {
  const n = x0.length, close = (a, b) => Math.abs(a - b) <= 1e-13 * (Math.abs(a) + Math.abs(b));
  const pts = Array.from({ length: n + 1 }, () => x0.slice());
  for (let i = 0; i < n; i++) {
    const j = i + 1; pts[j][i] += xst[i];
    if (pts[j][i] < lower[i]) { if (x0[i] - lower[i] > Math.abs(xst[i]) * 0.1) pts[j][i] = lower[i]; else pts[j][i] = x0[i] + Math.abs(xst[i]); }
    if (close(pts[j][i], x0[i])) throw new Error('cannot generate feasible simplex');
  }
  let minf = Infinity, xbest = x0.slice(), nevals = 0, status = 'active';
  const evalf = x => { const v = f(x); nevals++; if (v < minf) { minf = v; xbest = x.slice(); } if (nevals > maxfun) status = 'evals'; return v; };
  const reflect = (c, scale, xold) => { const xn = c.map((v, i) => Math.max(v + scale * (v - xold[i]), lower[i])); const eqc = xn.every((v, i) => close(v, c[i])), eqo = xn.every((v, i) => close(v, xold[i])); return eqc || eqo ? null : xn; };
  const vals = new Array(n + 1);
  const init = () => { for (let k = 0; k <= n; k++) { vals[k] = evalf(pts[k]); if (status !== 'active') return false; } return true; };
  if (!init()) return { par: xbest, value: minf, feval: nevals, status };
  for (;;) {
    let il = 0, ih = 0; for (let k = 1; k <= n; k++) { if (vals[k] < vals[il]) il = k; if (vals[k] > vals[ih]) ih = k; }
    const fl = vals[il], fh = vals[ih], c = new Array(n).fill(0);
    for (let k = 0; k <= n; k++) for (let i = 0; i < n; i++) c[i] += pts[k][i];
    for (let i = 0; i < n; i++) c[i] = (c[i] - pts[ih][i]) / n;
    let xconv = true; for (let i = 0; i < n && xconv; i++) { let md = 0; for (let k = 0; k <= n; k++) md = Math.max(md, Math.abs(pts[k][i] - c[i])); if (!(md < xt[i] || md === 0)) xconv = false; }
    if (xconv) { status = 'xcvg'; break; }
    const xr = reflect(c, 1, pts[ih]); if (!xr) { status = 'xcvg'; break; }
    const fr = evalf(xr); if (status !== 'active') break;
    if (fr < fl) {
      const xe = reflect(c, 2, pts[ih]); if (!xe) { status = 'xcvg'; break; }
      const fe = evalf(xe); if (status !== 'active') break;
      if (fe < vals[ih]) { pts[ih] = xe; vals[ih] = fe; } else { pts[ih] = xr; vals[ih] = fr; }
      continue;
    }
    if (fr < fh) { pts[ih] = xr; vals[ih] = fr; continue; }
    const xc = reflect(c, fh <= fr ? -0.5 : 0.5, pts[ih]); if (!xc) { status = 'xcvg'; break; }
    const fc = evalf(xc); if (status !== 'active') break;
    if (fc < fr && fc < fh) { pts[ih] = xc; vals[ih] = fc; continue; }
    let ok = true; for (let k = 0; k <= n && ok; k++) if (k !== il) { const xs = reflect(pts[il], -0.5, pts[k]); if (!xs) ok = false; else pts[k] = xs; }
    if (!ok) { status = 'xcvg'; break; }
    if (!init()) break;
  }
  return { par: xbest, value: minf, feval: nevals, status };
}
