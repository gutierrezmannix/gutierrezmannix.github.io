// Regression family: probit, multinomial, negative binomial, hurdle, zero-inflated, robust, quantile,
// natural splines and GAM — ports of the regression block in src/analysis-methods.R.
import { register } from '../registry.mjs';
import { need, isFactor } from '../lib/frame.mjs';
import { design, glm, lm, families, fitout } from '../lib/models.mjs';
import * as L from '../lib/linalg.mjs';
import * as D from '../lib/dist.mjs';
import { printCoefmat, fmtSig } from '../lib/print.mjs';
import { median } from '../lib/stats.mjs';
import { vmmin } from '../lib/regression-optim.mjs';
import { glmNB, hurdle, zeroinfl } from '../lib/regression-count.mjs';
import { rqFit, summaryRqNid } from '../lib/regression-rq.mjs';
import { ns } from '../lib/regression-spline.mjs';
import { fitGam } from '../lib/regression-gam.mjs';

// formula() = y ~ x1 + x2 … with treatment contrasts; offset(.exposure) when an exposure is chosen
export function regDesign(ctx, terms = null) {
  const offset = ctx.fields('offset').length ? (() => { const ee = ctx.value('offset'); need(ee.every(v => v > 0), 'Exposure must be positive.'); return ee.map(Math.log); })() : null;
  return design(ctx.d, ctx.y[0], terms || ctx.rhs().map(v => ({ vars: [v] })), { offset });
}
register('probit', ctx => {
  ctx.clean(); const des = regDesign(ctx);
  const yv = des.y; need(yv.every(v => v >= 0 && v <= 1), 'y values must be 0 <= y <= 1');
  const m = glm(des, families.binomial('probit')); m.warnings.forEach(w => ctx.warn(w));
  m.predictions = () => ({ columns: ['Prediction'], rows: m.mu.map(v => [v]) });
  fitout(ctx, m);
});

// common start of the R block: clean(), formula() (+ exposure offset) and, for counts, the outcome check
function start(ctx, count = false) {
  ctx.clean(); const des = regDesign(ctx);
  if (count) { const yy = ctx.value('y'); need(!isFactor(yy) && Array.from(yy).every(v => v >= 0 && v === Math.floor(v)), 'Count outcomes must be nonnegative integers.'); }
  return des;
}
const formulaText = (ctx, des) => ctx.y[0] + ' ~ ' + des.termLabels.join(' + ') + (des.offset ? ' + offset(.exposure)' : '');

// ---------- multinomial: nnet::multinom(ff, trace = FALSE, maxit = 1000, Hess = TRUE) ----------
register('multinomial', ctx => {
  const des = start(ctx), yf = ctx.group(ctx.value('y'));
  need(yf.nlevels >= 3, 'Select an outcome with at least three categories.');
  // nnet with size = 0, skip = TRUE, softmax: per output unit the weights [bias, x1…xp]; class 1 and biases fixed at 0
  const X = des.X, n = X.length, p = X[0].length, K = yf.nlevels, lev = yf.levels, cls = yf.codes, np1 = p + 1, nw = K * np1;
  const mask = Array.from({ length: nw }, (_, i) => i >= np1 && i % np1 !== 0), P = new Float64Array(K);
  const probs = (w, i, out) => { const xi = X[i]; let mx = 0; for (let k = 0; k < K; k++) { let s = 0; s += w[k * np1]; for (let j = 0; j < p; j++) s += xi[j] * w[k * np1 + 1 + j]; out[k] = s; if (k === 0 || s > mx) mx = s; } let sum = 0; for (let k = 0; k < K; k++) { out[k] = Math.exp(out[k] - mx); sum += out[k]; } for (let k = 0; k < K; k++) out[k] /= sum; return out; };
  const fn = w => { let E = 0; for (let i = 0; i < n; i++) { probs(w, i, P); const pk = P[cls[i]]; if (pk > 0) E -= Math.log(pk); else E += 1000; } return E; };
  const gr = w => { const g = new Array(nw).fill(0); for (let i = 0; i < n; i++) { probs(w, i, P); const xi = X[i]; for (let k = 0; k < K; k++) { const e = P[k] - (cls[i] === k ? 1 : 0); g[k * np1] += e; for (let j = 0; j < p; j++) g[k * np1 + 1 + j] += e * xi[j]; } } return g; };
  const fit = vmmin(new Array(nw).fill(0), fn, gr, { maxit: 1000, abstol: 1e-4, reltol: 1e-8, mask });
  need(fit.fail === 0, 'Multinomial regression did not converge.');
  const w = fit.par, Pm = Array.from({ length: n }, (_, i) => Array.from(probs(w, i, new Float64Array(K))));
  // multinomHess: information for classes 2..K (terms varying fastest); vcov = ginv(Hessian)
  const q = (K - 1) * p, H = L.zeros(q, q);
  for (let i = 0; i < n; i++) { const xi = X[i], pi = Pm[i]; for (let a = 1; a < K; a++) for (let b = 1; b < K; b++) { const c = (a === b ? pi[a] : 0) - pi[a] * pi[b]; if (c === 0) continue; for (let r = 0; r < p; r++) { const v = c * xi[r]; for (let s = 0; s < p; s++) H[(a - 1) * p + r][(b - 1) * p + s] += v * xi[s]; } } }
  const V = ginv(H), coef = [], se = [];
  for (let a = 1; a < K; a++) { coef.push(Array.from({ length: p }, (_, j) => w[a * np1 + 1 + j])); se.push(Array.from({ length: p }, (_, j) => Math.sqrt(V[(a - 1) * p + j][(a - 1) * p + j]))); }
  need(coef.flat().every(Number.isFinite) && se.flat().every(v => Number.isFinite(v) && v > 0), 'Multinomial coefficients or standard errors are not estimable.');
  const zc = D.qnorm(1 - ctx.alpha / 2), rows = [];
  for (let a = 0; a < K - 1; a++) for (let j = 0; j < p; j++) { const b = coef[a][j], s = se[a][j], z = b / s; rows.push([lev[a + 1], des.names[j], b, s, z, 2 * D.pnorm(-Math.abs(z)), b - zc * s, b + zc * s]); }
  ctx.table('Multinomial coefficients', ['Outcome', 'Term', 'Estimate', 'SE', 'Z', 'P', 'Lower', 'Upper'], rows);
  ctx.note('Reference outcome: ' + lev[0]);
  const edf = (K - 1) * L.qrR(X).rank, dev = 2 * fit.value, hdr = ''.padEnd(8) + des.names.map(s => s.padStart(12)).join('');
  const mat = m => m.map((r, a) => lev[a + 1].padEnd(8) + r.map(v => fmtSig(v, 6).padStart(12)).join(''));
  fitout(ctx, { kind: 'multinom', n, coefTable: null, logLik: -dev / 2, AIC: dev + 2 * edf, BIC: dev + Math.log(n) * edf,
    summaryText: () => ['Call:', 'multinom(formula = ' + formulaText(ctx, des) + ', data = d, trace = FALSE, maxit = 1000, Hess = TRUE)', '', 'Coefficients:', hdr, ...mat(coef), '', 'Std. Errors:', hdr, ...mat(se), '', 'Residual Deviance: ' + fmtSig(dev, 6), 'AIC: ' + fmtSig(dev + 2 * edf, 6)] });
});
// MASS-style ginv() (tolerance sqrt(eps) × largest singular value) of the symmetric PSD information matrix
function ginv(H) { const { values, vectors } = L.eigenSym(H), n = H.length, tol = Math.sqrt(2.220446049250313e-16) * Math.max(values[0], 0), o = L.zeros(n, n); for (let k = 0; k < n; k++) if (values[k] > tol) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o[i][j] += vectors[i][k] * vectors[j][k] / values[k]; return o; }

// ---------- negative binomial: MASS::glm.nb ----------
register('negbin', ctx => {
  const des = start(ctx, true), m = glmNB(des); m.warnings.forEach(w => ctx.warn(w));
  m.summaryText = () => { const ct = m.coefTable; return ['', 'Call:', 'MASS::glm.nb(formula = ' + formulaText(ctx, des) + ', data = d, init.theta = ' + fmtSig(m.theta, 10) + ', link = log)', '', 'Coefficients:', ...printCoefmat(ct.rownames, ct.columns, ct.rows), '', '(Dispersion parameter for Negative Binomial(' + fmtSig(m.theta, 4) + ') family taken to be 1)', '', 'Residual deviance: ' + fmtSig(m.deviance, 5) + '  on ' + m.dfResidual + '  degrees of freedom', 'AIC: ' + fmtSig(m.aic, 5), '', '              Theta:  ' + fmtSig(m.theta, 5), '          Std. Err.:  ' + fmtSig(m.SEtheta, 5), '', ' 2 x log-likelihood:  ' + fmtSig(m.twologlik, 6), '']; };
  m.predictions = () => ({ columns: ['Prediction'], rows: m.mu.map(v => [v]) });
  fitout(ctx, m);
});

// ---------- hurdle / zero-inflated (pscl; zero part binomial logit) ----------
register(['hurdle', 'zeroinfl'], ctx => {
  const des = start(ctx, true), dist = ctx.opt('countFamily', 'negbin');
  need(['negbin', 'poisson'].includes(dist), "'arg' should be one of “poisson”, “negbin”, “geometric”");
  const Y = des.y.map(v => Math.round(v + 0.001)), X = des.X, off = des.offset || new Array(X.length).fill(0);
  if (Y.every(v => v > 0)) throw new Error('invalid dependent variable, minimum count is not zero');
  const m = (ctx.id === 'hurdle' ? hurdle : zeroinfl)(X, X, Y, off, off, dist); m.warnings.forEach(w => ctx.warn(w));
  const comp = (rn, b, se) => rn.map((r, i) => { const z = b[i] / se[i]; return [r, b[i], se[i], z, 2 * D.pnorm(-Math.abs(z))]; });
  const tabs = [['count', comp([...des.names, ...(m.nb ? ['Log(theta)'] : [])], [...m.coefc, ...(m.nb ? [Math.log(m.theta)] : [])], m.seC)], ['zero', comp(des.names, m.coefz, m.seZ)]];
  for (const [k, rows] of tabs) { need(rows.every(r => Number.isFinite(r[1]) && Number.isFinite(r[2]) && r[2] > 0), 'A count/zero component is not identified.'); ctx.table(k + ' component', ['Term', 'Estimate', 'Std. Error', 'z value', 'Pr(>|z|)'], rows); }
  const ll = m.loglik, df = m.df, cm = rows => printCoefmat(rows.map(r => r[0]), ['Estimate', 'Std. Error', 'z value', 'Pr(>|z|)'], rows.map(r => r.slice(1)));
  Object.assign(m, { coefTable: null, logLik: ll, AIC: -2 * ll + 2 * df, BIC: -2 * ll + Math.log(m.n) * df });
  m.summaryText = () => ['', 'Call:', 'pscl::' + ctx.id + '(formula = ' + formulaText(ctx, des) + ', data = d, dist = "' + dist + '")', '',
    ctx.id === 'hurdle' ? 'Count model coefficients (truncated ' + dist + ' with log link):' : 'Count model coefficients (' + dist + ' with log link):', ...cm(tabs[0][1]), ...(m.nb ? ['Theta: count = ' + fmtSig(m.theta, 4)] : []),
    ctx.id === 'hurdle' ? 'Zero hurdle model coefficients (binomial with logit link):' : 'Zero-inflation model coefficients (binomial with logit link):', ...cm(tabs[1][1]), '', 'Log-likelihood: ' + fmtSig(ll, 5) + ' on ' + df + ' Df'];
  fitout(ctx, m);
});

// ---------- robust: MASS::rlm(ff, maxit = 200) (Huber psi k = 1.345, MAD scale, IWLS from least squares) ----------
register('robustreg', ctx => {
  const des = start(ctx), X = des.X, off = des.offset, y = off ? des.y.map((v, i) => v - off[i]) : des.y, n = X.length, p = X[0].length, k2 = 1.345;
  if (L.qrR(X).rank < p) throw new Error("'x' is singular: singular fits are not implemented in 'rlm'");
  let fit = L.lsfit(X, y), coef = fit.coef, resid = fit.resid, scale = 0, done = false;
  for (let it = 1; it <= 200; it++) {
    const old = resid; scale = median(resid.map(Math.abs)) / 0.6745;
    if (scale === 0) { done = true; break; }
    fit = L.lsfit(X, y, resid.map(r => Math.min(1, k2 / Math.abs(r / scale)))); coef = fit.coef; resid = fit.resid;
    let a = 0, b = 0; for (let i = 0; i < n; i++) { a += (old[i] - resid[i]) ** 2; b += old[i] ** 2; }
    done = Math.sqrt(a / Math.max(1e-20, b)) <= 1e-4; if (done) break;
  }
  if (!done) ctx.warn("'rlm' failed to converge in 200 steps");
  const fitted = X.map(r => L.dot(r, coef)), res = y.map((v, i) => v - fitted[i]);
  // summary.rlm (method 'XtX')
  const u = resid.map(r => r / scale), psi = u.map(v => Math.min(1, k2 / Math.abs(v))), pp = u.map(v => Math.abs(v) <= k2 ? 1 : 0), rdf = n - p;
  const S = resid.reduce((s, r, i) => s + (r * psi[i]) ** 2, 0) / rdf, mn = pp.reduce((s, v) => s + v, 0) / n, vr = pp.reduce((s, v) => s + (v - mn) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(S) * ((1 + p * vr / (n * mn * mn)) / mn), Vu = L.covUnscaled(L.lsfit(X, y));
  const rows = coef.map((b, j) => { const se = Math.sqrt(Vu[j][j]) * stddev; return [b, se, b / se]; });
  ctx.note('Huber M-estimation. Robust regression differs from OLS with robust standard errors; t-like statistics are not assigned classical p-values.');
  const rss = res.reduce((s, r) => s + r * r, 0), ll = 0.5 * (-n * (Math.log(2 * Math.PI) + 1 - Math.log(n) + Math.log(rss))), ct = { rownames: des.names, columns: ['Value', 'Std. Error', 't value'], rows };
  fitout(ctx, { kind: 'rlm', n, coefTable: ct, crit: 'z', converged: done, logLik: ll, AIC: -2 * ll + 2 * (p + 1), BIC: -2 * ll + Math.log(n) * (p + 1),
    summaryText: () => ['', 'Call: rlm(formula = ' + formulaText(ctx, des) + ', data = d, maxit = 200)', '', 'Coefficients:', ...printCoefmat(ct.rownames, ct.columns, rows), '', 'Residual standard error: ' + fmtSig(scale, 4) + ' on ' + rdf + ' degrees of freedom'],
    predictions: () => ({ columns: ['Prediction'], rows: fitted.map((f, i) => [f + (off ? off[i] : 0)]) }) });
});

// ---------- quantile: quantreg::rq(ff, tau, method = 'br') + summary(se = 'nid') ----------
register('quantile', ctx => {
  const des = start(ctx), tau = ctx.num('tau', 0.5, { min: 0.001, max: 0.999 }), X = des.X, y = des.offset ? des.y.map((v, i) => v - des.offset[i]) : des.y, n = y.length, p = X[0].length, warns = [];
  const fit = rqFit(X, y, tau, warns), rows = summaryRqNid(X, y, fit, warns);
  ctx.table('Quantile coefficients', ['Term', 'Value', 'Std. Error', 't value', 'Pr(>|t|)'], rows.map((r, j) => [des.names[j], ...r]));
  ctx.note('Quantile inference uses the nid sparsity estimator.');
  warns.forEach(w => ctx.warn(w));
  const ll = n * (Math.log(tau * (1 - tau)) - 1 - Math.log(fit.rho / n));
  fitout(ctx, { kind: 'rq', n, coefTable: null, logLik: ll, AIC: -2 * ll + 2 * p, BIC: NaN,
    summaryText: () => ['', 'Call: rq(formula = ' + formulaText(ctx, des) + ', tau = ' + tau + ', data = d)', '', 'tau: [1] ' + tau, '', 'Coefficients (se = "nid"):', ...printCoefmat(des.names, ['Value', 'Std. Error', 't value', 'Pr(>|t|)'], rows)] });
});

// ---------- spline: lm(y ~ splines::ns(v, df = k) + …) for numeric predictors ----------
register('spline', ctx => {
  start(ctx); const k = ctx.num('df', 4, { min: 2, max: 30, integer: true }), d = ctx.d, warns = [], names = {}, terms = [], groups = [];
  ctx.x.forEach(v => {
    if (!d.isNumeric(v)) { groups.push({ label: v, n: 1 }); terms.push({ vars: [v] }); return; }
    const lab = 'splines::ns(' + v + ', df = ' + k + ')', B = ns(Array.from(d.get(v)), k, warns).basis;
    for (let j = 0; j < k; j++) { const key = '.ns.' + v + '.' + j; d.set(key, B.map(r => r[j])); names[key] = lab + (j + 1); terms.push({ vars: [key] }); }
    groups.push({ label: lab, n: k });
  });
  warns.forEach(w => ctx.warn(w));
  const des = design(d, ctx.y[0], terms), termOf = []; groups.forEach((g, gi) => { for (let j = 0; j < g.n; j++) termOf.push(gi + 1); });
  des.names = des.names.map(nm => names[nm] ?? (nm.startsWith('.ns.') ? names[nm.replace(/(\.ns\.[^.]+\.\d+).*/, '$1')] : nm));
  des.assign = des.assign.map(a => a === 0 ? 0 : termOf[a - 1]); des.termLabels = groups.map(g => g.label);
  const m = lm(des); m.formulaText = ctx.y[0] + ' ~ ' + des.termLabels.join(' + ');
  fitout(ctx, m);
});

// ---------- gam: mgcv::gam(y ~ s(v, k = min(k, unique − 1)) + …, family, method = 'REML') ----------
register('gam', ctx => {
  start(ctx); const k = ctx.num('df', 5, { min: 2, max: 30, integer: true });
  fitGam(ctx, k, ctx.opt('family', 'gaussian'), fitout);
});
