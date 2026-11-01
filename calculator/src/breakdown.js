  // GM26 breakdown begin
  // ===== Univariate tab: break the variable down by one or two groups
  // Stata: table rowvar colvar, statistic(mean var) · tabstat var, by() · tab var if a==1 & b==2018
  obS() { return Object.assign({ rows: '', cols: '', stat: '', level: '', fill: true, showN: true, totals: true, cell: null }, this.state.ob || {}); }
  obSet(p) { this.setState(st => ({ ob: Object.assign({}, this.obS(), st.ob || {}, p) })); }
  obLevels(name, labs, codes, fill) {
    const m = new Map();
    for (let i = 0; i < labs.length; i++) { const l = labs[i]; if (l == null || m.has(l)) continue; m.set(l, codes && isFinite(codes.a[i]) ? codes.a[i] : NaN); }
    let arr = [...m].map(([label, code]) => ({ label, code }));
    arr.sort((a, b) => (isFinite(a.code) && isFinite(b.code)) ? a.code - b.code : String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
    if (fill && arr.length > 1 && arr.every(x => Number.isInteger(x.code))) {
      const lo = arr[0].code, hi = arr[arr.length - 1].code;
      if (hi - lo <= 400 && hi - lo + 1 > arr.length) { const have = new Map(arr.map(x => [x.code, x])); arr = []; for (let k = lo; k <= hi; k++) arr.push(have.get(k) || { label: String(this.vlabel(name, this._E.numLab(k))), code: k, empty: true }); }
    }
    return arr;
  }
  obWScale() {
    const wv = this.state.weightVar; if (!wv) return 1;
    return this.memo('w|obscale|' + wv, () => {
      const m = (this.state.cols || []).find(c => c.name === wv); if (!m) return 1;
      const col = this._raw.cols[m.idx]; let sum = 0, cnt = 0;
      for (let i = 0; i < this._raw.n; i++) { const x = col.k === 'n' ? col.a[i] : Number(String(col.a[i] == null ? '' : col.a[i]).trim()); if (isFinite(x) && x > 0) { sum += x; cnt++; } }
      return cnt ? sum / cnt : 1;
    });
  }
  obCompute(v, rowsV, colsV, stat, level, fill) {
    const n = this._raw.n, w = this.wArr(), wf = w ? this.obWScale() : 1;
    const vl = this.groupLab(v), vn = this.numCore(v), rl = this.groupLab(rowsV), rc = this.numCore(rowsV);
    const cl = colsV ? this.groupLab(colsV) : null, cc = colsV ? this.numCore(colsV) : null;
    if (!vl || !rl || (colsV && !cl)) return null;
    const rows = this.obLevels(rowsV, rl, rc, fill), cols = colsV ? this.obLevels(colsV, cl, cc, false) : [];
    const rIdx = new Map(rows.map((x, i) => [x.label, i])), cIdx = new Map(cols.map((x, i) => [x.label, i]));
    const R = rows.length, Cn = cols.length, keepVals = stat === 'median' || stat === 'min' || stat === 'max';
    const mk = () => ({ n: 0, wN: 0, wHit: 0, nNum: 0, wNum: 0, wSum: 0, wSq: 0, vals: keepVals ? [] : null, lev: new Map(), levN: new Map() });
    const grid = Array.from({ length: R + 1 }, () => Array.from({ length: Cn + 1 }, mk));
    let dropG = 0, dropV = 0;
    const add = (c, i, wi) => {
      c.n++; c.wN += wi; const lab = vl[i]; if (lab === level) c.wHit += wi; c.lev.set(lab, (c.lev.get(lab) || 0) + wi); c.levN.set(lab, (c.levN.get(lab) || 0) + 1);
      if (vn) { const x = vn.a[i]; if (isFinite(x)) { c.nNum++; c.wNum += wi; c.wSum += wi * x; c.wSq += wi * x * x; if (c.vals) c.vals.push(x); } }
    };
    for (let i = 0; i < n; i++) {
      const rlab = rl[i]; if (rlab == null) { if (vl[i] != null) dropG++; continue; }
      let ci = Cn; if (colsV) { const clab = cl[i]; if (clab == null) { if (vl[i] != null) dropG++; continue; } ci = cIdx.get(clab); }
      if (vl[i] == null) { dropV++; continue; }
      const wi = w ? w[i] * wf : 1; if (!(wi > 0)) continue;
      const ri = rIdx.get(rlab);
      add(grid[ri][ci], i, wi); add(grid[R][ci], i, wi);
      if (colsV) { add(grid[ri][Cn], i, wi); add(grid[R][Cn], i, wi); }
    }
    return { rows, cols, grid, dropG, dropV, vLevels: this.obLevels(v, vl, vn, false).map(x => x.label) };
  }
  obValue(c, stat) {
    if (!c || !c.n) return NaN;
    if (stat === 'pct') return 100 * c.wHit / c.wN;
    if (stat === 'count') return c.wHit;
    if (stat === 'n') return c.n;
    if (stat === 'wn') return c.wN;
    if (stat === 'mean') return c.wNum ? c.wSum / c.wNum : NaN;
    if (stat === 'sum') return c.wSum;
    if (stat === 'sd') { if (c.nNum < 2 || !c.wNum) return NaN; const mu = c.wSum / c.wNum; return Math.sqrt(Math.max(0, (c.wSq / c.wNum - mu * mu) * c.nNum / (c.nNum - 1))); }
    if (c.vals && c.vals.length) { const s = c.vals.slice().sort((a, b) => a - b); if (stat === 'min') return s[0]; if (stat === 'max') return s[s.length - 1]; const m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; }
    return NaN;
  }
  obRender() {
    const h = React.createElement, S = this.state, O = this.obS(), v = S.exploreVar, m = this.effMeta(v);
    if (!m || !this._E) return null;
    const isCat = m.treatAs !== 'numeric', isNum = m.type === 'numeric', set = p => this.obSet(p);
    const all = (S.cols || []).map(c => c.name).filter(nm => nm !== v);
    const rowsOpt = [['', 'pick a variable (e.g. year)']].concat(all.filter(nm => { const c = this.effMeta(nm); return c && (c.distinct || 0) <= 1500; }).map(nm => [nm, nm]));
    const colsOpt = [['', 'none']].concat(all.filter(nm => nm !== O.rows && ((this.effMeta(nm) || {}).distinct || 0) <= 40).map(nm => [nm, nm]));
    const vl = this.groupLab(v), levels = vl ? this.obLevels(v, vl, this.numCore(v), false).map(x => x.label) : [];
    const defLevel = levels.includes('1') ? '1' : levels.length === 2 ? levels[1] : levels[0] || '';
    const level = levels.includes(O.level) ? O.level : defLevel;
    const stats = (isCat ? [['pct', '% where ' + v + ' = …'], ['count', 'Count where ' + v + ' = …'], ['tab', 'Full tabulation']] : []).concat(isNum ? [['mean', 'Mean'], ['sum', 'Sum'], ['sd', 'Std. dev.'], ['median', 'Median'], ['min', 'Min'], ['max', 'Max']] : []).concat([['n', 'N (observations)']]).concat(S.weightVar ? [['wn', 'Population (weighted)']] : []);
    const stat = stats.some(s => s[0] === O.stat) ? O.stat : stats[0][0];
    const ctl = h('div', { className: 'tl-col' },
      h('div', { className: 'tl-row wide' },
        this.tlField('Rows', this.tlSelect(O.rows, rowsOpt, x => set({ rows: x, cell: null }), 'Break down by (rows)')),
        this.tlField('Columns (optional)', this.tlSelect(O.cols === O.rows ? '' : O.cols, colsOpt, x => set({ cols: x, cell: null }), 'Break down by (columns)')),
        isCat && (stat === 'pct' || stat === 'count') ? this.tlField(v + ' =', this.tlSelect(level, levels.map(l => [l, l]), x => set({ level: x }), 'Category to count')) : null),
      this.tlField('Show in each cell', this.tlSeg(stats, stat, x => set({ stat: x }))),
      h('div', { className: 'tl-row' }, this.tlChip('Every value in the range', O.fill, () => set({ fill: !O.fill }), { title: 'Show every year (or other whole number) between the lowest and highest, even with no data' }), this.tlChip('Show N', O.showN, () => set({ showN: !O.showN })), this.tlChip('Totals', O.totals, () => set({ totals: !O.totals }))));
    const head = (body) => h('section', { className: 'tl-panel ob', 'data-screen-label': 'Break down by groups' },
      h('div', { className: 'tl-ptitle' }, h('h3', null, 'Break down by groups'), h('span', null, 'tab / sum of ' + v + ' by one or two variables — like Stata table and tabstat')), ctl, ...body);
    if (!O.rows || !this.effMeta(O.rows)) return head([this.tlBanner('info', 'Pick a variable for the rows, for example year, and optionally one for the columns, for example sex. Each cell shows ' + v + ' for that combination — like tab ' + v + ' if sexo == 1 & year == 2018, for every combination at once.')]);
    const colsV = O.cols && O.cols !== O.rows && this.effMeta(O.cols) ? O.cols : '';
    const key = 'ob|' + v + '|' + O.rows + '|' + colsV + '|' + (stat === 'tab' ? 'tab' : stat) + '|' + level + '|' + O.fill + '|' + (S.weightVar || '');
    const res = this.memo(key, () => this.obCompute(v, O.rows, colsV, stat, level, O.fill));
    if (!res) return head([this.tlBanner('warn', 'These variables could not be read.')]);
    const { rows, cols, grid } = res, Rn = rows.length, Cn = cols.length;
    const pct = stat === 'pct', whole = stat === 'n' || stat === 'wn' || stat === 'count' || stat === 'sum', dec = pct ? 1 : this.dec();
    const fmtV = x => !isFinite(x) ? '—' : pct ? x.toFixed(1) + '%' : whole ? this.fmtN(Math.round(x)) : this.fmt(x, dec);
    const wN = S.weightVar ? ' (weighted)' : '';
    const codeOf = (name, lab) => { const lv = this.obLevels(name, this.groupLab(name) || [], this.numCore(name), false).find(x => x.label === lab); return lv && isFinite(lv.code) ? this._E.numLab(lv.code) : '"' + lab + '"'; };
    const pick = (ri, ci) => set({ cell: [ri, ci] });
    let table;
    if (stat === 'tab') {
      const vL = res.vLevels, blocks = colsV ? cols.map((c, ci) => [c.label, ci]).concat(O.totals ? [['Total', Cn]] : []) : [['', Cn]];
      table = h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-tbl' },
        h('thead', null, colsV ? h('tr', null, h('th', null, ''), ...blocks.map(([l, ci]) => h('th', { key: ci, className: 'n ob-blk', colSpan: vL.length + (O.showN ? 1 : 0) }, colsV + ' = ' + l))) : null,
          h('tr', null, h('th', null, O.rows), ...blocks.flatMap(([l, ci]) => vL.map(x => h('th', { key: ci + '|' + x, className: 'n' }, x)).concat(O.showN ? [h('th', { key: ci + 'N', className: 'n' }, 'N')] : [])))),
        h('tbody', null, rows.map((r, ri) => ri).concat(O.totals ? [Rn] : []).map(ri => h('tr', { key: ri, className: ri === Rn ? 'ob-tot' : rows[ri] && rows[ri].empty ? 'ob-empty' : '' }, h('td', { className: 'w' }, ri === Rn ? 'Total' : rows[ri].label),
          ...blocks.flatMap(([l, ci]) => { const c = grid[ri][ci]; return vL.map(x => h('td', { key: ci + '|' + x, className: 'n' }, c.n ? (100 * (c.lev.get(x) || 0) / c.wN).toFixed(1) + '%' : '—')).concat(O.showN ? [h('td', { key: ci + 'N', className: 'n ob-n' }, c.n ? this.fmtN(c.n) : '—')] : []); }))))));
    } else {
      const colKeys = colsV ? cols.map((c, ci) => ci).concat(O.totals ? [Cn] : []) : [Cn];
      table = h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-tbl ob-grid' },
        h('thead', null, h('tr', null, h('th', null, colsV ? O.rows + ' \\ ' + colsV : O.rows), ...colKeys.map(ci => h('th', { key: ci, className: 'n' }, ci === Cn ? (colsV ? 'Total' : (stats.find(s => s[0] === stat) || [])[1]) : cols[ci].label)))),
        h('tbody', null, rows.map((r, ri) => ri).concat(O.totals ? [Rn] : []).map(ri => h('tr', { key: ri, className: ri === Rn ? 'ob-tot' : rows[ri].empty ? 'ob-empty' : '' }, h('td', { className: 'w' }, ri === Rn ? 'Total' : rows[ri].label),
          ...colKeys.map(ci => { const c = grid[ri][ci], val = this.obValue(c, stat), on = O.cell && O.cell[0] === ri && O.cell[1] === ci; return h('td', { key: ci, className: 'n' }, c.n ? h('button', { type: 'button', className: 'ob-cell' + (on ? ' on' : ''), title: 'Show the full tabulation for this cell', onClick: () => pick(ri, ci) }, h('span', null, fmtV(val)), O.showN ? h('small', null, 'N ' + this.fmtN(c.n)) : null) : h('span', { className: 'ob-none' }, '—')); }))))));
    }
    // chart: over the rows (lines per column group) when the rows are ordered numbers; drawn by the chart builder
    // so it gets the same Customize panel as the Charts tab (names, values at each year, colors)
    let chart = null;
    const numericRows = rows.length > 1 && rows.every(r => isFinite(r.code));
    if (stat !== 'tab' && rows.length > 1) {
      const ylab = pct ? '% where ' + v + ' = ' + level : stat === 'count' ? 'count where ' + v + ' = ' + level + wN : (stats.find(s => s[0] === stat) || [])[1] + ' of ' + v + (stat === 'n' || stat === 'wn' ? '' : wN);
      const autoTitle = ylab + ' by ' + O.rows + (colsV ? ' and ' + colsV : '');
      const fileName = 'breakdown-' + v + '-by-' + O.rows + (colsV ? '-' + colsV : '');
      if (this._E.cbScene && this.cbMini) chart = this.obChart({ v, O, set, rows, cols, grid, Cn, colsV, stat, pct, ylab, autoTitle, numericRows, level, fileName });
      else chart = h('div', { className: 'tl-col' }, numericRows ? this.tlLinesSvg('obline', rows.map(r => r.label), (colsV ? cols.map((c, ci) => ({ name: c.label, color: this.tlPal(ci), pts: rows.map((r, ri) => this.obValue(grid[ri][ci], stat)) })) : []).concat(!colsV || O.totals ? [{ name: colsV ? 'Total' : v, color: colsV ? '#6B6455' : this.tlPal(0), pts: rows.map((r, ri) => this.obValue(grid[ri][Cn], stat)) }] : []), { ylab, pct, connect: true, title: autoTitle })
        : this.tlBarsSvg('obline', rows.map((r, ri) => ({ label: r.label, value: this.obValue(grid[ri][Cn], stat), color: this.tlPal(0) })).filter(x => isFinite(x.value)), { title: ylab + ' by ' + O.rows, xlab: ylab, pct }), this.tlExportRow('obline', fileName));
    }
    // one cell in full: tab v if rows == r & cols == c
    let detail = null;
    if (O.cell && grid[O.cell[0]] && grid[O.cell[0]][O.cell[1]] && grid[O.cell[0]][O.cell[1]].n) {
      const [ri, ci] = O.cell, c = grid[ri][ci];
      const conds = [ri < Rn ? O.rows + ' == ' + codeOf(O.rows, rows[ri].label) : null, colsV && ci < Cn ? colsV + ' == ' + codeOf(colsV, cols[ci].label) : null].filter(Boolean);
      const cmd = 'tab ' + v + (conds.length ? ' if ' + conds.join(' & ') : '');
      const lv = [...c.lev.entries()].sort((a, b) => res.vLevels.indexOf(a[0]) - res.vLevels.indexOf(b[0]));
      let cum = 0; const W = !!S.weightVar;
      detail = h('div', { className: 'tl-col ob-detail' }, h('div', { className: 'tl-row' }, h('code', { className: 'ob-cmd' }, '. ' + cmd + (W ? ' [aw=' + S.weightVar + ']' : '')), this.tlBtn('Close', () => set({ cell: null }))),
        h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, v), h('th', { className: 'n' }, 'Freq.'), W ? h('th', { className: 'n' }, 'Weighted total') : null, h('th', { className: 'n' }, 'Percent' + wN), h('th', { className: 'n' }, 'Cum.'))),
          h('tbody', null, lv.map(([l, x]) => { cum += x; return h('tr', { key: l }, h('td', { className: 'w' }, l), h('td', { className: 'n' }, this.fmtN(c.levN.get(l) || 0)), W ? h('td', { className: 'n' }, this.fmtN(Math.round(x))) : null, h('td', { className: 'n' }, (100 * x / c.wN).toFixed(2)), h('td', { className: 'n' }, (100 * cum / c.wN).toFixed(2))); }).concat([h('tr', { key: 'tot', className: 'ob-tot' }, h('td', { className: 'w' }, 'Total'), h('td', { className: 'n' }, this.fmtN(c.n)), W ? h('td', { className: 'n' }, this.fmtN(Math.round(c.wN))) : null, h('td', { className: 'n' }, '100.00'), h('td', { className: 'n' }, ''))]))),
        isNum && c.wNum ? h('span', { className: 'tl-hint' }, 'summarize ' + v + (conds.length ? ' if ' + conds.join(' & ') : '') + (W ? ' [aw=' + S.weightVar + ']' : '') + ': mean ' + this.fmt(c.wSum / c.wNum) + ', sd ' + this.fmt(this.obValue(c, 'sd')) + ', N ' + this.fmtN(c.nNum)) : null);
    }
    // reproducible code
    const wS = S.weightVar ? ' [pw=' + S.weightVar + ']' : '', ifS = this.conds().length ? ' if ' + this.conds().map(c => this.condExpr(c, 'stata')).join(' & ') : '';
    const ex = O.cell ? null : 'tab ' + v + ' if ' + O.rows + ' == ' + codeOf(O.rows, (rows.find(r => !r.empty) || rows[0]).label) + (colsV && cols[0] ? ' & ' + colsV + ' == ' + codeOf(colsV, cols[0].label) : '');
    const stataStat = { mean: 'mean', sum: 'total', sd: 'sd', median: 'median', min: 'min', max: 'max', n: 'count', wn: 'frequency' }[stat];
    const stata = (stat === 'pct' || stat === 'count' ? 'generate byte _is = (' + v + ' == ' + codeOf(v, level) + ') if !missing(' + v + ')\ntable ' + O.rows + (colsV ? ' ' + colsV : '') + wS + ifS + ', statistic(' + (pct ? 'mean' : 'total') + ' _is) statistic(count _is)' + (pct ? '   // mean × 100 = %' : '') + '\n'
      : stat === 'tab' ? 'table ' + O.rows + ' ' + v + (colsV ? ' ' + colsV : '') + wS + ifS + ', statistic(percent, across(' + v + '))\n'
      : 'table ' + O.rows + (colsV ? ' ' + colsV : '') + wS + ifS + ', statistic(' + stataStat + ' ' + v + ') statistic(count ' + v + ')\n') +
      'tabstat ' + v + wS.replace('pw', 'aw') + ifS + ', by(' + O.rows + ') statistics(mean ' + (S.weightVar ? '' : 'sum ') + 'n)\n' + (ex ? '* one cell:\n' + ex + '\n' : '');
    const rW = S.weightVar ? S.weightVar : null;
    const rStat = { pct: '100 * ' + (rW ? 'weighted.mean(' + v + ' == ' + codeOf(v, level) + ', ' + rW + ', na.rm = TRUE)' : 'mean(' + v + ' == ' + codeOf(v, level) + ', na.rm = TRUE)'), count: 'sum(' + (rW ? rW + ' * ' : '') + '(' + v + ' == ' + codeOf(v, level) + '), na.rm = TRUE)', mean: rW ? 'weighted.mean(' + v + ', ' + rW + ', na.rm = TRUE)' : 'mean(' + v + ', na.rm = TRUE)', sum: 'sum(' + (rW ? rW + ' * ' : '') + v + ', na.rm = TRUE)', sd: 'sd(' + v + ', na.rm = TRUE)', median: 'median(' + v + ', na.rm = TRUE)', min: 'min(' + v + ', na.rm = TRUE)', max: 'max(' + v + ', na.rm = TRUE)', n: 'dplyr::n()', wn: 'sum(' + (rW || '1') + ')', tab: rW ? 'sum(' + rW + ')' : 'dplyr::n()' }[stat];
    const r = 'library(dplyr)\ndf |>' + (ifS ? ' filter(' + this.conds().map(c => this.condExpr(c, 'r')).join(', ') + ') |>' : '') + ' filter(!is.na(' + v + '), !is.na(' + O.rows + ')' + (colsV ? ', !is.na(' + colsV + ')' : '') + ') |>\n  group_by(' + O.rows + (colsV ? ', ' + colsV : '') + (stat === 'tab' ? ', ' + v : '') + ') |>\n  summarise(value = ' + rStat + ', n = n()' + ') |>\n  tidyr::pivot_wider(names_from = ' + (stat === 'tab' ? v : colsV || O.rows) + ', values_from = ' + (stat === 'tab' ? 'n' : 'value') + ')' + (colsV || stat === 'tab' ? '' : '   # one column per value of ' + O.rows);
    const code = S.dialect === 'r' ? r : stata;
    const note = [res.dropV ? this.fmtN(res.dropV) + ' rows with a missing ' + v + ' left out' : null, res.dropG ? this.fmtN(res.dropG) + ' rows with a missing ' + O.rows + (colsV ? ' or ' + colsV : '') + ' left out' : null, S.weightVar ? 'weighted by ' + S.weightVar + ': % and means use the weights, counts and sums are weighted totals (population estimates), N is the number of observations; min, max and median unweighted' : null, rows.some(r0 => r0.empty) ? rows.filter(r0 => r0.empty).length + ' values of ' + O.rows + ' in the range have no observations (—)' : null].filter(Boolean).join(' · ');
    const tsv = () => { const ck = colsV ? cols.map((c, ci) => ci).concat(O.totals ? [Cn] : []) : [Cn]; const lines = [[colsV ? O.rows + '\\' + colsV : O.rows].concat(ck.map(ci => ci === Cn ? (colsV ? 'Total' : stat) : cols[ci].label)).join('\t')]; rows.map((r0, ri) => ri).concat(O.totals ? [Rn] : []).forEach(ri => lines.push([ri === Rn ? 'Total' : rows[ri].label].concat(ck.map(ci => { const x = this.obValue(grid[ri][ci], stat === 'tab' ? 'n' : stat); return isFinite(x) ? (Math.round(x * 1e4) / 1e4) : ''; })).join('\t'))); return lines.join('\n'); };
    return head([
      note ? h('span', { className: 'tl-hint' }, note) : null,
      table,
      h('div', { className: 'tl-row' }, this.tlBtn(S.copied === 'ob' ? 'Copied ✓' : 'Copy table (for Excel)', () => this.copyTSV('ob', tsv())), stat !== 'tab' ? h('span', { className: 'tl-hint' }, 'Click a cell for its full tabulation (tab ' + v + ' if …).') : null),
      detail, chart,
      h('details', { className: 'tl-details code' }, h('summary', null, (S.dialect === 'r' ? 'R' : 'Stata') + ' code'), h('pre', { className: 'tl-code' }, code), this.tlBtn(S.copied === 'obc' ? 'Copied ✓' : 'Copy', () => this.copyTSV('obc', code)))]);
  }
  obChart(o) {
    const h = React.createElement, S = this.state, E = this._E, { v, O, rows, cols, grid, Cn, colsV, stat, pct } = o;
    const cfg = O.chart || {}, setC = p => this.obSet({ chart: Object.assign({}, (this.obS().chart) || {}, p) });
    const pal = E.CB_PALETTES[cfg.palette || 'sendero'] || E.CB_PALETTES.sendero;
    const base = cfg.palette ? pal : [S.chartColor || pal[0], ...pal.filter(x => x.toLowerCase() !== String(S.chartColor || pal[0]).toLowerCase())];
    const totKey = colsV ? 'Total' : v;
    const ser = (colsV ? cols.map((c, ci) => ({ key: c.label, ci })) : []).concat(!colsV || O.totals ? [{ key: totKey, ci: Cn }] : []);
    const sNames = Object.assign({}, colsV ? this.cbNameMap(colsV) : {}, cfg.names || {}), rNames = Object.assign({}, this.cbNameMap(O.rows), cfg.names || {});
    const sColors = Object.assign({}, colsV ? this.cbColorMap(colsV) : {}, cfg.colors || {});
    const colorOf = (k, i) => sColors[k] || (colsV && k === 'Total' ? '#6B6455' : base[i % base.length]);
    const colors = {}; ser.forEach((s, i) => { colors[s.key] = colorOf(s.key, i); });
    const rowLab = r => (rNames[r.label] != null && String(rNames[r.label]).trim() !== '' ? String(rNames[r.label]) : r.label);
    let M;
    if (o.numericRows) {
      const xLabels = {}; let labelled = false; rows.forEach(r => { xLabels[r.code] = rowLab(r); if (xLabels[r.code] !== String(r.code)) labelled = true; });
      const series = ser.map(s => { const pts = rows.map((r, ri) => ({ x: r.code, y: this.obValue(grid[ri][s.ci], stat), n: grid[ri][s.ci].n })).filter(p => isFinite(p.y)); return { key: s.key, pts, segments: [pts], style: 'line' }; }).filter(s => s.pts.length);
      M = { type: 'xy', xTime: true, xLabels: labelled ? xLabels : null, series, seriesKeys: series.map(s => s.key), pct, zero: cfg.zero === '1' ? true : cfg.zero === '0' ? false : ['pct', 'count', 'n', 'wn', 'sum'].includes(stat) };
    } else {
      const sk = colsV ? cols.map(c => c.label) : ['All'], ci = colsV ? cols.map((c, i) => i) : [Cn];
      M = { type: 'cat', mode: colsV ? 'group' : 'single', colorBy: colsV ? 'series' : 'cat', cats: rows.map(r => r.label), series: sk, seriesKeys: sk, vals: rows.map((r, ri) => ci.map(c => { const x = this.obValue(grid[ri][c], stat); return isFinite(x) ? { v: x, n: grid[ri][c].n } : null; })), pct, zero: cfg.zero === '0' ? false : true };
      if (!colsV) colors.All = colorOf(v, 0);
    }
    const src = [S.fileName ? String(S.fileName).replace(/\.[^.]+$/, '') : null, S.weightVar ? 'weighted by ' + S.weightVar : null, this.conds().length ? 'rows: ' + this.conds().map(q => this.condLabel(q)).join(' & ') : null].filter(Boolean).join(' · ');
    const opt = { title: cfg.title || o.autoTitle, subtitle: cfg.subtitle || undefined, source: cfg.source || src, yTitle: o.numericRows ? o.ylab : undefined, xTitle: o.numericRows ? O.rows : undefined,
      names: Object.assign({}, sNames, colsV ? {} : { [v]: v }), catNames: rNames, colors, catColors: colsV ? {} : { All: colorOf(v, 0) }, palette: base,
      values: cfg.values || 'none', fmt: cfg.fmt || 'auto', decimals: cfg.decimals === '' || cfg.decimals == null ? null : +cfg.decimals, legend: cfg.legend || 'auto', everyX: cfg.everyX === '1' ? true : undefined, text: 'm', clipId: 'obline', markers: true };
    let sc; try { sc = E.cbScene(M, opt); } catch (e) { return this.tlBanner('warn', 'This chart could not be drawn: ' + e.message); }
    (this._plotName || (this._plotName = {})).obline = opt.title;
    const sets = [];
    if (colsV) sets.push({ role: 'series', title: o.numericRows ? 'Lines' : 'Bars', v: colsV, keys: cols.map(c => c.label), map: sNames, colorable: true, colors });
    if (colsV && O.totals) sets.push({ role: 'total', title: 'Total line', v: null, keys: ['Total'], map: cfg.names || {}, colorable: true, colors });
    if (!colsV) sets.push({ role: 'single', title: '', v: null, keys: [v], map: {}, colorable: true, colors: { [v]: colorOf(v, 0) } });
    const rowsNamable = rows.length <= 40 && rows.some(r => !isFinite(r.code) || String(r.code) !== r.label || this.colIdx(O.rows) >= 0 && this._raw.cols[this.colIdx(O.rows)].k !== 'n');
    if (rowsNamable) sets.push({ role: 'rows', title: o.numericRows ? 'Points on the axis' : 'Bars', v: O.rows, keys: rows.map(r => r.label), map: rNames, colorable: false });
    return h('div', { className: 'tl-col' },
      h('figure', { className: 'cb-fig ob-fig', style: { margin: 0 } }, h('svg', { viewBox: '0 0 ' + sc.width + ' ' + sc.height, role: 'img', 'aria-label': opt.title, ref: this.svgRef('obline'), style: { display: 'block', width: '100%', height: 'auto' }, dangerouslySetInnerHTML: { __html: sc.markup } })),
      this.tlExportRow('obline', o.fileName),
      this.cbMini({ id: 'ob', cfg, set: setC, sets, lineish: o.numericRows, autoTitle: o.autoTitle, colorOf: (k, i) => colors[k] || colorOf(k, i),
        open: this.obBuilderPage(o) ? () => this.obToBuilder(o) : null }));
  }
  // open the same breakdown as a page in the Charts tab (only when the Charts page computes exactly the same numbers)
  obBuilderPage(o) {
    const { v, O, colsV, stat, level } = o, time = o.numericRows, w = !!this.state.weightVar;
    if (time) {
      const st = stat === 'mean' ? 'mean' : stat === 'sum' ? 'sum' : stat === 'n' && !w ? 'count' : stat === 'wn' && w ? 'count' : stat === 'pct' && String(level) === '1' && this.obIsBinary(v) ? 'pct' : null;
      if (!st) return null;
      return { id: 'multiline', page: { stat: st, y: st === 'count' ? '' : v, x: O.rows, group: colsV || '', sel: colsV ? o.cols.map(c => c.label).slice(0, 12) : [] } };
    }
    if (colsV) return stat === 'n' && !w || stat === 'wn' && w ? { id: 'groupbar', page: { x: O.rows, y: colsV, stat: 'count' } } : null;
    const st = stat === 'mean' ? 'mean' : stat === 'sum' ? 'sum' : stat === 'n' && !w || stat === 'wn' && w ? 'count' : null;
    return st ? { id: 'bar', page: { x: O.rows, stat: st, y: st === 'count' ? '' : v } } : null;
  }
  obIsBinary(v) { const d = this.numCore(v); if (!d) return false; for (let i = 0; i < d.length; i++) { const x = d[i]; if (x != null && isFinite(x) && x !== 0 && x !== 1) return false; } return true; }
  obToBuilder(o) {
    const t = this.obBuilderPage(o); if (!t) return;
    const cfg = o.O.chart || {}, keep = {}; ['title', 'subtitle', 'values', 'fmt', 'decimals', 'legend', 'everyX', 'palette', 'colors', 'names'].forEach(k => { if (cfg[k] != null && cfg[k] !== '') keep[k] = cfg[k]; });
    this.cbOpenWith(t.id, Object.assign({}, t.page, keep));
  }
  // GM26 breakdown end
