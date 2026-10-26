// Clustering ports for the predictive family: stats::kmeans (AS 136 Hartigan–Wong, kmns.f), stats::hclust
// (Murtagh's hclust.f + hcass2), stats::cutree (hclust-utils.c), dist() and scale(). Matrices are row arrays.
import { fmtR } from './frame.mjs';

// exactly rounded sum (Shewchuk / Python fsum): stands in for R's long-double accumulation in sum()/colMeans()
export function fsum(a) {
  const p = [];
  for (let x of a) { let i = 0; for (let y of p) { if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x]; const hi = x + y, lo = y - (hi - x); if (lo) p[i++] = lo; x = hi; } p.length = i; p.push(x); }
  let n = p.length, hi = 0;
  if (n > 0) { hi = p[--n]; while (n > 0) { const x = hi, y = p[--n]; hi = x + y; const lo = y - (hi - x); if (lo) { if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) { const y2 = lo * 2, x2 = hi + y2; if (y2 === x2 - hi) hi = x2; } break; } } }
  return hi;
}
// scale(z, center=TRUE, scale=TRUE)
export function scaleCols(z) {
  const n = z.length, p = z[0].length, out = z.map(r => r.slice());
  for (let j = 0; j < p; j++) {
    const c = fsum(z.map(r => r[j])) / n; for (let i = 0; i < n; i++) out[i][j] = z[i][j] - c;
    const s = Math.sqrt(fsum(out.map(r => r[j] * r[j])) / Math.max(1, n - 1)); for (let i = 0; i < n; i++) out[i][j] /= s;
  }
  return out;
}

const BIG = Math.fround(1e30); // DATA BIG /1.E30/ (a REAL constant)
// AS 136. A: m×n rows, C: k×n initial centres (modified). Returns { c1 (1-based), centers, wss, nc, iter, ifault }
function kmns(A, C, iterMax) {
  const M = A.length, N = A[0].length, K = C.length;
  const IC1 = new Int32Array(M + 1), IC2 = new Int32Array(M + 1), NC = new Int32Array(K + 1), NCP = new Int32Array(K + 1), ITRAN = new Int32Array(K + 1), LIVE = new Int32Array(K + 1);
  const AN1 = new Float64Array(K + 1), AN2 = new Float64Array(K + 1), D = new Float64Array(M + 1), WSS = new Float64Array(K + 1);
  const a = (i, j) => A[i - 1][j - 1], c = C.map(r => Float64Array.from(r)), cc = (l, j) => c[l - 1][j - 1], cset = (l, j, v) => { c[l - 1][j - 1] = v; };
  let iMaxQtr = Math.min(2147483647, 50 * M), ifault = 0, INDX = 0, IJ;
  for (let I = 1; I <= M; I++) {
    IC1[I] = 1; IC2[I] = 2; const DT = [0, 0];
    for (let IL = 1; IL <= 2; IL++) { let s = 0; for (let J = 1; J <= N; J++) { const da = a(I, J) - cc(IL, J); s += da * da; } DT[IL - 1] = s; }
    if (DT[0] > DT[1]) { IC1[I] = 2; IC2[I] = 1; const t = DT[0]; DT[0] = DT[1]; DT[1] = t; }
    L50: for (let L = 3; L <= K; L++) {
      let DB = 0; for (let J = 1; J <= N; J++) { const dc = a(I, J) - cc(L, J); DB += dc * dc; if (DB >= DT[1]) continue L50; }
      if (DB >= DT[0]) { DT[1] = DB; IC2[I] = L; } else { DT[1] = DT[0]; IC2[I] = IC1[I]; DT[0] = DB; IC1[I] = L; }
    }
  }
  for (let L = 1; L <= K; L++) { NC[L] = 0; for (let J = 1; J <= N; J++) cset(L, J, 0); }
  for (let I = 1; I <= M; I++) { const L = IC1[I]; NC[L]++; for (let J = 1; J <= N; J++) cset(L, J, cc(L, J) + a(I, J)); }
  for (let L = 1; L <= K; L++) {
    if (NC[L] === 0) return { ifault: 1 };
    const AA = NC[L]; for (let J = 1; J <= N; J++) cset(L, J, cc(L, J) / AA);
    AN2[L] = AA / (AA + 1); AN1[L] = BIG; if (AA > 1) AN1[L] = AA / (AA - 1); ITRAN[L] = 1; NCP[L] = -1;
  }
  const transfer = (I, L1, L2) => {
    const AL1 = NC[L1], ALW = AL1 - 1, AL2 = NC[L2], ALT = AL2 + 1;
    for (let J = 1; J <= N; J++) { cset(L1, J, (cc(L1, J) * AL1 - a(I, J)) / ALW); cset(L2, J, (cc(L2, J) * AL2 + a(I, J)) / ALT); }
    NC[L1]--; NC[L2]++; AN2[L1] = ALW / AL1; AN1[L1] = BIG; if (ALW > 1) AN1[L1] = ALW / (ALW - 1); AN1[L2] = ALT / AL2; AN2[L2] = ALT / (ALT + 1); IC1[I] = L2; IC2[I] = L1;
  };
  const optra = () => {
    for (let L = 1; L <= K; L++) if (ITRAN[L] === 1) LIVE[L] = M + 1;
    for (let I = 1; I <= M; I++) {
      INDX++; const L1 = IC1[I]; let L2 = IC2[I]; const LL = L2;
      if (NC[L1] !== 1) {
        if (NCP[L1] !== 0) { let DE = 0; for (let J = 1; J <= N; J++) { const df = a(I, J) - cc(L1, J); DE += df * df; } D[I] = DE * AN1[L1]; }
        let DA = 0; for (let J = 1; J <= N; J++) { const db = a(I, J) - cc(L2, J); DA += db * db; }
        let R2 = DA * AN2[L2];
        L60: for (let L = 1; L <= K; L++) {
          if ((I >= LIVE[L1] && I >= LIVE[L]) || L === L1 || L === LL) continue;
          const RR = R2 / AN2[L]; let DC = 0;
          for (let J = 1; J <= N; J++) { const dd = a(I, J) - cc(L, J); DC += dd * dd; if (DC >= RR) continue L60; }
          R2 = DC * AN2[L]; L2 = L;
        }
        if (R2 >= D[I]) IC2[I] = L2;
        else { INDX = 0; LIVE[L1] = M + I; LIVE[L2] = M + I; NCP[L1] = I; NCP[L2] = I; transfer(I, L1, L2); }
      }
      if (INDX === M) return;
    }
    for (let L = 1; L <= K; L++) { ITRAN[L] = 0; LIVE[L] -= M; }
  };
  const qtran = () => {
    let ICOUN = 0, ISTEP = 0;
    for (;;) for (let I = 1; I <= M; I++) {
      ICOUN++; ISTEP++;
      if (ISTEP >= iMaxQtr) { iMaxQtr = -1; return; }
      const L1 = IC1[I], L2 = IC2[I];
      if (NC[L1] !== 1) {
        if (ISTEP <= NCP[L1]) { let DA = 0; for (let J = 1; J <= N; J++) { const db = a(I, J) - cc(L1, J); DA += db * db; } D[I] = DA * AN1[L1]; }
        if (ISTEP < NCP[L1] || ISTEP < NCP[L2]) {
          const R2 = D[I] / AN2[L2]; let DD = 0, skip = false;
          for (let J = 1; J <= N; J++) { const de = a(I, J) - cc(L2, J); DD += de * de; if (DD >= R2) { skip = true; break; } }
          if (!skip) { ICOUN = 0; INDX = 0; ITRAN[L1] = 1; ITRAN[L2] = 1; NCP[L1] = ISTEP + M; NCP[L2] = ISTEP + M; transfer(I, L1, L2); }
        }
      }
      if (ICOUN === M) return;
    }
  };
  let done = false;
  for (IJ = 1; IJ <= iterMax; IJ++) {
    optra(); if (INDX === M) { done = true; break; }
    qtran(); if (iMaxQtr < 0) { ifault = 4; done = true; break; }
    if (K === 2) { done = true; break; }
    for (let L = 1; L <= K; L++) NCP[L] = 0;
  }
  if (!done) ifault = 2;
  for (let L = 1; L <= K; L++) { WSS[L] = 0; for (let J = 1; J <= N; J++) cset(L, J, 0); }
  for (let I = 1; I <= M; I++) { const II = IC1[I]; for (let J = 1; J <= N; J++) cset(II, J, cc(II, J) + a(I, J)); }
  for (let J = 1; J <= N; J++) {
    for (let L = 1; L <= K; L++) cset(L, J, cc(L, J) / NC[L]);
    for (let I = 1; I <= M; I++) { const II = IC1[I], da = a(I, J) - cc(II, J); WSS[II] += da * da; }
  }
  return { ifault, iter: IJ, c1: Array.from(IC1.slice(1)), centers: c.map(r => Array.from(r)), wss: Array.from(WSS.slice(1)), nc: Array.from(NC.slice(1)) };
}

// kmeans(x, k, nstart) with algorithm = "Hartigan-Wong", iter.max = 10; rng: RRNG already seeded
export function kmeans(x, k, nstart, rng, warn = () => {}, iterMax = 10) {
  const m = x.length, seen = new Set(), cn = [];
  for (const r of x) { const key = r.map(fmtR).join('\r'); if (!seen.has(key)) { seen.add(key); cn.push(r); } }
  let centers;
  if (nstart === 1) centers = rng.sampleInt(m, k).map(i => x[i - 1]);
  if (nstart >= 2 || new Set(centers.map(r => r.map(fmtR).join('\r'))).size < k) {
    if (cn.length < k) throw new Error('more cluster centers than distinct data points.');
    centers = rng.sampleInt(cn.length, k).map(i => cn[i - 1]);
  }
  const doOne = cen => {
    const Z = kmns(x, cen, iterMax);
    if (Z.ifault === 1) throw new Error('empty cluster: try a better set of initial centers');
    if (Z.ifault === 2) Z.iter = Math.max(Z.iter, iterMax + 1);
    if (Z.ifault === 4) warn('Quick-TRANSfer stage steps exceeded maximum (= ' + Math.min(2147483647, 50 * m) + ')');
    if (Z.iter > iterMax) warn('did not converge in ' + iterMax + ' iteration' + (iterMax === 1 ? '' : 's'));
    return Z;
  };
  let Z = doOne(centers), best = fsum(Z.wss);
  for (let i = 2; i <= nstart; i++) { const ZZ = doOne(rng.sampleInt(cn.length, k).map(j => cn[j - 1])), z = fsum(ZZ.wss); if (z < best) { Z = ZZ; best = z; } }
  const p = x[0].length, cm = Array.from({ length: p }, (_, j) => fsum(x.map(r => r[j])) / m);
  const totss = fsum(x.flatMap(r => r.map((v, j) => (v - cm[j]) ** 2)));
  return { cluster: Z.c1, centers: Z.centers, totss, withinss: Z.wss, totWithinss: best, betweenss: totss - best, size: Z.nc, iter: Z.iter, ifault: Z.ifault };
}

// dist(x) (euclidean) in R's lower-triangle order: d[(i,j)], i<j
export function distEuclid(x) {
  const n = x.length, p = x[0].length, d = new Float64Array(n * (n - 1) / 2); let k = 0;
  for (let j = 0; j < n; j++) for (let i = j + 1; i < n; i++) { let s = 0; for (let c = 0; c < p; c++) { const dev = x[i][c] - x[j][c]; s += dev * dev; } d[k++] = Math.sqrt(s); }
  return d;
}
export const HCLUST_METHODS = ['ward.D', 'single', 'complete', 'average', 'mcquitty', 'median', 'centroid', 'ward.D2'];
// pmatch(method, METHODS): exact, else unique partial match; else -1 (NA)
export function hclustMethod(method) {
  if (method === 'ward') return 1;
  const ex = HCLUST_METHODS.indexOf(method); if (ex >= 0) return ex + 1;
  const part = HCLUST_METHODS.map((m, i) => m.startsWith(method) && method.length ? i : -1).filter(i => i >= 0);
  return part.length === 1 ? part[0] + 1 : -1;
}
// hclust(d, method): returns { merge: [[a,b]], height, order }
export function hclust(diss, n, iOpt) {
  const D = Float64Array.from(diss), INF = 1e300, IA = new Int32Array(n + 1), IB = new Int32Array(n + 1), CRIT = new Float64Array(n + 1), MEMBR = new Float64Array(n + 1).fill(1), NN = new Int32Array(n + 1), DISNN = new Float64Array(n + 1), FLAG = new Uint8Array(n + 1).fill(1);
  const off = (i, j) => j + (i - 1) * n - (i * (i + 1)) / 2 - 1; // IOFFST, 0-based storage
  if (iOpt === 8) for (let i = 0; i < D.length; i++) D[i] *= D[i];
  let IM = 0, JJ = 0, JM = 0, NCL = n;
  for (let I = 1; I <= n - 1; I++) { let DMIN = INF; for (let J = I + 1; J <= n; J++) { const v = D[off(I, J)]; if (DMIN > v) { DMIN = v; JM = J; } } NN[I] = JM; DISNN[I] = DMIN; }
  const isWard = iOpt === 1 || iOpt === 8;
  while (NCL > 1) {
    let DMIN = INF;
    for (let I = 1; I <= n - 1; I++) if (FLAG[I] && DISNN[I] < DMIN) { DMIN = DISNN[I]; IM = I; JM = NN[I]; }
    NCL--;
    const I2 = Math.min(IM, JM), J2 = Math.max(IM, JM);
    IA[n - NCL] = I2; IB[n - NCL] = J2;
    if (iOpt === 8) DMIN = Math.sqrt(DMIN);
    CRIT[n - NCL] = DMIN; FLAG[J2] = 0;
    DMIN = INF;
    for (let K = 1; K <= n; K++) {
      if (!FLAG[K] || K === I2) continue;
      const IND1 = I2 < K ? off(I2, K) : off(K, I2), IND2 = J2 < K ? off(J2, K) : off(K, J2), D12 = D[off(I2, J2)];
      if (isWard) { D[IND1] = (MEMBR[I2] + MEMBR[K]) * D[IND1] + (MEMBR[J2] + MEMBR[K]) * D[IND2] - MEMBR[K] * D12; D[IND1] = D[IND1] / (MEMBR[I2] + MEMBR[J2] + MEMBR[K]); }
      else if (iOpt === 2) D[IND1] = Math.min(D[IND1], D[IND2]);
      else if (iOpt === 3) D[IND1] = Math.max(D[IND1], D[IND2]);
      else if (iOpt === 4) D[IND1] = (MEMBR[I2] * D[IND1] + MEMBR[J2] * D[IND2]) / (MEMBR[I2] + MEMBR[J2]);
      else if (iOpt === 5) D[IND1] = (D[IND1] + D[IND2]) / 2;
      else if (iOpt === 6) D[IND1] = ((D[IND1] + D[IND2]) - D12 / 2) / 2;
      else if (iOpt === 7) D[IND1] = (MEMBR[I2] * D[IND1] + MEMBR[J2] * D[IND2] - MEMBR[I2] * MEMBR[J2] * D12 / (MEMBR[I2] + MEMBR[J2])) / (MEMBR[I2] + MEMBR[J2]);
      if (I2 < K) { if (D[IND1] < DMIN) { DMIN = D[IND1]; JJ = K; } }
      else if (D[IND1] < DISNN[K]) { DISNN[K] = D[IND1]; NN[K] = I2; }
    }
    MEMBR[I2] += MEMBR[J2]; DISNN[I2] = DMIN; NN[I2] = JJ;
    for (let I = 1; I <= n - 1; I++) if (FLAG[I] && (NN[I] === I2 || NN[I] === J2)) {
      let dm = INF; for (let J = I + 1; J <= n; J++) if (FLAG[J]) { const v = D[off(I, J)]; if (v < dm) { dm = v; JJ = J; } }
      NN[I] = JJ; DISNN[I] = dm;
    }
  }
  // hcass2
  const IIA = Int32Array.from(IA), IIB = Int32Array.from(IB);
  for (let I = 1; I <= n - 2; I++) { const K = Math.min(IA[I], IB[I]); for (let J = I + 1; J <= n - 1; J++) { if (IA[J] === K) IIA[J] = -I; if (IB[J] === K) IIB[J] = -I; } }
  for (let I = 1; I <= n - 1; I++) { IIA[I] = -IIA[I]; IIB[I] = -IIB[I]; }
  for (let I = 1; I <= n - 1; I++) {
    if (IIA[I] > 0 && IIB[I] < 0) { const K = IIA[I]; IIA[I] = IIB[I]; IIB[I] = K; }
    if (IIA[I] > 0 && IIB[I] > 0) { const K1 = Math.min(IIA[I], IIB[I]), K2 = Math.max(IIA[I], IIB[I]); IIA[I] = K1; IIB[I] = K2; }
  }
  const IORDER = new Int32Array(n + 2); IORDER[1] = IIA[n - 1]; IORDER[2] = IIB[n - 1]; let LOC = 2;
  for (let I = n - 2; I >= 1; I--) for (let J = 1; J <= LOC; J++) if (IORDER[J] === I) {
    IORDER[J] = IIA[I];
    if (J === LOC) { LOC++; IORDER[LOC] = IIB[I]; } else { LOC++; for (let K = LOC; K >= J + 2; K--) IORDER[K] = IORDER[K - 1]; IORDER[J + 1] = IIB[I]; }
    break;
  }
  const merge = [], height = [], order = [];
  for (let i = 1; i <= n - 1; i++) { merge.push([IIA[i], IIB[i]]); height.push(CRIT[i]); }
  for (let i = 1; i <= n; i++) order.push(-IORDER[i]);
  return { merge, height, order };
}
// cutree(tree, k) → 1-based cluster ids in R's numbering (order of first appearance)
export function cutree(merge, k) {
  const n = merge.length + 1, sing = new Uint8Array(n + 1).fill(1), mnr = new Int32Array(n + 1), z = new Int32Array(n + 1), ans = new Array(n);
  if (k === n) return Array.from({ length: n }, (_, i) => i + 1);
  for (let kk = 1; kk <= n - 1; kk++) {
    let [m1, m2] = merge[kk - 1];
    if (m1 < 0 && m2 < 0) { mnr[-m1] = mnr[-m2] = kk; sing[-m1] = sing[-m2] = 0; }
    else if (m1 < 0 || m2 < 0) { let j; if (m1 < 0) { j = -m1; m1 = m2; } else j = -m2; for (let l = 1; l <= n; l++) if (mnr[l] === m1) mnr[l] = kk; mnr[j] = kk; sing[j] = 0; }
    else for (let l = 1; l <= n; l++) if (mnr[l] === m1 || mnr[l] === m2) mnr[l] = kk;
    if (k === n - kk) {
      z.fill(0); let nclust = 0;
      for (let l = 1; l <= n; l++) { if (sing[l]) ans[l - 1] = ++nclust; else { if (z[mnr[l]] === 0) z[mnr[l]] = ++nclust; ans[l - 1] = z[mnr[l]]; } }
    }
  }
  return ans;
}
