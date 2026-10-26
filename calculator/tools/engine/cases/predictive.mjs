import { rng, packet, num, cat, normals, pick, withMissing, bern, round } from '../casekit.mjs';
export function cases() {
  const r = rng(57), out = [], add = (name, p, compare) => out.push(compare ? { name, packet: p, compare } : { name, packet: p });
  // three loose clusters in three variables
  const blobs = (n, seed = 1) => { const q = rng(seed), g = pick(q, n, [0, 1, 2]), mu = [[0, 0, 0], [3, 1, -2], [-1, 4, 2]]; return { g, a: g.map(k => round(mu[k][0] + q.norm(), 3)), b: g.map(k => round(10 * (mu[k][1] + q.norm()), 2)), c: g.map(k => round(mu[k][2] + 0.7 * q.norm(), 3)) }; };
  const B = blobs(120, 3), cols = (X, miss = false) => [num('alpha', miss ? withMissing(r, X.a, 0.05) : X.a), num('beta', X.b), num('gamma', miss ? withMissing(r, X.c, 0.05) : X.c)];
  const V = { variables: ['alpha', 'beta', 'gamma'] };
  // ---------- k-means ----------
  add('kmeans_default', packet('kmeans', cols(B), V));
  add('kmeans_raw_k4', packet('kmeans', cols(B), V, { standardize: false, clusters: 4 }));
  add('kmeans_k2', packet('kmeans', cols(B), V, { clusters: 2, seed: 11 }));
  add('kmeans_k6_seed', packet('kmeans', cols(B), V, { clusters: 6, seed: 2024 }));
  add('kmeans_missing', packet('kmeans', cols(B, true), V, { clusters: 3 }));
  add('kmeans_two_vars', packet('kmeans', cols(B).slice(0, 2), { variables: ['alpha', 'beta'] }, { clusters: 5 }));
  { const L = blobs(2500, 9); add('kmeans_large', packet('kmeans', cols(L), V, { clusters: 4 })); }
  { const t = Array.from({ length: 12 }, (_, i) => [1, 2, 3][i % 3]); add('kmeans_few_distinct', packet('kmeans', [num('u', t), num('w', t.map(v => v * 2))], { variables: ['u', 'w'] }, { clusters: 4 })); }
  add('kmeans_constant', packet('kmeans', [num('alpha', B.a), num('flat', B.a.map(() => 5))], { variables: ['alpha', 'flat'] }));
  add('kmeans_categorical', packet('kmeans', [num('alpha', B.a), cat('grp', B.g.map(k => 'g' + k))], { variables: ['alpha', 'grp'] }));
  add('kmeans_novars', packet('kmeans', cols(B), {}));
  add('kmeans_k_too_big', packet('kmeans', cols(B), V, { clusters: 120 }));
  add('kmeans_k_fraction', packet('kmeans', cols(B), V, { clusters: 2.5 }));
  add('kmeans_k_one', packet('kmeans', cols(B), V, { clusters: 1 }));
  // ---------- hierarchical ----------
  const H = blobs(90, 5);
  for (const lk of ['ward.D2', 'complete', 'average', 'single', 'ward.D', 'mcquitty', 'centroid', 'median']) add('hclust_' + lk, packet('hierarchical', cols(H), V, { linkage: lk, clusters: lk === 'single' ? 4 : 3 }));
  add('hclust_default_raw', packet('hierarchical', cols(H), V, { standardize: false }));
  add('hclust_k2_missing', packet('hierarchical', cols(H, true), V, { clusters: 2, linkage: 'average' }));
  add('hclust_partial_name', packet('hierarchical', cols(H), V, { linkage: 'comp', clusters: 5 }));
  add('hclust_bad_linkage', packet('hierarchical', cols(H), V, { linkage: 'fastest' }));
  add('hclust_ambiguous_linkage', packet('hierarchical', cols(H), V, { linkage: 'm' }));
  { const L = blobs(3001, 4); add('hclust_too_many', packet('hierarchical', cols(L), V)); }
  { const L = blobs(1200, 6); add('hclust_large', packet('hierarchical', cols(L), V, { clusters: 4 })); }
  add('hclust_constant', packet('hierarchical', [num('alpha', H.a), num('flat', H.a.map(() => 1))], { variables: ['alpha', 'flat'] }));
  // ---------- penalized regression and trees ----------
  const reg = (n, seed) => {
    const q = rng(seed), x1 = normals(q, n, 0, 1, 3), x2 = normals(q, n, 5, 2, 2), x3 = normals(q, n, 0, 1, 3), x4 = normals(q, n, 0, 1, 3), f = pick(q, n, ['north', 'south', 'east', 'west'], [0.35, 0.3, 0.25, 0.1]);
    const eff = { north: 0, south: 1.2, east: -0.8, west: 0.5 }, lin = x1.map((v, i) => 1.5 * v - 0.4 * x2[i] + 0.6 * x3[i] + eff[f[i]]);
    return { x1, x2, x3, x4, f, y: lin.map(v => round(v + q.norm(), 3)), yb: lin.map(v => bern(q, 1 / (1 + Math.exp(-(v + 2))))) };
  };
  const R1 = reg(150, 8), Rcols = (R, miss = false) => [num('score', miss ? withMissing(r, R.y, 0.06) : R.y), num('event', R.yb), num('dose', R.x1), num('age', miss ? withMissing(r, R.x2, 0.05) : R.x2), num('index', R.x3), num('noise', R.x4), cat('region', R.f)];
  const P = { y: 'score', predictors: ['dose', 'age', 'index', 'noise'] }, PF = { y: 'score', predictors: ['dose', 'age', 'region', 'index'] }, PB = { y: 'event', predictors: ['dose', 'age', 'index', 'noise', 'region'] };
  add('ridge_gaussian', packet('ridge', Rcols(R1), P));
  add('lasso_gaussian', packet('lasso', Rcols(R1), P));
  add('elastic_gaussian_factor', packet('elastic', Rcols(R1), PF));
  add('elastic_penalty_03', packet('elastic', Rcols(R1), PF, { penalty: 0.3, folds: 4 }));
  add('lasso_binomial', packet('lasso', Rcols(R1), PB, { family: 'binomial' }));
  add('ridge_binomial', packet('ridge', Rcols(R1), PB, { family: 'binomial', folds: 3 }));
  add('elastic_binomial_folds10', packet('elastic', Rcols(R1), PB, { family: 'binomial', folds: 10, seed: 77 }));
  add('lasso_folds10_train09', packet('lasso', Rcols(R1), PF, { folds: 10, trainFraction: 0.9 }));
  add('ridge_train05_seed', packet('ridge', Rcols(R1), PF, { trainFraction: 0.5, seed: 31 }));
  add('lasso_missing', packet('lasso', Rcols(R1, true), P));
  { const S = reg(32, 12); add('lasso_ungrouped_small', packet('lasso', Rcols(S), P, { trainFraction: 0.5, folds: 10 })); }
  { const S = reg(60, 13); add('ridge_binomial_small_folds', packet('ridge', Rcols(S), PB, { family: 'binomial', trainFraction: 0.5, folds: 10 })); }
  { const L = reg(2000, 14); add('elastic_large', packet('elastic', Rcols(L), PF)); add('lasso_binomial_large', packet('lasso', Rcols(L), PB, { family: 'binomial', folds: 10 })); add('tree_large', packet('tree', Rcols(L), PF, { complexity: 0.002 })); }
  add('lasso_small_n', packet('lasso', Rcols(reg(29, 15)), P));
  add('lasso_binomial_not01', packet('lasso', Rcols(R1), { y: 'score', predictors: P.predictors }, { family: 'binomial' }));
  add('lasso_one_predictor', packet('lasso', Rcols(R1), { y: 'score', predictors: ['dose'] }));
  add('lasso_no_predictors', packet('lasso', Rcols(R1), { y: 'score' }));
  add('lasso_train_too_big', packet('lasso', Rcols(R1), P, { trainFraction: 0.95 }));
  add('lasso_train_too_small', packet('lasso', Rcols(R1), P, { trainFraction: 0.3 }));
  add('lasso_folds_2', packet('lasso', Rcols(R1), P, { folds: 2 }));
  add('lasso_folds_11', packet('lasso', Rcols(R1), P, { folds: 11 }));
  add('elastic_penalty_bad', packet('elastic', Rcols(R1), P, { penalty: 1.5 }));
  add('ridge_folds_fraction', packet('ridge', Rcols(R1), P, { folds: 4.5 }));
  // trees
  add('tree_anova', packet('tree', Rcols(R1), PF));
  add('tree_anova_numeric', packet('tree', Rcols(R1), P, { complexity: 0.001, folds: 10 }));
  add('tree_class', packet('tree', Rcols(R1), PB, { family: 'binomial' }));
  add('tree_class_cp0', packet('tree', Rcols(R1), PB, { family: 'binomial', complexity: 0, folds: 3 }));
  add('tree_folds2_seed', packet('tree', Rcols(R1), PF, { folds: 2, seed: 5 }));
  add('tree_missing', packet('tree', Rcols(R1, true), PF, { trainFraction: 0.6 }));
  add('tree_root_only', packet('tree', Rcols(R1), { y: 'score', predictors: ['noise'] }, { complexity: 0.5 }));
  { // many-level factor: some levels can be absent from the training rows (surrogate / majority routing)
    const q = rng(41), n = 80, f = pick(q, n, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [0.25, 0.2, 0.15, 0.12, 0.1, 0.08, 0.06, 0.04]), x = normals(q, n, 0, 1, 2), up = { a: 0, b: 2, c: -1, d: 1.5, e: 0, f: -2, g: 3, h: 1 };
    const y = f.map((l, i) => round(up[l] + x[i] + 0.5 * q.norm(), 2));
    add('tree_rare_levels', packet('tree', [num('y', y), cat('site', f), num('x', x)], { y: 'y', predictors: ['site', 'x'] }, { complexity: 0.001, trainFraction: 0.5 }));
    add('lasso_rare_levels', packet('lasso', [num('y', y), cat('site', f), num('x', x)], { y: 'y', predictors: ['site', 'x'] }, { trainFraction: 0.5 }));
  }
  add('tree_small_n', packet('tree', Rcols(reg(25, 16)), PF));
  add('tree_binomial_not01', packet('tree', Rcols(R1), PF, { family: 'binomial' }));
  add('tree_folds_1', packet('tree', Rcols(R1), PF, { folds: 1 }));
  add('tree_folds_11', packet('tree', Rcols(R1), PF, { folds: 11 }));
  add('tree_cp_negative', packet('tree', Rcols(R1), PF, { complexity: -0.1 }));
  add('tree_no_predictors', packet('tree', Rcols(R1), { y: 'score' }));
  add('tree_seed_bad', packet('tree', Rcols(R1), PF, { seed: 1.5 }));
  return out;
}
