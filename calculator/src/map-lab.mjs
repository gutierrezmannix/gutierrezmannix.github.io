// ---- GM26 maps: a country's divisions, the world, or the user's own boundaries — drawn in the chart builder's style
// (same title, source line, fonts, palettes and downloads). Geometry is TopoJSON (shared borders drawn once, so state
// borders can be drawn over municipalities) or GeoJSON. Projections: Lambert azimuthal equal-area centered on the area
// shown (a country or a part of it), Natural Earth I (the world and its regions), or the file's own flat coordinates.

// geometry: TopoJSON → features whose rings are lists of arc indices; GeoJSON → features whose rings are coordinates
export function mlFromTopo(topo, objName) {
  const tr = topo.transform, arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { if (tr) { x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; } return [p[0], p[1]]; }); });
  const ob = topo.objects[objName || Object.keys(topo.objects)[0]], feats = [];
  // every geometry keeps its place (even one without a shape), so feature numbers match the source's order
  for (const g of ob.geometries || []) { const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []; feats.push({ i: feats.length, props: g.properties || g.p || {}, polys }); }
  const users = arcs.map(() => []);
  feats.forEach((f, fi) => f.polys.forEach(pl => pl.forEach(r => r.forEach(ai => { const k = ai < 0 ? ~ai : ai, u = users[k]; if (u[u.length - 1] !== fi) u.push(fi); }))));
  return { kind: 'topo', arcs, feats, users };
}
export function mlFromGeoJSON(gj) {
  const feats = [];
  const list = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [];
  for (const f of list || []) { const g = f && f.geometry; if (!g) continue; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null; if (!polys) continue; feats.push({ i: feats.length, props: f.properties || {}, rings: polys }); }
  if (!feats.length) throw Error('The file has no areas (Polygon or MultiPolygon features).');
  return { kind: 'geojson', feats };
}
function mlRingLL(G, r) { if (G.kind !== 'topo') return r; const out = []; r.forEach((ai, k) => { const a = ai >= 0 ? G.arcs[ai] : G.arcs[~ai].slice().reverse(); for (let i = k ? 1 : 0; i < a.length; i++) out.push(a[i]); }); return out; }
function mlPolysLL(G, f) { return G.kind === 'topo' ? f.polys.map(pl => pl.map(r => mlRingLL(G, r))) : f.rings; }

// projections (y grows downwards, as in SVG)
function mlLaea(lon0, lat0) {
  const D = Math.PI / 180, p0 = lat0 * D, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
  return (lon, lat) => { const l = (((lon - lon0) % 360 + 540) % 360 - 180) * D, p = lat * D, cp = Math.cos(p), sp = Math.sin(p), cl = Math.cos(l); const k = Math.sqrt(2 / Math.max(1e-12, 1 + sp0 * sp + cp0 * cp * cl)); return [k * cp * Math.sin(l), -k * (cp0 * sp - sp0 * cp * cl)]; };
}
function mlNe1(lon, lat) { const q = ne1(Math.max(-180, Math.min(180, lon)) * Math.PI / 180, lat * Math.PI / 180); return [q[0], -q[1]]; }
function mlIsPlanar(G) { let bad = false; const chk = p => { if (Math.abs(p[0]) > 180.5 || Math.abs(p[1]) > 90.5) bad = true; }; if (G.kind === 'topo') { for (const a of G.arcs) { for (const p of a) chk(p); if (bad) break; } } else for (const f of G.feats) { for (const pl of f.rings) for (const r of pl) for (const p of r) chk(p); if (bad) break; } return bad; }
// the center of what is shown: circular mean of longitudes (so countries across the date line work), mid latitude
function mlCenter(G, fis) {
  let sx = 0, sy = 0, la0 = 90, la1 = -90;
  for (const fi of fis) for (const pl of mlPolysLL(G, G.feats[fi])) { const r = pl[0] || []; const st = Math.max(1, Math.floor(r.length / 40)); for (let i = 0; i < r.length; i += st) { const p = r[i]; sx += Math.cos(p[0] * Math.PI / 180); sy += Math.sin(p[0] * Math.PI / 180); if (p[1] < la0) la0 = p[1]; if (p[1] > la1) la1 = p[1]; } }
  return [Math.atan2(sy, sx) * 180 / Math.PI, (la0 + la1) / 2];
}
function mlRingProps(pts) {
  let a2 = 0, cx = 0, cy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const cr = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a2 += cr; cx += (pts[j][0] + pts[i][0]) * cr; cy += (pts[j][1] + pts[i][1]) * cr; const p = pts[i]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { area: Math.abs(a2 / 2), c: a2 ? [cx / (3 * a2), cy / (3 * a2)] : pts[0] || [0, 0], bb: [x0, y0, x1, y1] };
}
function mlBBUnion(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }

// project the features once per view (memoized on the geometry object); polygons carry area, centroid and bounds
function mlProject(G, fis, scope) {
  G._pc = G._pc || new Map(); const key = scope + '|' + fis.length + '|' + fis[0] + '|' + fis[fis.length - 1];
  if (G._pc.has(key)) return G._pc.get(key);
  const planar = mlIsPlanar(G), proj = planar ? ((x, y) => [x, -y]) : scope === 'world' ? mlNe1 : mlLaea(...mlCenter(G, fis));
  const polys = [], featPolys = new Map();
  for (const fi of fis) {
    const fp = [];
    for (const pl of mlPolysLL(G, G.feats[fi])) {
      const rings = pl.map(r => { let ll = r; if (scope === 'world') { let jump = false; for (let i = 1; i < ll.length; i++) if (Math.abs(ll[i][0] - ll[i - 1][0]) > 180) { jump = true; break; } if (jump) { let pos = 0; for (const p of ll) if (p[0] > 0) pos++; const east = pos >= ll.length / 2; ll = ll.map(p => [east && p[0] < 0 ? 180 : !east && p[0] > 0 ? -180 : p[0], p[1]]); } } return ll.map(p => proj(p[0], p[1])); });
      if (!rings.length || rings[0].length < 3) continue;
      const pr = mlRingProps(rings[0]), P = { fi, rings, area: pr.area, c: pr.c, bb: pr.bb }; polys.push(P); fp.push(P);
    }
    featPolys.set(fi, fp);
  }
  const out = { proj, planar, polys, featPolys }; G._pc.set(key, out); return out;
}
// the main body and far-away parts. Pieces that touch or nearly touch form groups; the group holding the most areas is
// the main body (the lower 48 US states, not Alaska's mainland, which is the largest single piece); groups near it join
// it; whole areas left far away (Alaska, Hawaii, the Canary Islands, San Andrés) become insets
function mlLayout(PJ, fis, maxInsets) {
  const polys = PJ.polys; if (!polys.length) return { bb: [0, 0, 1, 1], far: [], insets: [], inCore: new Set() };
  const all = polys.reduce((b, p) => mlBBUnion(b, p.bb), [Infinity, Infinity, -Infinity, -Infinity]), span = Math.max(all[2] - all[0], all[3] - all[1]), gap = 0.02 * span;
  const total = polys.reduce((t, p) => t + p.area, 0), order = polys.map((p, i) => i).sort((x, y) => polys[y].area - polys[x].area);
  const use = order.slice(0, 6000), par = new Map(use.map(i => [i, i])), find = i => { while (par.get(i) !== i) { par.set(i, par.get(par.get(i))); i = par.get(i); } return i; };
  for (let x = 0; x < use.length; x++) { const A = polys[use[x]].bb; for (let y = x + 1; y < use.length; y++) { const B = polys[use[y]].bb; if (A[0] - gap <= B[2] && B[0] - gap <= A[2] && A[1] - gap <= B[3] && B[1] - gap <= A[3]) { const r1 = find(use[x]), r2 = find(use[y]); if (r1 !== r2) par.set(r1, r2); } } }
  const groups = new Map(); for (const i of use) { const r = find(i); if (!groups.has(r)) groups.set(r, { polys: [], feats: new Set(), area: 0, bb: [Infinity, Infinity, -Infinity, -Infinity] }); const g = groups.get(r), P = polys[i]; g.polys.push(P); g.feats.add(P.fi); g.area += P.area; g.bb = mlBBUnion(g.bb, P.bb); }
  const gl = [...groups.values()].sort((a, b) => b.feats.size - a.feats.size || b.area - a.area);
  const c0 = gl[0].bb, ext0 = Math.max(c0[2] - c0[0], c0[3] - c0[1]);
  let bb = c0.slice(); const inCore = new Set(gl[0].polys), joined = new Set([gl[0]]);
  const join = g => { joined.add(g); g.polys.forEach(P => inCore.add(P)); bb = mlBBUnion(bb, g.bb); };
  const gapTo = (A, B) => [Math.max(0, A[0] - B[2], B[0] - A[2]), Math.max(0, A[1] - B[3], B[1] - A[3])];
  // 1. chains of islands and nearby pieces (Indonesia, the Philippines, Kaliningrad): close to the main body as it grows
  for (let pass = 0; pass < 12; pass++) { let grew = false; for (const g of gl) { if (joined.has(g)) continue; const [dx, dy] = gapTo(g.bb, bb); if (dx <= 0.1 * ext0 && dy <= 0.1 * ext0) { join(g); grew = true; } } if (!grew) break; }
  // 2. pieces whose center lies near the first main body (the Balearics, Corsica)
  for (const g of gl) { if (joined.has(g)) continue; const cx = (g.bb[0] + g.bb[2]) / 2, cy = (g.bb[1] + g.bb[3]) / 2; if (cx >= c0[0] - 0.2 * ext0 && cx <= c0[2] + 0.2 * ext0 && cy >= c0[1] - 0.2 * ext0 && cy <= c0[3] + 0.2 * ext0) join(g); }
  // 3. a large part of the country is never an inset (Malaysian Borneo)
  for (const g of gl) if (!joined.has(g) && g.area >= 0.25 * total) join(g);
  // the smallest pieces (not grouped above) belong to the main body when they lie inside or next to it
  for (const i of order.slice(6000)) { const P = polys[i], cx = (P.bb[0] + P.bb[2]) / 2, cy = (P.bb[1] + P.bb[3]) / 2; if (cx >= bb[0] && cx <= bb[2] && cy >= bb[1] && cy <= bb[3]) inCore.add(P); }
  const far = [];
  for (const fi of fis) { const fp = PJ.featPolys.get(fi) || []; if (fp.length && fp.every(p => !inCore.has(p))) far.push({ fi, area: fp.reduce((t, p) => t + p.area, 0), bb: fp.reduce((b, p) => mlBBUnion(b, p.bb), [Infinity, Infinity, -Infinity, -Infinity]) }); }
  far.sort((a, b) => b.area - a.area);
  const insets = far.filter(f => f.area / total > 0.00002).slice(0, maxInsets == null ? 3 : maxInsets);
  return { bb, far, insets, inCore };
}

// classes for colors: quantiles, equal steps, natural breaks (Fisher–Jenks) or the user's own cut points
export function mlBreaks(values, method, k, custom) {
  const v = values.filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b); if (!v.length) return [];
  if (method === 'custom') { const c = String(custom || '').split(/[;,\s]+/).map(Number).filter(isFinite).sort((a, b) => a - b); return [...new Set(c)].filter(x => x > v[0] && x < v[v.length - 1] || x > v[0] && x <= v[v.length - 1]).slice(0, 9); }
  k = Math.max(2, Math.min(9, k || 5)); const u = [...new Set(v)]; if (u.length <= k) return u.slice(1);
  if (method === 'equal') { const lo = v[0], hi = v[v.length - 1]; return Array.from({ length: k - 1 }, (_, i) => lo + (hi - lo) * (i + 1) / k); }
  if (method === 'jenks') return mlJenks(v, k);
  const q = []; for (let i = 1; i < k; i++) { const x = (v.length - 1) * i / k, lo = Math.floor(x); q.push(v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (x - lo)); }
  return [...new Set(q)];
}
function mlJenks(v, k) {
  const n = v.length; if (n > 4000) { const st = n / 4000, s = []; for (let i = 0; i < 4000; i++) s.push(v[Math.floor(i * st)]); s.push(v[n - 1]); return mlJenks(s, k); }
  const lower = Array.from({ length: n + 1 }, () => new Int32Array(k + 1)), vari = Array.from({ length: n + 1 }, () => new Float64Array(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { lower[1][j] = 1; vari[1][j] = 0; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, va = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1, val = v[i3 - 1]; s2 += val * val; s1 += val; w++; va = s2 - s1 * s1 / w; const i4 = i3 - 1;
      if (i4 !== 0) for (let j = 2; j <= k; j++) if (vari[l][j] >= va + vari[i4][j - 1]) { lower[l][j] = i3; vari[l][j] = va + vari[i4][j - 1]; }
    }
    lower[l][1] = 1; vari[l][1] = va;
  }
  const br = []; let kk = n;
  for (let j = k; j >= 2; j--) { const id = lower[kk][j] - 2; br.unshift(v[Math.max(0, id)]); kk = lower[kk][j] - 1; }
  return [...new Set(br)];
}
export const ML_SCHEMES = { chart: null, blues: '#1F5F86', oranges: '#B8620E', purples: '#5E3D7A', reds: '#9C2B2B', grays: '#2E2E2E', diverging: 'div' };
function mlRamp(base, k, reverse, diverging, pal) {
  const out = []; for (let i = 0; i < k; i++) { const t = k === 1 ? 1 : i / (k - 1); out.push(diverging ? cbDiv(t, pal) : t < 0.6 ? cbMix('#F2EEE6', base, 0.12 + t / 0.6 * 0.88) : cbMix(base, '#101B16', (t - 0.6) / 0.4 * 0.55)); }
  return reverse ? out.reverse() : out;
}
function mlNice(x) { if (!isFinite(x) || x === 0) return x; const m = Math.pow(10, Math.floor(Math.log10(Math.abs(x))) - 2); return Math.round(x / m) * m; }

// ---- draw: M = { type: 'map', geo, scope ('country'|'world'), fis (features drawn), values [], n [], cats [] (text values),
//      parent [] (key of the larger area, for its borders), group [] (areas joined by one value), names [], codes [],
//      valueTitle, minN, region (world: [lon0, lat0, lon1, lat1]), pct }
function mlDraw(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 860, G = M.geo, fis = M.fis && M.fis.length ? M.fis : G.feats.map(f => f.i);
  const isCat = !!M.cats, minN = +(o.minN != null ? o.minN : M.minN) || 0;
  // colors
  const vals = fis.map(fi => M.values ? M.values[fi] : NaN).filter(v => typeof v === 'number' && isFinite(v));
  const method = o.classes || 'quantile', k = Math.max(2, Math.min(9, +o.nClasses || 5)), scheme = o.scheme || 'chart';
  let breaks = [], ramp = [], catKeys = [];
  if (isCat) { catKeys = [...new Set(fis.map(fi => M.cats[fi]).filter(x => x != null && x !== ''))].sort(cbNatural); }
  else if (method === 'continuous') { ramp = mlRamp(scheme === 'chart' || !ML_SCHEMES[scheme] ? (C.pal[0] || '#2E7D58') : ML_SCHEMES[scheme] === 'div' ? '#2E7D58' : ML_SCHEMES[scheme], 9, !!o.reverse, scheme === 'diverging', C.pal); }
  else { breaks = mlBreaks(vals, method, k, o.breaks); ramp = mlRamp(scheme === 'chart' || !ML_SCHEMES[scheme] ? (C.pal[0] || '#2E7D58') : ML_SCHEMES[scheme] === 'div' ? '#2E7D58' : ML_SCHEMES[scheme], breaks.length + 1, !!o.reverse, scheme === 'diverging', C.pal); }
  const vmin = vals.length ? Math.min(...vals) : 0, vmax = vals.length ? Math.max(...vals) : 1;
  const noData = o.noData || '#E4DFD5';
  const classOf = v => { let i = 0; while (i < breaks.length && v > breaks[i] + 1e-12 * Math.abs(breaks[i])) i++; return i; };
  const colorOf = fi => {
    if (isCat) { const c = M.cats[fi]; if (c == null || c === '') return noData; const j = catKeys.indexOf(c); return C.col(c, j); }
    const v = M.values ? M.values[fi] : NaN; if (!(typeof v === 'number' && isFinite(v))) return noData;
    if (method === 'continuous') { const t = vmax > vmin ? (v - vmin) / (vmax - vmin) : 0.5, x = t * 8, i = Math.min(7, Math.floor(x)); return cbMix(ramp[i], ramp[i + 1], x - i); }
    return ramp[classOf(v)];
  };
  // layout
  const PJ = mlProject(G, fis, M.scope === 'world' ? 'world' : 'country');
  let LY = M.scope === 'world' ? null : mlLayout(PJ, fis, o.insets === false ? 0 : 3);
  let bb;
  if (M.scope === 'world') {
    if (M.region) { const D = M.region; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let s = 0; s <= 20; s++) for (const [lo, la] of [[D[0] + (D[2] - D[0]) * s / 20, D[1]], [D[0] + (D[2] - D[0]) * s / 20, D[3]], [D[0], D[1] + (D[3] - D[1]) * s / 20], [D[2], D[1] + (D[3] - D[1]) * s / 20]]) { const q = mlNe1(lo, la); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } bb = [x0, y0, x1, y1]; }
    else bb = PJ.polys.reduce((b, p) => mlBBUnion(b, p.bb), [Infinity, Infinity, -Infinity, -Infinity]);
    LY = { bb, far: [], insets: [], inCore: null };
  } else bb = LY.bb;
  const head = cbHead(C, M, W, null), legRows = isCat ? Math.ceil(catKeys.length / 4) : 1;
  const legH = (C.F.leg + 12) * legRows + C.F.lab + 30 + (minN ? C.F.leg + 10 : 0);
  const foot = cbFoot(C, M, W, 0), PW = W - 48;
  const asp = (bb[3] - bb[1]) / Math.max(1e-9, bb[2] - bb[0]);
  const PH = C.SZ ? Math.max(200, C.SZ[1] - head.h - legH - foot.h - 20) : Math.round(Math.max(300, Math.min(760, PW * asp)));
  const H = C.SZ ? C.SZ[1] : Math.round(head.h + 10 + PH + legH + foot.h + 10), T = head.h + 10;
  const sc = Math.min(PW / Math.max(1e-9, bb[2] - bb[0]), PH / Math.max(1e-9, bb[3] - bb[1]));
  const ox = 24 + (PW - (bb[2] - bb[0]) * sc) / 2 - bb[0] * sc, oy = T + (PH - (bb[3] - bb[1]) * sc) / 2 - bb[1] * sc;
  // insets in the lower left corner, each in its own frame
  const frames = new Map(); { let x = 24; const box = Math.min(PW * 0.22, PH * 0.3);
    for (const f of LY.insets) { const fw = f.bb[2] - f.bb[0], fh = f.bb[3] - f.bb[1], s2 = Math.min(sc, (box - 12) / Math.max(1e-9, fw), (box - 12) / Math.max(1e-9, fh)), bw = fw * s2 + 12, bh = fh * s2 + 12; if (x + bw > 24 + PW * 0.75) break; frames.set(f.fi, { s: s2, ox: x + 6 - f.bb[0] * s2, oy: T + PH - bh + 6 - f.bb[1] * s2, x, y: T + PH - bh, w: bw, h: bh }); x += bw + 8; } }
  const xf = (fi, p) => { const fr = frames.get(fi); return fr ? [p[0] * fr.s + fr.ox, p[1] * fr.s + fr.oy] : [p[0] * sc + ox, p[1] * sc + oy]; };
  const shown = fi => frames.has(fi) || !LY.inCore || (PJ.featPolys.get(fi) || []).some(p => LY.inCore.has(p));
  // points closer than half a pixel to the last one kept are dropped: the SVG stays small at any zoom
  const line = (fi, pts, close) => { let s = '', lx = NaN, ly = NaN, cnt = 0; const n = pts.length; for (let k = 0; k < n; k++) { const q = xf(fi, pts[k]), X = Math.round(q[0] * 10) / 10, Y = Math.round(q[1] * 10) / 10; if (cnt && k < n - 1 && Math.abs(X - lx) + Math.abs(Y - ly) < 0.6) continue; if (X === lx && Y === ly) continue; s += (cnt ? 'L' : 'M') + X + ',' + Y; lx = X; ly = Y; cnt++; } return cnt >= (close ? 3 : 2) ? s + (close ? 'Z' : '') : ''; };
  const pathOf = (fi, P) => P.rings.map(r => line(fi, r, true)).join('');
  const parts = [head.markup], plot = [], clip = (o.clipId || 'ml') + '-c';
  C.defs.push(`<clipPath id="${clip}"><rect x="24" y="${T}" width="${PW}" height="${PH}"/></clipPath>`);
  if (minN) C.defs.push(`<pattern id="${clip}-h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#1A1711" stroke-width="1.1" stroke-opacity=".5"/></pattern>`);
  const many = fis.length > 400, ownStroke = G.kind !== 'topo';
  const label = fi => (M.names && M.names[fi]) || '';
  const fmtV = v => C.vfmt(v, M.pct);
  const tip = fi => { const v = M.values ? M.values[fi] : NaN, n = M.n ? M.n[fi] : null; return label(fi) + (isCat ? ': ' + (M.cats[fi] || 'no data') : typeof v === 'number' && isFinite(v) ? ': ' + fmtV(v) + (n != null ? ' (n = ' + Number(n).toLocaleString('en-US') + ')' : '') : ': no data'); };
  for (const fi of fis) {
    if (!shown(fi)) continue; const fp = PJ.featPolys.get(fi) || []; let d = '';
    for (const P of fp) { if (LY.inCore && !frames.has(fi) && !LY.inCore.has(P)) continue; const pxA = P.area * (frames.has(fi) ? frames.get(fi).s * frames.get(fi).s : sc * sc); if (pxA < 0.15 && fp.length > 1) continue; d += pathOf(fi, P); }
    if (!d) continue; const fc = colorOf(fi);
    plot.push(`<path d="${d}" fill="${fc}" fill-rule="evenodd" stroke="${ownStroke ? '#FFFFFF' : fc}" stroke-width="${ownStroke ? (many ? 0.3 : 0.7) : 0.35}" stroke-linejoin="round"><title>${cbEsc(tip(fi))}</title></path>`);
    const n = M.n ? M.n[fi] : null; if (minN && n != null && n < minN && M.values && isFinite(M.values[fi])) plot.push(`<path d="${d}" fill="url(#${clip}-h)" fill-rule="evenodd" pointer-events="none"/>`);
  }
  // borders, each drawn once: between areas (white), between larger areas (dark), the outline (gray); none inside a group
  if (G.kind === 'topo') {
    const inSet = new Set(fis.filter(shown)), thin = [], thick = [], outline = [];
    G.users.forEach((u, ai) => {
      const us = u.filter(fi => inSet.has(fi)); if (!us.length) return; const fi = us[0];
      if (frames.has(fi) !== (us.length > 1 && frames.has(us[1]))) { if (us.length > 1) return; }
      const s = line(fi, G.arcs[ai].map(p => (M.scope === 'world' ? mlNe1 : PJ.proj)(p[0], p[1])), false);
      if (!s) return;
      if (us.length === 1) outline.push(s);
      else if (M.group && M.group[us[0]] != null && M.group[us[0]] === M.group[us[1]]) return;
      else if (M.parent && M.parent[us[0]] !== M.parent[us[1]]) thick.push(s);
      else thin.push(s);
    });
    if (thin.length) plot.push(`<path d="${thin.join('')}" fill="none" stroke="#FFFFFF" stroke-width="${many ? 0.35 : 0.8}" stroke-linejoin="round" pointer-events="none"/>`);
    if (outline.length && o.outline !== false) plot.push(`<path d="${outline.join('')}" fill="none" stroke="#9C9384" stroke-width="${many ? 0.5 : 0.8}" stroke-linejoin="round" pointer-events="none"/>`);
    if (thick.length && o.parentBorders !== false) plot.push(`<path d="${thick.join('')}" fill="none" stroke="#3D3629" stroke-width="1.15" stroke-linejoin="round" pointer-events="none"/>`);
  }
  parts.push(`<g clip-path="url(#${clip})">${plot.join('')}</g>`);
  for (const fr of frames.values()) parts.push(`<rect x="${fr.x.toFixed(1)}" y="${fr.y.toFixed(1)}" width="${fr.w.toFixed(1)}" height="${fr.h.toFixed(1)}" fill="none" stroke="#B9AF9C" stroke-width=".8" stroke-dasharray="3 2"/>`);
  // names and values on the map, larger areas first, never overlapping
  const showNames = o.areaLabels === 'names' || o.areaLabels === 'both', showVals = C.values !== 'none' || o.areaLabels === 'values' || o.areaLabels === 'both';
  if (showNames || showVals) {
    const placed = [], order = fis.filter(shown).map(fi => { const fp = (PJ.featPolys.get(fi) || []).filter(P => !LY.inCore || frames.has(fi) || LY.inCore.has(P)); const P = fp.sort((a, b) => b.area - a.area)[0]; return P ? { fi, P, a: P.area * (frames.has(fi) ? frames.get(fi).s ** 2 : sc * sc) } : null; }).filter(Boolean).sort((a, b) => b.a - a.a);
    const fsN = C.F.val * 0.92, fsV = C.F.val;
    for (const it of order) {
      if (it.a < 120) continue; const v = M.values ? M.values[it.fi] : NaN, hasV = showVals && !isCat && typeof v === 'number' && isFinite(v);
      const l1 = showNames ? label(it.fi) : '', l2 = hasV ? fmtV(v) : ''; if (!l1 && !l2) continue;
      const q = xf(it.fi, it.P.c), w = Math.max(cbTextW(l1, fsN), cbTextW(l2, fsV, true)) + 4, h = (l1 ? fsN + 2 : 0) + (l2 ? fsV + 2 : 0);
      const box = [q[0] - w / 2, q[1] - h / 2, q[0] + w / 2, q[1] + h / 2];
      if (box[0] < 24 || box[2] > 24 + PW || box[1] < T || box[3] > T + PH) continue;
      if (placed.some(b => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
      if (w * h > it.a * 1.6 && order.length > 12) continue;
      placed.push(box); let y = box[1];
      if (l1) { y += fsN; parts.push(C.T(q[0], y, l1, `text-anchor="middle" fill="${CBC.ink}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke" stroke-linejoin="round"`, fsN, false, 600)); y += 2; }
      if (l2) { y += fsV; parts.push(C.T(q[0], y, l2, `text-anchor="middle" fill="${CBC.ink}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke" stroke-linejoin="round"`, fsV, true, 700)); }
    }
  }
  for (const [fi, fr] of frames) parts.push(C.T(fr.x + 4, fr.y - 4, label(fi), `fill="${CBC.mut}"`, C.F.tick * 0.9));
  // legend
  const res0 = {}; let ly = T + PH + 18; const lt = o.legendTitle != null && o.legendTitle !== '' ? o.legendTitle : M.valueTitle || '';
  if (lt) { parts.push(C.T(24, ly + C.F.lab * 0.4, lt, `fill="${CBC.ink}"`, C.F.lab, false, 700)); ly += C.F.lab + 8; }
  if (isCat) {
    let x = 24, y = ly; catKeys.forEach((c, j) => { const t = C.nm(c), w = 20 + cbTextW(t, C.F.leg) + 18; if (x + w > W - 24 && x > 24) { x = 24; y += C.F.leg + 12; } parts.push(`<rect x="${x}" y="${(y - 1).toFixed(1)}" width="13" height="13" rx="2.5" fill="${C.col(c, j)}"/>`, C.T(x + 19, y + 10.5, t, `fill="${CBC.ink}"`, C.F.leg)); x += w; });
    ly = y + C.F.leg + 12;
  } else if (vals.length) {
    if (method === 'continuous') {
      const gw = Math.min(320, PW * 0.5); for (let i = 0; i < 48; i++) parts.push(`<rect x="${(24 + i * gw / 48).toFixed(1)}" y="${ly}" width="${(gw / 48 + 0.6).toFixed(1)}" height="12" fill="${colorOf(-1) && (() => { const x = i / 47 * 8, j = Math.min(7, Math.floor(x)); return cbMix(ramp[j], ramp[j + 1], x - j); })()}"/>`);
      parts.push(C.T(24, ly + 28, fmtV(vmin), `fill="${CBC.mut}"`, C.F.tick, true), C.T(24 + gw, ly + 28, fmtV(vmax), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true));
    } else {
      const edges = [vmin, ...breaks, vmax], bw = Math.min(110, (PW - 120) / ramp.length);
      ramp.forEach((c, i) => { const x = 24 + i * bw, cnt = vals.filter(v => classOf(v) === i).length; parts.push(`<rect x="${x.toFixed(1)}" y="${ly}" width="${(bw - 2).toFixed(1)}" height="13" fill="${c}"><title>${cbEsc(cnt + ' areas')}</title></rect>`); });
      edges.forEach((e, i) => parts.push(C.T(24 + i * bw - (i === 0 ? 0 : 1), ly + 29, fmtV(i === 0 || i === edges.length - 1 ? e : mlNice(e)), `text-anchor="${i === 0 ? 'start' : i === edges.length - 1 ? 'end' : 'middle'}" fill="${CBC.mut}"`, C.F.tick, true)));
    }
    const nx = 24 + Math.min(PW - 110, (method === 'continuous' ? Math.min(320, PW * 0.5) : Math.min(110, (PW - 120) / ramp.length) * ramp.length) + 22);
    parts.push(`<rect x="${nx}" y="${ly}" width="13" height="13" fill="${noData}" stroke="#CFC7B8"/>`, C.T(nx + 19, ly + 11, 'No data', `fill="${CBC.mut}"`, C.F.leg));
    ly += 46;
  }
  const hatched = minN && !isCat && fis.some(fi => shown(fi) && M.n && M.n[fi] != null && M.n[fi] < minN && M.values && isFinite(M.values[fi]));
  res0.hatched = hatched;
  if (hatched) { parts.push(`<rect x="24" y="${ly - 6}" width="13" height="13" fill="url(#${clip}-h)" stroke="#CFC7B8"/>`, C.T(43, ly + 5, 'Fewer than ' + minN + ' observations: value not reliable', `fill="${CBC.mut}"`, C.F.leg)); }
  parts.push(cbFoot(C, M, W, H).markup);
  const table = fis.map(fi => [label(fi), M.codes ? M.codes[fi] : '', isCat ? M.cats[fi] : (M.values ? M.values[fi] : null), M.n ? M.n[fi] : null]);
  const res = cbSvg(C, W, H, parts, M);
  res.hatched = !!res0.hatched; res.table = table; res.notShown = LY.far.filter(f => !frames.has(f.fi)).map(f => label(f.fi)).filter(Boolean); res.breaks = breaks;
  return res;
}

// ---- matching a column of the data to the areas of a map
const ML_GENERIC = /\b(estado|state|province|provincia|provinz|departamento|department|departement|region|regiao|oblast|kray|krai|okrug|aimag|aymag|governorate|gouvernorat|prefecture|district|distrito|county|condado|canton|municipio|municipality|municipalite|parish|division|territory|territorio|autonomous|autonoma|comunidad|of|de|del|la|las|los|el|do|da|des|du|di|libre|y|and|the|federal|soberano|free|city|ciudad|city of)\b/g;
export function mlNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
function mlCore(s) { const t = mlNorm(s).replace(ML_GENERIC, ' ').replace(/\s+/g, ' ').trim(); return t || mlNorm(s); }
function mlSim(a, b) { // similarity 0–1 from the edit distance
  if (a === b) return 1; const m = a.length, n = b.length; if (!m || !n) return 0; if (Math.abs(m - n) > Math.max(m, n) * 0.5) return 0;
  // optimal string alignment: two swapped letters count as one edit (Chihuahau → Chihuahua)
  let pp = null, prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1); } pp = prev; prev = cur; }
  return 1 - prev[n] / Math.max(m, n);
}
// the official numeric codes that a number in the data can mean: "09007", "9007" and "090070000" (INEGI with locality)
// are the same municipality when the map's codes have 5 digits
function mlCodeKey(raw, width) {
  let s = String(raw).trim(); if (/^-?\d+(\.0+)?$/.test(s)) s = String(Math.round(+s)); else if (!/^\d+$/.test(s)) return null;
  if (!width) return String(+s);
  if (s.length < width) return s.padStart(width, '0');
  if (s.length === width) return s;
  if (s.length > width && s.length <= width + 5) return s.padStart(width + 4, '0').length === width + 4 ? s.padStart(width + 4, '0').slice(0, width) : s.slice(0, width);
  return null;
}
// areas: [{ name, alt: [], iso, code, parent, parentName }]; values: [{ key, label, n }]
// returns { pick: Map(key → [area index]), how: Map(key → 'code'|'name'|'label'|'iso'|'close'|'user'), unmatched: [keys] }
export function mlMatch(values, areas, o = {}) {
  const byName = new Map(), byCore = new Map(), byIso = new Map(), byCode = new Map(), width = o.codeWidth || 0;
  const add = (map, k, i) => { if (!k) return; const cur = map.get(k); if (cur == null) map.set(k, i); else if (cur !== i) map.set(k, -1); };
  areas.forEach((a, i) => {
    const scope = o.parentOf ? '' : '';
    for (const nm of [a.name, ...(a.alt || [])]) { add(byName, scope + mlNorm(nm), i); add(byCore, scope + mlCore(nm), i); if (a.parentName) { add(byName, mlNorm(nm) + '|' + mlNorm(a.parentName), i); add(byCore, mlCore(nm) + '|' + mlCore(a.parentName), i); } }
    if (a.iso) { const iso = String(a.iso).toUpperCase(); add(byIso, mlNorm(iso), i); const suf = iso.split('-').pop(); add(byIso, mlNorm(suf), i); if (/^\d+$/.test(suf)) add(byIso, String(+suf), i); }
    if (a.code != null && a.code !== '') add(byCode, String(a.code), i);
  });
  const pick = new Map(), how = new Map(), unmatched = [], cores = areas.map(a => [a.name, ...(a.alt || [])].map(mlCore));
  for (const v of values) {
    const key = String(v.id != null ? v.id : v.key), user = o.user && o.user[key];
    if (user && user.length) { const ix = user.map(u => areas.findIndex(a => a.id === u || a.name === u)).filter(i => i >= 0); if (ix.length) { pick.set(key, ix); how.set(key, 'user'); continue; } }
    const ctx = v.parent ? '|' + mlNorm(v.parent) : '';
    let i = -1, h = '';
    const tryCode = () => { if (!byCode.size) return; const k = mlCodeKey(v.key, width); if (k != null && byCode.has(k) && byCode.get(k) >= 0) { i = byCode.get(k); h = 'code'; } };
    const tryText = (t, tag) => { if (t == null || t === '') return; const n1 = mlNorm(t), c1 = mlCore(t);
      for (const [map, k] of [[byName, n1 + ctx], [byCore, c1 + ctx], [byName, n1], [byCore, c1]]) { const r = map.get(k); if (r != null && r >= 0) { i = r; h = tag; return; } }
      const r2 = byIso.get(n1.replace(/\s+/g, '')); if (r2 != null && r2 >= 0) { i = r2; h = 'iso'; } };
    if (o.codesFirst !== false && /^\s*\d+(\.0+)?\s*$/.test(String(v.key))) tryCode();
    if (i < 0 && v.label != null && v.label !== '' && String(v.label) !== String(v.key)) tryText(v.label, 'label');
    if (i < 0) tryText(v.key, 'name');
    if (i < 0 && o.codesFirst === false) tryCode();
    if (i < 0 && o.fuzzy !== false) { // a close spelling, only when one area is clearly closest
      const t = mlCore(v.label != null && v.label !== '' ? v.label : v.key); if (t.length >= 4 && !/^\d+$/.test(t)) { let best = 0, second = 0, bi = -1; cores.forEach((cs, ai) => { const s = Math.max(...cs.map(c => mlSim(t, c))); if (s > best) { second = best; best = s; bi = ai; } else if (s > second) second = s; }); if (best >= 0.84 && best - second >= 0.06) { i = bi; h = 'close'; } }
    }
    if (i >= 0) { pick.set(key, [i]); how.set(key, h); } else unmatched.push(key);
  }
  // numbers are only read as official codes when most of them are codes of this map: a survey's own 1–10 must not
  // match Mongolia's ISO code MN-1 (Ulaanbaatar) and leave the other nine numbers unmatched
  const kid = v => String(v.id != null ? v.id : v.key);
  const nums = values.filter(v => /^\s*\d+(\.0+)?\s*$/.test(String(v.key)) && !(o.user && o.user[kid(v)] && o.user[kid(v)].length));
  const byCodes = nums.filter(v => ['code', 'iso'].includes(how.get(kid(v))));
  if (nums.length && byCodes.length && byCodes.length < 0.8 * nums.length) for (const v of byCodes) { const k = kid(v); pick.delete(k); how.delete(k); unmatched.push(k); }
  return { pick, how, unmatched, codesRejected: nums.length && byCodes.length && byCodes.length < 0.8 * nums.length ? byCodes.length : 0 };
}

// ---- the built-in maps: every country's first level (geoBoundaries) and Mexico's municipalities (INEGI 2023)
export const ML_LEVELS = { MEX: ['States', 'Municipalities'], USA: ['States', 'Counties'], CAN: ['Provinces and territories'], GBR: ['Nations', 'Counties and unitary authorities'], FRA: ['Regions', 'Departments'], ESP: ['Autonomous communities', 'Provinces'], DEU: ['States (Länder)'], ITA: ['Regions', 'Provinces'], PRT: ['Districts and autonomous regions'], BRA: ['States', 'Municipalities'], ARG: ['Provinces', 'Departments'], CHL: ['Regions', 'Provinces'], COL: ['Departments', 'Municipalities'], PER: ['Departments', 'Provinces'], ECU: ['Provinces', 'Cantons'], BOL: ['Departments', 'Provinces'], VEN: ['States', 'Municipalities'], URY: ['Departments'], PRY: ['Departments'], GTM: ['Departments', 'Municipalities'], HND: ['Departments', 'Municipalities'], SLV: ['Departments', 'Municipalities'], NIC: ['Departments', 'Municipalities'], CRI: ['Provinces', 'Cantons'], PAN: ['Provinces', 'Districts'], DOM: ['Provinces', 'Municipalities'], CUB: ['Provinces', 'Municipalities'], MNG: ['Provinces (aimags)', 'Districts (soums)'], CHN: ['Provinces'], IND: ['States and union territories', 'Districts'], RUS: ['Federal subjects'], JPN: ['Prefectures'], KOR: ['Provinces'], AUS: ['States and territories'], NZL: ['Regions'], ZAF: ['Provinces', 'District municipalities'], NGA: ['States', 'Local government areas'], KEN: ['Counties'], EGY: ['Governorates'], TUR: ['Provinces'], IRN: ['Provinces'], IDN: ['Provinces'], PHL: ['Regions'], VNM: ['Provinces'], THA: ['Provinces'], PAK: ['Provinces'], BGD: ['Divisions'], POL: ['Voivodeships'], UKR: ['Oblasts'], NLD: ['Provinces'], BEL: ['Regions'], CHE: ['Cantons'], AUT: ['States'], SWE: ['Counties'], NOR: ['Counties'], DNK: ['Regions'], FIN: ['Regions'], IRL: ['Provinces'], GRC: ['Regions'] };
export function mlLevelName(iso, level, canonical, count) {
  const t = (ML_LEVELS[iso] || [])[level - 1]; if (t) return t;
  const c = String(canonical || '').trim(); if (c && !/^(unknown|gbopen|country|n\/a|none)$/i.test(c) && !/republic|people/i.test(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  return level === 1 ? 'First-level divisions' : 'Second-level divisions';
}

// common other names for Mexico's states (the INEGI names are the long official ones)
export const ML_ALIAS = {
  'MX-CMX': ['CDMX', 'DF', 'D.F.', 'Distrito Federal', 'Mexico City', 'Ciudad de Mexico', 'Cd. de Mexico'], 'MX-MEX': ['Edomex', 'Estado de Mexico', 'Edo. de Mexico', 'Edo. Mex.', 'Mexico State', 'State of Mexico'],
  'MX-COA': ['Coahuila', 'Coah.'], 'MX-MIC': ['Michoacan', 'Mich.'], 'MX-VER': ['Veracruz', 'Ver.'], 'MX-NLE': ['NL', 'N.L.', 'Nuevo Leon'], 'MX-QUE': ['Queretaro', 'Queretaro de Arteaga', 'Qro.'],
  'MX-SLP': ['SLP', 'S.L.P.'], 'MX-BCN': ['BC', 'B.C.'], 'MX-BCS': ['BCS', 'B.C.S.'], 'MX-ROO': ['Q. Roo', 'Q Roo', 'QRoo'], 'MX-AGU': ['Ags.'], 'MX-CHH': ['Chih.'], 'MX-CHP': ['Chis.'], 'MX-GUA': ['Gto.'], 'MX-GRO': ['Gro.'], 'MX-HID': ['Hgo.'], 'MX-JAL': ['Jal.'], 'MX-MOR': ['Mor.'], 'MX-NAY': ['Nay.'], 'MX-OAX': ['Oax.'], 'MX-PUE': ['Pue.'], 'MX-SIN': ['Sin.'], 'MX-SON': ['Son.'], 'MX-TAB': ['Tab.'], 'MX-TAM': ['Tamps.'], 'MX-TLA': ['Tlax.'], 'MX-YUC': ['Yuc.'], 'MX-ZAC': ['Zac.'], 'MX-DUR': ['Dgo.'], 'MX-COL': ['Col.'], 'MX-CAM': ['Camp.']
};
