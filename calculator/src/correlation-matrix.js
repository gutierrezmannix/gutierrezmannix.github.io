  // GM26 correlation matrix begin
  // Tests ▾ → Correlation (build .62): any number of numeric variables, Pearson or Spearman, pairwise or complete
  // rows; a heat-table with r, stars, n, p or CIs; click a cell for the pair (scatter, r with its CI, ρ, n, slope).
  // Exports: the matrix as plain numbers (copy, CSV with r, p and n) and an APA-style Word table.
  corSet(patch) { this.clearMemo(); this.setState(patch); }
  corVarsNow() {
    const S = this.state, ok = n => { const m = this.effMeta(n); return !!(m && m.type === 'numeric'); };
    if (Array.isArray(S.corVars)) return S.corVars.filter(ok);
    const seed = [S.xVar, S.yVar].filter((v, i, a) => v && ok(v) && a.indexOf(v) === i);
    if (seed.length === 2) return seed;
    return (S.cols || []).filter(c => ok(c.name) && (this.effMeta(c.name).treatAs || 'numeric') === 'numeric' && c.distinct > 2 && c.distinct < (S.nRows || Infinity)).slice(0, 5).map(c => c.name);
  }
  corShowNow() { return Object.assign({ stars: true, n: true, p: false, ci: false }, this.state.corShow || {}); }
  corCompute(vars) {
    const S = this.state, E = this._E, method = S.corMethod === 'spearman' ? 'spearman' : 'pearson', listwise = S.corRows === 'listwise';
    return this.memo('corM|' + vars.join(',') + '|' + method + '|' + (listwise ? 'L' : 'P') + '|' + (S.weightVar || '') + '|' + this.alpha() + '|' + (S.dver || 0), () => {
      const w = this.wArr(), A = vars.map(v => { const nv = this.numVals(v); return nv ? Float64Array.from(nv.a) : new Float64Array(this._raw.n).fill(NaN); });
      let nAll = 0;
      if (listwise) { const N = A[0].length; for (let i = 0; i < N; i++) { const ok = A.every(a => Number.isFinite(a[i])) && (!w || Number.isFinite(w[i])); if (ok) nAll++; else A.forEach(a => { a[i] = NaN; }); } }
      const k = vars.length, cells = vars.map(() => vars.map(() => null)), crit = this.corZ(1 - this.alpha() / 2);
      for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) {
        const c = E.corr(A[j], A[i], w); // x = the column variable, y = the row variable (as the scatter draws them)
        if (c.error) { cells[i][j] = cells[j][i] = { r: NaN, p: NaN, n: c.n || 0, err: c.error }; continue; }
        const q = c[method], n = c.n, se = method === 'spearman' ? Math.sqrt((1 + q.r * q.r / 2) / (n - 3)) : 1 / Math.sqrt(n - 3), zr = Math.atanh(Math.max(-0.999999, Math.min(0.999999, q.r)));
        cells[i][j] = cells[j][i] = { r: q.r, p: q.p, n, lo: n > 3 ? Math.tanh(zr - crit * se) : NaN, hi: n > 3 ? Math.tanh(zr + crit * se) : NaN, rP: c.pearson.r, rS: c.spearman.r, pP: c.pearson.p, pS: c.spearman.p, fit: c.fit, i, j };
      }
      const desc = A.map(a => E.descNum(a, w));
      return { vars, cells, method, listwise, nAll, A, w, desc };
    });
  }
  // normal quantile (Acklam's algorithm, relative error below 1.2e-9), for the Fisher-z confidence limits
  corZ(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const tail = q => { const u = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * u + c[1]) * u + c[2]) * u + c[3]) * u + c[4]) * u + c[5]) / ((((d[0] * u + d[1]) * u + d[2]) * u + d[3]) * u + 1); };
    if (p < 0.02425) return tail(p);
    if (p > 1 - 0.02425) return -tail(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  corR(v) { return Number.isFinite(v) ? v.toFixed(2).replace(/^(-?)0\./, '$1.').replace(/^-/, '−') : '—'; }
  corStars(p) { return !Number.isFinite(p) ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : ''; }
  // two bands so the text always has 4.5:1 contrast: light tints with dark text up to |r| = .35, then solid tones with white text
  corColor(r) {
    if (!Number.isFinite(r)) return '#F4F1EA';
    const m = Math.abs(r), pos = r >= 0, base = pos ? [26, 80, 97] : [168, 82, 26];
    if (m <= 0.35) { const a = 0.07 + 0.48 * m / 0.35; return 'rgb(' + base.map(x => Math.round(255 + (x - 255) * a)).join(',') + ')'; }
    const lo = pos ? [52, 104, 120] : [150, 70, 22], hi = pos ? [16, 58, 72] : [110, 48, 12], t = Math.min(1, (m - 0.35) / 0.5);
    return 'rgb(' + lo.map((x, k) => Math.round(x + (hi[k] - x) * t)).join(',') + ')';
  }
  corSym() { return this.state.corMethod === 'spearman' ? 'ρ' : 'r'; }
  // the Stata / R commands and printout of the current matrix (logged in the console, the Output view and scripts)
  corDesc() {
    const S = this.state, vars = this.corVarsNow(); if (vars.length < 2 || S.screen !== 'work') return null;
    const M = this.corCompute(vars), sp = M.method === 'spearman', wv = S.weightVar, vl = vars.join(' '), rv = 'df[, c(' + vars.map(v => '"' + v + '"').join(', ') + ')]';
    const stata = sp ? 'spearman ' + vl + '@IF@, stats(rho p obs)' + (M.listwise ? '' : ' pw') : M.listwise ? 'correlate ' + vl + '@IF@' + (wv ? ' [aw=' + wv + ']' : '') : 'pwcorr ' + vl + '@IF@' + (wv ? ' [aw=' + wv + ']' : '') + ', sig obs';
    const r = sp ? 'psych::corr.test(' + rv + ', method = "spearman", use = "' + (M.listwise ? 'complete' : 'pairwise') + '", adjust = "none")' : M.listwise ? 'cor(' + rv + ', use = "complete.obs")' : 'psych::corr.test(' + rv + ', use = "pairwise", adjust = "none")';
    return this.memo('corD|' + vars.join(',') + '|' + M.method + '|' + M.listwise + '|' + (wv || ''), () => {
      let tbl = '';
      try { const mk = this.mask(), w = M.w; tbl = sp ? this.corText(M) : M.listwise ? this.cxCorrelate(vars, mk, w).tbl : this.cxPwcorr(vars, mk, w, { sig: true, obs: true }).tbl; } catch (e) { tbl = this.corText(M); }
      const best = this.corBest(M)[0];
      return { t: 'cx', stata, r, ifc: [], tbl, expl: (sp ? 'Spearman' : 'Pearson') + ' correlation matrix of ' + vars.length + ' variables' + (M.listwise ? ', rows complete on every variable' : ', each pair on its complete rows'), res: vars.length + ' variables' + (best ? ' · strongest ' + best.a + '–' + best.b + ' ' + this.corSym() + ' = ' + this.corR(best.r) : '') };
    });
  }
  corText(M) {
    const R = (v, n) => String(v).padStart(n), V = M.vars, f4 = v => Number.isFinite(v) ? v.toFixed(4) : '.', out = [R('', 13) + '|' + V.map(v => R(this.abbr(v, 8), 9)).join(''), '-------------+' + '-'.repeat(9 * V.length)];
    V.forEach((v, i) => { out.push(R(this.abbr(v, 12), 12) + ' |' + V.slice(0, i + 1).map((_, j) => R(i === j ? '1.0000' : f4(M.cells[i][j].r), 9)).join('')); out.push('             |' + V.slice(0, i).map((_, j) => R(f4(M.cells[i][j].p), 9)).join('')); out.push('             |' + V.slice(0, i).map((_, j) => R(M.cells[i][j].n, 9)).join('')); out.push('             |'); });
    return out.join('\n').replace(/\s+$/gm, '');
  }
  corBest(M) { const L = []; M.vars.forEach((a, i) => M.vars.forEach((b, j) => { if (j < i && Number.isFinite(M.cells[i][j].r)) L.push(Object.assign({ a: b, b: a }, M.cells[i][j])); })); return L.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)); }
  corHeadline(M) {
    const h = React.createElement, L = this.corBest(M), a = this.alpha(), sig = L.filter(c => c.p < a), sym = this.corSym(), pair = c => [h('em', { key: c.a + c.b }, c.a + '–' + c.b), ' (' + sym + ' = ' + this.corR(c.r) + ')'];
    if (!L.length) return h('p', { className: 'cm-head' }, 'No pair has enough complete rows to correlate.');
    if (!sig.length) return h('p', { className: 'cm-head' }, 'No pair is significantly correlated at α = ' + a + '. The strongest is ', ...pair(L[0]), '.');
    const top = sig.slice(0, 2), rest = L.filter(c => !top.includes(c)), maxRest = rest.length ? Math.max(...rest.map(c => Math.abs(c.r))) : 0;
    return h('p', { className: 'cm-head' }, top.length === 1 ? 'One clear relationship: ' : 'The clearest relationships: ', ...pair(top[0]), top[1] ? [' and ', ...pair(top[1])] : null, '.', rest.length ? (maxRest < 0.3 ? ' Everything else is weak (|' + sym + '| < ' + this.corR(Math.ceil(maxRest * 100) / 100).replace('−', '') + ').' : (sig.length > top.length ? ' ' + (sig.length - top.length) + ' more significant pair' + (sig.length - top.length === 1 ? '' : 's') + ' in the table.' : ' No other pair is significant at α = ' + a + '.')) : '');
  }
  corScatter(M, c) {
    const h = React.createElement, E = this._E, xa = M.A[c.j], ya = M.A[c.i], xs = [], ys = []; for (let k = 0; k < xa.length; k++) if (Number.isFinite(xa[k]) && Number.isFinite(ya[k])) { xs.push(xa[k]); ys.push(ya[k]); }
    const W = 360, H = 240, X0 = 50, X1 = W - 12, Y0 = 10, Y1 = H - 38, mn = a => a.reduce((m, v) => Math.min(m, v), Infinity), mx = a => a.reduce((m, v) => Math.max(m, v), -Infinity);
    let xl = mn(xs), xh = mx(xs), yl = mn(ys), yh = mx(ys); if (!(xh > xl)) { xl -= 1; xh += 1; } if (!(yh > yl)) { yl -= 1; yh += 1; }
    const px = (xh - xl) * 0.04, py = (yh - yl) * 0.06; xl -= px; xh += px; yl -= py; yh += py;
    const x = v => X0 + (v - xl) / (xh - xl) * (X1 - X0), y = v => Y1 - (v - yl) / (yh - yl) * (Y1 - Y0), kids = [], tf = v => E.fmtTick ? E.fmtTick(v) : String(v);
    this.cmTicks(yl, yh).forEach((t, k) => kids.push(h('line', { key: 'gy' + k, x1: X0, x2: X1, y1: y(t), y2: y(t), stroke: '#EEE8DC' }), h('text', { key: 'ty' + k, x: X0 - 6, y: y(t) + 3, textAnchor: 'end', fontSize: 10, fill: '#7E7563', fontFamily: 'Space Mono, monospace' }, tf(t))));
    this.cmTicks(xl, xh).forEach((t, k) => kids.push(h('text', { key: 'tx' + k, x: x(t), y: Y1 + 14, textAnchor: 'middle', fontSize: 10, fill: '#7E7563', fontFamily: 'Space Mono, monospace' }, tf(t))));
    const step = Math.max(1, Math.ceil(xs.length / 2500)); for (let k = 0; k < xs.length; k += step) kids.push(h('circle', { key: 'p' + k, cx: x(xs[k]).toFixed(1), cy: y(ys[k]).toFixed(1), r: 2.4, fill: '#1A5061', opacity: 0.35 }));
    const f = c.fit; if (f && Number.isFinite(f.slope)) { const a0 = mn(xs), a1 = mx(xs); kids.push(h('line', { key: 'fit', x1: x(a0), y1: y(f.icept + f.slope * a0), x2: x(a1), y2: y(f.icept + f.slope * a1), stroke: '#A8521A', strokeWidth: 2.5 })); }
    kids.push(h('text', { key: 'xl', x: (X0 + X1) / 2, y: H - 6, textAnchor: 'middle', fontSize: 11, fill: '#5D5648' }, c.b), h('text', { key: 'yl', x: 12, y: (Y0 + Y1) / 2, textAnchor: 'middle', fontSize: 11, fill: '#5D5648', transform: 'rotate(-90 12 ' + (Y0 + Y1) / 2 + ')' }, c.a));
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Scatter plot of ' + c.a + ' against ' + c.b + ' with the fitted line', ref: this.svgRef('cor'), style: { maxWidth: W + 'px' } }, kids);
  }
  // ---- exports
  corMatrixRows(M, what) { const V = M.vars, f = v => !Number.isFinite(v) ? '' : what === 'p' ? String(+v.toPrecision(4)) : String(+v.toFixed(what === 'n' ? 0 : 4)); return [['', ...V], ...V.map((v, i) => [v, ...V.map((_, j) => i === j ? (what === 'n' ? f(M.desc[i].n) : what === 'p' ? '' : '1') : f(M.cells[i][j][what]))])]; }
  corCopyMatrix(M) { const t = this.corMatrixRows(M, 'r').map(r => r.join('\t')).join('\n'); try { navigator.clipboard.writeText(t).then(() => this.flash('Correlation matrix copied (paste into Excel or a sheet)'), () => this.flash('Copy failed')); } catch (e) { this.flash('Copy failed'); } }
  corCsv(M) {
    const q = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v, block = (title, rows) => [title, ...rows.map(r => r.map(q).join(','))].join('\n');
    const csv = [block((M.method === 'spearman' ? 'Spearman rho' : 'Pearson r') + (M.listwise ? ' (complete rows)' : ' (pairwise)'), this.corMatrixRows(M, 'r')), block('p (two-sided)', this.corMatrixRows(M, 'p')), block('n', this.corMatrixRows(M, 'n'))].join('\n\n') + '\n';
    this.dlBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'correlation-matrix.csv'); this.flash('Downloaded correlation-matrix.csv (r, p and n)');
  }
  corTable(M) {
    const V = M.vars, f2 = v => Number.isFinite(v) ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)) : '—', show = this.corShowNow(), sym = this.corSym();
    const head = [['Variable', 'M', 'SD', ...V.slice(0, -1).map((_, j) => String(j + 1))]];
    const rows = V.map((v, i) => [(i + 1) + '. ' + v, f2(M.desc[i].mean), f2(M.desc[i].sd), ...V.slice(0, -1).map((_, j) => j < i ? this.corR(M.cells[i][j].r) + this.corStars(M.cells[i][j].p) + (show.ci ? ' [' + this.corR(M.cells[i][j].lo) + ', ' + this.corR(M.cells[i][j].hi) + ']' : '') : '')]);
    const ns = []; V.forEach((_, i) => V.forEach((__, j) => { if (j < i && M.cells[i][j].n) ns.push(M.cells[i][j].n); }));
    const nTxt = M.listwise ? 'n = ' + this.fmtN(M.nAll) + ' (rows complete on every variable)' : 'pairwise deletion, n = ' + (Math.min(...ns) === Math.max(...ns) ? this.fmtN(ns[0]) : this.fmtN(Math.min(...ns)) + '–' + this.fmtN(Math.max(...ns)));
    return { title: 'Means, standard deviations, and ' + (M.method === 'spearman' ? 'Spearman ' : '') + 'correlations' + (show.ci ? ' with confidence intervals' : ''), head, rows, note: 'Note. M and SD are the mean and standard deviation. ' + (M.method === 'spearman' ? 'Spearman’s ρ' : 'Pearson’s r') + '; ' + nTxt + '.' + (show.ci ? ' Brackets: ' + Math.round((1 - this.alpha()) * 100) + '% confidence intervals.' : '') + ' * p < .05. ** p < .01. *** p < .001.' };
  }
  corDocx(M) { const T = this.corTable(M); this.dlBlob(this.docxBlob([{ k: 'table', title: T.title, head: T.head, rows: T.rows, note: T.note }]), 'correlation-table.docx'); this.flash('Downloaded a Word file (.docx)'); }
  async corCopyWord(M) {
    const T = this.corTable(M), html = '<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;">' + this.blocksHTML([{ k: 'table', title: T.title, head: T.head, rows: T.rows, note: T.note }], null) + '</div>', txt = [T.title, T.head[0].join('\t'), ...T.rows.map(r => r.join('\t')), T.note].join('\n');
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]); this.flash('Table copied — paste it into Word'); }
    catch (e) { try { await navigator.clipboard.writeText(txt); this.flash('Table copied as text'); } catch (e2) { this.flash('Copy failed'); } }
  }
  // ---- the page
  corRender() {
    const h = React.createElement, S = this.state, vars = this.corVarsNow(), show = this.corShowNow(), sym = this.corSym();
    const numeric = (S.cols || []).filter(c => { const m = this.effMeta(c.name); return !!(m && m.type === 'numeric'); });
    const chips = h('div', { className: 'cr-chips' }, 'Correlations among ', ...vars.map(v => h('button', { key: v, type: 'button', className: 'cr-chip', title: 'Remove ' + v, 'aria-label': 'Remove ' + v, onClick: () => this.corSet({ corVars: vars.filter(x => x !== v), corSel: null }) }, v, h('span', { 'aria-hidden': 'true' }, '✕'))),
      this.tlSelect('', [['', '+ add a variable…']].concat(numeric.filter(c => !vars.includes(c.name)).map(c => [c.name, c.name])), v => { if (v) this.corSet({ corVars: vars.concat([v]) }); }, 'Add a variable', { className: 'tl-select cm-slot design' }),
      numeric.length > vars.length ? this.tlBtn(numeric.length > 30 ? 'first 30 numeric' : 'all numeric (' + numeric.length + ')', () => this.corSet({ corVars: numeric.slice(0, 30).map(c => c.name) })) : null,
      vars.length ? this.tlBtn('clear', () => this.corSet({ corVars: [], corSel: null })) : null);
    const settings = h('div', { className: 'tl-row cm-settings' }, h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'Method'), this.tlSeg([['pearson', 'Pearson r', 'Straight-line relationship of the values'], ['spearman', 'Spearman ρ', 'Relationship of the ranks: any steadily rising or falling pattern; robust to outliers']], S.corMethod === 'spearman' ? 'spearman' : 'pearson', v => this.corSet({ corMethod: v }), { 'aria-label': 'Method' })),
      h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'Rows'), this.tlSeg([['pairwise', 'Pairwise', 'Each pair uses every row where both are present (Stata pwcorr)'], ['listwise', 'Complete on all', 'Only rows complete on every variable (Stata correlate)']], S.corRows === 'listwise' ? 'listwise' : 'pairwise', v => this.corSet({ corRows: v }), { 'aria-label': 'Rows used' })),
      h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'Show'), h('div', { className: 'tl-row', role: 'group', 'aria-label': 'Show in each cell' }, [['stars', '★ stars'], ['p', 'p'], ['n', 'n'], ['ci', Math.round((1 - this.alpha()) * 100) + '% CI']].map(([k, l]) => this.tlChip(l, !!show[k], () => this.corSet({ corShow: Object.assign({}, show, { [k]: !show[k] }) }), { key: k })))));
    const setup = h('section', { className: 'tl-panel cm-setup' }, h('div', { className: 'tl-ptitle' }, h('h3', null, 'Correlation'), h('span', null, 'any number of variables')), h('div', { className: 'cm-body' }, chips, settings));
    if (vars.length < 2) return h('div', { className: 'tl cm' }, setup, h('section', { className: 'tl-panel' }, h('div', { className: 'cm-body' }, this.tlBanner('info', 'Add at least two numeric variables. Click a cell of the matrix to see that pair.'))));
    const M = this.corCompute(vars), k = vars.length, best = this.corBest(M);
    let sel = Array.isArray(S.corSel) && S.corSel[0] < k && S.corSel[1] < k && S.corSel[0] > S.corSel[1] ? S.corSel : best.length ? [best[0].i, best[0].j] : [1, 0];
    const head = h('tr', null, h('th', null), ...vars.slice(0, -1).map((v, j) => h('th', { key: v, scope: 'col', title: v }, v)));
    const body = vars.slice(1).map((v, ii) => { const i = ii + 1; return h('tr', { key: v }, h('th', { scope: 'row', className: 'rh', title: v }, v), ...vars.slice(0, -1).map((u, j) => {
      if (j >= i) return h('td', { key: u });
      const c = M.cells[i][j], on = sel[0] === i && sel[1] === j, dark = Number.isFinite(c.r) && Math.abs(c.r) > 0.35;
      return h('td', { key: u }, h('button', { type: 'button', className: 'cr-cell' + (on ? ' on' : ''), style: { background: this.corColor(c.r), color: dark ? '#fff' : '#2B271E' }, 'aria-pressed': on ? 'true' : 'false', 'aria-label': v + ' and ' + u + ': ' + sym + ' = ' + this.corR(c.r) + ', p ' + this.fmtP(c.p) + ', n ' + c.n, title: c.err || (sym + ' = ' + this.corR(c.r) + ' · p ' + this.fmtP(c.p) + ' · n ' + c.n + (Number.isFinite(c.lo) ? ' · ' + Math.round((1 - this.alpha()) * 100) + '% CI ' + this.corR(c.lo) + ' to ' + this.corR(c.hi) : '')), onClick: () => this.setState({ corSel: [i, j] }) },
        h('span', { className: 'r' }, this.corR(c.r) + (show.stars ? this.corStars(c.p) : '')), show.p ? h('span', { className: 's' }, 'p ' + this.fmtP(c.p)) : null, show.n ? h('span', { className: 's' }, 'n ' + this.fmtN(c.n)) : null, show.ci && Number.isFinite(c.lo) ? h('span', { className: 's' }, '[' + this.corR(c.lo) + ', ' + this.corR(c.hi) + ']') : null));
    })); });
    const legend = h('div', { className: 'cr-legend' }, h('div', { className: 'cr-scale', 'aria-hidden': 'true' }), h('div', { className: 'mono', style: { display: 'flex', justifyContent: 'space-between', width: '72px', fontSize: '10px' } }, '−.6', h('span', null, '0'), '+.6'), h('br'), '* p < .05', h('br'), '** p < .01', h('br'), '*** p < .001', h('br'), h('br'), h('b', null, 'Click a cell'), h('br'), 'to see the pair');
    const exportsRow = h('div', { className: 'tl-row cm-actions' }, this.tlBtn('Copy matrix (numbers)', () => this.corCopyMatrix(M)), this.tlBtn('Download CSV (r, p, n)', () => this.corCsv(M)), this.tlBtn('Word table (.docx)', () => this.corDocx(M), 'primary'), this.tlBtn('Copy table for Word', () => this.corCopyWord(M)), this.tlBtn('Pin to report', () => this.pinTab()));
    const matrix = h('section', { className: 'tl-panel cm-answer' }, h('div', { className: 'cm-body' },
      h('div', { className: 'tl-row cm-top' }, h('span', { className: 'cm-meta' }, (M.method === 'spearman' ? 'Spearman’s ρ' : 'Pearson’s r') + ' · ' + (M.listwise ? this.fmtN(M.nAll) + ' rows complete on all ' + k + ' variables' : 'each pair on its complete rows') + ' · ' + (this.stampText() || ''))),
      this.corHeadline(M), h('div', { className: 'cr-wrap' }, h('table', { className: 'cr-table' }, h('thead', null, head), h('tbody', null, body)), legend), exportsRow));
    // the selected pair
    const c = M.cells[sel[0]][sel[1]], a = vars[sel[0]], b = vars[sel[1]], cc = Object.assign({ a, b }, c);
    let pair = null;
    if (Number.isFinite(c.r)) {
      const sym2 = M.method === 'spearman' ? 'PEARSON r' : 'SPEARMAN ρ', other = M.method === 'spearman' ? c.rP : c.rS, otherP = M.method === 'spearman' ? c.pP : c.pS, apa = (M.method === 'spearman' ? 'rₛ' : 'r') + '(' + (c.n - 2) + ') = ' + this.corR(c.r) + ', ' + this.apaP(c.p);
      const dir = c.r >= 0 ? 'as ' + b + ' goes up, ' + a + ' tends to go up' : 'as ' + b + ' goes up, ' + a + ' tends to go down';
      pair = h('section', { className: 'tl-panel' }, h('div', { className: 'tl-ptitle' }, h('h3', null, 'Selected pair'), h('span', { className: 'mono' }, b + ' × ' + a), h('div', { className: 'tl-pr' }, h('span', { className: 'cm-meta' }, 'click another cell'))),
        h('div', { className: 'cm-body cr-pair' }, h('figure', { style: { margin: 0 } }, this.corScatter(M, cc)),
          h('div', { className: 'tl-col' }, h('div', { className: 'cm-stats' }, this.tlStat((M.method === 'spearman' ? 'SPEARMAN ρ' : 'PEARSON r') + ' · ' + Math.round((1 - this.alpha()) * 100) + '% CI', this.corR(c.r), this.corR(c.lo) + ' to ' + this.corR(c.hi)), this.tlStat(sym2, this.corR(other), 'p ' + this.fmtP(otherP)), this.tlStat('N (PAIRS)', this.fmtN(c.n), M.listwise ? 'complete on all' : this.fmtN(this.keptN() - c.n) + ' rows left out'), this.tlStat('SLOPE', (c.fit && c.fit.slope >= 0 ? '+' : '') + this.cmFmt(c.fit ? c.fit.slope : NaN), a + ' per unit of ' + b)),
            h('p', { className: 'cm-hint', style: { fontSize: '13px', color: '#433D31' } }, sym + ' = ' + this.corR(c.r) + ': a ' + this.strength(c.r) + ' ' + (c.r >= 0 ? 'positive' : 'negative') + ' relationship — ' + dir + '. ' + (c.p < this.alpha() ? 'Statistically significant (' + this.apaP(c.p) + ').' : 'Not statistically significant (' + this.apaP(c.p) + ').') + ' Correlation is not causation.'),
            h('span', { className: 'cm-apa' }, h('span', { className: 'cm-k' }, 'APA'), h('span', null, apa)),
            h('div', { className: 'tl-row' }, this.tlBtn('Copy APA', () => { try { navigator.clipboard.writeText(apa).then(() => this.flash('APA line copied')); } catch (e) {} }), this.tlBtn('Regression →', () => this.setState({ tab: 'reg', regModel: 'ols', depVar: a, predictors: [b] })), this.tlBtn('Pair page →', () => this.setState({ tab: 'two', twoMode: 'corr', xVar: b, yVar: a }))))));
    } else pair = h('section', { className: 'tl-panel' }, h('div', { className: 'cm-body' }, this.tlBanner('warn', a + ' and ' + b + ': ' + (c.err || 'no correlation to compute') + '.')));
    const d = this.corDesc(), code = d ? h('details', { className: 'cm-code' }, h('summary', null, (S.dialect === 'r' ? 'R' : 'Stata') + ' output · ', h('code', null, this.cmdText(this.tagSg(d), S.dialect).split('\n').pop())), h('pre', null, this.cmdText(this.tagSg(d), S.dialect) + '\n\n' + d.tbl)) : null;
    return h('div', { className: 'tl cm' }, setup, matrix, pair, code ? h('section', { className: 'tl-panel' }, h('div', { className: 'cm-body' }, code)) : null);
  }
  // GM26 correlation matrix end
