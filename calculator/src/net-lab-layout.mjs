// ===== Network map layout: readable pictures for small and large networks.
// Each separate piece gets its own layout (stress majorization from a pivot-MDS start, like graphlayouts::layout_with_stress);
// the large pieces share the main area, small pieces go to a side column, people without ties to a strip below.

function nlBfsD(adj, s, n, idx) { const d = new Int32Array(n).fill(-1), q = new Int32Array(n); let h = 0, t = 0; d[s] = 0; q[t++] = s; while (h < t) { const v = q[h++]; for (const w0 of adj[idx.nodes[v]]) { const w = idx.pos.get(w0); if (w !== undefined && d[w] < 0) { d[w] = d[v] + 1; q[t++] = w; } } } return d; }
// stress layout of one connected component; nodes: global ids; returns [[x,y]...] in units of one step
export function nlStress(und, nodes, seed = 1, iters) {
  const n = nodes.length; if (n === 1) return [[0, 0]]; if (n === 2) return [[-0.5, 0], [0.5, 0]];
  const idx = { nodes, pos: new Map(nodes.map((v, i) => [v, i])) };
  const big = n > 1500;
  // pivot MDS start (Brandes & Pich 2006)
  const k = Math.min(n, 40), piv = [0], dmin = new Float64Array(n).fill(Infinity), C = [];
  for (let p = 0; p < k; p++) { const d = nlBfsD(und, piv[p], n, idx); C.push(d); let far = -1, fd = -1; for (let i = 0; i < n; i++) { const di = d[i] < 0 ? n : d[i]; if (di < dmin[i]) dmin[i] = di; if (dmin[i] > fd) { fd = dmin[i]; far = i; } } if (p + 1 < k) piv.push(far); }
  const B = Array.from({ length: n }, () => new Float64Array(k)); const colM = new Float64Array(k), rowM = new Float64Array(n); let all = 0;
  for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const v = (C[p][i] < 0 ? n : C[p][i]) ** 2; B[i][p] = v; rowM[i] += v / k; colM[p] += v / n; all += v / (n * k); }
  for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) B[i][p] = -0.5 * (B[i][p] - rowM[i] - colM[p] + all);
  const BtB = Array.from({ length: k }, () => new Float64Array(k)); for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { let s = 0; for (let i = 0; i < n; i++) s += B[i][a] * B[i][b]; BtB[a][b] = s; }
  const vecs = []; let s0 = seed * 9301 + 49297;
  for (let e = 0; e < 2; e++) { let v = Float64Array.from({ length: k }, () => ((s0 = (s0 * 9301 + 49297) % 233280) / 233280) - 0.5);
    for (let it = 0; it < 100; it++) { const w = new Float64Array(k); for (let a = 0; a < k; a++) { let s = 0; for (let b = 0; b < k; b++) s += BtB[a][b] * v[b]; w[a] = s; } for (const u of vecs) { let d = 0; for (let a = 0; a < k; a++) d += w[a] * u[a]; for (let a = 0; a < k; a++) w[a] -= d * u[a]; } let nr = Math.hypot(...w) || 1; v = w.map(x => x / nr); }
    vecs.push(v); }
  const P = Array.from({ length: n }, (_, i) => { let x = 0, y = 0; for (let p = 0; p < k; p++) { x += B[i][p] * vecs[0][p]; y += B[i][p] * vecs[1][p]; } return [x, y]; });
  { let sx = 0; for (const p of P) sx += Math.hypot(p[0], p[1]); const sc = sx ? n / sx * Math.sqrt(n) * 0.5 : 1; for (let i = 0; i < n; i++) { P[i][0] = P[i][0] * sc + ((i * 7919) % 97) * 1e-3; P[i][1] = P[i][1] * sc + ((i * 104729) % 89) * 1e-3; } }
  if (big) return P;
  // stress majorization with weights d^-2
  const D = Array.from({ length: n }, (_, s) => nlBfsD(und, s, n, idx));
  const T = iters || (n <= 300 ? 300 : n <= 700 ? 120 : 50);
  for (let it = 0; it < T; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) { let nx = 0, ny = 0, ws = 0; const Di = D[i], Pi = P[i];
      for (let j = 0; j < n; j++) { if (i === j) continue; const dij = Di[j] < 0 ? n : Di[j], w = 1 / (dij * dij); const dx = Pi[0] - P[j][0], dy = Pi[1] - P[j][1], L = Math.hypot(dx, dy) || 1e-6; nx += w * (P[j][0] + dij * dx / L); ny += w * (P[j][1] + dij * dy / L); ws += w; }
      const x = nx / ws, y = ny / ws; moved += Math.abs(x - Pi[0]) + Math.abs(y - Pi[1]); Pi[0] = x; Pi[1] = y; }
    if (moved / n < 1e-4) break;
  }
  return P;
}
// Fruchterman–Reingold on one component (for the "Force" option)
export function nlForce(und, nodes, seed = 1, iters = 300) {
  const n = nodes.length; if (n <= 2) return nlStress(und, nodes, seed); const pos = new Map(nodes.map((v, i) => [v, i]));
  let s = seed * 48271 % 2147483647 || 1; const rnd = () => (s = s * 48271 % 2147483647) / 2147483647;
  const P = nodes.map(() => [rnd() * Math.sqrt(n), rnd() * Math.sqrt(n)]), kk = 1; let t = Math.sqrt(n) / 8;
  const E = []; nodes.forEach((v, i) => { for (const w of und[v]) { const j = pos.get(w); if (j !== undefined && j > i) E.push([i, j]); } });
  for (let it = 0; it < iters; it++) {
    const dx = new Float64Array(n), dy = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let ex = P[i][0] - P[j][0], ey = P[i][1] - P[j][1], d2 = ex * ex + ey * ey + 1e-6; const f = kk * kk / d2; dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f; }
    for (const [i, j] of E) { const ex = P[i][0] - P[j][0], ey = P[i][1] - P[j][1], d = Math.hypot(ex, ey) + 1e-6, f = d / kk; dx[i] -= ex * f; dy[i] -= ey * f; dx[j] += ex * f; dy[j] += ey * f; }
    for (let i = 0; i < n; i++) { const L = Math.hypot(dx[i], dy[i]) || 1e-9; P[i][0] += dx[i] / L * Math.min(L, t); P[i][1] += dy[i] / L * Math.min(L, t); }
    t *= 0.985;
  }
  return P;
}
function nlBox(P) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, w: Math.max(x1 - x0, 1e-6), h: Math.max(y1 - y0, 1e-6) }; }
// Full layout in pixels. o: { W, H, kind, group (Int32Array or null), radius (Float64Array), isolates: 'strip'|'hide'|'map', small: 'side'|'hide'|'map', seed, pad, title }
export function nlLayout(net, o) {
  const n = net.n, W = o.W || 900, H = o.H || 620, pad = o.pad || 22, R = o.radius || new Float64Array(n).fill(5), kind = o.kind || 'stress';
  const x = new Float64Array(n).fill(NaN), y = new Float64Array(n).fill(NaN), shown = new Uint8Array(n);
  const und = net.und, comps = []; { const seen = new Uint8Array(n); for (let s = 0; s < n; s++) { if (seen[s]) continue; const c = [], st = [s]; seen[s] = 1; while (st.length) { const v = st.pop(); c.push(v); for (const w of und[v]) if (!seen[w]) { seen[w] = 1; st.push(w); } } comps.push(c); } }
  comps.sort((a, b) => b.length - a.length);
  const iso = comps.filter(c => c.length === 1).map(c => c[0]), multi = comps.filter(c => c.length > 1);
  const isoMode = o.isolates || 'strip', smallMode = o.small || 'side';
  const big0 = multi.length ? multi[0].length : 0, smallCut = Math.max(3, Math.floor(0.08 * big0));
  let mainC = multi.filter((c, i) => i === 0 || c.length > smallCut), sideC = multi.filter((c, i) => i > 0 && c.length <= smallCut);
  if (smallMode === 'map') { mainC = multi; sideC = []; } else if (smallMode === 'hide') sideC = [];
  if (isoMode === 'map') mainC = mainC.concat(iso.map(v => [v]));
  const top = pad + (o.title ? 18 : 0), per = Math.max(1, Math.floor((W - 2 * pad) / 10));
  const stripH = isoMode === 'strip' && iso.length ? 18 + 10 * Math.ceil(iso.length / per) : 0;
  const sideW = sideC.length ? Math.min(240, (W - 2 * pad) * 0.22) : 0, mainW = W - 2 * pad - sideW, mainH = H - top - pad - stripH;
  const lay = (c, i) => {
    if (kind === 'circle') { const m = c.length; const ord = c.slice().sort((a, b) => (o.group ? (o.group[a] - o.group[b]) : 0) || und[b].size - und[a].size); const r = Math.max(1, m / (2 * Math.PI)); const P = new Array(m); ord.forEach((v, t) => { P[c.indexOf(v)] = [r * Math.cos(2 * Math.PI * t / m), r * Math.sin(2 * Math.PI * t / m)]; }); return P; }
    if (kind === 'force') return nlForce(und, c, (o.seed || 1) + i);
    if (kind === 'group' && o.group && c.length > 3) {
      const groups = new Map(); for (const v of c) { const g = o.group[v]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
      const parts = [...groups.values()].sort((a, b) => b.length - a.length).map(gn => { const sub = new Set(gn), su = gn.map(v => [...und[v]].filter(w => sub.has(w))); const loc = gn.map((v, t) => t); const und2 = gn.map((v, t) => new Set(su[t].map(w => gn.indexOf(w)))); const pc = []; { const seen = new Uint8Array(gn.length); for (let s = 0; s < gn.length; s++) { if (seen[s]) continue; const cc = [], st = [s]; seen[s] = 1; while (st.length) { const v = st.pop(); cc.push(v); for (const w of und2[v]) if (!seen[w]) { seen[w] = 1; st.push(w); } } pc.push(cc); } }
        const P = new Array(gn.length); let ox = 0; pc.sort((a, b) => b.length - a.length); const ring = pc.filter(cc => cc.length === 1).map(cc => cc[0]); const main = pc.filter(cc => cc.length > 1);
        let bx = 0; for (const cc of main) { const L = nlStress(und2, cc, 1); const bb = nlBox(L); cc.forEach((v, t) => { P[v] = [L[t][0] - bb.x0 + bx, L[t][1] - bb.y0]; }); bx += bb.w + 1.2; }
        const hgt = main.length ? Math.max(...main.map(cc => nlBox(cc.map(v => P[v])).h)) : 0; ring.forEach((v, t) => { P[v] = [(t % 8) * 0.9, hgt + 1 + Math.floor(t / 8) * 0.9]; });
        void loc; void ox; return { gn, P }; });
      // shelf-pack the groups
      const Pall = new Map(); let cx = 0, cy = 0, rowh = 0; const target = Math.sqrt(c.length) * 2.2;
      for (const { gn, P } of parts) { const bb = nlBox(P); if (cx > 0 && cx + bb.w > target) { cx = 0; cy += rowh + 1.6; rowh = 0; } gn.forEach((v, t) => Pall.set(v, [P[t][0] - bb.x0 + cx, P[t][1] - bb.y0 + cy])); cx += bb.w + 1.6; rowh = Math.max(rowh, bb.h); }
      return c.map(v => Pall.get(v));
    }
    return nlStress(und, c, (o.seed || 1) + i);
  };
  // main area: shelf-pack the main components at one common scale
  const L = mainC.map((c, i) => ({ c, P: lay(c, i) })); const gap = 1.4;
  let rows = [], cur = [], cw = 0; const boxes = L.map(l => nlBox(l.P)); const targetW = Math.max(boxes[0] ? boxes[0].w : 1, Math.sqrt(boxes.reduce((s, b) => s + (b.w + gap) * (b.h + gap), 0)) * 1.3);
  L.forEach((l, i) => { const b = boxes[i]; if (cur.length && cw + b.w > targetW) { rows.push(cur); cur = []; cw = 0; } cur.push(i); cw += b.w + gap; }); if (cur.length) rows.push(cur);
  const PL = new Array(L.length); let yy = 0, totW = 0; for (const r of rows) { let xx = 0, rh = 0; for (const i of r) { PL[i] = [xx, yy]; xx += boxes[i].w + gap; rh = Math.max(rh, boxes[i].h); } totW = Math.max(totW, xx - gap); yy += rh + gap; } const totH = Math.max(yy - gap, 1e-6);
  const mainN = L.reduce((t, l) => t + l.c.length, 0), s = L.length ? Math.min((mainW - 16) / Math.max(totW, 1e-6), (mainH - 16) / totH, mainN <= 3 ? 80 : Infinity) : 1;
  const ox = pad + (mainW - totW * s) / 2, oy = top + (mainH - totH * s) / 2;
  L.forEach((l, i) => { const b = boxes[i]; l.c.forEach((v, t) => { x[v] = ox + (PL[i][0] + l.P[t][0] - b.x0) * s; y[v] = oy + (PL[i][1] + l.P[t][1] - b.y0) * s; shown[v] = 1; }); });
  // side column
  let side = null;
  if (sideC.length) { const cx0 = pad + mainW + 8, colw = sideW - 8; const SL = sideC.map((c, i) => ({ c, P: nlStress(und, c, 7 + i) })); const sb = SL.map(l => nlBox(l.P));
    let need = 0; const ss = SL.map((l, i) => { const v = Math.min(s, (colw - 40) / sb[i].w, 48 / sb[i].h); need += sb[i].h * v + 18; return v; }); const shrink = Math.min(1, (mainH - 20) / Math.max(need, 1));
    let cy = top + 16; SL.forEach((l, i) => { const sc = ss[i] * shrink, ox2 = cx0 + (colw - sb[i].w * sc) / 2; l.c.forEach((v, t) => { x[v] = ox2 + (l.P[t][0] - sb[i].x0) * sc; y[v] = cy + (l.P[t][1] - sb[i].y0) * sc; shown[v] = 1; }); cy += sb[i].h * sc + 18 * shrink; });
    side = { x: cx0, y: top + 4, count: sideC.length }; }
  // overlap removal inside the main area
  const vis = []; for (let v = 0; v < n; v++) if (shown[v]) vis.push(v);
  if (vis.length <= 2500) for (let pass = 0; pass < 40; pass++) {
    let moved = false; const cell = 2 * Math.max(4, ...vis.map(v => R[v])) + 2, grid = new Map();
    for (const v of vis) { const k = Math.floor(x[v] / cell) + ',' + Math.floor(y[v] / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(v); }
    for (const v of vis) { const gx = Math.floor(x[v] / cell), gy = Math.floor(y[v] / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const u of (grid.get((gx + a) + ',' + (gy + b)) || [])) { if (u <= v) continue; const dx = x[u] - x[v], dy = y[u] - y[v], d = Math.hypot(dx, dy) || 1e-3, need = R[u] + R[v] + 1.5; if (d < need) { const m = (need - d) / 2, ux = d > 1e-3 ? dx / d : 1, uy = d > 1e-3 ? dy / d : 0; x[v] -= ux * m; y[v] -= uy * m; x[u] += ux * m; y[u] += uy * m; moved = true; } } }
    if (!moved) break;
  }
  // isolates strip
  let strip = null;
  if (isoMode === 'strip' && iso.length) { const y0 = H - pad - stripH + 14; iso.forEach((v, t) => { x[v] = pad + 4 + (t % per) * 10; y[v] = y0 + 8 + Math.floor(t / per) * 10; shown[v] = 2; }); strip = { x: pad, y: y0 - 2, count: iso.length }; }
  return { x, y, shown, side, strip, components: multi.length, isolates: iso.length, W, H };
}
// Labels that never overlap: most important first; tries 12 positions around each node. The most important labels
// (must) are always shown: if no free spot is near, they move further out and may cover a dot, but never another label.
export function nlPlaceLabels(items, obstacles, o = {}) {
  // o.hard: boxes no label may cover, like other labels (the section headings of the side column and isolates strip)
  const fs = o.fs || 11, cw = o.cw || 0.6, B = o.bounds, must = o.must == null ? 6 : o.must, obs = obstacles.slice(), labs = (o.hard || []).slice(), out = [];
  const over = (b, list) => { let h = 0; for (const t of list) if (b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]) h++; return h; };
  const inB = b => !B || (b[0] >= B[0] && b[1] >= B[1] && b[2] <= B[2] && b[3] <= B[3]);
  const score = b => inB(b) ? 100 * over(b, labs) + over(b, obs) : 1e6;
  const around = (x, y, r, w, h, gaps) => { const c = []; for (const g of gaps) c.push([x + r + g, y + fs * .35, 'start', [x + r + g - 1, y - h / 2, x + r + g + w, y + h / 2]], [x - r - g, y + fs * .35, 'end', [x - r - g - w, y - h / 2, x - r - g + 1, y + h / 2]], [x, y - r - g - 1, 'middle', [x - w / 2, y - r - g - h, x + w / 2, y - r - g + 1]], [x, y + r + g + fs - 2, 'middle', [x - w / 2, y + r + g - 1, x + w / 2, y + r + g + h]]); return c; };
  items.forEach((it, rank) => {
    const { x, y, r, text } = it, w = String(text).length * fs * cw + 3, h = fs * 1.15;
    let pick = around(x, y, r, w, h, [3, 9, 15]).find(c => score(c[3]) === 0);
    if (!pick && (rank < must || it.must)) { const c2 = around(x, y, r, w, h, [3, 9, 15, 24, 36, 50, 68]).map(c => [c, score(c[3])]).sort((a, b) => a[1] - b[1]); if (c2.length && c2[0][1] < 100) pick = c2[0][0]; }
    if (pick) { out.push({ i: it.i, x: pick[0], y: pick[1], anchor: pick[2], text }); labs.push(pick[3]); }
  });
  return out;
}
