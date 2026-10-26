import { rng, packet, num, cat, withMissing, bern, poisson, round } from '../casekit.mjs';
// Two-level data: G groups × m observations with random intercept and slope (sd 0 → no group variation).
function twoLevel(seed, G, m, { sdInt = 0.8, sdSlope = 0.4 } = {}) {
  const r = rng(seed), s = [], x = [], z = [], f = [], eta = [];
  for (let g = 0; g < G; g++) { const u = sdInt * r.norm(), b = sdSlope * r.norm(); for (let j = 0; j < m; j++) { const xv = round(r.norm(), 3), zv = round(r.unif() * 2, 3); s.push('S' + String(g + 1).padStart(2, '0')); x.push(xv); z.push(zv); f.push(['a', 'b', 'c'][Math.floor(r.unif() * 3)]); eta.push(u + b * xv); } }
  return { r, s, x, z, f, eta };
}
// Panel data: N units × T periods, y_t = 0.5 y_{t-1} + 0.7 x − 0.4 z + a_i + 0.1 t + e
function panel(seed, N, T, drop = 0) {
  const P = rng(seed), pad = N > 99 ? 3 : 2, id = [], tt = [], px = [], pz = [], py = [], pf = [];
  for (let i = 0; i < N; i++) { const a = P.norm(); let yl = a; for (let t = 1; t <= T; t++) { const xv = round(0.5 * a + P.norm(), 3), zv = round(P.norm(), 3); const yv = round(0.5 * yl + 1 + 0.7 * xv - 0.4 * zv + a + 0.1 * t + P.norm(), 4); yl = yv; if (drop && P.unif() < drop) continue; id.push('P' + String(i + 1).padStart(pad, '0')); tt.push(2000 + t); px.push(xv); pz.push(zv); py.push(yv); pf.push(P.unif() < 0.5 ? 'u' : 'v'); } }
  return { P, id, tt, px, pz, py, pf };
}
const G3 = { tol: 1e-3, abs: 1e-4 }, G4a = { tol: 1e-4, abs: 1e-4 }, G6 = { tol: 1e-6, abs: 1e-7 }, G5 = { tol: 1e-5, abs: 1e-6 }, G4 = { tol: 1e-4, abs: 1e-5 };
export function cases() {
  const out = [], add = (name, pk, compare) => out.push(compare ? { name, packet: pk, compare } : { name, packet: pk });
  // ---- mixed (lmer) ----
  const A = twoLevel(11, 30, 8), yA = A.eta.map((e, i) => round(1 + 0.5 * A.x[i] - 0.3 * A.z[i] + (A.f[i] === 'b' ? 0.4 : 0) + e + A.r.norm(), 4));
  const colsA = [num('y', yA), num('x', A.x), num('z', A.z), cat('f', A.f), cat('subject', A.s)];
  add('mixed_reml', packet('mixed', colsA, { y: 'y', predictors: ['x', 'z', 'f'], subject: 'subject' }), G6);
  add('mixed_ml', packet('mixed', colsA, { y: 'y', predictors: ['x', 'z'], subject: 'subject' }, { reml: false }), G6);
  add('mixed_alpha10', packet('mixed', colsA, { y: 'y', predictors: ['x'], subject: 'subject' }, {}, { alpha: 0.1 }), G6);
  add('mixed_slope', packet('mixed', colsA, { y: 'y', predictors: ['x', 'z'], subject: 'subject' }, { randomSlope: 'x' }), G4);
  add('mixed_slope_ml', packet('mixed', colsA, { y: 'y', predictors: ['x', 'f'], subject: 'subject' }, { randomSlope: 'x', reml: false }), G4);
  const B0 = twoLevel(21, 40, 6, { sdInt: 0.7, sdSlope: 0.5 }), yB0 = B0.eta.map((e, i) => round(2 + 0.3 * B0.x[i] + e + 0.8 * B0.r.norm(), 3));
  const numId = B0.s.map(v => Number(v.slice(1)) * 10);
  add('mixed_missing_numid', packet('mixed', [num('y', withMissing(B0.r, yB0, 0.06)), num('x', withMissing(B0.r, B0.x, 0.04)), num('z', B0.z), num('id', numId)], { y: 'y', predictors: ['x', 'z'], subject: 'id' }), G6);
  add('mixed_slope_z', packet('mixed', [num('y', yB0), num('x', B0.x), num('z', B0.z), cat('g', B0.s)], { y: 'y', predictors: ['x', 'z'], subject: 'g' }, { randomSlope: 'z' }), G4);
  // no between-group variation → singular fit (theta on the boundary)
  const C = twoLevel(31, 25, 6, { sdInt: 0, sdSlope: 0 }), yC = C.x.map((v, i) => round(0.5 + 0.4 * v + 0.2 * C.z[i] + C.r.norm(), 4));
  add('mixed_singular', packet('mixed', [num('y', yC), num('x', C.x), num('z', C.z), cat('g', C.s)], { y: 'y', predictors: ['x', 'z'], subject: 'g' }), G6);
  // error paths
  add('mixed_err_nosubject', packet('mixed', colsA, { y: 'y', predictors: ['x'] }));
  add('mixed_err_nopred', packet('mixed', colsA, { y: 'y', predictors: [], subject: 'subject' }));
  add('mixed_err_slope', packet('mixed', colsA, { y: 'y', predictors: ['x'], subject: 'subject' }, { randomSlope: 'z' }));
  add('mixed_err_onegroup', packet('mixed', [num('y', yA.slice(0, 8)), num('x', A.x.slice(0, 8)), cat('g', A.s.slice(0, 8))], { y: 'y', predictors: ['x'], subject: 'g' }));
  add('mixed_err_nlev', packet('mixed', [num('y', yA.slice(0, 30)), num('x', A.x.slice(0, 30)), cat('g', yA.slice(0, 30).map((_, i) => 'g' + i))], { y: 'y', predictors: ['x'], subject: 'g' }));
  add('mixed_err_nre', packet('mixed', [num('y', yA.slice(0, 20)), num('x', A.x.slice(0, 20)), cat('g', yA.slice(0, 20).map((_, i) => 'g' + (i % 10)))], { y: 'y', predictors: ['x'], subject: 'g' }, { randomSlope: 'x' }));
  add('mixed_err_factor_y', packet('mixed', colsA, { y: 'f', predictors: ['x'], subject: 'subject' }));
  add('mixed_err_exposure', packet('mixed', [...colsA, num('e', A.x.map(v => v > 1.5 ? 0 : 1))], { y: 'y', predictors: ['x'], subject: 'subject', offset: 'e' }));
  // ---- glmm (glmer / glmer.nb) ----
  const B = twoLevel(12, 40, 10, { sdInt: 1, sdSlope: 0.5 });
  const yb = B.eta.map((e, i) => bern(B.r, 1 / (1 + Math.exp(-(-0.3 + 0.8 * B.x[i] + 0.2 * B.z[i] + e)))));
  const yp = B.eta.map((e, i) => poisson(B.r, Math.exp(0.4 + 0.3 * B.x[i] - 0.2 * B.z[i] + 0.6 * e)));
  const colsB = [num('yb', yb), num('yp', yp), num('x', B.x), num('z', B.z), cat('f', B.f), cat('subject', B.s), cat('yes', yb.map(v => v ? 'yes' : 'no'))];
  add('glmm_binomial', packet('glmm', colsB, { y: 'yb', predictors: ['x', 'z'], subject: 'subject' }), G5);
  add('glmm_binomial_slope', packet('glmm', colsB, { y: 'yb', predictors: ['x', 'z'], subject: 'subject' }, { randomSlope: 'x' }), G4);
  add('glmm_binomial_factor_y', packet('glmm', colsB, { y: 'yes', predictors: ['x', 'f'], subject: 'subject' }, { family: 'binomial' }, { alpha: 0.1 }), G5);
  add('glmm_poisson', packet('glmm', colsB, { y: 'yp', predictors: ['x', 'z'], subject: 'subject' }, { family: 'poisson' }), G5);
  add('glmm_poisson_factor', packet('glmm', colsB, { y: 'yp', predictors: ['x', 'f'], subject: 'subject' }, { family: 'poisson' }), G5);
  add('glmm_negbin', packet('glmm', colsB, { y: 'yp', predictors: ['x', 'z'], subject: 'subject' }, { family: 'negbin' }), G4);
  add('glmm_err_family', packet('glmm', colsB, { y: 'yb', predictors: ['x'], subject: 'subject' }, { family: 'gaussian' }));
  add('glmm_err_binary', packet('glmm', colsB, { y: 'yp', predictors: ['x'], subject: 'subject' }, { family: 'binomial' }));
  add('glmm_err_negative', packet('glmm', [num('y', yp.map((v, i) => i === 3 ? -1 : v)), num('x', B.x), cat('g', B.s)], { y: 'y', predictors: ['x'], subject: 'g' }, { family: 'poisson' }));
  add('glmm_err_constant', packet('glmm', [num('y', yb.map(() => 1)), num('x', B.x), cat('g', B.s)], { y: 'y', predictors: ['x'], subject: 'g' }));
  add('glmm_err_nosubject', packet('glmm', colsB, { y: 'yb', predictors: ['x'] }));
  // ---- panels (plm) ----
  const Pn = panel(13, 25, 8), colsP = [num('y', Pn.py), num('x', Pn.px), num('z', Pn.pz), cat('firm', Pn.id), num('year', Pn.tt), cat('f', Pn.pf)];
  const fP = { y: 'y', predictors: ['x', 'z'], subject: 'firm', time: 'year' };
  for (const id of ['panel_fe', 'panel_re']) for (const eff of ['individual', 'time', 'twoways']) add(id + '_' + eff, packet(id, colsP, fP, { effects: eff }));
  add('panel_fe_factor_alpha10', packet('panel_fe', colsP, { ...fP, predictors: ['x', 'f'] }, {}, { alpha: 0.1 }));
  const Pu = panel(14, 30, 7, 0.12), colsU = [num('y', withMissing(Pu.P, Pu.py, 0.03)), num('x', Pu.px), num('z', Pu.pz), num('unit', Pu.id.map(v => Number(v.slice(1)))), cat('period', Pu.tt.map(t => 'T' + t))];
  const fU = { y: 'y', predictors: ['x', 'z'], subject: 'unit', time: 'period' };
  for (const id of ['panel_fe', 'panel_re']) for (const eff of ['individual', 'time', 'twoways']) add(id + '_unbal_' + eff, packet(id, colsU, fU, { effects: eff }));
  add('panel_err_dup', packet('panel_fe', [num('y', Pn.py), num('x', Pn.px), cat('firm', Pn.id), num('year', Pn.tt.map(t => Math.min(t, 2006)))], { y: 'y', predictors: ['x'], subject: 'firm', time: 'year' }));
  add('panel_err_nopred', packet('panel_re', colsP, { ...fP, predictors: [] }));
  // ---- dynamic panel (pgmm) ----
  add('panel_dynamic', packet('panel_dynamic', colsP, fP));
  add('panel_dynamic_lags4', packet('panel_dynamic', colsP, fP, { lags: 4 }));
  add('panel_dynamic_lags10_x', packet('panel_dynamic', colsP, { ...fP, predictors: ['x'] }, { lags: 10 }));
  add('panel_dynamic_unbal', packet('panel_dynamic', colsU, fU, { lags: 3 }));
  add('panel_dynamic_err_lags', packet('panel_dynamic', colsP, fP, { lags: 1 }));
  add('panel_dynamic_err_dup', packet('panel_dynamic', [num('y', Pn.py), num('x', Pn.px), cat('firm', Pn.id), num('year', Pn.tt.map(t => Math.min(t, 2006)))], { y: 'y', predictors: ['x'], subject: 'firm', time: 'year' }));
  // ---- more edge cases ----
  add('mixed_slope_factor', packet('mixed', [num('y', yB0.map((v, i) => round(v + (B0.f[i] === 'b' ? 0.5 : 0), 3))), num('x', B0.x), cat('f', B0.f), cat('g', B0.s)], { y: 'y', predictors: ['x', 'f'], subject: 'g' }, { randomSlope: 'f' }), G3);
  const Bs = twoLevel(41, 30, 8, { sdInt: 0, sdSlope: 0 }), ybs = Bs.x.map(v => bern(Bs.r, 1 / (1 + Math.exp(-0.5 * v))));
  add('glmm_binomial_flat', packet('glmm', [num('y', ybs), num('x', Bs.x), cat('g', Bs.s)], { y: 'y', predictors: ['x'], subject: 'g' }), G5);
  add('panel_fe_timeinvariant', packet('panel_fe', [...colsP, num('w', Pn.id.map(v => Number(v.slice(1)) % 3))], { ...fP, predictors: ['x', 'w'] }));
  add('panel_re_timeinvariant', packet('panel_re', [...colsP, num('w', Pn.id.map(v => Number(v.slice(1)) % 3))], { ...fP, predictors: ['x', 'w'] }));
  add('panel_fe_offset', packet('panel_fe', [...colsP, num('e', Pn.px.map(v => Math.exp(v / 3)))], { ...fP, offset: 'e' }));
  add('panel_err_notime', packet('panel_fe', colsP, { y: 'y', predictors: ['x'], subject: 'firm' }));
  add('panel_err_nosubject', packet('panel_re', colsP, { y: 'y', predictors: ['x'], time: 'year' }));
  const Pg = panel(15, 40, 6, 0.1), colsG = [num('y', Pg.py), num('x', Pg.px), num('z', Pg.pz), cat('id', Pg.id), num('yr', Pg.tt)];
  add('panel_dynamic_unbal_years', packet('panel_dynamic', colsG, { y: 'y', predictors: ['x', 'z'], subject: 'id', time: 'yr' }, { lags: 3 }));
  add('panel_re_unbal_years', packet('panel_re', colsG, { y: 'y', predictors: ['x', 'z'], subject: 'id', time: 'yr' }, { effects: 'twoways' }));
  const P3 = panel(16, 30, 3);
  add('panel_dynamic_T3', packet('panel_dynamic', [num('y', P3.py), num('x', P3.px), cat('id', P3.id), num('yr', P3.tt)], { y: 'y', predictors: ['x'], subject: 'id', time: 'yr' }));
  add('mixed_rank_deficient', packet('mixed', [...colsA, num('x2', A.x.map(v => 2 * v))], { y: 'y', predictors: ['x', 'x2', 'z'], subject: 'subject' }, { reml: 'false' }), G6);
  add('glmm_poisson_alpha10_slope', packet('glmm', colsB, { y: 'yp', predictors: ['x', 'z'], subject: 'subject' }, { family: 'poisson', randomSlope: 'z' }, { alpha: 0.1 }), G4);
  // ---- larger problems (speed) ----
  const Lg = twoLevel(51, 300, 10, { sdInt: 0.9, sdSlope: 0.4 }), yLg = Lg.eta.map((e, i) => round(1 + 0.5 * Lg.x[i] - 0.3 * Lg.z[i] + e + Lg.r.norm(), 4)), ybLg = Lg.eta.map((e, i) => bern(Lg.r, 1 / (1 + Math.exp(-(0.2 + 0.6 * Lg.x[i] - 0.4 * Lg.z[i] + e)))));
  const ycLg = Lg.eta.map((e, i) => poisson(Lg.r, Math.exp(0.3 + 0.4 * Lg.x[i] + 0.5 * e) * (0.5 + Lg.r.unif())));
  const colsL = [num('y', yLg), num('yb', ybLg), num('yc', ycLg), num('x', Lg.x), num('z', Lg.z), cat('f', Lg.f), cat('g', Lg.s.map((v, i) => 'G' + Math.floor(i / 10)))];
  add('mixed_large_slope', packet('mixed', colsL, { y: 'y', predictors: ['x', 'z', 'f'], subject: 'g' }, { randomSlope: 'x' }), G4a);
  add('glmm_large_binomial', packet('glmm', colsL, { y: 'yb', predictors: ['x', 'z', 'f'], subject: 'g' }), G4a);
  add('glmm_large_negbin', packet('glmm', colsL, { y: 'yc', predictors: ['x', 'z'], subject: 'g' }, { family: 'negbin' }), G4a);
  const PL = panel(17, 300, 10), colsPL = [num('y', PL.py), num('x', PL.px), num('z', PL.pz), cat('id', PL.id), num('yr', PL.tt)];
  add('panel_dynamic_large', packet('panel_dynamic', colsPL, { y: 'y', predictors: ['x', 'z'], subject: 'id', time: 'yr' }, { lags: 4 }));
  add('panel_re_large', packet('panel_re', colsPL, { y: 'y', predictors: ['x', 'z'], subject: 'id', time: 'yr' }, { effects: 'twoways' }));
  return out;
}
