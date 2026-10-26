import { rng, packet, num, cat, normals, pick, withMissing, round } from '../casekit.mjs';
// Dunnett critical values come from mvtnorm's randomized quasi-Monte-Carlo in R (qmvt, ptol = 0.001); the engine
// integrates the many-to-one multivariate t exactly, so interval ends get a loosened tolerance (NOTES-anova.md).
const DUN = { tol: 3e-3, abs: 5e-3 };
export function cases() {
  const r = rng(31), n = 90, out = [], P = (name, id, cols, fields, options = {}, extra = {}, compare) => out.push({ name, packet: packet(id, cols, fields, options, extra), ...(compare ? { compare } : {}) });
  const g4 = pick(r, n, ['ctl', 'drugA', 'drugB', 'drugC'], [0.3, 0.2, 0.25, 0.25]), shift = { ctl: 0, drugA: 0.8, drugB: 1.5, drugC: 0.4 }, sdv = { ctl: 1, drugA: 1.6, drugB: 0.7, drugC: 2.2 };
  const y4 = g4.map(g => round(10 + shift[g] + sdv[g] * r.norm(), 3)), y4m = withMissing(r, y4, 0.06), g4m = withMissing(r, g4, 0.04);
  const A = pick(r, n, ['lo', 'hi']), B = pick(r, n, ['x', 'y', 'z'], [0.4, 0.35, 0.25]), Cn = pick(r, n, [1, 2, 10]), cov = normals(r, n, 50, 8, 2), cov2 = normals(r, n, 0, 1, 3);
  const yf = A.map((a, i) => round(5 + (a === 'hi' ? 1.2 : 0) + (B[i] === 'y' ? 0.7 : B[i] === 'z' ? -0.4 : 0) + (a === 'hi' && B[i] === 'z' ? 1.1 : 0) + 0.3 * Cn[i] / 10 + 0.05 * (cov[i] - 50) + 0.4 * cov2[i] + r.norm(), 3));
  const base = [num('score', y4m), cat('arm', g4m)], F = { y: 'score', group: 'arm' };
  // Welch ANOVA
  P('welch', 'welch_anova', base, F);
  P('welch_two', 'welch_anova', [num('score', y4.slice(0, 40)), cat('arm', g4.slice(0, 40).map(g => g === 'ctl' ? 'ctl' : 'trt'))], F);
  P('welch_single', 'welch_anova', [num('score', y4.slice(0, 20)), cat('arm', g4.slice(0, 20).map(() => 'ctl'))], F);
  P('welch_small_group', 'welch_anova', [num('score', [...y4.slice(0, 20), 3.2]), cat('arm', [...g4.slice(0, 20), 'solo'])], F);
  P('welch_constant', 'welch_anova', [num('score', [1, 2, 3, 4, 5, 5, 5, 5]), cat('arm', ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b'])], F);
  P('welch_numeric_groups', 'welch_anova', [num('score', y4), num('dose', Cn)], { y: 'score', group: 'dose' });
  // factorial
  const fc = [num('yield', yf), cat('A', A), cat('B', B), num('C', Cn), num('cov', cov), num('cov2', cov2), cat('Bm', withMissing(r, B, 0.05))];
  P('factorial_II', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] });
  P('factorial_III', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] }, { ss: 'III' });
  P('factorial_additive', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] }, { interactions: false });
  P('factorial_additive_III', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] }, { interactions: false, ss: 'III' });
  P('factorial_3way_II', 'factorial', fc, { y: 'yield', factors: ['A', 'B', 'C'] });
  P('factorial_3way_III', 'factorial', fc, { y: 'yield', factors: ['B', 'C', 'A'] }, { ss: 'III' }, { alpha: 0.1 });
  P('factorial_missing', 'factorial', fc, { y: 'yield', factors: ['A', 'Bm'] }, { ss: 'III' });
  P('factorial_numeric_type', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] }, { ss: 3 });
  P('factorial_bad_type', 'factorial', fc, { y: 'yield', factors: ['A', 'B'] }, { ss: 'I' });
  P('factorial_one_level', 'factorial', [num('yield', yf.slice(0, 30)), cat('A', A.slice(0, 30).map(() => 'lo')), cat('B', B.slice(0, 30))], { y: 'yield', factors: ['A', 'B'] });
  { const keep = A.map((a, i) => !(a === 'hi' && B[i] === 'z')); const s = v => v.filter((_, i) => keep[i]);
    P('factorial_empty_cell', 'factorial', [num('yield', s(yf)), cat('A', s(A)), cat('B', s(B))], { y: 'yield', factors: ['A', 'B'] }); }
  P('factorial_single_factor', 'factorial', fc, { y: 'yield', factors: ['B'] }, { ss: 'III' });
  // ANCOVA
  P('ancova_II', 'ancova', fc, { y: 'yield', group: 'B', covariates: ['cov'] });
  P('ancova_III', 'ancova', fc, { y: 'yield', group: 'B', covariates: ['cov', 'cov2'] }, { ss: 'III' });
  P('ancova_interact_II', 'ancova', fc, { y: 'yield', group: 'B', covariates: ['cov'] }, { interactions: true });
  P('ancova_interact_III', 'ancova', fc, { y: 'yield', group: 'A', covariates: ['cov', 'cov2'] }, { interactions: true, ss: 'III' });
  P('ancova_cat_covariate', 'ancova', fc, { y: 'yield', group: 'B', covariates: ['cov', 'A'] });
  P('ancova_cat_covariate_III', 'ancova', fc, { y: 'yield', group: 'C', covariates: ['A', 'cov'] }, { ss: 'III', interactions: true });
  // repeated measures (long format, shuffled rows)
  const rm = (ns, conds, sub = s => 's' + s) => { const rows = []; for (let s = 0; s < ns; s++) { const u = r.norm(); conds.forEach((c, j) => rows.push([sub(s), c, round(20 + 2 * u + 0.6 * j + (1 + 0.3 * j) * r.norm(), 2)])); } for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(r.unif() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; } return rows; };
  const RM = (name, rows, opts = {}, subjNum = false) => P(name, 'repeated', [num('rt', rows.map(x => x[2])), (subjNum ? num : cat)('id', rows.map(x => x[0])), cat('cond', rows.map(x => x[1]))], { y: 'rt', subject: 'id', group: 'cond' }, opts);
  RM('repeated', rm(14, ['t1', 't2', 't3', 't4']));
  RM('repeated_two', rm(10, ['pre', 'post']));
  RM('repeated_few_subjects', rm(3, ['a', 'b', 'c', 'd', 'e']));
  RM('repeated_numeric_subject', rm(9, ['a', 'b', 'c'], s => s * 3 + 1), {}, true);
  { const rows = rm(8, ['a', 'b', 'c']); rows[5][2] = null; RM('repeated_missing', rows); }
  { const rows = rm(8, ['a', 'b', 'c']); rows.push([rows[0][0], rows[0][1], 21.5]); RM('repeated_duplicate', rows); }
  { const rows = rm(8, ['a', 'b', 'c']).filter(x => !(x[0] === 's2' && x[1] === 'b')); RM('repeated_incomplete', rows); }
  RM('repeated_one_subject', rm(1, ['a', 'b', 'c']));
  // Tukey, Games–Howell
  P('tukey', 'tukey', base, F);
  P('tukey_alpha10', 'tukey', base, F, {}, { alpha: 0.1 });
  P('tukey_two', 'tukey', [num('score', y4.slice(0, 30)), cat('arm', g4.slice(0, 30).map(g => g === 'ctl' ? 'ctl' : 'trt'))], F);
  P('tukey_numeric_groups', 'tukey', [num('score', y4), num('dose', Cn)], { y: 'score', group: 'dose' });
  P('tukey_small_group', 'tukey', [num('score', [...y4.slice(0, 20), 3.2]), cat('arm', [...g4.slice(0, 20), 'solo'])], F);
  P('gameshowell', 'gameshowell', base, F);
  P('gameshowell_alpha01', 'gameshowell', base, F, {}, { alpha: 0.01 });
  P('gameshowell_zero_var', 'gameshowell', [num('score', [1, 1, 1, 2, 2, 2, 3, 4, 5]), cat('arm', ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c'])], F);
  // Dunnett
  P('dunnett', 'dunnett', base, F, {}, {}, DUN);
  P('dunnett_ref', 'dunnett', base, F, { reference: 'drugB' }, { alpha: 0.1 }, DUN);
  P('dunnett_bad_ref', 'dunnett', base, F, { reference: 'placebo' });
  P('dunnett_two', 'dunnett', [num('score', y4.slice(0, 30)), cat('arm', g4.slice(0, 30).map(g => g === 'ctl' ? 'ctl' : 'trt'))], F);
  P('dunnett_three', 'dunnett', [num('score', y4), cat('arm', g4.map(g => g === 'drugC' ? 'drugA' : g))], F, {}, {}, DUN);
  P('dunnett_numeric_ref', 'dunnett', [num('score', y4), num('dose', Cn)], { y: 'score', group: 'dose' }, { reference: 10 }, {}, DUN);
  { const g6 = pick(r, 150, ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'], [0.3, 0.1, 0.15, 0.15, 0.1, 0.2]); P('dunnett_six', 'dunnett', [num('score', g6.map(g => round(Number(g[1]) * 0.3 + r.norm(), 3))), cat('arm', g6)], F, {}, {}, DUN); }
  { const yy = [], gg = []; for (const [g, k] of [['c', 4], ['t1', 3], ['t2', 6], ['t3', 3]]) for (let i = 0; i < k; i++) { yy.push(round(r.norm() + (g === 't2' ? 1 : 0), 3)); gg.push(g); } P('dunnett_small_df', 'dunnett', [num('score', yy), cat('arm', gg)], F, {}, {}, DUN); }
  // planned contrasts
  const K = '1, -1, 0, 0\n0, 1, -1, 0\n1, 1, -1, -1\n3,-1,-1,-1';
  for (const adj of ['holm', 'bonferroni', 'BH', 'BY', 'hochberg', 'hommel', 'none']) P('contrasts_' + adj, 'contrasts', base, F, { contrasts: K, adjust: adj });
  P('contrasts_default', 'contrasts', base, F, { contrasts: '1,-1,0,0\n0,0,1,-1\n' });
  P('contrasts_one_row', 'contrasts', base, F, { contrasts: '-1 0.5 0.5 0', adjust: 'BY' });
  P('contrasts_bad_sum', 'contrasts', base, F, { contrasts: '1,-1,0,0\n1,0,0,0' });
  P('contrasts_wrong_length', 'contrasts', base, F, { contrasts: '1,-1,0' });
  P('contrasts_ragged', 'contrasts', base, F, { contrasts: '1,-1,0,0\n1,-1' });
  P('contrasts_empty', 'contrasts', base, F, {});
  P('contrasts_blank_line', 'contrasts', base, F, { contrasts: '1,-1,0,0\n\n0,1,-1,0' });
  P('contrasts_text', 'contrasts', base, F, { contrasts: '1,-1,a,0' });
  P('contrasts_bad_adjust', 'contrasts', base, F, { contrasts: K, adjust: 'tukey' });
  // pairwise
  P('pairwise', 'pairwise', base, F);
  P('pairwise_BH', 'pairwise', base, F, { adjust: 'BH' });
  P('pairwise_hommel', 'pairwise', base, F, { adjust: 'hommel' });
  P('pairwise_rank', 'pairwise', base, F, { rank: true });
  P('pairwise_rank_ties', 'pairwise', [num('score', y4.map(v => Math.round(v))), cat('arm', g4)], F, { rank: true, adjust: 'none' });
  P('pairwise_numeric_groups', 'pairwise', [num('score', y4), num('dose', Cn)], { y: 'score', group: 'dose' }, { adjust: 'bonferroni' });
  P('pairwise_constant', 'pairwise', [num('score', [1, 1, 1, 1, 1, 1, 3, 4, 5]), cat('arm', ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c'])], F);
  P('pairwise_rank_constant', 'pairwise', [num('score', [1, 1, 1, 1, 1, 1, 3, 4, 5]), cat('arm', ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c'])], F, { rank: true });
  P('pairwise_bad_adjust', 'pairwise', base, F, { adjust: 'Holm' });
  P('pairwise_small_group', 'pairwise', [num('score', [...y4.slice(0, 20), 3.2]), cat('arm', [...g4.slice(0, 20), 'solo'])], F);
  P('no_complete', 'tukey', [num('score', [null, 1, null]), cat('arm', ['a', null, 'b'])], F);
  return out;
}
