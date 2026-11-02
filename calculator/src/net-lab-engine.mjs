// ===== Networks (Design A): preparation, whole-network statistics, extra centralities, groups, homophily.
// Conventions follow statnet (sna/network/ergm) unless stated; every function is pure and runs in the worker.

// text files: UTF-8, or Windows/Excel (cp1252) when the bytes are not valid UTF-8 (e.g. “Sánchez” saved by Excel)
export function nlDecodeText(buf) { const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength)); if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf); if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } } // GM26 .66: Excel's Unicode text (UTF-16) too
export function nlRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NL_JUNK = new Set(['color', 'shape', 'size', 'opacity', 'image file', 'visibility', 'label fill color', 'label position', 'tooltip', 'layout order', 'x', 'y', 'locked?', 'polar r', 'polar angle', 'id', 'dynamic filter', 'add your own columns here', 'custom menu item text', 'custom menu item action', 'custom menu item text 2', 'custom menu item action 2', 'width', 'style', 'label text color', 'label font size', 'reciprocated?', 'vertex 1 group', 'vertex 2 group', 'imported id', 'unified twitter id', 'added by extended analysis', 'corrected by extended analysis', 'place bounding box', 'place id', 'place url', 'twitter page for tweet', 'tweet image file', 'media in tweet', 'in-reply-to tweet id', 'in-reply-to user id', 'quoted status id', 'retweet id', 'user id', 'web', 'time zone utc offset (seconds)', 'time zone', 'user of interest?']);
const NL_METRIC = new Set(['degree', 'in-degree', 'out-degree', 'betweenness centrality', 'closeness centrality', 'eigenvector centrality', 'pagerank', 'clustering coefficient', 'reciprocated vertex pair ratio', 'vertex group']);
export function nlKey(v) { return v == null ? '' : typeof v === 'number' ? (isFinite(v) ? String(v) : '') : String(v).trim(); }
function nlColVals(raw, ci) { const c = raw.cols[ci], out = new Array(raw.n); for (let i = 0; i < raw.n; i++) { const v = c.a[i]; out[i] = c.k === 'n' ? (isFinite(v) ? v : null) : (v == null || String(v).trim() === '' || String(v).trim() === '.' ? null : String(v).trim()); } return out; }
// What each column is good for. kind: 'e' edges file, 'n' nodes file.
export function nlColumnRoles(raw, kind) {
  if (!raw) return [];
  return raw.names.map((name, ci) => {
    const low = name.trim().toLowerCase(), v = nlColVals(raw, ci), nn = v.filter(x => x != null), lv = new Set(nn.map(String));
    const num = nn.length > 0 && nn.every(x => typeof x === 'number' || /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(String(x).replace(/,/g, '')));
    const r = { name, ci, levels: lv.size, valid: nn.length, missing: raw.n - nn.length, num, role: 'attr' };
    if (!nn.length) r.role = 'empty';
    else if (NL_JUNK.has(low)) r.role = 'junk';
    else if (NL_METRIC.has(low)) r.role = 'metric';
    else if (num) r.role = lv.size <= 1 ? 'constant' : lv.size <= 12 && nn.every(x => Number.isInteger(+x)) ? 'cat' : 'num';
    else {
      const avg = nn.reduce((s, x) => s + String(x).length, 0) / nn.length;
      r.role = lv.size <= 1 ? 'constant' : (lv.size === nn.length && nn.length >= 5 && avg < 60) ? 'name' : lv.size <= Math.max(12, Math.min(40, raw.n / 4)) && avg < 40 ? 'cat' : (lv.size >= 0.9 * nn.length && avg < 60 ? 'name' : 'text');
    }
    return r;
  });
}
export function nlGuess(er, nr) {
  const g = {}, find = (raw, keys) => { if (!raw) return ''; const nm = raw.names; for (const k of keys) { const f = nm.find(n => n.replace(/[\s_-]/g, '').toLowerCase() === k); if (f) return f; } return ''; };
  if (er) {
    for (const [f, t] of [['vertex1', 'vertex2'], ['from', 'to'], ['source', 'target'], ['sender', 'receiver'], ['ego', 'alter'], ['node1', 'node2'], ['actor1', 'actor2'], ['v1', 'v2'], ['i', 'j']]) { const a = find(er, [f]), b = find(er, [t]); if (a && b) { g.from = a; g.to = b; break; } }
    if (!g.from) { g.from = er.names[0] || ''; g.to = er.names[1] || ''; }
    g.weight = find(er, ['edgeweight', 'weight', 'w', 'value', 'strength', 'count', 'peso']);
    g.type = find(er, ['relationship', 'type', 'relation', 'tietype', 'kind', 'tipo']);
    g.date = find(er, ['relationshipdate(utc)', 'date', 'time', 'year', 'fecha', 'tweetdate(utc)']);
    g.nodexl = !!find(er, ['vertex1']) && !!find(er, ['vertex2']);
  }
  if (nr) {
    g.id = find(nr, ['vertex', 'id', 'node', 'name', 'actor', 'label']) || nr.names[0];
    const roles = nlColumnRoles(nr, 'n');
    g.label = find(nr, ['name', 'label', 'fullname', 'nombre']) || g.id;
    if (g.label === g.id) { const nm = roles.find(r => r.role === 'name' && r.name !== g.id); if (nm) g.label = nm.name; }
    g.attrs = roles.filter(r => (r.role === 'cat' || r.role === 'num') && r.name !== g.id && r.name !== g.label).map(r => r.name);
  }
  return g;
}
// "Rep. María Elvira Salazar" -> "María Elvira Salazar"
export function nlShortLabel(s) {
  let t = String(s == null ? '' : s).trim(), prev;
  do { prev = t; t = t.replace(/^(Office of (the )?|US Rep\.?\s+|U\.S\. Rep\.?\s+|Rep\.\s*|Representative\s+|Congressman\s+|Congresswoman\s+|Senator\s+|Sen\.\s+|Senadora?\s+|Diputad[oa]\s+|Dip\.\s+|Dr\.\s+|Dra\.\s+|Lic\.\s+)/i, '').trim(); } while (t !== prev && t);
  t = t.replace(/\s+(Press|Office|\(official\))$/i, '').trim();
  return t || String(s);
}
function nlYear(v) { if (v == null) return NaN; if (typeof v === 'number') { if (v > 1800 && v < 2200) return Math.floor(v); if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).getUTCFullYear(); if (v > 1e9) return new Date(v > 1e11 ? v : v * 1000).getUTCFullYear(); return NaN; } const m = String(v).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/); return m ? +m[1] : NaN; }
// Build the network. o: { from, to, id, label, short, weight ('' = rows), type, keep: {type: bool}, twoWay: {type: bool}, date, y0, y1, minW, directed, attrs: [names] }
export function nlBuild(er, nr, o) {
  if (!er) return { error: 'Load a ties (edges) file first.' };
  const fi = er.names.indexOf(o.from), ti = er.names.indexOf(o.to);
  if (fi < 0 || ti < 0) return { error: 'Choose who sends and who receives each tie.' };
  if (fi === ti) return { error: 'The sender and receiver columns must be different.' };
  const directed = o.directed !== false, ids = [], index = new Map(), rowOf = [];
  const add = (id, r) => { index.set(id, ids.length); ids.push(id); rowOf.push(r); };
  let idc = -1;
  if (nr) {
    idc = nr.names.indexOf(o.id); if (idc < 0) return { error: 'Choose the column with each person’s ID in the people file.' };
    for (let r = 0; r < nr.n; r++) { const id = nlKey(nr.cols[idc].a[r]); if (!id) return { error: 'Row ' + (r + 1) + ' of the people file has no ID.' }; if (index.has(id)) return { error: 'The ID “' + id + '” appears twice in the people file — each person needs one row.' }; add(id, r); }
  }
  const wi = o.weight ? er.names.indexOf(o.weight) : -1, tyi = o.type ? er.names.indexOf(o.type) : -1, di = o.date ? er.names.indexOf(o.date) : -1;
  const info = { rows: er.n, used: 0, self: 0, missEnd: 0, unknown: 0, dropType: 0, dropDate: 0, dropWeak: 0, merged: 0, types: {}, typeRecip: {}, years: {}, wMin: Infinity, wMax: -Infinity };
  const W = new Map(), typeOf = new Map(), pairs = [], mirrored = new Set(), selfOf = new Map();
  const tyRows = {};
  for (let r = 0; r < er.n; r++) {
    const a = nlKey(er.cols[fi].a[r]), b = nlKey(er.cols[ti].a[r]); const ty = tyi >= 0 ? (nlKey(er.cols[tyi].a[r]) || '(none)') : '';
    if (tyi >= 0) { info.types[ty] = (info.types[ty] || 0) + 1; (tyRows[ty] = tyRows[ty] || []).push([a, b]); }
    const y = di >= 0 ? nlYear(er.cols[di].a[r]) : NaN; if (isFinite(y)) info.years[y] = (info.years[y] || 0) + 1;
    if (!a || !b) { info.missEnd++; continue; }
    if (a === b) { info.self++; if (index.has(a)) selfOf.set(index.get(a), (selfOf.get(index.get(a)) || 0) + 1); else selfOf.set(a, (selfOf.get(a) || 0) + 1); continue; }
    if (tyi >= 0 && o.keep && o.keep[ty] === false) { info.dropType++; continue; }
    if (di >= 0 && (o.y0 || o.y1)) { if (!isFinite(y) || (o.y0 && y < o.y0) || (o.y1 && y > o.y1)) { info.dropDate++; continue; } }
    if (!nr) for (const id of [a, b]) if (!index.has(id)) add(id, -1);
    if (!index.has(a) || !index.has(b)) { info.unknown++; continue; }
    let w = 1; if (wi >= 0) { const v = er.cols[wi].a[r], x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); w = isFinite(x) && x > 0 ? x : 1; }
    const i = index.get(a), j = index.get(b), two = !directed || (tyi >= 0 && o.twoWay && o.twoWay[ty]);
    const put = (p, q, mirror) => { const k = directed ? p * 1e7 + q : Math.min(p, q) * 1e7 + Math.max(p, q);
      if (W.has(k)) { if (mirror || mirrored.has(k)) { W.set(k, Math.max(W.get(k), w)); if (!mirror) mirrored.delete(k); } else { info.merged++; W.set(k, W.get(k) + w); } }
      else { W.set(k, w); pairs.push(k); typeOf.set(k, ty); if (mirror) mirrored.add(k); } };
    put(i, j, false); if (two && directed) put(j, i, true);
    info.used++;
  }
  // share of rows of each type that are recorded both ways (to suggest "two-way" types such as alliances)
  for (const [ty, rows] of Object.entries(tyRows)) { const s = new Set(rows.map(([a, b]) => a + '\u0001' + b)); let rec = 0; for (const [a, b] of rows) if (a !== b && s.has(b + '\u0001' + a)) rec++; info.typeRecip[ty] = rows.length ? rec / rows.length : 0; }
  const n = ids.length; if (!n) return { error: 'No people found — check the ID columns.' };
  const out = Array.from({ length: n }, () => new Set()), inn = out.map(() => new Set()), und = out.map(() => new Set()), wout = out.map(() => new Map()), win = out.map(() => new Map());
  const edges = [];
  const minW = o.minW > 1 ? o.minW : 0;
  for (const k of pairs) {
    const w = W.get(k); if (minW && w < minW) { info.dropWeak++; continue; }
    const i = Math.floor(k / 1e7), j = k - i * 1e7;
    info.wMin = Math.min(info.wMin, w); info.wMax = Math.max(info.wMax, w);
    out[i].add(j); inn[j].add(i); und[i].add(j); und[j].add(i); wout[i].set(j, w); win[j].set(i, w);
    if (!directed) { out[j].add(i); inn[i].add(j); wout[j].set(i, w); win[i].set(j, w); }
    edges.push([i, j, w, typeOf.get(k)]);
  }
  // labels and attributes
  let labels = ids.slice();
  if (nr && o.label) { const li = nr.names.indexOf(o.label); if (li >= 0) labels = rowOf.map((r, i) => { const v = r < 0 ? '' : nlKey(nr.cols[li].a[r]); return v || ids[i]; }); }
  if (o.short) labels = labels.map(nlShortLabel);
  const attrs = {};
  if (nr) {
    const roles = nlColumnRoles(nr, 'n'), want = o.attrs || roles.filter(r => r.role === 'cat' || r.role === 'num').map(r => r.name);
    for (const name of want) {
      const ci = nr.names.indexOf(name), role = roles[ci]; if (ci < 0 || ci === idc) continue;
      const vals = nlColVals(nr, ci), v = rowOf.map(r => r < 0 ? null : vals[r]);
      const isNum = role.role === 'num' || (role.num && role.role !== 'cat');
      attrs[name] = { kind: isNum ? 'num' : 'cat', v: v.map(x => x == null ? null : String(x)), x: Float64Array.from(v, x => x == null ? NaN : +String(x).replace(/,/g, '')), levels: [...new Set(v.filter(x => x != null).map(String))].sort((a, b) => (isFinite(+a) && isFinite(+b)) ? +a - +b : a.localeCompare(b)), missing: v.filter(x => x == null).length };
    }
  }
  const selfTies = Int32Array.from(ids, (id, i) => (selfOf.get(i) || 0) + (selfOf.get(id) || 0));
  info.nodes = n; info.ties = edges.length; info.isolates = und.filter(s => s.size === 0).length;
  if (!isFinite(info.wMin)) { info.wMin = 0; info.wMax = 0; }
  const weighted = wi >= 0 && info.wMax > 1;
  return { net: { n, ids, labels, directed, out, inn, und, wout, win, edges, attrs, weighted, types: Object.keys(info.types), selfTies, rowOf: Int32Array.from(rowOf) }, info };
}
// sub-network keeping only nodes where keep[i] is true
export function nlSubnet(net, keep) {
  const map = new Int32Array(net.n).fill(-1), ids = [], labels = []; for (let i = 0; i < net.n; i++) if (keep[i]) { map[i] = ids.length; ids.push(net.ids[i]); labels.push(net.labels[i]); }
  const n = ids.length, out = Array.from({ length: n }, () => new Set()), inn = out.map(() => new Set()), und = out.map(() => new Set()), wout = out.map(() => new Map()), win = out.map(() => new Map()), edges = [];
  for (const [a, b, w, t] of net.edges) { const i = map[a], j = map[b]; if (i < 0 || j < 0) continue; out[i].add(j); inn[j].add(i); und[i].add(j); und[j].add(i); wout[i].set(j, w); win[j].set(i, w); if (!net.directed) { out[j].add(i); inn[i].add(j); wout[j].set(i, w); win[i].set(j, w); } edges.push([i, j, w, t]); }
  const attrs = {}; for (const [k, a] of Object.entries(net.attrs)) { const idx = []; for (let i = 0; i < net.n; i++) if (keep[i]) idx.push(i); attrs[k] = Object.assign({}, a, { v: idx.map(i => a.v[i]), x: Float64Array.from(idx, i => a.x[i]), missing: idx.filter(i => a.v[i] == null).length }); }
  return { n, ids, labels, directed: net.directed, out, inn, und, wout, win, edges, attrs, weighted: net.weighted, types: net.types, map };
}

// ---------- whole network
function nlBfs(adj, s, n) { const d = new Int32Array(n).fill(-1), q = new Int32Array(n); let h = 0, t = 0; d[s] = 0; q[t++] = s; while (h < t) { const v = q[h++]; for (const w of adj[v]) if (d[w] < 0) { d[w] = d[v] + 1; q[t++] = w; } } return d; }
export function nlComponents(net) {
  const n = net.n, comp = new Int32Array(n).fill(-1), sizes = [];
  for (let s = 0; s < n; s++) { if (comp[s] >= 0) continue; const c = sizes.length; let k = 0; const st = [s]; comp[s] = c; while (st.length) { const v = st.pop(); k++; for (const w of net.und[v]) if (comp[w] < 0) { comp[w] = c; st.push(w); } } sizes.push(k); }
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b] - sizes[a]), rank = new Int32Array(sizes.length); order.forEach((c, r) => { rank[c] = r; });
  return { comp: Int32Array.from(comp, c => rank[c]), sizes: order.map(c => sizes[c]) };
}
function nlStrong(net) { // Tarjan, iterative
  const n = net.n, idx = new Int32Array(n).fill(-1), low = new Int32Array(n), on = new Uint8Array(n), st = []; let k = 0, count = 0;
  const outs = net.out.map(s => [...s]);
  for (let s = 0; s < n; s++) {
    if (idx[s] >= 0) continue; const call = [[s, 0]]; idx[s] = low[s] = k++; st.push(s); on[s] = 1;
    while (call.length) {
      const top = call[call.length - 1], v = top[0];
      if (top[1] < outs[v].length) { const w = outs[v][top[1]++]; if (idx[w] < 0) { idx[w] = low[w] = k++; st.push(w); on[w] = 1; call.push([w, 0]); } else if (on[w]) low[v] = Math.min(low[v], idx[w]); }
      else { call.pop(); if (call.length) { const u = call[call.length - 1][0]; low[u] = Math.min(low[u], low[v]); } if (low[v] === idx[v]) { let w; do { w = st.pop(); on[w] = 0; } while (w !== v); count++; } }
    }
  }
  return count;
}
// triad census (Batagelj & Mrvar 2001); codes as in sna/igraph/networkx
const NL_TRICODES = [1, 2, 2, 3, 2, 4, 6, 8, 2, 6, 5, 7, 3, 8, 7, 11, 2, 6, 4, 8, 5, 9, 9, 13, 6, 10, 9, 14, 7, 14, 12, 15, 2, 5, 6, 7, 6, 9, 10, 14, 4, 9, 9, 12, 8, 13, 14, 15, 3, 7, 8, 11, 7, 12, 14, 15, 8, 14, 13, 15, 11, 15, 15, 16];
export const NL_TRIADS = ['003', '012', '102', '021D', '021U', '021C', '111D', '111U', '030T', '030C', '201', '120D', '120U', '120C', '210', '300'];
export function nlTriadCensus(net) {
  const n = net.n, out = net.out, c = new Float64Array(16);
  const has = (a, b) => out[a].has(b);
  const code = (v, u, w) => (has(v, u) ? 1 : 0) + (has(u, v) ? 2 : 0) + (has(v, w) ? 4 : 0) + (has(w, v) ? 8 : 0) + (has(u, w) ? 16 : 0) + (has(w, u) ? 32 : 0);
  for (let v = 0; v < n; v++) {
    for (const u of net.und[v]) {
      if (u <= v) continue;
      const S = new Set(net.und[u]); for (const x of net.und[v]) S.add(x); S.delete(u); S.delete(v);
      c[(has(v, u) && has(u, v)) ? 2 : 1] += n - S.size - 2;
      for (const w of S) if (u < w || (v < w && w < u && !net.und[v].has(w))) c[NL_TRICODES[code(v, u, w)] - 1]++;
    }
  }
  let sum = 0; for (let k = 1; k < 16; k++) sum += c[k]; c[0] = n * (n - 1) * (n - 2) / 6 - sum;
  return Array.from(c);
}
// triad census expected when only reciprocity matters: random networks with the same numbers of mutual, one-way and empty pairs (U|MAN)
export function* nlTriadUman(net, sims = 40, seed = 26) {
  const n = net.n, rnd = nlRng(seed), pairs = []; let M = 0, A = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { pairs.push(i * n + j); const a = net.out[i].has(j), b = net.out[j].has(i); if (a && b) M++; else if (a || b) A++; }
  const acc = new Float64Array(16);
  for (let s = 0; s < sims; s++) {
    for (let t = 0; t < M + A; t++) { const u = t + Math.floor(rnd() * (pairs.length - t)); const x = pairs[t]; pairs[t] = pairs[u]; pairs[u] = x; }
    const out = Array.from({ length: n }, () => new Set()), und = out.map(() => new Set());
    for (let t = 0; t < M + A; t++) { const k = pairs[t], i = Math.floor(k / n), j = k - i * n; und[i].add(j); und[j].add(i); if (t < M) { out[i].add(j); out[j].add(i); } else if (rnd() < 0.5) out[i].add(j); else out[j].add(i); }
    const c = nlTriadCensus({ n, out, und }); for (let k = 0; k < 16; k++) acc[k] += c[k] / sims;
    if (s % 4 === 0) yield { p: s / sims, msg: 'Comparing triads with chance' };
  }
  return Array.from(acc);
}
export function nlSummary(net, opts = {}) {
  const n = net.n, dir = net.directed, m = net.edges.length, dyads = dir ? n * (n - 1) : n * (n - 1) / 2;
  let mutualArcs = 0; if (dir) for (let i = 0; i < n; i++) for (const j of net.out[i]) if (net.out[j].has(i)) mutualArcs++;
  let tri = 0, trip = 0; const und = net.und;
  for (let v = 0; v < n; v++) { const nb = [...und[v]], k = nb.length; trip += k * (k - 1) / 2; for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (und[nb[a]].has(nb[b])) tri++; }
  const comps = nlComponents(net);
  // distances (directed geodesics when directed)
  const hist = {}; let sumd = 0, pairs = 0, diam = 0; const adj = dir ? net.out : net.und;
  const sources = n <= 2500 ? null : Array.from({ length: 600 }, (_, i) => Math.floor(i * n / 600));
  for (const s of (sources || Array.from({ length: n }, (_, i) => i))) { const d = nlBfs(adj, s, n); for (let t = 0; t < n; t++) if (t !== s && d[t] > 0) { hist[d[t]] = (hist[d[t]] || 0) + 1; sumd += d[t]; pairs++; if (d[t] > diam) diam = d[t]; } }
  const reachShare = sources ? pairs / (sources.length * (n - 1)) : pairs / (n * (n - 1));
  const deg = net.und.map(s => s.size), indeg = net.inn.map(s => s.size), outdeg = net.out.map(s => s.size);
  const dz = dir ? indeg : deg, maxd = Math.max(0, ...dz);
  const centr = n > 2 ? dz.reduce((s, d) => s + maxd - d, 0) / ((n - 1) * (dir ? (n - 1) : (n - 2))) : 0;
  const res = { n, m, directed: dir, dyads, density: dyads ? m / dyads : 0, reciprocity: dir && m ? mutualArcs / m : null, mutualDyads: dir ? mutualArcs / 2 : null,
    asymDyads: dir ? m - mutualArcs : null, transitivity: trip ? tri / trip : 0, triangles: tri, components: comps.sizes.filter(s => s > 1).length, largest: comps.sizes[0] || 0, isolates: comps.sizes.filter(s => s === 1).length,
    strong: dir ? nlStrong(net) : null, avgDist: pairs ? sumd / pairs : 0, diameter: diam, reachShare, distHist: hist, sampledDistances: !!sources,
    centralization: centr, meanDeg: n ? 2 * m / n * (dir ? 1 : 1) : 0, inDeg: indeg, outDeg: outdeg, deg };
  if (opts.triads !== false && dir && n <= 3000) res.triads = nlTriadCensus(net);
  return res;
}
// Compare with random networks of the same size and density (CUG test, Kadushin ch. 3): transitivity and reciprocity.
export function* nlCug(net, sims = 200, seed = 26) {
  const n = net.n, dir = net.directed, m = net.edges.length, rnd = nlRng(seed), obs = nlSummary(net, { triads: false });
  const tr = [], rc = [];
  for (let s = 0; s < sims; s++) {
    const out = Array.from({ length: n }, () => new Set()), und = out.map(() => new Set()); let k = 0;
    while (k < m) { const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); if (i === j || out[i].has(j) || (!dir && out[j].has(i))) continue; out[i].add(j); und[i].add(j); und[j].add(i); if (!dir) out[j].add(i); k++; }
    let t = 0, p = 0; for (let v = 0; v < n; v++) { const nb = [...und[v]], kk = nb.length; p += kk * (kk - 1) / 2; for (let a = 0; a < kk; a++) for (let b = a + 1; b < kk; b++) if (und[nb[a]].has(nb[b])) t++; }
    tr.push(p ? t / p : 0);
    if (dir) { let mu = 0; for (let i = 0; i < n; i++) for (const j of out[i]) if (out[j].has(i)) mu++; rc.push(m ? mu / m : 0); }
    if (s % 10 === 0) yield { p: s / sims, msg: 'Comparing with random networks' };
  }
  const st = a => { const s = a.slice().sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / a.length, lo: s[Math.floor(.025 * s.length)], hi: s[Math.min(s.length - 1, Math.floor(.975 * s.length))], max: s[s.length - 1] }; };
  return { sims, transitivity: Object.assign(st(tr), { obs: obs.transitivity, p: (tr.filter(x => x >= obs.transitivity).length + 1) / (sims + 1) }), reciprocity: dir ? Object.assign(st(rc), { obs: obs.reciprocity, p: (rc.filter(x => x >= obs.reciprocity).length + 1) / (sims + 1) }) : null };
}

// ---------- people (node-level measures beyond netCentrality)
export function nlNodeMeasures(net, opts = {}) {
  const n = net.n, dir = net.directed, und = net.und, base = netCentrality({ n, directed: dir, out: net.out, inn: net.inn, und });
  const strIn = new Float64Array(n), strOut = new Float64Array(n);
  for (let i = 0; i < n; i++) { for (const w of net.win[i].values()) strIn[i] += w; for (const w of net.wout[i].values()) strOut[i] += w; }
  // local clustering (undirected projection)
  const lcc = new Float64Array(n); for (let v = 0; v < n; v++) { const nb = [...und[v]], k = nb.length; if (k < 2) { lcc[v] = NaN; continue; } let t = 0; for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (und[nb[a]].has(nb[b])) t++; lcc[v] = t / (k * (k - 1) / 2); }
  // Burt's constraint (igraph/Burt 1992: p_ij from symmetrised tie strength) and effective size (Borgatti 1997)
  const sw = (a, b) => (net.wout[a].get(b) || 0) + (net.win[a].get(b) || 0);
  const tot = Float64Array.from({ length: n }, (_, a) => { let s = 0; for (const b of und[a]) s += opts.weightedConstraint === false ? 2 : sw(a, b); return s; });
  const P = (a, b) => tot[a] ? (opts.weightedConstraint === false ? 2 : sw(a, b)) / tot[a] : 0;
  const cons = new Float64Array(n), eff = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nb = [...und[i]], k = nb.length; if (!k) { cons[i] = NaN; eff[i] = NaN; continue; }
    let c = 0; for (const j of nb) { let ind = 0; for (const q of nb) if (q !== j && und[q].has(j)) ind += P(i, q) * P(q, j); c += (P(i, j) + ind) ** 2; } cons[i] = c;
    let t = 0; for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (und[nb[a]].has(nb[b])) t++; eff[i] = k - 2 * t / k;
  }
  // k-core (undirected degree)
  const core = nlCoreness(net);
  // Fowler connectedness: distances 1/w along ties towards the node (who supports whom); harmonic form when not everyone is reachable
  const conn = new Float64Array(n); let allReach = true;
  { const D = Array.from({ length: n }, () => null);
    for (let s = 0; s < n; s++) { const d = new Float64Array(n).fill(Infinity); d[s] = 0; const heap = [[0, s]]; const push = x => { heap.push(x); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      while (heap.length) { const [dv, v] = pop(); if (dv > d[v]) continue; for (const [w, wt] of net.wout[v]) { const nd = dv + 1 / wt; if (nd < d[w]) { d[w] = nd; push([nd, w]); } } }
      D[s] = d; }
    for (let t = 0; t < n; t++) { let s1 = 0, s2 = 0, ok = true; for (let s = 0; s < n; s++) { if (s === t) continue; const d = D[s][t]; if (!isFinite(d)) ok = false; else { s1 += d; s2 += 1 / d; } } if (!ok) allReach = false; conn[t] = ok ? (n - 1) / s1 : s2 / (n - 1); }
    if (!allReach) for (let t = 0; t < n; t++) { let s2 = 0; for (let s = 0; s < n; s++) if (s !== t && isFinite(D[s][t])) s2 += 1 / D[s][t]; conn[t] = s2 / (n - 1); } }
  // reach within two steps
  const reach2 = new Int32Array(n); for (let i = 0; i < n; i++) { const seen = new Set(net.out[i]); for (const j of net.out[i]) for (const k of net.out[j]) if (k !== i) seen.add(k); reach2[i] = seen.size; }
  const recipN = new Float64Array(n); if (dir) for (let i = 0; i < n; i++) { let m = 0; for (const j of net.out[i]) if (net.out[j].has(i)) m++; recipN[i] = net.out[i].size ? m / net.out[i].size : NaN; }
  return Object.assign(base, { strengthIn: strIn, strengthOut: strOut, clustering: lcc, constraint: cons, effsize: eff, core, connectedness: conn, connectednessHarmonic: !allReach, reach2, reciprocated: recipN });
}
// k-core number of each node (Batagelj & Zaversnik 2003), undirected degree
export function nlCoreness(net) {
  const n = net.n, deg = Int32Array.from(net.und, s => s.size); let md = 0; for (const d of deg) if (d > md) md = d;
  const bin = new Int32Array(md + 2); for (let v = 0; v < n; v++) bin[deg[v]]++; let start = 0; for (let d = 0; d <= md; d++) { const k = bin[d]; bin[d] = start; start += k; }
  const pos = new Int32Array(n), vert = new Int32Array(n); for (let v = 0; v < n; v++) { pos[v] = bin[deg[v]]; vert[pos[v]] = v; bin[deg[v]]++; }
  for (let d = md; d >= 1; d--) bin[d] = bin[d - 1]; bin[0] = 0;
  for (let i = 0; i < n; i++) { const v = vert[i]; for (const u of net.und[v]) if (deg[u] > deg[v]) { const du = deg[u], pu = pos[u], pw = bin[du], w = vert[pw]; if (u !== w) { pos[u] = pw; vert[pu] = w; pos[w] = pu; vert[pw] = u; } bin[du]++; deg[u]--; } }
  return deg;
}
// Gould & Fernandez (1989) brokerage roles by a categorical attribute: two-paths i->j->k without i->k
export function nlBrokerage(net, attr) {
  const n = net.n, a = net.attrs[attr]; if (!a) return null;
  const g = a.v, R = { coordinator: new Int32Array(n), gatekeeper: new Int32Array(n), representative: new Int32Array(n), consultant: new Int32Array(n), liaison: new Int32Array(n) };
  for (let j = 0; j < n; j++) for (const i of net.inn[j]) for (const k of net.out[j]) {
    if (k === i || net.out[i].has(k)) continue; const gi = g[i], gj = g[j], gk = g[k]; if (gi == null || gj == null || gk == null) continue;
    const r = gi === gj && gj === gk ? 'coordinator' : gi === gk ? 'consultant' : gi === gj ? 'representative' : gj === gk ? 'gatekeeper' : 'liaison'; R[r][j]++;
  }
  return R;
}

// ---------- groups
export function nlLouvain(net, opts = {}) {
  const n = net.n, gamma = opts.resolution || 1, seeds = opts.restarts || 8; const W0 = new Map();
  for (const [a, b, w] of net.edges) { const ww = opts.weighted === false ? 1 : w; const k1 = a * n + b, k2 = b * n + a; W0.set(k1, (W0.get(k1) || 0) + ww); W0.set(k2, (W0.get(k2) || 0) + ww); }
  if (!W0.size) return { member: new Int32Array(n).map((_, i) => i), Q: 0, sizes: Array(n).fill(1) };
  const level = (nodes, nbr, kdeg, m2, rnd) => {
    const comm = Int32Array.from({ length: nodes }, (_, i) => i), tot = Float64Array.from(kdeg); let moved = true, any = false, guard = 0;
    while (moved && guard++ < 50) { moved = false; const order = Array.from({ length: nodes }, (_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (const v of order) { const c0 = comm[v]; tot[c0] -= kdeg[v]; const kin = new Map(); for (const [u, w] of nbr[v]) if (u !== v) kin.set(comm[u], (kin.get(comm[u]) || 0) + w);
        let best = c0, bg = (kin.get(c0) || 0) - gamma * tot[c0] * kdeg[v] / m2; for (const [c, k] of kin) { const gain = k - gamma * tot[c] * kdeg[v] / m2; if (gain > bg + 1e-12) { best = c; bg = gain; } }
        comm[v] = best; tot[best] += kdeg[v]; if (best !== c0) { moved = true; any = true; } } }
    return { comm, any };
  };
  const modularity = (member) => { let m2 = 0; const k = new Float64Array(n); for (const [key, w] of W0) { const a = Math.floor(key / n); k[a] += w; m2 += w; } const tot = new Map(); let inside = 0; for (let i = 0; i < n; i++) tot.set(member[i], (tot.get(member[i]) || 0) + k[i]); for (const [key, w] of W0) { const a = Math.floor(key / n), b = key - a * n; if (member[a] === member[b]) inside += w; } let ex = 0; for (const t of tot.values()) ex += t * t; return inside / m2 - gamma * ex / (m2 * m2); };
  let best = null;
  for (let s = 0; s < seeds; s++) {
    const rnd = nlRng(1009 + s * 7919); let member = Int32Array.from({ length: n }, (_, i) => i);
    let nodes = n, W = W0, mapNode = Int32Array.from({ length: n }, (_, i) => i);
    for (let pass = 0; pass < 20; pass++) {
      const nbr = Array.from({ length: nodes }, () => []), kdeg = new Float64Array(nodes); let m2 = 0;
      for (const [key, w] of W) { const a = Math.floor(key / nodes), b = key - a * nodes; nbr[a].push([b, w]); kdeg[a] += w; m2 += w; }
      const { comm, any } = level(nodes, nbr, kdeg, m2, rnd); if (!any) break;
      const ids = new Map(); for (let i = 0; i < nodes; i++) if (!ids.has(comm[i])) ids.set(comm[i], ids.size);
      const nn = ids.size, W2 = new Map(); for (const [key, w] of W) { const a = Math.floor(key / nodes), b = key - a * nodes, ca = ids.get(comm[a]), cb = ids.get(comm[b]); const k2 = ca * nn + cb; W2.set(k2, (W2.get(k2) || 0) + w); }
      for (let i = 0; i < n; i++) member[i] = ids.get(comm[mapNode[i]]); mapNode = Int32Array.from(member); nodes = nn; W = W2; if (nn === 1) break;
    }
    const Q = modularity(member); if (!best || Q > best.Q + 1e-12) best = { member: Int32Array.from(member), Q };
  }
  // order groups by size
  const cnt = new Map(); for (const c of best.member) cnt.set(c, (cnt.get(c) || 0) + 1); const ord = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a)), rk = new Map(ord.map((c, i) => [c, i]));
  const member = Int32Array.from(best.member, c => rk.get(c));
  return { member, Q: best.Q, sizes: ord.map(c => cnt.get(c)) };
}
export function nlBlocks(net, member, k) {
  const sz = new Float64Array(k), ties = Array.from({ length: k }, () => new Float64Array(k)); for (let i = 0; i < net.n; i++) if (member[i] >= 0 && member[i] < k) sz[member[i]]++;
  for (const [a, b] of net.edges) { const ca = member[a], cb = member[b]; if (ca < 0 || cb < 0 || ca >= k || cb >= k) continue; ties[ca][cb]++; if (!net.directed && ca !== cb) ties[cb][ca]++; }
  const dens = ties.map((row, i) => Array.from(row, (t, j) => { const poss = i === j ? sz[i] * (sz[i] - 1) / (net.directed ? 1 : 2) : sz[i] * sz[j]; return poss ? (i === j || net.directed ? t : t) / poss : NaN; }));
  return { sizes: Array.from(sz), ties: ties.map(r => Array.from(r)), density: dens };
}
export function nlCliques(net, minSize = 3, cap = 5000) {
  const n = net.n, adj = net.directed ? net.und.map((s, i) => new Set([...s].filter(j => net.out[i].has(j) && net.out[j].has(i)))) : net.und; // directed: mutual ties only (sna clique.census "strong")
  const out = []; let capped = false;
  const bk = (R, P, X) => { if (out.length >= cap) { capped = true; return; } if (!P.length && !X.length) { if (R.length >= minSize) out.push(R.slice()); return; }
    let piv = -1, best = -1; for (const u of P.concat(X)) { let c = 0; for (const v of P) if (adj[u].has(v)) c++; if (c > best) { best = c; piv = u; } }
    for (const v of P.filter(v => !adj[piv].has(v))) { bk(R.concat([v]), P.filter(u => adj[v].has(u)), X.filter(u => adj[v].has(u))); P = P.filter(u => u !== v); X = X.concat([v]); } };
  bk([], Array.from({ length: n }, (_, i) => i).filter(i => adj[i].size), []);
  out.sort((a, b) => b.length - a.length); const memberships = new Int32Array(n); for (const c of out) for (const v of c) memberships[v]++;
  return { cliques: out, capped, memberships, mutualOnly: net.directed };
}
// structural equivalence: correlation of tie profiles (rows and columns), complete-linkage clustering cut into k positions
export function nlEquivalence(net, k = 4) {
  const n = net.n; if (n > 1500) return { error: 'Structural equivalence is limited to 1,500 people.' };
  const prof = Array.from({ length: n }, (_, i) => { const v = new Float64Array(2 * n); for (const j of net.out[i]) v[j] = 1; for (const j of net.inn[i]) v[n + j] = 1; return v; });
  const mean = prof.map(v => v.reduce((s, x) => s + x, 0) / v.length), sd = prof.map((v, i) => Math.sqrt(v.reduce((s, x) => s + (x - mean[i]) ** 2, 0)));
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { let s = 0; const A = prof[a], B = prof[b]; for (let t = 0; t < 2 * n; t++) { if (t === a || t === b || t === n + a || t === n + b) continue; s += (A[t] - mean[a]) * (B[t] - mean[b]); } const r = sd[a] && sd[b] ? s / (sd[a] * sd[b]) : 0; D[a][b] = D[b][a] = 1 - r; }
  const cl = Array.from({ length: n }, (_, i) => [i]); let act = cl.map((_, i) => i);
  const dist = (x, y) => { let m = 0; for (const a of cl[x]) for (const b of cl[y]) if (D[a][b] > m) m = D[a][b]; return m; };
  while (act.length > k) { let bx = -1, by = -1, bd = Infinity; for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) { const d = dist(act[i], act[j]); if (d < bd) { bd = d; bx = i; by = j; } } cl[act[bx]] = cl[act[bx]].concat(cl[act[by]]); act.splice(by, 1); }
  const member = new Int32Array(n); act.sort((x, y) => cl[y].length - cl[x].length).forEach((c, g) => { for (const v of cl[c]) member[v] = g; });
  return { member, sizes: act.map(c => cl[c].length) };
}

// ---------- homophily (Kadushin ch. 2): mixing table, E–I index, assortativity, permutation test
export function* nlMixing(net, attrName, perms = 1000, seed = 26) {
  const a = net.attrs[attrName]; if (!a) return { error: 'Choose a characteristic.' };
  const n = net.n, ok = []; for (let i = 0; i < n; i++) if (a.v[i] != null && (a.kind === 'cat' || isFinite(a.x[i]))) ok.push(i);
  const okSet = new Uint8Array(n); for (const i of ok) okSet[i] = 1;
  const E = net.edges.filter(([i, j]) => okSet[i] && okSet[j]);
  const rnd = nlRng(seed);
  if (a.kind === 'cat') {
    const lv = a.levels, li = new Map(lv.map((x, i) => [x, i])), K = lv.length, M = Array.from({ length: K }, () => new Float64Array(K));
    for (const [i, j] of E) { M[li.get(a.v[i])][li.get(a.v[j])]++; if (!net.directed && a.v[i] !== a.v[j]) M[li.get(a.v[j])][li.get(a.v[i])]++; }
    const within = vals => { let s = 0; for (const [i, j] of E) if (vals[i] === vals[j]) s++; return E.length ? s / E.length : NaN; };
    const obs = within(a.v); const cnt = new Map(); for (const i of ok) cnt.set(a.v[i], (cnt.get(a.v[i]) || 0) + 1); let exp = 0; const no = ok.length; for (const c of cnt.values()) exp += c * (c - 1); exp = no > 1 ? exp / (no * (no - 1)) : NaN;
    // Newman assortativity (directed form)
    let tr = 0, ab = 0; const tot = E.length * (net.directed ? 1 : 2), rs = new Float64Array(K), cs = new Float64Array(K); for (let x = 0; x < K; x++) for (let y = 0; y < K; y++) { const e = M[x][y] / tot; if (x === y) tr += e; rs[x] += e; cs[y] += e; } for (let x = 0; x < K; x++) ab += rs[x] * cs[x];
    const r = ab < 1 ? (tr - ab) / (1 - ab) : NaN;
    const vals = a.v.slice(), pool = ok.map(i => a.v[i]); let ge = 0, le = 0; const sim = [];
    for (let p = 0; p < perms; p++) { for (let t = pool.length - 1; t > 0; t--) { const u = Math.floor(rnd() * (t + 1)); [pool[t], pool[u]] = [pool[u], pool[t]]; } ok.forEach((i, t) => { vals[i] = pool[t]; }); const s = within(vals); sim.push(s); if (s >= obs - 1e-12) ge++; if (s <= obs + 1e-12) le++; if (p % 100 === 0) yield { p: p / perms, msg: 'Shuffling characteristics' }; }
    const IL = E.filter(([i, j]) => a.v[i] === a.v[j]).length, EL = E.length - IL;
    return { kind: 'cat', levels: lv, matrix: M.map(r2 => Array.from(r2)), ties: E.length, within: obs, expected: exp, ei: E.length ? (EL - IL) / E.length : NaN, assort: r, pMore: (ge + 1) / (perms + 1), pLess: (le + 1) / (perms + 1), perms, simMean: sim.reduce((s, x) => s + x, 0) / sim.length, missing: n - ok.length };
  }
  // numeric
  const x = a.x, diffMean = vals => { let s = 0; for (const [i, j] of E) s += Math.abs(vals[i] - vals[j]); return E.length ? s / E.length : NaN; };
  const obs = diffMean(x); let all = 0, cntp = 0; for (const i of ok) for (const j of ok) if (i !== j) { all += Math.abs(x[i] - x[j]); cntp++; } const allMean = cntp ? all / cntp : NaN;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const pairsXY = []; for (const [i, j] of E) { pairsXY.push([x[i], x[j]]); if (!net.directed) pairsXY.push([x[j], x[i]]); }
  for (const [p, q] of pairsXY) { sx += p; sy += q; sxx += p * p; syy += q * q; sxy += p * q; } const N = pairsXY.length; const r = N > 2 ? (sxy / N - sx / N * sy / N) / Math.sqrt((sxx / N - (sx / N) ** 2) * (syy / N - (sy / N) ** 2)) : NaN;
  const vals = Float64Array.from(x), pool = ok.map(i => x[i]); let le = 0; const sim = [];
  for (let p = 0; p < perms; p++) { for (let t = pool.length - 1; t > 0; t--) { const u = Math.floor(rnd() * (t + 1)); [pool[t], pool[u]] = [pool[u], pool[t]]; } ok.forEach((i, t) => { vals[i] = pool[t]; }); const s = diffMean(vals); sim.push(s); if (s <= obs + 1e-12) le++; if (p % 100 === 0) yield { p: p / perms, msg: 'Shuffling characteristics' }; }
  const untied = (() => { let s = 0, c = 0; const tied = new Set(E.map(([i, j]) => i * n + j)); for (const i of ok) for (const j of ok) if (i !== j && !tied.has(i * n + j) && !(!net.directed && tied.has(j * n + i))) { s += Math.abs(x[i] - x[j]); c++; } return c ? s / c : NaN; })();
  return { kind: 'num', ties: E.length, tiedDiff: obs, untiedDiff: untied, allDiff: allMean, assort: r, pCloser: (le + 1) / (perms + 1), perms, simMean: sim.reduce((s, v) => s + v, 0) / sim.length, missing: n - ok.length };
}
// one network per period (tie dates): basic statistics per slice
export function nlSlices(er, nr, o, years) {
  return years.map(y => { const b = nlBuild(er, nr, Object.assign({}, o, { y0: y, y1: y })); if (b.error) return { year: y, error: b.error }; const s = nlSummary(b.net, { triads: false }); const active = b.net.und.filter(x => x.size).length; return { year: y, ties: s.m, active, density: active > 1 ? s.m / (b.net.directed ? active * (active - 1) : active * (active - 1) / 2) : NaN, reciprocity: s.reciprocity, transitivity: s.transitivity }; });
}
