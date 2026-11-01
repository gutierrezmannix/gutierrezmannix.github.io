// ---- GM26 chart builder: one look for every chart — names for categories, values on the chart, a color per category.
// Charts are described by a model (what to draw, already computed) and drawn by cbScene(model, options).
export const CB_PALETTES = {
  sendero: ['#2E7D58', '#E5912A', '#357F93', '#B0572F', '#7E7563', '#80B79B', '#5DA0B1', '#755786', '#CE7714', '#536159'],
  okabe: ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#8C7B00', '#000000'],
  gray: ['#1F1F1F', '#7A7A7A', '#B5B5B5', '#4A4A4A', '#9A9A9A', '#D0D0D0'],
  bold: ['#5B2A86', '#D1495B', '#00798C', '#EDAE49', '#30638E', '#003D5B', '#8F2D56', '#218380']
};
export const CB_FAMILIES = [
  { id: 'amounts', q: 'Compare amounts between groups', icon: 'bars', kinds: [['bar', 'Bars'], ['groupbar', 'Grouped bars'], ['stackcount', 'Stacked bars'], ['dot', 'Dot plot']] },
  { id: 'parts', q: 'Show parts of a whole', icon: 'pie', kinds: [['pie', 'Pie'], ['donut', 'Donut'], ['stack', '100% stacked bars']] },
  { id: 'survey', q: 'Survey responses', icon: 'likert', kinds: [['likert', 'Likert responses']] },
  { id: 'spread', q: 'How values are spread', icon: 'hist', kinds: [['hist', 'Histogram'], ['density', 'Density'], ['box', 'Box plot'], ['gbox', 'Box plots by group'], ['violin', 'Violin']] },
  { id: 'time', q: 'Change over time', icon: 'line', kinds: [['line', 'Lines'], ['area', 'Area'], ['panel', 'One panel per group']] },
  { id: 'xy', q: 'Two numbers together', icon: 'scatter', kinds: [['scatterplain', 'Scatterplot'], ['scatter', 'With fitted line'], ['smooth', 'With smoother'], ['hexbin', 'Hexbin (many points)'], ['matrix', 'Scatterplot matrix'], ['corrmap', 'Correlation matrix'], ['heatmap', 'Heat map']] },
  { id: 'ci', q: 'Compare groups with uncertainty', icon: 'ci', kinds: [['mean', 'Means with intervals'], ['proportion', 'Proportions with intervals'], ['dumbbell', 'Dumbbell'], ['slope', 'Slope'], ['paired', 'Before and after']] },
  { id: 'model', q: 'Model results', icon: 'coef', kinds: [['coefficient', 'Coefficients'], ['modelcompare', 'Model comparison'], ['prediction', 'Predictions'], ['marginal', 'Marginal effects'], ['interaction', 'Interaction'], ['event', 'Event study'], ['conjoint', 'Conjoint / AMCE'], ['survival', 'Survival curves']] },
  { id: 'maps', q: 'Maps', icon: 'map', kinds: [['map', 'World and regions'], ['geomap', 'Country divisions (your file)']] }
];
export const cbFamilyOf = id => { const k = id === 'multiline' ? 'line' : id; return CB_FAMILIES.find(f => f.kinds.some(x => x[0] === k)) || null; };
export const cbTitleOf = id => { const k = id === 'multiline' ? 'line' : id; for (const f of CB_FAMILIES) for (const x of f.kinds) if (x[0] === k) return x[1]; return id; };

const cbNum = x => typeof x === 'number' && Number.isFinite(x);
const cbEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CBF = { ui: "'Hanken Grotesk', Arial, Helvetica, sans-serif", mono: "'Space Mono', 'Courier New', monospace" };
const CBC = { ink: '#1A1711', mut: '#5D5648', soft: '#6B6455', grid: '#ECE6DA', axis: '#B9AF9C', bg: '#FFFFFF', dim: '#C9C3B6', band: '#1A1711' };
export const cbTextW = (s, size, mono) => String(s ?? '').length * size * (mono ? 0.61 : 0.55);
const cbTrim = s => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

// numbers: one decimal for percentages, thousands separators, 17.5k when asked
export function cbFmt(v, o = {}) {
  if (!cbNum(v)) return '';
  const d = o.decimals != null && o.decimals !== '' ? +o.decimals : null;
  if (o.pct) return (d != null ? v.toFixed(d) : v.toFixed(Math.abs(v) < 1 && v !== 0 ? 2 : 1)) + '%';
  if (o.fmt === 'k') { const a = Math.abs(v); if (a >= 1e9) return cbTrim((v / 1e9).toFixed(d ?? 1)) + 'B'; if (a >= 1e6) return cbTrim((v / 1e6).toFixed(d ?? 1)) + 'M'; if (a >= 1e3) return cbTrim((v / 1e3).toFixed(d ?? 1)) + 'k'; }
  const a = Math.abs(v), dec = d != null ? d : a >= 100 || Number.isInteger(v) ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
// axis ticks at round values (as R's pretty()); integer-only steps for time axes
export function cbTicks(lo, hi, n = 5, integer = false) {
  const span = hi - lo; if (!(span > 0) || !cbNum(span)) return cbNum(lo) ? [lo] : [];
  const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; let step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; if (integer && step < 1) step = 1;
  const out = []; for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}
const tickFmt = (v, ticks, time, o) => {
  if (time) return String(v);
  if (o && o.pct) return cbFmt(v, { pct: true, decimals: ticks.every(t => Number.isInteger(t)) ? 0 : 1 });
  if (o && o.fmt === 'k' && Math.abs(v) >= 1000) return cbFmt(v, { fmt: 'k' });
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(v) || 1, dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
function cbRange(a, zero) { let lo = Infinity, hi = -Infinity; for (const v of a) if (cbNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } if (!cbNum(lo)) return [0, 1]; if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); } if (lo === hi) { const d = Math.abs(lo) * 0.05 || 0.5; return [lo - d, hi + d]; } return [lo, hi]; }
function cbLimits(range, lo, hi) { const r = [lo !== '' && lo != null ? Number(lo) : range[0], hi !== '' && hi != null ? Number(hi) : range[1]]; if (!r.every(cbNum) || r[0] >= r[1]) throw Error('Axis minimum must be smaller than maximum.'); return r; }
const DASH = { solid: '', dash: '7 5', dot: '1.5 5', dashdot: '7 4 1.5 4' };

// ---- shared context: sizes, fonts, names, colors, legend, frame
function cbCtx(model, o) {
  const ts = ({ s: 0.92, m: 1.06, l: 1.22 }[o.text]) || (o.font ? Math.max(0.85, Math.min(1.6, +o.font / 12)) : 1.06);
  const F = { title: 19 * ts, sub: 13.5 * ts, tick: 12 * ts, lab: 12.5 * ts, val: 11.5 * ts, src: 11.5 * ts, leg: 12.5 * ts };
  const SZ = { report: [900, 640], slide: [960, 540], square: [760, 760] }[o.size] || null;
  const pal = (o.palette && o.palette.length ? o.palette : CB_PALETTES.sendero);
  const names = o.names || {}, colors = o.colors || {}, catNames = o.catNames || {}, panelNames = o.panelNames || {}, catColors = o.catColors || {}, sn = model.seriesNames || {};
  const pick = (map, k, dflt) => (map[k] != null && String(map[k]).trim() !== '') ? String(map[k]) : dflt;
  const nm = k => pick(names, k, sn[k] != null ? String(sn[k]) : String(k)), nmc = k => pick(catNames, k, String(k)), nmp = k => pick(panelNames, k, String(k));
  const idx = new Map((model.seriesKeys || []).map((k, i) => [String(k), i]));
  const col = (k, i) => { const key = String(k); if (o.highlight && key !== String(o.highlight)) return CBC.dim; if (colors[key]) return colors[key]; const j = idx.has(key) ? idx.get(key) : (i || 0); return pal[j % pal.length]; };
  const colc = (k, i) => { const key = String(k); if (o.highlight && key !== String(o.highlight)) return CBC.dim; if (catColors[key]) return catColors[key]; return pal[(o.eachColor ? (i || 0) : 0) % pal.length]; };
  const defs = []; const pats = new Map();
  const fill = (k, i) => { const c = col(k, i); if (!o.patterns || c === CBC.dim) return c; const j = idx.has(String(k)) ? idx.get(String(k)) : (i || 0); const id = (o.clipId || 'cb') + '-p' + j; if (!pats.has(id)) { pats.set(id, 1); defs.push(`<pattern id="${id}" width="${6 + (j % 3) * 2}" height="${6 + (j % 3) * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(${j % 2 ? 45 : -45})"><rect width="12" height="12" fill="${c}"/><path d="M0 0V12" stroke="#1A1711" stroke-width="1"/></pattern>`); } return `url(#${id})`; };
  const dash = k => DASH[(o.dashes || {})[String(k)] || 'solid'] || '';
  const lw = { thin: 1.6, normal: 2.6, thick: 4 }[o.lineWidth] || 2.6;
  const T = (x, y, t, at = '', size, mono, weight) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-family="${mono ? CBF.mono : CBF.ui}" font-size="${(size || F.lab).toFixed(1)}"${weight ? ` font-weight="${weight}"` : ''} ${at}>${cbEsc(t)}</text>`;
  return { o, ts, F, SZ, pal, nm, nmc, nmp, col, colc, fill, dash, lw, T, defs, values: o.values || 'none', vfmt: (v, pct) => cbFmt(v, { pct: pct || o.fmt === 'pct', fmt: o.fmt, decimals: o.decimals }) };
}
// header (title, subtitle, legend on top) and footer (source); returns the vertical space used
function cbHead(C, model, W, legendKeys) {
  const o = C.o, out = [], title = o.title != null ? o.title : model.title || '', sub = o.subtitle != null ? o.subtitle : model.subtitle || '';
  let y = 14;
  if (title) { y += C.F.title; out.push(C.T(24, y, title, `fill="${CBC.ink}"`, C.F.title, false, 800)); y += 6; }
  if (sub) { y += C.F.sub + 2; out.push(C.T(24, y, sub, `fill="${CBC.mut}"`, C.F.sub)); y += 4; }
  if (legendKeys && legendKeys.length) {
    y += 12; let x = 24; const rowH = C.F.leg + 10;
    legendKeys.forEach((k, i) => { const t = C.nm(k), w = 18 + cbTextW(t, C.F.leg) + 18; if (x + w > W - 16 && x > 24) { x = 24; y += rowH; } out.push(`<rect x="${x}" y="${(y - C.F.leg * 0.8).toFixed(1)}" width="12" height="12" rx="2.5" fill="${C.fill(k, i)}" stroke="#9A917F" stroke-width=".5"/>`, C.T(x + 18, y + 1, t, `fill="${CBC.ink}"`, C.F.leg)); x += w; });
    y += 8;
  }
  return { markup: out.join(''), h: Math.max(y + 10, 22) };
}
function cbFoot(C, model, W, H) {
  const src = C.o.source != null ? C.o.source : model.source || '';
  return src ? { markup: C.T(24, H - 12, src, `fill="${CBC.soft}"`, C.F.src), h: C.F.src + 18 } : { markup: '', h: 10 };
}
function cbWrap(text, width, size, maxLines = 2) {
  const words = String(text).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cbTextW(t, size) <= width || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/.{0,2}$/, '') + '…'; return keep; }
  return lines;
}
function cbSvg(C, W, H, parts, model) {
  const o = C.o, title = o.title != null ? o.title : model.title || '';
  return { markup: `<title>${cbEsc(title || 'Chart')}</title><desc>${cbEsc(o.description || model.note || '')}</desc>${C.defs.length ? '<defs>' + C.defs.join('') + '</defs>' : ''}<rect width="${W}" height="${H}" fill="${CBC.bg}"/>${parts.join('')}`, width: W, height: H };
}
// place labels at line ends without overlap
function cbSpread(items, gap, lo, hi) {
  items.sort((a, b) => a.y - b.y);
  if (items.length) items[0].ly = items[0].y;
  for (let i = 1; i < items.length; i++) items[i].ly = items[i].y - items[i - 1].ly < gap ? items[i - 1].ly + gap : items[i].y;
  if (items.length) { const over = items[items.length - 1].ly - hi; if (over > 0) for (let i = items.length - 1; i >= 0; i--) { items[i].ly -= over; if (i && items[i].ly - items[i - 1].ly >= gap) break; } }
  for (const it of items) if (it.ly < lo) it.ly = lo;
  return items;
}

// ---- the dispatcher
export function cbScene(model, o = {}) {
  if (!model) throw Error('Nothing to draw.');
  const C = cbCtx(model, o);
  switch (model.type) {
    case 'cat': return cbDrawCat(C, model);
    case 'xy': return cbDrawXY(C, model);
    case 'pie': return cbDrawPie(C, model);
    case 'box': return cbDrawBox(C, model);
    case 'grid': return cbDrawGrid(C, model);
    case 'pair': return cbDrawPair(C, model);
    case 'matrix': return cbDrawMatrix(C, model);
    case 'raw': return { markup: model.markup, width: model.width, height: model.height };
    default: throw Error('Unsupported chart type.');
  }
}

// ---- categories: bars (single, grouped, stacked, 100%), Likert, dots, estimates with intervals
function cbDrawCat(C, M) {
  const o = C.o; let cats = M.cats.slice();
  const val = (ci, si) => (M.vals[ci] && M.vals[ci][si]) || null;
  const tot = ci => M.series.reduce((s, _, si) => s + (val(ci, si)?.v || 0), 0);
  const sortBy = o.sort || M.sort || 'none';
  if (sortBy !== 'none' && M.mode !== 'diverge') {
    const order = cats.map((k, ci) => ({ k, ci, v: M.mode === 'single' || M.mode === 'dot' || M.mode === 'ci' ? (val(ci, 0)?.v ?? -Infinity) : tot(ci) }));
    if (sortBy === 'name') order.sort((a, b) => C.nmc(a.k).localeCompare(C.nmc(b.k), undefined, { numeric: true }));
    else order.sort((a, b) => sortBy === 'asc' ? a.v - b.v : b.v - a.v);
    const vals = order.map(r => M.vals[r.ci]); cats = order.map(r => r.k); M = Object.assign({}, M, { vals });
  }
  const nC = cats.length, nS = M.series.length, multi = nS > 1 && M.mode !== 'single';
  const maxLab = Math.max(...cats.map(k => cbTextW(C.nmc(k), C.F.lab)), 10);
  const horiz = M.mode === 'diverge' || M.horizontal === true || (o.horizontal === 'yes') || (o.horizontal !== 'no' && M.horizontal !== false && (maxLab > 95 || nC > 14));
  const pct = !!M.pct, legendMode = o.legend || 'auto', showLeg = multi && legendMode !== 'none';
  const legendKeys = showLeg && legendMode !== 'bottom' ? M.series : null;
  const W = C.SZ ? C.SZ[0] : 820;
  const head = cbHead(C, M, W, legendKeys);
  const xTitle = o.xTitle != null ? o.xTitle : M.xTitle || '', yTitle = o.yTitle != null ? o.yTitle : M.yTitle || '';
  // value axis range
  let vlo = 0, vhi = 0;
  M.vals.forEach((row, ci) => { if (M.mode === 'stack' || M.mode === 'stack100') { let s = 0; row.forEach(c => { s += c?.v || 0; }); vhi = Math.max(vhi, s); } else if (M.mode === 'diverge') { vlo = -100; vhi = 100; } else row.forEach(c => { if (!c) return; for (const v of [c.v, c.lo, c.hi]) if (cbNum(v)) { vlo = Math.min(vlo, v); vhi = Math.max(vhi, v); } }); });
  if (M.mode === 'stack100') vhi = 100;
  const zero = o.zero != null ? !!o.zero : M.zero !== false;
  let vr = M.mode === 'diverge' ? [-100, 100] : zero ? [Math.min(0, vlo), vhi] : (() => { let lo = Infinity, hi = -Infinity; M.vals.forEach(r => r.forEach(c => { if (c) for (const v of [c.v, c.lo, c.hi]) if (cbNum(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } })); const pad = (hi - lo) * 0.08 || 1; return [lo - pad, hi + pad]; })();
  if (!(vr[1] > vr[0])) vr = [vr[0], vr[0] + 1];
  vr = cbLimits(vr, horiz ? o.xmin : o.ymin, horiz ? o.xmax : o.ymax);
  let ticks = cbTicks(vr[0], vr[1], 5); if (ticks.length && M.mode !== 'diverge' && o.ymax == null && o.xmax == null) { const st = ticks.length > 1 ? ticks[1] - ticks[0] : 1; if (ticks[ticks.length - 1] < vr[1] - 1e-9) { ticks.push(Number((ticks[ticks.length - 1] + st).toPrecision(12))); } vr = [Math.min(vr[0], ticks[0]), Math.max(vr[1], ticks[ticks.length - 1])]; }
  const showVals = C.values !== 'none';
  const parts = [head.markup];
  if (!horiz) {
    const tickW = Math.max(...ticks.map(t => cbTextW(tickFmt(t, ticks, false, { pct }), C.F.tick, true)), 20);
    const L = 24 + (yTitle ? C.F.lab + 10 : 0) + tickW + 10, R = 24, band = (W - L - R) / nC;
    const labLines = cats.map(k => cbWrap(C.nmc(k), band - 6, C.F.lab, 3)), rot = band < 34 || labLines.some(l => l.length > 2 && band < 70);
    const labH = rot ? Math.min(150, maxLab * 0.72 + 14) : Math.max(...labLines.map(l => l.length)) * (C.F.lab + 3) + 8;
    const foot = cbFoot(C, M, W, 0), bottomLeg = showLeg && legendMode === 'bottom' ? Math.ceil(nS / 4) * (C.F.leg + 10) + 8 : 0;
    const H = C.SZ ? C.SZ[1] : Math.round(Math.max(420, head.h + 330 + labH + foot.h + (xTitle ? C.F.lab + 12 : 0) + bottomLeg));
    const T = head.h + 8, B = labH + foot.h + (xTitle ? C.F.lab + 14 : 0) + bottomLeg + 6, PH = H - T - B;
    if (PH < 80) throw Error('The chart is too small for this many labels — choose a larger size or fewer categories.');
    const Y = v => T + PH - (v - vr[0]) / (vr[1] - vr[0]) * PH;
    ticks.forEach(t => { if (o.grid !== false) parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${t === 0 ? CBC.axis : CBC.grid}"/>`); parts.push(C.T(L - 8, Y(t) + 4, tickFmt(t, ticks, false, { pct, fmt: o.fmt }), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true)); });
    if (vr[0] < 0 && vr[1] > 0) parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="${CBC.axis}"/>`);
    cats.forEach((k, ci) => {
      const x0 = L + ci * band, row = M.vals[ci] || [];
      if (M.mode === 'stack' || M.mode === 'stack100') {
        let run = 0; const bw = Math.min(band * 0.68, 90), bx = x0 + (band - bw) / 2;
        M.series.forEach((s, si) => { const c = row[si]; if (!c || !(c.v > 0)) return; const y1 = Y(run + c.v), y0 = Y(run); parts.push(`<rect x="${bx.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${C.fill(s, si)}" stroke="#FFFFFF" stroke-width="1"><title>${cbEsc(C.nmc(k) + ' · ' + C.nm(s) + ': ' + C.vfmt(c.v, pct))}</title></rect>`); if (showVals && C.values !== 'total' && y0 - y1 > C.F.val + 4) parts.push(C.T(bx + bw / 2, (y0 + y1) / 2 + C.F.val * 0.35, C.vfmt(c.v, pct), `text-anchor="middle" fill="${cbInk(C.col(s, si))}"`, C.F.val, false, 700)); run += c.v; });
        if (showVals && (C.values === 'total' || C.values === 'all') && M.mode === 'stack') parts.push(C.T(bx + bw / 2, Y(run) - 6, C.vfmt(run, pct), `text-anchor="middle" fill="${CBC.ink}"`, C.F.val, false, 700));
      } else if (M.mode === 'group' || M.mode === 'single') {
        const n = M.mode === 'single' ? 1 : nS, gw = Math.min(band * 0.8, n * 70), bw = gw / n, gx = x0 + (band - gw) / 2;
        for (let si = 0; si < n; si++) { const c = row[si], s = M.series[si]; if (!c || !cbNum(c.v)) continue; const y1 = Y(Math.max(0, c.v)), y0 = Y(Math.min(0, c.v)); const byCat = M.mode === 'single' && M.colorBy === 'cat'; parts.push(`<rect x="${(gx + si * bw + 1).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(0.5, y0 - y1).toFixed(1)}" fill="${byCat ? C.colc(k, ci) : C.fill(s, si)}"><title>${cbEsc(C.nmc(k) + (n > 1 ? ' · ' + C.nm(s) : '') + ': ' + C.vfmt(c.v, pct) + (c.n != null ? ' (n = ' + c.n.toLocaleString('en-US') + ')' : ''))}</title></rect>`); if (showVals) parts.push(C.T(gx + si * bw + bw / 2, (c.v >= 0 ? y1 - 6 : y0 + C.F.val + 2), C.vfmt(c.v, pct), `text-anchor="middle" fill="${CBC.ink}"`, Math.min(C.F.val, bw * 0.42 + 4), false, 700)); }
      } else { // dot or ci: a point per series, with an interval when present
        const n = nS, step = Math.min(band * 0.6 / Math.max(1, n), 22);
        for (let si = 0; si < n; si++) { const c = row[si], s = M.series[si]; if (!c || !cbNum(c.v)) continue; const cx = x0 + band / 2 + (si - (n - 1) / 2) * step; const cc = n === 1 && M.colorBy === 'cat' ? C.colc(k, ci) : C.col(s, si);
          if (cbNum(c.lo) && cbNum(c.hi)) parts.push(`<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${Y(c.lo).toFixed(1)}" y2="${Y(c.hi).toFixed(1)}" stroke="${cc}" stroke-width="2.4"/><line x1="${(cx - 5).toFixed(1)}" x2="${(cx + 5).toFixed(1)}" y1="${Y(c.lo).toFixed(1)}" y2="${Y(c.lo).toFixed(1)}" stroke="${cc}" stroke-width="1.6"/><line x1="${(cx - 5).toFixed(1)}" x2="${(cx + 5).toFixed(1)}" y1="${Y(c.hi).toFixed(1)}" y2="${Y(c.hi).toFixed(1)}" stroke="${cc}" stroke-width="1.6"/>`);
          if (M.mode === 'dot') parts.push(`<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${Y(Math.max(vr[0], 0)).toFixed(1)}" y2="${Y(c.v).toFixed(1)}" stroke="${cc}" stroke-width="1.5" stroke-opacity=".5"/>`);
          parts.push(`<circle cx="${cx.toFixed(1)}" cy="${Y(c.v).toFixed(1)}" r="${M.mode === 'dot' ? 6 : 5}" fill="${cc}" stroke="#FFFFFF" stroke-width="1.5"><title>${cbEsc(C.nmc(k) + (n > 1 ? ' · ' + C.nm(s) : '') + ': ' + C.vfmt(c.v, pct) + (cbNum(c.lo) ? ' [' + C.vfmt(c.lo, pct) + ', ' + C.vfmt(c.hi, pct) + ']' : '') + (c.n != null ? ' (n = ' + c.n.toLocaleString('en-US') + ')' : ''))}</title></circle>`);
          if (showVals) parts.push(C.T(cx + 9, Y(c.v) + 4, C.vfmt(c.v, pct), `fill="${CBC.ink}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke"`, C.F.val, false, 700)); }
      }
      // category label
      if (rot) parts.push(C.T(x0 + band / 2, T + PH + 14, C.nmc(k).length > 28 ? C.nmc(k).slice(0, 27) + '…' : C.nmc(k), `text-anchor="end" transform="rotate(-35 ${(x0 + band / 2).toFixed(1)} ${(T + PH + 14).toFixed(1)})" fill="${CBC.ink}"`, C.F.lab));
      else labLines[ci].forEach((ln, li) => parts.push(C.T(x0 + band / 2, T + PH + 18 + li * (C.F.lab + 3), ln, `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab)));
    });
    parts.push(`<line x1="${L}" x2="${W - R}" y1="${(T + PH).toFixed(1)}" y2="${(T + PH).toFixed(1)}" stroke="${CBC.axis}"/>`);
    if (M.refLine != null && M.refLine >= vr[0] && M.refLine <= vr[1]) parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(M.refLine).toFixed(1)}" y2="${Y(M.refLine).toFixed(1)}" stroke="${CBC.mut}" stroke-dasharray="5 4"/>`);
    if (yTitle) parts.push(C.T(24 + C.F.lab * 0.4, T + PH / 2, yTitle, `text-anchor="middle" transform="rotate(-90 ${(24 + C.F.lab * 0.4).toFixed(1)} ${(T + PH / 2).toFixed(1)})" fill="${CBC.mut}"`, C.F.lab));
    if (xTitle) parts.push(C.T(L + (W - L - R) / 2, T + PH + labH + C.F.lab + 6, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
    if (showLeg && legendMode === 'bottom') parts.push(cbLegendRow(C, M.series, 24, H - foot.h - bottomLeg + C.F.leg, W));
    parts.push(cbFoot(C, M, W, H).markup);
    return cbSvg(C, W, H, parts, M);
  }
  // horizontal: categories down the side, values across
  const labW = Math.min(300, maxLab) + 12, foot = cbFoot(C, M, W, 0);
  const valW = showVals ? cbTextW(C.vfmt(vr[1], pct), C.F.val) + 14 : 10;
  const L = 24 + labW, R = 24 + valW, rowH = Math.max(C.F.lab + 12, multi && M.mode === 'group' ? nS * 14 + 10 : 26);
  const bottomLeg = showLeg && legendMode === 'bottom' ? Math.ceil(nS / 4) * (C.F.leg + 10) + 8 : 0;
  const H = C.SZ ? C.SZ[1] : Math.round(head.h + 16 + nC * rowH + 34 + foot.h + (xTitle ? C.F.lab + 12 : 0) + bottomLeg);
  const T = head.h + 8, B = 30 + foot.h + (xTitle ? C.F.lab + 12 : 0) + bottomLeg, PH = H - T - B, rh = PH / nC, PW = W - L - R;
  const X = v => L + (v - vr[0]) / (vr[1] - vr[0]) * PW;
  ticks.forEach(t => { if (o.grid !== false) parts.push(`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${T}" y2="${(T + PH).toFixed(1)}" stroke="${t === 0 ? CBC.axis : CBC.grid}"/>`); parts.push(C.T(X(t), T + PH + 18, M.mode === 'diverge' ? Math.abs(t) + '%' : tickFmt(t, ticks, false, { pct, fmt: o.fmt }), `text-anchor="middle" fill="${CBC.mut}"`, C.F.tick, true)); });
  cats.forEach((k, ci) => {
    const y0 = T + ci * rh, row = M.vals[ci] || [], cy = y0 + rh / 2;
    parts.push(C.T(L - 10, cy + C.F.lab * 0.35, C.nmc(k).length > 46 ? C.nmc(k).slice(0, 45) + '…' : C.nmc(k), `text-anchor="end" fill="${CBC.ink}"`, C.F.lab));
    if (M.mode === 'stack' || M.mode === 'stack100' || M.mode === 'diverge') {
      const bh = Math.min(rh * 0.7, 34); let run = M.mode === 'diverge' ? -M.series.reduce((s, _, si) => s + (si < M.neutral ? (row[si]?.v || 0) : si === M.neutral ? (row[si]?.v || 0) / 2 : 0), 0) : 0;
      M.series.forEach((s, si) => { const c = row[si]; if (!c || !(c.v > 0)) return; const x1 = X(run), x2 = X(run + c.v); parts.push(`<rect x="${x1.toFixed(1)}" y="${(cy - bh / 2).toFixed(1)}" width="${Math.max(0, x2 - x1).toFixed(1)}" height="${bh.toFixed(1)}" fill="${C.fill(s, si)}" stroke="#FFFFFF" stroke-width="1"><title>${cbEsc(C.nmc(k) + ' · ' + C.nm(s) + ': ' + C.vfmt(c.v, pct))}</title></rect>`); if (showVals && C.values !== 'total' && x2 - x1 > cbTextW(C.vfmt(c.v, pct), C.F.val) + 6) parts.push(C.T((x1 + x2) / 2, cy + C.F.val * 0.35, C.vfmt(c.v, pct), `text-anchor="middle" fill="${cbInk(C.col(s, si))}"`, C.F.val, false, 700)); run += c.v; });
      if (showVals && (C.values === 'total' || C.values === 'all') && M.mode === 'stack') parts.push(C.T(X(run) + 6, cy + C.F.val * 0.35, C.vfmt(run, pct), `fill="${CBC.ink}"`, C.F.val, false, 700));
    } else if (M.mode === 'group' || M.mode === 'single') {
      const n = M.mode === 'single' ? 1 : nS, gh = Math.min(rh * 0.78, n * 22), bh = gh / n, gy = cy - gh / 2;
      for (let si = 0; si < n; si++) { const c = row[si], s = M.series[si]; if (!c || !cbNum(c.v)) continue; const x1 = X(Math.min(0, c.v)), x2 = X(Math.max(0, c.v)); const byCat = M.mode === 'single' && M.colorBy === 'cat'; parts.push(`<rect x="${x1.toFixed(1)}" y="${(gy + si * bh + 1).toFixed(1)}" width="${Math.max(0.5, x2 - x1).toFixed(1)}" height="${Math.max(1, bh - 2).toFixed(1)}" fill="${byCat ? C.colc(k, ci) : C.fill(s, si)}"><title>${cbEsc(C.nmc(k) + (n > 1 ? ' · ' + C.nm(s) : '') + ': ' + C.vfmt(c.v, pct))}</title></rect>`); if (showVals) parts.push(C.T(x2 + 6, gy + si * bh + bh / 2 + C.F.val * 0.35, C.vfmt(c.v, pct), `fill="${CBC.ink}"`, Math.min(C.F.val, bh * 0.8 + 3), false, 700)); }
    } else {
      const n = nS, step = Math.min(rh * 0.6 / Math.max(1, n), 14);
      for (let si = 0; si < n; si++) { const c = row[si], s = M.series[si]; if (!c || !cbNum(c.v)) continue; const yy = cy + (si - (n - 1) / 2) * step, cc = n === 1 && M.colorBy === 'cat' ? C.colc(k, ci) : C.col(s, si);
        if (cbNum(c.lo) && cbNum(c.hi)) parts.push(`<line x1="${X(c.lo).toFixed(1)}" x2="${X(c.hi).toFixed(1)}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${cc}" stroke-width="2.4"/>`);
        if (M.mode === 'dot') parts.push(`<line x1="${X(Math.max(vr[0], 0)).toFixed(1)}" x2="${X(c.v).toFixed(1)}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${cc}" stroke-width="1.5" stroke-opacity=".5"/>`);
        parts.push(`<circle cx="${X(c.v).toFixed(1)}" cy="${yy.toFixed(1)}" r="${M.mode === 'dot' ? 6 : 5}" fill="${c.ref ? '#FFFFFF' : cc}" stroke="${c.ref ? cc : '#FFFFFF'}" stroke-width="1.5"><title>${cbEsc(C.nmc(k) + (n > 1 ? ' · ' + C.nm(s) : '') + ': ' + C.vfmt(c.v, pct) + (cbNum(c.lo) ? ' [' + C.vfmt(c.lo, pct) + ', ' + C.vfmt(c.hi, pct) + ']' : ''))}</title></circle>`);
        if (showVals) parts.push(C.T((cbNum(c.hi) ? X(c.hi) : X(c.v)) + 8, yy + C.F.val * 0.35, C.vfmt(c.v, pct), `fill="${CBC.ink}"`, C.F.val, false, 700)); }
    }
  });
  parts.push(`<line x1="${L}" x2="${L}" y1="${T}" y2="${(T + PH).toFixed(1)}" stroke="${CBC.axis}"/>`);
  if (M.refLine != null && M.refLine >= vr[0] && M.refLine <= vr[1]) parts.push(`<line x1="${X(M.refLine).toFixed(1)}" x2="${X(M.refLine).toFixed(1)}" y1="${T}" y2="${(T + PH).toFixed(1)}" stroke="${CBC.mut}" stroke-dasharray="5 4"/>`);
  if (M.mode === 'diverge') parts.push(`<line x1="${X(0).toFixed(1)}" x2="${X(0).toFixed(1)}" y1="${T - 4}" y2="${(T + PH + 4).toFixed(1)}" stroke="${CBC.ink}"/>`);
  if (xTitle) parts.push(C.T(L + PW / 2, T + PH + 22 + C.F.lab + 8, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
  if (showLeg && legendMode === 'bottom') parts.push(cbLegendRow(C, M.series, 24, H - foot.h - bottomLeg + C.F.leg, W));
  parts.push(cbFoot(C, M, W, H).markup);
  return cbSvg(C, W, H, parts, M);
}
function cbLegendRow(C, keys, x0, y, W) {
  const out = []; let x = x0;
  keys.forEach((k, i) => { const t = C.nm(k), w = 18 + cbTextW(t, C.F.leg) + 18; if (x + w > W - 16 && x > x0) { x = x0; y += C.F.leg + 10; } out.push(`<rect x="${x}" y="${(y - C.F.leg * 0.8).toFixed(1)}" width="12" height="12" rx="2.5" fill="${C.fill(k, i)}"/>`, C.T(x + 18, y + 1, t, `fill="${CBC.ink}"`, C.F.leg)); x += w; });
  return out.join('');
}
function cbInk(hex) { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#FFFFFF'; const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? CBC.ink : '#FFFFFF'; }

// ---- x/y: lines over time, areas, densities, survival steps, scatterplots, hexbins, estimates over x
function cbDrawXY(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 820;
  const series = M.series || [], keys = M.seriesKeys || series.map(s => s.key), multi = keys.length > 1;
  const legendMode = o.legend || 'auto', lineish = series.some(s => s.style === 'line' || s.style === 'area' || s.style === 'step');
  const endLabels = multi && lineish && (legendMode === 'end' || (legendMode === 'auto' && keys.length <= 10));
  const topLegend = multi && !endLabels && legendMode !== 'none' && legendMode !== 'bottom';
  const head = cbHead(C, M, W, topLegend ? keys : null);
  const foot = cbFoot(C, M, W, 0), xTitle = o.xTitle != null ? o.xTitle : M.xTitle || '', yTitle = o.yTitle != null ? o.yTitle : M.yTitle || '';
  const bottomLeg = multi && legendMode === 'bottom' ? Math.ceil(keys.length / 4) * (C.F.leg + 10) + 8 : 0;
  const H = C.SZ ? C.SZ[1] : Math.round(Math.max(440, head.h + 360 + foot.h + (xTitle ? C.F.lab + 16 : 0) + bottomLeg));
  // ranges
  const xs = [], ys = [];
  series.forEach(s => s.pts.forEach(p => { xs.push(p.x); ys.push(p.y); if (cbNum(p.lo)) ys.push(p.lo); if (cbNum(p.hi)) ys.push(p.hi); if (s.stackBase) ys.push(p.y0); }));
  (M.points || []).forEach(p => { xs.push(p.x); ys.push(p.y); });
  (M.bins || []).forEach(b => { xs.push(b.a, b.b); ys.push(b.c, 0); });
  if (M.hex) for (const p of M.hex.pts) { xs.push(p.x); ys.push(p.y); }
  if (M.xr) xs.push(...M.xr); if (M.yr) ys.push(...M.yr);
  const zero = o.zero != null ? !!o.zero : !!M.zero, logY = !!o.log && ys.every(v => !cbNum(v) || v > 0);
  let xr = cbRange(xs), yr = cbRange(ys, zero);
  if (M.xTime) { const pad = (xr[1] - xr[0]) * 0.03; xr = [xr[0] - pad, xr[1] + pad]; } else if (!M.xExact) { const pad = (xr[1] - xr[0]) * 0.02; xr = [xr[0] - pad, xr[1] + pad]; }
  if (!zero && !logY) { const pad = (yr[1] - yr[0]) * 0.06; yr = [yr[0] - pad, yr[1] + pad]; } else if (zero) yr = [yr[0], yr[1] + (yr[1] - yr[0]) * 0.04];
  xr = cbLimits(xr, o.xmin, o.xmax); yr = cbLimits(yr, o.ymin, o.ymax);
  const pct = !!M.pct;
  let yt = logY ? cbLogTicks(yr) : cbTicks(yr[0], yr[1], 5);
  if (!logY && o.ymax == null && yt.length > 1) { const st = yt[1] - yt[0]; if (yt[yt.length - 1] < yr[1] - st * 0.25) yt.push(Number((yt[yt.length - 1] + st).toPrecision(12))); yr = [Math.min(yr[0], yt[0]), Math.max(yr[1], yt[yt.length - 1])]; if (zero && yr[0] > 0) yr[0] = 0; }
  const tickW = Math.max(...yt.map(t => cbTextW(tickFmt(t, yt, false, { pct, fmt: o.fmt }), C.F.tick, true)), 20);
  const endW = endLabels ? Math.min(220, Math.max(...keys.map(k => cbTextW(C.nm(k), C.F.leg, false))) + 18) : 0;
  const lastVals = C.values !== 'none' ? cbTextW(C.vfmt(yr[1], pct), C.F.val) / 2 + 6 : 0;
  const L = 24 + (yTitle ? C.F.lab + 10 : 0) + tickW + 10, R = 24 + Math.max(endW, lastVals), T = head.h + 10, B = 30 + foot.h + (xTitle ? C.F.lab + 14 : 0) + bottomLeg, PW = W - L - R, PH = H - T - B;
  const X = x => L + (x - xr[0]) / (xr[1] - xr[0]) * PW;
  const Y = logY ? (y => T + PH - (Math.log10(y) - Math.log10(yr[0])) / (Math.log10(yr[1]) - Math.log10(yr[0])) * PH) : (y => T + PH - (y - yr[0]) / (yr[1] - yr[0]) * PH);
  const clip = (o.clipId || 'cb') + '-c';
  C.defs.push(`<clipPath id="${clip}"><rect x="${L - 6}" y="${T - 6}" width="${PW + 12}" height="${PH + 12}"/></clipPath>`);
  const parts = [head.markup], plot = [];
  yt.forEach(t => { if (t < yr[0] - 1e-9 || t > yr[1] + 1e-9) return; if (o.grid !== false) parts.push(`<line x1="${L}" x2="${L + PW}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${t === 0 ? CBC.axis : CBC.grid}"/>`); parts.push(C.T(L - 8, Y(t) + 4, tickFmt(t, yt, false, { pct, fmt: o.fmt }), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true)); });
  // x ticks: every observed time when asked (or few), otherwise round values
  let xt; const obsX = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].filter(cbNum).sort((a, b) => a - b);
  const xLab = t => M.xLabels && M.xLabels[t] != null ? String(M.xLabels[t]) : String(t);
  if (M.xTime && (o.everyX || (o.everyX == null && (obsX.length <= 16 || M.xLabels))) && obsX.length <= 60) { const fit = Math.max(1, Math.ceil(obsX.length * Math.max(...obsX.map(t => cbTextW(xLab(t), C.F.tick, true)), cbTextW('2000', C.F.tick, true)) * 1.4 / PW)); xt = obsX.filter((_, i) => i % fit === 0); }
  else xt = cbTicks(xr[0], xr[1], Math.max(3, Math.min(10, Math.floor(PW / 90))), !!M.xTime && obsX.every(Number.isInteger));
  xt.forEach(t => { if (t < xr[0] - 1e-9 || t > xr[1] + 1e-9) return; parts.push(C.T(X(t), T + PH + 20, M.xTime ? xLab(t) : tickFmt(t, xt, false, {}), `text-anchor="middle" fill="${CBC.mut}"`, C.F.tick, true)); });
  parts.push(`<line x1="${L}" x2="${L + PW}" y1="${(T + PH).toFixed(1)}" y2="${(T + PH).toFixed(1)}" stroke="${CBC.axis}"/>`);
  if (M.refY != null && M.refY >= yr[0] && M.refY <= yr[1]) plot.push(`<line x1="${L}" x2="${L + PW}" y1="${Y(M.refY).toFixed(1)}" y2="${Y(M.refY).toFixed(1)}" stroke="${CBC.mut}" stroke-dasharray="5 4"/>`);
  if (M.refX != null && M.refX >= xr[0] && M.refX <= xr[1]) plot.push(`<line x1="${X(M.refX).toFixed(1)}" x2="${X(M.refX).toFixed(1)}" y1="${T}" y2="${T + PH}" stroke="${CBC.mut}" stroke-dasharray="4 4"/>`);
  // hexbins
  if (M.hex) { const { cells, size, max } = cbHexLayout(M.hex.pts, X, Y, L, T, PW, PH); const base = C.col(keys[0] || 'All', 0); for (const c of cells) { const pts = Array.from({ length: 6 }, (_, i) => [(c.cx + size * Math.cos(Math.PI / 180 * (60 * i - 30))).toFixed(1), (c.cy + size * Math.sin(Math.PI / 180 * (60 * i - 30))).toFixed(1)]); plot.push(`<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${base}" fill-opacity="${(0.12 + 0.88 * c.n / max).toFixed(3)}" stroke="#FFFFFF" stroke-width=".4"><title>${cbEsc(cbFmt(c.n) + (M.hex.weighted ? ' weighted count' : ' observations'))}</title></polygon>`); } M.hexMax = max; }
  // histogram bars
  if (M.bins) { const key = (M.seriesKeys || ['All'])[0], c = C.fill(key, 0), tot = M.bins.reduce((t, b) => t + b.c, 0); M.bins.forEach(b => { const x1 = X(b.a), x2 = X(b.b), y1 = Y(b.c), y0 = Y(Math.max(yr[0], 0)); plot.push(`<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(0.5, x2 - x1 - 1).toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${c}"><title>${cbEsc(cbFmt(b.a) + ' to ' + cbFmt(b.b) + ': ' + C.vfmt(b.c, M.pct) + (M.pct ? '' : ' (' + cbFmt(100 * b.c / tot, { pct: true }) + ')'))}</title></rect>`); if (C.values !== 'none' && b.c > 0 && x2 - x1 > cbTextW(C.vfmt(b.c, M.pct), C.F.val) * 0.9) plot.push(C.T((x1 + x2) / 2, y1 - 5, C.vfmt(b.c, M.pct), `text-anchor="middle" fill="${CBC.ink}"`, C.F.val, false, 700)); }); }
  // scatter points
  if (M.points && M.points.length) { const r = M.points.length > 2000 ? 2.2 : M.points.length > 300 ? 3 : 4.2, op = M.points.length > 2000 ? 0.45 : M.points.length > 300 ? 0.65 : 0.85; for (const p of M.points) { const c = C.col(p.k, 0); plot.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r}" fill="${c}" fill-opacity="${op}"${p.t ? `><title>${cbEsc(p.t)}</title></circle>` : '/>'}`); } if (M.pointLabels) for (const p of M.points) if (p.lab) plot.push(C.T(X(p.x) + 6, Y(p.y) + 4, p.lab, `fill="${CBC.ink}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke"`, C.F.val)); }
  // series: bands first, then lines/areas, then markers and values
  series.forEach((s, si) => { if (!s.band) return; const pts = s.pts.filter(p => cbNum(p.lo) && cbNum(p.hi)); if (pts.length < 2) return; const d = 'M' + pts.map(p => X(p.x).toFixed(1) + ',' + Y(p.hi).toFixed(1)).join('L') + 'L' + pts.slice().reverse().map(p => X(p.x).toFixed(1) + ',' + Y(p.lo).toFixed(1)).join('L') + 'Z'; plot.push(`<path d="${d}" fill="${C.col(s.key, si)}" fill-opacity=".16" stroke="none"/>`); });
  series.forEach((s, si) => {
    const c = C.col(s.key, si), segs = s.segments || [s.pts];
    if (s.style === 'area') segs.forEach(seg => { if (seg.length < 2) return; const base = seg.map(p => cbNum(p.y0) ? p.y0 : Math.max(yr[0], 0)); const d = 'M' + seg.map(p => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('L') + 'L' + seg.slice().reverse().map((p, i) => X(p.x).toFixed(1) + ',' + Y(base[seg.length - 1 - i]).toFixed(1)).join('L') + 'Z'; plot.push(`<path d="${d}" fill="${C.fill(s.key, si)}" fill-opacity="${s.stacked ? 0.85 : 0.28}" stroke="none"/>`); });
    if (s.style === 'line' || s.style === 'area' || s.style === 'smooth') segs.forEach(seg => { if (seg.length < 2) return; plot.push(`<path d="M${seg.map(p => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('L')}" fill="none" stroke="${c}" stroke-width="${s.style === 'smooth' ? 3 : C.lw}" stroke-linejoin="round" stroke-linecap="round"${C.dash(s.key) ? ` stroke-dasharray="${C.dash(s.key)}"` : ''}/>`); });
    if (s.style === 'step') { let d = ''; s.pts.forEach((p, i) => { d += i ? ` H${X(p.x).toFixed(1)} V${Y(p.y).toFixed(1)}` : `M${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`; }); if (cbNum(s.endX)) d += ` H${X(s.endX).toFixed(1)}`; plot.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${C.lw}"/>`); (s.ticks || []).forEach(q => plot.push(`<line x1="${X(q.x).toFixed(1)}" x2="${X(q.x).toFixed(1)}" y1="${(Y(q.y) - 5).toFixed(1)}" y2="${(Y(q.y) + 5).toFixed(1)}" stroke="${c}" stroke-width="1.4"/>`)); }
    if (s.style === 'fit') plot.push(`<line x1="${X(s.pts[0].x).toFixed(1)}" y1="${Y(s.pts[0].y).toFixed(1)}" x2="${X(s.pts[s.pts.length - 1].x).toFixed(1)}" y2="${Y(s.pts[s.pts.length - 1].y).toFixed(1)}" stroke="${C.col(s.key, si) === CBC.dim ? CBC.dim : s.color || CBC.ink}" stroke-width="2.4"/>`);
    if (s.ciBars) s.pts.forEach(p => { if (cbNum(p.lo) && cbNum(p.hi)) plot.push(`<line x1="${X(p.x).toFixed(1)}" x2="${X(p.x).toFixed(1)}" y1="${Y(p.lo).toFixed(1)}" y2="${Y(p.hi).toFixed(1)}" stroke="${c}" stroke-width="2"/>`); });
    const markers = s.markers != null ? s.markers : (o.markers !== false && (s.style === 'line' || s.style === 'area') && s.pts.length <= 60);
    if (markers || s.ciBars) s.pts.forEach(p => plot.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${s.pts.length > 30 ? 3 : 4.2}" fill="${c}" stroke="#FFFFFF" stroke-width="1.4"><title>${cbEsc((multi ? C.nm(s.key) + ' · ' : '') + (M.xTime ? p.x : cbFmt(p.x)) + ': ' + C.vfmt(p.y, pct) + (cbNum(p.lo) ? ' [' + C.vfmt(p.lo, pct) + ', ' + C.vfmt(p.hi, pct) + ']' : '') + (p.n != null ? ' (n = ' + p.n.toLocaleString('en-US') + ')' : ''))}</title></circle>`));
  });
  // values on the chart
  const vk = o.valueKeys && o.valueKeys.length ? new Set(o.valueKeys.map(String)) : null;
  if (C.values !== 'none' && (lineish || series.some(s => s.ciBars))) {
    // labels at the same x are pushed apart: the lowest point's label goes under it, the rest stack above
    const byX = new Map();
    series.forEach((s, si) => {
      if (vk && !vk.has(String(s.key))) return; const n = s.pts.length;
      s.pts.forEach((p, i) => { const show = C.values === 'all' || ((C.values === 'last' || C.values === 'total') && i === n - 1) || (C.values === 'firstlast' && (i === 0 || i === n - 1)); if (!show || !cbNum(p.y)) return; const k = Math.round(X(p.x)); if (!byX.has(k)) byX.set(k, []); byX.get(k).push({ x: X(p.x), py: Y(p.y), v: p.y, s, si }); });
    });
    const gap = C.F.val + 2;
    for (const items of byX.values()) {
      items.sort((a, b) => a.py - b.py);
      // points closer than a label's height form a cluster: half its labels stack above it, half below
      const clusters = []; items.forEach(it => { const last = clusters[clusters.length - 1]; if (last && it.py - last[last.length - 1].py < gap + 4) last.push(it); else clusters.push([it]); });
      clusters.forEach(cl => {
        if (cl.length === 1) { cl[0].y = cl[0].py - 9; return; }
        const up = Math.ceil(cl.length / 2), top = cl[0].py, bot = cl[cl.length - 1].py;
        cl.forEach((it, j) => { it.y = j < up ? top - 9 - (up - 1 - j) * gap : bot + 9 + C.F.val * 0.8 + (j - up) * gap; });
      });
      items.forEach((it, j) => { it.ord = j; });
      cbSpread(items, gap, T + C.F.val, T + PH + C.F.val * 2);
      items.forEach(it => { const c = C.col(it.s.key, it.si); plot.push(C.T(it.x, it.ly, C.vfmt(it.v, pct), `text-anchor="middle" fill="${c === CBC.dim ? '#8C877B' : c}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke"`, C.F.val, false, 700)); });
    }
  }
  parts.push(`<g clip-path="url(#${clip})">${plot.join('')}</g>`);
  if (endLabels) { const items = series.filter(s => s.pts.length && s.style !== 'fit').map((s, si) => ({ k: s.key, si, y: Y(s.pts[s.pts.length - 1].y) })); cbSpread(items, C.F.leg + 3, T + 6, T + PH); items.forEach(it => parts.push(C.T(L + PW + 10, it.ly + C.F.leg * 0.35, C.nm(it.k), `fill="${C.col(it.k, it.si)}"`, C.F.leg, false, 700))); }
  if (yTitle) parts.push(C.T(24 + C.F.lab * 0.4, T + PH / 2, yTitle, `text-anchor="middle" transform="rotate(-90 ${(24 + C.F.lab * 0.4).toFixed(1)} ${(T + PH / 2).toFixed(1)})" fill="${CBC.mut}"`, C.F.lab));
  if (xTitle) parts.push(C.T(L + PW / 2, T + PH + 22 + C.F.lab + 8, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
  if (multi && legendMode === 'bottom') parts.push(cbLegendRow(C, keys, 24, H - foot.h - bottomLeg + C.F.leg, W));
  parts.push(cbFoot(C, M, W, H).markup);
  const out = cbSvg(C, W, H, parts, M); out.xr = xr; out.yr = yr; return out;
}
function cbLogTicks(yr) { const out = []; for (let e = Math.floor(Math.log10(yr[0])); e <= Math.ceil(Math.log10(yr[1])); e++) for (const m of [1, 2, 5]) { const v = m * Math.pow(10, e); if (v >= yr[0] * 0.999 && v <= yr[1] * 1.001) out.push(v); } return out; }
function cbHexLayout(pts, X, Y, L, T, PW, PH) {
  const size = 13, h = Math.sqrt(3) * size, m = new Map();
  for (const p of pts) { const px = X(p.x), py = Y(p.y); if (px < L || px > L + PW || py < T || py > T + PH) continue; const rr = Math.round((py - T) / (size * 1.5)), qq = Math.round((px - L) / h - (rr % 2) / 2), k = qq + ',' + rr; if (!m.has(k)) m.set(k, { cx: L + (qq + (rr % 2) / 2) * h, cy: T + rr * size * 1.5, n: 0 }); m.get(k).n += p.w || 1; }
  const cells = [...m.values()]; return { cells, size, max: Math.max(1, ...cells.map(c => c.n)) };
}

// ---- pies and donuts: one or more panels share one legend
function cbDrawPie(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 820, panels = M.panels, nP = panels.length;
  const legendMode = o.legend || 'auto', keys = M.seriesKeys;
  const head = cbHead(C, M, W, legendMode === 'none' ? null : keys);
  const foot = cbFoot(C, M, W, 0), cols = nP <= 3 ? nP : nP === 4 ? 2 : 3, rows = Math.ceil(nP / cols);
  const cellW = (W - 48) / cols, cellH = Math.min(330, Math.max(240, cellW * 0.74));
  const H = C.SZ ? C.SZ[1] : Math.round(head.h + rows * cellH + foot.h + 16);
  const parts = [head.markup], lab = o.sliceLabels || M.sliceLabels || 'percent';
  panels.forEach((P, pi) => {
    const col = pi % cols, row = Math.floor(pi / cols), cx = 24 + col * cellW + cellW / 2, top = head.h + 6 + row * cellH;
    const R = Math.max(50, Math.min(cellW * 0.3, (cellH - (nP > 1 ? 40 : 14)) * 0.36)), cy = top + (nP > 1 ? 32 : 10) + R + 26, r0 = M.donut ? R * 0.56 : 0;
    if (nP > 1 || P.title) parts.push(C.T(cx, top + 22, C.nmp(P.key), `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab * 1.15, false, 700));
    let a0 = -Math.PI / 2; const total = P.total;
    P.slices.forEach(sl => {
      const i = keys.indexOf(sl.k), frac = total > 0 ? sl.v / total : 0, a1 = a0 + frac * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0, c = C.fill(sl.k, i);
      const pt = (rad, a) => (cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2);
      const title = C.nm(sl.k) + ': ' + cbFmt(sl.v) + ' (' + cbFmt(100 * frac, { pct: true, decimals: o.decimals ?? 1 }) + ')';
      if (frac > 0.9999) parts.push(r0 ? `<circle cx="${cx}" cy="${cy}" r="${(R + r0) / 2}" fill="none" stroke="${c}" stroke-width="${R - r0}"><title>${cbEsc(title)}</title></circle>` : `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}"><title>${cbEsc(title)}</title></circle>`);
      else if (frac > 0) parts.push(`<path d="M${pt(R, a0)} A${R},${R} 0 ${large} 1 ${pt(R, a1)} ${r0 ? `L${pt(r0, a1)} A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)}` : `L${cx},${cy}`} Z" fill="${c}" stroke="#FFFFFF" stroke-width="2"><title>${cbEsc(title)}</title></path>`);
      if (lab !== 'none' && frac >= 0.025) { const am = (a0 + a1) / 2, lx = cx + (R + 14) * Math.cos(am), ly = cy + (R + 14) * Math.sin(am); const t = lab === 'count' ? cbFmt(sl.v) : lab === 'both' ? cbFmt(100 * frac, { pct: true, decimals: o.decimals ?? 1 }) + ' · ' + cbFmt(sl.v) : lab === 'name' ? C.nm(sl.k) + ' ' + cbFmt(100 * frac, { pct: true, decimals: o.decimals ?? 1 }) : cbFmt(100 * frac, { pct: true, decimals: o.decimals ?? 1 }); parts.push(C.T(lx, ly + C.F.val * 0.4, t, `text-anchor="${Math.cos(am) > 0.15 ? 'start' : Math.cos(am) < -0.15 ? 'end' : 'middle'}" fill="${CBC.ink}"`, C.F.val * 1.12, false, 800)); }
      a0 = a1;
    });
    if (M.donut) { parts.push(C.T(cx, cy - 2, 'n = ' + cbFmt(total), `text-anchor="middle" fill="${CBC.mut}"`, C.F.tick, true)); }
  });
  parts.push(foot.markup ? cbFoot(C, M, W, H).markup : '');
  return cbSvg(C, W, H, parts, M);
}

// ---- box plots (one or several) and violins
function cbDrawBox(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 820, G = M.groups, n = G.length, keys = M.seriesKeys || G.map(g => g.key);
  const head = cbHead(C, M, W, null), foot = cbFoot(C, M, W, 0);
  const xTitle = o.xTitle != null ? o.xTitle : M.xTitle || '', yTitle = o.yTitle != null ? o.yTitle : M.yTitle || '';
  const horizontal = n === 1 && !M.violin;
  const vals = []; G.forEach(g => { vals.push(g.wlo, g.whi, g.lo, g.hi); (g.out || []).forEach(v => vals.push(v)); if (g.curve) g.curve.forEach(q => vals.push(q.x)); });
  let vr = cbRange(vals, o.zero === true); const pad = (vr[1] - vr[0]) * 0.05; vr = cbLimits([vr[0] - pad, vr[1] + pad], horizontal ? o.xmin : o.ymin, horizontal ? o.xmax : o.ymax);
  const ticks = cbTicks(vr[0], vr[1], 6), parts = [head.markup];
  if (horizontal) {
    const H = C.SZ ? C.SZ[1] : Math.round(head.h + 200 + foot.h + (xTitle ? C.F.lab + 14 : 0)), L = 40, R = 40, T = head.h + 20, PW = W - L - R, B = 34 + foot.h + (xTitle ? C.F.lab + 14 : 0), PH = H - T - B, cy = T + PH / 2, bh = Math.min(70, PH * 0.5);
    const X = v => L + (v - vr[0]) / (vr[1] - vr[0]) * PW, g = G[0], c = C.col(g.key, 0);
    ticks.forEach(t => { parts.push(`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${T}" y2="${T + PH}" stroke="${CBC.grid}"/>`, C.T(X(t), T + PH + 18, tickFmt(t, ticks, false, {}), `text-anchor="middle" fill="${CBC.mut}"`, C.F.tick, true)); });
    parts.push(cbBoxShape(C, g, c, v => X(v), cy, bh, true));
    if (C.values !== 'none') [['min', g.wlo], ['Q1', g.q1], ['median', g.med], ['Q3', g.q3], ['max', g.whi]].forEach(([k, v], i) => parts.push(C.T(X(v), cy - bh / 2 - 8 - (i % 2) * (C.F.val + 2), k + ' ' + cbFmt(v), `text-anchor="middle" fill="${CBC.ink}"`, C.F.val, false, 700)));
    if (xTitle) parts.push(C.T(L + PW / 2, T + PH + 22 + C.F.lab + 6, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
    parts.push(cbFoot(C, M, W, H).markup);
    return cbSvg(C, W, H, parts, M);
  }
  const H = C.SZ ? C.SZ[1] : Math.round(Math.max(440, head.h + 360 + foot.h)), tickW = Math.max(...ticks.map(t => cbTextW(tickFmt(t, ticks, false, {}), C.F.tick, true)), 20);
  const L = 24 + (yTitle ? C.F.lab + 10 : 0) + tickW + 10, R = 24, band = (W - L - R) / n;
  const labLines = G.map(g => cbWrap(C.nm(g.key), band - 6, C.F.lab, 2)), rot = band < 40;
  const labH = rot ? 90 : Math.max(...labLines.map(l => l.length)) * (C.F.lab + 3) + 8 + (M.showN ? C.F.tick + 2 : 0);
  const T = head.h + 10, B = labH + foot.h + (xTitle ? C.F.lab + 14 : 0) + 8, PH = H - T - B, Y = v => T + PH - (v - vr[0]) / (vr[1] - vr[0]) * PH;
  ticks.forEach(t => { if (o.grid !== false) parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${CBC.grid}"/>`); parts.push(C.T(L - 8, Y(t) + 4, tickFmt(t, ticks, false, {}), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true)); });
  G.forEach((g, i) => {
    const cx = L + (i + 0.5) * band, c = C.col(g.key, i);
    if (M.violin && g.curve) { const peak = Math.max(...g.curve.map(q => q.y)) || 1, hw = band * 0.4; const pts = g.curve.map(q => [cx + hw * q.y / peak, Y(q.x)]).concat(g.curve.slice().reverse().map(q => [cx - hw * q.y / peak, Y(q.x)])); parts.push(`<path d="M${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L')}Z" fill="${C.fill(g.key, i)}" fill-opacity=".55" stroke="${c}"><title>${cbEsc(C.nm(g.key) + ': mean ' + cbFmt(g.mean) + ', n = ' + g.n)}</title></path>`); (g.pointsY || []).forEach((y, j) => parts.push(`<circle cx="${(cx + ((j * 137 % 101) / 100 - 0.5) * hw * 0.7).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="1.8" fill="${CBC.ink}" fill-opacity=".55"/>`)); parts.push(`<line x1="${(cx - hw * 0.35).toFixed(1)}" x2="${(cx + hw * 0.35).toFixed(1)}" y1="${Y(g.med ?? g.mean).toFixed(1)}" y2="${Y(g.med ?? g.mean).toFixed(1)}" stroke="${CBC.ink}" stroke-width="2"/>`); }
    else parts.push(cbBoxShape(C, g, c, v => Y(v), cx, Math.min(band * 0.55, 80), false));
    if (C.values !== 'none' && cbNum(g.med)) parts.push(C.T(cx + Math.min(band * 0.55, 80) / 2 + 4, Y(g.med) + 4, cbFmt(g.med), `fill="${CBC.ink}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke"`, C.F.val, false, 700));
    if (rot) parts.push(C.T(cx, T + PH + 14, C.nm(g.key), `text-anchor="end" transform="rotate(-35 ${cx.toFixed(1)} ${(T + PH + 14).toFixed(1)})" fill="${CBC.ink}"`, C.F.lab));
    else labLines[i].forEach((ln, li) => parts.push(C.T(cx, T + PH + 18 + li * (C.F.lab + 3), ln, `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab)));
    if (M.showN && !rot) parts.push(C.T(cx, T + PH + 18 + labLines[i].length * (C.F.lab + 3), 'n = ' + cbFmt(g.n), `text-anchor="middle" fill="${CBC.soft}"`, C.F.tick * 0.92, true));
  });
  parts.push(`<line x1="${L}" x2="${W - R}" y1="${(T + PH).toFixed(1)}" y2="${(T + PH).toFixed(1)}" stroke="${CBC.axis}"/>`);
  if (yTitle) parts.push(C.T(24 + C.F.lab * 0.4, T + PH / 2, yTitle, `text-anchor="middle" transform="rotate(-90 ${(24 + C.F.lab * 0.4).toFixed(1)} ${(T + PH / 2).toFixed(1)})" fill="${CBC.mut}"`, C.F.lab));
  if (xTitle) parts.push(C.T(L + (W - L - R) / 2, T + PH + labH + C.F.lab, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
  parts.push(cbFoot(C, M, W, H).markup);
  return cbSvg(C, W, H, parts, M);
}
function cbBoxShape(C, g, c, P, mid, bh, horizontal) {
  const out = [], title = cbEsc(C.nm(g.key) + ': median ' + cbFmt(g.med) + ', quartiles ' + cbFmt(g.q1) + '–' + cbFmt(g.q3) + ', n = ' + (g.n ?? '').toLocaleString('en-US'));
  const L = (a1, b1, a2, b2, w = 1.6) => horizontal ? `<line x1="${P(a1).toFixed(1)}" x2="${P(a2).toFixed(1)}" y1="${(mid + b1).toFixed(1)}" y2="${(mid + b2).toFixed(1)}" stroke="${CBC.ink}" stroke-width="${w}"/>` : `<line y1="${P(a1).toFixed(1)}" y2="${P(a2).toFixed(1)}" x1="${(mid + b1).toFixed(1)}" x2="${(mid + b2).toFixed(1)}" stroke="${CBC.ink}" stroke-width="${w}"/>`;
  out.push(L(g.wlo, 0, g.q1, 0), L(g.q3, 0, g.whi, 0), L(g.wlo, -bh * 0.25, g.wlo, bh * 0.25), L(g.whi, -bh * 0.25, g.whi, bh * 0.25));
  const a = P(g.q1), b = P(g.q3);
  out.push(horizontal ? `<rect x="${Math.min(a, b).toFixed(1)}" y="${(mid - bh / 2).toFixed(1)}" width="${Math.abs(b - a).toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="1.6"><title>${title}</title></rect>` : `<rect y="${Math.min(a, b).toFixed(1)}" x="${(mid - bh / 2).toFixed(1)}" height="${Math.abs(b - a).toFixed(1)}" width="${bh.toFixed(1)}" rx="4" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="1.6"><title>${title}</title></rect>`);
  out.push(L(g.med, -bh / 2, g.med, bh / 2, 2.6));
  if (cbNum(g.mean)) out.push(horizontal ? `<path d="M${P(g.mean).toFixed(1)},${(mid - 5).toFixed(1)} l5,5 l-5,5 l-5,-5Z" fill="#FFFFFF" stroke="${CBC.ink}"/>` : `<path d="M${(mid - 5).toFixed(1)},${P(g.mean).toFixed(1)} l5,-5 l5,5 l-5,5Z" fill="#FFFFFF" stroke="${CBC.ink}"/>`);
  (g.out || []).forEach(v => out.push(horizontal ? `<circle cx="${P(v).toFixed(1)}" cy="${mid}" r="3" fill="none" stroke="${c}" stroke-opacity=".75"/>` : `<circle cy="${P(v).toFixed(1)}" cx="${mid}" r="3" fill="none" stroke="${c}" stroke-opacity=".75"/>`));
  return out.join('');
}

// ---- heat maps and correlation matrices
function cbDrawGrid(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 820, xs = M.xs, ys = M.ys, head = cbHead(C, M, W, null), foot = cbFoot(C, M, W, 0);
  const labW = Math.min(240, Math.max(...ys.map(k => cbTextW(C.nm(k), C.F.lab)), 20)) + 14, L = 24 + labW, R = 24;
  const cw = (W - L - R) / xs.length, rot = xs.some(k => cbTextW(C.nmc(k), C.F.lab) > cw - 6), labH = rot ? Math.min(140, Math.max(...xs.map(k => cbTextW(C.nmc(k), C.F.lab))) * 0.72 + 16) : C.F.lab + 14;
  const xTitle = o.xTitle != null ? o.xTitle : M.xTitle || '', yTitle = o.yTitle != null ? o.yTitle : M.yTitle || '', xtH = xTitle ? C.F.lab + 12 : 0;
  const ch = Math.max(22, Math.min(64, cw * 0.75)), T = head.h + 10 + (yTitle ? C.F.lab + 8 : 0), PH = ch * ys.length;
  const H = C.SZ ? C.SZ[1] : Math.round(T + PH + labH + xtH + 40 + foot.h), parts = [head.markup];
  if (yTitle) parts.push(C.T(L - 8, T - 8, yTitle, `text-anchor="end" fill="${CBC.mut}"`, C.F.lab, false, 700));
  if (xTitle) parts.push(C.T(L + (W - L - R) / 2, T + PH + labH + C.F.lab, xTitle, `text-anchor="middle" fill="${CBC.mut}"`, C.F.lab));
  const base = C.col(M.seriesKeys ? M.seriesKeys[0] : 'All', 0), [lo, hi] = M.range;
  const colOf = v => M.diverging ? cbDiv((v - lo) / (hi - lo), o.palette) : cbMix('#F4F7F5', base, (v - lo) / (hi - lo || 1));
  M.cells.forEach(c => { const xi = xs.indexOf(c.x), yi = ys.indexOf(c.y), x = L + xi * cw, y = T + yi * ch, fc = colOf(c.v); parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${fc}" stroke="#FFFFFF" stroke-width="${cw < 12 ? 0.4 : 1.5}"><title>${cbEsc(C.nm(c.y) + ' · ' + C.nmc(c.x) + ': ' + cbFmt(c.v, { decimals: o.decimals ?? (M.diverging ? 2 : null) }) + (c.n != null ? ' (n = ' + c.n + ')' : ''))}</title></rect>`); if (C.values !== 'none' || M.labels !== false) if (cw > 26) parts.push(C.T(x + cw / 2, y + ch / 2 + C.F.val * 0.35, cbFmt(c.v, { decimals: o.decimals ?? (M.diverging ? 2 : null), fmt: o.fmt }), `text-anchor="middle" fill="${cbInk(fc)}"`, Math.min(C.F.val, cw * 0.3), false, 700)); });
  ys.forEach((k, i) => parts.push(C.T(L - 8, T + (i + 0.5) * ch + C.F.lab * 0.35, C.nm(k), `text-anchor="end" fill="${CBC.ink}"`, C.F.lab)));
  const every = Math.max(1, Math.ceil((C.F.lab + 4) / cw));
  xs.forEach((k, i) => { if (rot && i % every) return; const x = L + (i + 0.5) * cw; parts.push(rot ? C.T(x, T + PH + 14, C.nmc(k), `text-anchor="end" transform="rotate(-35 ${x.toFixed(1)} ${(T + PH + 14).toFixed(1)})" fill="${CBC.ink}"`, C.F.lab) : C.T(x, T + PH + 18, C.nmc(k), `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab)); });
  // color key
  const ky = T + PH + labH + xtH + 10; for (let i = 0; i < 40; i++) parts.push(`<rect x="${(L + i * 5).toFixed(1)}" y="${ky}" width="5.4" height="10" fill="${colOf(lo + (hi - lo) * i / 39)}"/>`);
  parts.push(C.T(L, ky + 24, cbFmt(lo), `fill="${CBC.mut}"`, C.F.tick, true), C.T(L + 200, ky + 24, cbFmt(hi), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true));
  if (M.valueTitle) parts.push(C.T(L + 212, ky + 9, M.valueTitle, `fill="${CBC.mut}"`, C.F.tick));
  parts.push(cbFoot(C, M, W, H).markup);
  return cbSvg(C, W, H, parts, M);
}
function cbMix(a, b, t) { t = Math.max(0, Math.min(1, t)); const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const A = p(a), B = p(/^#[0-9a-f]{6}$/i.test(b) ? b : '#2E7D58'); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function cbDiv(t, pal) { const a = '#B0572F', m = '#F7F4EE', b = (pal && pal[0]) || '#2E7D58'; return t < 0.5 ? cbMix(a, m, t * 2) : cbMix(m, b, (t - 0.5) * 2); }

// ---- dumbbell, slope and before/after
function cbDrawPair(C, M) {
  const o = C.o, W = C.SZ ? C.SZ[0] : 820, pts = M.pts, names = M.names;
  const head = cbHead(C, M, W, M.kind === 'dumbbell' ? ['__first', '__second'] : null);
  const foot = cbFoot(C, M, W, 0), parts = [head.markup];
  const vr0 = cbRange(pts.flatMap(p => [p.before, p.after])), pad = (vr0[1] - vr0[0]) * 0.08;
  if (M.kind === 'dumbbell') {
    const vr = cbLimits([vr0[0] - pad, vr0[1] + pad], o.xmin, o.xmax), labW = Math.min(260, Math.max(...pts.map(p => cbTextW(C.nmc(p.label), C.F.lab)), 20)) + 14;
    const rowH = Math.max(C.F.lab + 12, 26), H = C.SZ ? C.SZ[1] : Math.round(head.h + 20 + pts.length * rowH + 40 + foot.h), L = 24 + labW, R = 40, T = head.h + 10, PH = H - T - 34 - foot.h, rh = PH / pts.length;
    const X = v => L + (v - vr[0]) / (vr[1] - vr[0]) * (W - L - R), ticks = cbTicks(vr[0], vr[1], 6), c1 = C.col('__first', 0), c2 = C.col('__second', 1);
    ticks.forEach(t => parts.push(`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${T}" y2="${T + PH}" stroke="${CBC.grid}"/>`, C.T(X(t), T + PH + 18, tickFmt(t, ticks, false, {}), `text-anchor="middle" fill="${CBC.mut}"`, C.F.tick, true)));
    pts.forEach((p, i) => { const y = T + (i + 0.5) * rh; parts.push(C.T(L - 10, y + C.F.lab * 0.35, C.nmc(p.label), `text-anchor="end" fill="${CBC.ink}"`, C.F.lab), `<line x1="${X(p.before).toFixed(1)}" x2="${X(p.after).toFixed(1)}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#9A917F" stroke-width="3"/>`, `<circle cx="${X(p.before).toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c1}" stroke="#FFFFFF" stroke-width="1.5"><title>${cbEsc(C.nmc(p.label) + ' · ' + C.nm('__first') + ': ' + cbFmt(p.before))}</title></circle>`, `<circle cx="${X(p.after).toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c2}" stroke="#FFFFFF" stroke-width="1.5"><title>${cbEsc(C.nmc(p.label) + ' · ' + C.nm('__second') + ': ' + cbFmt(p.after))}</title></circle>`); if (C.values !== 'none') { const left = p.before <= p.after; parts.push(C.T(X(p.before) + (left ? -10 : 10), y + 4, cbFmt(p.before), `text-anchor="${left ? 'end' : 'start'}" fill="${CBC.ink}"`, C.F.val), C.T(X(p.after) + (left ? 10 : -10), y + 4, cbFmt(p.after), `text-anchor="${left ? 'start' : 'end'}" fill="${CBC.ink}"`, C.F.val, false, 700)); } });
    parts.push(cbFoot(C, M, W, H).markup);
    return cbSvg(C, W, H, parts, M);
  }
  const H = C.SZ ? C.SZ[1] : Math.round(Math.max(480, head.h + 400 + foot.h)), labR = M.kind === 'slope' ? Math.min(240, Math.max(...pts.map(p => cbTextW(C.nm(p.label) + (C.values !== 'none' ? ' 00.0' : ''), C.F.lab)), 20)) + 20 : 40;
  const vr = cbLimits([vr0[0] - pad, vr0[1] + pad], o.ymin, o.ymax), ticks = cbTicks(vr[0], vr[1], 5), tickW = Math.max(...ticks.map(t => cbTextW(tickFmt(t, ticks, false, {}), C.F.tick, true)), 20);
  const L = 24 + tickW + 14 + (M.kind === 'slope' && C.values !== 'none' ? 46 : 0), R = 24 + labR, T = head.h + 14, PH = H - T - 50 - foot.h, x0 = L + 30, x1 = W - R - 10, Y = v => T + PH - (v - vr[0]) / (vr[1] - vr[0]) * PH;
  ticks.forEach(t => parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${CBC.grid}"/>`, C.T(L - 8, Y(t) + 4, tickFmt(t, ticks, false, {}), `text-anchor="end" fill="${CBC.mut}"`, C.F.tick, true)));
  parts.push(C.T(x0, T + PH + 24, C.nm('__first'), `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab, false, 700), C.T(x1, T + PH + 24, C.nm('__second'), `text-anchor="middle" fill="${CBC.ink}"`, C.F.lab, false, 700));
  if (M.kind === 'paired') {
    const shown = pts.filter((p, i) => i % Math.max(1, Math.ceil(pts.length / 2000)) === 0);
    shown.forEach(p => { const col = p.after > p.before ? '#357F93' : p.after < p.before ? '#B0572F' : '#8A8F86'; parts.push(`<line x1="${x0}" x2="${x1}" y1="${Y(p.before).toFixed(1)}" y2="${Y(p.after).toFixed(1)}" stroke="${col}" stroke-opacity="${pts.length > 200 ? 0.3 : 0.6}"/>`); });
    parts.push(`<line x1="${x0}" x2="${x1}" y1="${Y(M.meanBefore).toFixed(1)}" y2="${Y(M.meanAfter).toFixed(1)}" stroke="${CBC.ink}" stroke-width="4"/>`, `<circle cx="${x0}" cy="${Y(M.meanBefore).toFixed(1)}" r="6" fill="${CBC.ink}"/>`, `<circle cx="${x1}" cy="${Y(M.meanAfter).toFixed(1)}" r="6" fill="${CBC.ink}"/>`);
    if (C.values !== 'none') parts.push(C.T(x0 - 10, Y(M.meanBefore) + 4, cbFmt(M.meanBefore), `text-anchor="end" fill="${CBC.ink}"`, C.F.val, false, 700), C.T(x1 + 10, Y(M.meanAfter) + 4, cbFmt(M.meanAfter), `fill="${CBC.ink}"`, C.F.val, false, 700));
  } else {
    const ends = []; pts.forEach((p, i) => { const c = C.col(p.label, i); parts.push(`<line x1="${x0}" x2="${x1}" y1="${Y(p.before).toFixed(1)}" y2="${Y(p.after).toFixed(1)}" stroke="${c}" stroke-width="2.4"/>`, `<circle cx="${x0}" cy="${Y(p.before).toFixed(1)}" r="5" fill="${c}"><title>${cbEsc(C.nm(p.label) + ': ' + cbFmt(p.before))}</title></circle>`, `<circle cx="${x1}" cy="${Y(p.after).toFixed(1)}" r="5" fill="${c}"><title>${cbEsc(C.nm(p.label) + ': ' + cbFmt(p.after))}</title></circle>`); ends.push({ k: p.label, i, y: Y(p.after), v: p.after, b: p.before, yb: Y(p.before) }); });
    const gap = C.F.lab + 3, items = cbSpread(ends.map(e => Object.assign({}, e)), gap, T, T + PH);
    if (items.length * gap > PH + gap) { let last = -Infinity; items.forEach(e => { e.hide = e.y - last < gap; if (!e.hide) last = e.ly = e.y; }); }
    items.forEach(e => { if (e.hide) return; parts.push(C.T(x1 + 12, e.ly + C.F.lab * 0.35, C.nm(e.k) + (C.values !== 'none' ? ' ' + cbFmt(e.v) : ''), `fill="${C.col(e.k, e.i)}"`, C.F.lab, false, 700)); });
    if (C.values !== 'none') { const left = cbSpread(ends.map(e => ({ y: e.yb, v: e.b, k: e.k, i: e.i })), gap, T, T + PH); left.forEach(e => parts.push(C.T(x0 - 10, e.ly + C.F.val * 0.35, cbFmt(e.v), `text-anchor="end" fill="${C.col(e.k, e.i)}"`, C.F.val, false, 700))); }
    M.hidden = items.filter(e => e.hide).length;
  }
  parts.push(cbFoot(C, M, W, H).markup);
  return cbSvg(C, W, H, parts, M);
}

// ---- scatterplot matrix: scatter below the diagonal, correlations above, names on the diagonal
function cbDrawMatrix(C, M) {
  const o = C.o, k = M.vars.length, W = C.SZ ? C.SZ[0] : 820, head = cbHead(C, M, W, null), foot = cbFoot(C, M, W, 0);
  const L = 24, size = (W - 48) / k, H = C.SZ ? C.SZ[1] : Math.round(head.h + size * k + foot.h + 16), T = head.h + 6, parts = [head.markup], c = C.col(M.seriesKeys ? M.seriesKeys[0] : 'All', 0);
  M.vars.forEach((v, i) => M.vars.forEach((u, j) => {
    const x = L + j * size, y = T + i * size; parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${i === j ? '#F6F3EC' : '#FFFFFF'}" stroke="${CBC.grid}"/>`);
    if (i === j) { parts.push(C.T(x + size / 2, y + size / 2 + 5, C.nm(v), `text-anchor="middle" fill="${CBC.ink}"`, Math.min(C.F.lab * 1.1, size / Math.max(6, C.nm(v).length) * 1.6), false, 700)); return; }
    const cell = M.cells[i][j]; if (!cell) return;
    if (i > j) { const pad = 8, xr = M.ranges[j], yr = M.ranges[i]; const px = q => x + pad + (q - xr[0]) / (xr[1] - xr[0] || 1) * (size - 2 * pad), py = q => y + size - pad - (q - yr[0]) / (yr[1] - yr[0] || 1) * (size - 2 * pad); cell.pts.forEach(p => parts.push(`<circle cx="${px(p[0]).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="1.6" fill="${c}" fill-opacity=".5"/>`)); }
    else { const r = cell.r; parts.push(C.T(x + size / 2, y + size / 2 + 6, cbNum(r) ? 'r = ' + r.toFixed(2) : '—', `text-anchor="middle" fill="${cbNum(r) && Math.abs(r) > 0.3 ? CBC.ink : CBC.soft}"`, Math.min(C.F.lab * 1.25, size / 5), false, Math.abs(r) > 0.5 ? 800 : 500)); if (cbNum(cell.n)) parts.push(C.T(x + size / 2, y + size / 2 + 6 + C.F.tick + 4, 'n = ' + cbFmt(cell.n), `text-anchor="middle" fill="${CBC.soft}"`, Math.min(C.F.tick, size / 7), true)); }
  }));
  parts.push(cbFoot(C, M, W, H).markup);
  return cbSvg(C, W, H, parts, M);
}
