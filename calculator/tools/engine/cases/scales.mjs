import { rng, packet, num, cat, normals, pick, withMissing, round } from '../casekit.mjs';
// Eigenvector / factor signs are arbitrary up to reflection: loadings and scores are compared sign-free per column.
const SF = { signFree: ['Component loadings', 'Component scores', 'Factor loadings', 'Factor scores'] };
export function cases() {
  const r = rng(41), out = [];
  const gen = (n, L, noise = 0.6) => { const f = L[0].map(() => normals(r, n, 0, 1, 6)); return L.map(l => Array.from({ length: n }, (_, i) => round(l.reduce((s, w, k) => s + w * f[k][i], 0) + noise * r.norm(), 3))); };
  const L2 = [[0.8, 0.1], [0.7, 0.2], [0.75, 0], [0.1, 0.8], [0.2, 0.7], [0, 0.65]], L3 = [[0.8, 0, 0.1], [0.7, 0.2, 0], [0.7, 0, 0], [0, 0.8, 0.1], [0.1, 0.7, 0], [0, 0.7, 0.2], [0.1, 0, 0.8], [0, 0.2, 0.7], [0.2, 0, 0.7]];
  const X2 = gen(220, L2), X3 = gen(300, L3, 0.55), small = gen(40, L2.slice(0, 4), 0.8);
  const cols = (X, pre = 'item') => X.map((v, i) => num(pre + (i + 1), v)), names = (X, pre = 'item') => X.map((_, i) => pre + (i + 1));
  const P = (name, id, X, o = {}, extra = {}, c = cols(X), vars = names(X), compare = SF) => out.push({ name, packet: packet(id, c, { variables: vars }, o, extra), compare });
  // PCA
  P('pca_default', 'pca', X2);
  P('pca_unscaled', 'pca', X2, { standardize: false });
  P('pca_small', 'pca', small);
  P('pca_missing', 'pca', X2, {}, {}, X2.map((v, i) => num('item' + (i + 1), withMissing(r, v, 0.04))));
  P('pca_two', 'pca', X2.slice(0, 2));
  P('pca_one', 'pca', X2.slice(0, 1));
  P('pca_constant', 'pca', X2, {}, {}, [...cols(X2.slice(0, 3)), num('item4', X2[0].map(() => 3))], ['item1', 'item2', 'item3', 'item4']);
  P('pca_categorical', 'pca', X2, {}, {}, [...cols(X2.slice(0, 3)), cat('grp', pick(r, 220, ['a', 'b']))], ['item1', 'item2', 'item3', 'grp']);
  // EFA
  P('efa_default', 'efa', X2);
  P('efa_varimax', 'efa', X2, { rotation: 'varimax' });
  P('efa_promax', 'efa', X2, { rotation: 'promax' });
  P('efa_none', 'efa', X2, { rotation: 'none' });
  P('efa_ml', 'efa', X2, { factorMethod: 'ml' });
  P('efa_pa', 'efa', X2, { factorMethod: 'pa', rotation: 'varimax' });
  P('efa_one', 'efa', X2, { nfactors: 1 });
  P('efa_three', 'efa', X3, { nfactors: 3 });
  P('efa_three_promax_ml', 'efa', X3, { nfactors: 3, rotation: 'promax', factorMethod: 'ml' });
  P('efa_three_varimax_pa', 'efa', X3, { nfactors: 3, rotation: 'varimax', factorMethod: 'pa' });
  P('efa_missing', 'efa', X2, {}, {}, X2.map((v, i) => num('item' + (i + 1), withMissing(r, v, 0.05))));
  P('efa_small', 'efa', small, { nfactors: 1 });
  P('efa_toomany', 'efa', X2, { nfactors: 6 });
  P('efa_zero', 'efa', X2, { nfactors: 0 });
  P('efa_fraction', 'efa', X2, { nfactors: 1.5 });
  P('efa_text', 'efa', X2, { nfactors: 'two' });
  P('efa_one_var', 'efa', X2.slice(0, 1));
  P('efa_constant', 'efa', X2, {}, {}, [...cols(X2.slice(0, 3)), num('item4', X2[0].map(() => 1))], ['item1', 'item2', 'item3', 'item4']);
  P('efa_quartimin_uls', 'efa', X3, { nfactors: 3, rotation: 'quartimin', factorMethod: 'uls' });
  P('efa_badfm', 'efa', X2, { factorMethod: 'foo' });
  P('efa_badrotation', 'efa', X2, { rotation: 'bogus' });
  P('efa_ml_one', 'efa', X3, { nfactors: 1, factorMethod: 'ml' });
  P('efa_pa_promax4', 'efa', X3, { nfactors: 4, rotation: 'promax', factorMethod: 'pa' });
  P('pca_large_unscaled_missing', 'pca', X3, { standardize: false }, {}, X3.map((v, i) => num('item' + (i + 1), withMissing(r, v, 0.02))));
  return out;
}
