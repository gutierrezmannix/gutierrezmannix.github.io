// Predictive family: k-means and hierarchical clustering, penalized regression (ridge / lasso / elastic net
// via cv.glmnet) and decision trees (rpart) with a random train/holdout split — ports of the corresponding
// blocks in src/analysis-methods.R. Random draws (k-means starts, holdout split, CV folds) come from R's RNG.
import { register } from '../registry.mjs';
import { need, isFactor, modelMatrix } from '../lib/frame.mjs';
import { svgPlot } from '../lib/plot.mjs';
import { kmeans, scaleCols, distEuclid, hclust, hclustMethod, cutree } from '../lib/predictive-cluster.mjs';
import { cvGlmnet, coefAt, linkPredict } from '../lib/predictive-glmnet.mjs';
import { rpart } from '../lib/predictive-rpart.mjs';

const label = (ctx, k) => (ctx.packet.data && ctx.packet.data[k] && ctx.packet.data[k].name) || k;

// ---------- clustering ----------
register(['kmeans', 'hierarchical'], ctx => {
  const { id, opt, num } = ctx; ctx.clean();
  const vars = ctx.variables.filter(v => ctx.d.has(v)), n = ctx.d.n;
  const numeric = vars.length > 0 && vars.every(v => ctx.d.isNumeric(v) && ctx.d.get(v).every(x => typeof x === 'number'));
  need(numeric && n > 1 && vars.every(v => { const c = ctx.d.get(v); return c.some(x => x !== c[0]); }), 'Choose nonconstant numeric variables.');
  let z = Array.from({ length: n }, (_, i) => vars.map(v => ctx.d.get(v)[i]));
  if (opt('standardize', true) === true) z = scaleCols(z);
  const k = num('clusters', 3, { min: 2, max: n - 1, integer: true });
  ctx.rng.setSeed(num('seed', 1729, { integer: true }));
  let cl;
  if (id === 'kmeans') {
    const m = kmeans(z, k, 25, ctx.rng, w => ctx.warn(w)); cl = m.cluster;
    ctx.table('Cluster centers', ['Term', ...vars], m.centers.map((r, i) => [String(i + 1), ...r]));
    ctx.table('Clustering summary', ['Total.SS', 'Within.SS', 'Between.SS'], [[m.totss, m.totWithinss, m.betweenss]]);
  } else {
    need(n <= 3000, 'Hierarchical clustering is limited to 3,000 rows to control browser memory.');
    const method = String(opt('linkage', 'ward.D2')), iOpt = hclustMethod(method);
    need(iOpt > 0, 'invalid clustering method ' + method);
    const h = hclust(distEuclid(z), n, iOpt); cl = cutree(h.merge, k);
    ctx.plot('Dendrogram', dendrogram(h, n));
  }
  ctx.table('Cluster membership', ['Analysis.row', 'Cluster'], cl.map((c, i) => [i + 1, c]));
  ctx.note('Clusters are exploratory and depend on scaling, distance and the chosen number of groups.');
});
function dendrogram(h, n) {
  const pos = new Array(n + 1); h.order.forEach((o, i) => { pos[o] = i + 1; });
  const nx = [], ny = [], seg = { x0: [], x1: [], y0: [], y1: [] }, at = m => m < 0 ? [pos[-m], 0] : [nx[m - 1], ny[m - 1]];
  const add = (a, b, c, d) => { seg.x0.push(a); seg.x1.push(b); seg.y0.push(c); seg.y1.push(d); };
  h.merge.forEach(([a, b], i) => { const [xa, ya] = at(a), [xb, yb] = at(b), y = h.height[i]; add(xa, xa, ya, y); add(xb, xb, yb, y); add(xa, xb, y, y); nx.push((xa + xb) / 2); ny.push(y); });
  return svgPlot({ xlab: '', ylab: 'Height', layers: [{ type: 'segments', ...seg, color: '#20362F', width: 0.8 }], xlim: [0.5, n + 0.5] });
}

// ---------- penalized regression and trees with a train/holdout split ----------
register(['ridge', 'lasso', 'elastic', 'tree'], ctx => {
  const { id, opt, num } = ctx; ctx.clean();
  ctx.rng.setSeed(num('seed', 1729, { integer: true }));
  const d = ctx.d, n = d.n; need(n >= 30, 'Use at least 30 complete observations for train/holdout evaluation.');
  const fam = opt('family', 'gaussian'), ycol = d.get(ctx.y[0]), yv = isFactor(ycol) ? ycol.values() : ycol;
  if (fam === 'binomial') need(yv.every(v => v === 0 || v === 1 || v === '0' || v === '1'), 'Binary outcomes must be coded 0/1.');
  const yy = yv.map(Number);
  const tr = ctx.rng.sampleInt(n, Math.floor(n * num('trainFraction', 0.8, { min: 0.5, max: 0.9 }))).sort((a, b) => a - b).map(i => i - 1);
  const inTr = new Set(tr), ho = Array.from({ length: n }, (_, i) => i).filter(i => !inTr.has(i));
  const xs = ctx.rhs();
  let pp;
  if (id === 'tree') {
    const xval = num('folds', 5, { min: 2, max: 10, integer: true }), cp = num('complexity', 0.01, { min: 0 });
    const cols = xs.map(v => { const c = d.get(v); return isFactor(c) ? c.codes.map(k => k + 1) : Array.from(c); }), ncat = xs.map(v => isFactor(d.get(v)) ? d.get(v).levels.length : 0);
    const rep = tr.map((_, i) => (i % xval) + 1), xgroups = ctx.rng.sampleInt(tr.length, tr.length).map(i => rep[i - 1]);
    const lv = fam === 'binomial' ? [...new Set(tr.map(i => yy[i]))].sort((a, b) => a - b) : null;
    const m = rpart({ X: cols.map(c => tr.map(i => c[i])), ncat, y: tr.map(i => lv ? lv.indexOf(yy[i]) + 1 : yy[i]), method: lv ? 'class' : 'anova', cp, xval, xgroups });
    const one = lv ? lv.indexOf(1) : -1;
    if (lv) need(one >= 0, 'subscript out of bounds');
    pp = ho.map(i => { const t = m.predictNode(cols.map(c => c[i])); return lv ? m.yprob(t)[one] : t.est[0]; });
    ctx.table('Tree complexity / internal cross-validation', m.columns, m.cptable);
    ctx.plot('Decision tree', treePlot(ctx, m, xs, d, lv));
    ctx.diag(treePrint(m, xs, d, lv, tr.length));
  } else {
    const mm = modelMatrix(d, xs.map(v => ({ vars: [v] }))), X = mm.X.map(r => r.slice(1)), names = mm.names.slice(1);
    const nfolds = num('folds', 5, { min: 3, max: 10, integer: true });
    const alpha = num('penalty', id === 'ridge' ? 0 : id === 'lasso' ? 1 : 0.5, { min: 0, max: 1 });
    const m = cvGlmnet(tr.map(i => X[i]), tr.map(i => yy[i]), { family: fam === 'binomial' ? 'binomial' : 'gaussian', alpha, nfolds, rng: ctx.rng, warn: w => ctx.warn(w) });
    const cf = coefAt(m.fit, m.lambda1se), eta = linkPredict(cf, ho.map(i => X[i]));
    pp = fam === 'binomial' ? eta.map(e => 1 / (1 + Math.exp(-e))) : eta;
    ctx.table('Penalized coefficients at lambda.1se', ['Term', 's1'], ['(Intercept)', ...names].map((t, j) => [t, cf[j]]));
    ctx.plot('Training cross-validation', cvPlot(m));
    ctx.note('Penalty selected only within the training partition using the one-standard-error rule.');
    ctx.table('Penalty selection', ['Lambda.min', 'Lambda.1se'], [[m.lambdaMin, m.lambda1se]]);
  }
  const obs = ho.map(i => yy[i]), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sq = obs.map((v, i) => (v - pp[i]) ** 2);
  ctx.table('Holdout evaluation', ['Training', 'Holdout', 'RMSE', 'MAE', 'Brier'], [[tr.length, obs.length, Math.sqrt(mean(sq)), mean(obs.map((v, i) => Math.abs(v - pp[i]))), fam === 'binomial' ? mean(sq) : null]]);
  ctx.table('Holdout predictions', ['Source.row', 'Observed', 'Prediction'], ho.map((i, k) => [i + 1, obs[k], pp[k]]));
  ctx.note('A random holdout is appropriate for independent observations. Temporal or clustered designs require design-aware splitting.');
});

function cvPlot(m) {
  const lx = m.lambda.map(Math.log), up = m.cvm.map((v, i) => v + m.cvsd[i]), lo = m.cvm.map((v, i) => v - m.cvsd[i]);
  return svgPlot({ xlab: 'Log(λ)', ylab: m.name, layers: [
    { type: 'segments', x0: lx, x1: lx, y0: lo, y1: up, color: '#A9A9A9', width: 1 },
    { type: 'points', x: lx, y: m.cvm, color: '#C0392B', size: 2.5 },
    { type: 'vline', x: [Math.log(m.lambdaMin), Math.log(m.lambda1se)], dash: '2 3', color: '#20362F', width: 1 }] });
}
// tree drawing: leaves spread evenly, internal nodes centred over their children, depth on the y axis
const splitText = (s, xs, d, ncat, left, name) => {
  const v = xs[s.varNum];
  if (!ncat[s.varNum]) { const lt = (s.csplit[0] === -1) === left; return name(v) + (lt ? ' < ' : ' >= ') + Number(s.spoint.toPrecision(4)); }
  const want = left ? -1 : 1, lv = d.get(v).levels; return name(v) + ' = ' + lv.filter((_, i) => s.csplit[i] === want).join(',');
};
function walk(m, f) { const rec = (t, num, depth) => { f(t, num, depth); if (!m.isLeaf(t)) { rec(t.leftson, 2 * num, depth + 1); rec(t.rightson, 2 * num + 1, depth + 1); } }; rec(m.tree, 1, 0); }
const nodeLabel = (m, t, lv) => lv ? String(lv[t.est[0] - 1]) + '\n' + t.est.slice(1, 1 + m.nclass).join('/') : String(Number(t.est[0].toPrecision(4))) + '\nn=' + t.numObs;
function treePlot(ctx, m, xs, d, lv) {
  const ncat = xs.map(v => isFactor(d.get(v)) ? 1 : 0), name = v => label(ctx, v), P = new Map(); let leaf = 0, maxDepth = 0;
  const place = (t, depth) => { maxDepth = Math.max(maxDepth, depth); if (m.isLeaf(t)) { const p = { x: ++leaf, y: -depth }; P.set(t, p); return p; } const a = place(t.leftson, depth + 1), b = place(t.rightson, depth + 1), p = { x: (a.x + b.x) / 2, y: -depth }; P.set(t, p); return p; };
  place(m.tree, 0);
  const seg = { x0: [], x1: [], y0: [], y1: [] }, tx = [], ty = [], tl = [];
  walk(m, t => {
    const p = P.get(t);
    if (m.isLeaf(t)) { tx.push(p.x); ty.push(p.y - 0.25); tl.push(nodeLabel(m, t, lv).replace('\n', ' · ')); return; }
    for (const c of [t.leftson, t.rightson]) { const q = P.get(c); seg.x0.push(p.x, q.x); seg.x1.push(q.x, q.x); seg.y0.push(p.y, p.y); seg.y1.push(p.y, q.y); }
    tx.push(p.x); ty.push(p.y + 0.12); tl.push(splitText(t.primary[0], xs, d, ncat, true, name));
  });
  return svgPlot({ xlab: '', ylab: '', xlim: [0.4, leaf + 0.6], ylim: [-maxDepth - 0.5, 0.4], layers: [{ type: 'segments', ...seg, color: '#20362F', width: 1 }, { type: 'text', x: tx, y: ty, labels: tl, size: 10 }] });
}
// print.rpart-style listing for Diagnostics
function treePrint(m, xs, d, lv, nobs) {
  const ncat = xs.map(v => isFactor(d.get(v)) ? 1 : 0), f = v => String(Number(v.toPrecision(7))), out = ['n= ' + nobs, '', lv ? 'node), split, n, loss, yval, (yprob)' : 'node), split, n, deviance, yval', '      * denotes terminal node', ''];
  const rec = (t, num, depth, txt) => {
    const yval = lv ? String(lv[t.est[0] - 1]) + ' (' + m.yprob(t).map(f).join(' ') + ')' : f(t.est[0]);
    out.push(' '.repeat(2 * depth) + num + ') ' + txt + ' ' + t.numObs + ' ' + f(t.risk) + ' ' + yval + (m.isLeaf(t) ? ' *' : ''));
    if (!m.isLeaf(t)) { const s = t.primary[0]; rec(t.leftson, 2 * num, depth + 1, splitText(s, xs, d, ncat, true, v => v)); rec(t.rightson, 2 * num + 1, depth + 1, splitText(s, xs, d, ncat, false, v => v)); }
  };
  rec(m.tree, 1, 0, 'root'); return out;
}
