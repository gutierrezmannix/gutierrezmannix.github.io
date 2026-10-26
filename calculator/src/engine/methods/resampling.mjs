// Resampling methods: nonparametric bootstrap (boot::boot + boot.ci perc/BCa, boot::tsboot fixed blocks),
// approximate permutation test (coin::independence_test with approximate()) and multiple imputation
// (mice::mice + glm + mice::pool; see lib/resampling-mice.mjs). Random draws follow R's RNG exactly: the
// bootstrap index arrays, the tsboot block starts and coin's within-block permutations are the same as in R.
import { register } from '../registry.mjs';
import * as D from '../lib/dist.mjs';
import { Factor, isFactor, need, cmpC, rnum } from '../lib/frame.mjs';
import { quantile7 } from '../lib/stats.mjs';
import { svgPlot, histBreaks, histCounts } from '../lib/plot.mjs';
import { FastMT } from '../lib/resampling-rng.mjs';
import { imputeHandler } from '../lib/resampling-mice.mjs';

const SQRT_EPS = Math.sqrt(2.220446049250313e-16);
const isNumVec = v => Array.isArray(v) && v.every(x => typeof x === 'number');

// ---------- statistics with R semantics ----------
const rMean = a => { let s = 0; for (const v of a) s += v; s /= a.length; let t = 0; for (const v of a) t += v - s; return s + t / a.length; };
const rSd = a => { const n = a.length; if (n < 2) return NaN; const m = rMean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return Math.sqrt(s / (n - 1)); };
const rMedian = a => { const v = Float64Array.from(a).sort(), n = v.length; if (!n) return NaN; const h = (n + 1) >> 1; return n % 2 ? v[h - 1] : (v[h - 1] + v[h]) / 2; };
const STATS = { mean: rMean, median: rMedian, sd: rSd };

// Replicate statistics from a column-major draw stream (R fills matrix(sample.int(n, C*R, TRUE), R) by column):
// column j, replicate r gets draw number j*R + r. Each draw (0-based start s) expands to lens[j] consecutive
// indices (s + k) %% n (one index for the ordinary bootstrap). Mean and sd are accumulated on the fly; the median
// replays the stream twice (rank buckets, then only the values in the median's bucket), so nothing of size n*R is
// ever stored.
function replicateStats(fmt, z, R, C, lens, stat) {
  const n = z.length, buf = new Int32Array(R), m = lens ? lens.reduce((a, b) => a + b, 0) : C, t = new Float64Array(R);
  // visit(r, i) for every expanded index, column by column; body(len) runs a tight loop over buf
  const stream = body => { for (let j = 0; j < C; j++) { fmt.fillIndex(n, buf, R); body(lens ? lens[j] : 1); } };
  if (stat === 'mean' || stat === 'sd') {
    const c = rMean(z), S1 = new Float64Array(R), S2 = new Float64Array(R), zc = Float64Array.from(z, v => v - c), sd = stat === 'sd';
    stream(len => {
      if (len === 1) { if (sd) for (let r = 0; r < R; r++) { const v = zc[buf[r]]; S1[r] += v; S2[r] += v * v; } else for (let r = 0; r < R; r++) S1[r] += zc[buf[r]]; }
      else for (let r = 0; r < R; r++) { const s0 = buf[r]; for (let k = 0; k < len; k++) { const v = zc[(s0 + k) % n]; S1[r] += v; S2[r] += v * v; } }
    });
    for (let r = 0; r < R; r++) t[r] = sd ? (m < 2 ? NaN : Math.sqrt(Math.max(0, (S2[r] - S1[r] * S1[r] / m) / (m - 1)))) : c + S1[r] / m;
    return t;
  }
  const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => z[a] - z[b]), sorted = ord.map(i => z[i]), rank = new Int32Array(n);
  ord.forEach((i, k) => { rank[i] = k; });
  const K = Math.min(64, n), bk = new Uint8Array(n); for (let i = 0; i < n; i++) bk[i] = Math.floor(rank[i] * K / n);
  const cnt = new Int32Array(R * K), start = fmt.save();
  stream(len => { for (let r = 0; r < R; r++) { const s0 = buf[r]; if (len === 1) cnt[r * K + bk[s0]]++; else for (let k = 0; k < len; k++) cnt[r * K + bk[(s0 + k) % n]]++; } });
  const h = (m + 1) >> 1, p1 = h - 1, p2 = m % 2 ? h - 1 : h, lo = new Int32Array(R), hi = new Int32Array(R), base = new Int32Array(R), off = new Int32Array(R + 1);
  for (let r = 0; r < R; r++) {
    let cum = 0, b = 0; while (cum + cnt[r * K + b] <= p1) cum += cnt[r * K + b++];
    lo[r] = b; base[r] = cum; let c2 = cum; while (c2 + cnt[r * K + b] <= p2) c2 += cnt[r * K + b++];
    hi[r] = b; let size = 0; for (let q = lo[r]; q <= hi[r]; q++) size += cnt[r * K + q]; off[r + 1] = off[r] + size;
  }
  const end = fmt.save(), store = new Int32Array(off[R]), fill = Int32Array.from(off.subarray(0, R)); fmt.restore(start);
  stream(len => { for (let r = 0; r < R; r++) { const s0 = buf[r], l0 = lo[r], h0 = hi[r]; for (let k = 0; k < len; k++) { const i = len === 1 ? s0 : (s0 + k) % n, b = bk[i]; if (b >= l0 && b <= h0) store[fill[r]++] = rank[i]; } } });
  fmt.restore(end);
  for (let r = 0; r < R; r++) { const s = store.subarray(off[r], off[r + 1]).sort(); const a = sorted[s[p1 - base[r]]], b = sorted[s[p2 - base[r]]]; t[r] = p1 === p2 ? a : (a + b) / 2; }
  return t;
}

// boot:::norm.inter(t, alpha) → interpolated order statistics
function normInter(ctx, t, alpha) {
  const R = t.length, rk = alpha.map(a => (R + 1) * a), ts = Float64Array.from(t).sort();
  if (!rk.every(v => v > 1 && v < R)) ctx.warn('extreme order statistics used as endpoints');
  return rk.map((r, i) => {
    const k = Math.trunc(r); if (k === 0) return ts[0]; if (k === R) return ts[R - 1]; if (k === r) return ts[k - 1];
    const t1 = D.qnorm(alpha[i]), t2 = D.qnorm(k / (R + 1)), t3 = D.qnorm((k + 1) / (R + 1)), tk = ts[k - 1], tk1 = ts[k];
    return tk + (t1 - t2) / (t3 - t2) * (tk1 - tk);
  });
}

// boot:::empinf.reg — regression of t on the bootstrap frequency array (boot.array regenerates the indices from
// the saved seed). Returns null when glm(t ~ X) would have aliased (NA) coefficients.
function empinfReg(seedState, z, R, t) {
  const n = z.length; if (R < n) return null;
  const fmt = FastMT.fromState(seedState), buf = new Int32Array(R);
  const f = n < 65536 ? new Uint16Array(R * n) : new Uint32Array(R * n);
  for (let j = 0; j < n; j++) { fmt.fillIndex(n, buf, R); for (let r = 0; r < R; r++) f[r * n + buf[r]]++; }
  const p = n - 1, A = new Float64Array(p * p), b = new Float64Array(p), mf = new Float64Array(n); let tbar = 0;
  for (let r = 0; r < R; r++) tbar += t[r]; tbar /= R;
  const nzI = new Int32Array(n), nzC = new Float64Array(n);
  for (let r = 0; r < R; r++) {
    let k = 0; const row = r * n, tr = t[r] - tbar;
    for (let i = 1; i < n; i++) { const c = f[row + i]; if (c) { nzI[k] = i - 1; nzC[k++] = c; mf[i] += c; } }
    for (let a = 0; a < k; a++) { const ia = nzI[a] * p, ca = nzC[a]; b[nzI[a]] += ca * tr; for (let c = a; c < k; c++) A[ia + nzI[c]] += ca * nzC[c]; }
  }
  for (let a = 0; a < p; a++) for (let c = a; c < p; c++) { A[a * p + c] -= mf[a + 1] * mf[c + 1] / R; A[c * p + a] = A[a * p + c]; }
  // Cholesky; a pivot that collapses relative to its diagonal means an aliased column (glm's QR, tol 1e-11)
  for (let j = 0; j < p; j++) {
    let s = A[j * p + j]; const d0 = s; for (let k = 0; k < j; k++) s -= A[j * p + k] * A[j * p + k];
    if (!(s > 1e-11 * Math.max(d0, 1e-300))) return null; const L = Math.sqrt(s); A[j * p + j] = L;
    for (let i = j + 1; i < p; i++) { let v = A[i * p + j]; for (let k = 0; k < j; k++) v -= A[i * p + k] * A[j * p + k]; A[i * p + j] = v / L; }
  }
  const y = new Float64Array(p); for (let i = 0; i < p; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= A[i * p + k] * y[k]; y[i] = s / A[i * p + i]; }
  for (let i = p - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < p; k++) s -= A[k * p + i] * y[k]; y[i] = s / A[i * p + i]; }
  const l = [0, ...Array.from(y, v => v * n)], ml = l.reduce((a, c) => a + c, 0) / n;
  return l.map(v => v - ml);
}
// boot:::usual.jack influence values (used only when the regression estimate would be too costly; see NOTES)
function jackInfluence(z, stat) {
  const n = z.length, tj = new Array(n);
  if (stat === 'mean') { const S = z.reduce((a, b) => a + b, 0); for (let i = 0; i < n; i++) tj[i] = (S - z[i]) / (n - 1); }
  else if (stat === 'sd') { const m = rMean(z); let SS = 0; for (const v of z) SS += (v - m) ** 2; for (let i = 0; i < n; i++) tj[i] = Math.sqrt(Math.max(0, SS - (z[i] - m) ** 2 * n / (n - 1)) / (n - 2)); }
  else { const ord = z.map((v, i) => i).sort((a, b) => z[a] - z[b]), v = ord.map(i => z[i]), m = n - 1, h = (m + 1) >> 1, at = (k, q) => v[q < k ? q : q + 1]; ord.forEach((i, k) => { tj[i] = m % 2 ? at(k, h - 1) : (at(k, h - 1) + at(k, h)) / 2; }); }
  const mj = tj.reduce((a, b) => a + b, 0) / n; return tj.map(v => (n - 1) * (mj - v));
}

// print.bootci for type = c('perc', 'bca')
function bootciText(R, t0, level, perc, bca) {
  let digs = Math.ceil(Math.log10(Math.abs(t0))); digs = !(digs > 0) ? 4 : digs >= 4 ? 0 : 4 - digs;
  const f = v => Number.isFinite(v) ? (Math.round(v * 10 ** digs) / 10 ** digs).toFixed(digs) : 'NA';
  const cells = [...perc, ...bca].map(f), w = Math.max(...cells.map(s => s.length)), c = cells.map(s => s.padStart(w));
  return ['BOOTSTRAP CONFIDENCE INTERVAL CALCULATIONS', 'Based on ' + R + ' bootstrap replicates', '', 'CALL : ', 'boot::boot.ci(boot.out = bt, conf = level, type = c("perc", "bca"))', '', 'Intervals : ',
    'Level     Percentile            BCa          ', rnum(100 * level) + '%   (' + c[0] + ', ' + c[1] + ' )   (' + c[2] + ', ' + c[3] + ' )  ', 'Calculations and Intervals on Original Scale'];
}

// R's order() for a numeric, factor or character vector (stable)
function rOrder(v) {
  const idx = Array.from({ length: v.length }, (_, i) => i);
  if (isFactor(v)) return idx.sort((a, b) => v.codes[a] - v.codes[b] || a - b);
  if (isNumVec(v)) return idx.sort((a, b) => v[a] - v[b] || a - b);
  return idx.sort((a, b) => cmpC(v[a], v[b]) || a - b);
}

register('bootstrap', ctx => {
  const { num, opt } = ctx; ctx.clean();
  let z = ctx.value('y'); need(isNumVec(z), 'Choose a numeric outcome.');
  const B = num('repetitions', 999, { min: 99, max: 50000, integer: true }); ctx.rng.setSeed(num('seed', 1729, { integer: true }));
  const statName = opt('statistic', 'mean'), stat = Object.prototype.hasOwnProperty.call(STATS, statName) ? STATS[statName] : null;
  need(!!stat, 'Choose mean, median or sd.');
  const scheme = opt('resample', 'iid'), fmt = new FastMT(ctx.rng); let t, t0, ci = null;
  if (scheme === 'block') {
    need(ctx.time.length === 1, 'Block bootstrap requires a time variable.');
    const oo = rOrder(ctx.value('time')); z = oo.map(i => z[i]);
    const n = z.length, L = num('blockLength', 4, { min: 1, max: n - 1, integer: true });
    t0 = stat(z); const nn = Math.ceil(n / L), lens = Array.from({ length: nn }, (_, j) => j < nn - 1 ? L : 1 + (n - 1) % L);
    t = replicateStats(fmt, z, B, nn, lens, statName);
    need(t.every(v => !Number.isNaN(v)), "missing values and NaN's not allowed if 'na.rm' is FALSE");
    ci = quantile7(Array.from(t), [ctx.alpha / 2, 1 - ctx.alpha / 2]);
    ctx.note('Moving-block bootstrap assumes an approximately stationary series and a defensible block length.');
  } else {
    const n = z.length, seedState = fmt.save(); t0 = stat(z);
    t = replicateStats(fmt, z, B, n, null, statName);
    // boot.ci(bt, conf = level, type = c('perc', 'bca')): constant replicates → NULL (no interval)
    let s = 0, k = 0; for (const v of t) if (!Number.isNaN(v)) { s += v; k++; } const mt = s / k, eps = Math.min(1e-8, mt / 1e6);
    let isConst = true, unknown = false; for (const v of t) { if (Number.isNaN(v) || Number.isNaN(eps)) unknown = true; else if (!(Math.abs(v - mt) < eps)) { isConst = false; break; } }
    need(!(isConst && unknown), 'missing value where TRUE/FALSE needed');
    // boot.ci returns NULL; data.frame(..., Lower = NULL[1], ...) then fails in R
    need(!isConst, 'arguments imply differing number of rows: 1, 0');
    {
      const tf = Array.from(t).filter(Number.isFinite), level = ctx.level, alpha = [(1 - level) / 2, (1 + level) / 2];
      const perc = normInter(ctx, tf, alpha);
      let below = 0; for (const v of tf) if (v < t0) below++;
      const w = D.qnorm(below / tf.length); need(Number.isFinite(w), "estimated adjustment 'w' is infinite");
      const exact = B * n <= 1.5e7 && 0.2 * n * n * B <= 1e9;
      const Lv = exact ? empinfReg(seedState, z, B, Array.from(t)) : B < n ? null : jackInfluence(z, statName);
      let a = NaN; if (Lv) { let s2 = 0, s3 = 0; for (const v of Lv) { s2 += v * v; s3 += v * v * v; } a = s3 / (6 * Math.pow(s2, 1.5)); }
      need(Number.isFinite(a), "estimated adjustment 'a' is NA");
      const adj = alpha.map(al => { const za = D.qnorm(al); return D.pnorm(w + (w + za) / (1 - a * (w + za))); });
      ctx.diag(bootciText(tf.length, t0, level, perc, normInter(ctx, tf, adj))); ci = perc;
    }
  }
  const tt = Array.from(t), mt = rMean(tt), sdt = rSd(tt);
  const cols = ['Estimate', 'Bootstrap.SE', 'Bias'], row = [t0, sdt, mt - t0];
  cols.push('Lower', 'Upper', 'Replicates'); row.push(ci[0], ci[1], B);
  ctx.table('Bootstrap estimate', cols, [row]);
  let svg; try { const v = tt.filter(Number.isFinite), br = histBreaks(v), c = histCounts(v, br); svg = svgPlot({ xlab: 'Resampled statistic', ylab: 'Frequency', layers: [{ type: 'rect', x0: br.slice(0, -1), x1: br.slice(1), y0: c.map(() => 0), y1: c, fill: '#D6E8DD', stroke: '#194F39' }] }); }
  catch (e) { svg = svgPlot({ layers: [{ type: 'text', x: [0.5], y: [0.5], labels: [e.message] }], xlim: [0, 1], ylim: [0, 1] }); }
  ctx.plot('Bootstrap distribution', svg);
});

// ---------- coin::independence_test(y ~ g | s, distribution = approximate(nresample)) ----------
// Linear statistic T = Σ x_i h(y_i) with x = indicator of the first group; conditional expectation and variance
// summed over blocks (Strasser & Weber); Monte-Carlo null by libcoin's C_PermuteBlock (j = n * unif_rand()).
export function coinIndependence(rng, yv, g, block, nresample) {
  const N = g.codes.length, x = g.codes.map(c => c === 0 ? 1 : 0), isCat = isFactor(yv);
  const Q = isCat ? (yv.nlevels === 2 ? 1 : yv.nlevels) : 1, Y = isCat ? Array.from({ length: Q }, (_, q) => yv.codes.map(c => c === q ? 1 : 0)) : [yv.slice()];
  const bc = block ? block.codes : new Array(N).fill(0), nb = block ? block.nlevels : 1;
  const T = new Float64Array(Q), mu = new Float64Array(Q), V = new Float64Array(Q);
  for (let i = 0; i < N; i++) if (x[i]) for (let q = 0; q < Q; q++) T[q] += Y[q][i];
  for (let b = 0; b < nb; b++) {
    const idx = []; for (let i = 0; i < N; i++) if (bc[i] === b) idx.push(i); const nbk = idx.length; if (!nbk) continue;
    let m = 0; for (const i of idx) m += x[i];
    for (let q = 0; q < Q; q++) { let s = 0; for (const i of idx) s += Y[q][i]; const e = s / nbk; let c = 0; for (const i of idx) c += (Y[q][i] - e) ** 2; c /= nbk; mu[q] += m * e; V[q] += nbk / (nbk - 1) * c * m - 1 / (nbk - 1) * c * m * m; }
  }
  const sd = Array.from(V, Math.sqrt), zs = Array.from(T, (v, q) => (v - mu[q]) / sd[q]);
  const statistic = Q === 1 ? zs[0] : zs.reduce((a, v) => Number.isNaN(a) || Number.isNaN(v) ? NaN : Math.max(a, Math.abs(v)), 0);
  const qobs = Q === 1 ? Math.abs(zs[0]) : statistic, warn = Array.from(V).some(v => !(v > SQRT_EPS));
  if (Number.isNaN(qobs)) return { statistic, p: NaN, warn };
  // block-ordered subset (RC_order_subset_wrt_block) and within-block permutations (C_doPermuteBlock)
  const counts = new Array(nb).fill(0); for (const c of bc) counts[c]++;
  const startAt = [0]; for (let b = 0; b < nb; b++) startAt.push(startAt[b] + counts[b]);
  const fillPos = startAt.slice(0, nb), subset = new Int32Array(N); for (let i = 0; i < N; i++) subset[fillPos[bc[i]]++] = i;
  const xs = Uint8Array.from(subset, i => x[i]), tmp = new Int32Array(N), fmt = new FastMT(rng);
  const codes = isCat ? Int32Array.from(yv.codes) : null, yy = isCat ? null : Float64Array.from(Y[0]), Ts = new Float64Array(Q), u = new Float64Array(N); let hits = 0;
  for (let r = 0; r < nresample; r++) {
    tmp.set(subset); Ts.fill(0); fmt.fillUnif(u, N);
    for (let b = 0; b < nb; b++) {
      const s0 = startAt[b], len = counts[b]; let n = len;
      if (isCat) for (let i = 0; i < len; i++) { const j = s0 + Math.floor(n * u[s0 + i]), p = tmp[j]; tmp[j] = tmp[s0 + --n]; if (xs[s0 + i]) { const c = codes[p]; if (c < Q) Ts[c] += 1; } }
      else { let acc = 0; for (let i = 0; i < len; i++) { const j = s0 + Math.floor(n * u[s0 + i]), p = tmp[j]; tmp[j] = tmp[s0 + --n]; if (xs[s0 + i]) acc += yy[p]; } Ts[0] += acc; }
    }
    let mx = -Infinity, nan = false; for (let q = 0; q < Q; q++) { const v = Math.abs((Ts[q] - mu[q]) / sd[q]); if (Number.isNaN(v)) nan = true; else if (v > mx) mx = v; }
    if (!nan && qobs - mx <= SQRT_EPS) hits++;
  }
  fmt.writeBack(rng);
  return { statistic, p: hits / nresample, warn };
}

register('permutation', ctx => {
  const { num } = ctx; ctx.clean();
  const yy = ctx.value('y'), gg = ctx.group(ctx.value('group'), 2);
  let s = null; if (ctx.fields('strata').length) { const sv = ctx.value('strata'); s = isFactor(sv) ? new Factor(sv.values()) : new Factor(sv); }
  ctx.rng.setSeed(num('seed', 1729, { min: 0, integer: true }));
  // as.character(1e5) is "1e+05" in R's message (ctx.num prints 100000)
  let B; try { B = num('repetitions', 9999, { min: 99, max: 100000, integer: true }); } catch (e) { e.message = e.message.replace('at most 100000.', 'at most 1e+05.'); throw e; }
  if (s) need(s.counts().every(c => c >= 2), '\u2018block\u2019 contains levels with less than two observations');
  const h = coinIndependence(ctx.rng, isFactor(yy) ? yy.droplevels() : yy, gg, s, B);
  if (h.warn) ctx.warn('The conditional covariance matrix has zero diagonal elements');
  need(!Number.isNaN(h.p), 'missing value where TRUE/FALSE needed');
  ctx.table('Results', ['Statistic', 'P'], [[h.statistic, h.p]]);
  ctx.note('Permutation inference requires exchangeability within the specified design/strata.');
});

register('impute', imputeHandler);
