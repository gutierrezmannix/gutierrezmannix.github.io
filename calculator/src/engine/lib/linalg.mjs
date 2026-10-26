// Dense linear algebra for the built-in engine. Matrices are arrays of row arrays (m[i][j]).
// qrR() reproduces R's LINPACK dqrdc2 (limited column pivoting, tol = 1e-7), so rank-deficient models drop the
// same columns as lm()/glm() and anova() effects match.

export const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
export const ident = n => { const m = zeros(n, n); for (let i = 0; i < n; i++) m[i][i] = 1; return m; };
export const t = A => { const r = A.length, c = r ? A[0].length : 0, o = zeros(c, r); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) o[j][i] = A[i][j]; return o; };
export function mul(A, B) { const n = A.length, m = B[0].length, k = B.length, o = zeros(n, m); for (let i = 0; i < n; i++) { const Ai = A[i], oi = o[i]; for (let l = 0; l < k; l++) { const a = Ai[l]; if (a === 0) continue; const Bl = B[l]; for (let j = 0; j < m; j++) oi[j] += a * Bl[j]; } } return o; }
export function mulVec(A, v) { return A.map(row => { let s = 0; for (let j = 0; j < v.length; j++) s += row[j] * v[j]; return s; }); }
export function tmulVec(A, v) { const c = A[0].length, o = new Array(c).fill(0); for (let i = 0; i < A.length; i++) { const vi = v[i]; if (vi === 0) continue; for (let j = 0; j < c; j++) o[j] += A[i][j] * vi; } return o; }
// t(X) %*% diag(w) %*% X
export function crossprod(X, w = null) { const n = X.length, p = n ? X[0].length : 0, o = zeros(p, p); for (let i = 0; i < n; i++) { const xi = X[i], wi = w ? w[i] : 1; if (wi === 0) continue; for (let a = 0; a < p; a++) { const va = xi[a] * wi; if (va === 0) continue; const oa = o[a]; for (let b = a; b < p; b++) oa[b] += va * xi[b]; } } for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) o[a][b] = o[b][a]; return o; }
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const sum = a => { let s = 0; for (const v of a) s += v; return s; };
export const mean = a => sum(a) / a.length;
export function variance(a) { const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return s / (a.length - 1); }
export const sd = a => Math.sqrt(variance(a));
export const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const scale = (A, k) => A.map(r => r.map(v => v * k));
export const diag = A => A.map((r, i) => r[i]);
export const diagM = v => { const m = zeros(v.length, v.length); v.forEach((x, i) => { m[i][i] = x; }); return m; };
export const sub = (A, rows, cols) => rows.map(i => cols.map(j => A[i][j]));
export const col = (A, j) => A.map(r => r[j]);
export const nrm2 = v => { let s = 0, sc = 0; for (const x of v) { const a = Math.abs(x); if (a > sc) { s = 1 + s * (sc / a) ** 2; sc = a; } else if (a > 0) s += (a / sc) ** 2; } return sc * Math.sqrt(s); };

// Cholesky: returns lower L with A = L L'; throws if not positive definite
export function chol(A) {
  const n = A.length, L = zeros(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; if (i === j) { if (!(s > 0)) throw new Error('Matrix is not positive definite.'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j]; }
  return L;
}
export function cholSolve(L, b) { const n = L.length, y = new Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; } const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; }
export function cholInv(A) { const L = chol(A), n = A.length, o = zeros(n, n); for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; const x = cholSolve(L, e); for (let i = 0; i < n; i++) o[i][j] = x[i]; } return o; }
// LU with partial pivoting
export function lu(A) { const n = A.length, a = A.map(r => r.slice()), piv = Array.from({ length: n }, (_, i) => i); let sign = 1; for (let k = 0; k < n; k++) { let p = k, m = Math.abs(a[k][k]); for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > m) { m = Math.abs(a[i][k]); p = i; } if (m === 0) return { a, piv, sign, singular: true }; if (p !== k) { [a[p], a[k]] = [a[k], a[p]]; [piv[p], piv[k]] = [piv[k], piv[p]]; sign = -sign; } for (let i = k + 1; i < n; i++) { const f = a[i][k] /= a[k][k]; if (f !== 0) for (let j = k + 1; j < n; j++) a[i][j] -= f * a[k][j]; } } return { a, piv, sign, singular: false }; }
export function luSolve(F, b) { const { a, piv } = F, n = a.length, x = piv.map(i => b[i]); for (let i = 0; i < n; i++) for (let k = 0; k < i; k++) x[i] -= a[i][k] * x[k]; for (let i = n - 1; i >= 0; i--) { for (let k = i + 1; k < n; k++) x[i] -= a[i][k] * x[k]; x[i] /= a[i][i]; } return x; }
export function solve(A, b) { const F = lu(A); if (F.singular) throw new Error('Singular matrix.'); if (Array.isArray(b[0])) { const B = t(b); return t(B.map(v => luSolve(F, v))); } return luSolve(F, b); }
export function inv(A) { const n = A.length; return solve(A, ident(n)); }
export function logdet(A) { const F = lu(A); if (F.singular) return -Infinity; let s = 0; for (let i = 0; i < A.length; i++) s += Math.log(Math.abs(F.a[i][i])); return s; }
export function det(A) { const F = lu(A); if (F.singular) return 0; let d = F.sign; for (let i = 0; i < A.length; i++) d *= F.a[i][i]; return d; }
// Moore–Penrose generalized inverse of a symmetric PSD matrix (via eigen), tolerance as MASS::ginv
export function ginvSym(A, tol = Math.sqrt(2.220446049250313e-16)) { const { values, vectors } = eigenSym(A), n = A.length, o = zeros(n, n), mx = Math.max(...values.map(Math.abs)); for (let k = 0; k < n; k++) { if (values[k] > tol * mx) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o[i][j] += vectors[i][k] * vectors[j][k] / values[k]; } return o; }

// ---------- R's dqrdc2 ----------
// X: n×p (rows). Returns { qr (n×p, column-major work as rows), qraux, pivot (0-based original column), rank }.
export function qrR(X, tol = 1e-7) {
  const n = X.length, p = n ? X[0].length : 0, x = Array.from({ length: p }, (_, j) => Float64Array.from(X, r => r[j])); // columns
  const qraux = new Float64Array(p), work0 = new Float64Array(p), work1 = new Float64Array(p), jpvt = Array.from({ length: p }, (_, j) => j);
  for (let j = 0; j < p; j++) { qraux[j] = nrm2(x[j]); work0[j] = qraux[j]; work1[j] = qraux[j] === 0 ? 1 : qraux[j]; }
  const lup = Math.min(n, p); let k = p + 1; // 1-based semantics for k
  for (let l = 0; l < lup; l++) {
    while (l + 1 < k && qraux[l] < work1[l] * tol) {
      // move column l to the end
      const cl = x[l], i0 = jpvt[l], t0 = qraux[l], tt = work0[l], ttt = work1[l];
      for (let j = l + 1; j < p; j++) { x[j - 1] = x[j]; jpvt[j - 1] = jpvt[j]; qraux[j - 1] = qraux[j]; work0[j - 1] = work0[j]; work1[j - 1] = work1[j]; }
      x[p - 1] = cl; jpvt[p - 1] = i0; qraux[p - 1] = t0; work0[p - 1] = tt; work1[p - 1] = ttt; k--;
    }
    if (l === n - 1) break;
    const xl = x[l]; let s = 0, sc = 0; for (let i = l; i < n; i++) { const a = Math.abs(xl[i]); if (a > sc) { s = 1 + s * (sc / a) ** 2; sc = a; } else if (a > 0) s += (a / sc) ** 2; }
    let nrmxl = sc * Math.sqrt(s); if (nrmxl === 0) continue;
    if (xl[l] !== 0) nrmxl = Math.sign(xl[l]) * Math.abs(nrmxl);
    for (let i = l; i < n; i++) xl[i] /= nrmxl; xl[l] = 1 + xl[l];
    for (let j = l + 1; j < p; j++) {
      const xj = x[j]; let d = 0; for (let i = l; i < n; i++) d += xl[i] * xj[i]; const tv = -d / xl[l]; for (let i = l; i < n; i++) xj[i] += tv * xl[i];
      if (qraux[j] !== 0) {
        let tt = 1 - (Math.abs(xj[l]) / qraux[j]) ** 2; tt = Math.max(tt, 0);
        if (Math.abs(tt) < 1e-6) { let s2 = 0, sc2 = 0; for (let i = l + 1; i < n; i++) { const a = Math.abs(xj[i]); if (a > sc2) { s2 = 1 + s2 * (sc2 / a) ** 2; sc2 = a; } else if (a > 0) s2 += (a / sc2) ** 2; } qraux[j] = sc2 * Math.sqrt(s2); work0[j] = qraux[j]; }
        else qraux[j] = qraux[j] * Math.sqrt(tt);
      }
    }
    qraux[l] = xl[l]; xl[l] = -nrmxl;
  }
  const rank = Math.min(k - 1, n);
  return { cols: x, qraux, pivot: jpvt, rank, n, p };
}
// Q'y for a qrR decomposition (dqrsl)
export function qrQty(Q, y) {
  const { cols, qraux, n } = Q, k = Math.min(Q.rank, n - 1), out = Float64Array.from(y);
  for (let j = 0; j < k; j++) { if (qraux[j] === 0) continue; const xj = cols[j], temp = xj[j]; xj[j] = qraux[j]; let d = 0; for (let i = j; i < n; i++) d += xj[i] * out[i]; const tv = -d / xj[j]; for (let i = j; i < n; i++) out[i] += tv * xj[i]; xj[j] = temp; }
  return out;
}
export function qrQy(Q, y) {
  const { cols, qraux, n } = Q, k = Math.min(Q.rank, n - 1), out = Float64Array.from(y);
  for (let j = k - 1; j >= 0; j--) { if (qraux[j] === 0) continue; const xj = cols[j], temp = xj[j]; xj[j] = qraux[j]; let d = 0; for (let i = j; i < n; i++) d += xj[i] * out[i]; const tv = -d / xj[j]; for (let i = j; i < n; i++) out[i] += tv * xj[i]; xj[j] = temp; }
  return out;
}
// upper-triangular R (rank × rank) in pivoted order
export function qrRmat(Q) { const r = Q.rank, R = zeros(r, r); for (let i = 0; i < r; i++) for (let j = i; j < r; j++) R[i][j] = Q.cols[j][i]; return R; }
export function backsolve(R, b) { const n = R.length, x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= R[i][k] * x[k]; x[i] = s / R[i][i]; } return x; }
// (R'R)^{-1} for upper-triangular R (chol2inv)
export function chol2inv(R) { const n = R.length, Ri = zeros(n, n); for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; const x = backsolve(R, e); for (let i = 0; i < n; i++) Ri[i][j] = x[i]; } return mul(Ri, t(Ri)); }
// least squares like lm.fit / Cdqrls: coefficients in original column order (NaN for aliased)
export function lsfit(X, y, w = null, tol = 1e-7) {
  const n = X.length, p = n ? X[0].length : 0, sw = w ? w.map(Math.sqrt) : null;
  const Xw = sw ? X.map((r, i) => r.map(v => v * sw[i])) : X, yw = sw ? y.map((v, i) => v * sw[i]) : y;
  const Q = qrR(Xw, tol), eff = qrQty(Q, yw), r = Q.rank, R = qrRmat(Q), b = backsolve(R, Array.from(eff.slice(0, r)));
  const coef = new Array(p).fill(NaN); for (let i = 0; i < r; i++) coef[Q.pivot[i]] = b[i];
  const fitted = X.map(row => { let s = 0; for (let j = 0; j < p; j++) if (!Number.isNaN(coef[j])) s += row[j] * coef[j]; return s; });
  const resid = y.map((v, i) => v - fitted[i]);
  return { coef, fitted, resid, qr: Q, effects: Array.from(eff), rank: r, R, pivot: Q.pivot, dfResidual: n - r };
}
// unscaled covariance (X'WX)^{-1} on non-aliased columns, mapped to original order (NaN rows/cols for aliased)
export function covUnscaled(fit) { const p = fit.coef.length, r = fit.rank, V = chol2inv(fit.R), o = Array.from({ length: p }, () => new Array(p).fill(NaN)); for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) o[fit.pivot[i]][fit.pivot[j]] = V[i][j]; return o; }

// ---------- symmetric eigen (cyclic Jacobi; values decreasing like R's eigen) ----------
export function eigenSym(A) {
  const n = A.length, a = A.map(r => Float64Array.from(r)), v = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p][q]; if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * apq), tt = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
      for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { values: idx.map(i => a[i][i]), vectors: Array.from({ length: n }, (_, r) => idx.map(i => v[r][i])) };
}
// thin SVD by one-sided Jacobi: X (n×p, n >= p) = U diag(d) V'
export function svd(X) {
  const n = X.length, p = X[0].length; if (n < p) { const s = svd(t(X)); return { d: s.d, u: s.v, v: s.u }; }
  const U = X.map(r => Float64Array.from(r)), V = Array.from({ length: p }, (_, i) => { const r = new Float64Array(p); r[i] = 1; return r; });
  for (let sweep = 0; sweep < 100; sweep++) {
    let rot = 0;
    for (let i = 0; i < p - 1; i++) for (let j = i + 1; j < p; j++) {
      let alpha = 0, beta = 0, gamma = 0; for (let k = 0; k < n; k++) { alpha += U[k][i] * U[k][i]; beta += U[k][j] * U[k][j]; gamma += U[k][i] * U[k][j]; }
      if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue; rot++;
      const zeta = (beta - alpha) / (2 * gamma), tt = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)), c = 1 / Math.sqrt(1 + tt * tt), s = c * tt;
      for (let k = 0; k < n; k++) { const a = U[k][i], b = U[k][j]; U[k][i] = c * a - s * b; U[k][j] = s * a + c * b; }
      for (let k = 0; k < p; k++) { const a = V[k][i], b = V[k][j]; V[k][i] = c * a - s * b; V[k][j] = s * a + c * b; }
    }
    if (!rot) break;
  }
  const d = Array.from({ length: p }, (_, j) => { let s = 0; for (let k = 0; k < n; k++) s += U[k][j] * U[k][j]; return Math.sqrt(s); });
  const idx = d.map((_, i) => i).sort((a, b) => d[b] - d[a]);
  return { d: idx.map(i => d[i]), u: U.map(r => idx.map(i => d[i] > 0 ? r[i] / d[i] : 0)), v: V.map(r => idx.map(i => r[i])) };
}
