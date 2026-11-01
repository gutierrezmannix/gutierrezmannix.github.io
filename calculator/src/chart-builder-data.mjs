// ---- GM26 chart builder: models (what to draw) from the data; the statistics are the chart suite's own
// (csSummary, csWilson, csSurvival, kde, csSegments) and the legacy charts' (descNum bins and quartiles, corr fit).
const cbU = (rs, k) => [...new Set(rs.map(r => r[k]))];
const cbNatural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const cbCap = (keys, what) => { if (keys.length > 40) throw Error('This chart shows up to 40 ' + (what || 'categories') + ' — filter or recode the data to reduce them.'); };

// amounts by category (and by a split variable): count, percent, mean or sum, weighted
export function cbAggCat(x, s, y, w, mask, o = {}) {
  const stat = o.stat || 'count', useS = !!(s && s.length), m = new Map(), sk = new Set(); let eligible = 0, used = 0;
  for (let i = 0; i < x.length; i++) {
    if (mask && !mask[i]) continue; eligible++;
    const xi = x[i]; if (xi == null || xi === '') continue;
    const si = useS ? s[i] : 'All'; if (si == null || si === '') continue;
    const wi = w ? w[i] : 1; if (!(wi > 0)) continue;
    const yi = stat === 'mean' || stat === 'sum' ? y[i] : 1; if ((stat === 'mean' || stat === 'sum') && !(typeof yi === 'number' && isFinite(yi))) continue;
    const kx = String(xi), ks = String(si); sk.add(ks); used++;
    if (!m.has(kx)) m.set(kx, new Map()); const row = m.get(kx); const c = row.get(ks) || { sw: 0, sy: 0, n: 0 }; c.sw += wi; c.sy += wi * yi; c.n++; row.set(ks, c);
  }
  if (!used) throw Error('No complete observations for these selections.');
  let cats = [...m.keys()].sort(cbNatural); const series = [...sk].sort(cbNatural);
  if (o.catOrder) cats = o.catOrder.filter(k => m.has(k)).concat(cats.filter(k => !o.catOrder.includes(k)));
  cbCap(cats); cbCap(series, 'groups');
  const grand = [...m.values()].reduce((t, row) => t + [...row.values()].reduce((u, c) => u + c.sw, 0), 0);
  const vals = cats.map(kx => { const row = m.get(kx), rowW = [...row.values()].reduce((u, c) => u + c.sw, 0); return series.map(ks => { const c = row.get(ks); if (!c) return stat === 'mean' ? null : { v: 0, n: 0 }; const v = stat === 'count' ? c.sw : stat === 'percent' ? 100 * c.sw / (useS && o.within !== 'total' ? rowW : grand) : stat === 'sum' ? c.sy : c.sy / c.sw; return { v, n: c.n }; }); });
  const table = []; cats.forEach((kx, ci) => series.forEach((ks, si) => { const c = vals[ci][si]; if (c) table.push(useS ? [kx, ks, c.v, c.n] : [kx, c.v, c.n]); }));
  return { cats, series, vals, n: used, excluded: eligible - used, pct: stat === 'percent', table, headers: useS ? ['Category', 'Group', stat, 'n'] : ['Category', stat, 'n'] };
}

// over time: mean (with a t interval), sum, count or % of rows equal to 1, per group; lines break at unobserved periods
export function cbTimeAgg(t, y, g, w, mask, o = {}) {
  const stat = o.stat || 'mean', useG = !!(g && o.sel && o.sel.length), sel = useG ? o.sel.map(String) : ['All'], at = new Map(sel.map((k, i) => [k, i]));
  const lo = o.t0 === '' || o.t0 == null ? -Infinity : +o.t0, hi = o.t1 === '' || o.t1 == null ? Infinity : +o.t1;
  const maps = sel.map(() => new Map()), times = new Set(); let used = 0, eligible = 0;
  for (let i = 0; i < t.length; i++) {
    if (mask && !mask[i]) continue; eligible++;
    const tv = t[i]; if (!(typeof tv === 'number' && isFinite(tv)) || tv < lo || tv > hi) continue;
    let si = 0; if (useG) { const k = at.get(g[i] == null ? '' : String(g[i])); if (k === undefined) continue; si = k; }
    const wi = w ? w[i] : 1; if (!(wi > 0)) continue;
    const yv = stat === 'count' ? 1 : y[i]; if (!(typeof yv === 'number' && isFinite(yv))) continue;
    if (stat === 'pct' && yv !== 0 && yv !== 1) throw Error('“% equal to 1” needs an outcome coded 0 / 1.');
    times.add(tv); used++;
    let e = maps[si].get(tv); if (!e) { e = [0, 0, 0, 0]; maps[si].set(tv, e); } e[0] += wi * yv; e[1] += wi; e[2]++; e[3] += wi * yv * yv;
  }
  if (!used) throw Error('No rows with both a time and an outcome for these selections.');
  const crit = df => (typeof critInv === 'function' ? critInv(o.alpha || 0.05, df) : 1.96);
  const allT = [...times];
  const series = sel.map((key, si) => {
    const pts = [...maps[si].entries()].sort((a, b) => a[0] - b[0]).map(([x, e]) => {
      const mean = e[0] / e[1]; let yv = stat === 'sum' ? e[0] : stat === 'count' ? e[1] : stat === 'pct' ? 100 * mean : mean; const p = { x, y: yv, n: e[2], lo: NaN, hi: NaN };
      if (o.ci && (stat === 'mean' || stat === 'pct') && e[2] > 1) { const v = Math.max(0, (e[3] / e[1] - mean * mean) * e[2] / (e[2] - 1)), h = crit(e[2] - 1) * Math.sqrt(v / e[2]), k = stat === 'pct' ? 100 : 1; p.lo = k * (mean - h); p.hi = k * (mean + h); }
      return p;
    });
    return { key, pts, segments: typeof csSegments === 'function' ? csSegments(pts, allT) : [pts] };
  }).filter(s => s.pts.length);
  return { series, n: used, excluded: eligible - used, times: allT.sort((a, b) => a - b) };
}

// stacked areas: cumulative baselines at each time (missing times count as 0)
export function cbStackSeries(series) {
  const times = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].sort((a, b) => a - b), run = new Map(times.map(t => [t, 0]));
  return series.map(s => { const by = new Map(s.pts.map(p => [p.x, p])); const pts = times.map(t => { const p = by.get(t), v = p ? p.y : 0, y0 = run.get(t); run.set(t, y0 + v); return { x: t, y: y0 + v, y0, n: p ? p.n : 0, raw: v }; }); return Object.assign({}, s, { pts, segments: [pts], stacked: true }); });
}

// histogram bins as in the legacy chart (Freedman–Diaconis, one bin per value for short integer ranges)
export function cbHistBins(d, nb) {
  let x0 = d.mn, x1 = d.mx, bins;
  if (!nb && d.allInt && (d.mx - d.mn) <= 30 && (d.mx - d.mn) >= 1) {
    const k = Math.round(d.mx - d.mn) + 1; bins = Array.from({ length: k }, (_, i) => ({ a: d.mn + i - 0.5, b: d.mn + i + 0.5, c: 0 }));
    for (let i = 0; i < d.n; i++) bins[Math.round(d.xs[i] - d.mn)].c += d.ws[i];
  } else {
    let k; if (nb) k = Math.max(2, Math.min(200, Math.round(nb))); else { const iqr = d.q3 - d.q1, bw = iqr > 0 ? 2 * iqr / Math.cbrt(d.n) : (d.mx - d.mn) / 12; k = bw > 0 ? Math.ceil((d.mx - d.mn) / bw) : 12; k = Math.max(5, Math.min(40, k || 12)); }
    if (!(x1 > x0)) { x0 -= 0.5; x1 += 0.5; }
    bins = Array.from({ length: k }, (_, i) => ({ a: x0 + (x1 - x0) * i / k, b: x0 + (x1 - x0) * (i + 1) / k, c: 0 }));
    const span = x1 - x0 || 1; for (let i = 0; i < d.n; i++) { let bi = Math.floor(k * (d.xs[i] - x0) / span); if (bi >= k) bi = k - 1; if (bi < 0) bi = 0; bins[bi].c += d.ws[i]; }
  }
  return bins;
}
// box statistics from descNum output (whiskers as the legacy chart: 1.5 × IQR, clipped to the data)
export function cbBoxStats(key, d) {
  const iqr = d.q3 - d.q1, wlo = Math.max(d.mn, d.q1 - 1.5 * iqr), whi = Math.min(d.mx, d.q3 + 1.5 * iqr), out = [];
  if (d.xs) for (let i = 0; i < d.n && out.length < 250; i += Math.max(1, Math.floor(d.n / 4000))) { const v = d.xs[i]; if (v < wlo || v > whi) out.push(v); }
  return { key, q1: d.q1, med: d.med, q3: d.q3, wlo, whi, mean: d.mean, n: d.n, out, lo: d.mn, hi: d.mx };
}

// models for every chart kind. data = csPrepare(kind, …) output unless noted.
export function cbModel(kind, data, o = {}) {
  const rows = data.rows || [], groups = cbU(rows, 'g'), sum = a => a.reduce((s, v) => s + v, 0);
  const base = { n: data.n, excluded: data.excluded, weighted: data.weighted };
  if (kind === 'pie' || kind === 'donut') {
    const panels = data.panels && data.panels.size > 1 ? [...data.panels] : [['All', rows]], keysAll = [];
    // one slice order for every panel (by the overall total), so the same category sits in the same place in each donut
    const overall = new Map(); for (const [, rr] of panels) for (const r of rr) overall.set(r.x, (overall.get(r.x) || 0) + r.w);
    const rank = new Map([...overall].sort(o.sort === 'category' ? (a, b) => cbNatural(a[0], b[0]) : (a, b) => b[1] - a[1] || cbNatural(a[0], b[0])).map((e, i) => [e[0], i]));
    const P = panels.map(([key, rr]) => {
      const counts = new Map(); for (const r of rr) counts.set(r.x, (counts.get(r.x) || 0) + r.w);
      let entries = [...counts]; entries.sort((a, b) => rank.get(a[0]) - rank.get(b[0]));
      if (o.other > 0) { const total = sum(entries.map(e => e[1])), small = entries.filter(e => 100 * e[1] / total < +o.other); entries = entries.filter(e => 100 * e[1] / total >= +o.other); if (small.length) entries.push(['Other (combined)', sum(small.map(e => e[1]))]); }
      cbCap(entries.map(e => e[0]), 'slices');
      entries.forEach(e => { if (!keysAll.includes(e[0])) keysAll.push(e[0]); });
      return { key, slices: entries.map(([k, v]) => ({ k, v })), total: sum(entries.map(e => e[1])) };
    });
    const table = []; P.forEach(p => p.slices.forEach(s => table.push(P.length > 1 ? [p.key, s.k, s.v, 100 * s.v / p.total] : [s.k, s.v, 100 * s.v / p.total])));
    return Object.assign(base, { type: 'pie', donut: kind === 'donut', panels: P, seriesKeys: keysAll, sliceLabels: o.labels === 'count' ? 'count' : o.labels === 'both' ? 'both' : o.labels === 'none' ? 'none' : 'percent', table, headers: P.length > 1 ? ['Panel', 'Category', data.weighted ? 'Weighted count' : 'Count', 'Percent'] : ['Category', data.weighted ? 'Weighted count' : 'Count', 'Percent'], note: 'Shares of ' + (data.weighted ? 'the weighted total' : 'all observations') + (P.length > 1 ? ' within each panel' : '') + '.' });
  }
  if (['groupbar', 'stackcount', 'likert'].includes(kind)) {
    const cats = cbU(rows, 'x'), levels = cbU(rows, 'y'); cbCap(cats); cbCap(levels, 'responses');
    if (kind === 'likert' && levels.length > 9) throw Error('Use an ordered response variable with at most 9 categories.');
    const order = o.order ? String(o.order).split('|').map(v => v.trim()).filter(Boolean) : levels.slice().sort(cbNatural);
    if (order.length !== levels.length || levels.some(v => !order.includes(v))) throw Error('Response order must list every observed response exactly once, separated by |.');
    const cells = cats.map(k => order.map(v => sum(rows.filter(r => r.x === k && r.y === v).map(r => r.w)))), totals = cells.map(sum), percent = o.stat === 'percent' || kind === 'likert';
    const vals = cells.map((row, j) => row.map(v => ({ v: percent ? 100 * v / totals[j] : v, n: v })));
    const table = []; cats.forEach((c, j) => order.forEach((v, i) => table.push([c, v, cells[j][i], 100 * cells[j][i] / totals[j]])));
    return Object.assign(base, { type: 'cat', mode: kind === 'groupbar' ? 'group' : kind === 'likert' ? 'diverge' : percent ? 'stack100' : 'stack', cats, series: order, seriesKeys: order, vals, pct: percent, neutral: kind === 'likert' ? (order.indexOf(o.neutral) >= 0 ? order.indexOf(o.neutral) : order.length % 2 ? Math.floor(order.length / 2) : order.length / 2 - 0.5) : 0, table, headers: ['Group', 'Response', 'Count / weighted count', 'Percent'], note: (percent ? 'Percentages use the total within each group. ' : '') + 'Response order: ' + order.join(' → ') + '.' });
  }
  if (kind === 'density' || kind === 'violin') {
    let parts = groups.map(k => ({ key: k, rows: rows.filter(r => r.g === k) })); if (kind === 'violin') parts = cbU(rows, 'x').map(k => ({ key: k, rows: rows.filter(r => r.x === k) }));
    cbCap(parts.map(p => p.key), 'groups');
    const range = csRange(rows.map(r => r.y)), grid = Array.from({ length: 100 }, (_, i) => range[0] + i * (range[1] - range[0]) / 99);
    const curves = parts.map(p => ({ ...p, curve: kde(p.rows, grid), d: csSummary(p.rows) }));
    const table = curves.map(p => [p.key, p.d.n, p.d.mean, p.d.sd]), note = 'Gaussian kernel; bandwidth = 1.06 × SD × effective N^(−1/5), over the observed range.';
    if (kind === 'density') return Object.assign(base, { type: 'xy', series: curves.map(p => ({ key: p.key, pts: p.curve.map(q => ({ x: q.x, y: q.y })), style: 'line', markers: false })), seriesKeys: curves.map(p => p.key), zero: true, yTitle: 'Density', table, headers: ['Group', 'N', 'Mean', 'SD'], note });
    return Object.assign(base, { type: 'box', violin: true, groups: curves.map(p => { const ys = p.rows.map(r => r.y).sort((a, b) => a - b); const med = ys.length % 2 ? ys[(ys.length - 1) / 2] : (ys[ys.length / 2 - 1] + ys[ys.length / 2]) / 2; return { key: p.key, curve: p.curve.map(q => ({ x: q.x, y: q.y })), mean: p.d.mean, med, n: p.d.n, wlo: range[0], whi: range[1], pointsY: o.points ? p.rows.filter((r, j) => j % Math.max(1, Math.ceil(p.rows.length / 400)) === 0).map(r => r.y) : null }; }), seriesKeys: curves.map(p => p.key), showN: true, table, headers: ['Group', 'N', 'Mean', 'SD'], note });
  }
  if (kind === 'mean' || kind === 'proportion') {
    const cats = cbU(rows, 'x'); cbCap(cats);
    const est = cats.map(k => { const rr = rows.filter(r => r.x === k), d = csSummary(rr, o.critical); if (rr.length < 2 && kind === 'mean') throw Error('Every group needs at least two complete observations for mean confidence intervals.'); if (kind === 'proportion') { const b = csWilson(sum(rr.map(r => r.y)), rr.length, o.z); d.lo = b[0]; d.hi = b[1]; } return { x: k, ...d }; });
    const k = kind === 'proportion' && o.asPercent !== false ? 100 : 1;
    return Object.assign(base, { type: 'cat', mode: 'ci', cats, series: ['All'], seriesKeys: ['All'], colorBy: 'cat', vals: est.map(p => [{ v: k * p.mean, lo: k * p.lo, hi: k * p.hi, n: p.n }]), pct: k === 100, zero: kind === 'proportion', table: est.map(p => [p.x, p.n, p.mean, p.lo, p.hi]), headers: ['Group', 'N', 'Estimate', 'Lower CI', 'Upper CI'], note: kind === 'mean' ? 'Group means with Student t confidence intervals.' : 'Proportions with Wilson score confidence intervals.' });
  }
  if (['dumbbell', 'slope', 'paired'].includes(kind)) {
    const paired = kind === 'paired', cats = cbU(rows, 'x'); if (!paired) cbCap(cats);
    const pts = paired ? rows.map(r => ({ label: String(r.i + 1), before: r.x, after: r.y })) : cats.map(k => { const rr = rows.filter(r => r.x === k); if (rr.some(r => !(typeof r.lo === 'number' && isFinite(r.lo)))) throw Error('Select the first-value column as well as the second-value column.'); return { label: k, before: csSummary(rr.map(r => ({ ...r, y: r.lo }))).mean, after: csSummary(rr).mean }; });
    const names = [o.firstLabel || (paired ? o.x : o.lo) || 'First value', o.secondLabel || o.y || 'Second value'];
    const M = Object.assign(base, { type: 'pair', kind, pts, names, seriesNames: { __first: names[0], __second: names[1] }, seriesKeys: kind === 'slope' ? pts.map(p => p.label) : ['__first', '__second'], table: pts.map(p => [p.label, p.before, p.after, p.after - p.before]), headers: ['Category', names[0], names[1], 'Change'] });
    if (paired) { const n = pts.length, mb = sum(pts.map(p => p.before)) / n, ma = sum(pts.map(p => p.after)) / n, up = pts.filter(p => p.after > p.before).length, dn = pts.filter(p => p.after < p.before).length; M.meanBefore = mb; M.meanAfter = ma; M.note = 'Mean ' + cbFmt(mb) + ' → ' + cbFmt(ma) + ' (change ' + (ma - mb >= 0 ? '+' : '') + cbFmt(ma - mb) + '). ' + up + ' of ' + n + ' pairs increased (blue), ' + dn + ' decreased (rust).'; }
    else M.note = 'Each ' + (kind === 'slope' ? 'line' : 'pair of dots') + ' joins the mean of ' + names[0] + ' to the mean of ' + names[1] + ' within a category.';
    return M;
  }
  if (['coefficient', 'modelcompare', 'marginal', 'event', 'prediction', 'interaction'].includes(kind)) {
    if (rows.some(r => !(isFinite(r.lo) && isFinite(r.hi)) || r.lo > r.y || r.hi < r.y)) throw Error('Each estimate needs finite lower and upper confidence bounds containing the estimate.');
    const note = 'Displays supplied estimates and confidence bounds; does not fit a new model.';
    if (['coefficient', 'modelcompare', 'marginal'].includes(kind)) {
      const cats = cbU(rows, 'x'); cbCap(cats); cbCap(groups, 'models');
      return Object.assign(base, { type: 'cat', mode: 'ci', cats, series: groups, seriesKeys: groups, horizontal: kind !== 'marginal', refLine: 0, zero: false, vals: cats.map(c => groups.map(g => { const r = rows.find(q => q.x === c && q.g === g); return r ? { v: r.y, lo: r.lo, hi: r.hi } : null; })), table: rows.map(r => [r.x, r.g, r.y, r.lo, r.hi]), headers: ['Term', 'Model', 'Estimate', 'Lower', 'Upper'], note });
    }
    cbCap(groups, 'series');
    return Object.assign(base, { type: 'xy', series: groups.map(g => ({ key: g, pts: rows.filter(r => r.g === g).sort((a, b) => a.x - b.x).map(r => ({ x: r.x, y: r.y, lo: r.lo, hi: r.hi })), style: 'line', band: kind !== 'event', ciBars: kind === 'event', markers: kind === 'event' })), seriesKeys: groups, refY: kind === 'event' ? 0 : null, refX: kind === 'event' ? 0 : null, xExact: true, table: rows.map(r => [r.x, r.g, r.y, r.lo, r.hi]), headers: ['X', 'Series', 'Estimate', 'Lower', 'Upper'], note });
  }
  if (kind === 'survival') {
    cbCap(groups, 'groups');
    const ss = groups.map(g => ({ g, ...csSurvival(rows.filter(r => r.g === g)), end: csRange(rows.filter(r => r.g === g).map(r => r.x))[1] })), table = [];
    ss.forEach(s => s.pts.slice(1).forEach(q => table.push([s.g, q.x, q.risk, q.events, q.y, q.lo, q.hi])));
    return Object.assign(base, { type: 'xy', series: ss.map(s => ({ key: s.g, pts: s.pts.map(p => ({ x: p.x, y: p.y })), style: 'step', endX: s.end, ticks: s.censors })), seriesKeys: groups, yr: [0, 1], xr: [0], zero: true, xExact: true, yTitle: 'Share surviving', table, headers: ['Group', 'Time', 'At risk', 'Events', 'Survival', 'Lower', 'Upper'], note: 'Kaplan–Meier estimate; ticks mark censoring; the table has pointwise 95% Greenwood intervals. Assumes entry at time zero.' });
  }
  if (kind === 'heatmap' || kind === 'corrmap') {
    const xx = cbU(rows, 'x'), yy = cbU(rows, 'g'); cbCap(xx); cbCap(yy);
    const cells = []; for (const x of xx) for (const y of yy) { const rr = rows.filter(r => r.x === x && r.g === y); if (rr.length) cells.push({ x, y, v: kind === 'corrmap' ? rr[0].y : csSummary(rr).mean, n: kind === 'corrmap' ? rr[0].n : rr.length }); }
    const range = kind === 'corrmap' ? [-1, 1] : csRange(cells.map(c => c.v));
    return Object.assign(base, { type: 'grid', xs: xx, ys: yy, cells, range, diverging: kind === 'corrmap', seriesKeys: ['All'], table: cells.map(c => [c.x, c.y, c.v]), headers: ['Column', 'Row', kind === 'corrmap' ? 'r' : 'Mean'], note: kind === 'heatmap' ? 'Cells show the mean within each row and column.' : 'Pairwise-complete Pearson correlations.' });
  }
  if (['scatterplain', 'smooth', 'hexbin'].includes(kind)) {
    cbCap(groups, 'groups');
    if (kind === 'hexbin') return Object.assign(base, { type: 'xy', series: [], points: [], hex: { pts: rows, weighted: data.weighted }, seriesKeys: ['All'], table: [], headers: [], note: 'Hexagon shade = ' + (data.weighted ? 'weighted count' : 'number of observations') + ' in that area.' });
    const pts = [], series = [], table = [];
    groups.forEach(g => { const rr = rows.filter(r => r.g === g).sort((a, b) => a.x - b.x), stride = Math.max(1, Math.ceil(rr.length / 4000)); rr.forEach((r, i) => { if (i % stride === 0) pts.push({ x: r.x, y: r.y, k: g }); });
      if (kind === 'smooth') { const xr = csRange(rr.map(r => r.x)), bins = Array.from({ length: Math.min(40, Math.max(3, Math.floor(Math.sqrt(rr.length)))) }, () => []); rr.forEach(r => { const i = Math.min(bins.length - 1, Math.floor((r.x - xr[0]) / (xr[1] - xr[0] || 1) * bins.length)); if (i >= 0) bins[i].push(r); }); const sp = bins.filter(v => v.length).map(v => ({ x: sum(v.map(r => r.x * r.w)) / sum(v.map(r => r.w)), y: csSummary(v).mean })); series.push({ key: g, pts: sp, style: 'smooth', markers: false }); table.push(...sp.map(p => [g, p.x, p.y])); } });
    return Object.assign(base, { type: 'xy', points: pts, series, seriesKeys: groups, table, headers: kind === 'smooth' ? ['Group', 'X (bin mean)', 'Y (bin mean)'] : [], note: kind === 'smooth' ? 'The smoother joins weighted means within equal-width X bins (descriptive, not LOESS). Points are capped at 4,000 per group.' : 'Points are capped at 4,000 per group; the axes use all observations.' });
  }
  if (kind === 'multiline' || kind === 'panel' || kind === 'line' || kind === 'area') {
    // csPrepare rows → mean per group and time (the chart suite's own rule)
    cbCap(groups, 'series');
    const allT = rows.map(r => r.x), series = groups.map(g => { const by = new Map(); rows.filter(r => r.g === g).forEach(r => { if (!by.has(r.x)) by.set(r.x, []); by.get(r.x).push(r); }); const pts = [...by].sort((a, b) => a[0] - b[0]).map(([x, v]) => { const d = csSummary(v); return { x, y: d.mean, n: d.n }; }); return { key: g, pts, segments: csSegments(pts, allT), style: kind === 'area' ? 'area' : 'line' }; });
    return Object.assign(base, { type: 'xy', xTime: true, series, seriesKeys: groups, table: series.flatMap(s => s.pts.map(p => [s.key, p.x, p.y])), headers: ['Series', 'Time', 'Mean'], note: 'Each point is the ' + (data.weighted ? 'weighted ' : '') + 'mean at that time. Lines break where a series has no observation.' });
  }
  throw Error('Unsupported chart type.');
}
export function cbConjoint(data, o) {
  const sc = csConjointScene(data, o);
  return { type: 'raw', markup: sc.markup.replace(/font-family="sans-serif"/g, `font-family="'Hanken Grotesk', Arial, sans-serif"`).replace(/fill="#FFFEFA"/, 'fill="#FFFFFF"'), width: sc.width, height: sc.height, table: sc.table, headers: ['Attribute', 'Level', 'Group', 'Estimate', 'Lower', 'Upper'], note: sc.note, n: data.n, excluded: data.excluded };
}
