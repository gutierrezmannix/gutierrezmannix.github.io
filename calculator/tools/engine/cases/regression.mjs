import { rng, packet, num, cat, normals, pick, withMissing, bern, poisson, round } from '../casekit.mjs';
export function cases() {
  const r = rng(31), n = 150, out = [];
  const x = normals(r, n), z = normals(r, n), g = pick(r, n, ['a', 'b', 'c']);
  const P = (name, id, cols, fields, options = {}, extra = {}, compare) => out.push({ name, packet: packet(id, cols, fields, options, extra), ...(compare ? { compare } : {}) });
  // multinomial outcome (3 and 4 categories)
  const m3 = x.map((v, i) => { const e1 = 0.4 + 0.9 * v - 0.3 * z[i], e2 = -0.2 - 0.5 * v + 0.6 * z[i] + (g[i] === 'b' ? 0.7 : 0), s = 1 + Math.exp(e1) + Math.exp(e2), u = r.unif(); return u < 1 / s ? 'red' : u < (1 + Math.exp(e1)) / s ? 'green' : 'blue'; });
  const m4 = x.map((v, i) => { const u = r.unif() + 0.15 * v; return u < 0.25 ? 1 : u < 0.5 ? 2 : u < 0.8 ? 3 : 4; });
  P('multinom', 'multinomial', [cat('colour', withMissing(r, m3)), num('x', x), num('z', z), cat('g', g)], { y: 'colour', predictors: ['x', 'z', 'g'] });
  P('multinom_num4', 'multinomial', [num('level', m4), num('x', x)], { y: 'level', predictors: ['x'] }, {}, { alpha: 0.1 });
  P('multinom_two', 'multinomial', [cat('yy', x.map(v => v > 0 ? 'hi' : 'lo')), num('z', z)], { y: 'yy', predictors: ['z'] });
  // counts
  const nb = x.map((v, i) => poisson(r, Math.exp(0.5 + 0.6 * v - 0.3 * z[i] + (g[i] === 'c' ? 0.4 : 0)) * r.gamma(1.5, 1 / 1.5)));
  const expo = Array.from({ length: n }, () => round(0.5 + 2 * r.unif(), 2));
  const nbE = x.map((v, i) => poisson(r, expo[i] * Math.exp(0.2 + 0.5 * v) * r.gamma(2, 0.5)));
  const zi = x.map((v, i) => r.unif() < 1 / (1 + Math.exp(-(-0.5 + 0.8 * z[i]))) ? 0 : poisson(r, Math.exp(0.8 + 0.5 * v) * r.gamma(3, 1 / 3)));
  P('negbin', 'negbin', [num('count', withMissing(r, nb)), num('x', x), num('z', z), cat('g', g)], { y: 'count', predictors: ['x', 'z', 'g'] });
  P('negbin_offset', 'negbin', [num('count', nbE), num('x', x), num('t', expo)], { y: 'count', predictors: ['x'], offset: 't' });
  P('negbin_badexposure', 'negbin', [num('count', nbE), num('x', x), num('t', expo.map((v, i) => i === 5 ? 0 : v))], { y: 'count', predictors: ['x'], offset: 't' });
  P('negbin_noncount', 'negbin', [num('count', nb.map((v, i) => i === 3 ? 2.5 : v)), num('x', x)], { y: 'count', predictors: ['x'] });
  P('negbin_negative', 'negbin', [num('count', nb.map((v, i) => i === 3 ? -1 : v)), num('x', x)], { y: 'count', predictors: ['x'] });
  P('negbin_cat', 'negbin', [cat('count', nb), num('x', x)], { y: 'count', predictors: ['x'] });
  // truncated-NB count part: optim(BFGS) stops at reltol 1.6e-10, so a last-bit difference in the objective can
  // change the final iterate by ~1e-8 relative (see NOTES-regression.md)
  const bfgs = { tol: 1e-5 };
  P('hurdle_nb', 'hurdle', [num('count', zi), num('x', x), num('z', z)], { y: 'count', predictors: ['x', 'z'] }, {}, {}, bfgs);
  P('hurdle_pois', 'hurdle', [num('count', zi), num('x', x), num('z', z), cat('g', g)], { y: 'count', predictors: ['x', 'z', 'g'] }, { countFamily: 'poisson' });
  P('hurdle_offset', 'hurdle', [num('count', nbE), num('x', x), num('t', expo)], { y: 'count', predictors: ['x'], offset: 't' }, {}, {}, bfgs);
  P('zinb', 'zeroinfl', [num('count', zi), num('x', x), num('z', z)], { y: 'count', predictors: ['x', 'z'] });
  P('zip', 'zeroinfl', [num('count', zi), num('x', x), num('z', z), cat('g', g)], { y: 'count', predictors: ['x', 'z', 'g'] }, { countFamily: 'poisson' });
  P('zinb_offset', 'zeroinfl', [num('count', zi), num('x', x), num('t', expo)], { y: 'count', predictors: ['x'], offset: 't' });
  P('zip_noncount', 'zeroinfl', [num('count', zi.map((v, i) => i === 7 ? 1.5 : v)), num('x', x)], { y: 'count', predictors: ['x'] }, { countFamily: 'poisson' });
  // robust
  const yr = x.map((v, i) => round(1 + 2 * v - z[i] + (i % 17 === 0 ? 8 : 0) + 0.7 * r.norm(), 3));
  P('rlm', 'robustreg', [num('y', withMissing(r, yr)), num('x', x), num('z', z), cat('g', g)], { y: 'y', predictors: ['x', 'z', 'g'] });
  P('rlm_alpha', 'robustreg', [num('y', yr), num('x', x)], { y: 'y', predictors: ['x'] }, {}, { alpha: 0.01 });
  // quantile (odd n so the median fit is unique)
  const yq = x.map((v, i) => round(2 + v + 0.5 * z[i] + (1 + 0.5 * Math.abs(v)) * r.norm(), 3));
  P('rq_median', 'quantile', [num('y', yq.slice(0, 149)), num('x', x.slice(0, 149)), num('z', z.slice(0, 149))], { y: 'y', predictors: ['x', 'z'] });
  P('rq_tau', 'quantile', [num('y', yq), num('x', x), cat('g', g)], { y: 'y', predictors: ['x', 'g'] }, { tau: 0.83 });
  P('rq_badtau', 'quantile', [num('y', yq), num('x', x)], { y: 'y', predictors: ['x'] }, { tau: 1.2 });
  // splines
  const ys = x.map((v, i) => round(Math.sin(1.5 * v) + 0.3 * z[i] + 0.4 * r.norm(), 3));
  P('spline', 'spline', [num('y', withMissing(r, ys)), num('x', x), num('z', z), cat('g', g)], { y: 'y', predictors: ['x', 'z', 'g'] });
  P('spline_df6', 'spline', [num('y', ys), num('x', x)], { y: 'y', predictors: ['x'] }, { df: 6 });
  P('spline_baddf', 'spline', [num('y', ys), num('x', x)], { y: 'y', predictors: ['x'] }, { df: 1 });
  // gam
  const yb = x.map((v, i) => bern(r, 1 / (1 + Math.exp(-(Math.sin(1.5 * v) + 0.5 * z[i])))));
  const yp = x.map((v, i) => poisson(r, Math.exp(0.5 + Math.sin(1.5 * v) * 0.7 + 0.2 * z[i])));
  P('gam', 'gam', [num('y', ys), num('x', x), num('z', z), cat('g', g)], { y: 'y', predictors: ['x', 'z', 'g'] });
  P('gam_binom', 'gam', [num('y', yb), num('x', x), num('z', z)], { y: 'y', predictors: ['x', 'z'] }, { family: 'binomial' });
  P('gam_pois', 'gam', [num('y', yp), num('x', x), cat('g', g)], { y: 'y', predictors: ['x', 'g'] }, { family: 'poisson', df: 8 });
  P('gam_nb', 'gam', [num('y', nb), num('x', x), num('z', z)], { y: 'y', predictors: ['x', 'z'] }, { family: 'negbin' });
  // more edge paths
  const xt = x.map(v => Math.round(v * 2) / 2), x3 = pick(r, n, [1, 2, 3]), x2 = pick(r, n, [0, 1]);
  P('none_selected', 'negbin', [num('count', nb), num('x', x)], { y: 'count', predictors: [] });
  P('multinom_alpha', 'multinomial', [cat('colour', m3), num('x', x), cat('g', g)], { y: 'colour', predictors: ['x', 'g'] }, {}, { alpha: 0.2 });
  P('negbin_poissonlike', 'negbin', [num('count', x.map(v => poisson(r, Math.exp(1 + 0.3 * v)))), num('x', x)], { y: 'count', predictors: ['x'] });
  P('hurdle_nozero', 'hurdle', [num('count', zi.map(v => v + 1)), num('x', x)], { y: 'count', predictors: ['x'] });
  P('hurdle_badfamily', 'hurdle', [num('count', zi), num('x', x)], { y: 'count', predictors: ['x'] }, { countFamily: 'binomial' });
  P('zip_offset', 'zeroinfl', [num('count', zi), num('x', x), num('t', expo)], { y: 'count', predictors: ['x'], offset: 't' }, { countFamily: 'poisson' });
  P('rlm_singular', 'robustreg', [num('y', yr), num('x', x), num('x2', x.map(v => 2 * v))], { y: 'y', predictors: ['x', 'x2'] });
  P('rq_low', 'quantile', [num('y', yq.slice(0, 149)), num('x', x.slice(0, 149))], { y: 'y', predictors: ['x'] }, { tau: 0.1 });
  P('rq_ties', 'quantile', [num('y', yq.map(v => Math.round(v))), num('x', xt)], { y: 'y', predictors: ['x'] }, { tau: 0.37 });
  P('spline_ties', 'spline', [num('y', ys), num('x', x3), num('z', z)], { y: 'y', predictors: ['x', 'z'] }, { df: 3 });
  P('gam_k3', 'gam', [num('y', ys), num('x', x), num('z', z), cat('g', g)], { y: 'y', predictors: ['g', 'x', 'z'] }, { df: 3 });
  P('gam_fewunique', 'gam', [num('y', ys), num('x', x), num('w', x3)], { y: 'y', predictors: ['x', 'w'] });
  P('gam_twounique', 'gam', [num('y', ys), num('x', x), num('w', x2)], { y: 'y', predictors: ['x', 'w'] });
  P('gam_binom_bad', 'gam', [num('y', ys), num('x', x)], { y: 'y', predictors: ['x'] }, { family: 'binomial' });
  P('gam_pois_ties', 'gam', [num('y', yp), num('x', xt), num('z', z)], { y: 'y', predictors: ['x', 'z'] }, { family: 'poisson' });
  P('gam_factoronly', 'gam', [num('y', ys), cat('g', g)], { y: 'y', predictors: ['g'] });
  P('gam_binom_factoronly', 'gam', [num('y', yb), cat('g', g)], { y: 'y', predictors: ['g'] }, { family: 'binomial' });
  { const N = 2400, r2 = rng(77), xb = normals(r2, N, 0, 1, 6), zb = normals(r2, N, 0, 1, 2), yb2 = xb.map((v, i) => round(Math.sin(2 * v) + 0.5 * zb[i] + 0.5 * r2.norm(), 4));
    P('gam_large', 'gam', [num('y', yb2), num('x', xb), num('z', zb)], { y: 'y', predictors: ['x', 'z'] }, { df: 10 }); }
  return out;
}
