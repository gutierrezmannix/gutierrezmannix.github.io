// Principal components and exploratory factor analysis — ports of the pca/efa block in src/analysis-methods.R,
// of stats::prcomp, and of psych 2.4's fa()/fac(): smc starting values, minres / ML fits by optim's L-BFGS-B
// (exact port, lib/scales-lbfgsb.mjs) and principal-axis iteration; psych's sign and column-order conventions;
// rotations stats::varimax, psych::kaiser + Promax (promax) and GPArotation::GPFoblq (oblimin, quartimin);
// regression (Thurstone) factor scores; KMO and Bartlett diagnostics.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import * as L from '../lib/linalg.mjs';
import { isFactor, need } from '../lib/frame.mjs';
import { svgPlot } from '../lib/plot.mjs';
import { fmtSig, printTable } from '../lib/print.mjs';
import { optimLBFGSB } from '../lib/scales-lbfgsb.mjs';

const EPS = 2.220446049250313e-16;
const colSums = A => A[0].map((_, j) => A.reduce((s, r) => s + r[j], 0));
const diagOf = A => A.map((r, i) => r[i]);
const tcross = A => L.mul(A, L.t(A));
const r2 = v => fmtSig(Math.round(v * 100) / 100, 3);

function prepare(ctx) {
  const vars = ctx.variables;
  need(vars.length >= 2, 'Select at least two numeric variables.');
  const keep = ctx.d.complete(ctx.allFields().filter(k => ctx.d.has(k)));
  ctx.clean();
  const cols = vars.map(v => ctx.d.get(v));
  const sdOk = c => { if (c.length < 2) return false; const m = c.reduce((s, v) => s + v, 0) / c.length; return c.reduce((s, v) => s + (v - m) ** 2, 0) > 0; };
  need(cols.every(c => !isFactor(c) && c.every(v => typeof v === 'number')) && cols.every(sdOk), 'Variables must be numeric and nonconstant.');
  const n = ctx.d.n, Z = Array.from({ length: n }, (_, i) => cols.map(c => c[i]));
  return { vars, Z, n, p: vars.length, rn: keep.map(i => String(i + 1)) };
}
function standardize(Z, scale = true) {
  const n = Z.length, p = Z[0].length, mu = colSums(Z).map(s => s / n), sd = mu.map((m, j) => Math.sqrt(Z.reduce((s, r) => s + (r[j] - m) ** 2, 0) / (n - 1)));
  return Z.map(r => r.map((v, j) => (v - mu[j]) / (scale ? sd[j] : 1)));
}
function corr(Z) { const S = standardize(Z), n = Z.length; return L.crossprod(S).map(r => r.map(v => v / (n - 1))).map((r, i) => r.map((v, j) => i === j ? 1 : v)); }
const eig = A => L.eigenSym(A);

// ---------- PCA (prcomp) ----------
register('pca', ctx => {
  const { vars, Z, rn } = prepare(ctx), X = standardize(Z, ctx.opt('standardize', true) === true), n = X.length;
  const s = L.svd(X), k = s.d.length, sdev = s.d.map(d => d / Math.sqrt(Math.max(1, n - 1))), vv = sdev.map(v => v * v), tot = vv.reduce((a, b) => a + b, 0);
  const pcs = Array.from({ length: k }, (_, j) => 'PC' + (j + 1)), V = s.v, scores = L.mul(X, V);
  let cum = 0;
  ctx.table('Explained variance', ['Component', 'Eigenvalue', 'Proportion', 'Cumulative'], vv.map((v, j) => { cum += v; return [j + 1, v, v / tot, cum / tot]; }));
  ctx.table('Component loadings', ['Term', ...pcs], vars.map((v, i) => [v, ...V[i]]));
  ctx.table('Component scores', ['Term', ...pcs], scores.slice(0, 200).map((r, i) => [rn[i], ...r]), Math.min(200, n));
  ctx.plot('Scree plot', svgPlot({ xlab: 'Component', ylab: 'Eigenvalue', layers: [{ type: 'line', x: vv.map((_, i) => i + 1), y: vv, color: ctx.accent }, { type: 'points', x: vv.map((_, i) => i + 1), y: vv, color: ctx.accent }] }));
  ctx.diag(['Importance of components:', ...printTable(pcs, [sdev, vv.map(v => v / tot), vv.map((_, j) => vv.slice(0, j + 1).reduce((a, b) => a + b, 0) / tot)], ['Standard deviation', 'Proportion of Variance', 'Cumulative Proportion'])]);
});

// ---------- psych helpers ----------
function smc(R, warn) {
  const Ri = L.inv(R); let s = diagOf(Ri).map(v => 1 - 1 / v);
  if (Math.max(...s) > 1) { warn('In smc, smcs > 1 were set to 1.0'); s = s.map(v => v > 1 ? 1 : v); }
  if (Math.min(...s) < 0) { warn('In smc, smcs < 0 were set to .0'); s = s.map(v => v < 0 ? 0 : v); }
  return s;
}
const topLoad = (E, nf, f = v => Math.sqrt(Math.max(v, 0))) => E.vectors.map(r => r.slice(0, nf).map((v, j) => v * f(E.values[j])));
function faFit(S, nf, fm, ctx) {
  const p = S.length, sm = smc(S, m => ctx.diag(m)), upper = Math.max(...sm, 1), ps = new Array(p).fill(0.01);
  if (fm === 'minres' || fm === 'uls') {
    const fn = Psi => { const S2 = S.map((r, i) => r.map((v, j) => i === j ? 1 - Psi[i] : v)), E = eig(S2); E.values = E.values.map(v => v < EPS ? 100 * EPS : v); const Ld = topLoad(E, nf, Math.sqrt), M = tcross(Ld); let e = 0; for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) e += (S2[i][j] - M[i][j]) ** 2; if (fm === 'uls') { e *= 2; for (let i = 0; i < p; i++) e += (S2[i][i] - M[i][i]) ** 2; } return e; };
    const gr = Psi => { const Ld = topLoad(eig(S.map((r, i) => r.map((v, j) => i === j ? v - Psi[i] : v))), nf); const M = tcross(Ld); return Psi.map((ps_, i) => M[i][i] + ps_ - S[i][i]); };
    const res = optimLBFGSB(S.map((r, i) => r[i] - sm[i]), fn, gr, 0.005, upper, { parscale: ps });
    return { loadings: topLoad(eig(S.map((r, i) => r.map((v, j) => i === j ? v - res.par[i] : v))), nf), par: res.par };
  }
  if (fm === 'ml') {
    const scaled = Psi => { const sc = Psi.map(v => 1 / Math.sqrt(v)); return S.map((r, i) => r.map((v, j) => sc[i] * v * sc[j])); };
    const fn = Psi => { const e = eig(scaled(Psi)).values.slice(nf); return -(e.reduce((s, v) => s + Math.log(v) - v, 0) - nf + p); };
    const loadOut = Psi => { const E = eig(scaled(Psi)); return topLoad(E, nf, v => Math.sqrt(Math.max(v - 1, 0))).map((r, i) => r.map(v => v * Math.sqrt(Psi[i]))); };
    const gr = Psi => { const Ld = loadOut(Psi), M = tcross(Ld); return Psi.map((ps_, i) => (M[i][i] + ps_ - S[i][i]) / (ps_ * ps_)); };
    const start = sm.reduce((a, b) => a + b, 0) === nf && nf > 1 ? new Array(p).fill(0.5) : S.map((r, i) => r[i] - sm[i]);
    const res = optimLBFGSB(start, fn, gr, 0.005, upper, { parscale: ps });
    return { loadings: loadOut(res.par), par: res.par };
  }
  // principal axis (fm = 'pa')
  const R = S.map(r => r.slice()); sm.forEach((v, i) => { R[i][i] = v; });
  let comm = sm.reduce((a, b) => a + b, 0), err = comm, it = 1, Ld = null;
  while (err > 0.001) {
    Ld = topLoad(eig(R), nf, Math.sqrt); const nw = diagOf(tcross(Ld)), comm1 = nw.reduce((a, b) => a + b, 0);
    nw.forEach((v, i) => { R[i][i] = v; }); err = Math.abs(comm - comm1);
    if (Number.isNaN(err)) { ctx.warn('imaginary eigen value condition encountered in fa\n Try again with SMC=FALSE \n exiting fa'); break; }
    comm = comm1; it++; if (it > 50) { ctx.diag('maximum iteration exceeded'); err = 0; }
  }
  return { loadings: Ld };
}
// stats::varimax(x, normalize = TRUE, eps = 1e-5)
function varimax(x0, normalize = true, eps = 1e-5) {
  const nc = x0[0].length, p = x0.length, sc = x0.map(r => Math.sqrt(r.reduce((s, v) => s + v * v, 0))), x = normalize ? x0.map((r, i) => r.map(v => v / sc[i])) : x0;
  let TT = L.ident(nc), d = 0;
  for (let it = 1; it <= 1000; it++) {
    const z = L.mul(x, TT), cs = colSums(z.map(r => r.map(v => v * v))), B = L.mul(L.t(x), z.map(r => r.map((v, j) => v ** 3 - v * cs[j] / p)));
    const s = L.svd(B); TT = L.mul(s.u, L.t(s.v)); const dpast = d; d = s.d.reduce((a, b) => a + b, 0);
    if (d < dpast * (1 + eps)) break;
  }
  let z = L.mul(x, TT); if (normalize) z = z.map((r, i) => r.map(v => v * sc[i]));
  return { loadings: z, rotmat: TT };
}
// psych::Promax(x, m = 4) after psych::kaiser normalisation
function promaxKaiser(f, m = 4) {
  const h2 = f.map(r => r.reduce((s, v) => s + v * v, 0)), w = f.map((r, i) => r.map(v => v / Math.sqrt(h2[i])));
  const xx = varimax(w), x = xx.loadings, Q = x.map(r => r.map(v => v * Math.abs(v) ** (m - 1)));
  let U = L.solve(L.crossprod(x), L.mul(L.t(x), Q)); const dd = diagOf(L.inv(L.mul(L.t(U), U)));
  U = U.map(r => r.map((v, j) => v * Math.sqrt(dd[j])));
  const z = L.mul(x, U), U2 = L.mul(xx.rotmat, U), ui = L.inv(U2);
  return { loadings: z.map((r, i) => r.map(v => v * Math.sqrt(h2[i]))), Phi: L.mul(ui, L.t(ui)) };
}
// GPArotation::GPFoblq with vgQ.oblimin (gam = 0: quartimin), eps = 1e-5, maxit = 1000
function oblimin(A, gam = 0, eps = 1e-5, maxit = 1000) {
  const k = A[0].length, p = A.length;
  const vgQ = Lm => { let X = Lm.map(r => r.map((_, j) => r.reduce((s, v, q) => s + (q === j ? 0 : v * v), 0))); if (gam !== 0) { const cm = colSums(X).map(s => s * gam / p); X = X.map(r => r.map((v, j) => v - cm[j])); } let f = 0; const Gq = Lm.map((r, i) => r.map((v, j) => { f += v * v * X[i][j]; return v * X[i][j]; })); return { Gq, f: f / 4 }; };
  const gradOf = (Lm, Gq, Ti) => L.t(L.mul(L.mul(L.t(Lm), Gq), Ti)).map(r => r.map(v => -v));
  let Tmat = L.ident(k), Ti = L.inv(Tmat), Lm = L.mul(A, L.t(Ti)), V = vgQ(Lm), G = gradOf(Lm, V.Gq, Ti), f = V.f, al = 1, conv = false;
  for (let iter = 0; iter <= maxit; iter++) {
    const cs = colSums(Tmat.map((r, i) => r.map((v, j) => v * G[i][j]))), Gp = G.map((r, i) => r.map((v, j) => v - Tmat[i][j] * cs[j]));
    const s = Math.sqrt(Gp.reduce((a, r) => a + r.reduce((b, v) => b + v * v, 0), 0));
    if (s < eps) { conv = true; break; }
    al *= 2; let Tt = null, Vt = null, Lt = null, Tti = null;
    for (let i = 0; i <= 10; i++) {
      const X = Tmat.map((r, a) => r.map((v, b) => v - al * Gp[a][b])), vv = colSums(X.map(r => r.map(v => v * v))).map(v => 1 / Math.sqrt(v));
      Tt = X.map(r => r.map((v, j) => v * vv[j])); Tti = L.inv(Tt); Lt = L.mul(A, L.t(Tti)); Vt = vgQ(Lt);
      if (f - Vt.f > 0.5 * s * s * al) break; al /= 2;
    }
    Tmat = Tt; f = Vt.f; Lm = Lt; G = gradOf(Lt, Vt.Gq, Tti);
  }
  return { loadings: Lm, Phi: L.mul(L.t(Tmat), Tmat), converged: conv };
}
function kmo(R) {
  const Ri = L.inv(R), p = R.length; let s2 = 0, q2 = 0; const msa = [];
  for (let i = 0; i < p; i++) { let a = 0, b = 0; for (let j = 0; j < p; j++) if (i !== j) { const q = -Ri[i][j] / Math.sqrt(Ri[i][i] * Ri[j][j]); a += R[i][j] ** 2; b += q * q; } msa.push(a / (a + b)); s2 += a; q2 += b; }
  return { overall: s2 / (s2 + q2), msa };
}

register('efa', ctx => {
  const { vars, Z, n, p, rn } = prepare(ctx);
  const nf = ctx.num('nfactors', 2, { min: 1, max: p - 1, integer: true });
  const rotate = String(ctx.opt('rotation', 'oblimin')); let fm = String(ctx.opt('factorMethod', 'minres'));
  if (['mle', 'MLE', 'ML'].includes(fm)) fm = 'ml';
  const known = ['pa', 'alpha', 'minrank', 'wls', 'gls', 'minres', 'minchi', 'uls', 'ml', 'ols', 'old.min'];
  if (!known.includes(fm)) { ctx.diag('factor method not specified correctly, minimum residual (unweighted least squares  used'); fm = 'minres'; }
  need(['minres', 'uls', 'ml', 'pa'].includes(fm), 'Factor method "' + fm + '" is not available in the built-in engine; choose minres, ml or pa.');
  const R = corr(Z), fit = faFit(R, nf, fm, ctx), prefix = { minres: 'MR', uls: 'ULS', ml: 'ML', pa: 'PA' }[fm];
  let Ld = fit.loadings;
  // psych carries NaN loadings (imaginary principal-axis eigenvalues) into later steps, which then fail in R
  if (Ld.flat().some(v => !Number.isFinite(v))) need(false, nf > 1 && ['varimax', 'promax', 'oblimin', 'quartimin'].includes(rotate) ? "infinite or missing values in 'x'" : 'subscript out of bounds');
  if (nf > 1) { const sg = colSums(Ld).map(s => Math.sign(s) || 1); Ld = Ld.map(r => r.map((v, j) => v * sg[j])); } else if (Ld.reduce((s, r) => s + r[0], 0) < 0) Ld = Ld.map(r => [-r[0]]);
  Ld = Ld.map(r => r.map(v => v === 0 ? 1e-15 : v));
  const model = tcross(Ld); let Phi = null;
  if (rotate !== 'none' && nf > 1) {
    if (rotate === 'varimax') Ld = varimax(Ld).loadings;
    else if (rotate === 'promax') { const pr = promaxKaiser(Ld); Ld = pr.loadings; Phi = pr.Phi; }
    else if (rotate === 'oblimin' || rotate === 'quartimin') { const ob = oblimin(Ld); if (!ob.converged) ctx.warn('convergence not obtained in GPFoblq. 1000 iterations used.'); Ld = ob.loadings; Phi = ob.Phi; }
    else ctx.diag("Specified rotation not found, rotate='none' used");
  }
  const sg = colSums(Ld).map(s => Math.sign(s) || 1); Ld = Ld.map(r => r.map((v, j) => v * sg[j])); if (Phi) Phi = Phi.map((r, i) => r.map((v, j) => sg[i] * v * sg[j]));
  let names = Ld[0].map((_, j) => prefix + (j + 1));
  if (nf > 1) {
    const LtL = L.mul(L.t(Ld), Ld), ev = Phi ? diagOf(L.mul(Phi, LtL)) : diagOf(LtL), o = ev.map((_, j) => j).sort((a, b) => ev[b] - ev[a] || a - b);
    Ld = Ld.map(r => o.map(j => r[j])); names = o.map(j => names[j]); if (Phi) Phi = o.map(i => o.map(j => Phi[i][j]));
  }
  const comm = diagOf(model), uniq = comm.map((c, i) => R[i][i] - c);
  if (comm.some(c => c > 1)) ctx.warn('An ultra-Heywood case was detected.  Examine the results carefully');
  ctx.table('Factor loadings', ['Term', ...names], vars.map((v, i) => [v, ...Ld[i]]));
  ctx.table('Communalities', ['Term', 'Communality', 'Uniqueness'], vars.map((v, i) => [v, comm[i], uniq[i]]));
  if (Phi) ctx.table('Factor correlations', ['Term', ...names], names.map((nm, i) => [nm, ...Phi[i]]));
  const Sx = Phi ? L.mul(Ld, Phi) : Ld;
  if (n !== p) { const W = L.solve(R, Sx), sc = L.mul(standardize(Z), W); ctx.table('Factor scores', ['Term', ...names], sc.slice(0, 200).map((r, i) => [rn[i], ...r]), Math.min(200, n)); }
  // diagnostics: fa summary, KMO, Bartlett
  const com = Ld.map(r => { const s2 = r.reduce((s, v) => s + v * v, 0), s4 = r.reduce((s, v) => s + v ** 4, 0); return s2 * s2 / s4; });
  const vx = Phi ? diagOf(L.mul(Phi, L.mul(L.t(Ld), Ld))) : colSums(Ld.map(r => r.map(v => v * v))), vt = comm.reduce((a, b) => a + b, 0) + uniq.reduce((a, b) => a + b, 0), sx = vx.reduce((a, b) => a + b, 0);
  let rms = 0, cnt = 0; for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) { rms += (R[i][j] - model[i][j]) ** 2; cnt++; }
  const K = kmo(R), ld = L.logdet(R), bart = -ld * (n - 1 - (2 * p + 5) / 6), bdf = p * (p - 1) / 2;
  const fmt = rows => rows.map(r => r.map(v => typeof v === 'number' ? Number(r2(v)) : v));
  ctx.diag(['Factor Analysis using method =  ' + fm, 'Call: psych::fa(r = z, nfactors = ' + nf + ', rotate = "' + rotate + '", scores = "regression", fm = "' + fm + '")', 'Standardized loadings (pattern matrix) based upon correlation matrix',
    ...printTable([...names, 'h2', 'u2', 'com'], fmt(Ld.map((r, i) => [...r, comm[i], uniq[i], Math.round(com[i] * 10) / 10])), vars), '',
    ...printTable(names, fmt([vx, vx.map(v => v / vt), ...(nf > 1 ? [vx.map((_, j) => vx.slice(0, j + 1).reduce((a, b) => a + b, 0) / vt), vx.map(v => v / sx), vx.map((_, j) => vx.slice(0, j + 1).reduce((a, b) => a + b, 0) / sx)] : [])]), ['SS loadings', 'Proportion Var', ...(nf > 1 ? ['Cumulative Var', 'Proportion Explained', 'Cumulative Proportion'] : [])]),
    ...(Phi ? ['', ' With factor correlations of ', ...printTable(names, fmt(Phi), names)] : []), '', 'Mean item complexity =  ' + fmtSig(com.reduce((a, b) => a + b, 0) / p, 2),
    'The root mean square of the residuals (RMSR) is  ' + r2(Math.sqrt(rms / cnt)), 'The total n.obs was  ' + n, '',
    'Kaiser-Meyer-Olkin factor adequacy', 'Overall MSA =  ' + r2(K.overall), 'MSA for each item = ', ...printTable(vars, [K.msa.map(v => Number(r2(v)))], ['']), '',
    'Bartlett test of sphericity', '$chisq', '[1] ' + fmtSig(bart, 7), '', '$p.value', '[1] ' + fmtSig(D.pchisq(bart, bdf, false), 7), '', '$df', '[1] ' + bdf, '']);
});
