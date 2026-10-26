// ANOVA & ANCOVA family: Welch ANOVA, factorial ANOVA and ANCOVA (lm + car::Anova type II/III), repeated-measures
// ANOVA (car::Anova on the wide matrix with idata/idesign), Tukey HSD, Games–Howell, Dunnett (multcomp), planned
// contrasts (multcomp glht + p.adjust) and pairwise.t.test / pairwise.wilcox.test — ports of the ANOVA block in
// src/analysis-methods.R. Deviations from R are listed in tools/engine/NOTES-anova.md.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import * as L from '../lib/linalg.mjs';
import { Factor, isFactor, need, expandTerms, rNumber, rnum } from '../lib/frame.mjs';
import { design, lm, fitout } from '../lib/models.mjs';
import { test, sum, mean, variance, rank, tieCounts } from '../lib/stats.mjs';
import { printCoefmat } from '../lib/print.mjs';
import { dunnettSetup, pDunnett, qDunnett } from '../lib/anova-mvt.mjs';

const fail = msg => { need(false, msg); };
// group(): droplevels(factor(v)); numeric vectors get numerically sorted levels as R's factor() does
// (ctx.group converts numbers to text first, which sorts 1, 10, 2 — see NOTES-anova.md)
function group(v, k = null) {
  const f = (isFactor(v) ? v : new Factor(v)).droplevels();
  need(f.nlevels >= 2, 'At least two observed groups are required.'); if (k !== null) need(f.nlevels === k, 'Exactly ' + k + ' groups are required.');
  return f;
}
// match.arg(arg, choices) with R's message (fancy quotes in a UTF-8 locale) and partial matching
function matchArg(arg, choices) {
  const a = String(arg); if (choices.includes(a)) return a;
  const pm = choices.filter(c => c.startsWith(a)); if (a.length && pm.length === 1) return pm[0];
  fail("'arg' should be one of " + choices.map(c => '“' + c + '”').join(', '));
}
const PADJ = ['holm', 'hochberg', 'hommel', 'bonferroni', 'BH', 'BY', 'fdr', 'none'];
// p.adjust with NA handling (NAs stay NA and do not count towards n)
function padj(p, method) {
  const idx = p.map((v, i) => Number.isNaN(v) ? -1 : i).filter(i => i >= 0), out = p.map(() => NaN);
  if (!idx.length) return out; const a = D.padjust(idx.map(i => p[i]), method === 'fdr' ? 'BH' : method); idx.forEach((i, k) => { out[i] = a[k]; }); return out;
}
// strsplit(s, re)[[1]] semantics: '' → none; a trailing match does not produce an empty last piece
function rsplit(s, re) { s = String(s); if (s === '') return []; const parts = s.split(re); if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop(); return parts; }
function numbers(s) { const v = rsplit(s, /[,;\s]+/).map(rNumber); need(v.length > 0 && v.every(Number.isFinite), 'Enter finite comma-separated numbers.'); return v; }
const pfU = (f, d1, d2) => Number.isNaN(f) || Number.isNaN(d1) || Number.isNaN(d2) ? NaN : D.pf(f, d1, d2, false);
const groupsOf = (y, f) => { const out = f.levels.map(() => []); f.codes.forEach((c, i) => out[c].push(y[i])); return out; };

// ---------- factorial ANOVA and ANCOVA ----------
// car::Anova(m, type): II = SS(term | all terms not containing it) by model comparison (equal to car's
// conjugate-complement linear hypothesis), III = Wald test of the term's coefficients in the full model.
function carAnova(m, type) {
  const { des } = m, labels = des.termLabels, vars = labels.map(l => l.split(':')), nt = labels.length, rss = m.rss, rdf = m.dfResidual;
  const colsOf = ts => des.assign.map((a, j) => ts.includes(a) ? j : -1).filter(j => j >= 0);
  const rssOf = cols => { if (!cols.length) return sum(des.y.map(v => v * v)); const f = L.lsfit(des.X.map(r => cols.map(j => r[j])), des.y); return sum(f.resid.map(v => v * v)); };
  const rows = [];
  if (type === 'III') {
    for (let t = 0; t <= nt; t++) { const idx = colsOf([t]), b = idx.map(j => m.coef[j]), V = L.sub(m.V, idx, idx), x = L.solve(V, b); rows.push([t ? labels[t - 1] : '(Intercept)', L.dot(b, x), idx.length]); }
  } else {
    for (let t = 1; t <= nt; t++) {
      const rel = []; for (let u = 1; u <= nt; u++) if (u !== t && vars[t - 1].every(v => vars[u - 1].includes(v))) rel.push(u);
      const others = []; for (let u = 0; u <= nt; u++) if (u !== t && !rel.includes(u)) others.push(u);
      rows.push([labels[t - 1], Math.abs(rssOf(colsOf(others)) - rssOf(colsOf([...others, t]))), colsOf([t]).length]);
    }
  }
  const out = rows.map(([lab, ss, df]) => { const F = (ss / df) / (rss / rdf); return [lab, ss, df, F, pfU(F, df, rdf)]; });
  out.push(['Residuals', rss, rdf, NaN, NaN]); return out;
}
register(['factorial', 'ancova'], ctx => {
  const { id } = ctx; ctx.clean();
  const vv = id === 'factorial' ? ctx.fields('factors') : [...ctx.g, ...ctx.fields('covariates')];
  for (const k of id === 'factorial' ? ctx.fields('factors') : ctx.g) ctx.d.set(k, group(ctx.d.get(k)));
  const ss = ctx.opt('ss', 'II'), contrasts = {};
  if (ss === 'III') for (const k of vv) if (isFactor(ctx.d.get(k))) contrasts[k] = 'sum';
  const inter = ctx.opt('interactions', id === 'factorial') === true;
  const m = lm(design(ctx.d, ctx.y[0], expandTerms(vv, inter), { contrasts })); m.formulaText = ctx.y[0] + ' ~ ' + vv.join(inter ? ' * ' : ' + ');
  fitout(ctx, m);
  const type = matchArg(typeof ss === 'number' ? rnum(ss) : ss, ['II', 'III', '2', '3']), t3 = type === 'III' || type === '3';
  const a = carAnova(m, t3 ? 'III' : 'II');
  ctx.table('Joint effect tests', ['Term', 'Sum Sq', 'Df', 'F value', 'Pr(>F)'], a);
  ctx.diag(['Anova Table (Type ' + (t3 ? 'III' : 'II') + ' tests)', '', 'Response: ' + ctx.y[0], ...printCoefmat(a.map(r => r[0]), ['Sum Sq', 'Df', 'F value', 'Pr(>F)'], a.map(r => r.slice(1))), '']);
});

// ---------- repeated-measures ANOVA ----------
const trace = A => { let s = 0; for (let i = 0; i < A.length; i++) s += A[i][i]; return s; };
register('repeated', ctx => {
  ctx.clean(); const yy = ctx.value('y'), gg = group(ctx.value('group')), sv = ctx.value('subject'), ss = (isFactor(sv) ? sv : new Factor(sv)).droplevels();
  const n = ss.nlevels, k = gg.nlevels, cnt = Array.from({ length: n }, () => new Array(k).fill(0)), mat = Array.from({ length: n }, () => new Array(k).fill(NaN));
  for (let i = 0; i < yy.length; i++) { cnt[ss.codes[i]][gg.codes[i]]++; mat[ss.codes[i]][gg.codes[i]] = yy[i]; }
  need(cnt.every(r => r.every(c => c === 1)), 'Repeated ANOVA requires a complete unique subject × condition design.');
  // lm(mat ~ 1); car::Anova(type = 'III', idata = condition factor, idesign = ~condition) → summary(multivariate = FALSE)
  const cm = mat[0].map((_, j) => mean(mat.map(r => r[j]))), E = L.zeros(k, k);
  for (const r of mat) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) E[a][b] += (r[a] - cm[a]) * (r[b] - cm[b]);
  const edf = n - 1, P1 = Array.from({ length: k }, () => [1]), Pc = Array.from({ length: k }, (_, i) => Array.from({ length: k - 1 }, (_, j) => i === j ? 1 : i === k - 1 ? -1 : 0));
  const uni = [], adj = [], sph = []; let singularAny = false, hfOver = false;
  for (const [term, P] of [['(Intercept)', P1], ['condition', Pc]]) {
    const p = P[0].length, Pt = L.t(P), PtPinv = L.inv(L.mul(Pt, P)), pm = L.mulVec(Pt, cm), SSPE = L.mul(L.mul(Pt, E), P);
    const ssq = n * L.dot(pm, L.mulVec(PtPinv, pm)), A = L.mul(SSPE, PtPinv), ess = trace(A), F = (ssq / p) / (ess / (edf * p));
    uni.push([term, ssq, p, ess, edf * p, F, pfU(F, p, edf * p)]);
    const singular = L.eigenSym(SSPE).values.filter(v => v >= Math.sqrt(D.DBL_EPS)).length < p; singularAny = singularAny || singular;
    if (singular || p < 2) continue;
    const gge = (ess / p) ** 2 / (trace(L.mul(A, A)) / p), hf = ((edf + 1) * p * gge - 2) / (p * (edf - p * gge)); if (hf > 1) hfOver = true;
    const U = L.mul(PtPinv, SSPE), logW = Math.log(L.det(U)) - p * Math.log(trace(U) / p), rho = 1 - (2 * p * p + p + 2) / (6 * p * edf);
    const w2 = (p + 2) * (p - 1) * (p - 2) * (2 * p ** 3 + 6 * p * p + 3 * k + 2) / (288 * (edf * p * rho) ** 2), z = -edf * rho * logW, f = p * (p + 1) / 2 - 1;
    const Pr1 = D.pchisq(z, f, false), Pr2 = D.pchisq(z, f + 4, false);
    sph.push([term, Math.exp(logW), Pr1 + w2 * (Pr2 - Pr1)]);
    adj.push([term, gge, pfU(F, gge * p, gge * edf * p), hf, pfU(F, Math.min(1, hf) * p, Math.min(1, hf) * edf * p)]);
  }
  if (singularAny) ctx.warn('one or more error SSP matrix:\ncorresponding non-sphericity tests and corrections not available');
  if (sph.length && hfOver) ctx.warn('HF eps > 1 treated as 1');
  const out = ['', 'Univariate Type III Repeated-Measures ANOVA Assuming Sphericity', '', ...printCoefmat(uni.map(r => r[0]), ['Sum Sq', 'num Df', 'Error SS', 'den Df', 'F value', 'Pr(>F)'], uni.map(r => r.slice(1))), ''];
  if (sph.length) out.push('', 'Mauchly Tests for Sphericity', '', ...printCoefmat(sph.map(r => r[0]), ['Test statistic', 'p-value'], sph.map(r => r.slice(1))), '', '',
    'Greenhouse-Geisser and Huynh-Feldt Corrections', ' for Departure from Sphericity', '', ...printCoefmat(adj.map(r => r[0]), ['GG eps', 'Pr(>F[GG])'], adj.map(r => r.slice(1, 3))), '', ...printCoefmat(adj.map(r => r[0]), ['HF eps', 'Pr(>F[HF])'], adj.map(r => r.slice(3))), '');
  ctx.diag(out);
  ctx.table('Design', ['Subjects', 'Conditions'], [[n, k]]);
  ctx.note('Diagnostics include sphericity and Greenhouse–Geisser/Huynh–Feldt corrections.');
  ctx.used = n;
});

// ---------- one-way comparisons ----------
function welchT(x, y) {
  const nx = x.length, ny = y.length, mx = mean(x), my = mean(y), vx = variance(x) / nx, vy = variance(y) / ny, se = Math.sqrt(vx + vy);
  need(!(se < 10 * D.DBL_EPS * Math.max(Math.abs(mx), Math.abs(my))), 'data are essentially constant');
  const df = (vx + vy) ** 2 / (vx * vx / (nx - 1) + vy * vy / (ny - 1)), t = (mx - my) / se; return 2 * D.pt(-Math.abs(t), df);
}
function wilcoxP(x, y) {
  const nx = x.length, ny = y.length, r = rank([...x, ...y]), W = sum(r.slice(0, nx)) - nx * (nx + 1) / 2;
  const sig = Math.sqrt((nx * ny / 12) * ((nx + ny + 1) - sum(tieCounts(r).map(t => t ** 3 - t)) / ((nx + ny) * (nx + ny - 1))));
  let z = W - nx * ny / 2; z = (z - Math.sign(z) * 0.5) / sig; if (Number.isNaN(z)) return NaN;
  return 2 * Math.min(D.pnorm(z), D.pnorm(z, 0, 1, false));
}
const glhtText = (head, rn, est, se, tv, p, method) => ['', '\t Simultaneous Tests for General Linear Hypotheses', '', ...head, 'Linear Hypotheses:', ...printCoefmat(rn.map(s => s + ' == 0'), ['Estimate', 'Std. Error', 't value', 'Pr(>|t|)'], est.map((e, i) => [e, se[i], tv[i], p[i]])), '---', "Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1", '(Adjusted p values reported -- ' + method + ' method)', ''];

register(['welch_anova', 'tukey', 'gameshowell', 'dunnett', 'contrasts', 'pairwise'], ctx => {
  const { id, opt, level } = ctx; ctx.clean();
  const yy = ctx.value('y'), gg = group(ctx.value('group')), lv = gg.levels, k = lv.length, ys = groupsOf(yy, gg), ns = ys.map(v => v.length);
  need(ns.every(c => c >= 2), 'Every group needs at least two observations.');
  const ms = ys.map(mean), vs = ys.map(variance), N = yy.length, dfe = N - k, mse = sum(ys.map((v, j) => sum(v.map(x => (x - ms[j]) ** 2)))) / dfe;
  if (id === 'welch_anova') {
    const w = ns.map((c, j) => c / vs[j]), sw = sum(w), tmp = sum(w.map((wi, j) => (1 - wi / sw) ** 2 / (ns[j] - 1))) / (k * k - 1), mm = sum(w.map((wi, j) => wi * ms[j])) / sw;
    const F = sum(w.map((wi, j) => wi * (ms[j] - mm) ** 2)) / ((k - 1) * (1 + 2 * (k - 2) * tmp)), df2 = 1 / (3 * tmp);
    test(ctx, { statistic: F, parameter: [k - 1, df2], p: pfU(F, k - 1, df2), method: 'One-way analysis of means (not assuming equal variances)', alternative: null });
    return;
  }
  if (id === 'tukey') {
    const q = D.qtukey(level, 1, k, dfe), rows = [];
    for (let j = 0; j < k - 1; j++) for (let i = j + 1; i < k; i++) { const c = ms[i] - ms[j], s = Math.sqrt((mse / 2) * (1 / ns[i] + 1 / ns[j])); rows.push([lv[i] + '-' + lv[j], c, c - q * s, c + q * s, D.ptukey(Math.abs(c / s), 1, k, dfe, false)]); }
    ctx.table('Tukey simultaneous comparisons', ['Term', 'diff', 'lwr', 'upr', 'p adj'], rows);
  }
  if (id === 'gameshowell') {
    const rows = [];
    for (let i = 0; i < k - 1; i++) for (let j = i + 1; j < k; j++) {
      const v1 = vs[i] / ns[i], v2 = vs[j] / ns[j]; need(v1 + v2 > 0, 'A comparison has zero sampling variance.');
      const se = Math.sqrt((v1 + v2) / 2), df = (v1 + v2) ** 2 / (v1 * v1 / (ns[i] - 1) + v2 * v2 / (ns[j] - 1)), dif = ms[i] - ms[j], crit = D.qtukey(level, 1, k, df);
      rows.push([lv[i] + ' - ' + lv[j], dif, df, D.ptukey(Math.abs(dif) / se, 1, k, df, false), dif - crit * se, dif + crit * se]);
    }
    ctx.table('Games–Howell simultaneous comparisons', ['Contrast', 'Difference', 'DF', 'P.adjusted', 'Lower', 'Upper'], rows);
  }
  if (id === 'dunnett') {
    // relevel(gg, ref): a character ref names a level, a numeric ref is a level index (as R does)
    const ref = opt('reference', lv[0]); need(lv.includes(typeof ref === 'number' ? rnum(ref) : String(ref)), 'The control label is not an observed group.');
    let r0;
    if (typeof ref === 'number') { if (ref < 1 || ref > k) fail('ref = ' + rnum(ref) + ' must be in 1L:' + k); r0 = Math.floor(ref) - 1; } else r0 = lv.indexOf(String(ref));
    const others = lv.map((_, j) => j).filter(j => j !== r0), sig = Math.sqrt(mse);
    const est = others.map(j => ms[j] - ms[r0]), se = others.map(j => sig * Math.sqrt(1 / ns[j] + 1 / ns[r0])), tv = est.map((e, i) => e / se[i]);
    let crit, pv;
    if (others.length === 1) { crit = D.qt(1 - (1 - level) / 2, dfe); pv = tv.map(t => 1 - (D.pt(Math.abs(t), dfe) - D.pt(-Math.abs(t), dfe))); }
    else { const S = dunnettSetup(others.map(j => Math.sqrt(ns[j] / (ns[j] + ns[r0]))), dfe); crit = qDunnett(S, level); pv = tv.map(t => Math.max(0, 1 - pDunnett(S, Math.abs(t)))); }
    const rn = others.map(j => lv[j] + ' - ' + lv[r0]);
    ctx.diag(glhtText(['Multiple Comparisons of Means: Dunnett Contrasts', '', '', 'Fit: aov(formula = y ~ g, data = dd)', ''], rn, est, se, tv, pv, 'single-step'));
    ctx.table('Dunnett simultaneous intervals', ['Term', 'Estimate', 'lwr', 'upr'], est.map((e, i) => [rn[i], e, e - crit * se[i], e + crit * se[i]]));
  }
  if (id === 'contrasts') {
    // do.call(rbind, lapply(strsplit(contrasts, '\n')[[1]], numbers)) with rbind's recycling of short rows
    const rowsC = rsplit(opt('contrasts', ''), '\n').map(numbers);
    if (!rowsC.length) fail("'x' must be an array of at least two dimensions");
    const nc = Math.max(...rowsC.map(r => r.length));
    rowsC.forEach((r, i) => { if (nc % r.length) ctx.warn('number of columns of result is not a multiple of vector length (arg ' + (i + 1) + ')'); });
    const C = rowsC.map(r => Array.from({ length: nc }, (_, j) => r[j % r.length]));
    need(nc === k && C.every(r => Math.abs(sum(r)) < 1e-8), 'Contrast rows need one coefficient per displayed group and must sum to zero.');
    const est = C.map(r => sum(r.map((c, j) => c * ms[j]))), se = C.map(r => Math.sqrt(mse * sum(r.map((c, j) => c * c / ns[j])))), tv = est.map((e, i) => e / se[i]);
    const type = matchArg(opt('adjust', 'holm'), ['single-step', 'Shaffer', 'Westfall', 'free', ...PADJ]);
    need(PADJ.includes(type), 'The "' + type + '" adjustment is not available in the built-in engine; choose holm, bonferroni, BH, BY, hochberg, hommel or none.');
    // multcomp: univariate two-sided p = 2 * (1 - pt(|t|, df)), then p.adjust
    const p = padj(tv.map(t => Number.isNaN(t) ? NaN : 2 * (1 - D.pt(Math.abs(t), dfe))), type);
    ctx.table('Planned contrasts', ['Estimate', 'SE', 'P.adjusted'], est.map((e, i) => [e, se[i], p[i]]));
    ctx.diag(glhtText(['Fit: lm(formula = y ~ 0 + g, data = dd)', ''], C.map((_, i) => String(i + 1)), est, se, tv, p, type));
  }
  if (id === 'pairwise') {
    const rk = opt('rank', false) === true, method = matchArg(opt('adjust', 'holm'), PADJ);
    const raw = []; for (let i = 1; i < k; i++) { raw.push([]); for (let j = 0; j < k - 1; j++) raw[i - 1].push(i > j ? (rk ? wilcoxP(ys[i], ys[j]) : welchT(ys[i], ys[j])) : null); }
    const a = padj(raw.flat().filter(v => v !== null), method); let c = 0;
    ctx.table('Adjusted pairwise p-values', ['Term', ...lv.slice(0, k - 1)], raw.map((r, i) => [lv[i + 1], ...r.map(v => v === null ? null : a[c++])]));
  }
  ctx.table('Group summaries', ['Group', 'N', 'Mean', 'SD'], lv.map((l, j) => [l, ns[j], ms[j], Math.sqrt(vs[j])]));
});
