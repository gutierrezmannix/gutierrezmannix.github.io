// ---- GM26 Predict (machine learning) engine, build .99. Self-contained, offline, deterministic from a seed.
// prDesign: variables → a numeric design (numbers as they are, codes as dummies against the most frequent level, a
// "missing" level when a code is blank; numbers are imputed with the training median inside each fit, so nothing of the
// test rows leaks into the training). prRun (a generator, so the worker can report progress): split, k-fold cross-
// validation of each model over its tuning grid, the chosen model refitted on the training set and scored on the test
// set, permutation importance, partial dependence and performance by group. Models: logit / linear (weighted IRLS),
// lasso (glmnet's algorithm: coordinate descent on standardised columns, a path of 100 lambdas, lambda.1se by inner CV),
// decision tree (CART, weighted Gini or variance, depth-limited), random forest (weighted bootstrap, mtry, out-of-bag),
// gradient boosting (depth-3 trees, shrinkage 0.1, subsample 0.8, rounds by CV) and k-nearest neighbours (standardised
// Euclidean). Every metric is weighted when a weight is given (survey weights: Stata's [pw=], ranger's case.weights).

export function prRng(seed) { let a = (Number(seed) >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pr_isNum = v => typeof v === 'number' && isFinite(v);
const pr_sortIdx = (idx, key) => idx.slice().sort((p, q) => key[p] - key[q]);

// ---- the design matrix: columns of Float64Array (NaN = missing number); every column belongs to one variable
// vars: [{ name, kind: 'num' | 'cat', a: Float64Array | Array, labels?: Map code → label }]; rows: Int32Array of row ids
export function prDesign(vars, rows, o = {}) {
  const feats = [], groups = [], n = rows.length;
  for (let v = 0; v < vars.length; v++) {
    const V = vars[v];
    if (V.kind === 'num') { const a = new Float64Array(n); let miss = 0; for (let i = 0; i < n; i++) { const x = V.a[rows[i]]; a[i] = pr_isNum(x) ? x : NaN; if (!pr_isNum(x)) miss++; } feats.push({ name: V.name, v, kind: 'num', a, miss }); groups.push([feats.length - 1]); continue; }
    // codes: count the levels on the rows given; the most frequent level is the reference; rare levels (< 1% and < 20 rows) pool into "other"
    const cnt = new Map(), key = new Array(n);
    for (let i = 0; i < n; i++) { const x = V.a[rows[i]]; const k = x == null || x === '' || (typeof x === 'number' && !isFinite(x)) ? '\u0000missing' : String(x); key[i] = k; cnt.set(k, (cnt.get(k) || 0) + 1); }
    const lv = [...cnt.entries()].sort((p, q) => q[1] - p[1]); if (lv.length < 2) continue;
    const minN = Math.min(20, Math.max(2, Math.floor(n * 0.01))), keep = lv.filter(e => e[1] >= minN), rare = new Set(lv.filter(e => e[1] < minN).map(e => e[0]));
    const levels = keep.map(e => e[0]); if (rare.size) levels.push('\u0000other');
    const ref = levels[0], g = [];
    for (let L = 1; L < levels.length; L++) { const lev = levels[L], a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = (lev === '\u0000other' ? rare.has(key[i]) : key[i] === lev) ? 1 : 0; const lab = lev === '\u0000missing' ? 'missing' : lev === '\u0000other' ? 'other' : (V.labels && V.labels.get(Number(lev))) || lev; feats.push({ name: V.name + ' = ' + lab, v, kind: 'dummy', level: lev, levelLabel: lab, a, miss: 0 }); g.push(feats.length - 1); }
    groups.push(g); feats[g[0]].ref = (V.labels && V.labels.get(Number(ref))) || (ref === '\u0000missing' ? 'missing' : ref);
  }
  return { n, feats, groups, names: vars.map(v => v.name), X: feats.map(f => f.a) };
}

// ---- splits
export function prSplit(y, w, o, rng) {
  const n = y.length, test = new Uint8Array(n), kind = o.kind || 'random';
  if (kind === 'time') { for (let i = 0; i < n; i++) test[i] = pr_isNum(o.t[i]) && o.t[i] >= o.cut ? 1 : 0; }
  else if (kind === 'group') { for (let i = 0; i < n; i++) test[i] = String(o.g[i]) === String(o.hold) ? 1 : 0; }
  else { // random, stratified by the outcome (classes, or 5 quantile bins of a number)
    const strata = prStrata(y, o.binary), by = new Map(); for (let i = 0; i < n; i++) { const s = strata[i]; if (!by.has(s)) by.set(s, []); by.get(s).push(i); }
    const share = o.testShare == null ? 0.2 : o.testShare;
    for (const idx of by.values()) { prShuffle(idx, rng); const k = Math.round(idx.length * share); for (let j = 0; j < k; j++) test[idx[j]] = 1; }
  }
  const tr = [], te = []; for (let i = 0; i < n; i++) (test[i] ? te : tr).push(i);
  return { train: Int32Array.from(tr), test: Int32Array.from(te) };
}
export function prStrata(y, binary) { if (binary) return Array.from(y, v => v); const vals = [...y].filter(pr_isNum).sort((p, q) => p - q), q = k => vals[Math.min(vals.length - 1, Math.floor(vals.length * k / 5))]; const cuts = [1, 2, 3, 4].map(q); return Array.from(y, v => { let s = 0; while (s < 4 && v > cuts[s]) s++; return s; }); }
export function prShuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
export function prFolds(idx, y, binary, k, rng) { // stratified k folds over the rows idx
  const strata = prStrata(Array.from(idx, i => y[i]), binary), by = new Map(); idx.forEach((i, j) => { const s = strata[j]; if (!by.has(s)) by.set(s, []); by.get(s).push(i); });
  const fold = new Int32Array(y.length).fill(-1); let c = 0;
  for (const list of by.values()) { prShuffle(list, rng); for (const i of list) fold[i] = (c++) % k; }
  return fold;
}

// ---- weighted helpers on a design: columns X (Float64Array per feature), rows idx
function pr_colStats(X, idx, w) { // the training median first; then the weighted mean and sd of the column with its missing values imputed (what glmnet sees)
  return X.map(a => { const vals = []; for (const i of idx) { const x = a[i]; if (pr_isNum(x)) vals.push(x); } vals.sort((p, q) => p - q); const median = vals.length ? vals[vals.length >> 1] : 0;
    let s = 0, sw = 0; for (const i of idx) { const x = a[i], wi = w ? w[i] : 1; s += wi * (pr_isNum(x) ? x : median); sw += wi; } const m = sw ? s / sw : 0; let v = 0; for (const i of idx) { const x = pr_isNum(a[i]) ? a[i] : median, wi = w ? w[i] : 1; v += wi * (x - m) * (x - m); } return { mean: m, sd: sw ? Math.sqrt(v / sw) : 0, median }; });
}
function pr_rowOf(X, i, st, scale) { const p = X.length, r = new Float64Array(p); for (let j = 0; j < p; j++) { let x = X[j][i]; if (!pr_isNum(x)) x = st[j].median; r[j] = scale ? (st[j].sd > 0 ? (x - st[j].mean) / st[j].sd : 0) : x; } return r; }
function pr_chol(A, p) { const L = new Float64Array(p * p); for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) { let s = A[i * p + j]; for (let k = 0; k < j; k++) s -= L[i * p + k] * L[j * p + k]; if (i === j) { if (s <= 1e-12) s = 1e-12; L[i * p + i] = Math.sqrt(s); } else L[i * p + j] = s / L[j * p + j]; } return L; }
function pr_cholSolve(L, b, p) { const y = new Float64Array(p), x = new Float64Array(p); for (let i = 0; i < p; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * p + k] * y[k]; y[i] = s / L[i * p + i]; } for (let i = p - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < p; k++) s -= L[k * p + i] * x[k]; x[i] = s / L[i * p + i]; } return x; }

// ---- logit / linear regression by weighted IRLS on standardised columns (a tiny ridge keeps collinear dummies finite)
export function prFitGlm(X, y, w, idx, binary) {
  const st = pr_colStats(X, idx, w), p = X.length + 1, R = Array.from(idx, i => { const r = pr_rowOf(X, i, st, true); const z = new Float64Array(p); z[0] = 1; z.set(r, 1); return z; });
  let beta = new Float64Array(p); if (binary) { let s = 0, sw = 0; for (const i of idx) { s += (w ? w[i] : 1) * y[i]; sw += w ? w[i] : 1; } const m = Math.min(0.999, Math.max(0.001, s / sw)); beta[0] = Math.log(m / (1 - m)); }
  for (let it = 0; it < (binary ? 40 : 1); it++) {
    const A = new Float64Array(p * p), b = new Float64Array(p);
    for (let r = 0; r < idx.length; r++) { const i = idx[r], z = R[r], wi = w ? w[i] : 1; let eta = 0; for (let j = 0; j < p; j++) eta += z[j] * beta[j]; let mu, W, resid; if (binary) { mu = 1 / (1 + Math.exp(-eta)); W = Math.max(1e-6, mu * (1 - mu)); resid = (y[i] - mu) / W; } else { mu = eta; W = 1; resid = y[i] - mu; } const ww = wi * W, zz = eta + resid; for (let j = 0; j < p; j++) { b[j] += ww * z[j] * zz; const zj = ww * z[j]; for (let k = 0; k <= j; k++) A[j * p + k] += zj * z[k]; } }
    for (let j = 0; j < p; j++) { for (let k = 0; k < j; k++) A[k * p + j] = A[j * p + k]; A[j * p + j] += 1e-8 * (j ? 1 : 0); }
    const nb = pr_cholSolve(pr_chol(A, p), b, p); let d = 0; for (let j = 0; j < p; j++) d += Math.abs(nb[j] - beta[j]); beta = nb; if (d < 1e-8) break;
  }
  return { kind: binary ? 'logit' : 'linear', beta, st, binary };
}
function pr_glmLinear(m, X, i) { const r = pr_rowOf(X, i, m.st, true); let eta = m.beta[0]; for (let j = 0; j < r.length; j++) eta += r[j] * m.beta[j + 1]; return eta; }

// ---- lasso (glmnet): columns standardised with weights normalised to sum 1; soft-threshold coordinate descent; binomial
// by the quadratic approximation with weights capped at 1e-5 as glmnet does; lambda path from lambda_max down by 100
// steps to 1e-4 (n > p) or 1e-2; lambda chosen by inner k-fold CV on the deviance: the largest within one se of the best
export function prFitLasso(X, y, w, idx, binary, o = {}) {
  const n = idx.length, p = X.length, wn = new Float64Array(n); let sw = 0; for (let r = 0; r < n; r++) { wn[r] = w ? w[idx[r]] : 1; sw += wn[r]; } for (let r = 0; r < n; r++) wn[r] /= sw;
  const st = pr_colStats(X, idx, w), Z = []; for (let j = 0; j < p; j++) { const z = new Float64Array(n); for (let r = 0; r < n; r++) { let x = X[j][idx[r]]; if (!pr_isNum(x)) x = st[j].median; z[r] = st[j].sd > 0 ? (x - st[j].mean) / st[j].sd : 0; } Z.push(z); }
  const yy = Float64Array.from(idx, i => y[i]);
  const path = o.lambdas || prLambdaPath(Z, yy, wn, binary, p, n);
  const fitPath = (Z, yy, wn, lambdas) => { // warm starts down the path; returns [{ b0, b }] on the standardised scale
    const n = yy.length, p = Z.length, out = []; let b = new Float64Array(p), b0 = 0;
    if (binary) { let m = 0; for (let r = 0; r < n; r++) m += wn[r] * yy[r]; m = Math.min(0.999, Math.max(0.001, m)); b0 = Math.log(m / (1 - m)); } else { for (let r = 0; r < n; r++) b0 += wn[r] * yy[r]; }
    const eta = new Float64Array(n).fill(b0);
    for (const lam of lambdas) {
      for (let outer = 0; outer < (binary ? 25 : 1); outer++) {
        // working response and weights
        const W = new Float64Array(n), zr = new Float64Array(n); let swW = 0;
        for (let r = 0; r < n; r++) { if (binary) { const mu = 1 / (1 + Math.exp(-eta[r])); let v = mu * (1 - mu); if (v < 1e-5) { v = 1e-5; } W[r] = wn[r] * v; zr[r] = eta[r] + (yy[r] - mu) / v; } else { W[r] = wn[r]; zr[r] = yy[r]; } swW += W[r]; }
        const xw = Z.map(z => { let s = 0; for (let r = 0; r < n; r++) s += W[r] * z[r] * z[r]; return s; });
        // coordinate descent on (b0, b): residual r = zr - b0 - Zb
        const res = new Float64Array(n); for (let r = 0; r < n; r++) { let e = b0; for (let j = 0; j < p; j++) if (b[j]) e += Z[j][r] * b[j]; res[r] = zr[r] - e; }
        for (let it = 0; it < 200; it++) {
          let maxd = 0;
          { let s = 0; for (let r = 0; r < n; r++) s += W[r] * res[r]; const d = s / swW; if (d) { b0 += d; for (let r = 0; r < n; r++) res[r] -= d; maxd = Math.max(maxd, Math.abs(d)); } }
          for (let j = 0; j < p; j++) { const z = Z[j]; let g = 0; for (let r = 0; r < n; r++) g += W[r] * z[r] * res[r]; const u = g + xw[j] * b[j], nb = Math.abs(u) <= lam ? 0 : (u > 0 ? u - lam : u + lam) / xw[j]; const d = nb - b[j]; if (d) { b[j] = nb; for (let r = 0; r < n; r++) res[r] -= d * z[r]; maxd = Math.max(maxd, Math.abs(d) * Math.sqrt(xw[j])); } }
          if (maxd < 1e-7) break;
        }
        let change = 0; for (let r = 0; r < n; r++) { let e = b0; for (let j = 0; j < p; j++) if (b[j]) e += Z[j][r] * b[j]; change = Math.max(change, Math.abs(e - eta[r])); eta[r] = e; }
        if (!binary || change < 1e-7) break;
      }
      out.push({ b0, b: Float64Array.from(b) });
    }
    return out;
  };
  // inner cross-validation picks lambda
  let pick = path.length - 1, pick1se = pick, cvm = null, cvsd = null;
  if (o.cv !== false && n >= 20) {
    const k = Math.min(o.nfolds || 5, n), rng = prRng(o.seed || 1), fold = prFolds(Int32Array.from(Array.from({ length: n }, (_, r) => r)), yy, binary, k, rng);
    const dev = path.map(() => []), fw = path.map(() => []);
    for (let f = 0; f < k; f++) {
      const trR = [], teR = []; for (let r = 0; r < n; r++) (fold[r] === f ? teR : trR).push(r); if (!teR.length || trR.length < 2) continue;
      const Zt = Z.map(z => Float64Array.from(trR, r => z[r])), yt = Float64Array.from(trR, r => yy[r]); let swt = 0; const wt = Float64Array.from(trR, r => { swt += wn[r]; return wn[r]; }); for (let r = 0; r < wt.length; r++) wt[r] /= swt;
      const fits = fitPath(Zt, yt, wt, path);
      fits.forEach((F, L) => { let d = 0, s = 0; for (const r of teR) { let e = F.b0; for (let j = 0; j < p; j++) if (F.b[j]) e += Z[j][r] * F.b[j]; const wi = wn[r]; if (binary) { const mu = 1 / (1 + Math.exp(-e)); d += wi * -2 * (yy[r] ? Math.log(Math.max(1e-15, mu)) : Math.log(Math.max(1e-15, 1 - mu))); } else d += wi * (yy[r] - e) * (yy[r] - e); s += wi; } dev[L].push(d / s); fw[L].push(s); });
    }
    cvm = dev.map((d, L) => { let s = 0, t = 0; d.forEach((v, f) => { s += v * fw[L][f]; t += fw[L][f]; }); return s / t; });
    cvsd = dev.map((d, L) => { const m = cvm[L]; let s = 0, t = 0; d.forEach((v, f) => { s += fw[L][f] * (v - m) * (v - m); t += fw[L][f]; }); return Math.sqrt(s / t / Math.max(1, d.length - 1)); });
    pick = cvm.indexOf(Math.min(...cvm)); const lim = cvm[pick] + cvsd[pick]; pick1se = 0; while (pick1se < pick && cvm[pick1se] > lim) pick1se++;
  }
  const use = o.rule === 'min' ? pick : pick1se, fits = fitPath(Z, yy, wn, path.slice(0, use + 1)), F = fits[use];
  // back to the original scale
  const beta = new Float64Array(p + 1); let b0 = F.b0; for (let j = 0; j < p; j++) { const bj = st[j].sd > 0 ? F.b[j] / st[j].sd : 0; beta[j + 1] = bj; b0 -= bj * st[j].mean; } beta[0] = b0;
  return { kind: binary ? 'lasso-logit' : 'lasso', binary, beta, st, lambda: path[use], lambdaMin: path[pick], lambda1se: path[pick1se], path, cvm, cvsd, nonzero: F.b.filter(v => v !== 0).length, scaled: { b0: F.b0, b: F.b } };
}
export function prLambdaPath(Z, yy, wn, binary, p, n) { let ym = 0; for (let r = 0; r < n; r++) ym += wn[r] * yy[r]; let lmax = 0; for (let j = 0; j < p; j++) { let g = 0; for (let r = 0; r < n; r++) g += wn[r] * Z[j][r] * (yy[r] - ym); lmax = Math.max(lmax, Math.abs(g)); } if (!(lmax > 0)) lmax = 1e-3; const eps = n > p ? 1e-4 : 1e-2, K = 100, out = []; for (let k = 0; k < K; k++) out.push(lmax * Math.pow(eps, k / (K - 1))); return out; }
function pr_lassoLinear(m, X, i) { let e = m.beta[0]; for (let j = 0; j < X.length; j++) { let x = X[j][i]; if (!pr_isNum(x)) x = m.st[j].median; e += x * m.beta[j + 1]; } return e; }

// ---- CART: binary splits on every column (dummies included); weighted Gini (classes) or variance (numbers); depth and
// minimum leaf weight (count) limits; the leaf holds the weighted mean (a probability for classes)
export function prFitTree(X, y, w, idx, binary, o = {}, rng) {
  const maxDepth = o.maxDepth || 4, minLeaf = o.minLeaf || 5, mtry = o.mtry || 0, p = X.length, st = o.st || pr_colStats(X, idx, w);
  const nodes = []; // { f, cut, left, right } or { leaf, value, n }
  const val = i => y[i], wt = i => (w ? w[i] : 1);
  const build = (rows, depth) => { // rows: array of row ids
    let sw = 0, sy = 0, syy = 0; for (const i of rows) { const wi = wt(i), v = val(i); sw += wi; sy += wi * v; syy += wi * v * v; }
    const mean = sw ? sy / sw : 0, node = { leaf: true, value: mean, n: rows.length, w: sw }; const id = nodes.push(node) - 1;
    if (depth >= maxDepth || rows.length < 2 * minLeaf || (binary ? (mean <= 0 || mean >= 1) : syy / sw - mean * mean < 1e-12)) return id;
    const imp = (sw, sy, syy) => binary ? sw * (sy / sw) * (1 - sy / sw) : syy - sy * sy / sw; // weighted Gini × w, or weighted SSE
    const total = imp(sw, sy, syy); let best = null;
    let cols = Array.from({ length: p }, (_, j) => j); if (mtry && mtry < p) { prShuffle(cols, rng); cols = cols.slice(0, mtry); }
    for (const j of cols) {
      const a = X[j]; const xs = rows.map(i => { const x = a[i]; return pr_isNum(x) ? x : st[j].median; }); const ord = rows.map((_, k) => k).sort((u, v) => xs[u] - xs[v]);
      let lw = 0, ly = 0, lyy = 0, ln = 0;
      for (let k = 0; k < ord.length - 1; k++) { const i = rows[ord[k]], wi = wt(i), v = val(i); lw += wi; ly += wi * v; lyy += wi * v * v; ln++; const xk = xs[ord[k]], xn = xs[ord[k + 1]]; if (xk === xn) continue; if (ln < minLeaf || rows.length - ln < minLeaf) continue; const rw = sw - lw; if (!(lw > 0 && rw > 0)) continue; const gain = total - imp(lw, ly, lyy) - imp(rw, sy - ly, syy - lyy); if (gain > 1e-12 && (!best || gain > best.gain)) best = { gain, f: j, cut: (xk + xn) / 2 }; }
    }
    if (!best) return id;
    const L = [], R = []; for (const i of rows) { const x = X[best.f][i]; ((pr_isNum(x) ? x : st[best.f].median) < best.cut ? L : R).push(i); }
    node.leaf = false; node.f = best.f; node.cut = best.cut; node.gain = best.gain; node.left = build(L, depth + 1); node.right = build(R, depth + 1); return id;
  };
  build(Array.from(idx), 0);
  return { kind: 'tree', binary, nodes, st, maxDepth, minLeaf };
}
function pr_treePredict(nodes, st, X, i) { let k = 0; for (;;) { const nd = nodes[k]; if (nd.leaf) return nd.value; let x = X[nd.f][i]; if (!pr_isNum(x)) x = st[nd.f].median; k = x < nd.cut ? nd.left : nd.right; } }

// ---- random forest: each tree on a weighted bootstrap of the training rows (ranger's case.weights), mtry columns tried at
// each split, grown to leaves of minLeaf; prediction = mean of the trees; out-of-bag predictions kept
export function* prFitForest(X, y, w, idx, binary, o = {}, rng, prog) {
  const T = o.trees || 300, p = X.length, mtry = o.mtry || Math.max(1, Math.round(binary ? Math.sqrt(p) : p / 3)), minLeaf = o.minLeaf || (binary ? 5 : 5), st = pr_colStats(X, idx, w), n = idx.length;
  const cum = new Float64Array(n); let acc = 0; for (let r = 0; r < n; r++) { acc += w ? w[idx[r]] : 1; cum[r] = acc; }
  const trees = [], oobS = new Float64Array(y.length), oobN = new Float64Array(y.length);
  for (let t = 0; t < T; t++) {
    const inBag = new Uint8Array(n), rows = new Array(n); for (let r = 0; r < n; r++) { const u = rng() * acc; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; } rows[r] = idx[lo]; inBag[lo] = 1; }
    const m = prFitTree(X, y, null, rows, binary, { maxDepth: o.maxDepth || 30, minLeaf, mtry, st }, rng); trees.push(m.nodes);
    for (let r = 0; r < n; r++) if (!inBag[r]) { const i = idx[r]; oobS[i] += pr_treePredict(m.nodes, st, X, i); oobN[i]++; }
    if (prog && t % 10 === 9) yield prog((t + 1) / T);
  }
  const oob = new Float64Array(y.length).fill(NaN); for (const i of idx) if (oobN[i]) oob[i] = oobS[i] / oobN[i];
  return { kind: 'forest', binary, trees, st, mtry, minLeaf, oob };
}
function pr_forestPredict(m, X, i) { let s = 0; for (const nodes of m.trees) s += pr_treePredict(nodes, m.st, X, i); return s / m.trees.length; }

// ---- gradient boosting: F0 = logit(mean) or mean; each round a depth-3 regression tree on the gradient, leaves updated
// by one Newton step, shrunk by 0.1; 80% of the rows per round; staged predictions let CV pick the number of rounds
export function* prFitBoost(X, y, w, idx, binary, o = {}, rng, prog) {
  const R = o.rounds || 200, lr = o.lr || 0.1, depth = o.depth || 3, sub = o.sub || 0.8, st = pr_colStats(X, idx, w), n = idx.length;
  let sw = 0, sy = 0; for (const i of idx) { sw += w ? w[i] : 1; sy += (w ? w[i] : 1) * y[i]; } const m0 = sy / sw, F0 = binary ? Math.log(Math.max(1e-6, m0) / Math.max(1e-6, 1 - m0)) : m0;
  const F = new Float64Array(y.length); for (const i of idx) F[i] = F0; const trees = [], grad = new Float64Array(y.length), hess = new Float64Array(y.length);
  for (let t = 0; t < R; t++) {
    for (const i of idx) { if (binary) { const pr = 1 / (1 + Math.exp(-F[i])); grad[i] = y[i] - pr; hess[i] = Math.max(1e-6, pr * (1 - pr)); } else { grad[i] = y[i] - F[i]; hess[i] = 1; } }
    const rows = []; for (const i of idx) if (rng() < sub) rows.push(i); if (rows.length < 10) rows.push(...idx);
    const tr = prFitTree(X, grad, w, rows, false, { maxDepth: depth, minLeaf: o.minLeaf || 10, st }, rng);
    // Newton leaf values: sum(w·grad) / sum(w·hess) over the rows that fall in each leaf
    const leafG = new Float64Array(tr.nodes.length), leafH = new Float64Array(tr.nodes.length);
    for (const i of rows) { let k = 0; for (;;) { const nd = tr.nodes[k]; if (nd.leaf) break; let x = X[nd.f][i]; if (!pr_isNum(x)) x = st[nd.f].median; k = x < nd.cut ? nd.left : nd.right; } const wi = w ? w[i] : 1; leafG[k] += wi * grad[i]; leafH[k] += wi * hess[i]; }
    tr.nodes.forEach((nd, k) => { if (nd.leaf) nd.value = leafH[k] > 0 ? lr * leafG[k] / leafH[k] : 0; });
    trees.push(tr.nodes); for (const i of idx) F[i] += pr_treePredict(tr.nodes, st, X, i);
    if (prog && t % 10 === 9) yield prog((t + 1) / R);
  }
  return { kind: 'boost', binary, F0, trees, st, rounds: R, lr, depth };
}
function pr_boostLinear(m, X, i, upto) { let e = m.F0; const T = upto == null ? m.trees.length : Math.min(upto, m.trees.length); for (let t = 0; t < T; t++) e += pr_treePredict(m.trees[t], m.st, X, i); return e; }

// ---- k-nearest neighbours on standardised columns (a sample of 20,000 training rows at most)
export function prFitKnn(X, y, w, idx, binary, o = {}, rng) {
  const st = pr_colStats(X, idx, w); let tr = Array.from(idx); if (tr.length > 20000) { prShuffle(tr, rng); tr = tr.slice(0, 20000); }
  return { kind: 'knn', binary, k: o.k || 15, st, rows: Int32Array.from(tr), Z: tr.map(i => pr_rowOf(X, i, st, true)), y: Float64Array.from(tr, i => y[i]), w: Float64Array.from(tr, i => (w ? w[i] : 1)) };
}
function pr_knnPredict(m, X, i) { const z = pr_rowOf(X, i, m.st, true), n = m.Z.length, d = new Float64Array(n); for (let r = 0; r < n; r++) { const zr = m.Z[r]; let s = 0; for (let j = 0; j < z.length; j++) { const t = zr[j] - z[j]; s += t * t; } d[r] = s; } const all = Array.from({ length: n }, (_, r) => r).sort((p, q) => d[p] - d[q] || p - q); let kk = Math.min(m.k, n); while (kk < n && d[all[kk]] === d[all[kk - 1]]) kk++; const ord = all.slice(0, kk); let s = 0, sw = 0; for (const r of ord) { s += m.w[r] * m.y[r]; sw += m.w[r]; } return sw ? s / sw : NaN; }

// ---- one entry for every model
export function prPredictRow(m, X, i) {
  switch (m.kind) {
    case 'logit': return 1 / (1 + Math.exp(-pr_glmLinear(m, X, i)));
    case 'linear': return pr_glmLinear(m, X, i);
    case 'lasso-logit': return 1 / (1 + Math.exp(-pr_lassoLinear(m, X, i)));
    case 'lasso': return pr_lassoLinear(m, X, i);
    case 'tree': return pr_treePredict(m.nodes, m.st, X, i);
    case 'forest': return pr_forestPredict(m, X, i);
    case 'boost': { const e = pr_boostLinear(m, X, i, m.use); return m.binary ? 1 / (1 + Math.exp(-e)) : e; }
    case 'knn': return pr_knnPredict(m, X, i);
  }
  return NaN;
}
export function prPredict(m, X, idx) { const out = new Float64Array(idx.length); for (let r = 0; r < idx.length; r++) out[r] = prPredictRow(m, X, idx[r]); return out; }

// ---- metrics (weighted)
export function prAuc(y, p, w, idx) { // weighted Mann–Whitney with ties at half
  const rows = idx.filter(i => pr_isNum(p[i])).sort((a, b) => p[a] - p[b]); let s = 0, cumNeg = 0, pos = 0, neg = 0;
  for (let k = 0; k < rows.length;) { let e = k; let tiePos = 0, tieNeg = 0; while (e < rows.length && p[rows[e]] === p[rows[k]]) { const i = rows[e], wi = w ? w[i] : 1; if (y[i] === 1) tiePos += wi; else tieNeg += wi; e++; } s += tiePos * (cumNeg + tieNeg / 2); cumNeg += tieNeg; pos += tiePos; neg += tieNeg; k = e; }
  return pos && neg ? s / (pos * neg) : NaN;
}
export function prBinMetrics(y, p, w, idx, thr) {
  let tp = 0, fp = 0, tn = 0, fn = 0, brier = 0, ll = 0, sw = 0; const t = thr == null ? 0.5 : thr;
  for (const i of idx) { const pi = p[i]; if (!pr_isNum(pi)) continue; const wi = w ? w[i] : 1, yi = y[i]; sw += wi; const q = Math.min(1 - 1e-15, Math.max(1e-15, pi)); brier += wi * (pi - yi) * (pi - yi); ll -= wi * (yi ? Math.log(q) : Math.log(1 - q)); const hat = pi >= t ? 1 : 0; if (hat && yi) tp += wi; else if (hat && !yi) fp += wi; else if (!hat && yi) fn += wi; else tn += wi; }
  const sens = tp + fn ? tp / (tp + fn) : NaN, spec = tn + fp ? tn / (tn + fp) : NaN;
  return { auc: prAuc(y, p, w, idx), bal: (sens + spec) / 2, acc: (tp + tn) / sw, sens, spec, prec: tp + fp ? tp / (tp + fp) : NaN, brier: brier / sw, logloss: ll / sw, tp, fp, tn, fn, n: idx.length, thr: t };
}
export function prRegMetrics(y, p, w, idx) {
  let se = 0, ae = 0, sw = 0, sy = 0; for (const i of idx) { if (!pr_isNum(p[i])) continue; const wi = w ? w[i] : 1; sw += wi; sy += wi * y[i]; } const ym = sy / sw; let st = 0;
  for (const i of idx) { if (!pr_isNum(p[i])) continue; const wi = w ? w[i] : 1, e = y[i] - p[i]; se += wi * e * e; ae += wi * Math.abs(e); st += wi * (y[i] - ym) * (y[i] - ym); }
  return { rmse: Math.sqrt(se / sw), mae: ae / sw, r2: st ? 1 - se / st : NaN, n: idx.length };
}
export function prRoc(y, p, w, idx) { const rows = idx.filter(i => pr_isNum(p[i])).sort((a, b) => p[b] - p[a]); let P = 0, N = 0; for (const i of rows) { if (y[i]) P += w ? w[i] : 1; else N += w ? w[i] : 1; } const pts = [[0, 0]]; let tp = 0, fp = 0; for (let k = 0; k < rows.length; k++) { const i = rows[k]; if (y[i]) tp += w ? w[i] : 1; else fp += w ? w[i] : 1; if (k === rows.length - 1 || p[rows[k + 1]] !== p[i]) pts.push([fp / N, tp / P]); } const step = Math.max(1, Math.floor(pts.length / 200)); return pts.filter((_, k) => k % step === 0 || k === pts.length - 1); }
export function prCalibration(y, p, w, idx, bins) { const rows = idx.filter(i => pr_isNum(p[i])).sort((a, b) => p[a] - p[b]), B = bins || 10, out = []; for (let b = 0; b < B; b++) { const a = Math.floor(rows.length * b / B), e = Math.floor(rows.length * (b + 1) / B); let sp = 0, sy = 0, sw = 0; for (let k = a; k < e; k++) { const i = rows[k], wi = w ? w[i] : 1; sp += wi * p[i]; sy += wi * y[i]; sw += wi; } if (sw) out.push({ pred: sp / sw, obs: sy / sw, n: e - a }); } return out; }
export function prBootCi(fn, idx, rng, B) { const vals = []; for (let b = 0; b < (B || 200); b++) { const s = new Int32Array(idx.length); for (let k = 0; k < idx.length; k++) s[k] = idx[Math.floor(rng() * idx.length)]; const v = fn(s); if (pr_isNum(v)) vals.push(v); } vals.sort((a, b) => a - b); return vals.length ? [vals[Math.floor(vals.length * 0.025)], vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.975))]] : [NaN, NaN]; }

// ---- the tuning grid of each model
export function prGrid(kind, p, n, binary) {
  if (kind === 'tree') return [{ maxDepth: 2 }, { maxDepth: 3 }, { maxDepth: 4 }, { maxDepth: 6 }].map(g => Object.assign({ minLeaf: Math.max(5, Math.round(n * 0.01)) }, g));
  if (kind === 'forest') { const d = Math.max(1, Math.round(binary ? Math.sqrt(p) : p / 3)); return [...new Set([Math.max(1, Math.round(d / 2)), d, Math.min(p, d * 2)])].map(mtry => ({ mtry })); }
  if (kind === 'knn') return [5, 15, 25, 51].filter(k => k < n / 2).map(k => ({ k }));
  if (kind === 'boost') return [{ rounds: 50 }, { rounds: 100 }, { rounds: 200 }, { rounds: 300 }];
  return [{}];
}
function* pr_fitOne(kind, X, y, w, idx, binary, g, rng, prog) {
  if (kind === 'logit') return prFitGlm(X, y, w, idx, binary);
  if (kind === 'lasso') return prFitLasso(X, y, w, idx, binary, { seed: Math.floor(rng() * 1e9) });
  if (kind === 'tree') return prFitTree(X, y, w, idx, binary, g, rng);
  if (kind === 'forest') return yield* prFitForest(X, y, w, idx, binary, g, rng, prog);
  if (kind === 'boost') return yield* prFitBoost(X, y, w, idx, binary, g, rng, prog);
  if (kind === 'knn') return prFitKnn(X, y, w, idx, binary, g, rng);
  throw Error('unknown model ' + kind);
}
export const PR_MODELS = { logit: 'Logit (baseline)', lasso: 'Lasso logit', tree: 'Decision tree', forest: 'Random forest', boost: 'Gradient boosting', knn: 'k-nearest neighbours' };
export const PR_MODELS_REG = { logit: 'Linear regression (baseline)', lasso: 'Lasso', tree: 'Decision tree', forest: 'Random forest', boost: 'Gradient boosting', knn: 'k-nearest neighbours' };

// ---- the whole run. D: a design; y: Float64Array (0/1 or numbers); w: weights or null; spec: { binary, split, folds,
// models: ['logit', …], seed, metric, timeVar / groupVar arrays for the split, groupBy (array of labels, for the
// performance by group), trees }. Yields { p, label }; returns everything the page shows (models kept, so the page can
// predict, draw partial dependence and save predictions).
export function* prRun(D, y, w, spec) {
  const X = D.X, n = D.n, binary = !!spec.binary, rng = prRng(spec.seed || 2611), metric = spec.metric || (binary ? 'auc' : 'rmse'), better = (a, b) => metric === 'rmse' || metric === 'brier' || metric === 'logloss' ? a < b : a > b;
  const sp = prSplit(y, w, Object.assign({ binary }, spec.split || {}), rng), train = sp.train, test = sp.test;
  if (train.length < 30) throw Error('Only ' + train.length + ' rows to train on: use more rows, or a smaller test share.');
  const K = Math.max(2, Math.min(10, spec.folds || 5)), fold = prFolds(train, y, binary, K, rng);
  const byFold = []; for (let f = 0; f < K; f++) { const tr = [], va = []; for (const i of train) (fold[i] === f ? va : tr).push(i); byFold.push({ tr: Int32Array.from(tr), va: Int32Array.from(va) }); }
  const kinds = (spec.models && spec.models.length ? spec.models : ['logit']).filter(k => PR_MODELS[k]);
  const results = [], steps = kinds.reduce((s, k) => s + prGrid(k, X.length, train.length, binary).length * K + 1, 0); let done = 0;
  const metricOf = (idx, p) => binary ? prBinMetrics(y, p, w, idx, spec.thr == null ? null : spec.thr) : prRegMetrics(y, p, w, idx);
  const baseRate = (() => { let s = 0, sw = 0; for (const i of train) { s += (w ? w[i] : 1) * y[i]; sw += w ? w[i] : 1; } return s / sw; })();
  const thr = spec.thr == null ? (binary ? baseRate : null) : spec.thr;
  // the null model: the training mean for everyone
  { const p = new Float64Array(n).fill(baseRate); const te = binary ? prBinMetrics(y, p, w, test, thr) : prRegMetrics(y, p, w, test); results.push({ kind: 'null', label: binary ? 'Always the most common answer (null model)' : 'The mean of the training set (null model)', cv: null, test: te, tuned: '' }); }
  for (const kind of kinds) {
    const grid = prGrid(kind, X.length, train.length, binary); let best = null;
    const cands = kind === 'boost' ? [grid] : grid.map(g => [g]);   // boosting: one fit per fold, the rounds read off the same sequence
    for (const cand of cands) {
      const oofs = cand.map(() => new Float64Array(n).fill(NaN)), per = cand.map(() => []);
      for (let f = 0; f < K; f++) {
        const { tr, va } = byFold[f], g0 = kind === 'boost' ? { rounds: Math.max(...cand.map(g => g.rounds)) } : cand[0];
        const label = PR_MODELS[kind] + ' · fold ' + (f + 1) + ' of ' + K + (Object.keys(g0).length ? ' · ' + Object.entries(g0).map(e => e.join(' ')).join(', ') : '');
        const m = yield* pr_fitOne(kind, X, y, w, tr, binary, Object.assign({ trees: spec.trees || 200 }, g0), rng, q => ({ p: (done + q) / steps, label }));
        cand.forEach((g, c) => { if (kind === 'boost') m.use = g.rounds; for (const i of va) oofs[c][i] = prPredictRow(m, X, i); per[c].push(metricOf(va, oofs[c])); });
        done += cand.length; yield { p: done / steps, label };
      }
      cand.forEach((g, c) => {
        const vals = per[c].map(q => q[metric]).filter(pr_isNum), mean = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, vals.length - 1));
        const all = {}; for (const k of Object.keys(per[c][0])) { const v = per[c].map(q => q[k]).filter(pr_isNum); all[k] = v.reduce((a, b) => a + b, 0) / (v.length || 1); }
        const cnd = { g, mean, sd, per: per[c], all, oof: oofs[c] }; if (!best || better(mean, best.mean)) best = cnd;
      });
    }
    // refit the chosen configuration on the whole training set, score the test set and every row
    const m = yield* pr_fitOne(kind, X, y, w, train, binary, Object.assign({ trees: spec.trees || 200 }, best.g), rng, q => ({ p: (done + q) / steps, label: PR_MODELS[kind] + ' · final fit' })); done++; if (kind === 'boost') m.use = best.g.rounds;
    const pred = prPredict(m, X, Int32Array.from(Array.from({ length: n }, (_, i) => i)));
    const te = metricOf(test, pred);
    const tuned = kind === 'lasso' ? 'λ = ' + m.lambda.toPrecision(3) + ' (1-se) · ' + m.nonzero + ' of ' + X.length + ' terms kept' : kind === 'tree' ? 'depth ' + best.g.maxDepth : kind === 'forest' ? (spec.trees || 200) + ' trees · mtry ' + best.g.mtry : kind === 'boost' ? best.g.rounds + ' rounds · depth 3' : kind === 'knn' ? 'k = ' + best.g.k : '—';
    results.push({ kind, label: binary ? PR_MODELS[kind] : PR_MODELS_REG[kind], cv: { mean: best.mean, sd: best.sd, all: best.all, per: best.per.map(q => q[metric]), grid: grid.length }, test: te, tuned, model: m, pred, oof: best.oof });
    yield { p: done / steps, label: PR_MODELS[kind] + ' done' };
  }
  // ranking, and the extras for the best model
  const fitted = results.filter(r => r.model); let bestR = fitted[0]; for (const r of fitted) if (better(r.cv.mean, bestR.cv.mean)) bestR = r;
  for (const r of fitted) r.withinSd = r !== bestR && Math.abs(r.cv.mean - bestR.cv.mean) <= bestR.cv.sd;
  const extras = bestR ? prExtras(D, y, w, bestR, test, binary, thr, spec, rng) : null;
  return { binary, metric, thr, baseRate, train, test, fold, results: results.map(r => Object.assign({}, r, { oof: undefined })), best: bestR ? bestR.kind : null, extras, nTrain: train.length, nTest: test.length, p: X.length, nVars: D.groups.length };
}
export function prExtras(D, y, w, R, test, binary, thr, spec, rng) {
  const X = D.X, m = R.model, p = R.pred;
  const out = { roc: binary ? prRoc(y, p, w, test) : null, calib: binary ? prCalibration(y, p, w, test) : null };
  const metricFn = idx => binary ? prAuc(y, p, w, idx) : prRegMetrics(y, p, w, idx).rmse;
  out.ci = prBootCi(metricFn, Array.from(test), rng, 200);
  // permutation importance by variable (all of a code's dummies shuffled together), 5 repeats, on the test set
  const base = metricFn(test), imp = [];
  D.groups.forEach((cols, v) => {
    const saved = cols.map(j => Float64Array.from(X[j])), drops = [];
    for (let rep = 0; rep < 5; rep++) {
      const perm = prShuffle(Array.from(test), rng);
      cols.forEach((j, c) => { const a = X[j]; for (let k = 0; k < test.length; k++) a[test[k]] = saved[c][perm[k]]; });
      const pp = prPredict(m, X, test), q = new Float64Array(y.length); for (let k = 0; k < test.length; k++) q[test[k]] = pp[k];
      const v2 = binary ? prAuc(y, q, w, test) : prRegMetrics(y, q, w, test).rmse; drops.push(binary ? base - v2 : v2 - base);
      cols.forEach((j, c) => X[j].set(saved[c]));
    }
    const mean = drops.reduce((a, b) => a + b, 0) / drops.length, sd = Math.sqrt(drops.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 4);
    imp.push({ name: D.names[v], v, drop: mean, se: sd / Math.sqrt(5) });
  });
  out.importance = imp.sort((a, b) => b.drop - a.drop); out.baseMetric = base;
  // performance by group on the test set
  if (spec.groupBy) { const by = new Map(); for (const i of test) { const g = spec.groupBy[i]; if (g == null || g === '') continue; const k = String(g); if (!by.has(k)) by.set(k, []); by.get(k).push(i); } out.groups = [...by.entries()].filter(e => e[1].length >= 20).map(([k, idx]) => Object.assign({ group: k }, binary ? prBinMetrics(y, p, w, idx, thr) : prRegMetrics(y, p, w, idx), { predMean: idx.reduce((s, i) => s + p[i], 0) / idx.length })).sort((a, b) => b.n - a.n).slice(0, 12); }
  return out;
}
// partial dependence of the model on variable v (its columns), averaged over a sample of rows, with ICE lines; by: an
// optional label array splitting the rows into groups (one curve each)
export function prPdp(D, m, v, rows, o = {}) {
  const X = D.X, cols = D.groups[v], feats = cols.map(j => D.feats[j]), sample = rows.length > (o.sample || 300) ? Array.from(rows).filter((_, k) => k % Math.ceil(rows.length / (o.sample || 300)) === 0) : Array.from(rows);
  let grid; if (feats[0].kind === 'num') { const vals = sample.map(i => X[cols[0]][i]).filter(pr_isNum).sort((a, b) => a - b); grid = []; for (let k = 0; k < 20; k++) { const q = vals[Math.floor((vals.length - 1) * k / 19)]; if (!grid.length || q !== grid[grid.length - 1].x) grid.push({ x: q, label: String(+q.toPrecision(4)) }); } }
  else grid = [{ x: null, label: feats[0].ref || 'reference' }].concat(feats.map((f, c) => ({ x: c, label: f.levelLabel })));
  const saved = cols.map(j => Float64Array.from(X[j])), byG = o.by ? [...new Set(sample.map(i => String(o.by[i])))].slice(0, 6) : [null];
  const curves = byG.map(g => { const idx = g == null ? sample : sample.filter(i => String(o.by[i]) === g), ice = idx.slice(0, 60).map(() => []), pts = grid.map((pt, k) => { if (feats[0].kind === 'num') for (const i of idx) X[cols[0]][i] = pt.x; else cols.forEach((j, c) => { for (const i of idx) X[j][i] = c === pt.x ? 1 : 0; }); const pr = prPredict(m, X, Int32Array.from(idx)); let s = 0; for (let r = 0; r < pr.length; r++) { s += pr[r]; if (r < 60) ice[r].push(pr[r]); } return s / pr.length; }); cols.forEach((j, c) => X[j].set(saved[c])); return { group: g, pts, ice }; });
  return { grid: grid.map(g => g.label), curves, numeric: feats[0].kind === 'num', rug: feats[0].kind === 'num' ? sample.map(i => X[cols[0]][i]).filter(pr_isNum) : null };
}
// leakage check: near-copies of the outcome, id-like columns, the weight
export function prLeakage(vars, y, rows, binary, weightName, yName) {
  const out = []; rows = Array.from(rows);
  for (const V of vars) {
    if (V.name === weightName) { out.push({ name: V.name, why: 'it is the survey weight' }); continue; }
    const vals = rows.map(i => V.a[i]); const distinct = new Set(vals.filter(x => x != null && x !== '' && x === x)).size;
    if (distinct >= rows.length * 0.98 && rows.length > 50 && V.kind !== 'num') { out.push({ name: V.name, why: 'a different value in almost every row (an identifier)' }); continue; }
    if (binary && V.kind === 'cat' && distinct <= 20) { // the best one-to-one mapping of its levels onto the outcome, against the majority class
      const tab = new Map(); let pos = 0; rows.forEach((i, r) => { const k = String(vals[r]); if (!tab.has(k)) tab.set(k, [0, 0]); tab.get(k)[y[i] ? 1 : 0]++; pos += y[i] ? 1 : 0; }); let agree = 0; for (const [, c] of tab) agree += Math.max(c[0], c[1]); const share = agree / rows.length, base = Math.max(pos, rows.length - pos) / rows.length, lift = share - base;
      const stem = s => String(s).replace(/[\d_]+$/, ''), sameBlock = yName && stem(yName) && stem(yName) === stem(V.name) && yName !== V.name;
      if ((share >= 0.9 && lift >= 0.1) || (lift >= 0.25) || (sameBlock && lift >= 0.12)) out.push({ name: V.name, why: Math.round(100 * share) + '% agreement with the outcome (' + Math.round(100 * base) + '% by always guessing the common answer)' + (sameBlock ? ', and it is in the same question block' : '') + ': it may be the same question, or measured after it' });
    } else if (V.kind === 'num') { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, k = 0; rows.forEach((i, r) => { const x = vals[r]; if (!pr_isNum(x) || !pr_isNum(y[i])) return; k++; sx += x; sy += y[i]; sxx += x * x; syy += y[i] * y[i]; sxy += x * y[i]; }); const cov = sxy / k - (sx / k) * (sy / k), vx = sxx / k - (sx / k) ** 2, vy = syy / k - (sy / k) ** 2, r = vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0; if (Math.abs(r) >= 0.95) out.push({ name: V.name, why: 'correlation ' + r.toFixed(2) + ' with the outcome: it may be the same thing, or measured after it' }); }
  }
  return out;
}
