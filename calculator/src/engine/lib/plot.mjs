// Small SVG plotting layer for the built-in engine (replaces R's svg() device). Styling follows the R engine's
// par(): background #FFFEFA, ink #20362F, titles #194F39. pretty() reproduces R's axis/histogram breaks.

const INK = '#20362F', BG = '#FFFEFA', GRID = '#E3DCCE';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function pretty(lo, up, ndiv = 5, minN = Math.floor(ndiv / 3)) {
  const h = 1.5, h5 = 0.5 + 1.5 * h, eps = 1e-10; let dx = up - lo, cell, small;
  if (dx === 0 && up === 0) { cell = 1; small = true; }
  else { cell = Math.max(Math.abs(lo), Math.abs(up)); let U = 1 + (h5 >= 1.5 * h + 0.5 ? 1 / (1 + h) : 1.5 / (1 + h5)); U *= Math.max(1, ndiv) * 2.220446049250313e-16; small = dx < cell * U * 3; }
  if (small) { if (cell > 10) cell = 9 + cell / 10; cell *= 0.75; if (minN > 1) cell /= minN; } else { cell = dx; if (ndiv > 1) cell /= ndiv; }
  const base = Math.pow(10, Math.floor(Math.log10(cell))); let unit = base, ns;
  if ((ns = 2 * base) - cell < h * (cell - unit)) { unit = ns; if ((ns = 5 * base) - cell < h5 * (cell - unit)) { unit = ns; if ((ns = 10 * base) - cell < h * (cell - unit)) unit = ns; } }
  let nsI = Math.floor(lo / unit + eps), nu = Math.ceil(up / unit - eps);
  while (nsI * unit > lo + eps * unit) nsI--; while (nu * unit < up - eps * unit) nu++;
  let k = Math.floor(0.5 + nu - nsI);
  if (k < minN) { k = minN - k; if (nsI >= 0) { nu += Math.floor(k / 2); nsI -= Math.floor(k / 2) + k % 2; } else { nsI -= Math.floor(k / 2); nu += Math.floor(k / 2) + k % 2; } ndiv = minN; } else ndiv = k;
  const a = nsI * unit, b = nu * unit, out = []; for (let i = 0; i <= ndiv; i++) out.push(Number((a + (b - a) * i / ndiv).toPrecision(12)));
  return out;
}
export function histBreaks(x) { const v = x.filter(Number.isFinite), n = v.length, k = Math.ceil(Math.log2(n) + 1); return pretty(Math.min(...v), Math.max(...v), k, 1); }
export function histCounts(x, breaks) { const c = new Array(breaks.length - 1).fill(0); for (const v of x) { if (!Number.isFinite(v)) continue; let j = breaks.findIndex((b, i) => i > 0 && v <= b); if (j < 1) j = 1; c[j - 1]++; } return c; }
const fmtTick = v => { const a = Math.abs(v); if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1); return String(Number(v.toPrecision(6))); };
function withAlpha(color, alpha) { if (alpha === undefined || alpha >= 1) return { c: color, o: '' }; return { c: color, o: ' fill-opacity="' + alpha + '" stroke-opacity="' + alpha + '"' }; }

// layers: points | line | step | polygon | hline | vline | abline | rect | text | segments
export function svgPlot({ xlab = '', ylab = '', xlim, ylim, layers = [], legend = null, xcats = null, width = 648, height = 396, main = '' } = {}) {
  const pts = { x: [], y: [] };
  for (const L of layers) {
    if (L.type === 'hline') { pts.y.push(...[].concat(L.y)); continue; } if (L.type === 'vline') { pts.x.push(...[].concat(L.x)); continue; } if (L.type === 'abline') continue;
    if (L.type === 'rect') { pts.x.push(...L.x0, ...L.x1); pts.y.push(...L.y0, ...L.y1); continue; } if (L.type === 'segments') { pts.x.push(...L.x0, ...L.x1); pts.y.push(...L.y0, ...L.y1); continue; }
    if (L.x) pts.x.push(...L.x); if (L.y) pts.y.push(...L.y);
  }
  const fin = a => a.filter(Number.isFinite), rng = (a, def) => { const f = fin(a); if (!f.length) return def; let lo = Math.min(...f), hi = Math.max(...f); if (lo === hi) { lo -= 0.5; hi += 0.5; } return [lo, hi]; };
  let [x0, x1] = xlim || rng(pts.x, [0, 1]), [y0, y1] = ylim || rng(pts.y, [0, 1]);
  if (!xlim) { const pad = (x1 - x0) * 0.04; x0 -= pad; x1 += pad; } if (!ylim) { const pad = (y1 - y0) * 0.04; y0 -= pad; y1 += pad; }
  const m = { l: 70, r: 18, t: main ? 34 : 18, b: 54 }, W = width - m.l - m.r, H = height - m.t - m.b;
  const sx = v => m.l + (v - x0) / (x1 - x0) * W, sy = v => m.t + H - (v - y0) / (y1 - y0) * H;
  const o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" font-family="sans-serif">', '<rect width="100%" height="100%" fill="' + BG + '"/>'];
  if (main) o.push('<text x="' + (width / 2) + '" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#194F39">' + esc(main) + '</text>');
  const xt = xcats ? xcats.map((_, i) => i + 1) : pretty(x0, x1).filter(v => v >= x0 - 1e-9 && v <= x1 + 1e-9), yt = pretty(y0, y1).filter(v => v >= y0 - 1e-9 && v <= y1 + 1e-9);
  for (const v of yt) o.push('<line x1="' + m.l + '" x2="' + (m.l + W) + '" y1="' + sy(v).toFixed(1) + '" y2="' + sy(v).toFixed(1) + '" stroke="' + GRID + '" stroke-width="0.6"/>');
  o.push('<g clip-path="none">');
  for (const L of layers) {
    const col = L.color || INK, { c, o: op } = withAlpha(col, L.alpha), dash = L.dash ? ' stroke-dasharray="' + (L.dash === true ? '5 4' : L.dash) + '"' : '', lw = L.width || 1.4;
    if (L.type === 'points') for (let i = 0; i < L.x.length; i++) { if (!Number.isFinite(L.x[i]) || !Number.isFinite(L.y[i])) continue; o.push('<circle cx="' + sx(L.x[i]).toFixed(1) + '" cy="' + sy(L.y[i]).toFixed(1) + '" r="' + (L.size || 3) + '" fill="' + c + '"' + op + '/>'); }
    else if (L.type === 'line' || L.type === 'step') {
      let d = '', pen = false;
      for (let i = 0; i < L.x.length; i++) { const X = L.x[i], Y = L.y[i]; if (!Number.isFinite(X) || !Number.isFinite(Y)) { pen = false; continue; } if (L.type === 'step' && pen && i > 0) d += 'H' + sx(X).toFixed(1); d += (pen ? 'L' : 'M') + sx(X).toFixed(1) + ' ' + sy(Y).toFixed(1); pen = true; }
      if (L.type === 'step' && L.xend !== undefined && L.x.length) d += 'H' + sx(L.xend).toFixed(1);
      o.push('<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"' + dash + op + '/>');
    }
    else if (L.type === 'polygon') { const d = L.x.map((X, i) => (i ? 'L' : 'M') + sx(X).toFixed(1) + ' ' + sy(L.y[i]).toFixed(1)).join('') + 'Z'; o.push('<path d="' + d + '" fill="' + (L.fill || col) + '" fill-opacity="' + (L.alpha ?? 0.2) + '" stroke="none"/>'); }
    else if (L.type === 'hline') for (const v of [].concat(L.y)) o.push('<line x1="' + m.l + '" x2="' + (m.l + W) + '" y1="' + sy(v).toFixed(1) + '" y2="' + sy(v).toFixed(1) + '" stroke="' + c + '" stroke-width="' + lw + '"' + dash + '/>');
    else if (L.type === 'vline') for (const v of [].concat(L.x)) o.push('<line y1="' + m.t + '" y2="' + (m.t + H) + '" x1="' + sx(v).toFixed(1) + '" x2="' + sx(v).toFixed(1) + '" stroke="' + c + '" stroke-width="' + lw + '"' + dash + '/>');
    else if (L.type === 'abline') { const ya = L.a + L.b * x0, yb = L.a + L.b * x1; o.push('<line x1="' + sx(x0).toFixed(1) + '" x2="' + sx(x1).toFixed(1) + '" y1="' + sy(ya).toFixed(1) + '" y2="' + sy(yb).toFixed(1) + '" stroke="' + c + '" stroke-width="' + lw + '"' + dash + '/>'); }
    else if (L.type === 'rect') for (let i = 0; i < L.x0.length; i++) { const X = sx(Math.min(L.x0[i], L.x1[i])), Y = sy(Math.max(L.y0[i], L.y1[i])); o.push('<rect x="' + X.toFixed(1) + '" y="' + Y.toFixed(1) + '" width="' + Math.abs(sx(L.x1[i]) - sx(L.x0[i])).toFixed(1) + '" height="' + Math.abs(sy(L.y1[i]) - sy(L.y0[i])).toFixed(1) + '" fill="' + (L.fill || '#D6E8DD') + '" stroke="' + (L.stroke || '#194F39') + '" stroke-width="0.8"/>'); }
    else if (L.type === 'segments') for (let i = 0; i < L.x0.length; i++) o.push('<line x1="' + sx(L.x0[i]).toFixed(1) + '" x2="' + sx(L.x1[i]).toFixed(1) + '" y1="' + sy(L.y0[i]).toFixed(1) + '" y2="' + sy(L.y1[i]).toFixed(1) + '" stroke="' + c + '" stroke-width="' + lw + '"' + dash + '/>');
    else if (L.type === 'text') for (let i = 0; i < L.x.length; i++) o.push('<text x="' + sx(L.x[i]).toFixed(1) + '" y="' + sy(L.y[i]).toFixed(1) + '" font-size="' + (L.size || 11) + '" text-anchor="' + (L.anchor || 'middle') + '" fill="' + c + '">' + esc(L.labels[i]) + '</text>');
  }
  o.push('</g>');
  // axes (R's bty="o" box)
  o.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + W + '" height="' + H + '" fill="none" stroke="' + INK + '" stroke-width="1"/>');
  for (const v of xt) { const X = sx(v).toFixed(1); o.push('<line x1="' + X + '" x2="' + X + '" y1="' + (m.t + H) + '" y2="' + (m.t + H + 5) + '" stroke="' + INK + '"/>', '<text x="' + X + '" y="' + (m.t + H + 18) + '" font-size="11" text-anchor="middle" fill="' + INK + '">' + esc(xcats ? xcats[v - 1] : fmtTick(v)) + '</text>'); }
  for (const v of yt) { const Y = sy(v).toFixed(1); o.push('<line x1="' + (m.l - 5) + '" x2="' + m.l + '" y1="' + Y + '" y2="' + Y + '" stroke="' + INK + '"/>', '<text x="' + (m.l - 8) + '" y="' + (Number(Y) + 4) + '" font-size="11" text-anchor="end" fill="' + INK + '">' + esc(fmtTick(v)) + '</text>'); }
  if (xlab) o.push('<text x="' + (m.l + W / 2) + '" y="' + (height - 12) + '" font-size="12" text-anchor="middle" fill="' + INK + '">' + esc(xlab) + '</text>');
  if (ylab) o.push('<text transform="translate(16,' + (m.t + H / 2) + ') rotate(-90)" font-size="12" text-anchor="middle" fill="' + INK + '">' + esc(ylab) + '</text>');
  if (legend && legend.length) { let ly = m.t + 14; for (const it of legend) { o.push('<line x1="' + (m.l + 12) + '" x2="' + (m.l + 34) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '" stroke="' + (it.color || INK) + '" stroke-width="2"' + (it.dash ? ' stroke-dasharray="5 4"' : '') + '/>', '<text x="' + (m.l + 40) + '" y="' + ly + '" font-size="11" fill="' + INK + '">' + esc(it.label) + '</text>'); ly += 16; } }
  o.push('</svg>');
  return o.join('');
}
// normal Q–Q coordinates as qqnorm(): ppoints(n) quantiles against sorted values; qqline through quartiles
export function qqData(r, qnorm) {
  const v = r.filter(Number.isFinite).slice().sort((a, b) => a - b), n = v.length, a = n <= 10 ? 3 / 8 : 1 / 2, th = v.map((_, i) => qnorm((i + 1 - a) / (n + 1 - 2 * a)));
  const q = p => { const h = (n - 1) * p, lo = Math.floor(h); return v[lo] + (h - lo) * ((v[Math.min(lo + 1, n - 1)]) - v[lo]); };
  const y1 = q(0.25), y2 = q(0.75), x1 = qnorm(0.25), x2 = qnorm(0.75), slope = (y2 - y1) / (x2 - x1);
  return { theoretical: th, sample: v, intercept: y1 - slope * x1, slope };
}
