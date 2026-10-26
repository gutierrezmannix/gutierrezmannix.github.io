// Multilevel and panel models: lme4::lmer (mixed), lme4::glmer / glmer.nb (glmm), plm within / random with
// panel-clustered HC1 inference (panel_fe, panel_re) and plm::pgmm two-step difference GMM (panel_dynamic) —
// ports of the corresponding blocks in src/analysis-methods.R and of the R engine's fitout() merMod branch.
import { register } from '../registry.mjs';
import * as L from '../lib/linalg.mjs';
import * as D from '../lib/dist.mjs';
import { need, isFactor, modelMatrix } from '../lib/frame.mjs';
import { design, fitout } from '../lib/models.mjs';
import { printCoefmat, fmtSig } from '../lib/print.mjs';
import { mixedSetup, lmmFit, lmmDeviance, glmmFamily, pirls, glmerSetup, glmerStage2, glmmUnsc, nelderMead, deriv12, checkConv, minimize, brentFmin, thetaML, thetaLower, thetaStart, thetaT } from '../lib/multilevel-mixed.mjs';
import { panelFit, pgmmFit, uniqueCheck } from '../lib/multilevel-panel.mjs';

// the shared prelude of the R regression block: clean(); ff <- formula(); exposure check
function prelude(ctx) {
  ctx.clean(); ctx.rhs();
  if (ctx.fields('offset').length) { const ee = ctx.value('offset'); need(ee.every(v => v > 0), 'Exposure must be positive.'); return ee.map(Math.log); }
  return null;
}
const fixedTerms = ctx => ctx.x.map(v => ({ vars: [v] }));
// lme4's chkRank.drop.cols: keep the pivot columns of qr(X) (LINPACK, tol 1e-7)
function dropRank(des) {
  const Q = L.qrR(des.X, 1e-7); if (Q.rank === des.names.length) return des;
  const keep = Q.pivot.slice(0, Q.rank).sort((a, b) => a - b);
  return { ...des, X: des.X.map(r => keep.map(j => r[j])), names: keep.map(j => des.names[j]) };
}
// lme4::checkScaleX
function scaleWarn(ctx, X) {
  const sds = X[0].map((_, j) => j).filter(j => !X.every(r => r[j] === 0 || r[j] === 1)).map(j => L.sd(X.map(r => r[j])));
  const lg = sds.map(s => Math.abs(Math.log(s))); for (let i = 0; i < sds.length; i++) for (let j = 0; j < i; j++) lg.push(Math.abs(Math.log(sds[i] / sds[j])));
  if (lg.some(v => v > Math.log(1e3))) ctx.warn('Some predictor variables are on very different scales: consider rescaling');
}
// as.data.frame(VarCorr(m))
const varCorrRows = (grp, names, Sig, sigma2) => {
  const q = names.length, rows = names.map((nm, a) => [grp, nm, null, Sig[a][a], Math.sqrt(Sig[a][a])]);
  for (let j = 0; j < q; j++) for (let i = j + 1; i < q; i++) rows.push([grp, names[j], names[i], Sig[i][j], Sig[i][j] / Math.sqrt(Sig[i][i] * Sig[j][j])]);
  if (sigma2 !== null) rows.push(['Residual', null, null, sigma2, Math.sqrt(sigma2)]);
  return rows;
};
const NOTE_MIXED = 'Mixed-model fixed-effect intervals are asymptotic Wald intervals. Linear mixed-model t statistics have no automatically assigned finite-sample p-values.';

register(['mixed', 'glmm'], ctx => {
  prelude(ctx);
  need(ctx.subject.length === 1, 'Choose a grouping identifier.');
  const sub = ctx.subject[0], gf = ctx.group(ctx.value('subject')); ctx.d.set(sub, gf);
  const slope = ctx.opt('randomSlope', ''); need(!slope || ctx.x.includes(slope), 'Random slope must be a selected predictor.');
  const fam = ctx.id === 'glmm' ? ctx.opt('family', 'binomial') : null;
  if (ctx.id === 'glmm') need(['binomial', 'poisson', 'negbin'].includes(fam), 'argument is of length zero');
  const yname = ctx.y[0], yraw = ctx.d.get(yname);
  if (ctx.id === 'mixed') need(!isFactor(yraw), 'response must be numeric');
  const y = isFactor(yraw) ? yraw.codes.map(c => fam === 'binomial' ? (c > 0 ? 1 : 0) : c + 1) : Array.from(yraw);
  const des = dropRank(design(ctx.d, null, fixedTerms(ctx)));
  const zmm = modelMatrix(ctx.d, slope ? [{ vars: [slope] }] : [], { intercept: true }), znames = zmm.names, q = znames.length;
  const n = y.length, G = gf.nlevels, term = (slope ? '1 + ' + slope : '1') + ' | ' + sub;
  if (ctx.id === 'mixed') {
    need(G < n, 'number of levels of each grouping factor must be < number of observations (problems: ' + sub + ')');
    need(n > G * q, 'number of observations (=' + n + ') <= number of random effects (=' + G * q + ') for term (' + term + '); the random-effects parameters and the residual variance (or scale parameter) are probably unidentifiable');
  } else {
    need(G <= n, 'number of levels of each grouping factor must be <= number of observations (problems: ' + sub + ')');
    need(n >= G * q, 'number of observations (=' + n + ') < number of random effects (=' + G * q + ') for term (' + term + '); the random-effects parameters are probably unidentifiable');
    if (fam === 'binomial') need(y.every(v => v >= 0 && v <= 1), 'y values must be 0 <= y <= 1');
    else need(y.every(v => v >= 0), "negative values not allowed for the 'Poisson' family");
    need(!y.every(v => v === y[0]), 'Response is constant');
  }
  const S = mixedSetup(des.X, y, zmm.X, gf.codes, G), lower = thetaLower(q), ntheta = S.ntheta, p = des.names.length;
  scaleWarn(ctx, des.X);
  const formula = yname + ' ~ ' + ctx.x.join(' + ') + ' + (' + term + ')';
  let m;
  if (ctx.id === 'mixed') {
    const reml = ctx.opt('reml', true) === true, f = lmmDeviance(S, reml);
    const opt = minimize(f, thetaStart(q), lower), th = opt.par, fit = lmmFit(S, th, reml);
    need(!!fit, 'Downdated VtV is not positive definite');
    const msgs = checkConv(deriv12(f, th, opt.value), th, lower, ntheta);
    const s2 = fit.sigma2, V = L.scale(L.cholInv(L.mul(fit.RX, L.t(fit.RX))), s2), T = thetaT(th, q);
    const vc = varCorrRows(sub, znames, L.scale(L.mul(T, L.t(T)), s2), s2);
    m = mixedModel({ n, des, beta: fit.beta, se: V.map((r, i) => Math.sqrt(r[i])), lmm: true, msgs, th, lower, vc, logLik: -opt.value / 2, dfLL: p + ntheta + 1, pred: fit.fitted, sub, G,
      header: [reml ? "Linear mixed model fit by REML ['lmerMod']" : "Linear mixed model fit by maximum likelihood  ['lmerMod']", 'Formula: ' + formula, (reml ? 'REML criterion at convergence: ' : 'Deviance: ') + fmtSig(opt.value, 6)] });
    ctx.note(NOTE_MIXED);
    if (!slope) ctx.table('Intraclass correlation', ['ICC'], [[vc[0][3] / (vc[0][3] + vc[1][3])]]);
  } else {
    const lowerAll = [...lower, ...new Array(p).fill(-Infinity)];
    // a glmer fit: stage 1 (nAGQ = 0, bobyqa → exact minimum) over theta, then lme4's Nelder_Mead on the Laplace
    // deviance over (theta, beta) with optwrap's adjusted steps, then check.boundary
    const glmer = family => {
      const st = glmerSetup(S, family), o1 = minimize(st.dev0, thetaStart(q), lower), s1 = pirls(S, family, o1.par, null, st.lp0init, false);
      const unsc = L.cholInv(L.mul(s1.RX, L.t(s1.RX))), xst = [...new Array(ntheta).fill(0.02), ...unsc.map((r, i) => 0.2 * Math.min(Math.sqrt(r[i]), 10))];
      const r = stage2(family, s1.eta, [...o1.par, ...s1.beta], xst, xst.map(v => v * 5e-4));
      r.boundary = true; return r;
    };
    const stage2 = (family, lp0, start, xst, xt) => { const s2 = glmerStage2(S, family, lp0), opt = nelderMead(s2.f, start, lowerAll, xst, xt); if (opt.status === 'evals') { ctx.warn('failure to converge in 10000 evaluations'); ctx.warn('convergence code 4 from Nelder_Mead: failure to converge in 10000 evaluations'); } return { opt, s2, family }; };
    const finish = r => {
      let par = r.opt.par; const derivs = deriv12(r.s2.f, par, r.opt.value), msgs = checkConv(derivs, par, lower, ntheta);
      if (r.boundary) { const pp = par.slice(); lower.forEach((lo, i) => { if (lo === 0 && par[i] > 0 && par[i] < 1e-5) { const tp = pp.slice(); tp[i] = 0; if (r.s2.f(tp) < r.opt.value) pp[i] = 0; } }); par = pp; r.opt.value = r.s2.f(par); }
      const full = r.s2.evalAt(par);
      let V = null, bad = false;
      try { const Hi = L.inv(derivs.Hessian), idx = par.map((_, i) => i).slice(ntheta); V = idx.map(a => idx.map(b => Hi[a][b] + Hi[b][a])); bad = V.some(row => row.some(v => !Number.isFinite(v))) || Math.min(...L.eigenSym(V).values) <= 0; } catch (e) { bad = true; }
      if (bad) { ctx.warn('variance-covariance matrix computed from finite-difference Hessian is\nnot positive definite or contains NA values: falling back to var-cov estimated from RX'); V = glmmUnsc(S, r.family, par, full); }
      return { par, value: r.opt.value, msgs, V, full };
    };
    let res, famLabel, nbTheta = null;
    if (fam !== 'negbin') { res = finish(glmer(glmmFamily(fam))); famLabel = fam + '  ( ' + (fam === 'binomial' ? 'logit' : 'log') + ' )'; }
    else {
      // glmer.nb: Poisson GLMM → theta.ml on its fitted means → glmer(negative.binomial(theta)) → optimize() over
      // log(theta) of −2 logLik of refit(), each refit starting its PIRLS from the previous fit's random effects only
      const pois = finish(glmer(glmmFamily('poisson'))); pois.msgs.filter(s => !/singular/.test(s)).forEach(s => ctx.warn(s));
      const tm = thetaML(y, pois.full.mu, { limit: 20, eps: 1e-4 }); tm.warnings.forEach(w => ctx.warn(w));
      let last = glmer(glmmFamily('negbin', tm.theta)), lastT = Math.log(tm.theta);
      const refit = t => { const family = glmmFamily('negbin', Math.exp(t)), par = last.opt.par, eta0 = y.map(v => family.linkfun(family.mustart(v))), lp0 = pirls(S, family, par.slice(0, ntheta), null, eta0, true).eta; last = stage2(family, lp0, par, par.map(() => 0.02), par.map(() => 1e-5)); lastT = t; return last.opt.value; };
      const o = brentFmin(refit, Math.log(tm.theta) - 3, Math.log(tm.theta) + 3, 5e-5); refit(o.minimum); // optimize() re-evaluates f at the minimum
      need(Math.abs(o.minimum - lastT) <= 1.5e-8 * Math.abs(o.minimum), 'all.equal(optval$minimum, log(getNBdisp(lastfit))) is not TRUE');
      nbTheta = Math.exp(lastT); res = finish(last); famLabel = 'Negative Binomial(' + fmtSig(nbTheta, 4) + ')  ( log )';
    }
    const th = res.par.slice(0, ntheta), T = thetaT(th, q), vc = varCorrRows(sub, znames, L.mul(T, L.t(T)), null);
    m = mixedModel({ n, des, beta: res.par.slice(ntheta), se: res.V.map((r, i) => Math.sqrt(r[i])), lmm: false, msgs: res.msgs, th, lower, vc, logLik: -res.value / 2, dfLL: p + ntheta + (nbTheta === null ? 0 : 1), pred: res.full.mu, sub, G,
      header: ['Generalized linear mixed model fit by maximum likelihood (Laplace Approximation) [glmerMod]', ' Family: ' + famLabel, 'Formula: ' + formula] });
    ctx.note(NOTE_MIXED);
  }
  fitout(ctx, m);
});

function mixedModel(o) {
  const { n, des, beta, se, lmm, msgs, th, lower, vc } = o, isSing = lower.some((lo, i) => lo === 0 && th[i] < 1e-4);
  const rows = beta.map((b, j) => lmm ? [b, se[j], b / se[j]] : [b, se[j], b / se[j], 2 * D.pnorm(-Math.abs(b / se[j]))]);
  const columns = lmm ? ['Estimate', 'Std. Error', 't value'] : ['Estimate', 'Std. Error', 'z value', 'Pr(>|z|)'];
  const m = { kind: 'merMod', n, nobs: n, coefTable: { rownames: des.names, columns, rows }, crit: 'z', logLik: o.logLik, AIC: -2 * o.logLik + 2 * o.dfLL, BIC: -2 * o.logLik + Math.log(n) * o.dfLL };
  m.summaryText = () => [...o.header, '', 'Random effects:', ...vc.map(r => '  ' + [r[0], r[1] ?? '', r[2] ?? '', fmtSig(r[3], 5), fmtSig(r[4], 5)].join('  ')), 'Number of obs: ' + n + ', groups:  ' + o.sub + ', ' + o.G, '', 'Fixed effects:', ...printCoefmat(des.names, columns, rows), ...msgs];
  m.mixedHook = ctx => {
    need(!msgs.length || msgs.every(s => /singular/.test(s)), 'The mixed model did not converge.');
    ctx.table('Random-effect variances', ['grp', 'var1', 'var2', 'vcov', 'sdcor'], vc);
    ctx.note('Singular fit: ' + (isSing ? 'TRUE' : 'FALSE'));
  };
  m.predictions = () => ({ columns: ['Prediction'], rows: o.pred.map(v => [v]) });
  return m;
}

// ---------- panels ----------
register(['panel_fe', 'panel_re', 'panel_dynamic'], ctx => {
  prelude(ctx); uniqueCheck(ctx);
  if (ctx.id === 'panel_dynamic') pgmmFit(ctx); else panelFit(ctx);
});
