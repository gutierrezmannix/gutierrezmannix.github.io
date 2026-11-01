// ===== ERGM by Markov chain Monte Carlo maximum likelihood, as in R's ergm() (statnet):
// TNT (tie / no-tie) Metropolis–Hastings sampler, MPLE start, Hummel-style step lengths with the log-normal
// approximation, final standard errors from the simulated statistics, plain-language failure messages, and
// goodness of fit (degrees, edgewise shared partners, distances) like gof().
// Terms: edges, mutual, gwesp(decay, fixed; OTP for directed as ergm >= 4), gwidegree/gwodegree/gwdegree(decay, fixed),
// nodematch, nodecov (undirected), nodeicov, nodeocov (directed), absdiff.

export const NL_TERM_INFO = {
  edges: { label: 'Baseline (any tie)', r: () => 'edges' },
  mutual: { label: 'Ties are returned', r: () => 'mutual', dir: true },
  gwesp: { label: 'Friends of friends (shared contacts)', r: t => 'gwesp(' + t.decay + ', fixed = TRUE)' },
  gwideg: { label: 'A few receive many ties', r: t => 'gwidegree(' + t.decay + ', fixed = TRUE)', dir: true },
  gwodeg: { label: 'A few send many ties', r: t => 'gwodegree(' + t.decay + ', fixed = TRUE)', dir: true },
  gwdeg: { label: 'A few have many ties', r: t => 'gwdegree(' + t.decay + ', fixed = TRUE)', und: true },
  nodematch: { label: t => 'Same ' + t.a, r: t => 'nodematch("' + t.a + '")' },
  nodecov: { label: t => 'Higher ' + t.a + ' → more ties', r: t => 'nodecov("' + t.a + '")', und: true },
  nodeicov: { label: t => 'Higher ' + t.a + ' → receives more', r: t => 'nodeicov("' + t.a + '")', dir: true },
  nodeocov: { label: t => 'Higher ' + t.a + ' → sends more', r: t => 'nodeocov("' + t.a + '")', dir: true },
  absdiff: { label: t => 'Difference in ' + t.a, r: t => 'absdiff("' + t.a + '")' }
};
export function nlTermLabel(t) { const i = NL_TERM_INFO[t.t]; return typeof i.label === 'function' ? i.label(t) : i.label; }
export function nlTermR(t) { return NL_TERM_INFO[t.t].r(t); }
// check terms against the network; returns { terms, error, missing: [{a, count}] }
export function nlErgmCheck(net, spec) {
  const terms = [{ t: 'edges' }], missing = [];
  for (const t of spec) {
    if (t.t === 'edges') continue;
    const info = NL_TERM_INFO[t.t]; if (!info) return { error: 'Unknown effect: ' + t.t };
    if (info.dir && !net.directed) return { error: '“' + nlTermLabel(t) + '” needs ties with a direction (choose “Directed” in step 1).' };
    if (info.und && net.directed) return { error: '“' + nlTermLabel(t) + '” is for undirected networks.' };
    if (t.a !== undefined) {
      const a = net.attrs[t.a]; if (!a) return { error: 'The characteristic “' + t.a + '” is not in the people file.' };
      if (t.t !== 'nodematch' && a.kind !== 'num') return { error: '“' + t.a + '” is a category — use “same ' + t.a + '” instead of a number effect.' };
      const miss = t.t === 'nodematch' ? a.v.filter(v => v == null).length : Array.from(a.x).filter(v => !isFinite(v)).length;
      if (miss) missing.push({ a: t.a, count: miss });
    }
    terms.push(Object.assign({}, t, t.t.startsWith('gw') ? { decay: t.decay == null ? 0.5 : t.decay } : {}));
  }
  if (missing.length) { const m = missing[0]; return { terms, missing, error: m.count + ' ' + (m.count === 1 ? 'person has' : 'people have') + ' no “' + m.a + '” value.' }; }
  return { terms, missing };
}

// ---------- dynamic network state with incremental shared-partner counts
function nlState(net, terms) {
  const n = net.n, dir = net.directed, N2 = n * n;
  const adj = new Uint8Array(N2), outL = Array.from({ length: n }, () => []), inL = dir ? Array.from({ length: n }, () => []) : outL;
  const outP = new Int32Array(N2), inP = dir ? new Int32Array(N2) : outP;
  const edgeArr = [], edgePos = new Int32Array(N2).fill(-1);
  const needSP = terms.some(t => t.t === 'gwesp'), sp = needSP ? new Int32Array(N2) : null;
  const key = (i, j) => dir ? i * n + j : (i < j ? i * n + j : j * n + i);
  const S = { n, dir, adj, outL, inL, sp, edgeArr, edgePos, key, E: 0, D: dir ? n * (n - 1) : n * (n - 1) / 2 };
  const lpush = (L, P, a, b) => { P[a * n + b] = L[a].length; L[a].push(b); };
  const lpop = (L, P, a, b) => { const arr = L[a], p = P[a * n + b], last = arr.pop(); if (last !== b) { arr[p] = last; P[a * n + last] = p; } };
  S.add = (i, j) => {
    if (dir) { if (sp) { for (const m of outL[j]) sp[i * n + m]++; for (const m of inL[i]) sp[m * n + j]++; } adj[i * n + j] = 1; lpush(outL, outP, i, j); lpush(inL, inP, j, i); }
    else { if (sp) { for (const m of outL[j]) { sp[i * n + m]++; sp[m * n + i]++; } for (const m of outL[i]) { sp[j * n + m]++; sp[m * n + j]++; } } adj[i * n + j] = adj[j * n + i] = 1; lpush(outL, outP, i, j); lpush(outL, outP, j, i); }
    const k = key(i, j); edgePos[k] = edgeArr.length; edgeArr.push(k); S.E++;
  };
  S.remove = (i, j) => {
    if (dir) { adj[i * n + j] = 0; lpop(outL, outP, i, j); lpop(inL, inP, j, i); if (sp) { for (const m of outL[j]) sp[i * n + m]--; for (const m of inL[i]) sp[m * n + j]--; } }
    else { adj[i * n + j] = adj[j * n + i] = 0; lpop(outL, outP, i, j); lpop(outL, outP, j, i); if (sp) { for (const m of outL[j]) { sp[i * n + m]--; sp[m * n + i]--; } for (const m of outL[i]) { sp[j * n + m]--; sp[m * n + j]--; } } }
    const k = key(i, j), p = edgePos[k], last = edgeArr.pop(); if (last !== k) { edgeArr[p] = last; edgePos[last] = p; } edgePos[k] = -1; S.E--;
  };
  return S;
}
// change statistics for adding the absent tie i->j (or i--j)
function nlChange(S, terms, net, i, j, out, cache) {
  const n = S.n, adj = S.adj;
  for (let t = 0; t < terms.length; t++) {
    const T = terms[t]; let d = 0;
    switch (T.t) {
      case 'edges': d = 1; break;
      case 'mutual': d = adj[j * n + i]; break;
      case 'gwesp': { const r = T.rp, ea = T.ea, sp = S.sp; d = ea * (1 - r[sp[i * n + j]]);
        if (S.dir) { for (const m of S.outL[i]) if (adj[j * n + m]) d += r[sp[i * n + m]]; for (const m of S.inL[j]) if (adj[m * n + i]) d += r[sp[m * n + j]]; }
        else { const A = S.outL[i].length < S.outL[j].length ? i : j, Bn = A === i ? j : i; for (const m of S.outL[A]) if (adj[Bn * n + m]) d += r[sp[i * n + m]] + r[sp[j * n + m]]; }
        break; }
      case 'gwideg': d = T.rp[S.inL[j].length]; break;
      case 'gwodeg': d = T.rp[S.outL[i].length]; break;
      case 'gwdeg': d = T.rp[S.outL[i].length] + T.rp[S.outL[j].length]; break;
      case 'nodematch': d = T.v[i] != null && T.v[i] === T.v[j] ? 1 : 0; break;
      case 'nodecov': d = T.x[i] + T.x[j]; break;
      case 'nodeicov': d = T.x[j]; break;
      case 'nodeocov': d = T.x[i]; break;
      case 'absdiff': d = Math.abs(T.x[i] - T.x[j]); break;
    }
    out[t] = d;
  }
  return out;
}
function nlPrepTerms(net, terms) {
  return terms.map(t => { const T = Object.assign({}, t); if (t.t.startsWith('gw')) { const a = t.decay, r = 1 - Math.exp(-a); T.ea = Math.exp(a); T.rp = Float64Array.from({ length: net.n + 2 }, (_, k) => Math.pow(r, k)); } if (t.a !== undefined) { const at = net.attrs[t.a]; T.v = at.v; T.x = at.x; } return T; });
}
// statistics of the observed network: add its ties one by one (sum of change statistics)
function nlObsStats(net, terms) {
  const T = nlPrepTerms(net, terms), S = nlState(net, T), p = T.length, g = new Float64Array(p), d = new Float64Array(p);
  for (const [a, b] of net.edges) { if (S.adj[a * net.n + b]) continue; nlChange(S, T, net, a, b, d); for (let k = 0; k < p; k++) g[k] += d[k]; S.add(a, b); }
  return { g, S, T };
}
// MPLE: logistic regression of each tie on its change statistics (exact MLE for models without dyad dependence)
export function nlMple(net, terms) {
  const { S, T } = nlObsStats(net, terms), n = net.n, p = T.length, dir = net.directed, D = S.D;
  if (D > 900000) return { error: 'This network is too large for the model in the browser (' + n + ' people). Use the R code under Save.' };
  const y = new Float64Array(D), X = T.slice(1).map(() => new Float64Array(D)), d = new Float64Array(p); let k = 0;
  for (let i = 0; i < n; i++) for (let j = dir ? 0 : i + 1; j < n; j++) {
    if (i === j) continue; const present = S.adj[i * n + j]; if (present) S.remove(i, j);
    nlChange(S, T, net, i, j, d); if (present) S.add(i, j); y[k] = present; for (let t = 1; t < p; t++) X[t - 1][k] = d[t]; k++;
  }
  const fit = glm(y, X.map((a, t) => ({ name: nlTermLabel(T[t + 1]), kind: 'num', a })), null, 'logistic');
  if (fit.error) return { error: fit.error };
  return { coef: fit.coefs.map(c => c.b), se: fit.coefs.map(c => c.se), converged: fit.converged && fit.coefs.every(c => isFinite(c.b) && isFinite(c.se) && Math.abs(c.b) < 25) };
}
// two-sided normal p-value (erfc, Numerical Recipes; relative error < 1.2e-7)
export function nlP2(zv) { const x = Math.abs(zv) / Math.SQRT2, t = 1 / (1 + 0.5 * x); return t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); }
function nlSolve(A, b) { const n = b.length, M = A.map((r, i) => Array.from(r).concat([b[i]])); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }
function nlInv(A) { const n = A.length, out = []; for (let c = 0; c < n; c++) { const e = new Array(n).fill(0); e[c] = 1; const x = nlSolve(A, e); if (!x) return null; out.push(x); } return out[0].map((_, i) => out.map(r => r[i])); }
// effective sample size of a chain (Geyer's initial positive sequence)
export function nlEss(x) { const n = x.length; let m = 0; for (const v of x) m += v / n; let c0 = 0; for (const v of x) c0 += (v - m) ** 2 / n; if (!(c0 > 0)) return n; const rho = k => { let s = 0; for (let i = 0; i + k < n; i++) s += (x[i] - m) * (x[i + k] - m); return s / n / c0; }; let sum = 0; for (let k = 1; k < Math.min(n - 1, 400); k += 2) { const g2 = rho(k) + rho(k + 1); if (g2 <= 0) break; sum += g2; } return n / (1 + 2 * sum); }
function nlMeanCov(G) { const S = G.length, p = G[0].length, mu = new Float64Array(p); for (const g of G) for (let k = 0; k < p; k++) mu[k] += g[k] / S; const C = Array.from({ length: p }, () => new Float64Array(p)); for (const g of G) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) C[a][b] += (g[a] - mu[a]) * (g[b] - mu[b]) / (S - 1); return { mu, C }; }
// TNT Metropolis–Hastings steps; keeps g (current statistics) in sync
function nlSteps(S, T, net, theta, g, steps, rnd, d) {
  const n = S.n, p = T.length, D = S.D, dir = S.dir;
  for (let s = 0; s < steps; s++) {
    let i, j;
    if (S.E > 0 && rnd() < 0.5) { const k = S.edgeArr[Math.floor(rnd() * S.E)]; i = Math.floor(k / n); j = k - i * n; }
    else { i = Math.floor(rnd() * n); j = Math.floor(rnd() * (n - 1)); if (j >= i) j++; if (!dir && i > j) { const t = i; i = j; j = t; } }
    const present = S.adj[i * n + j];
    if (present) {
      const E = S.E; S.remove(i, j); nlChange(S, T, net, i, j, d); let lr = 0; for (let k = 0; k < p; k++) lr -= theta[k] * d[k];
      lr += Math.log((0.5 / D) / (0.5 / E + 0.5 / D));
      if (lr >= 0 || rnd() < Math.exp(lr)) { for (let k = 0; k < p; k++) g[k] -= d[k]; } else S.add(i, j);
    } else {
      nlChange(S, T, net, i, j, d); let lr = 0; for (let k = 0; k < p; k++) lr += theta[k] * d[k];
      lr += Math.log((0.5 / (S.E + 1) + 0.5 / D) / (0.5 / D));
      if (lr >= 0 || rnd() < Math.exp(lr)) { S.add(i, j); for (let k = 0; k < p; k++) g[k] += d[k]; }
    }
  }
}
// simulate networks from a model (used by tests and by goodness of fit)
export function* nlSimulate(net, terms, theta, o = {}) {
  const T = nlPrepTerms(net, terms), p = T.length, rnd = nlRng(o.seed || 7), empty = { n: net.n, directed: net.directed, edges: [], attrs: net.attrs };
  const start = o.fromObserved ? net : empty; const ob = nlObsStats(start, terms); const S = ob.S, g = Float64Array.from(ob.g), d = new Float64Array(p);
  const interval = o.interval || 1024, burnin = o.burnin == null ? 16 * interval : o.burnin, nsim = o.nsim || 100, stats = [], nets = [];
  nlSteps(S, T, net, theta, g, burnin, rnd, d);
  for (let s = 0; s < nsim; s++) { nlSteps(S, T, net, theta, g, interval, rnd, d); stats.push(Array.from(g)); if (o.keep) nets.push(S.edgeArr.map(k => [Math.floor(k / net.n), k % net.n])); if (s % 10 === 0) yield { p: s / nsim, msg: 'Simulating networks' }; }
  return { stats, nets };
}
// the full fit. o: { seed, maxIter, samplesize, interval, gof }
export function* nlErgm(net, spec, o = {}) {
  const chk = nlErgmCheck(net, spec); if (chk.error) return { error: chk.error, missing: chk.missing, kind: chk.missing && chk.missing.length ? 'missing' : 'spec' };
  const terms = chk.terms, p = terms.length, labels = terms.map(nlTermLabel), n = net.n;
  if (n > 1400) return { error: 'The model runs in the browser for up to 1,400 people (this network has ' + n + '). Use the R code under Save.', kind: 'size' };
  const t0 = Date.now(); yield { p: 0.01, msg: 'Starting values (pseudo-likelihood)' };
  const ob = nlObsStats(net, terms), gobs = ob.g, D = ob.S.D; let S = ob.S, T = ob.T;
  // boundary checks: MLE does not exist when an observed statistic sits at its minimum or maximum
  for (let k = 1; k < p; k++) {
    const t = terms[k];
    if (t.t === 'nodematch' && (gobs[k] === 0 || gobs[k] === gobs[0])) return { error: gobs[k] === 0 ? 'No tie connects two people with the same “' + t.a + '”, so its effect cannot be estimated (it would be minus infinity). Remove “' + labels[k] + '”.' : 'Every tie connects people with the same “' + t.a + '”, so its effect cannot be estimated (it would be infinite). Remove “' + labels[k] + '” or report it descriptively.', kind: 'boundary', term: k };
    if (t.t === 'mutual' && (gobs[k] === 0)) return { error: 'No tie is returned, so “Ties are returned” cannot be estimated. Remove it.', kind: 'boundary', term: k };
    if (t.t === 'mutual' && gobs[k] * 2 === gobs[0]) return { error: 'Every tie is returned (the network is effectively undirected). Choose “Undirected” in step 1, or remove “Ties are returned”.', kind: 'boundary', term: k };
  }
  if (gobs[0] === 0) return { error: 'The network has no ties.', kind: 'spec' };
  const mple = nlMple(net, terms); if (mple.error) return { error: mple.error, kind: 'size' };
  let theta = mple.converged ? Float64Array.from(mple.coef) : Float64Array.from({ length: p }, (_, k) => k === 0 ? Math.log(gobs[0] / (D - gobs[0])) : 0);
  const mpleOut = { coef: Array.from(mple.coef), se: Array.from(mple.se), converged: mple.converged };
  const dyadIndep = !terms.some(t => t.t === 'mutual' || t.t.startsWith('gw'));
  const rnd = nlRng(o.seed || 26), d = new Float64Array(p), g = Float64Array.from(gobs);
  let interval = o.interval || Math.min(20000, Math.max(1024, Math.round(1.5 * gobs[0]))); const size = o.samplesize || 512, maxIter = o.maxIter || 30, maxInterval = o.maxInterval || 32768, targetESS = o.ess || 64, budget = (o.seconds || 90) * 1000;
  // every round starts its chain from the observed network, as ergm does, so a chain stuck in an extreme mode cannot carry over
  const sampleAt = function* (th, m, burn, tag, frac0, frac1) {
    if (G0started) { const o2 = nlObsStats(net, terms); S = o2.S; T = o2.T; g.set(gobs); } G0started = true;
    nlSteps(S, T, net, th, g, burn, rnd, d); const G = [];
    for (let s = 0; s < m; s++) { nlSteps(S, T, net, th, g, interval, rnd, d); G.push(Array.from(g)); if (s % 64 === 0) { yield { p: frac0 + (frac1 - frac0) * s / m, msg: tag }; if (s >= 64 && Date.now() - t0 > budget * 1.15) break; } }
    return G;
  };
  let G0started = false; const hist = []; let G = null, conv = false, it = 0, degenerate = null, post = 0, timedOut = false, lambda = 1, bad = 0; const avg = new Float64Array(p);
  const theta0 = Float64Array.from(theta), safe = Float64Array.from({ length: p }, (_, k) => k === 0 ? Math.log(gobs[0] / (D - gobs[0])) : 0); let lastGood = null;
  for (it = 1; it <= maxIter; it++) {
    if (it > 1 && Date.now() - t0 > budget) { timedOut = true; if (post) for (let k = 0; k < p; k++) theta[k] = avg[k]; break; }
    G = yield* sampleAt(theta, size, it === 1 ? 16 * interval : 6 * interval, 'Simulating networks · round ' + it, 0.05 + 0.75 * (it - 1) / maxIter, 0.05 + 0.75 * it / maxIter);
    const { mu, C } = nlMeanCov(G);
    // runaway samples (almost empty or complete networks): step back towards a safe start (edges only) and try again,
    // as the starting values from pseudo-likelihood are often too strong in dense networks
    const zero = []; for (let k = 0; k < p; k++) if (!(C[k][k] > 1e-12)) zero.push(k);
    const stuck = zero.some(k => Math.abs(mu[k] - gobs[k]) > 1e-6 * (1 + Math.abs(gobs[k]))) || Array.from(mu).some((m, k) => C[k][k] > 1e-12 && Math.abs(m - gobs[k]) / Math.sqrt(C[k][k]) > 60);
    const runaway = mu[0] > Math.max(0.85 * D, 1.5 * gobs[0]) || (gobs[0] > 10 && mu[0] < 0.1 * gobs[0]) || zero.includes(0) || stuck;
    if (runaway) { bad++; if (bad > 7) { degenerate = mu[0] > 1.2 * gobs[0] ? 'full' : mu[0] < 0.8 * gobs[0] ? 'empty' : 'extreme'; break; } if (lastGood) { for (let k = 0; k < p; k++) theta[k] = lastGood[k] + (theta[k] - lastGood[k]) / 2; } else { lambda /= 2; for (let k = 0; k < p; k++) theta[k] = safe[k] + lambda * (theta0[k] - safe[k]); } post = 0; avg.fill(0); hist.push({ it, runaway: true, edges: mu[0], lambda }); continue; }
    if (zero.length) return { error: '“' + labels[zero[0]] + '” never changes in the simulated networks, so it cannot be estimated (for example, almost nobody has this value). Remove it.', kind: 'zero', term: zero[0], mple: mpleOut, hist, debug: { mu: Array.from(mu), diag: C.map((r, k) => r[k]), theta: Array.from(theta) } };
    const sd = Array.from(C, (r, k) => Math.sqrt(r[k])), tr = Array.from(mu, (m, k) => (m - gobs[k]) / sd[k]), tmax = Math.max(...tr.map(Math.abs));
    // Hummel step: move the target towards the observed statistics only as far as the sample can support
    const Ci = nlInv(C.map(r => Array.from(r))); if (!Ci) return { error: 'Two effects measure the same thing (they are perfectly related in the simulated networks). Remove one of them.', kind: 'collinear', mple: mpleOut };
    const maha = v => { let s2 = 0; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) s2 += v[a] * Ci[a][b] * v[b]; return Math.sqrt(Math.max(0, s2)); };
    const md = G.map(r => maha(r.map((x, k) => x - mu[k]))).sort((a, b) => a - b), lim = md[Math.floor(0.95 * md.length)];
    let gamma = 1; const diff = Array.from(gobs, (x, k) => x - mu[k]); const full = maha(diff); if (full > lim) gamma = Math.max(0.05, lim / full * 0.95);
    const step = nlSolve(C.map(r => Array.from(r)), diff.map(v => v * gamma)); if (!step) return { error: 'The model could not be estimated (singular covariance). Remove an effect.', kind: 'collinear', mple: mpleOut };
    // effective sample size: lengthen the chain between samples until the averages are precise enough (like ergm's adaptive MCMC)
    const ess = Math.min(...Array.from({ length: p }, (_, k) => nlEss(G.map(r => r[k]))));
    if (ess < targetESS && interval < maxInterval) interval = Math.min(maxInterval, Math.ceil(interval * Math.min(4, Math.max(1.5, targetESS / Math.max(ess, 1)))));
    // near the answer: smaller and smaller steps and average the estimates (Polyak–Ruppert), so noise is not chased
    if (gamma === 1 && tmax < 0.5) post++; else { post = 0; avg.fill(0); }
    const gain = post > 1 ? 1 / Math.sqrt(post) : 1;
    // trust region (Geyer–Thompson): keep the new estimate where the current sample still describes the likelihood well,
    // i.e. the importance weights exp(step · (g - mean)) keep an effective sample size of at least 1/8 of the sample
    for (let k = 0; k < p; k++) step[k] = gain * Math.max(-3, Math.min(3, step[k]));
    for (let half = 0; half < 30; half++) { let sw = 0, sw2 = 0, mxl = -Infinity; const lw = G.map(r => { let v = 0; for (let k = 0; k < p; k++) v += step[k] * (r[k] - mu[k]); if (v > mxl) mxl = v; return v; }); for (const v of lw) { const w = Math.exp(v - mxl); sw += w; sw2 += w * w; } if (sw * sw / sw2 >= G.length / 8) break; for (let k = 0; k < p; k++) step[k] /= 2; }
    lastGood = Float64Array.from(theta);
    for (let k = 0; k < p; k++) theta[k] += step[k];
    if (post) for (let k = 0; k < p; k++) avg[k] += (theta[k] - avg[k]) / post;
    hist.push({ it, gamma, tmax, ess, interval, theta: Array.from(theta) });
    if (post >= 3 && tmax < 0.12) { conv = true; for (let k = 0; k < p; k++) theta[k] = avg[k]; break; }
    if (post >= 6 && tmax < 0.25) { conv = true; for (let k = 0; k < p; k++) theta[k] = avg[k]; break; }
    if (!isFinite(theta[0])) break;
    if (Date.now() - t0 > budget) { timedOut = true; if (post) for (let k = 0; k < p; k++) theta[k] = avg[k]; break; }
  }
  if (degenerate) return { error: 'The model is degenerate: with these effects the simulated networks become ' + (degenerate === 'full' ? 'almost complete (everyone tied to everyone)' : degenerate === 'empty' ? 'almost empty' : 'extreme (for example, no shared contacts at all)') + ', instead of looking like yours. This usually means “Friends of friends” or a popularity effect is too strong for this network — remove it or the effect with the largest estimate, then run again.', kind: 'degenerate', mple: mpleOut, hist };
  // final sample at the estimate: standard errors and convergence check
  const Gf = yield* sampleAt(theta, 2 * size, 2 * interval, 'Final check and standard errors', 0.82, 0.95);
  const { mu, C } = nlMeanCov(Gf), Ci = nlInv(C.map(r => Array.from(r)));
  const sd = Array.from(C, (r, k) => Math.sqrt(r[k])), tratio = Array.from(mu, (m, k) => sd[k] ? (m - gobs[k]) / sd[k] : 0);
  // effective sample size (lag-1 autocorrelation) for the MCMC error of the convergence check
  const se = Ci ? Ci.map((r, k) => Math.sqrt(Math.max(0, r[k]))) : theta.map(() => NaN);
  const coefs = Array.from(theta, (b, k) => { const z = b / se[k]; return { term: labels[k], r: nlTermR(terms[k]), b, se: se[k], z, p: isFinite(z) ? nlP2(z) : NaN, or: Math.exp(b), lo: Math.exp(b - 1.96 * se[k]), hi: Math.exp(b + 1.96 * se[k]) }; });
  const worst = tratio.map(Math.abs).indexOf(Math.max(...tratio.map(Math.abs)));
  const essF = Math.min(...Array.from({ length: p }, (_, k) => nlEss(Gf.map(r => r[k])))), converged = conv && Math.max(...tratio.map(Math.abs)) < Math.max(0.2, 2 / Math.sqrt(Math.max(essF, 1)));
  const res = { coefs, terms, labels, gobs: Array.from(gobs), simMean: Array.from(mu), tratio, converged, iterations: Math.min(it, maxIter), interval, samplesize: size, hist, mple: mpleOut, dyadIndependent: dyadIndep, n, directed: net.directed, dyads: D, seconds: (Date.now() - t0) / 1000, theta: Array.from(theta), ess: essF, timedOut };
  const unstable = !converged && res.hist.slice(-6).filter(x => x.tmax > 1).length >= 2;
  if (!converged) res.warning = (timedOut ? 'Stopped after ' + Math.round((Date.now() - t0) / 1000) + ' seconds without converging:' : 'Did not converge after ' + res.iterations + ' rounds:') + ' the simulated networks still differ from yours on “' + labels[worst] + '” (t = ' + tratio[worst].toFixed(2) + '). Try removing “' + labels[worst] + '”, or press “Run longer”.' + (unstable ? ' The simulated networks jump between very different shapes — a sign that this combination of effects is close to degenerate for your network (common with “Friends of friends” in dense networks); adding a characteristic that explains ties (such as party) often stabilises it.' : '');
  if (coefs.some(c => !isFinite(c.se))) res.warning = 'Standard errors could not be computed — the model is close to degenerate. Remove an effect and run again.';
  if (o.gof !== false) res.gof = yield* nlGof(net, terms, theta, { seed: (o.seed || 26) + 1, interval, nsim: o.gofSims || 100 });
  return res;
}
// goodness of fit like statnet gof(): observed vs simulated distributions
export function* nlGof(net, terms, theta, o = {}) {
  const T = nlPrepTerms(net, terms), p = T.length, rnd = nlRng(o.seed || 27), n = net.n, dir = net.directed;
  const ob = nlObsStats(net, terms), S = ob.S, g = Float64Array.from(ob.g), d = new Float64Array(p);
  const nsim = o.nsim || 100, interval = o.interval || 1024;
  const describe = (outL, inL, adj) => {
    const K = Math.min(n - 1, 40);
    const deg = a => { const h = new Float64Array(K + 2); for (let i = 0; i < n; i++) h[Math.min(K + 1, a[i].length)]++; return h; };
    const res = dir ? { idegree: deg(inL), odegree: deg(outL) } : { degree: deg(outL) };
    const esp = new Float64Array(K + 2);
    for (let i = 0; i < n; i++) for (const j of outL[i]) { if (!dir && j < i) continue; let c = 0; if (dir) { for (const k of outL[i]) if (adj[k * n + j]) c++; } else { const A = outL[i].length < outL[j].length ? i : j, B = A === i ? j : i; for (const k of outL[A]) if (k !== B && adj[B * n + k]) c++; } esp[Math.min(K + 1, c)]++; }
    res.espartners = esp;
    const dist = new Float64Array(K + 2); const q = new Int32Array(n), dd = new Int32Array(n);
    for (let s = 0; s < n; s++) { dd.fill(-1); let h = 0, t = 0; dd[s] = 0; q[t++] = s; while (h < t) { const v = q[h++]; for (const w of outL[v]) if (dd[w] < 0) { dd[w] = dd[v] + 1; q[t++] = w; } } for (let v = 0; v < n; v++) if (v !== s && (dir || v > s)) { if (dd[v] < 0) dist[K + 1]++; else dist[Math.min(K, dd[v])]++; } }
    res.distance = dist; return res;
  };
  const obs = describe(S.outL, S.inL, S.adj), sims = [];
  nlSteps(S, T, net, theta, g, 16 * interval, rnd, d);
  for (let s = 0; s < nsim; s++) { nlSteps(S, T, net, theta, g, interval, rnd, d); sims.push(describe(S.outL, S.inL, S.adj)); if (s % 5 === 0) yield { p: 0.95 + 0.05 * s / nsim, msg: 'Checking the fit (simulating ' + nsim + ' networks)' }; }
  const out = {};
  for (const key of Object.keys(obs)) {
    const o1 = obs[key], K = o1.length; let last = 0; for (let k = 0; k < K; k++) { if (o1[k] > 0) last = k; for (const sm of sims) if (sm[key][k] > 0 && k > last) last = k; }
    const rows = [];
    for (let k = 0; k <= Math.min(K - 1, last); k++) { const v = sims.map(sm => sm[key][k]).sort((a, b) => a - b); const lo = v[Math.floor(0.025 * nsim)], hi = v[Math.min(nsim - 1, Math.floor(0.975 * nsim))], med = v[Math.floor(nsim / 2)]; const pl = v.filter(x => x <= o1[k]).length / nsim, ph = v.filter(x => x >= o1[k]).length / nsim; rows.push({ k, label: k === K - 1 ? (key === 'distance' ? '∞' : (k) + '+') : String(k), obs: o1[k], min: v[0], lo, med, hi, max: v[nsim - 1], p: Math.min(1, 2 * Math.min(pl, ph)) }); }
    out[key] = rows;
  }
  out.nsim = nsim; return out;
}
// R code (statnet) for the model
export function nlErgmRCode(spec, net) { const chk = nlErgmCheck(net, spec); const terms = (chk.terms || [{ t: 'edges' }]).map(nlTermR); return 'fit <- ergm(net ~ ' + terms.join(' + ') + ',\n            control = control.ergm(seed = 26))\nsummary(fit)\nmcmc.diagnostics(fit)   # convergence plots\nplot(gof(fit))          # goodness of fit, as in the calculator'; }
