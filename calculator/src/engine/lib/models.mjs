// lm(), glm() and the R engine's fitout(): coefficient table, model summary, ANOVA, residual plots,
// diagnostics and predictions, reproduced from R's lm.fit / glm.fit / summary / anova / predict.
import * as L from './linalg.mjs';
import * as D from './dist.mjs';
import { modelMatrix, need, isFactor } from './frame.mjs';
import { svgPlot, qqData } from './plot.mjs';
import { printCoefmat, fmtSig, fmtP } from './print.mjs';

const EPS = 2.220446049250313e-16;

// ---------- families (as stats::binomial(), poisson(), gaussian()) ----------
export const families = {
  gaussian: () => ({ family: 'gaussian', link: 'identity', linkfun: m => m, linkinv: e => e, muEta: () => 1, variance: () => 1, devResid: (y, m, w) => w * (y - m) ** 2, validMu: () => true, init: y => y.slice(), aic: (y, n, mu, wt, dev) => { const nobs = y.length; return nobs * (Math.log(2 * Math.PI * dev / nobs) + 1) + 2; }, dispersionFree: false }),
  binomial: (link = 'logit') => {
    const thresh = -D.qnorm(EPS);
    const L2 = link === 'probit'
      ? { linkfun: m => D.qnorm(m), linkinv: e => D.pnorm(Math.min(Math.max(e, -thresh), thresh)), muEta: e => Math.max(D.dnorm(e), EPS) }
      : { linkfun: m => Math.log(m / (1 - m)), linkinv: e => e < -30 ? EPS : e > 30 ? 1 - EPS : 1 / (1 + Math.exp(-e)), muEta: e => { const o = Math.exp(-Math.abs(e)); return Math.max(o / ((1 + o) * (1 + o)), EPS); } };
    return { family: 'binomial', link, ...L2, variance: m => m * (1 - m), devResid: (y, m, w) => 2 * w * ((y > 0 ? y * Math.log(y / m) : 0) + (y < 1 ? (1 - y) * Math.log((1 - y) / (1 - m)) : 0)), validMu: m => m > 0 && m < 1, init: (y, w) => y.map((v, i) => (w[i] * v + 0.5) / (w[i] + 1)), aic: (y, n, mu, wt) => -2 * y.reduce((s, v, i) => s + (wt[i] > 0 ? D.dbinom(Math.round(v), 1, mu[i], true) : 0), 0), dispersionFree: true };
  },
  poisson: () => ({ family: 'poisson', link: 'log', linkfun: m => Math.log(m), linkinv: e => Math.max(Math.exp(e), EPS), muEta: e => Math.max(Math.exp(e), EPS), variance: m => m, devResid: (y, m, w) => { const r = m * w; return y > 0 ? 2 * (w * (y * Math.log(y / m) - (y - m))) : 2 * r; }, validMu: m => Number.isFinite(m) && m > 0, init: y => y.map(v => v + 0.1), aic: (y, n, mu, wt) => -2 * y.reduce((s, v, i) => s + D.dpois(v, mu[i], true) * wt[i], 0), dispersionFree: true }),
};

// ---------- design ----------
export function design(d, y, terms, { intercept = true, contrasts = {}, offset = null } = {}) {
  const mm = modelMatrix(d, terms, { intercept, contrasts });
  const yv = y === null ? null : Array.from(d.get(y)), off = offset ? Array.from(offset) : null;
  return { ...mm, y: yv, offset: off, termLabels: terms.map(t => t.vars.join(':')), n: d.n };
}

// ---------- lm ----------
export function lm(des, { weights = null } = {}) {
  const { X, y, names, assign } = des, n = X.length, w = weights || null;
  const yy = des.offset ? y.map((v, i) => v - des.offset[i]) : y;
  const fit = L.lsfit(X, yy, w, 1e-7), p = fit.rank, df = n - p;
  const fitted = des.offset ? fit.fitted.map((v, i) => v + des.offset[i]) : fit.fitted, resid = y.map((v, i) => v - fitted[i]);
  const rss = resid.reduce((s, r, i) => s + (w ? w[i] : 1) * r * r, 0), sigma = Math.sqrt(rss / df), V = L.covUnscaled(fit);
  const se = names.map((_, j) => Math.sqrt(V[j][j]) * sigma);
  const m = { kind: 'lm', des, names, assign, coef: fit.coef, se, V, fit, n, rank: p, dfResidual: df, sigma, rss, fitted, resid, weights: w, y };
  const sw = w ? w.reduce((s, v) => s + Math.log(v), 0) : 0;
  m.logLik = 0.5 * (sw - n * (Math.log(2 * Math.PI) + 1 - Math.log(n) + Math.log(rss)));
  m.dfLL = p + 1; m.AIC = -2 * m.logLik + 2 * m.dfLL; m.BIC = -2 * m.logLik + Math.log(n) * m.dfLL;
  // summary.lm coefficients (non-aliased only)
  const keep = names.map((_, j) => !Number.isNaN(fit.coef[j]));
  m.coefTable = { rownames: names.filter((_, j) => keep[j]), columns: ['Estimate', 'Std. Error', 't value', 'Pr(>|t|)'], rows: names.map((_, j) => j).filter(j => keep[j]).map(j => { const tv = fit.coef[j] / se[j]; return [fit.coef[j], se[j], tv, 2 * D.pt(-Math.abs(tv), df)]; }) };
  m.crit = 't';
  const mss = (() => { const int = names[0] === '(Intercept)'; if (int) { const mu = mean(fitted, w); return fitted.reduce((s, f, i) => s + (w ? w[i] : 1) * (f - mu) ** 2, 0); } return fitted.reduce((s, f, i) => s + (w ? w[i] : 1) * f * f, 0); })();
  const dfInt = names[0] === '(Intercept)' ? 1 : 0;
  m.r2 = mss / (mss + rss); m.adjr2 = 1 - (1 - m.r2) * ((n - dfInt) / df); m.fstat = (mss / (p - dfInt)) / (rss / df); m.fdf = [p - dfInt, df];
  return m;
}
function mean(a, w) { if (!w) return a.reduce((s, v) => s + v, 0) / a.length; let s = 0, sw = 0; a.forEach((v, i) => { s += w[i] * v; sw += w[i]; }); return s / sw; }

export function anovaLm(m) {
  const { fit, assign, des } = m, p = fit.rank, eff = fit.effects, asgn = fit.pivot.slice(0, p).map(j => assign[j]);
  const rows = [], rn = [];
  const terms = [...new Set(asgn)].filter(a => a > 0).sort((a, b) => a - b);
  for (const ti of terms) { let ss = 0, df = 0; asgn.forEach((a, k) => { if (a === ti) { ss += eff[k] ** 2; df++; } }); rn.push(des.termLabels[ti - 1]); rows.push([df, ss, ss / df]); }
  const rdf = m.dfResidual, rss = m.rss, rms = rss / rdf;
  const out = rows.map(([df, ss, ms]) => { const F = ms / rms; return [df, ss, ms, F, D.pf(F, df, rdf, false)]; });
  if (rdf > 0) { out.push([rdf, rss, rms, NaN, NaN]); rn.push('Residuals'); }
  return { rownames: rn, columns: ['Df', 'Sum Sq', 'Mean Sq', 'F value', 'Pr(>F)'], rows: out };
}

// ---------- glm (IRLS as glm.fit) ----------
export function glm(des, fam, { weights = null, maxit = 25, epsilon = 1e-8, start = null, mustart = null, noNull = false } = {}) {
  const { X, y, names } = des, n = X.length, p = names.length, wt = weights || new Array(n).fill(1), off = des.offset || new Array(n).fill(0);
  let mu = mustart ? mustart.slice() : fam.init(y, wt), eta = mu.map(fam.linkfun);
  if (start) { eta = X.map((r, i) => L.dot(r, start) + off[i]); mu = eta.map(fam.linkinv); }
  const dev = mu2 => y.reduce((s, v, i) => s + fam.devResid(v, mu2[i], wt[i]), 0);
  let devold = dev(mu), conv = false, coef = start ? start.slice() : new Array(p).fill(0), fit = null, iter = 0, boundary = false, coefold = start ? start.slice() : null, warnings = [];
  for (iter = 1; iter <= maxit; iter++) {
    const me = eta.map(fam.muEta), varmu = mu.map(fam.variance), good = wt.map((w, i) => w > 0 && me[i] !== 0);
    const rowsX = [], z = [], w = [], gi = [];
    for (let i = 0; i < n; i++) if (good[i]) { const wi = Math.sqrt(wt[i] * me[i] * me[i] / varmu[i]); gi.push(i); w.push(wi); z.push((eta[i] - off[i]) + (y[i] - mu[i]) / me[i]); rowsX.push(X[i]); }
    const Xw = rowsX.map((r, k) => r.map(v => v * w[k])), zw = z.map((v, k) => v * w[k]);
    fit = L.lsfit(Xw, zw, null, Math.min(1e-7, epsilon / 1000));
    let st = fit.coef.map(v => Number.isNaN(v) ? 0 : v);
    eta = X.map((r, i) => L.dot(r, st) + off[i]); mu = eta.map(fam.linkinv);
    let devNew = dev(mu);
    if (!Number.isFinite(devNew)) { if (!coefold) throw new Error('no valid set of coefficients has been found: please supply starting values'); let ii = 1; while (!Number.isFinite(devNew)) { if (ii > maxit) throw new Error('inner loop 1; cannot correct step size'); ii++; st = st.map((v, j) => (v + coefold[j]) / 2); eta = X.map((r, i) => L.dot(r, st) + off[i]); mu = eta.map(fam.linkinv); devNew = dev(mu); } boundary = true; }
    if (!mu.every(fam.validMu)) { if (!coefold) throw new Error('no valid set of coefficients has been found: please supply starting values'); let ii = 1; while (!mu.every(fam.validMu)) { if (ii > maxit) throw new Error('inner loop 2; cannot correct step size'); ii++; st = st.map((v, j) => (v + coefold[j]) / 2); eta = X.map((r, i) => L.dot(r, st) + off[i]); mu = eta.map(fam.linkinv); } boundary = true; devNew = dev(mu); }
    coef = fit.coef.map((v, j) => Number.isNaN(v) ? NaN : st[j]);
    if (Math.abs(devNew - devold) / (Math.abs(devNew) + 0.1) < epsilon) { conv = true; devold = devNew; break; }
    devold = devNew; coefold = st;
  }
  if (!conv) warnings.push('glm.fit: algorithm did not converge');
  if (fam.family === 'binomial' && mu.some(m => m > 1 - 10 * EPS || m < 10 * EPS)) warnings.push('glm.fit: fitted probabilities numerically 0 or 1 occurred');
  if (fam.family === 'poisson' && mu.some(m => m < 10 * EPS)) warnings.push('glm.fit: fitted rates numerically 0 occurred');
  const rank = fit.rank, dfr = n - rank, devRes = devold;
  const me = eta.map(fam.muEta), wwork = mu.map((m, i) => wt[i] * me[i] * me[i] / fam.variance(m));
  const pearson = y.reduce((s, v, i) => s + wwork[i] * ((v - mu[i]) / me[i]) ** 2, 0);
  const dispersion = fam.dispersionFree ? 1 : dfr > 0 ? pearson / dfr : NaN;
  const Vu = L.covUnscaled(fit), se = names.map((_, j) => Math.sqrt(Vu[j][j] * dispersion));
  const keep = coef.map(v => !Number.isNaN(v)), stat = fam.dispersionFree ? 'z' : 't';
  const aic = fam.aic(y, n, mu, wt, devRes) + 2 * rank;
  const m = { kind: 'glm', family: fam, des, names, coef, se, V: Vu.map(r => r.map(v => v * dispersion)), n, rank, dfResidual: dfr, deviance: devRes, nullDeviance: noNull ? NaN : nullDeviance(y, wt, fam, off, names[0] === '(Intercept)'), aic, iter, converged: conv, boundary, mu, eta, y, dispersion, warnings, weights: wt };
  m.coefTable = { rownames: names.filter((_, j) => keep[j]), columns: ['Estimate', 'Std. Error', stat + ' value', stat === 'z' ? 'Pr(>|z|)' : 'Pr(>|t|)'], rows: names.map((_, j) => j).filter(j => keep[j]).map(j => { const tv = coef[j] / se[j]; return [coef[j], se[j], tv, stat === 'z' ? 2 * D.pnorm(-Math.abs(tv)) : 2 * D.pt(-Math.abs(tv), dfr)]; }) };
  m.crit = 'z';
  const pll = rank + (['gaussian', 'Gamma', 'inverse.gaussian'].includes(fam.family) ? 1 : 0);
  m.logLik = pll - aic / 2; m.dfLL = pll; m.AIC = -2 * m.logLik + 2 * pll; m.BIC = -2 * m.logLik + Math.log(n) * pll;
  m.fitted = mu; m.resid = y.map((v, i) => (v - mu[i]) / me[i]);
  return m;
}
function nullDeviance(y, wt, fam, off, intercept) {
  if (!intercept) return y.reduce((s, v, i) => s + fam.devResid(v, fam.linkinv(off[i]), wt[i]), 0);
  if (off.every(v => v === 0)) { const mu = y.reduce((s, v, i) => s + wt[i] * v, 0) / wt.reduce((s, v) => s + v, 0); return y.reduce((s, v, i) => s + fam.devResid(v, mu, wt[i]), 0); }
  try { const des = { X: y.map(() => [1]), y, names: ['(Intercept)'], offset: off }; return glm(des, fam, { weights: wt, noNull: true }).deviance; } catch (e) { return NaN; }
}

// ---------- lm helpers used by fitout ----------
export function predictLmInterval(m, level) {
  const { X } = m.des, V = m.V, q = D.qt((1 + level) / 2, m.dfResidual), keep = m.coef.map(v => !Number.isNaN(v));
  return X.map((row, i) => { let s = 0; for (let a = 0; a < row.length; a++) { if (!keep[a]) continue; for (let b = 0; b < row.length; b++) if (keep[b]) s += row[a] * V[a][b] * row[b]; } const se = Math.sqrt(s * m.sigma * m.sigma + m.sigma * m.sigma), f = m.fitted[i]; return [f, f - q * se, f + q * se]; });
}
export function bptest(m) {
  const { X } = m.des, n = X.length, r2 = m.resid.map(r => r * r), mu = r2.reduce((a, b) => a + b, 0) / n;
  const aux = L.lsfit(X, r2), ess = aux.fitted.reduce((s, f) => s + (f - mu) ** 2, 0), tss = r2.reduce((s, v) => s + (v - mu) ** 2, 0);
  const bp = n * ess / tss, df = aux.rank - 1, p = D.pchisq(bp, df, false);
  return ['', '\tstudentized Breusch-Pagan test', '', 'data:  m', 'BP = ' + fmtSig(bp, 5) + ', df = ' + df + ', p-value = ' + fmtP(p), ''];
}
export function vifText(m) {
  const { des } = m, terms = des.termLabels; if (terms.length < 2) return ['Error in vif.default(m) : model contains fewer than 2 terms'];
  const cols = des.names.map((nm, j) => j).filter(j => des.names[j] !== '(Intercept)'), Xc = des.X.map(r => cols.map(j => r[j]));
  const n = Xc.length, k = cols.length, means = cols.map((_, j) => Xc.reduce((s, r) => s + r[j], 0) / n);
  const C = L.zeros(k, k); for (const r of Xc) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) C[a][b] += (r[a] - means[a]) * (r[b] - means[b]);
  const R = C.map((row, a) => row.map((v, b) => v / Math.sqrt(C[a][a] * C[b][b])));
  const assign = cols.map(j => des.assign[j]), detR = L.det(R), out = [];
  terms.forEach((lab, ti) => { const idx = assign.map((a, q) => a === ti + 1 ? q : -1).filter(q => q >= 0), oth = assign.map((a, q) => a !== ti + 1 ? q : -1).filter(q => q >= 0); const g = L.det(L.sub(R, idx, idx)) * L.det(L.sub(R, oth, oth)) / detR; out.push([lab, g, idx.length]); });
  if (out.every(r => r[2] === 1)) return [out.map(r => r[0].padStart(12)).join(''), out.map(r => fmtSig(r[1], 6).padStart(12)).join('')];
  return ['             GVIF Df GVIF^(1/(2*Df))', ...out.map(r => r[0].padEnd(8) + fmtSig(r[1], 6).padStart(10) + String(r[2]).padStart(3) + fmtSig(Math.pow(r[1], 1 / (2 * r[2])), 6).padStart(16))];
}
export function summaryLmText(m) {
  const res = m.resid.slice().sort((a, b) => a - b), q = p => { const h = (res.length - 1) * p, lo = Math.floor(h); return res[lo] + (h - lo) * (res[Math.min(lo + 1, res.length - 1)] - res[lo]); };
  const ct = m.coefTable;
  return ['', 'Call:', 'lm(formula = ' + (m.formulaText || 'y ~ x') + ')', '', 'Residuals:', '    Min      1Q  Median      3Q     Max ', [0, 0.25, 0.5, 0.75, 1].map(p => fmtSig(q(p), 4).padStart(8)).join(''), '', 'Coefficients:', ...printCoefmat(ct.rownames, ct.columns, ct.rows), '---', "Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1", '',
    'Residual standard error: ' + fmtSig(m.sigma, 4) + ' on ' + m.dfResidual + ' degrees of freedom', 'Multiple R-squared:  ' + fmtSig(m.r2, 4) + ',\tAdjusted R-squared:  ' + fmtSig(m.adjr2, 4), 'F-statistic: ' + fmtSig(m.fstat, 4) + ' on ' + m.fdf[0] + ' and ' + m.fdf[1] + ' DF,  p-value: ' + fmtP(D.pf(m.fstat, m.fdf[0], m.fdf[1], false)), ''];
}
export function summaryGlmText(m) {
  const ct = m.coefTable;
  return ['', 'Call:', 'glm(formula = ' + (m.formulaText || 'y ~ x') + ', family = ' + m.family.family + '(link = "' + m.family.link + '"))', '', 'Coefficients:', ...printCoefmat(ct.rownames, ct.columns, ct.rows), '---', "Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1", '',
    '(Dispersion parameter for ' + m.family.family + ' family taken to be ' + fmtSig(m.dispersion, 7) + ')', '', '    Null deviance: ' + fmtSig(m.nullDeviance, 5) + '  on ' + (m.n - (m.names[0] === '(Intercept)' ? 1 : 0)) + '  degrees of freedom', 'Residual deviance: ' + fmtSig(m.deviance, 5) + '  on ' + m.dfResidual + '  degrees of freedom', 'AIC: ' + fmtSig(m.aic, 5), '', 'Number of Fisher Scoring iterations: ' + m.iter, ''];
}

// ---------- fitout (the R engine's common model output) ----------
// m: { kind, n|nobs, coefTable | null, crit ('t'|'z'), dfResidual, converged, logLik, AIC, BIC, summaryText(), predictions(level) → {columns, rows} | null }
export function fitout(ctx, m) {
  ctx.model = m;
  const used = m.nobs ?? m.n; ctx.used = Number.isFinite(used) ? used : ctx.d.n;
  ctx.diag(m.summaryText ? m.summaryText() : m.kind === 'lm' ? summaryLmText(m) : m.kind === 'glm' ? summaryGlmText(m) : []);
  if (m.converged === false) throw new (ctx.GMError)('The model did not converge. Estimates are not released.');
  if (m.mixedHook) m.mixedHook(ctx);
  const co = m.coefTable;
  if (co) {
    need(co.columns.length >= 2 && co.rows.every(r => Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > 0), 'Coefficient estimates or standard errors are not finite/positive. Review model identification and convergence.');
    let rows = co.rows.map((r, i) => [co.rownames[i], ...r]);
    rows = rows.filter(r => r[0] !== '(Intercept)').concat(rows.filter(r => r[0] === '(Intercept)'));
    const crit = m.crit === 't' ? D.qt(1 - ctx.alpha / 2, m.dfResidual) : D.qnorm(1 - ctx.alpha / 2);
    rows = rows.map(r => [...r, r[1] - crit * r[2], r[1] + crit * r[2]]);
    ctx.table('Coefficients', ['Term', ...co.columns, 'Lower CI', 'Upper CI'], rows);
  }
  ctx.table('Model summary', ['Statistic', 'Value'], [['Number of observations', ctx.used], ['Log likelihood', num(m.logLik)], ['AIC', num(m.AIC)], ['BIC', num(m.BIC)]]);
  if (m.kind === 'lm') {
    need(m.coef.every(v => !Number.isNaN(v)), 'The model is rank deficient. Remove redundant predictors or empty interaction cells.');
    const a = anovaLm(m); ctx.table('Analysis of variance', ['Term', ...a.columns], a.rows.map((r, i) => [a.rownames[i], ...r]));
    ctx.plot('Residuals versus fitted', svgPlot({ xlab: 'Fitted', ylab: 'Residual', layers: [{ type: 'points', x: m.fitted, y: m.resid, color: ctx.accent, alpha: 0.45 }, { type: 'hline', y: 0, dash: true }] }));
    const qq = qqData(m.resid, D.qnorm);
    ctx.plot('Residual Q–Q plot', svgPlot({ xlab: 'Theoretical Quantiles', ylab: 'Sample Quantiles', main: 'Normal Q-Q Plot', layers: [{ type: 'points', x: qq.theoretical, y: qq.sample, color: ctx.accent }, { type: 'abline', a: qq.intercept, b: qq.slope }] }));
    ctx.diag(bptest(m)); ctx.diag(vifText(m));
  }
  if (m.kind === 'glm' && m.family.family === 'binomial') { const yy = m.y; need(!m.eta.every((e, i) => (e > 0) === (yy[i] === 1)), 'Perfect classification detected. Check separation before interpreting this binary model.'); }
  let pp = null; try { pp = m.kind === 'lm' ? { columns: ['fit', 'lwr', 'upr'], rows: predictLmInterval(m, ctx.level) } : m.predictions ? m.predictions(ctx.level) : null; } catch (e) { pp = null; }
  if (pp) { if (pp.warning) ctx.warn(pp.warning); ctx.table('Predictions: first 200 analysis rows', pp.columns, pp.rows.slice(0, 200), pp.rows.length > 200 ? 200 : pp.rows.length); }
}
const num = v => Number.isFinite(v) ? v : null;
export { isFactor };
