// glmnet 4.1-8 port (dense x, unit weights, no offset, standardize = TRUE, intercept = TRUE): the gaussian
// "covariance" path solver (elnet1 / glmnetpp gaussian_cov), the two-class logistic path solver (lognet2n /
// glmnetpp binomial_two_class), lambda sequence and path-stopping rules, fix.lam, lambda.interp, and
// cv.glmnet (fold ids from R's RNG, buildPredmat with lambda alignment, cvcompute/cvstats/getOptcv).
const SML = 1e-5, EPS = 1e-6, BIGL = 9.9e35, MNLAM = 5, DEVMAX = 0.999, PMIN = 1e-9;
class GlmnetError extends Error {}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const chkvars = cols => cols.map(c => { for (let i = 1; i < c.length; i++) if (c[i] !== c[0]) return 1; return 0; });
const jerrMsg = n => 'from glmnet C++ code (error code ' + n + '); ' + (n === 7777 ? 'All used predictors have zero variance' : n === 10000 ? 'All penalty factors are <= 0' : 'Unknown error');

// lambda for path point m (0-based), as ElnetPathBase::initialize_point
function nextLambda(st, m, beta, absg, ju) {
  let alm0 = st.lam, alm = alm0;
  if (m > 1) alm *= st.alf;
  else if (m === 0) alm = BIGL;
  else { alm0 = 0; for (let j = 0; j < absg.length; j++) if (ju[j]) alm0 = Math.max(alm0, Math.abs(absg[j])); alm0 /= Math.max(beta, 1e-3); alm = alm0 * st.alf; }
  st.lam = alm; return { alm, alm0 };
}

// gaussian: X columns (Float64Array per variable), y
function elnetCov(cols0, y0, beta, flmin, nlam, thr, maxit) {
  const no = y0.length, ni = cols0.length, ju = chkvars(cols0);
  if (!ju.some(Boolean)) throw new GlmnetError(jerrMsg(7777));
  const w = 1 / no, v = Math.sqrt(w), x = cols0.map(c => Float64Array.from(c)), xm = new Float64Array(ni), xs = new Float64Array(ni), xv = new Float64Array(ni), y = Float64Array.from(y0);
  for (let j = 0; j < ni; j++) { if (!ju[j]) continue; const c = x[j]; let s = 0; for (let i = 0; i < no; i++) s += c[i] * w; xm[j] = s; for (let i = 0; i < no; i++) c[i] = v * (c[i] - s); xv[j] = dot(c, c); xs[j] = Math.sqrt(xv[j]); }
  for (let j = 0; j < ni; j++) { if (!ju[j]) continue; const c = x[j]; for (let i = 0; i < no; i++) c[i] /= xs[j]; xv[j] = 1; }
  let ym = 0; for (let i = 0; i < no; i++) ym += y[i] * w; for (let i = 0; i < no; i++) y[i] = v * (y[i] - ym);
  const ys = Math.sqrt(dot(y, y)); for (let i = 0; i < no; i++) y[i] /= ys;
  const g = new Float64Array(ni); for (let j = 0; j < ni; j++) if (ju[j]) g[j] = dot(x[j], y);
  const clLo = new Float64Array(ni), clHi = new Float64Array(ni); for (let j = 0; j < ni; j++) { clLo[j] = -BIGL / ys * xs[j]; clHi[j] = BIGL / ys * xs[j]; }
  const omb = 1 - beta, st = { lam: 0, alf: flmin < 1 ? Math.pow(Math.max(EPS, flmin), 1 / (nlam - 1)) : 1 };
  const a = new Float64Array(ni), mm = new Int32Array(ni), ia = [], c = [], mnl = Math.min(MNLAM, nlam);
  let rsq = 0, nlp = 0, iz = false; const out = { alm: [], ca: [], rsq: [], nin: [] };
  const upd = (k, ab, dem, full) => {
    const ak = a[k], u = g[k] + ak * xv[k], vv = Math.abs(u) - ab; a[k] = 0;
    if (vv > 0) a[k] = Math.max(clLo[k], Math.min(clHi[k], (u < 0 ? -vv : vv) / (xv[k] + dem)));
    if (a[k] === ak) return 0;
    if (full && !mm[k]) {
      ia.push(k); mm[k] = ia.length; const col = new Float64Array(ni);
      for (let j = 0; j < ni; j++) { if (!ju[j]) continue; col[j] = j === k ? xv[j] : mm[j] && j !== k ? c[mm[j] - 1][k] : dot(x[j], x[k]); }
      c.push(col);
    }
    const del = a[k] - ak; dlx = Math.max(xv[k] * del * del, dlx); rsq += del * (2 * g[k] - del * xv[k]);
    const ck = c[mm[k] - 1];
    if (full) { for (let j = 0; j < ni; j++) if (ju[j]) g[j] -= ck[j] * del; } else for (const j of ia) g[j] -= ck[j] * del;
    return 1;
  };
  let dlx = 0;
  const pass = (ab, dem, full) => { nlp++; dlx = 0; if (full) { for (let k = 0; k < ni; k++) if (ju[k]) upd(k, ab, dem, true); } else for (const k of ia.slice()) upd(k, ab, dem, false); if (dlx < thr) return true; if (nlp > maxit) throw new GlmnetError('maxit'); return false; };
  const partial = (ab, dem) => {
    iz = true; const da = ia.map(k => a[k]);
    while (!pass(ab, dem, false));
    for (let l = 0; l < ia.length; l++) da[l] -= a[ia[l]];
    for (let j = 0; j < ni; j++) { if (!ju[j] || mm[j]) continue; let s = 0; for (let l = 0; l < ia.length; l++) s += da[l] * c[l][j]; g[j] += s; }
  };
  for (let m = 0; m < nlam; m++) {
    const { alm } = nextLambda(st, m, beta, g, ju), dem = alm * omb, ab = alm * beta, rsq0 = rsq;
    if (iz) partial(ab, dem);
    for (;;) { if (pass(ab, dem, true)) break; partial(ab, dem); }
    const ca = ia.map(k => a[k]); out.ca.push(ca); out.rsq.push(rsq); out.alm.push(alm); out.nin.push(ia.length);
    const me = ca.filter(z => z !== 0).length, prop = rsq === 0 ? Infinity : (rsq - rsq0) / rsq;
    if (m + 1 < mnl || flmin >= 1) continue;
    if (me > ni + 1 || prop < SML || rsq > DEVMAX) break;
  }
  const ord = ia.slice();
  const lam = out.alm.map(l => l * ys), a0 = [], bet = [];
  out.ca.forEach((ca, k) => {
    const b = new Array(ni).fill(0); let s = 0;
    ca.forEach((cv, l) => { const j = ord[l], val = cv * (ys / xs[j]); b[j] = val; s -= val * xm[j]; });
    a0.push(s + ym); bet.push(b);
  });
  return { a0, beta: bet, lambda: lam, devRatio: out.rsq };
}

// binomial (two classes): y = indicator of the second factor level
function lognet2(cols0, y, beta, flmin, nlam, thr, maxit) {
  const no = y.length, ni = cols0.length, ju = chkvars(cols0);
  if (!ju.some(Boolean)) throw new GlmnetError(jerrMsg(7777));
  const w = new Float64Array(no).fill(1 / no), x = cols0.map(c => Float64Array.from(c)), xm = new Float64Array(ni), xs = new Float64Array(ni);
  for (let j = 0; j < ni; j++) { if (!ju[j]) continue; const c = x[j]; xm[j] = dot(w, c); for (let i = 0; i < no; i++) c[i] -= xm[j]; let s = 0; for (let i = 0; i < no; i++) s += w[i] * (c[i] * c[i]); xs[j] = Math.sqrt(s); for (let i = 0; i < no; i++) c[i] /= xs[j]; }
  const clLo = xs.map(s => -BIGL * s), clHi = xs.map(s => BIGL * s);
  const fmax = Math.log(1 / PMIN - 1), fmin = -fmax, vmin = (1 + PMIN) * PMIN * (1 - PMIN), omb = 1 - beta;
  const q0 = dot(w, y);
  if (q0 <= PMIN) throw new GlmnetError('from glmnet C++ code (error code 8001); Null probability for class 1 < 1.0e-5');
  if (q0 >= 1 - PMIN) throw new GlmnetError('from glmnet C++ code (error code 9001); Null probability for class 1 > 1.0 - 1.0e-5');
  const bz = Math.log(q0 / (1 - q0)), b = new Float64Array(ni + 1), bs = new Float64Array(ni + 1), xv = new Float64Array(ni), q = new Float64Array(no).fill(q0), v = new Float64Array(no), r = new Float64Array(no);
  b[0] = bz; const vi = q0 * (1 - q0); for (let i = 0; i < no; i++) { v[i] = vi * w[i]; r[i] = w[i] * (y[i] - q0); }
  let xmz = vi; const dev1 = -(bz * q0 + Math.log(1 - q0));
  let dev0 = dev1; for (let i = 0; i < no; i++) { if (y[i] > 0) dev0 += w[i] * y[i] * Math.log(y[i]); if (y[i] < 1) dev0 += w[i] * (1 - y[i]) * Math.log(1 - y[i]); }
  const shr = thr * dev0, ga = new Float64Array(ni), ixx = new Uint8Array(ni), mm = new Int32Array(ni), ia = [];
  for (let j = 0; j < ni; j++) if (ju[j]) ga[j] = Math.abs(dot(r, x[j]));
  const st = { lam: 0, alf: flmin < 1 ? Math.pow(Math.max(EPS, flmin), 1 / (nlam - 1)) : 1 }, mnl = Math.min(MNLAM, nlam);
  let nlp = 0, dlx = 0; const out = { alm: [], ca: [], a0: [], dev: [] };
  const dev2 = () => { let s = 0; for (let i = 0; i < no; i++) { const pi = Math.min(Math.max(PMIN, q[i]), 1 - PMIN); s -= w[i] * (y[i] * Math.log(pi) + (1 - y[i]) * Math.log(1 - pi)); } return s; };
  const upd = (k, al1, al2, full) => {
    const bk = b[k + 1], gk = dot(r, x[k]), u = gk + bk * xv[k], au = Math.abs(u) - al1; b[k + 1] = 0;
    if (au > 0) b[k + 1] = Math.max(clLo[k], Math.min(clHi[k], (u < 0 ? -au : au) / (xv[k] + al2)));
    if (b[k + 1] === bk) return;
    if (full && !mm[k]) { ia.push(k); mm[k] = ia.length; }
    const d = b[k + 1] - bk; dlx = Math.max(xv[k] * d * d, dlx);
    const xk = x[k]; for (let i = 0; i < no; i++) r[i] -= d * (v[i] * xk[i]);
  };
  const pass = (al1, al2, full) => {
    nlp++; dlx = 0;
    if (full) { for (let k = 0; k < ni; k++) if (ixx[k]) upd(k, al1, al2, true); } else for (const k of ia.slice()) upd(k, al1, al2, false);
    let s = 0; for (let i = 0; i < no; i++) s += r[i]; const d = s / xmz;
    if (d) { b[0] += d; dlx = Math.max(xmz * d * d, dlx); for (let i = 0; i < no; i++) r[i] -= d * v[i]; }
    if (dlx < shr) return true; if (nlp > maxit) throw new GlmnetError('maxit'); return false;
  };
  for (let m = 0; m < nlam; m++) {
    const { alm, alm0 } = nextLambda(st, m, beta, ga, ju), al2 = alm * omb, al1 = alm * beta, tlam = beta * (2 * alm - alm0);
    for (let k = 0; k < ni; k++) if (!ixx[k] && ju[k] && ga[k] > tlam) ixx[k] = 1;
    let tooSmall = false;
    for (;;) {
      if (nlp > maxit) throw new GlmnetError('maxit');
      bs[0] = b[0]; for (const k of ia) bs[k + 1] = b[k + 1];
      for (let j = 0; j < ni; j++) if (ixx[j]) { let s = 0; const c = x[j]; for (let i = 0; i < no; i++) s += v[i] * (c[i] * c[i]); xv[j] = s; }
      for (;;) { if (pass(al1, al2, true)) break; while (!pass(al1, al2, false)); }
      for (let i = 0; i < no; i++) { let fi = b[0]; for (const k of ia) fi += b[k + 1] * x[k][i]; q[i] = fi < fmin ? 0 : fi > fmax ? 1 : 1 / (1 + Math.exp(-fi)); }
      let s = 0; for (let i = 0; i < no; i++) { v[i] = w[i] * q[i] * (1 - q[i]); s += v[i]; } xmz = s;
      if (xmz <= vmin) { tooSmall = true; break; }
      for (let i = 0; i < no; i++) r[i] = w[i] * (y[i] - q[i]);
      const d0 = b[0] - bs[0]; let ix = xmz * d0 * d0 > shr;
      if (!ix) for (const k of ia) { const d = b[k + 1] - bs[k + 1]; if (xv[k] * d * d > shr) { ix = true; break; } }
      if (!ix) {
        let kkt = true;
        for (let k = 0; k < ni; k++) { if (ixx[k] || !ju[k]) continue; ga[k] = Math.abs(dot(r, x[k])); if (ga[k] > al1) { ixx[k] = 1; kkt = false; } }
        if (kkt) break;
      }
    }
    const ca = ia.map(k => b[k + 1]); out.ca.push(ca); out.a0.push(b[0]); out.alm.push(alm);
    const dv = (dev1 - dev2()) / dev0; out.dev.push(dv);
    const me = ca.filter(z => z !== 0).length, prev = m === 0 ? 0 : out.dev[m - 1];
    if (m + 1 >= mnl && flmin < 1 && (me > ni + 1 || dv - prev < SML || dv > DEVMAX)) break;
    if (tooSmall) break;
  }
  const ord = ia.slice(), a0 = [], bet = [];
  out.ca.forEach((ca, k) => { const bb = new Array(ni).fill(0); let s = out.a0[k]; ca.forEach((cv, l) => { const j = ord[l], val = cv / xs[j]; bb[j] = val; s -= val * xm[j]; }); a0.push(s); bet.push(bb); });
  return { a0, beta: bet, lambda: out.alm, devRatio: out.dev, nulldev: 2 * no * dev0 };
}

const fixLam = lam => { if (lam.length > 2) { const l = lam.map(Math.log); lam = lam.slice(); lam[0] = Math.exp(2 * l[1] - l[2]); } return lam; };

// glmnet(x, y, family, alpha): X rows (n × p)
export function glmnet(X, y, { family = 'gaussian', alpha = 1, nlambda = 100, thresh = 1e-7, maxit = 100000, warn = () => {} } = {}) {
  const nobs = X.length, nvars = X[0] ? X[0].length : 0;
  if (nvars <= 1) throw new GlmnetError('x should be a matrix with 2 or more columns');
  const flmin = nobs < nvars ? 1e-2 : 1e-4, cols = Array.from({ length: nvars }, (_, j) => Float64Array.from(X, r => r[j]));
  let fit;
  if (family === 'binomial') {
    const lv = [...new Set(y)].sort((a, b) => a - b), cnt = lv.map(l => y.filter(v => v === l).length), minc = Math.min(...cnt);
    if (minc <= 1) throw new GlmnetError('one multinomial or binomial class has 1 or 0 observations; not allowed');
    if (minc < 8) warn('one multinomial or binomial class has fewer than 8  observations; dangerous ground');
    if (lv.length < 2) throw new GlmnetError('incorrect number of dimensions');
    if (lv.length > 2) throw new GlmnetError('More than two classes; use multinomial family instead in call to glmnet');
    fit = lognet2(cols, Float64Array.from(y, v => v === lv[1] ? 1 : 0), alpha, flmin, nlambda, thresh, maxit);
  } else {
    let ym = 0; for (const v of y) ym += v; ym /= nobs; let nd = 0; for (const v of y) nd += (v - ym) ** 2;
    if (nd === 0) throw new GlmnetError('y is constant; gaussian glmnet fails at standardization step');
    fit = elnetCov(cols, y, alpha, flmin, nlambda, thresh, maxit);
  }
  fit.lambda = fixLam(fit.lambda); fit.family = family; fit.nvars = nvars;
  return fit;
}
// R's approx(x, y, v) with x increasing (rule = 1, v inside range)
function approx1(x, y, v) {
  let i = 0, j = x.length - 1; if (v < x[i] || v > x[j]) return NaN;
  while (i < j - 1) { const ij = (i + j) >> 1; if (v < x[ij]) j = ij; else i = ij; }
  if (v === x[j]) return y[j]; if (v === x[i]) return y[i];
  return y[i] + (y[j] - y[i]) * ((v - x[i]) / (x[j] - x[i]));
}
// coefficients (intercept first) at lambda s via lambda.interp
export function coefAt(fit, s) {
  const lambda = fit.lambda, k = lambda.length, nb = fit.a0.map((a, i) => [a, ...fit.beta[i]]);
  if (k === 1) return nb[0].slice();
  const L = lambda.map(l => (lambda[0] - l) / (lambda[0] - lambda[k - 1])), lo = Math.min(...L), hi = Math.max(...L);
  let sf = (lambda[0] - s) / (lambda[0] - lambda[k - 1]); if (sf < lo) sf = lo; if (sf > hi) sf = hi;
  const coord = approx1(L, L.map((_, i) => i + 1), sf), left = Math.floor(coord), right = Math.ceil(coord);
  let frac = (sf - L[right - 1]) / (L[left - 1] - L[right - 1]);
  if (left === right) frac = 1; if (Math.abs(L[left - 1] - L[right - 1]) < 2.220446049250313e-16) frac = 1;
  return nb[left - 1].map((v, j) => v * frac + nb[right - 1][j] * (1 - frac));
}
export const linkPredict = (coef, X) => X.map(r => { let s = coef[0]; for (let j = 0; j < r.length; j++) s += r[j] * coef[j + 1]; return s; });

const wmean = (a, w) => { let s = 0, sw = 0; for (let i = 0; i < a.length; i++) if (!Number.isNaN(a[i])) { s += a[i] * w[i]; sw += w[i]; } return s / sw; };
// cv.glmnet(x, y, family, alpha, nfolds) with the default type.measure (mse | binomial deviance)
export function cvGlmnet(X, y, { family = 'gaussian', alpha = 1, nfolds = 10, rng, warn = () => {} } = {}) {
  const N = X.length, rep = Array.from({ length: N }, (_, i) => (i % nfolds) + 1), foldid = rng.sample(rep);
  if (nfolds < 3) throw new GlmnetError('nfolds must be bigger than 3; nfolds=10 recommended');
  const full = glmnet(X, y, { family, alpha, warn }), lambda = full.lambda, nl = lambda.length;
  const predmat = Array.from({ length: N }, () => new Array(nl).fill(NaN));
  for (let f = 1; f <= nfolds; f++) {
    const tr = [], te = []; foldid.forEach((g, i) => (g === f ? te : tr).push(i));
    const fit = glmnet(tr.map(i => X[i]), tr.map(i => y[i]), { family, alpha, warn });
    lambda.forEach((s, j) => { const cf = coefAt(fit, s), p = linkPredict(cf, te.map(i => X[i])); te.forEach((i, t) => { predmat[i][j] = p[t]; }); });
  }
  let cvraw;
  if (family === 'binomial') {
    const lv = [...new Set(y)].sort((a, b) => a - b);
    cvraw = predmat.map((row, i) => row.map(eta => { let p = 1 / (1 + Math.exp(-eta)); p = Math.min(Math.max(p, 1e-5), 1 - 1e-5); const y2 = y[i] === lv[1] ? 1 : 0, lp = (1 - y2) * Math.log(1 - p) + y2 * Math.log(p); return 2 * (0 - lp); }));
  } else cvraw = predmat.map((row, i) => row.map(p => (y[i] - p) ** 2));
  let grouped = true;
  if (N / nfolds < 3) { warn('Option grouped=FALSE enforced in cv.glmnet, since < 3 observations per fold'); grouped = false; }
  let mat, wts, Ncnt;
  if (grouped) {
    mat = []; wts = []; for (let f = 1; f <= nfolds; f++) { const idx = foldid.map((g, i) => g === f ? i : -1).filter(i => i >= 0); wts.push(idx.length); mat.push(lambda.map((_, j) => { const a = idx.map(i => cvraw[i][j]).map(v => Number.isFinite(v) ? v : NaN); return wmean(a, a.map(() => 1)); })); }
    Ncnt = nfolds;
  } else { mat = cvraw.map(r => r.map(v => Number.isFinite(v) ? v : v)); wts = new Array(N).fill(1); Ncnt = N; }
  let cvm = lambda.map((_, j) => wmean(mat.map(r => r[j]), wts)), cvsd = lambda.map((_, j) => Math.sqrt(wmean(mat.map(r => (r[j] - cvm[j]) ** 2), wts) / (Ncnt - 1)));
  let lam = lambda.slice(); const keep = cvsd.map(v => !Number.isNaN(v));
  if (keep.some(k => !k)) { lam = lam.filter((_, i) => keep[i]); cvm = cvm.filter((_, i) => keep[i]); cvsd = cvsd.filter((_, i) => keep[i]); }
  const cvmin = Math.min(...cvm.filter(v => !Number.isNaN(v)));
  const lambdaMin = Math.max(...lam.filter((_, i) => cvm[i] <= cvmin)), idmin = lam.indexOf(lambdaMin), semin = cvm[idmin] + cvsd[idmin];
  const lambda1se = Math.max(...lam.filter((_, i) => cvm[i] <= semin));
  return { fit: full, lambda: lam, cvm, cvsd, lambdaMin, lambda1se, name: family === 'binomial' ? 'Binomial Deviance' : 'Mean-Squared Error' };
}
export { GlmnetError };
