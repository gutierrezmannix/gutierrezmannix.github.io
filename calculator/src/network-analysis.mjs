// Binary network preparation and analyses. Bundled with the existing engine (glm).
export function ergmFit(net, terms) {
  const n = net.n, dir = net.directed;
  const D = dir ? n * (n - 1) : n * (n - 1) / 2;
  if (n < 2) return { error: 'the network needs at least 2 nodes' };
  if (D > 700000) return { error: 'this network is too large for the browser (' + n + ' nodes). Use up to about ' + (dir ? 830 : 1180) + ' nodes.' };
  const adj = net.out, inn = net.inn, und = net.und;
  const I = new Int32Array(D), J = new Int32Array(D), y = new Float64Array(D);
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = dir ? 0 : i + 1; j < n; j++) { if (i === j) continue; I[k] = i; J[k] = j; y[k] = (dir ? adj[i].has(j) : und[i].has(j)) ? 1 : 0; k++; }
  for (const t of terms) {
    if (t.t === 'mutual' && !dir) return { error: 'Reciprocity requires a directed network.' };
    if (!['mutual','triangle','nodematch','nodecov','absdiff'].includes(t.t)) return { error: 'Unsupported network term: ' + t.t };
    if (t.a) {
      const at = net.attrs[t.a], numeric = t.t !== 'nodematch';
      if (!at || (numeric && !at.num)) return { error: 'Select a numeric attribute for ' + t.t + ': ' + t.a };
      if ((numeric ? Array.from(at.x).some(v => !Number.isFinite(v)) : at.v.some(v => v == null || v === ''))) return { error: 'Missing values in selected attribute "' + t.a + '". Complete the nodes data or remove that effect; no values are imputed.' };
    }
  }
  const preds = [];
  for (const t of terms) {
    const a = new Float64Array(D);
    if (t.t === 'mutual') { for (let d = 0; d < D; d++) a[d] = adj[J[d]].has(I[d]) ? 1 : 0; preds.push({ name: 'mutual', kind: 'num', a }); }
    else if (t.t === 'triangle') { for (let d = 0; d < D; d++) { const A = und[I[d]], B = und[J[d]]; const [s, l] = A.size < B.size ? [A, B] : [B, A]; let c = 0; for (const v of s) if (v !== I[d] && v !== J[d] && l.has(v)) c += dir ? (Number(adj[I[d]].has(v)) + Number(adj[v].has(I[d]))) * (Number(adj[J[d]].has(v)) + Number(adj[v].has(J[d]))) : 1; a[d] = c; } preds.push({ name: 'shared partners (triangles)', kind: 'num', a }); }
    else if (t.t === 'nodematch') { const at = net.attrs[t.a]; for (let d = 0; d < D; d++) { const u = at.v[I[d]], w = at.v[J[d]]; a[d] = (u != null && u !== '' && u === w) ? 1 : 0; } preds.push({ name: 'same ' + t.a + ' (homophily)', kind: 'num', a }); }
    else if (t.t === 'nodecov') { const at = net.attrs[t.a]; for (let d = 0; d < D; d++) a[d] = at.x[I[d]] + at.x[J[d]]; preds.push({ name: t.a + ' (sociality)', kind: 'num', a }); }
    else if (t.t === 'absdiff') { const at = net.attrs[t.a]; for (let d = 0; d < D; d++) a[d] = Math.abs(at.x[I[d]] - at.x[J[d]]); preds.push({ name: 'difference in ' + t.a, kind: 'num', a }); }
  }
  { let e1 = 0; for (let d = 0; d < D; d++) e1 += y[d]; if (e1 === 0 || e1 === D) return { error: e1 === 0 ? 'the network has no ties between the listed nodes — check the FROM and TO columns.' : 'every possible tie is present — nothing to model.' }; }
  const fit = glm(y, preds, null, 'logistic');
  if (fit.error) return fit;
  if (!fit.converged || fit.coefs.some(c => !Number.isFinite(c.b) || !Number.isFinite(c.se))) return { error: 'MPLE did not converge to a finite stable solution. Check separation or remove redundant effects. Network descriptives remain available.' };
  fit.coefs[0].term = 'edges';
  return Object.assign(fit, netSummary(net), { dyadDep: terms.some(t => t.t === 'mutual' || t.t === 'triangle') });
}

export function netCentrality(net) {
  const n = net.n, dir = net.directed, out = dir ? net.out : net.und, inn = dir ? net.inn : net.und, und = net.und;
  const neighbors = Array.from({ length: n }, (_, i) => und[i].size), deg = Array.from({ length: n }, (_, i) => dir ? inn[i].size + out[i].size : und[i].size), indeg = Array.from({ length: n }, (_, i) => inn[i].size), outdeg = Array.from({ length: n }, (_, i) => out[i].size);
  const btw = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    const S = [], P = Array.from({ length: n }, () => []), sig = new Float64Array(n), d = new Int32Array(n).fill(-1); sig[s] = 1; d[s] = 0; const q = [s];
    for (let h = 0; h < q.length; h++) { const v = q[h]; S.push(v); for (const w of out[v]) { if (d[w] < 0) { d[w] = d[v] + 1; q.push(w); } if (d[w] === d[v] + 1) { sig[w] += sig[v]; P[w].push(v); } } }
    const dl = new Float64Array(n); while (S.length) { const w = S.pop(); for (const v of P[w]) dl[v] += sig[v] / sig[w] * (1 + dl[w]); if (w !== s) btw[w] += dl[w]; }
  }
  if (!dir) for (let i = 0; i < n; i++) btw[i] /= 2;
  const clo = new Float64Array(n), harmonic = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    const d = new Int32Array(n).fill(-1); d[s] = 0; const q = [s]; let sum = 0, inv = 0;
    for (let h = 0; h < q.length; h++) for (const w of out[q[h]]) if (d[w] < 0) { d[w] = d[q[h]] + 1; sum += d[w]; inv += 1 / d[w]; q.push(w); }
    clo[s] = n > 1 && q.length === n ? (n - 1) / sum : 0;
    harmonic[s] = n > 1 ? inv / (n - 1) : 0;
  }
  // Right Perron eigenvector of A (outgoing ties), matching sna::evcent.
  // Adding I preserves eigenvectors and removes bipartite sign oscillation.
  let ev = new Float64Array(n).fill(1), evOK = false;
  if (out.some(s => s.size)) for (let it = 0; it < 4000; it++) {
    const nx = new Float64Array(n); let scale = 0;
    for (let i = 0; i < n; i++) { nx[i] = ev[i]; for (const j of out[i]) nx[i] += ev[j]; scale = Math.max(scale, nx[i]); }
    let diff = 0; for (let i = 0; i < n; i++) { nx[i] /= scale; diff = Math.max(diff, Math.abs(nx[i] - ev[i])); }
    ev = nx;
    if (diff < 1e-12) { evOK = true; break; }
  }
  if (!evOK) ev.fill(NaN);
  let pr = new Float64Array(n).fill(1 / n); const dmp = 0.85;
  for (let it = 0; it < 100; it++) { const nx = new Float64Array(n).fill((1 - dmp) / n); let dang = 0; for (let i = 0; i < n; i++) { if (!out[i].size) dang += pr[i]; else for (const j of out[i]) nx[j] += dmp * pr[i] / out[i].size; } for (let i = 0; i < n; i++) nx[i] += dmp * dang / n; pr = nx; }
  return { neighbors, harmonic: Array.from(harmonic), eigenvectorConverged: evOK, degree: deg, indegree: indeg, outdegree: outdeg, betweenness: Array.from(btw), closeness: Array.from(clo), eigenvector: Array.from(ev), pagerank: Array.from(pr) };
}

export function netKey(value) {
  return value == null || (typeof value === 'number' && !Number.isFinite(value)) ? '' : String(value).trim();
}
export function netPrepare(er, nr, options) {
  if (!er) return { error: 'Load an edges file first.' };
  const fi = er.names.indexOf(options.from), ti = er.names.indexOf(options.to);
  if (fi < 0 || ti < 0 || fi === ti) return { error: 'Pick two different columns for FROM and TO.' };
  const directed = options.directed !== false, ids = [], rows = [], index = new Map();
  const add = (id, row) => { index.set(id, ids.length); ids.push(id); rows.push(row); };
  const idc = nr ? nr.names.indexOf(options.id) : -1;
  if (nr) {
    if (idc < 0) return { error: 'Select the node ID column.' };
    for (let r = 0; r < nr.n; r++) {
      const id = netKey(nr.cols[idc].a[r]);
      if (!id) return { error: 'Blank node ID at row ' + (r + 1) + '. Every node needs a unique ID.' };
      if (index.has(id)) return { error: 'Duplicate node ID "' + id + '". Resolve duplicate nodes before running.' };
      add(id, r);
    }
    if (!ids.length) return { error: 'The nodes file has no valid nodes.' };
  }
  const info = { miss: 0, loops: 0, unknown: 0, dups: 0 }, pairs = [];
  for (let r = 0; r < er.n; r++) {
    const a = netKey(er.cols[fi].a[r]), b = netKey(er.cols[ti].a[r]);
    if (!a || !b) { info.miss++; continue; }
    if (!nr) for (const id of [a,b]) if (!index.has(id)) add(id, -1);
    if (a === b) { info.loops++; continue; }
    if (!index.has(a) || !index.has(b)) { info.unknown++; continue; }
    pairs.push([index.get(a),index.get(b)]);
  }
  const n = ids.length;
  if (!n) return { error: 'No valid nodes found. Check the selected ID columns.' };
  const out = Array.from({length:n},()=>new Set()), inn = out.map(()=>new Set()), und = out.map(()=>new Set());
  for (const [a,b] of pairs) {
    if ((directed ? out[a] : und[a]).has(b)) { info.dups++; continue; }
    out[a].add(b); inn[b].add(a); und[a].add(b); und[b].add(a);
    if (!directed) { out[b].add(a); inn[a].add(b); }
  }
  const attrs = {};
  if (nr) nr.names.forEach((name,ci) => {
    if (ci === idc) return;
    const col = nr.cols[ci], num = col.k === 'n';
    attrs[name] = { num, v: rows.map(r=>netKey(col.a[r])), x: Float64Array.from(rows,r=>num && Number.isFinite(col.a[r]) ? col.a[r] : NaN) };
  });
  return { net: { n, ids, directed, out, inn, und, attrs }, info };
}
export function netSummary(net) {
  const { n, directed: dir, out, und } = net;
  let edges = 0, mutualPairs = 0, triangles = 0, triples = 0;
  for (let i = 0; i < n; i++) {
    edges += dir ? out[i].size : und[i].size / 2;
    if (dir) for (const j of out[i]) if (j > i && out[j].has(i)) mutualPairs++;
    const nb = [...und[i]]; triples += nb.length * (nb.length - 1) / 2;
    for (let j = 0; j < nb.length; j++) for (let k = j + 1; k < nb.length; k++) if (und[nb[j]].has(nb[k])) triangles++;
  }
  const dyads = dir ? n * (n - 1) : n * (n - 1) / 2;
  return { nodes:n, edges, dyads, directed:dir, density:dyads ? edges/dyads : NaN, meanDeg:n ? 2*edges/n : NaN, reciprocity:dir && edges ? 2*mutualPairs/edges : NaN, transitivity:triples ? triangles/triples : NaN };
}
export function netRScript(net, terms) {
  // Snapshot the prepared graph, including isolated vertices and exact ID order.
  // This also supports imported DTA files and edited current datasets without rereading stale files.
  const q = v => JSON.stringify(String(v)), vec = v => v.length ? 'c(' + v.map(x=>typeof x === 'number' ? String(x) : q(x)).join(', ') + ')' : 'integer(0)';
  const tails = [], heads = [];
  for (let i = 0; i < net.n; i++) for (const j of net.out[i]) if (net.directed || i < j) { tails.push(i+1); heads.push(j+1); }
  const lines = ['# Prepared binary, loop-free network snapshot. Duplicate ties merged.', '# Isolated nodes retained; edge weights and dataset filters/weights do not apply.', 'library(network)', 'net <- network.initialize(' + net.n + ', directed = ' + (net.directed ? 'TRUE' : 'FALSE') + ', loops = FALSE)', 'set.vertex.attribute(net, "vertex.names", ' + vec(net.ids) + ')'];
  if (tails.length) lines.push('add.edges(net, tail = ' + vec(tails) + ', head = ' + vec(heads) + ')');
  const rt = ['edges'];
  terms.forEach((t,k) => {
    if (!t.a) { rt.push(t.t); return; }
    const at = net.attrs[t.a], alias = 'gm_attr_' + (k+1), numeric = t.t !== 'nodematch';
    if (!at || (numeric && (!at.num || Array.from(at.x).some(v=>!Number.isFinite(v)))) || (!numeric && at.v.some(v=>!v))) {
      lines.push('stop(' + q('Missing or invalid selected attribute: ' + t.a + '. Complete the nodes data or remove this effect.') + ')'); return;
    }
    lines.push('# ' + alias + ': ' + q(t.a), 'set.vertex.attribute(net, ' + q(alias) + ', ' + vec(numeric ? Array.from(at.x) : at.v) + ')');
    rt.push(t.t + '(' + q(alias) + ')');
  });
  lines.push('a <- as.matrix(net, matrix.type = "adjacency")', '# Centralities: sna conventions; eigenvector normalized to maximum 1.', 'if (requireNamespace("sna", quietly = TRUE)) {', '  mode <- ' + q(net.directed ? 'digraph' : 'graph'), '  ev <- abs(sna::evcent(a, use.eigen = TRUE))', '  centrality <- data.frame(node = network.vertex.names(net),', '    degree = sna::degree(a, gmode = mode),', '    indegree = sna::degree(a, gmode = mode, cmode = "indegree"),', '    outdegree = sna::degree(a, gmode = mode, cmode = "outdegree"),', '    betweenness = sna::betweenness(a, gmode = mode),', '    closeness = sna::closeness(a, gmode = mode, cmode = ' + q(net.directed?'directed':'undirected') + '),', '    harmonic = sna::closeness(a, gmode = mode, cmode = ' + q(net.directed?'suminvdir':'suminvundir') + '),', '    eigenvector = ev / max(ev))', '  print(centrality)', '}', 'if (requireNamespace("ergm", quietly = TRUE)) {', '  library(ergm)', '  m <- ergm(net ~ ' + rt.join(' + ') + ', estimate = "MPLE", control = control.ergm(MPLE.samplesize = max(1000000, network.size(net)^2)))', '  summary(m)', '} else message("Install ergm to reproduce the MPLE fit.")');
  return lines.join('\n');
}
