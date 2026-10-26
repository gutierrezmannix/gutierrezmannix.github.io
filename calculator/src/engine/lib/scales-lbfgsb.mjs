// optim(method = "L-BFGS-B") — a line-by-line port of R 4.3's src/appl/lbfgsb.c (L-BFGS-B 3.0, Zhu, Byrd, Lu,
// Nocedal; Morales & Nocedal 2011 update) and its driver lbfgsb() in src/appl/optim.c, with optim()'s
// parscale/fnscale handling. psych::fa's minres and ML fits stop at optim's default tolerances (factr = 1e7),
// so matching psych to ~1e-8 needs the same iterates, not just the same optimum.
// Conventions: vectors are 1-based (index 0 unused); a "pointer" into a vector is (array, base) with element k at
// array[base + k - 1]; matrices are 0-based column-major with the C code's leading dimensions.
const EPSMCH = 2.220446049250313e-16;

function dpofa(A, b0, lda, n) { // LINPACK dpofa: upper Cholesky in place; returns info
  const a = (i, j) => b0 + (i - 1) + (j - 1) * lda;
  for (let j = 1; j <= n; j++) {
    let s = 0;
    for (let k = 1; k <= j - 1; k++) { let t = A[a(k, j)]; for (let i = 1; i <= k - 1; i++) t -= A[a(i, k)] * A[a(i, j)]; t /= A[a(k, k)]; A[a(k, j)] = t; s += t * t; }
    s = A[a(j, j)] - s; if (s <= 0) return j; A[a(j, j)] = Math.sqrt(s);
  }
  return 0;
}
function dtrsl(T, t0, ldt, n, B, b0, job) { // LINPACK dtrsl
  const t = (i, j) => T[t0 + (i - 1) + (j - 1) * ldt], b = i => b0 + i - 1;
  for (let k = 1; k <= n; k++) if (t(k, k) === 0) return k;
  let kase = job % 10 === 0 ? 1 : 2; if (Math.floor((job % 100) / 10) !== 0) kase += 2;
  if (kase === 1) { B[b(1)] /= t(1, 1); for (let j = 2; j <= n; j++) { const temp = -B[b(j - 1)]; for (let i = j; i <= n; i++) B[b(i)] += temp * t(i, j - 1); B[b(j)] /= t(j, j); } }
  else if (kase === 2) { B[b(n)] /= t(n, n); for (let jj = 2; jj <= n; jj++) { const j = n - jj + 1, temp = -B[b(j + 1)]; for (let i = 1; i <= j; i++) B[b(i)] += temp * t(i, j + 1); B[b(j)] /= t(j, j); } }
  else if (kase === 3) { B[b(n)] /= t(n, n); for (let jj = 2; jj <= n; jj++) { const j = n - jj + 1; let s = 0; for (let i = 1; i <= jj - 1; i++) s += t(j + i, j) * B[b(j + i)]; B[b(j)] -= s; B[b(j)] /= t(j, j); } }
  else { B[b(1)] /= t(1, 1); for (let j = 2; j <= n; j++) { let s = 0; for (let i = 1; i <= j - 1; i++) s += t(i, j) * B[b(i)]; B[b(j)] -= s; B[b(j)] /= t(j, j); } }
  return 0;
}

function active(n, l, u, nbd, x, iwhere, S) {
  S.prjctd = false; S.cnstnd = false; S.boxed = true;
  for (let i = 1; i <= n; i++) if (nbd[i] > 0) { if (nbd[i] <= 2 && x[i] <= l[i]) { if (x[i] < l[i]) { S.prjctd = true; x[i] = l[i]; } } else if (nbd[i] >= 2 && x[i] >= u[i]) { if (x[i] > u[i]) { S.prjctd = true; x[i] = u[i]; } } }
  for (let i = 1; i <= n; i++) { if (nbd[i] !== 2) S.boxed = false; if (nbd[i] === 0) iwhere[i] = -1; else { S.cnstnd = true; iwhere[i] = nbd[i] === 2 && u[i] - l[i] <= 0 ? 3 : 0; } }
}
function bmv(m, sy, wt, col, V, vb, P, pb) {
  if (col === 0) return 0;
  const SY = (i, j) => sy[(i - 1) + (j - 1) * m], v = k => V[vb + k - 1];
  P[pb + col] = v(col + 1);
  for (let i = 2; i <= col; i++) { const i2 = col + i; let sum = 0; for (let k = 1; k <= i - 1; k++) sum += SY(i, k) * v(k) / SY(k, k); P[pb + i2 - 1] = v(i2) + sum; }
  let info = dtrsl(wt, 0, m, col, P, pb + col, 11); if (info !== 0) return info;
  for (let i = 1; i <= col; i++) P[pb + i - 1] = v(i) / Math.sqrt(SY(i, i));
  info = dtrsl(wt, 0, m, col, P, pb + col, 1); if (info !== 0) return info;
  for (let i = 1; i <= col; i++) P[pb + i - 1] = -P[pb + i - 1] / Math.sqrt(SY(i, i));
  for (let i = 1; i <= col; i++) { let sum = 0; for (let k = i + 1; k <= col; k++) sum += SY(k, i) * P[pb + col + k - 1] / SY(i, i); P[pb + i - 1] += sum; }
  return 0;
}
function hpsolb(n, t, tb, iorder, ib, iheap) {
  const T = i => tb + i - 1, I = i => ib + i - 1;
  if (iheap === 0) for (let k = 2; k <= n; k++) { const ddum = t[T(k)], indxin = iorder[I(k)]; let i = k; while (i > 1) { const j = Math.floor(i / 2); if (ddum < t[T(j)]) { t[T(i)] = t[T(j)]; iorder[I(i)] = iorder[I(j)]; i = j; } else break; } t[T(i)] = ddum; iorder[I(i)] = indxin; }
  if (n > 1) {
    let i = 1; const out = t[T(1)], indxou = iorder[I(1)], ddum = t[T(n)], indxin = iorder[I(n)];
    for (;;) { let j = i + i; if (j <= n - 1) { if (t[T(j + 1)] < t[T(j)]) j++; if (t[T(j)] < ddum) { t[T(i)] = t[T(j)]; iorder[I(i)] = iorder[I(j)]; i = j; continue; } } break; }
    t[T(i)] = ddum; iorder[I(i)] = indxin; t[T(n)] = out; iorder[I(n)] = indxou;
  }
}
function cauchy(n, x, l, u, nbd, g, iorder, iwhere, t, d, xcp, m, wy, ws, sy, wt, S, wa, pB, cB, wbpB, vB) {
  const { theta, col, head } = S, WY = (i, j) => wy[(i - 1) + (j - 1) * n], WS = (i, j) => ws[(i - 1) + (j - 1) * n];
  const p = k => pB + k - 1, c = k => cB + k - 1, wbp = k => wbpB + k - 1, v = k => vB + k - 1;
  if (S.sbgnrm <= 0) { for (let i = 1; i <= n; i++) xcp[i] = x[i]; return 0; }
  let bnded = true, nfree = n + 1, nbreak = 0, ibkmin = 0, bkmin = 0, f1 = 0, tl = 0, tu = 0; const col2 = col << 1;
  for (let i = 1; i <= col2; i++) wa[p(i)] = 0;
  for (let i = 1; i <= n; i++) {
    const neggi = -g[i];
    if (iwhere[i] !== 3 && iwhere[i] !== -1) {
      if (nbd[i] <= 2) tl = x[i] - l[i]; if (nbd[i] >= 2) tu = u[i] - x[i];
      const xlower = nbd[i] <= 2 && tl <= 0, xupper = nbd[i] >= 2 && tu <= 0; iwhere[i] = 0;
      if (xlower) { if (neggi <= 0) iwhere[i] = 1; } else if (xupper) { if (neggi >= 0) iwhere[i] = 2; } else if (Math.abs(neggi) <= 0) iwhere[i] = -3;
    }
    let pointr = head;
    if (iwhere[i] !== 0 && iwhere[i] !== -1) d[i] = 0;
    else {
      d[i] = neggi; f1 -= neggi * neggi;
      for (let j = 1; j <= col; j++) { wa[p(j)] += WY(i, pointr) * neggi; wa[p(col + j)] += WS(i, pointr) * neggi; pointr = pointr % m + 1; }
      if (nbd[i] <= 2 && nbd[i] !== 0 && neggi < 0) { nbreak++; iorder[nbreak] = i; t[nbreak] = tl / (-neggi); if (nbreak === 1 || t[nbreak] < bkmin) { bkmin = t[nbreak]; ibkmin = nbreak; } }
      else if (nbd[i] >= 2 && neggi > 0) { nbreak++; iorder[nbreak] = i; t[nbreak] = tu / neggi; if (nbreak === 1 || t[nbreak] < bkmin) { bkmin = t[nbreak]; ibkmin = nbreak; } }
      else { nfree--; iorder[nfree] = i; if (Math.abs(neggi) > 0) bnded = false; }
    }
  }
  if (theta !== 1) for (let j = 1; j <= col; j++) wa[p(col + j)] *= theta;
  for (let i = 1; i <= n; i++) xcp[i] = x[i];
  if (nbreak === 0 && nfree === n + 1) return 0;
  for (let j = 1; j <= col2; j++) wa[c(j)] = 0;
  let f2 = -theta * f1; const f2org = f2;
  if (col > 0) { const info = bmv(m, sy, wt, col, wa, pB, wa, vB); if (info !== 0) return info; let s = 0; for (let j = 1; j <= col2; j++) s += wa[v(j)] * wa[p(j)]; f2 -= s; }
  let dtm = -f1 / f2, tsum = 0; S.nint = 1;
  let skipTo999 = false;
  if (nbreak !== 0) {
    let nleft = nbreak, iter = 1, tj = 0;
    for (;;) {
      const tj0 = tj; let ibp;
      if (iter === 1) { tj = bkmin; ibp = iorder[ibkmin]; }
      else { if (iter === 2 && ibkmin !== nbreak) { t[ibkmin] = t[nbreak]; iorder[ibkmin] = iorder[nbreak]; } hpsolb(nleft, t, 1, iorder, 1, iter - 2); tj = t[nleft]; ibp = iorder[nleft]; }
      const dt = tj - tj0;
      if (dtm < dt) break;
      tsum += dt; nleft--; iter++;
      const dibp = d[ibp]; d[ibp] = 0; let zibp;
      if (dibp > 0) { zibp = u[ibp] - x[ibp]; xcp[ibp] = u[ibp]; iwhere[ibp] = 2; } else { zibp = l[ibp] - x[ibp]; xcp[ibp] = l[ibp]; iwhere[ibp] = 1; }
      if (nleft === 0 && nbreak === n) { dtm = dt; skipTo999 = true; break; }
      S.nint++;
      const dibp2 = dibp * dibp; f1 += dt * f2 + dibp2 - theta * dibp * zibp; f2 -= theta * dibp2;
      if (col > 0) {
        for (let j = 1; j <= col2; j++) wa[c(j)] += dt * wa[p(j)];
        let pointr = head; for (let j = 1; j <= col; j++) { wa[wbp(j)] = WY(ibp, pointr); wa[wbp(col + j)] = theta * WS(ibp, pointr); pointr = pointr % m + 1; }
        const info = bmv(m, sy, wt, col, wa, wbpB, wa, vB); if (info !== 0) return info;
        let wmc = 0, wmp = 0, wmw = 0; for (let j = 1; j <= col2; j++) { wmc += wa[c(j)] * wa[v(j)]; wmp += wa[p(j)] * wa[v(j)]; wmw += wa[wbp(j)] * wa[v(j)]; }
        for (let j = 1; j <= col2; j++) wa[p(j)] += -dibp * wa[wbp(j)];
        f1 += dibp * wmc; f2 += 2 * dibp * wmp - dibp2 * wmw;
      }
      if (f2 < EPSMCH * f2org) f2 = EPSMCH * f2org;
      if (nleft > 0) { dtm = -f1 / f2; continue; }
      else if (bnded) { f1 = 0; f2 = 0; dtm = 0; } else dtm = -f1 / f2;
      break;
    }
  }
  if (!skipTo999) { if (dtm <= 0) dtm = 0; tsum += dtm; for (let i = 1; i <= n; i++) xcp[i] += tsum * d[i]; }
  if (col > 0) for (let j = 1; j <= col2; j++) wa[c(j)] += dtm * wa[p(j)];
  return 0;
}
function cmprlb(n, m, x, g, ws, wy, sy, wt, z, r, wa, indx, S) {
  const { theta, col, head, nfree, cnstnd } = S;
  if (!cnstnd && col > 0) { for (let i = 1; i <= n; i++) r[i] = -g[i]; return 0; }
  for (let i = 1; i <= nfree; i++) { const k = indx[i]; r[i] = -theta * (z[k] - x[k]) - g[k]; }
  const info = bmv(m, sy, wt, col, wa, 2 * m + 1, wa, 1); if (info !== 0) return -8;
  let pointr = head;
  for (let j = 1; j <= col; j++) { const a1 = wa[j], a2 = theta * wa[col + j]; for (let i = 1; i <= nfree; i++) { const k = indx[i]; r[i] += wy[(k - 1) + (pointr - 1) * n] * a1 + ws[(k - 1) + (pointr - 1) * n] * a2; } pointr = pointr % m + 1; }
  return 0;
}
function formk(n, nsub, ind, nenter, ileave, indx2, iupdat, updatd, wn, wn1, m, ws, wy, sy, theta, col, head) {
  const d2 = 2 * m, WN = (i, j) => (i - 1) + (j - 1) * d2, WY = (i, j) => wy[(i - 1) + (j - 1) * n], WS = (i, j) => ws[(i - 1) + (j - 1) * n], SY = (i, j) => sy[(i - 1) + (j - 1) * m];
  const copy = (len, src, dst) => { for (let q = 0; q < len; q++) wn1[dst + q] = wn1[src + q]; };
  let upcl;
  if (updatd) {
    if (iupdat > m) for (let jy = 1; jy <= m - 1; jy++) { const js = m + jy; copy(m - jy, WN(jy + 1, jy + 1), WN(jy, jy)); copy(m - jy, WN(js + 1, js + 1), WN(js, js)); copy(m - 1, WN(m + 2, jy + 1), WN(m + 1, jy)); }
    const pbegin = 1, pend = nsub, dbegin = nsub + 1, dend = n; let iy = col, is = m + col, ipntr = head + col - 1; if (ipntr > m) ipntr -= m;
    let jpntr = head;
    for (let jy = 1; jy <= col; jy++) {
      const js = m + jy; let t1 = 0, t2 = 0, t3 = 0;
      for (let k = pbegin; k <= pend; k++) { const k1 = ind[k]; t1 += WY(k1, ipntr) * WY(k1, jpntr); }
      for (let k = dbegin; k <= dend; k++) { const k1 = ind[k]; t2 += WS(k1, ipntr) * WS(k1, jpntr); t3 += WS(k1, ipntr) * WY(k1, jpntr); }
      wn1[WN(iy, jy)] = t1; wn1[WN(is, js)] = t2; wn1[WN(is, jy)] = t3; jpntr = jpntr % m + 1;
    }
    const jy = col; jpntr = head + col - 1; if (jpntr > m) jpntr -= m; ipntr = head;
    for (let i = 1; i <= col; i++) { is = m + i; let t3 = 0; for (let k = pbegin; k <= pend; k++) { const k1 = ind[k]; t3 += WS(k1, ipntr) * WY(k1, jpntr); } ipntr = ipntr % m + 1; wn1[WN(is, jy)] = t3; }
    upcl = col - 1;
  } else upcl = col;
  let ipntr = head;
  for (let iy = 1; iy <= upcl; iy++) {
    const is = m + iy; let jpntr = head;
    for (let jy = 1; jy <= iy; jy++) {
      const js = m + jy; let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
      for (let k = 1; k <= nenter; k++) { const k1 = indx2[k]; t1 += WY(k1, ipntr) * WY(k1, jpntr); t2 += WS(k1, ipntr) * WS(k1, jpntr); }
      for (let k = ileave; k <= n; k++) { const k1 = indx2[k]; t3 += WY(k1, ipntr) * WY(k1, jpntr); t4 += WS(k1, ipntr) * WS(k1, jpntr); }
      wn1[WN(iy, jy)] = wn1[WN(iy, jy)] + t1 - t3; wn1[WN(is, js)] = wn1[WN(is, js)] - t2 + t4; jpntr = jpntr % m + 1;
    }
    ipntr = ipntr % m + 1;
  }
  ipntr = head;
  for (let is = m + 1; is <= m + upcl; is++) {
    let jpntr = head;
    for (let jy = 1; jy <= upcl; jy++) {
      let t1 = 0, t3 = 0;
      for (let k = 1; k <= nenter; k++) { const k1 = indx2[k]; t1 += WS(k1, ipntr) * WY(k1, jpntr); }
      for (let k = ileave; k <= n; k++) { const k1 = indx2[k]; t3 += WS(k1, ipntr) * WY(k1, jpntr); }
      if (is <= jy + m) wn1[WN(is, jy)] += t1 - t3; else wn1[WN(is, jy)] += -t1 + t3;
      jpntr = jpntr % m + 1;
    }
    ipntr = ipntr % m + 1;
  }
  for (let iy = 1; iy <= col; iy++) {
    const is = col + iy, is1 = m + iy;
    for (let jy = 1; jy <= iy; jy++) { const js = col + jy, js1 = m + jy; wn[WN(jy, iy)] = wn1[WN(iy, jy)] / theta; wn[WN(js, is)] = wn1[WN(is1, js1)] * theta; }
    for (let jy = 1; jy <= iy - 1; jy++) wn[WN(jy, is)] = -wn1[WN(is1, jy)];
    for (let jy = iy; jy <= col; jy++) wn[WN(jy, is)] = wn1[WN(is1, jy)];
    wn[WN(iy, iy)] += SY(iy, iy);
  }
  let info = dpofa(wn, 0, d2, col); if (info !== 0) return -1;
  const col2 = col << 1;
  for (let js = col + 1; js <= col2; js++) dtrsl(wn, 0, d2, col, wn, WN(1, js), 11);
  for (let is = col + 1; is <= col2; is++) for (let js = is; js <= col2; js++) { let s = 0; for (let q = 1; q <= col; q++) s += wn[WN(q, is)] * wn[WN(q, js)]; wn[WN(is, js)] += s; }
  info = dpofa(wn, WN(col + 1, col + 1), d2, col); if (info !== 0) return -2;
  return 0;
}
function formt(m, wt, sy, ss, col, theta) {
  const I = (i, j) => (i - 1) + (j - 1) * m;
  for (let j = 1; j <= col; j++) wt[I(1, j)] = theta * ss[I(1, j)];
  for (let i = 2; i <= col; i++) for (let j = i; j <= col; j++) { const k1 = Math.min(i, j) - 1; let ddum = 0; for (let k = 1; k <= k1; k++) ddum += sy[I(i, k)] * sy[I(j, k)] / sy[I(k, k)]; wt[I(i, j)] = ddum + theta * ss[I(i, j)]; }
  return dpofa(wt, 0, m, col) !== 0 ? -3 : 0;
}
function freev(n, S, indx, indx2, iwhere) {
  S.nenter = 0; S.ileave = n + 1;
  if (S.iter > 0 && S.cnstnd) {
    for (let i = 1; i <= S.nfree; i++) { const k = indx[i]; if (iwhere[k] > 0) { S.ileave--; indx2[S.ileave] = k; } }
    for (let i = S.nfree + 1; i <= n; i++) { const k = indx[i]; if (iwhere[k] <= 0) { S.nenter++; indx2[S.nenter] = k; } }
  }
  S.wrk = S.ileave < n + 1 || S.nenter > 0 || S.updatd;
  S.nfree = 0; let iact = n + 1;
  for (let i = 1; i <= n; i++) { if (iwhere[i] <= 0) { S.nfree++; indx[S.nfree] = i; } else { iact--; indx[iact] = i; } }
}
function matupd(n, m, ws, wy, sy, ss, d, r, S, rr, dr) {
  const I = (i, j) => (i - 1) + (j - 1) * m, N = (i, j) => (i - 1) + (j - 1) * n;
  if (S.iupdat <= m) { S.col = S.iupdat; S.itail = (S.head + S.iupdat - 2) % m + 1; } else { S.itail = S.itail % m + 1; S.head = S.head % m + 1; }
  for (let i = 1; i <= n; i++) { ws[N(i, S.itail)] = d[i]; wy[N(i, S.itail)] = r[i]; }
  S.theta = rr / dr;
  if (S.iupdat > m) for (let j = 1; j <= S.col - 1; j++) { for (let q = 0; q < j; q++) ss[I(1, j) + q] = ss[I(2, j + 1) + q]; for (let q = 0; q < S.col - j; q++) sy[I(j, j) + q] = sy[I(j + 1, j + 1) + q]; }
  let pointr = S.head;
  for (let j = 1; j <= S.col - 1; j++) { let s1 = 0, s2 = 0; for (let i = 1; i <= n; i++) { s1 += d[i] * wy[N(i, pointr)]; s2 += ws[N(i, pointr)] * d[i]; } sy[I(S.col, j)] = s1; ss[I(j, S.col)] = s2; pointr = pointr % m + 1; }
  ss[I(S.col, S.col)] = S.stp === 1 ? S.dtd : S.stp * S.stp * S.dtd;
  sy[I(S.col, S.col)] = dr;
}
function projgr(n, l, u, nbd, x, g) {
  let sb = 0;
  for (let i = 1; i <= n; i++) { let gi = g[i]; if (nbd[i] !== 0) { if (gi < 0) { if (nbd[i] >= 2 && gi < x[i] - u[i]) gi = x[i] - u[i]; } else if (nbd[i] <= 2 && gi > x[i] - l[i]) gi = x[i] - l[i]; } if (sb < Math.abs(gi)) sb = Math.abs(gi); }
  return sb;
}
function subsm(n, m, nsub, ind, l, u, nbd, x, d, ws, wy, theta, col, head, wv, wn, S) {
  const d2 = 2 * m, N = (i, j) => (i - 1) + (j - 1) * n; const ns = nsub; if (ns <= 0) return 0;
  let pointr = head;
  for (let i = 1; i <= col; i++) { let t1 = 0, t2 = 0; for (let j = 1; j <= ns; j++) { const k = ind[j]; t1 += wy[N(k, pointr)] * d[j]; t2 += ws[N(k, pointr)] * d[j]; } wv[i] = t1; wv[col + i] = theta * t2; pointr = pointr % m + 1; }
  const col2 = col << 1;
  let info = dtrsl(wn, 0, d2, col2, wv, 1, 11); if (info !== 0) return info;
  for (let i = 1; i <= col; i++) wv[i] = -wv[i];
  info = dtrsl(wn, 0, d2, col2, wv, 1, 1); if (info !== 0) return info;
  pointr = head;
  for (let jy = 1; jy <= col; jy++) { const js = col + jy; for (let i = 1; i <= ns; i++) { const k = ind[i]; d[i] += wy[N(k, pointr)] * wv[jy] / theta + ws[N(k, pointr)] * wv[js]; } pointr = pointr % m + 1; }
  for (let i = 1; i <= ns; i++) d[i] /= theta;
  let alpha = 1, temp1 = alpha, ibd = 0;
  for (let i = 1; i <= ns; i++) {
    const k = ind[i], dk = d[i];
    if (nbd[k] !== 0) {
      if (dk < 0 && nbd[k] <= 2) { const t2 = l[k] - x[k]; if (t2 >= 0) temp1 = 0; else if (dk * alpha < t2) temp1 = t2 / dk; }
      else if (dk > 0 && nbd[k] >= 2) { const t2 = u[k] - x[k]; if (t2 <= 0) temp1 = 0; else if (dk * alpha > t2) temp1 = t2 / dk; }
      if (temp1 < alpha) { alpha = temp1; ibd = i; }
    }
  }
  if (alpha < 1) { const dk = d[ibd], k = ind[ibd]; if (dk > 0) { x[k] = u[k]; d[ibd] = 0; } else if (dk < 0) { x[k] = l[k]; d[ibd] = 0; } }
  for (let i = 1; i <= ns; i++) x[ind[i]] += alpha * d[i];
  S.iword = alpha < 1 ? 1 : 0;
  return 0;
}
function dcstep(L, fp, dp, stpmin, stpmax) { // L: {stx, fx, dx, sty, fy, dy, stp, brackt}
  let { stx, fx, dx, sty, fy, dy, stp } = L, stpf; const sgnd = dp * (dx / Math.abs(dx));
  if (fp > fx) {
    const theta = (fx - fp) * 3 / (stp - stx) + dx + dp, s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp)); let gamm = s * Math.sqrt((theta / s) ** 2 - dx / s * (dp / s)); if (stp < stx) gamm = -gamm;
    const p = gamm - dx + theta, q = gamm - dx + gamm + dp, r = p / q, stpc = stx + r * (stp - stx), stpq = stx + dx / ((fx - fp) / (stp - stx) + dx) / 2 * (stp - stx);
    stpf = Math.abs(stpc - stx) < Math.abs(stpq - stx) ? stpc : stpc + (stpq - stpc) / 2; L.brackt = true;
  } else if (sgnd < 0) {
    const theta = (fx - fp) * 3 / (stp - stx) + dx + dp, s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp)); let gamm = s * Math.sqrt((theta / s) ** 2 - dx / s * (dp / s)); if (stp > stx) gamm = -gamm;
    const p = gamm - dp + theta, q = gamm - dp + gamm + dx, r = p / q, stpc = stp + r * (stx - stp), stpq = stp + dp / (dp - dx) * (stx - stp);
    stpf = Math.abs(stpc - stp) > Math.abs(stpq - stp) ? stpc : stpq; L.brackt = true;
  } else if (Math.abs(dp) < Math.abs(dx)) {
    const theta = (fx - fp) * 3 / (stp - stx) + dx + dp, s = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp)), d1 = (theta / s) ** 2 - dx / s * (dp / s); let gamm = d1 < 0 ? 0 : s * Math.sqrt(d1); if (stp > stx) gamm = -gamm;
    const p = gamm - dp + theta, q = gamm + (dx - dp) + gamm, r = p / q; let stpc;
    if (r < 0 && gamm !== 0) stpc = stp + r * (stx - stp); else if (stp > stx) stpc = stpmax; else stpc = stpmin;
    const stpq = stp + dp / (dp - dx) * (stx - stp);
    if (L.brackt) { stpf = Math.abs(stpc - stp) < Math.abs(stpq - stp) ? stpc : stpq; const d2 = stp + (sty - stp) * 0.66; stpf = stp > stx ? Math.min(d2, stpf) : Math.max(d2, stpf); }
    else { stpf = Math.abs(stpc - stp) > Math.abs(stpq - stp) ? stpc : stpq; stpf = Math.min(stpmax, stpf); stpf = Math.max(stpmin, stpf); }
  } else {
    if (L.brackt) { const theta = (fp - fy) * 3 / (sty - stp) + dy + dp, s = Math.max(Math.abs(theta), Math.abs(dy), Math.abs(dp)); let gamm = s * Math.sqrt((theta / s) ** 2 - dy / s * (dp / s)); if (stp > sty) gamm = -gamm; const p = gamm - dp + theta, q = gamm - dp + gamm + dy, r = p / q; stpf = stp + r * (sty - stp); }
    else stpf = stp > stx ? stpmax : stpmin;
  }
  if (fp > fx) { sty = stp; fy = fp; dy = dp; } else { if (sgnd < 0) { sty = stx; fy = fx; dy = dx; } stx = stp; fx = fp; dx = dp; }
  Object.assign(L, { stx, fx, dx, sty, fy, dy, stp: stpf });
}
function dcsrch(L, f, g, ftol, gtol, xtol, stpmin, stpmax) { // L.stp is the step; returns task
  if (L.task === 'START') {
    if (L.stp < stpmin || L.stp > stpmax || g >= 0) return (L.task = 'ERROR');
    Object.assign(L, { brackt: false, stage: 1, finit: f, ginit: g, gtest: ftol * g, width: stpmax - stpmin, width1: (stpmax - stpmin) / 0.5, stx: 0, fx: f, dx: g, sty: 0, fy: f, dy: g, stmin: 0, stmax: L.stp + L.stp * 4 });
    return (L.task = 'FG');
  }
  const ftest = L.finit + L.stp * L.gtest; let task = 'FG';
  if (L.stage === 1 && f <= ftest && g >= 0) L.stage = 2;
  if (L.brackt && (L.stp <= L.stmin || L.stp >= L.stmax)) task = 'WARNING';
  if (L.brackt && L.stmax - L.stmin <= xtol * L.stmax) task = 'WARNING';
  if (L.stp === stpmax && f <= ftest && g <= L.gtest) task = 'WARNING';
  if (L.stp === stpmin && (f > ftest || g >= L.gtest)) task = 'WARNING';
  if (f <= ftest && Math.abs(g) <= gtol * (-L.ginit)) task = 'CONVERGENCE';
  if (task !== 'FG') return (L.task = task);
  if (L.stage === 1 && f <= L.fx && f > ftest) {
    const W = { stx: L.stx, fx: L.fx - L.stx * L.gtest, dx: L.dx - L.gtest, sty: L.sty, fy: L.fy - L.sty * L.gtest, dy: L.dy - L.gtest, stp: L.stp, brackt: L.brackt };
    dcstep(W, f - L.stp * L.gtest, g - L.gtest, L.stmin, L.stmax);
    Object.assign(L, { stx: W.stx, sty: W.sty, stp: W.stp, brackt: W.brackt, fx: W.fx + W.stx * L.gtest, fy: W.fy + W.sty * L.gtest, dx: W.dx + L.gtest, dy: W.dy + L.gtest });
  } else dcstep(L, f, g, L.stmin, L.stmax);
  if (L.brackt) { if (Math.abs(L.sty - L.stx) >= L.width1 * 0.66) L.stp = L.stx + (L.sty - L.stx) * 0.5; L.width1 = L.width; L.width = Math.abs(L.sty - L.stx); }
  if (L.brackt) { L.stmin = Math.min(L.stx, L.sty); L.stmax = Math.max(L.stx, L.sty); } else { L.stmin = L.stp + (L.stp - L.stx) * 1.1; L.stmax = L.stp + (L.stp - L.stx) * 4; }
  if (L.stp < stpmin) L.stp = stpmin; if (L.stp > stpmax) L.stp = stpmax;
  if ((L.brackt && (L.stp <= L.stmin || L.stp >= L.stmax)) || (L.brackt && L.stmax - L.stmin <= xtol * L.stmax)) L.stp = L.stx;
  return (L.task = 'FG');
}

// mainlb + R's lbfgsb() driver, with direct function evaluation in place of reverse communication.
// fg(x1) gets the 1-based parameter vector and returns { f, g (1-based) }.
function lbfgsbCore(n, m, x, l, u, nbd, fg, factr, pgtol, maxit) {
  const ws = new Float64Array(m * n), wy = new Float64Array(m * n), sy = new Float64Array(m * m), ss = new Float64Array(m * m), wt = new Float64Array(m * m), wn = new Float64Array(4 * m * m), snd = new Float64Array(4 * m * m);
  const z = new Float64Array(n + 1), r = new Float64Array(n + 1), d = new Float64Array(n + 1), t = new Float64Array(n + 1), wa = new Float64Array(8 * m + 1), indx = new Int32Array(n + 1), iwhere = new Int32Array(n + 1), indx2 = new Int32Array(n + 1);
  const S = { theta: 1, col: 0, head: 1, iupdat: 0, updatd: false, itail: 0, iter: 0, nfree: n, nenter: 0, ileave: 0, nint: 0, iword: 0, wrk: false, sbgnrm: 0, stp: 0, dtd: 0, cnstnd: false, boxed: false, prjctd: false };
  const tol = factr * EPSMCH; let f, g, nfgv = 0, fold = 0, gd = 0, gdold = 0, dnorm = 0, stpmx = 0, ifun = 0, iback = 0, info = 0, task = '', drvIter = 0, fail = 0;
  const evalfg = () => { const o = fg(x); if (!Number.isFinite(o.f)) throw new Error("L-BFGS-B needs finite values of 'fn'"); f = o.f; g = o.g; };
  const reset = () => { S.col = 0; S.head = 1; S.theta = 1; S.iupdat = 0; S.updatd = false; };
  active(n, l, u, nbd, x, iwhere, S);
  evalfg(); nfgv = 1;
  S.sbgnrm = projgr(n, l, u, nbd, x, g);
  if (S.sbgnrm <= pgtol) return { f, fail: 0, task: 'CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL', nfgv };
  outer: for (;;) { // L222
    S.iword = -1;
    let skipToL333 = false;
    if (!S.cnstnd && S.col > 0) { for (let i = 1; i <= n; i++) z[i] = x[i]; S.wrk = S.updatd; S.nint = 0; skipToL333 = true; }
    if (!skipToL333) {
      info = cauchy(n, x, l, u, nbd, g, indx2, iwhere, t, d, z, m, wy, ws, sy, wt, S, wa, 1, 2 * m + 1, 4 * m + 1, 6 * m + 1);
      if (info !== 0) { info = 0; reset(); continue outer; }
      freev(n, S, indx, indx2, iwhere);
    }
    // L333
    if (!(S.nfree === 0 || S.col === 0)) {
      if (S.wrk) info = formk(n, S.nfree, indx, S.nenter, S.ileave, indx2, S.iupdat, S.updatd, wn, snd, m, ws, wy, sy, S.theta, S.col, S.head);
      if (info !== 0) { info = 0; reset(); continue outer; }
      info = cmprlb(n, m, x, g, ws, wy, sy, wt, z, r, wa, indx, S);
      if (info === 0) info = subsm(n, m, S.nfree, indx, l, u, nbd, z, r, ws, wy, S.theta, S.col, S.head, wa, wn, S);
      if (info !== 0) { info = 0; reset(); continue outer; }
    }
    // L555
    for (let i = 1; i <= n; i++) d[i] = z[i] - x[i];
    // L666: line search (lnsrlb), evaluating f and g as requested
    const LS = { task: 'START', stp: 0 };
    S.dtd = 0; for (let i = 1; i <= n; i++) S.dtd += d[i] * d[i]; dnorm = Math.sqrt(S.dtd); stpmx = 1e10;
    if (S.cnstnd) { if (S.iter === 0) stpmx = 1; else for (let i = 1; i <= n; i++) { const a1 = d[i]; if (nbd[i] !== 0) { if (a1 < 0 && nbd[i] <= 2) { const a2 = l[i] - x[i]; if (a2 >= 0) stpmx = 0; else if (a1 * stpmx < a2) stpmx = a2 / a1; } else if (a1 > 0 && nbd[i] >= 2) { const a2 = u[i] - x[i]; if (a2 <= 0) stpmx = 0; else if (a1 * stpmx > a2) stpmx = a2 / a1; } } } }
    LS.stp = S.iter === 0 && !S.boxed ? Math.min(1 / dnorm, stpmx) : 1;
    for (let i = 1; i <= n; i++) { t[i] = x[i]; r[i] = g[i]; }
    fold = f; ifun = 0; iback = 0;
    let newx = false;
    for (;;) {
      gd = 0; for (let i = 1; i <= n; i++) gd += g[i] * d[i];
      if (ifun === 0) { gdold = gd; if (gd >= 0) { info = -4; } }
      if (info === 0) {
        const ct = dcsrch(LS, f, gd, 0.001, 0.9, 0.1, 0, stpmx);
        if (ct !== 'CONVERGENCE' && ct !== 'WARNING') { task = 'FG_LNSRCH'; ifun++; nfgv++; iback = ifun - 1; if (LS.stp === 1) for (let i = 1; i <= n; i++) x[i] = z[i]; else for (let i = 1; i <= n; i++) x[i] = LS.stp * d[i] + t[i]; }
        else task = 'NEW_X';
      }
      S.stp = LS.stp;
      if (info !== 0 || iback >= 20) {
        for (let i = 1; i <= n; i++) { x[i] = t[i]; g[i] = r[i]; } f = fold;
        if (S.col === 0) { if (info === 0) { info = -9; nfgv--; } S.iter++; return { f, fail: 52, task: 'ERROR: ABNORMAL_TERMINATION_IN_LNSRCH', nfgv }; }
        if (info === 0) nfgv--; info = 0; reset(); continue outer;
      }
      if (task === 'FG_LNSRCH') { evalfg(); continue; }
      newx = true; break;
    }
    // NEW_X
    S.iter++; S.sbgnrm = projgr(n, l, u, nbd, x, g);
    drvIter++; if (drvIter > maxit) { fail = 1; return { f, fail, task: 'NEW_X', nfgv }; }
    // L777
    if (S.sbgnrm <= pgtol) return { f, fail: 0, task: 'CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL', nfgv };
    const ddum = Math.max(Math.abs(fold), Math.abs(f), 1);
    if (fold - f <= tol * ddum) return { f, fail: 0, task: 'CONVERGENCE: REL_REDUCTION_OF_F <= FACTR*EPSMCH', nfgv };
    for (let i = 1; i <= n; i++) r[i] = g[i] - r[i];
    let rr = 0; for (let i = 1; i <= n; i++) rr += r[i] * r[i];
    let dr, dd;
    if (S.stp === 1) { dr = gd - gdold; dd = -gdold; } else { dr = (gd - gdold) * S.stp; for (let i = 1; i <= n; i++) d[i] *= S.stp; dd = -gdold * S.stp; }
    if (dr <= EPSMCH * dd) { S.updatd = false; continue outer; }
    S.updatd = true; S.iupdat++;
    matupd(n, m, ws, wy, sy, ss, d, r, S, rr, dr);
    info = formt(m, wt, sy, ss, S.col, S.theta);
    if (info !== 0) { info = 0; reset(); continue outer; }
    void newx;
  }
}
// optim(par, fn, gr, method = 'L-BFGS-B', lower, upper, control = list(fnscale, parscale, factr, pgtol, lmm, maxit))
export function optimLBFGSB(par, fn, gr, lower, upper, { fnscale = 1, parscale = null, factr = 1e7, pgtol = 0, lmm = 5, maxit = 100 } = {}) {
  const n = par.length, ps = parscale || new Array(n).fill(1), lo = [].concat(lower), up = [].concat(upper);
  const x = new Float64Array(n + 1), l = new Float64Array(n + 1), u = new Float64Array(n + 1), nbd = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) { x[i] = par[i - 1] / ps[i - 1]; l[i] = (lo.length === 1 ? lo[0] : lo[i - 1]) / ps[i - 1]; u[i] = (up.length === 1 ? up[0] : up[i - 1]) / ps[i - 1]; nbd[i] = Number.isFinite(l[i]) ? (Number.isFinite(u[i]) ? 2 : 1) : (Number.isFinite(u[i]) ? 3 : 0); }
  const fg = xx => { const p = Array.from({ length: n }, (_, i) => xx[i + 1] * ps[i]), f = fn(p) / fnscale, gg = gr(p), g = new Float64Array(n + 1); for (let i = 1; i <= n; i++) g[i] = gg[i - 1] * ps[i - 1] / fnscale; return { f, g }; };
  const res = lbfgsbCore(n, lmm, x, l, u, nbd, fg, factr, pgtol, maxit);
  return { par: Array.from({ length: n }, (_, i) => x[i + 1] * ps[i]), value: res.f * fnscale, convergence: res.fail, message: res.task, counts: res.nfgv };
}
