// mgcv::gam(y ~ s(x, k) + …, family, method = 'REML') for one-dimensional thin-plate regression splines.
// Ports: the tprs basis (tprs_setup: Lanczos eigen-truncation, Householder null-space constraint, column scaling),
// smoothCon (penalty scaling, sum-to-zero constraint absorption), the Laplace/REML criterion, mgcv's newton()
// smoothing-parameter optimiser, gam.fit3.post.proc (edf, edf1, edf2 via Vb.corr), summary.gam (p.table and
// s.table with testStat + Davies' method) and logLik.gam.
import * as L from './linalg.mjs';
import * as D from './dist.mjs';
import { need, isFactor, modelMatrix } from './frame.mjs';
import { svgPlot } from './plot.mjs';
import { printCoefmat, fmtSig } from './print.mjs';
import { logitInv, logitMuEta, digamma } from './regression-count.mjs';
import { RRNG } from './rng.mjs';

const EPS = 2.220446049250313e-16;
const lgam = D.lgamma;

// ---------- small dense helpers ----------
const zeros = (r, c) => Array.from({ length: r }, () => new Float64Array(c));
function cholUpper(A) { const n = A.length, R = zeros(n, n); for (let j = 0; j < n; j++) { let s = A[j][j]; for (let k = 0; k < j; k++) s -= R[k][j] * R[k][j]; if (!(s > 0)) return null; R[j][j] = Math.sqrt(s); for (let i = j + 1; i < n; i++) { let t = A[j][i]; for (let k = 0; k < j; k++) t -= R[k][j] * R[k][i]; R[j][i] = t / R[j][j]; } } return R; }
function invUpper(R) { const n = R.length, Ri = zeros(n, n); for (let j = 0; j < n; j++) { Ri[j][j] = 1 / R[j][j]; for (let i = j - 1; i >= 0; i--) { let s = 0; for (let k = i + 1; k <= j; k++) s += R[i][k] * Ri[k][j]; Ri[i][j] = -s / R[i][i]; } } return Ri; }
const mm = (A, B) => { const n = A.length, k = B.length, m = B[0].length, o = zeros(n, m); for (let i = 0; i < n; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; if (a === 0) continue; const Bl = B[l], oi = o[i]; for (let j = 0; j < m; j++) oi[j] += a * Bl[j]; } return o; };
const tr = A => { const r = A.length, c = A[0].length, o = zeros(c, r); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) o[j][i] = A[i][j]; return o; };
const xtwx = (X, w) => { const p = X[0].length, o = zeros(p, p); X.forEach((r, i) => { const wi = w ? w[i] : 1; for (let a = 0; a < p; a++) { const v = r[a] * wi; if (v === 0) continue; for (let b = a; b < p; b++) o[a][b] += v * r[b]; } }); for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) o[a][b] = o[b][a]; return o; };
const mv = (A, v) => A.map(r => { let s = 0; for (let j = 0; j < v.length; j++) s += r[j] * v[j]; return s; });
const dotv = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
// leverages x_i' A^{-1} x_i
const lev = (X, Ai) => { const p = Ai.length, out = new Float64Array(X.length); for (let i = 0; i < X.length; i++) { const r = X[i]; let s = 0; for (let a = 0; a < p; a++) { const ra = r[a]; if (ra === 0) continue; const Aa = Ai[a]; let t = 0; for (let b = 0; b < p; b++) t += Aa[b] * r[b]; s += ra * t; } out[i] = s; } return out; };
const sum = a => { let s = 0; for (const v of a) s += v; return s; };
// symmetric tridiagonal eigen (implicit QL); values descending, vectors as columns
function trisymeig(diag, off) {
  const n = diag.length, d = Float64Array.from(diag), e = new Float64Array(n), z = zeros(n, n);
  for (let i = 0; i < n - 1; i++) e[i] = off[i]; for (let i = 0; i < n; i++) z[i][i] = 1;
  for (let l = 0; l < n; l++) {
    let iter = 0, m;
    do {
      for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) <= EPS * dd) break; }
      if (m !== l) {
        if (iter++ === 60) throw new Error('trisymeig: too many iterations');
        let g = (d[l + 1] - d[l]) / (2 * e[l]), r = Math.hypot(g, 1); g = d[m] - d[l] + e[l] / (g + (g >= 0 ? r : -r));
        let s = 1, c = 1, p = 0, brk = false;
        for (let i = m - 1; i >= l; i--) {
          let f = s * e[i]; const b = c * e[i]; r = Math.hypot(f, g); e[i + 1] = r;
          if (r === 0) { d[i + 1] -= p; e[m] = 0; brk = true; break; }
          s = f / r; c = g / r; g = d[i + 1] - p; r = (d[i] - g) * s + 2 * c * b; p = s * r; d[i + 1] = g + p; g = c * r - b;
          for (let k = 0; k < n; k++) { f = z[k][i + 1]; z[k][i + 1] = s * z[k][i] + c * f; z[k][i] = c * z[k][i] - s * f; }
        }
        if (brk) continue;
        d[l] -= p; e[l] = g; e[m] = 0;
      }
    } while (m !== l);
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => d[b] - d[a]);
  return { values: idx.map(i => d[i]), vectors: z.map(row => idx.map(i => row[i])) };
}
// mgcv Rlanczos: the m largest-magnitude eigenpairs (deterministic start vector, full re-orthogonalisation,
// same convergence test and output order: positive values descending, then the selected negative ones)
function lanczos(A, m) {
  const n = A.length, tol = Math.pow(EPS, 0.7); let fcheck = Math.max(10, Math.floor(m / 2)); const kk = Math.max(1, Math.floor(n / 10)); if (kk < fcheck) fcheck = kk;
  const q = [], a = [], b = []; let jran = 1, bt = 0; const q0 = new Float64Array(n);
  for (let i = 0; i < n; i++) { jran = (jran * 106 + 1283) % 6075; q0[i] = jran / 6075 - 0.5; bt += q0[i] * q0[i]; }
  bt = Math.sqrt(bt); for (let i = 0; i < n; i++) q0[i] /= bt; q.push(q0);
  let ev = null, jj = n, pi = 0, ni = 0;
  for (let j = 0; j < n; j++) {
    const qj = q[j], z = new Float64Array(n);
    for (let i = 0; i < n; i++) { const Ai = A[i]; let s = 0; for (let l = 0; l < n; l++) s += Ai[l] * qj[l]; z[i] = s; }
    let xx = 0; for (let i = 0; i < n; i++) xx += qj[i] * z[i]; a[j] = xx;
    if (!j) for (let i = 0; i < n; i++) z[i] -= xx * qj[i];
    else {
      const yy = b[j - 1], qp = q[j - 1]; for (let i = 0; i < n; i++) z[i] -= xx * qj[i] + yy * qp[i];
      for (let rep = 0; rep < 2; rep++) for (let i = 0; i <= j; i++) { const qi = q[i]; let s = 0; for (let l = 0; l < n; l++) s += z[l] * qi[l]; for (let l = 0; l < n; l++) z[l] -= s * qi[l]; }
    }
    let nz = 0; for (let i = 0; i < n; i++) nz += z[i] * z[i]; b[j] = Math.sqrt(nz);
    if (j < n - 1) { const nq = new Float64Array(n); for (let i = 0; i < n; i++) nq[i] = z[i] / b[j]; q.push(nq); }
    if ((j >= m && j % fcheck === 0) || j === n - 1) {
      ev = trisymeig(a.slice(0, j + 1), b.slice(0, j));
      const dv = ev.values, normTj = Math.max(Math.abs(dv[0]), Math.abs(dv[j])), err = dv.map((_, k) => Math.abs(b[j] * ev.vectors[j][k]));
      if (j >= m) {
        const maxErr = normTj * tol; let conv = true; pi = 0; ni = 0;
        while (pi + ni < m) { if (Math.abs(dv[pi]) >= Math.abs(dv[j - ni])) { if (err[pi] > maxErr) { conv = false; break; } pi++; } else { if (err[ni] > maxErr) { conv = false; break; } ni++; } }
        if (conv) { jj = j + 1; break; }
      }
    }
  }
  const sel = [...Array.from({ length: pi }, (_, k) => k), ...Array.from({ length: ni }, (_, k) => jj - ni + k)];
  const U = zeros(n, m), vals = sel.map(k => ev.values[k]);
  sel.forEach((kidx, c) => { for (let l = 0; l < jj; l++) { const x = ev.vectors[l][kidx], ql = q[l]; if (x === 0) continue; for (let i = 0; i < n; i++) U[i][c] += ql[i] * x; } });
  return { U, d: vals };
}
// mgcv QT(): Householder factorisation A Q = [0, T]; returns the scaled Householder vectors (rows)
function QT(A0) {
  const A = A0.map(r => Float64Array.from(r)), Ar = A.length, Ac = A[0].length, Z = zeros(Ar, Ac);
  for (let i = 0; i < Ar; i++) {
    const p = A[i]; let m = 0; for (let j = 0; j < Ac - i; j++) m = Math.max(m, Math.abs(p[j]));
    if (m) for (let j = 0; j < Ac - i; j++) p[j] /= m;
    let lsq = 0; for (let j = 0; j < Ac - i; j++) lsq += p[j] * p[j]; lsq = Math.sqrt(lsq);
    if (p[Ac - i - 1] < 0) lsq = -lsq; p[Ac - i - 1] += lsq;
    let g = lsq ? 1 / (lsq * p[Ac - i - 1]) : 0; lsq *= m;
    for (let j = i + 1; j < Ar; j++) { const p1 = A[j]; let x = 0; for (let k = 0; k < Ac - i; k++) x += p[k] * p1[k]; x *= g; for (let k = 0; k < Ac - i; k++) p1[k] -= x * p[k]; }
    g = Math.sqrt(g); for (let j = 0; j < Ac - i; j++) Z[i][j] = p[j] * g;
    p[Ac - i - 1] = -lsq; for (let j = 0; j < Ac - i - 1; j++) p[j] = 0;
  }
  return Z;
}
// HQmult: C Q (postQ) and Q'C (preQt), Q = H1 H2 … from QT
function postQ(C, Z) { for (const u of Z) for (const row of C) { let s = 0; for (let j = 0; j < u.length; j++) s += row[j] * u[j]; for (let j = 0; j < u.length; j++) row[j] -= s * u[j]; } return C; }
function preQt(C, Z) { const c = C[0].length; for (const u of Z) { const cu = new Float64Array(c); for (let i = 0; i < c; i++) { let s = 0; for (let j = 0; j < C.length; j++) s += C[j][i] * u[j]; cu[i] = s; } for (let i = 0; i < C.length; i++) for (let j = 0; j < c; j++) C[i][j] -= cu[j] * u[i]; } return C; }
const eta3 = r => r > 0 ? r * r * r / 12 : 0; // TPS radial basis for d = 1, m = 2 (eta_const = 1/12)
function rmean(x) { const n = x.length; let s = 0; for (const v of x) s += v; s /= n; let t = 0; for (const v of x) t += v - s; return s + t / n; }

// ---------- s(x, k, bs = 'tp') with the sum-to-zero constraint absorbed (smoothCon) ----------
export function tprsSmooth(x, kIn, warnings) {
  const n = x.length, M = 2, shift = rmean(x), xx = x.map(v => v - shift);
  let k = kIn; if (k < M + 1) { k = M + 1; warnings.push('basis dimension, k, increased to minimum possible\n'); }
  let knots = [...new Set(xx)].sort((a, b) => a - b), useKnots = false;
  if (n > 2000 && knots.length > 2000) { const r = new RRNG(1), ind = r.sampleInt(knots.length, 2000, false); knots = [...new Set(Array.from(ind, i => knots[i - 1]))].sort((a, b) => a - b); useKnots = true; }
  const nu = knots.length; need(nu >= k, 'A term has fewer unique covariate combinations than specified maximum degrees of freedom');
  const pos = new Map(knots.map((v, i) => [v, i])), T = knots.map(v => [1, v]);
  const E = Array.from({ length: nu }, () => new Float64Array(nu));
  for (let i = 0; i < nu; i++) { const Ei = E[i], a = knots[i]; for (let j = 0; j < i; j++) { const r = a - knots[j], v = r * r * r / 12; Ei[j] = v; E[j][i] = v; } }
  let UZcols, S0, Xknot = null;
  if (nu === k) { // pure knot: no eigen step
    const Z = QT(tr(T)), Q = postQ(Array.from({ length: nu }, (_, i) => { const r = new Float64Array(nu); r[i] = 1; return r; }), Z);
    UZcols = Q.map(r => r.slice(0, k - M)); S0 = preQt(postQ(E.map(r => Float64Array.from(r)), Z), Z);
  } else {
    const { U, d } = lanczos(E, k), Z = QT(mm(tr(T), U));
    UZcols = postQ(U.map(r => Float64Array.from(r)), Z).map(r => r.slice(0, k - M));
    S0 = preQt(postQ(Array.from({ length: k }, (_, i) => { const r = new Float64Array(k); r[i] = d[i]; return r; }), Z), Z);
    if (!useKnots) Xknot = postQ(U.map(r => Float64Array.from(r, (v, j) => v * d[j])), Z).map((r, i) => [...r.slice(0, k - M), ...T[i]]);
  }
  for (let i = 0; i < k; i++) for (let j = k - M; j < k; j++) S0[i][j] = S0[j][i] = 0;
  const rowOf = v => { // basis row at a (shifted) covariate value, before column scaling
    if (Xknot && pos.has(v)) return Xknot[pos.get(v)];
    const b = knots.map(kv => eta3(Math.abs(v - kv))), r = new Array(k).fill(0);
    for (let j = 0; j < k - M; j++) { let s = 0; for (let l = 0; l < nu; l++) s += b[l] * UZcols[l][j]; r[j] = s; }
    r[k - 2] = 1; r[k - 1] = v; return r;
  };
  const X = xx.map(v => Float64Array.from(rowOf(v)));
  const w = new Float64Array(k); for (let j = 0; j < k; j++) { let s = 0; for (let i = 0; i < n; i++) s += X[i][j] * X[i][j]; w[j] = Math.sqrt(s / n); }
  X.forEach(r => { for (let j = 0; j < k; j++) r[j] /= w[j]; });
  let S = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => S0[i][j] / w[i] / w[j]));
  S = S.map((r, i) => r.map((v, j) => (v + S[j][i]) / 2));
  // penalty scaling (smoothCon: norm(S, 'O') / norm(X, 'I')^2)
  let nX = 0; for (const r of X) { let s = 0; for (const v of r) s += Math.abs(v); nX = Math.max(nX, s); }
  let nS = 0; for (let j = 0; j < k; j++) { let s = 0; for (let i = 0; i < k; i++) s += Math.abs(S[i][j]); nS = Math.max(nS, s); }
  const maS = nS / (nX * nX); S = S.map(r => r.map(v => v / maS));
  // absorb C = colSums(X) through qr(t(C)) (with the sparse variant when some column sums are exactly zero)
  const C = Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[j], 0)), indi = C.map((v, j) => v !== 0 ? j : -1).filter(j => j >= 0);
  let absorb;
  if (indi.length < k) { const Q = L.qrR(indi.map(j => [C[j]])), nx = indi.length, last = indi[nx - 1]; absorb = r => { const qt = L.qrQty(Q, indi.map(j => r[j])), o = Array.from(r); for (let a = 0; a < nx - 1; a++) o[indi[a]] = qt[a + 1]; o.splice(last, 1); return o; }; }
  else { const Q = L.qrR(C.map(v => [v])); absorb = r => Array.from(L.qrQty(Q, Array.from(r))).slice(1); }
  const Xf = X.map(absorb), Sf = tr(tr(S).map(absorb)).map(absorb).map(r => Array.from(r));
  const predict = xs => xs.map(v => absorb(rowOf(v - shift).map((u, j) => u / w[j])));
  return { X: Xf, S: Sf, rank: k - M, k, predict };
}

// ---------- families on the linear predictor (W = observed information; = Fisher for canonical links) ----------
function famOf(name) {
  if (name === 'binomial') return { name, mu: logitInv, g: (y, m) => y - m, w: (y, m, e) => { const me = logitMuEta(e); return me * me / (m * (1 - m)); }, dw: (y, m) => m * (1 - m) * (1 - 2 * m), dev: (y, m) => 2 * ((y > 0 ? y * Math.log(y / m) : 0) + (y < 1 ? (1 - y) * Math.log((1 - y) / (1 - m)) : 0)), ls: () => 0, aic: (y, mu) => -2 * y.reduce((s, v, i) => s + D.dbinom(v, 1, mu[i], true), 0), init: y => y.map(v => (v + 0.5) / 2), link: m => Math.log(m / (1 - m)), initW: m => m * (1 - m) };
  if (name === 'poisson') return { name, mu: e => Math.max(Math.exp(e), EPS), g: (y, m) => y - m, w: (y, m) => m, dw: (y, m) => m, dev: (y, m) => 2 * ((y > 0 ? y * Math.log(y / m) : 0) - (y - m)), ls: y => y.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0) - v - lgam(v + 1), 0), aic: (y, mu) => -2 * y.reduce((s, v, i) => s + D.dpois(v, mu[i], true), 0), init: y => y.map(v => v + 0.1), link: Math.log, initW: m => m };
  if (name === 'negbin') return { name, nb: true, mu: e => Math.max(Math.exp(e), EPS), link: Math.log,
    g: (y, m, e, th) => (y - m) * th / (m + th), w: (y, m, e, th) => m * th * (y + th) / ((m + th) ** 2), dw: (y, m, e, th) => m * th * (y + th) * (th - m) / ((m + th) ** 3),
    dev: (y, m, th) => 2 * (y * Math.log(Math.max(1, y) / m) - (y + th) * Math.log((y + th) / (m + th))),
    ls: (y, th) => -y.reduce((s, v) => s + (v + th) * Math.log(v + th) - (v > 0 ? v * Math.log(v) : 0) + lgam(v + 1) - th * Math.log(th) + lgam(th) - lgam(th + v), 0),
    aic: (y, mu, th) => 2 * y.reduce((s, v, i) => s + (v + th) * Math.log(mu[i] + th) - v * Math.log(mu[i]) + lgam(v + 1) - th * Math.log(th) + lgam(th) - lgam(th + v), 0),
    init: y => y.map(v => v + (v === 0 ? 1 / 6 : 0)) };
  if (name === 'gaussian') return { name, gaussian: true };
  throw new Error('family not recognized');
}

// ---------- the REML criterion, its gradient and Hessian ----------
// par: gaussian [rho_1..rho_m, log phi]; binomial/poisson [rho…]; negbin [log theta, rho…]
function makeModel(X, y, smooths, fam) {
  const n = X.length, p = X[0].length, m = smooths.length, XtX = fam.gaussian ? xtwx(X) : null, Xty = fam.gaussian ? L.tmulVec(X, y) : null;
  const Mp = p - sum(smooths.map(b => b.rank)), ldS = smooths.map(b => sum(L.eigenSym(b.S).values.slice(0, b.rank).map(Math.log)));
  const rhoOf = par => fam.gaussian ? par.slice(0, m) : fam.nb ? par.slice(1) : par;
  const Sl = lam => { const o = zeros(p, p); smooths.forEach((b, j) => { for (let a = 0; a < b.S.length; a++) for (let c = 0; c < b.S.length; c++) o[b.start + a][b.start + c] += lam[j] * b.S[a][c]; }); return o; };
  const Sb = (j, v) => { const b = smooths[j], o = new Float64Array(p); for (let a = 0; a < b.S.length; a++) { let s = 0; for (let c = 0; c < b.S.length; c++) s += b.S[a][c] * v[b.start + c]; o[b.start + a] = s; } return o; };
  const lS = par => sum(rhoOf(par).map((r, j) => smooths[j].rank * r + ldS[j]));
  const trAS = (Ai, j) => { const b = smooths[j]; let t = 0; for (let a = 0; a < b.S.length; a++) for (let c = 0; c < b.S.length; c++) t += Ai[b.start + c][b.start + a] * b.S[a][c]; return t; };
  let warm = null;
  function fit(par) {
    const lam = rhoOf(par).map(Math.exp), S = Sl(lam);
    if (fam.gaussian) {
      const A = L.add(XtX, S), R = cholUpper(A); if (!R) return null;
      const Ri = invUpper(R), Ai = mm(Ri, tr(Ri)), beta = mv(Ai, Xty), f = mv(X, beta); let rss = 0; for (let i = 0; i < n; i++) rss += (y[i] - f[i]) ** 2;
      const pen = dotv(beta, mv(S, beta)), phi = Math.exp(par[m]); let ld = 0; for (let i = 0; i < p; i++) ld += 2 * Math.log(R[i][i]);
      return { V: (rss + pen) / (2 * phi) + (n - Mp) / 2 * Math.log(2 * Math.PI * phi) + ld / 2 - lS(par) / 2, beta, Ai, S, lam, w: new Array(n).fill(1), mu: f, eta: f, dev: rss, pen, phi };
    }
    const th = fam.nb ? Math.exp(par[0]) : 0, pdev = b => { const e = mv(X, b); let s = 0; for (let i = 0; i < n; i++) s += fam.dev(y[i], fam.mu(e[i]), th); return s + dotv(b, mv(S, b)); };
    let beta = warm ? warm.slice() : null;
    if (!beta) { const eta = fam.init(y).map(fam.link), mu = eta.map(fam.mu), w = y.map((v, i) => fam.w(v, mu[i], eta[i], th)), z = eta.map((e, i) => e + fam.g(y[i], mu[i], e, th) / w[i]); const A = L.add(xtwx(X, w), S); if (!cholUpper(A)) return null; beta = L.cholSolve(L.chol(A), L.tmulVec(X, z.map((v, i) => v * w[i]))); }
    let old = pdev(beta);
    for (let it = 0; it < 200; it++) {
      const e = mv(X, beta), mu = e.map(fam.mu), w = y.map((v, i) => fam.w(v, mu[i], e[i], th)), g = y.map((v, i) => fam.g(v, mu[i], e[i], th));
      const A = L.add(xtwx(X, w), S); if (!cholUpper(A)) return null;
      const grd = L.tmulVec(X, g).map((v, j) => v - dotv(S[j], beta)), step = L.cholSolve(L.chol(A), grd);
      let t = 1, nb = beta.map((v, j) => v + step[j]), nd = pdev(nb);
      while (!(nd <= old + 1e-12 * Math.abs(old)) && t > 1e-10) { t /= 2; nb = beta.map((v, j) => v + t * step[j]); nd = pdev(nb); }
      const change = Math.max(...step.map((s, j) => Math.abs(t * s) / (Math.abs(beta[j]) + 1e-8)));
      beta = nb; old = nd; if (change < 1e-13) break;
    }
    warm = beta.slice();
    const e = mv(X, beta), mu = e.map(fam.mu), w = y.map((v, i) => fam.w(v, mu[i], e[i], th)), A = L.add(xtwx(X, w), S), R = cholUpper(A); if (!R) return null;
    const Ri = invUpper(R), Ai = mm(Ri, tr(Ri)); let ld = 0; for (let i = 0; i < p; i++) ld += 2 * Math.log(R[i][i]);
    let dev = 0; for (let i = 0; i < n; i++) dev += fam.dev(y[i], mu[i], th);
    const pen = dotv(beta, mv(S, beta));
    return { V: (dev + pen) / 2 - fam.ls(y, th) + ld / 2 - lS(par) / 2 - Mp / 2 * Math.log(2 * Math.PI), beta, Ai, S, lam, w, mu, eta: e, dev, pen, phi: 1, th };
  }
  function grad(par, f) {
    const { beta, Ai, lam } = f, out = [];
    if (fam.gaussian) { smooths.forEach((b, j) => out.push(lam[j] * dotv(beta, Sb(j, beta)) / (2 * f.phi) + lam[j] * trAS(Ai, j) / 2 - b.rank / 2)); out.push(-(f.dev + f.pen) / (2 * f.phi) + (n - Mp) / 2); return out; }
    const th = f.th, h = lev(X, Ai), dwde = y.map((v, i) => fam.dw(v, f.mu[i], f.eta[i], th));
    if (fam.nb) {
      let dD = 0, dls = 0, trw = 0; const dgth = y.map((v, i) => (v - f.mu[i]) * f.mu[i] / ((f.mu[i] + th) ** 2)), xdb = mv(X, mv(Ai, L.tmulVec(X, dgth)));
      for (let i = 0; i < n; i++) { const v = y[i], mu = f.mu[i]; dD += -2 * (Math.log((v + th) / (mu + th)) + 1 - (v + th) / (mu + th)); dls += -(Math.log(v + th) - Math.log(th) + digamma(th) - digamma(v + th)); trw += h[i] * (mu * (v * mu + 2 * th * mu - th * v) / ((mu + th) ** 3) + dwde[i] * xdb[i]); }
      out.push(th * (dD / 2 - dls + trw / 2));
    }
    smooths.forEach((b, j) => { const sb = Sb(j, beta), xdb = mv(X, mv(Ai, sb).map(v => -lam[j] * v)); let tw = 0; for (let i = 0; i < n; i++) tw += h[i] * dwde[i] * xdb[i]; out.push(lam[j] * dotv(beta, sb) / 2 + (lam[j] * trAS(Ai, j) + tw) / 2 - b.rank / 2); });
    return out;
  }
  function hess(par, f) {
    const k = par.length, H = zeros(k, k);
    if (fam.gaussian) {
      const { beta, Ai, lam } = f, SB = smooths.map((_, j) => Sb(j, beta)), AiSB = SB.map(v => mv(Ai, v));
      const AS = smooths.map(b => { const o = zeros(p, p); for (let r = 0; r < p; r++) for (let a = 0; a < b.S.length; a++) { let s = 0; for (let c = 0; c < b.S.length; c++) s += Ai[r][b.start + c] * b.S[c][a]; o[r][b.start + a] = s; } return o; });
      for (let j = 0; j < m; j++) for (let l = j; l < m; l++) {
        let t2 = 0; for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) t2 += AS[l][r][c] * AS[j][c][r];
        let v = -lam[j] * lam[l] * dotv(SB[j], AiSB[l]) / f.phi - lam[j] * lam[l] * t2 / 2;
        if (j === l) v += lam[j] * dotv(beta, SB[j]) / (2 * f.phi) + lam[j] * trAS(Ai, j) / 2;
        H[j][l] = H[l][j] = v;
      }
      for (let j = 0; j < m; j++) H[j][m] = H[m][j] = -lam[j] * dotv(beta, SB[j]) / (2 * f.phi);
      H[m][m] = (f.dev + f.pen) / (2 * f.phi); return H;
    }
    const hs = 1e-5, saved = warm ? warm.slice() : null;
    for (let i = 0; i < k; i++) { const pp = par.slice(), pm = par.slice(); pp[i] += hs; pm[i] -= hs; warm = saved; const gp = grad(pp, fit(pp)); warm = saved; const gm = grad(pm, fit(pm)); for (let j = 0; j < k; j++) H[i][j] = (gp[j] - gm[j]) / (2 * hs); }
    warm = saved; for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) H[i][j] = H[j][i] = (H[i][j] + H[j][i]) / 2;
    return H;
  }
  return { fit, grad, hess, Mp, Sb };
}

// ---------- mgcv newton() (outer REML optimiser; L = identity, no lsp.max, edge.correct = FALSE) ----------
function newton(model, lsp0, scaleEst) {
  const convTol = 1e-6, maxNstep = 5, maxSstep = 2, maxHalf = 30, qthresh = 0.8;
  const ev = (par, deriv) => { const f = model.fit(par); if (!f) return { score: Infinity, par }; const o = { f, par, score: f.V }; if (deriv) { o.grad = model.grad(par, f); o.hess = model.hess(par, f); } return o; };
  const quad = (g, H, s) => dotv(g, s) + 0.5 * dotv(s, mv(H, s)), qerr = (pc, sc, ss) => Math.abs(pc - sc) / (Math.max(Math.abs(pc), Math.abs(sc)) + ss * convTol);
  const sscale = bb => Math.abs(Math.log(scaleEst(bb))) + Math.abs(bb.score);
  let lsp = lsp0.slice(), b = ev(lsp, true); need(Number.isFinite(b.score), 'The penalized model could not be fitted at the initial smoothing parameters.');
  let oldScore = b.score, score = b.score, grad = b.grad, hess = b.hess, scoreScale = sscale(b);
  let uconv = grad.map(g => Math.abs(g) > scoreScale * convTol); if (!uconv.some(Boolean)) uconv = uconv.map(() => true);
  let ii = 0, iter, converged = false; const warns = [];
  for (iter = 1; iter <= 200; iter++) {
    const mg = Math.max(...grad.map(Math.abs));
    if (!uconv.some(Boolean)) uconv[grad.findIndex(g => Math.abs(g) === mg)] = true;
    const ind = uconv.map((u, i) => u ? i : -1).filter(i => i >= 0), g1 = ind.map(i => grad[i]), eh = L.eigenSym(ind.map(i => ind.map(j => hess[i][j])));
    let d = eh.values.slice(); const U = eh.vectors;
    let indef = d.some(v => -v > Math.abs(d[0]) * Math.sqrt(EPS)); if (indef && d.length === 1) indef = d[0] < -scoreScale * Math.sqrt(EPS);
    let pdef = !d.some(v => v < 0); d = d.map(Math.abs); const lowd = Math.max(...d) * Math.pow(EPS, 0.7); if (d.some(v => v < lowd)) pdef = false; d = d.map(v => v < lowd ? lowd : v).map(v => v !== 0 ? 1 / v : v);
    const Utg = d.map((_, c) => U.reduce((s, row, r) => s + row[c] * g1[r], 0));
    let Nstep = grad.map(() => 0); ind.forEach((i, q) => { Nstep[i] = -U[q].reduce((s, u, c) => s + u * d[c] * Utg[c], 0); });
    const Sstep = grad.map(g => -g / mg), ms = Math.max(...Nstep.map(Math.abs)); if (ms > maxNstep) Nstep = Nstep.map(v => maxNstep * v / ms);
    let sdUnused = true, lsp1 = lsp.map((v, i) => v + Nstep[i]); const b1 = ev(lsp1, pdef);
    let score1 = b1.score, scoreChange = score1 - score, score2 = NaN, qerror = qerr(quad(grad, hess, Nstep), scoreChange, scoreScale);
    ii = 0;
    if (Number.isFinite(score1) && scoreChange < 0 && pdef && qerror < qthresh) { oldScore = score; b = b1; lsp = lsp1; score = b.score; grad = b.grad; hess = b.hess; }
    else if (!Number.isFinite(score1) || score1 >= score || qerror >= qthresh) {
      let step = Nstep.slice();
      while ((!Number.isFinite(score1) || score1 >= score || qerror >= qthresh) && ii < maxHalf) {
        if (ii === 3 && iter < 10) { const sl = Math.min(Math.sqrt(dotv(step, step)), maxSstep); step = Sstep.map(v => v * sl / Math.sqrt(dotv(Sstep, Sstep))); sdUnused = false; } else step = step.map(v => v / 2);
        lsp1 = lsp.map((v, i) => v + step[i]); const bt = ev(lsp1, false); score1 = bt.score; scoreChange = score1 - score;
        qerror = ii > Math.min(4, maxHalf / 2) ? qthresh / 2 : qerr(quad(grad, hess, step), scoreChange, scoreScale);
        if (Number.isFinite(score1) && scoreChange < 0 && qerror < qthresh) {
          if (pdef || !sdUnused) { b = ev(lsp1, true); oldScore = score; lsp = lsp1; score = b.score; grad = b.grad; hess = b.hess; }
          else score2 = score1;
          score1 = score - Math.abs(score) - 1;
        }
        if (!Number.isFinite(score1) || score1 >= score || qerror >= qthresh) ii++;
      }
      if (!pdef && sdUnused && ii < maxHalf) score1 = score2;
    }
    if (!pdef && sdUnused) {
      let step = Sstep.map(v => v * 2), kk = 0, s2 = NaN, lsp2 = null, ok = true;
      while (ok) {
        step = step.map(v => v / 2); kk++; const lsp3 = lsp.map((v, i) => v + step[i]), s3 = ev(lsp3, false).score; scoreChange = s3 - score;
        qerror = qerr(quad(grad, hess, step), scoreChange, scoreScale);
        if (!Number.isFinite(s2) || (Number.isFinite(s3) && s3 <= s2 && qerror < qthresh)) { s2 = s3; lsp2 = lsp3; }
        if ((Number.isFinite(s2) && Number.isFinite(s3) && s2 < score && s3 > s2) || kk === 40) ok = false;
      }
      if (Number.isFinite(s2) && s2 < score1) lsp1 = lsp2;
      b = ev(lsp1, true); oldScore = score; lsp = lsp1; score = b.score; grad = b.grad; hess = b.hess;
    }
    converged = !indef; scoreScale = sscale(b);
    uconv = grad.map((g, i) => Math.abs(g) > scoreScale * convTol * 0.1 || Math.abs(hess[i][i]) > scoreScale * convTol * 0.1);
    if (grad.some(g => Math.abs(g) > scoreScale * convTol * 5)) converged = false;
    if (Math.abs(oldScore - score) > scoreScale * convTol) { if (converged) uconv = uconv.map(() => true); converged = false; }
    if (ii === maxHalf) converged = true;
    if (converged) break;
  }
  if (ii === maxHalf) warns.push('Fitting terminated with step failure - check results carefully');
  else if (iter > 200) warns.push('Iteration limit reached without full convergence - check carefully');
  return { lsp, b, grad, hess, iter, warns };
}

// ---------- Davies (1980): distribution of a linear combination of chi-squares (mgcv davies.c) ----------
function log1pmx(x) { if (x > 1 || x < -0.79149064 || Math.abs(x) > 0.25) return Math.log1p(x) - x; let s = 0, t = x; for (let k = 2; k < 400; k++) { t *= -x; const d = t / k; s += d; if (Math.abs(d) <= 1e-17 * Math.abs(s)) break; } return s; }
const ln1 = (x, first) => first ? Math.log1p(x) : log1pmx(x);
function davies(lb, nc, n, sigma, c, lim, acc) {
  const r = lb.length, pi = Math.PI, ln28 = Math.log(2) / 8; let ifault = 0, intl = 0, ersm = 0, acc1 = acc, fail = 0;
  const th = Array.from({ length: r }, (_, j) => j).sort((a, b) => Math.abs(lb[b]) - Math.abs(lb[a]));
  let sigsq = sigma * sigma, sd = sigsq, lmax = 0, lmin = 0, mean = 0;
  for (let j = 0; j < r; j++) { const nj = n[j], lj = lb[j], ncj = nc[j]; sd += lj * lj * (2 * nj + 4 * ncj); mean += lj * (nj + ncj); if (lmax < lj) lmax = lj; else if (lmin > lj) lmin = lj; }
  if (sd === 0) return { c: c > 0 ? 1 : 0, ifault };
  sd = Math.sqrt(sd); const almx = lmax < -lmin ? -lmin : lmax;
  const errbd = (u, out) => { let cx = u * sigsq, sum1 = u * cx; u *= 2; for (let j = r - 1; j >= 0; j--) { const nj = n[j], lj = lb[j], ncj = nc[j], x = u * lj, y = 1 - x; cx += lj * (ncj / y + nj) / y; const xy = x / y; sum1 += ncj * xy * xy + nj * (x * xy + ln1(-x, 0)); } out.cx = cx; return Math.exp(-0.5 * sum1); };
  const ctff = (accx, upn) => { let u2 = upn.v, u1 = 0, c1 = mean, c2; const rb = u2 > 0 ? 2 * lmax : 2 * lmin, o = {}; for (;;) { if (errbd(u2 / (1 + u2 * rb), o) <= accx) { c2 = o.cx; break; } u1 = u2; c1 = o.cx; u2 *= 2; } for (;;) { if ((c1 - mean) / (c2 - mean) >= 0.9) break; const u = (u1 + u2) * 0.5; if (errbd(u / (1 + u * rb), o) > accx) { u1 = u; c1 = o.cx; } else { u2 = u; c2 = o.cx; } } upn.v = u2; return c2; };
  const truncation = (u, tausq) => { let sum1 = 0, prod2 = 0, prod3 = 0, s = 0; const sum2 = (sigsq + tausq) * u * u; let prod1 = 2 * sum2; u *= 2; for (let j = 0; j < r; j++) { const lj = lb[j], ncj = nc[j], nj = n[j]; let x = u * lj; x *= x; sum1 += ncj * x / (1 + x); if (x > 1) { prod2 += nj * Math.log(x); prod3 += nj * ln1(x, 1); s += nj; } else prod1 += nj * ln1(x, 1); } sum1 *= 0.5; prod2 += prod1; prod3 += prod1; let x = Math.exp(-sum1 - 0.25 * prod2) / pi; const y = Math.exp(-sum1 - 0.25 * prod3) / pi; let err1 = s === 0 ? 1 : 2 * x / s, err2 = prod3 > 1 ? 2.5 * y : 1; if (err2 < err1) err1 = err2; x = 0.5 * sum2; err2 = x <= y ? 1 : y / x; return err1 < err2 ? err1 : err2; };
  const findu = (utx, accx) => { const a = [2, 1.4, 1.2, 1.1]; let ut = utx, u = ut * 0.25; if (truncation(u, 0) > accx) { while (truncation(ut, 0) > accx) ut *= 4; } else { ut = u; u /= 4; while (truncation(u, 0) <= accx) { ut = u; u /= 4; } } for (let i = 0; i < 4; i++) { u = ut / a[i]; if (truncation(u, 0) <= accx) ut = u; } return ut; };
  const integrate = (nterm, interv, tausq, main) => { const inpi = interv / pi; for (let k = nterm; k >= 0; k--) { const u = (k + 0.5) * interv; let sum1 = -2 * u * c, sum2 = Math.abs(sum1), sum3 = -0.5 * sigsq * u * u; for (let j = r - 1; j >= 0; j--) { const nj = n[j]; const x = 2 * lb[j] * u; let y = x * x; sum3 -= 0.25 * nj * ln1(y, 1); y = nc[j] * x / (1 + y); const z = nj * Math.atan(x) + y; sum1 += z; sum2 += Math.abs(z); sum3 += -0.5 * x * y; } let x = inpi * Math.exp(sum3) / u; if (!main) x *= 1 - Math.exp(-0.5 * tausq * u * u); intl += Math.sin(0.5 * sum1) * x; ersm += 0.5 * sum2 * x; } };
  const cfe = x => { let axl = Math.abs(x); const sxl = x < 0 ? -1 : 1; let sum1 = 0; for (let j = r - 1; j >= 0; j--) { const t = th[j]; if (lb[t] * sxl > 0) { const lj = Math.abs(lb[t]), axl1 = axl - lj * (n[t] + nc[t]), axl2 = lj / ln28; if (axl1 > axl2) axl = axl1; else { if (axl > axl2) axl = axl2; sum1 = (axl - axl1) / lj; for (let k = j - 1; k >= 0; k--) sum1 += n[th[k]] + nc[th[k]]; break; } } } if (sum1 > 100) { fail = 1; return 1; } fail = 0; return Math.pow(2, sum1 * 0.25) / (pi * axl * axl); };
  let utx = 16 / sd, tausq, intv, nt; const up = { v: 4.5 / sd }, un = { v: -4.5 / sd };
  utx = findu(utx, 0.5 * acc1);
  if (c !== 0 && almx > 0.07 * sd) { tausq = 0.25 * acc1 / cfe(c); if (!fail && truncation(utx, tausq) < 0.2 * acc1) { sigsq += tausq; utx = findu(utx, 0.25 * acc1); } }
  acc1 *= 0.5;
  for (;;) {
    const d1 = ctff(acc1, up) - c; if (d1 < 0) return { c: 1, ifault };
    const d2 = c - ctff(acc1, un); if (d2 < 0) return { c: 0, ifault };
    intv = 2 * pi / (d1 > d2 ? d1 : d2);
    let x = utx / intv; nt = Math.floor(x); if (x - nt > 0.5) nt++;
    x = 3 / Math.sqrt(acc1); let ntm = Math.floor(x); if (x - ntm > 0.5) ntm++;
    if (nt > ntm * 1.5) {
      const intv1 = utx / ntm; x = 2 * pi / intv1; if (x <= Math.abs(c)) break;
      tausq = 0.33 * acc1 / (1.1 * (cfe(c - x) + cfe(c + x))); if (fail) break;
      acc1 *= 0.67; if (ntm > lim) return { c: -1, ifault: 1 };
      integrate(ntm, intv1, tausq, false); lim -= ntm; sigsq += tausq; utx = findu(utx, 0.25 * acc1); acc1 *= 0.75;
    } else break;
  }
  if (nt > lim) return { c: -1, ifault: 1 };
  integrate(nt, intv, 0, true);
  const x = ersm + acc / 10; let j = 1; for (let i = 0; i < 4; i++) { if (j * x === j * ersm) ifault = 2; j *= 2; }
  return { c: 0.5 - intl, ifault };
}
const psumChisq = (q, lb, df) => 1 - davies(lb, lb.map(() => 0), df.map(Math.round), 0, q, 100000, 2e-5).c;

// summary.gam's testStat (type = 0)
function testStat(p, Xt, V, rank, resDf) {
  const Q = L.qrR(Xt, 0), q = Xt[0].length, R = L.zeros(q, q); for (let i = 0; i < q; i++) for (let j = i; j < q; j++) R[i][j] = Q.cols[j][i];
  const piv = Q.pivot, Vp = piv.map(a => piv.map(b => V[a][b])); let W = L.mul(L.mul(R, Vp), L.t(R)); W = W.map((r, i) => r.map((v, j) => (v + W[j][i]) / 2));
  const ed = L.eigenSym(W), vals = ed.values; let vec = ed.vectors.map(r => r.slice());
  for (let c = 0; c < q; c++) { const s = Math.sign(vec[0][c]) || 1; for (let r = 0; r < q; r++) vec[r][c] *= s; }
  let k = Math.max(0, Math.floor(rank)), nu = Math.abs(rank - k), k1 = nu > 0 ? k + 1 : k;
  const rEst = vals.filter(v => v > Math.max(...vals) * Math.pow(EPS, 0.9)).length;
  if (rEst < k1) { k1 = k = rEst; nu = 0; rank = rEst; }
  vec = vec.map(r => r.slice(0, Math.min(k1, q)));
  let vec1;
  if (nu > 0 && k > 0) {
    for (let c = 0; c < k - 1; c++) for (let r = 0; r < q; r++) vec[r][c] /= Math.sqrt(vals[c]);
    const b12 = Math.sqrt(Math.max(0.5 * nu * (1 - nu), 0)), e1 = Math.pow(vals[k - 1], -0.5), e2 = Math.pow(vals[k1 - 1], -0.5);
    const eb = L.eigenSym([[e1 * e1, e1 * b12 * e2], [e2 * b12 * e1, e2 * nu * e2]]), rB = L.mul(L.mul(eb.vectors, L.diagM(eb.values.map(Math.sqrt))), L.t(eb.vectors));
    vec1 = vec.map(r => r.slice());
    for (let r = 0; r < q; r++) { const a = vec[r][k - 1], b = vec[r][k1 - 1]; vec[r][k - 1] = rB[0][0] * a + rB[0][1] * b; vec[r][k1 - 1] = rB[1][0] * a + rB[1][1] * b; vec1[r][k - 1] = -rB[0][0] * a + rB[0][1] * b; vec1[r][k1 - 1] = -rB[1][0] * a + rB[1][1] * b; }
  } else {
    if (k === 0) vec = vec.map(r => r.map(v => v * Math.sqrt(1 / vals[0]))); else for (let c = 0; c < k; c++) for (let r = 0; r < q; r++) vec[r][c] /= Math.sqrt(vals[c]);
    vec1 = vec; if (k === 1) rank = 1;
  }
  const Rp = mv(R, piv.map(i => p[i])), proj = vv => { let s = 0; for (let c = 0; c < vv[0].length; c++) { let t = 0; for (let r = 0; r < q; r++) t += vv[r][c] * Rp[r]; s += t * t; } return s; };
  const d = proj(vec), d1 = proj(vec1); let rank1 = rank, pval;
  if (nu > 0) {
    let val; if (k1 === 1) { rank1 = 1; val = [1]; } else { val = new Array(k1).fill(1); const rp = nu + 1; val[k - 1] = (rp + Math.sqrt(rp * (2 - rp))) / 2; val[k1 - 1] = rp - val[k - 1]; }
    if (resDf <= 0) pval = (psumChisq(d, val, val.map(() => 1)) + psumChisq(d1, val, val.map(() => 1))) / 2;
    else { const k0 = Math.max(1, Math.round(resDf)); pval = (psumChisq(0, [...val, -d / k0], [...val.map(() => 1), k0]) + psumChisq(0, [...val, -d1 / k0], [...val.map(() => 1), k0])) / 2; }
  } else pval = 2;
  if (pval > 1) pval = resDf <= 0 ? (D.pchisq(d, rank1, false) + D.pchisq(d1, rank1, false)) / 2 : (D.pf(d / rank1, rank1, resDf, false) + D.pf(d1 / rank1, rank1, resDf, false)) / 2;
  return { stat: d, pval: Math.min(1, pval), rank };
}
// dchol: derivative of the Cholesky factor R (R'R = A) for dA
function dchol(dA, R) { const p = R.length, dR = zeros(p, p); for (let i = 0; i < p; i++) for (let j = i; j < p; j++) { let x = 0; for (let k = 0; k < i; k++) x += R[k][i] * dR[k][j] + R[k][j] * dR[k][i]; dR[i][j] = j > i ? (dA[i][j] - x - R[i][j] * dR[i][i]) / R[i][i] : (dA[i][i] - x) * 0.5 / R[i][i]; } return dR; }

// ---------- the analysis ----------
export function fitGam(ctx, kOpt, famName, fitout) {
  const fam = famOf(famName), d = ctx.d, yv = Array.from(ctx.value('y')), warnings = [];
  if (fam.name === 'binomial') need(yv.every(v => v >= 0 && v <= 1), 'y values must be 0 <= y <= 1');
  if (fam.name === 'poisson') need(yv.every(v => v >= 0), "negative values not allowed for the 'Poisson' family");
  if (fam.nb) need(yv.every(v => v >= 0), 'negative values not allowed for the negative binomial family');
  const par = ctx.x.filter(v => isFactor(d.get(v))), smv = ctx.x.filter(v => !isFactor(d.get(v)));
  const PM = modelMatrix(d, par.map(v => ({ vars: [v] })), {}), smooths = [];
  let X = PM.X.map(r => r.slice()), start = PM.names.length;
  for (const v of smv) {
    const xv = Array.from(d.get(v)), sm = tprsSmooth(xv, Math.min(kOpt, new Set(xv).size - 1), warnings);
    smooths.push({ label: 's(' + v + ')', v, start, S: sm.S, rank: sm.rank, k: sm.X[0].length, predict: sm.predict, x: xv });
    X = X.map((r, i) => r.concat(sm.X[i])); start += sm.X[0].length;
  }
  warnings.forEach(w => ctx.warn(w));
  const n = X.length, p = X[0].length, nsdf = PM.names.length, model = makeModel(X, yv, smooths, fam), nth = fam.nb ? 1 : 0;
  // initial smoothing parameters: initial.spg (type 1) → initial.sp; log scale = log(null.scale / 10); log theta = 0
  let wInit;
  if (fam.gaussian) wInit = new Array(n).fill(1);
  else if (fam.nb) { const mu = fam.init(yv), th = 1; let w = mu.map((m, i) => -((yv[i] + th) / ((m + th) ** 2) - yv[i] / (m * m)) * m * m); if (w.some(v => v < 0)) w = mu.map(m => (1 / m - 1 / (m + th)) * m * m); wInit = w.map(Math.sqrt); }
  else wInit = fam.init(yv).map(m => Math.sqrt(fam.initW(m)));
  const ldxx = Array.from({ length: p }, (_, j) => X.reduce((s, r, i) => s + (r[j] * wInit[i]) ** 2, 0));
  const defSp = smooths.map(s => { const kk = s.S.length, maS = Math.max(...s.S.flat().map(Math.abs)), thresh = Math.pow(EPS, 0.8) * maS; s.pen = s.S.map((r, a) => sum(r.map(Math.abs)) / kk > thresh && sum(s.S.map(row => Math.abs(row[a]))) / kk > thresh && Math.abs(r[a]) > thresh); const ss = s.S.map((r, a) => r[a]).filter((_, a) => s.pen[a]), xx = ldxx.slice(s.start, s.start + kk).filter((_, a) => s.pen[a]); return (sum(xx) / xx.length) / (sum(ss) / ss.length); });
  if (smooths.length) {
    let ldss = new Array(p).fill(0); const pen = new Array(p).fill(false); smooths.forEach((s, j) => s.S.forEach((r, a) => { ldss[s.start + a] += defSp[j] * r[a]; pen[s.start + a] = pen[s.start + a] || s.pen[a]; }));
    const ix = ldss.map((v, i) => v > 0 && pen[i] && ldxx[i] > 0), ratio = () => { let s = 0, c = 0; ix.forEach((ok, i) => { if (ok) { s += ldxx[i] / (ldxx[i] + ldss[i]); c++; } }); return s / c; };
    while (ratio() > 0.4) { for (let j = 0; j < defSp.length; j++) defSp[j] *= 10; ldss = ldss.map(v => v * 10); }
    while (ratio() < 0.4) { for (let j = 0; j < defSp.length; j++) defSp[j] /= 10; ldss = ldss.map(v => v / 10); }
  }
  let lsp = defSp.map(Math.log);
  if (fam.gaussian) { const my = sum(yv) / n; lsp.push(Math.log(yv.reduce((s, v) => s + (v - my) ** 2, 0) / n / 10)); }
  if (fam.nb) lsp = [0, ...lsp];
  const res = newton(model, lsp, bb => fam.gaussian ? Math.exp(bb.par[bb.par.length - 1]) : 1); res.warns.forEach(w => ctx.warn(w));
  const f = res.b.f, beta = f.beta, scale = fam.gaussian ? f.dev / (n - sum(mm(f.Ai, xtwx(X)).map((r, i) => r[i]))) : 1; // mgcv's scale.est = RSS / (n - tr(F))
  // gam.fit3.post.proc: Vp, edf, edf1, edf2 (smoothing-parameter-uncertainty corrected, Vb.corr)
  // extended families: Vp, edf and R use the Fisher weights mgcv stores in object$weights (dbeta/drho uses the exact Hessian)
  const wPost = fam.nb ? f.mu.map(m => m * f.th / (m + f.th)) : f.w, XtWX = xtwx(X, wPost), Ai = fam.nb ? (() => { const Ri = invUpper(cholUpper(L.add(XtWX, f.S))); return mm(Ri, tr(Ri)); })() : f.Ai, Vb = Ai.map(r => Array.from(r, v => v * scale)), F = mm(Ai, XtWX), FF = mm(F, F);
  const edf = F.map((r, i) => r[i]), edf1 = edf.map((v, i) => 2 * v - FF[i][i]);
  let edf2 = edf1.slice();
  if (smooths.length) {
    const lam = f.lam, Mc = nth + smooths.length, J = [];
    if (fam.nb) { const th = f.th; J.push(mv(f.Ai, L.tmulVec(X, yv.map((v, i) => (v - f.mu[i]) * f.mu[i] / ((f.mu[i] + th) ** 2) * th)))); }
    smooths.forEach((_, j) => J.push(Array.from(mv(f.Ai, model.Sb(j, beta)), v => -lam[j] * v)));
    const eh = L.eigenSym(res.hess), ev = eh.values, Vv = eh.vectors, P = zeros(Mc, Mc), Vr = zeros(Mc, Mc);
    for (let a = 0; a < Mc; a++) for (let c = 0; c < Mc; c++) { let s = 0, t = 0; ev.forEach((e, q) => { const pos = e > 0; if (pos) s += Vv[a][q] * Vv[c][q] / e; t += Vv[a][q] * Vv[c][q] / ((pos ? e : 0) + 0.1); }); P[a][c] = s; Vr[a][c] = t; }
    const Vc = Vb.map(r => Array.from(r));
    for (let a = 0; a < Mc; a++) for (let c = 0; c < Mc; c++) { const v = P[a][c]; for (let r = 0; r < p; r++) { const x = J[a][r] * v; for (let s = 0; s < p; s++) Vc[r][s] += x * J[c][s]; } }
    const Rc = cholUpper(L.add(XtWX, f.S));
    if (Rc) {
      const Rci = invUpper(Rc), dRi = [];
      for (let i = 0; i < Mc; i++) { if (i < nth) { dRi.push(null); continue; } const s = smooths[i - nth], dH = zeros(p, p); for (let a = 0; a < s.S.length; a++) for (let c = 0; c < s.S.length; c++) dH[s.start + a][s.start + c] = lam[i - nth] * s.S[a][c]; dRi.push(mm(mm(Rci, dchol(dH, Rc)), Rci)); }
      for (let a = nth; a < Mc; a++) for (let c = nth; c < Mc; c++) { const v = Vr[a][c] * scale, M2 = mm(dRi[a], tr(dRi[c])); for (let r = 0; r < p; r++) for (let s = 0; s < p; s++) Vc[r][s] += v * M2[r][s]; }
    }
    const VX = mm(Vc, XtWX); edf2 = VX.map((r, i) => r[i] / scale); if (sum(edf2) > sum(edf1)) edf2 = edf1.slice();
  }
  const resDf = n - sum(edf);
  // summary.gam: s.table via testStat on R (R'R = X'WX), p.table from Vp
  const Rfull = cholUpper(XtWX);
  const stab = smooths.map(s => { const ii = Array.from({ length: s.k }, (_, j) => s.start + j); s.edf = sum(ii.map(j => edf[j])); const ts = testStat(ii.map(j => beta[j]), Rfull.map(r => ii.map(j => r[j])), ii.map(a => ii.map(b => Vb[a][b])), Math.min(s.k, sum(ii.map(j => edf1[j]))), fam.gaussian ? resDf : -1); return [s.label, s.edf, ts.rank, fam.gaussian ? ts.stat / ts.rank : ts.stat, ts.pval]; });
  if (smooths.length) ctx.table('Smooth terms', ['Term', 'edf', 'Ref.df', fam.gaussian ? 'F' : 'Chi.sq', 'p-value'], stab);
  const pt = Array.from({ length: nsdf }, (_, j) => { const se = Math.sqrt(Vb[j][j]), t = beta[j] / se; return [beta[j], se, t, fam.gaussian ? 2 * D.pt(Math.abs(t), resDf, false) : 2 * D.pnorm(Math.abs(t), 0, 1, false)]; });
  const ptCols = fam.gaussian ? ['Estimate', 'Std. Error', 't value', 'Pr(>|t|)'] : ['Estimate', 'Std. Error', 'z value', 'Pr(>|z|)'];
  ctx.plot('Smooth effects', smoothPlot(smooths, beta, Vb, ctx));
  // logLik.gam / AIC / BIC
  const aic = (fam.gaussian ? n * (Math.log(2 * Math.PI * f.dev / n) + 1) + 2 : fam.aic(yv, f.mu, f.th)) + 2 * sum(edf), scP = fam.gaussian ? 1 : 0;
  const ll = sum(edf) + scP - aic / 2, df = Math.min(sum(edf2) + scP, p + scP) + nth;
  const kchk = smooths.map(s => { const rsd = yv.map((v, i) => fam.gaussian ? v - f.mu[i] : Math.sign(v - f.mu[i]) * Math.sqrt(Math.max(0, fam.dev(v, f.mu[i], f.th)))), o = s.x.map((_, i) => i).sort((a, b) => s.x[a] - s.x[b]); let dd = 0; for (let i = 1; i < o.length; i++) dd += (rsd[o[i]] - rsd[o[i - 1]]) ** 2; const mr = sum(rsd) / n, vr = rsd.reduce((t, v) => t + (v - mr) ** 2, 0) / (n - 1); return s.label.padEnd(10) + String(s.k).padStart(4) + fmtSig(s.edf, 4).padStart(9) + fmtSig(dd / (o.length - 1) / 2 / vr, 3).padStart(9); });
  const famLabel = fam.nb ? 'Negative Binomial(' + Math.round(f.th * 1000) / 1000 + ')' : fam.name;
  fitout(ctx, { kind: 'gam', n, coefTable: { rownames: PM.names, columns: ptCols, rows: pt }, crit: 'z', converged: true, logLik: ll, AIC: -2 * ll + 2 * df, BIC: -2 * ll + Math.log(n) * df,
    summaryText: () => ['', 'Family: ' + famLabel, 'Link function: ' + (fam.gaussian ? 'identity' : fam.name === 'binomial' ? 'logit' : 'log'), '', 'Parametric coefficients:', ...printCoefmat(PM.names, ptCols, pt), '', 'Approximate significance of smooth terms:', ...(smooths.length ? printCoefmat(stab.map(r => r[0]), ['edf', 'Ref.df', fam.gaussian ? 'F' : 'Chi.sq', 'p-value'], stab.map(r => r.slice(1))) : []), '', 'REML = ' + fmtSig(f.V, 5) + '  Scale est. = ' + fmtSig(scale, 5) + '  n = ' + n] });
  if (fam.name === 'binomial') need(!f.eta.every((e, i) => (e > 0) === (yv[i] === 1)), 'Perfect classification detected. Check separation before interpreting this binary model.');
  ctx.warn('not all required variables have been supplied in  newdata!\n');
  ctx.diag(['', 'Basis dimension (k) checking results (k-index; the randomisation p-value is not computed):', '', '             k\'      edf  k-index', ...kchk]);
}
function smoothPlot(smooths, beta, Vb, ctx) {
  if (!smooths.length) return svgPlot({ layers: [] });
  const cols = Math.min(smooths.length, 3), rows = Math.ceil(smooths.length / cols), W = Math.floor(648 / cols), H = Math.floor(396 / rows);
  const panels = smooths.map((s, idx) => {
    const lo = Math.min(...s.x), hi = Math.max(...s.x), gx = Array.from({ length: 100 }, (_, i) => lo + (hi - lo) * i / 99), P = s.predict(gx), ii = Array.from({ length: s.k }, (_, j) => s.start + j);
    const fit = P.map(r => r.reduce((t, v, j) => t + v * beta[ii[j]], 0)), se = P.map(r => { let t = 0; for (let a = 0; a < s.k; a++) for (let b = 0; b < s.k; b++) t += r[a] * Vb[ii[a]][ii[b]] * r[b]; return Math.sqrt(Math.max(t, 0)); });
    const up = fit.map((v, i) => v + 2 * se[i]), dn = fit.map((v, i) => v - 2 * se[i]);
    const svg = svgPlot({ xlab: s.v, ylab: 's(' + s.v + ',' + (Math.round(s.edf * 100) / 100) + ')', width: W, height: H, layers: [{ type: 'polygon', x: [...gx, ...gx.slice().reverse()], y: [...up, ...dn.slice().reverse()], fill: '#D6E8DD', alpha: 1 }, { type: 'line', x: gx, y: fit, color: ctx.accent }] });
    return '<g transform="translate(' + (idx % cols) * W + ',' + Math.floor(idx / cols) * H + ')">' + svg + '</g>';
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + cols * W + ' ' + rows * H + '" width="' + cols * W + '" height="' + rows * H + '">' + panels.join('') + '</svg>';
}
