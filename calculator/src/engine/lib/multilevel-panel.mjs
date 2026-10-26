// Panel models as plm 2.6 fits them: within (individual / time / two-way) and Swamy–Arora random effects
// (plm.fit + ercomp "swar", including the unbalanced dfcor = 3 forms and the Wansbeek–Kapteyn GLS for unbalanced
// two-way panels), vcovHC(type = "HC1", cluster = "group") with lmtest::coeftest, and pgmm two-step difference GMM
// with collapsed instruments and Windmeijer-corrected robust standard errors (vcovHC.pgmm).
import * as L from './linalg.mjs';
import * as D from './dist.mjs';
import { need, isFactor, Factor, modelMatrix } from './frame.mjs';
import { fitout } from './models.mjs';
import { printCoefmat, fmtSig, fmtP } from './print.mjs';

const EPS = 2.220446049250313e-16;
// pdata.frame index: factors for id and time (numeric values sort numerically), rows ordered by (id, time)
function panelIndex(ctx) {
  const d = ctx.d, fac = k => { const c = d.get(k); return isFactor(c) ? c.droplevels() : new Factor(Array.from(c)); };
  const id = fac(ctx.subject[0]), tm = fac(ctx.time[0]);
  const order = Array.from({ length: d.n }, (_, i) => i).sort((a, b) => id.codes[a] - id.codes[b] || tm.codes[a] - tm.codes[b]);
  return { id, tm, order };
}
export function uniqueCheck(ctx) {
  const keys = [...ctx.subject, ...ctx.time], seen = new Set();
  for (let i = 0; i < ctx.d.n; i++) { const k = JSON.stringify(keys.map(v => { const c = ctx.d.get(v); return isFactor(c) ? c.value(i) : c[i]; })); need(!seen.has(k), 'Panel identifier × time must be unique.'); seen.add(k); }
}
const isConst = col => Math.max(...col) - Math.min(...col) < Math.sqrt(EPS);
function between(col, codes, G) { const s = new Array(G).fill(0), c = new Array(G).fill(0); codes.forEach((g, i) => { s[g] += col[i]; c[g]++; }); return codes.map(g => s[g] / c[g]); }
function sumBy(col, codes, G) { const s = new Array(G).fill(0); codes.forEach((g, i) => { s[g] += col[i]; }); return codes.map(g => s[g]); }
const colsOf = X => X[0] ? X[0].map((_, j) => X.map(r => r[j])) : [];
const rowsOf = C => C.length ? C[0].map((_, i) => C.map(c => c[i])) : [];
const trAB = (A, C) => { let tr = 0; for (let a = 0; a < A.length; a++) for (let b = 0; b < A.length; b++) tr += A[b][a] * C[b][a]; return tr; }; // trace(crossprod(A, C))

export function panelFit(ctx) {
  const { id, tm, order } = panelIndex(ctx), d = ctx.d.rows(order), n = d.n, N = id.nlevels, TS = tm.nlevels;
  const gi = order.map(i => id.codes[i]), ti = order.map(i => tm.codes[i]);
  const model = ctx.id === 'panel_fe' ? 'within' : 'random', effect = ctx.opt('effects', 'individual');
  need(['individual', 'time', 'twoways'].includes(effect), "'arg' should be one of “individual”, “time”, “twoways”, “nested”");
  const mm = modelMatrix(d, ctx.x.map(v => ({ vars: [v] })), { intercept: true }), Z = mm.X, names = mm.names, y = Array.from(d.get(ctx.y[0]));
  const Tn = new Array(N).fill(0), Nt = new Array(TS).fill(0); gi.forEach(g => Tn[g]++); ti.forEach(t => Nt[t]++);
  const balanced = Tn.every(v => v === TS);
  const B = (col, eff) => eff === 'individual' ? between(col, gi, N) : between(col, ti, TS);
  // within transformation; two-way: individual demeaning, then residuals on demeaned time dummies (exact projection)
  const within = (cols, eff) => {
    if (eff !== 'twoways') return cols.map(c => { const b = B(c, eff); return c.map((v, i) => v - b[i]); });
    const w1 = cols.map(c => { const b = B(c, 'individual'); return c.map((v, i) => v - b[i]); });
    if (balanced) return w1.map(c => { const b = B(c, 'time'); return c.map((v, i) => v - b[i]); });
    const Dr = rowsOf(Array.from({ length: TS - 1 }, (_, k) => { const c = ti.map(t => t === k + 1 ? 1 : 0), b = B(c, 'individual'); return c.map((v, i) => v - b[i]); }));
    return w1.map(c => L.lsfit(Dr, c).resid);
  };
  // plm.fit drops constant columns (cstcovar.rm = "all"), keeping a nonzero constant intercept
  const ols = (Xc, yv) => { const keep = Xc.map((c, j) => j).filter(j => !isConst(Xc[j]) || (names[j] === '(Intercept)' && Math.max(...Xc[j].map(Math.abs)) >= Math.sqrt(EPS))); need(keep.length > 0, 'empty model'); const X = rowsOf(keep.map(j => Xc[j])); return { keep, X, f: L.lsfit(X, yv) }; };
  const Zc = colsOf(Z), wfit = eff => { const w = within([y, ...Zc], eff); return ols(w.slice(1), w[0]); };
  let coef, cnames, demX, resid, pred, ercomp = null;
  if (model === 'within') {
    const r = wfit(effect); coef = r.f.coef; cnames = r.keep.map(j => names[j]); demX = r.X; resid = r.f.resid; pred = y.map((v, i) => v - resid[i]);
  } else {
    // ---- ercomp(method = "swar"): within quadratic form + Between regressions ----
    const nts = N * (effect !== 'time') + TS * (effect !== 'individual') - (effect === 'twoways'), K = names.length - 1, O = n;
    const w = wfit(effect), KW = w.keep.length, quad = [w.f.resid.reduce((s, v) => s + v * v, 0), 0, 0];
    const Bfit = eff => { const Zb = Zc.map(c => B(c, eff)), f = L.lsfit(rowsOf(Zb), B(y, eff)), res = y.map((v, i) => v - Z[i].reduce((s, z, j) => s + (Number.isNaN(f.coef[j]) ? 0 : z * f.coef[j]), 0)), rb = B(res, eff); return { Zb, q: rb.reduce((s, v) => s + v * v, 0), KS: f.coef.filter(v => !Number.isNaN(v)).length - 1 }; };
    const bi = effect !== 'time' ? Bfit('individual') : null, bt = effect !== 'individual' ? Bfit('time') : null;
    if (bi) quad[1] = bi.q; if (bt) quad[2] = bt.q;
    const M = L.zeros(3, 3); M[0][0] = O - nts - KW;
    if (balanced) {
      if (bi) { M[1][0] = N - bi.KS - 1; M[1][1] = TS * M[1][0]; }
      if (bt) { M[2][0] = TS - bt.KS - 1; M[2][2] = N * M[2][0]; }
    } else {
      const inv = Zb => L.inv(L.crossprod(rowsOf(Zb)));
      if (bi) { M[1][0] = N - K - 1; M[1][1] = O - trAB(inv(bi.Zb), L.mul(L.t(rowsOf(Zc.map(c => sumBy(c, gi, N)))), Z)); }
      if (bt) { M[2][0] = TS - K - 1; M[2][2] = O - trAB(inv(bt.Zb), L.mul(L.t(rowsOf(Zc.map(c => sumBy(c, ti, TS)))), Z)); }
      if (bi && bt) {
        M[1][2] = N - trAB(inv(bi.Zb), L.mul(L.t(rowsOf(bi.Zb)), rowsOf(bi.Zb.map(c => sumBy(c, ti, TS)))));
        M[2][1] = TS - trAB(inv(bt.Zb), L.mul(L.t(rowsOf(bt.Zb)), rowsOf(bt.Zb.map(c => sumBy(c, gi, N)))));
      }
    }
    const rr = effect === 'individual' ? [0, 1] : effect === 'time' ? [0, 2] : [0, 1, 2];
    const s2 = L.solve(L.sub(M, rr, rr), rr.map(r => quad[r])).map(v => v < 0 ? 0 : v), sig = { idios: s2[0], id: effect !== 'time' ? s2[1] : null, time: effect === 'individual' ? null : s2[s2.length - 1] };
    const thId = gi.map(g => sig.id === null ? 0 : 1 - Math.pow(1 + Tn[g] * sig.id / sig.idios, -0.5)), thT = ti.map(t => sig.time === null ? 0 : 1 - Math.pow(1 + Nt[t] * sig.time / sig.idios, -0.5));
    const thTot = gi.map((g, i) => effect !== 'twoways' || sig.time === 0 || sig.id === 0 ? 0 : thId[i] + thT[i] - 1 + Math.pow(1 + Nt[ti[i]] * sig.time / sig.idios + Tn[g] * sig.id / sig.idios, -0.5));
    ercomp = { sig };
    if (effect === 'twoways' && !balanced) {
      // Wansbeek–Kapteyn GLS; residuals and vcovHC use the untransformed pooled data
      const phi = sig.time / sig.idios, Dr = rowsOf(Array.from({ length: TS }, (_, k) => { const c = ti.map(t => t === k ? 1 : 0), b = B(c, 'individual'); return c.map((v, i) => v - thId[i] * b[i]); }));
      const Xr = rowsOf(Zc.map(c => { const b = B(c, 'individual'); return c.map((v, i) => v - thId[i] * b[i]); })), yb = B(y, 'individual'), ys = y.map((v, i) => v - thId[i] * yb[i]);
      const P = L.inv(L.add(L.ident(TS), L.scale(L.crossprod(Dr), phi))), XD = L.mul(L.t(Xr), Dr), XDP = L.scale(L.mul(XD, P), phi);
      const XPX = L.add(L.crossprod(Xr), L.scale(L.mul(XDP, L.t(XD)), -1)), Dy = L.tmulVec(Dr, ys), XPy = L.tmulVec(Xr, ys).map((v, a) => v - L.dot(XDP[a], Dy));
      coef = L.solve(XPX, XPy); cnames = names.slice(); demX = Z; resid = y.map((v, i) => v - L.dot(Z[i], coef)); pred = y.map((v, i) => v - resid[i]);
    } else {
      const tr = c => { if (effect === 'twoways') { const b1 = B(c, 'individual'), b2 = B(c, 'time'), mu = c.reduce((s, v) => s + v, 0) / n; return c.map((v, i) => v - thId[i] * b1[i] - thT[i] * b2[i] + thTot[i] * mu); } const b = B(c, effect), th = effect === 'individual' ? thId : thT; return c.map((v, i) => v - th[i] * b[i]); };
      const r = ols(Zc.map(tr), tr(y)); coef = r.f.coef; cnames = r.keep.map(j => names[j]); demX = r.X; resid = r.f.resid;
      pred = Z.map(row => r.keep.reduce((s, j, a) => s + row[j] * coef[a], 0));
    }
  }
  need(coef.every(Number.isFinite), 'Coefficient estimates are not identified (aliased predictors).');
  // vcovHC(type = "HC1", cluster = "group") → lmtest::coeftest(df = #panels − 1)
  const k = demX[0].length, adj = Math.sqrt(n / (n - k)), Sm = L.zeros(k, k), sg = Array.from({ length: N }, () => new Array(k).fill(0));
  gi.forEach((g, i) => { for (let a = 0; a < k; a++) sg[g][a] += demX[i][a] * resid[i] * adj; });
  for (const s of sg) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) Sm[a][b] += s[a] * s[b];
  const XtXi = L.inv(L.crossprod(demX)), V = L.mul(L.mul(XtXi, Sm), XtXi), cdf = N - 1, q = D.qt(1 - ctx.alpha / 2, cdf);
  const rowsT = coef.map((b, j) => { const se = Math.sqrt(V[j][j]), tv = b / se; return [cnames[j], b, se, tv, 2 * D.pt(-Math.abs(tv), cdf), b - q * se, b + q * se]; });
  ctx.table('Panel-clustered inference', ['Term', 'Estimate', 'Std. Error', 't value', 'Pr(>|t|)', 'Lower', 'Upper'], rowsT);
  ctx.note('Inference clusters by panel and uses ' + cdf + ' degrees of freedom. Conventional fit details appear in Diagnostics.');
  const m = { kind: 'plm', n, nobs: n, coefTable: null, logLik: NaN, AIC: NaN, BIC: NaN };
  m.summaryText = () => [(model === 'within' ? (effect === 'twoways' ? 'Twoways' : 'Oneway (' + effect + ')') + ' effect Within Model' : (effect === 'twoways' ? 'Twoways' : 'Oneway (' + effect + ')') + " effect Random Effect Model (Swamy-Arora's transformation)"),
    (balanced ? 'Balanced' : 'Unbalanced') + ' Panel: n = ' + N + ', T = ' + (balanced ? TS : Math.min(...Tn) + '-' + Math.max(...Tn)) + ', N = ' + n, '',
    ...(ercomp ? ['Effects: idiosyncratic var ' + fmtSig(ercomp.sig.idios, 4) + (ercomp.sig.id !== null ? ', individual var ' + fmtSig(ercomp.sig.id, 4) : '') + (ercomp.sig.time !== null ? ', time var ' + fmtSig(ercomp.sig.time, 4) : ''), ''] : []),
    'Coefficients (panel-clustered HC1):', ...printCoefmat(cnames, ['Estimate', 'Std. Error', 't value', 'Pr(>|t|)'], rowsT.map(r => r.slice(1, 5))), ''];
  m.predictions = () => ({ columns: ['Prediction'], rows: pred.map(v => [v]) });
  fitout(ctx, m);
}

// ---------- pgmm: two-step difference GMM, collapse = TRUE, y ~ lag(y, 1) + x | lag(y, 2:L) ----------
export function pgmmFit(ctx) {
  const Lg = ctx.num('lags', 2, { min: 2, max: 10, integer: true });
  const { id, tm } = panelIndex(ctx), d = ctx.d, N = id.nlevels, T = tm.nlevels, yv = d.get(ctx.y[0]);
  // regressors as model.matrix(~ x)[, -1]: factors get treatment-coded dummies (first level is the base), so a
  // categorical predictor (e.g. a 0/1 indicator read as categorical) stays identified after differencing; names as
  // R's make.names
  const mm1 = modelMatrix(d, ctx.x.map(v => ({ vars: [v] })), { intercept: true }), mmX = { X: mm1.X.map(r => r.slice(1)), names: mm1.names.slice(1).map(n => { let s = n.replace(/[^A-Za-z0-9._]/g, '.'); if (!/^([A-Za-z]|\.(?![0-9]))/.test(s)) s = 'X' + s; return s; }) }, xn = mmX.names, p = xn.length + 1;
  const grid = Array.from({ length: N }, () => new Array(T).fill(-1)); for (let i = 0; i < d.n; i++) grid[id.codes[i]][tm.codes[i]] = i;
  if (tm.levels.some(l => !Number.isFinite(Number(l)))) ctx.warn('NAs introduced by coercion'); // plm's lag() tries as.numeric(time)
  const TL1 = 2, rowsN = T - TL1, nGmm = Math.min(T - 2, Lg - 1);
  need(rowsN > 1, "argument 'order' (1) specifies an order larger or equal than the number of available observations (" + Math.max(rowsN, 0) + ')'); // summary() → mtest(order = 1)
  const W = [], YX = [], xs = (g, t) => t < 0 || grid[g][t] < 0 ? xn.map(() => NaN) : mmX.X[grid[g][t]], ys = (g, t) => t < 0 || grid[g][t] < 0 ? NaN : yv[grid[g][t]];
  for (let g = 0; g < N; g++) {
    const Wi = [], Yi = [];
    for (let t = TL1; t < T; t++) {
      const zi = xn.map((_, j) => xs(g, t)[j] - xs(g, t - 1)[j]), row = [ys(g, t) - ys(g, t - 1), ys(g, t - 1) - ys(g, t - 2), ...zi];
      const gm = Array.from({ length: nGmm }, (_, c) => ys(g, t - 2 - c));
      if (row.some(v => Number.isNaN(v))) { Yi.push(row.map(() => 0)); Wi.push(new Array(nGmm + xn.length).fill(0)); }
      else { Yi.push(row); Wi.push([...gm, ...zi].map(v => Number.isNaN(v) ? 0 : v)); }
    }
    W.push(Wi); YX.push(Yi);
  }
  const H = L.zeros(rowsN, rowsN); for (let i = 0; i < rowsN; i++) { H[i][i] = 2; if (i > 0) H[i][i - 1] = H[i - 1][i] = -1; }
  const m = W[0][0].length, sumM = f => { const S = L.zeros(m, m); W.forEach((Wi, g) => { const A = f(Wi, g); for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) S[a][b] += A[a][b]; }); return S; };
  const invOrG = (A, msg) => { if (Math.min(...L.eigenSym(A).values) < 1e-9) { ctx.warn(msg); return L.ginvSym(A); } return L.inv(A); };
  const A1 = L.scale(invOrG(sumM(Wi => L.mul(L.mul(L.t(Wi), H), Wi)), 'the first-step matrix is singular, a general inverse is used'), N);
  const WX = L.zeros(m, p), Wy = new Array(m).fill(0);
  W.forEach((Wi, g) => Wi.forEach((w, r) => { const row = YX[g][r]; for (let a = 0; a < m; a++) { Wy[a] += w[a] * row[0]; for (let b = 0; b < p; b++) WX[a][b] += w[a] * row[b + 1]; } }));
  const WXt = L.t(WX), gmmStep = A => { const B = L.inv(L.mul(L.mul(WXt, A), WX)); return { B, coef: L.mulVec(B, L.mulVec(L.mul(WXt, A), Wy)) }; };
  const res = coef => YX.map(Yi => Yi.map(r => r[0] - r.slice(1).reduce((s, v, j) => s + v * coef[j], 0)));
  const wu = (Wi, e) => { const u = new Array(m).fill(0); Wi.forEach((w, r) => { for (let a = 0; a < m; a++) u[a] += w[a] * e[r]; }); return u; };
  const s1 = gmmStep(A1), e1 = res(s1.coef), SA2 = sumM((Wi, g) => { const u = wu(Wi, e1[g]); return u.map(a => u.map(b => a * b)); });
  const A2 = invOrG(SA2, 'the second-step matrix is singular, a general inverse is used');
  const s2 = gmmStep(A2), coef = s2.coef, e2 = res(coef), B2 = s2.B, we = W.reduce((acc, Wi, g) => wu(Wi, e2[g]).map((v, a) => v + acc[a]), new Array(m).fill(0));
  // Windmeijer finite-sample correction (vcovHC.pgmm)
  const B1 = L.inv(L.mul(L.mul(WXt, A1), WX)), vcov1s = L.mul(L.mul(B1, L.mul(L.mul(L.mul(L.mul(WXt, A1), SA2), A1), WX)), B1), left = L.mul(L.mul(L.scale(B2, -1), WXt), A2), Dm = [];
  for (let kx = 0; kx < p; kx++) {
    const wexkw = sumM((Wi, g) => { const xk = YX[g].map(r => r[kx + 1]), ek = e1[g], A = L.zeros(m, m); Wi.forEach((wr, r) => Wi.forEach((wsv, s) => { const v = -(xk[r] * ek[s]) - (xk[s] * ek[r]); if (v) for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) A[a][b] += wr[a] * v * wsv[b]; })); return A; });
    Dm.push(L.mulVec(L.mul(L.mul(left, wexkw), A2), we));
  }
  const Dmat = L.t(Dm), DB = L.mul(Dmat, B2), Vr = L.add(L.add(L.add(B2, DB), L.t(DB)), L.mul(L.mul(Dmat, vcov1s), L.t(Dmat)));
  const cn = ['lag(' + ctx.y[0] + ', 1)', ...xn], rows = coef.map((b, j) => { const se = Math.sqrt(Vr[j][j]), z = b / se; return [cn[j], b, se, z, 2 * D.pnorm(-Math.abs(z))]; });
  const nobs = e2.flat().filter(v => v !== 0).length, sst = L.dot(we, L.mulVec(A2, we)), sdf = m - p;
  // Arellano-Bond tests of no autocorrelation in the differenced residuals (plm::mtest with the Windmeijer
  // covariance, as summary(pgmm, robust = TRUE) reports them) and the Wald test of all coefficients.
  const fpv = pv => { if (!(pv >= 2.220446049250313e-16)) return '< 2.22e-16'; return fmtSig(pv, 5); };
  const mtest = order => {
    let EVE = 0, num = 0; const EX = new Array(p).fill(0), XZ = L.zeros(m, p), ZVE = new Array(m).fill(0);
    W.forEach((Wi, g) => {
      const r = e2[g], rl = r.map((_, t) => t < order ? 0 : r[t - order]), Xg = YX[g].map(row => row.slice(1)), rr = r.reduce((a, v, t) => a + v * rl[t], 0);
      EVE += rr * rr; num += rr;
      Xg.forEach((x, t) => { for (let b = 0; b < p; b++) EX[b] += rl[t] * x[b]; Wi[t].forEach((w, a) => { for (let b = 0; b < p; b++) XZ[a][b] += w * x[b]; }); });
      Wi.forEach((w, t) => w.forEach((v, a) => { ZVE[a] += v * r[t] * rr; }));
    });
    const mid = L.dot(L.mulVec(B2, EX), L.mulVec(L.t(XZ), L.mulVec(A2, ZVE))), quad = L.dot(EX, L.mulVec(Vr, EX)), stat = num / Math.sqrt(EVE - 2 * mid + quad);
    return [stat, 2 * D.pnorm(Math.abs(stat), 0, 1, false)];
  };
  const abTests = [], [m1, p1] = mtest(1); abTests.push('Autocorrelation test (1): normal = ' + fmtSig(m1, 7) + ' (p-value = ' + fpv(p1) + ')');
  if (rowsN > 2) { const [m2, p2] = mtest(2); abTests.push('Autocorrelation test (2): normal = ' + fmtSig(m2, 7) + ' (p-value = ' + fpv(p2) + ')'); }
  const wald = L.dot(coef, L.mulVec(L.inv(Vr), coef)); abTests.push('Wald test for coefficients: chisq(' + p + ') = ' + fmtSig(wald, 7) + ' (p-value = ' + fpv(D.pchisq(wald, p, false)) + ')');
  const text = ['Oneway (individual) effect Two-steps model Difference GMM', '', 'Number of Observations Used: ' + nobs, '', 'Coefficients (Windmeijer-robust):', ...printCoefmat(cn, ['Estimate', 'Std. Error', 'z-value', 'Pr(>|z|)'], rows.map(r => r.slice(1))), '', 'Sargan test: chisq(' + sdf + ') = ' + fmtSig(sst, 7) + ' (p-value = ' + fpv(sdf > 0 ? D.pchisq(sst, sdf, false) : sst > 0 ? 0 : 1) + ')', ...abTests, ''];
  ctx.diag(text);
  ctx.table('Difference-GMM coefficients', ['Term', 'Estimate', 'Std. Error', 'z-value', 'Pr(>|z|)'], rows);
  if (m <= p) ctx.note('The model is exactly identified (as many instruments as coefficients), so the Sargan test of overidentifying restrictions cannot be computed. Use more lags (3 or more) to test instrument validity; the Arellano-Bond AR(2) test is in Diagnostics.');
  fitout(ctx, { kind: 'pgmm', n: nobs, nobs, coefTable: null, logLik: NaN, AIC: NaN, BIC: NaN, summaryText: () => text });
}
