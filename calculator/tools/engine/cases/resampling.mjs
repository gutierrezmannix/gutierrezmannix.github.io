import { rng, packet, num, cat, normals, pick, withMissing, bern, round } from '../casekit.mjs';
export function cases() {
  const r = rng(23), out = [];
  const add = (name, id, cols, fields, options = {}, extra = {}) => out.push({ name, packet: packet(id, cols, fields, options, extra) });
  // ---------- bootstrap ----------
  const y40 = normals(r, 40, 10, 3, 2), y41 = normals(r, 41, 5, 2, 1), y60 = Array.from({ length: 60 }, () => Math.round(20 + 6 * r.norm()));
  const skew = Array.from({ length: 80 }, () => round(Math.exp(r.norm()), 3));
  add('boot_mean', 'bootstrap', [num('score', y40)], { y: 'score' });
  add('boot_median_odd', 'bootstrap', [num('score', y41)], { y: 'score' }, { statistic: 'median', repetitions: 1999 });
  add('boot_median_even', 'bootstrap', [num('score', y60)], { y: 'score' }, { statistic: 'median' });
  add('boot_sd', 'bootstrap', [num('income', skew)], { y: 'income' }, { statistic: 'sd', repetitions: 2500, seed: 99 });
  add('boot_alpha10_99', 'bootstrap', [num('score', y40)], { y: 'score' }, { repetitions: 99, seed: 4 }, { alpha: 0.1 });
  add('boot_missing', 'bootstrap', [num('score', withMissing(r, skew, 0.1)), num('other', withMissing(r, y60.concat(y60).slice(0, 80), 0.1))], { y: 'score', predictors: 'other' }, { statistic: 'mean', repetitions: 500 });
  { const big = normals(r, 400, 50, 12, 2); add('boot_n400_mean', 'bootstrap', [num('w', big)], { y: 'w' }, { repetitions: 3000 }); add('boot_n400_median', 'bootstrap', [num('w', big)], { y: 'w' }, { statistic: 'median', repetitions: 3000 }); }
  { const big = normals(r, 1200, 0, 1, 3); add('boot_n1200_jack', 'bootstrap', [num('w', big)], { y: 'w' }, { repetitions: 5000, statistic: 'sd' }); }
  add('boot_bca_fail', 'bootstrap', [num('score', normals(r, 150, 0, 1, 2))], { y: 'score' }, { repetitions: 99 });
  add('boot_const', 'bootstrap', [num('score', new Array(25).fill(3))], { y: 'score' });
  add('boot_n1_sd', 'bootstrap', [num('score', [4])], { y: 'score' }, { statistic: 'sd' });
  add('boot_w_infinite', 'bootstrap', [num('score', [...new Array(40).fill(0), 1, 1, 2])], { y: 'score' }, { statistic: 'median' });
  add('boot_cat_y', 'bootstrap', [cat('grp', pick(r, 30, ['a', 'b']))], { y: 'grp' });
  add('boot_bad_stat', 'bootstrap', [num('score', y40)], { y: 'score' }, { statistic: 'iqr' });
  add('boot_reps_low', 'bootstrap', [num('score', y40)], { y: 'score' }, { repetitions: 50 });
  add('boot_reps_frac', 'bootstrap', [num('score', y40)], { y: 'score' }, { repetitions: 1000.5 });
  { const n = 70, tt = Array.from({ length: n }, (_, i) => i + 1), perm = r.sample(tt), ar = []; let e = 0; for (let i = 0; i < n; i++) { e = 0.6 * e + r.norm(); ar.push(round(10 + e, 3)); }
    const yy = perm.map(t => ar[t - 1]);
    add('boot_block_mean', 'bootstrap', [num('y', yy), num('t', perm)], { y: 'y', time: 't' }, { resample: 'block', blockLength: 5 });
    add('boot_block_median', 'bootstrap', [num('y', yy), num('t', perm)], { y: 'y', time: 't' }, { resample: 'block', blockLength: 7, statistic: 'median', repetitions: 1500 });
    add('boot_block_sd_l1', 'bootstrap', [num('y', yy), num('t', perm)], { y: 'y', time: 't' }, { resample: 'block', blockLength: 1, statistic: 'sd' });
    add('boot_block_cat_time', 'bootstrap', [num('y', yy.slice(0, 20)), cat('t', perm.slice(0, 20).map(v => 'w' + String(v).padStart(2, '0')))], { y: 'y', time: 't' }, { resample: 'block', blockLength: 3 });
    add('boot_block_no_time', 'bootstrap', [num('y', yy)], { y: 'y' }, { resample: 'block' });
    add('boot_block_L_big', 'bootstrap', [num('y', yy.slice(0, 10)), num('t', perm.slice(0, 10))], { y: 'y', time: 't' }, { resample: 'block', blockLength: 10 }); }
  // ---------- permutation (coin::independence_test, approximate) ----------
  { const n = 60, g = pick(r, n, ['ctrl', 'trt']), y = g.map(v => round(r.norm() + (v === 'trt' ? 0.5 : 0), 3)), s = pick(r, n, ['s1', 's2', 's3']);
    add('perm_basic', 'permutation', [num('y', y), cat('arm', g)], { y: 'y', group: 'arm' }, { repetitions: 9999 });
    add('perm_99', 'permutation', [num('y', y), cat('arm', g)], { y: 'y', group: 'arm' }, { repetitions: 99, seed: 7 });
    add('perm_strata', 'permutation', [num('y', y), cat('arm', g), cat('site', s)], { y: 'y', group: 'arm', strata: 'site' }, { repetitions: 5000 });
    add('perm_strata_numeric', 'permutation', [num('y', y), cat('arm', g), num('site', s.map(v => Number(v[1]) * 10))], { y: 'y', group: 'arm', strata: 'site' }, { repetitions: 2000 });
    add('perm_missing', 'permutation', [num('y', withMissing(r, y, 0.1)), cat('arm', withMissing(r, g, 0.05))], { y: 'y', group: 'arm' }, { repetitions: 3000 });
    add('perm_factor_y3', 'permutation', [cat('resp', pick(r, n, ['lo', 'mid', 'hi'])), cat('arm', g)], { y: 'resp', group: 'arm' }, { repetitions: 4000 });
    add('perm_factor_y2', 'permutation', [cat('resp', pick(r, n, ['no', 'yes'])), cat('arm', g)], { y: 'resp', group: 'arm' }, { repetitions: 4000 });
    add('perm_numeric_group', 'permutation', [num('y', y), num('arm', g.map(v => v === 'trt' ? 1 : 0))], { y: 'y', group: 'arm' }, { repetitions: 1000 });
    add('perm_3groups', 'permutation', [num('y', y), cat('site', s)], { y: 'y', group: 'site' });
    add('perm_1group', 'permutation', [num('y', y), cat('arm', new Array(n).fill('a'))], { y: 'y', group: 'arm' });
    add('perm_singleton_block', 'permutation', [num('y', y.slice(0, 9)), cat('arm', g.slice(0, 9)), cat('site', ['a', 'a', 'a', 'b', 'b', 'b', 'b', 'b', 'c'])], { y: 'y', group: 'arm', strata: 'site' }, { repetitions: 99 });
    add('perm_const', 'permutation', [num('y', new Array(n).fill(2)), cat('arm', g)], { y: 'y', group: 'arm' }, { repetitions: 99 });
    add('perm_reps_high', 'permutation', [num('y', y), cat('arm', g)], { y: 'y', group: 'arm' }, { repetitions: 200000 });
    add('perm_seed_bad', 'permutation', [num('y', y), cat('arm', g)], { y: 'y', group: 'arm' }, { seed: 1.5 }); }
  { const n = 3000, g = pick(r, n, ['a', 'b']), y = g.map(v => round(r.norm() + (v === 'a' ? 0.05 : 0), 3)), s = pick(r, n, ['x', 'y', 'z', 'w']);
    add('perm_large', 'permutation', [num('y', y), cat('g', g), cat('s', s)], { y: 'y', group: 'g', strata: 's' }, { repetitions: 20000 }); }
  // ---------- impute (mice + glm + pool) ----------
  { const n = 90, x1 = normals(r, n, 50, 10, 1), grp = pick(r, n, ['ctl', 'trt']), edu = pick(r, n, ['hs', 'ba', 'phd'], [0.5, 0.3, 0.2]);
    const y = x1.map((v, i) => round(2 + 0.08 * v + (grp[i] === 'trt' ? 1 : 0) + (edu[i] === 'phd' ? 0.7 : 0) + r.norm(), 2)), cnt = y.map(v => Math.max(0, Math.round(v)));
    const yb = y.map(v => v > 6.5 ? 1 : 0), yM = withMissing(r, y, 0.15), x1M = withMissing(r, x1, 0.15), grpM = withMissing(r, grp, 0.12), eduM = withMissing(r, edu, 0.12);
    add('imp_pmm', 'impute', [num('y', yM), num('x1', x1M), cat('grp', grp)], { y: 'y', predictors: ['x1', 'grp'] });
    add('imp_logreg', 'impute', [num('y', yM), num('x1', x1), cat('grp', grpM)], { y: 'y', predictors: ['x1', 'grp'] }, { imputations: 3, iterations: 4 });
    add('imp_polyreg', 'impute', [num('y', y), num('x1', x1M), cat('edu', eduM)], { y: 'y', predictors: ['x1', 'edu'] }, { imputations: 4, iterations: 5, seed: 11 });
    add('imp_all', 'impute', [num('y', yM), num('x1', x1M), cat('grp', grpM), cat('edu', eduM)], { y: 'y', predictors: ['x1', 'grp', 'edu'] }, { imputations: 5, iterations: 6 }, { alpha: 0.1 });
    add('imp_binomial', 'impute', [num('pass', withMissing(r, yb, 0.1)), num('x1', x1M), cat('grp', grp)], { y: 'pass', predictors: ['x1', 'grp'] }, { family: 'binomial', imputations: 3, iterations: 3 });
    add('imp_poisson', 'impute', [num('count', withMissing(r, cnt, 0.1)), num('x1', x1M)], { y: 'count', predictors: ['x1'] }, { family: 'poisson', iterations: 3 });
    add('imp_factor_y', 'impute', [cat('grp', grpM), num('x1', x1M), num('y', y)], { y: 'grp', predictors: ['x1', 'y'] }, { family: 'binomial', iterations: 3 });
    add('imp_constant', 'impute', [num('y', yM), num('x1', x1M), num('k', new Array(n).fill(3))], { y: 'y', predictors: ['x1', 'k'] }, { iterations: 2 });
    add('imp_collinear', 'impute', [num('y', yM), num('x1', x1M), num('x2', x1M.map(v => v === null ? null : 2 * v + 1))], { y: 'y', predictors: ['x1', 'x2'] }, { iterations: 2 });
    add('imp_nomissing', 'impute', [num('y', y), num('x1', x1)], { y: 'y', predictors: ['x1'] });
    add('imp_nopred', 'impute', [num('y', yM)], { y: 'y' });
    add('imp_m1', 'impute', [num('y', yM), num('x1', x1M)], { y: 'y', predictors: ['x1'] }, { imputations: 1 });
    add('imp_it0', 'impute', [num('y', yM), num('x1', x1M)], { y: 'y', predictors: ['x1'] }, { iterations: 0 }); }
  return out;
}
