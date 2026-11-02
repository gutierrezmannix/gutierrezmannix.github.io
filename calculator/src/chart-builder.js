  // ---- GM26 chart builder (Design A): say what to show, see it at once, adjust it underneath
  cbHandles(id) { const E = this._E; return !!(id && E && E.cbFamilyOf && !['__directory', '__gallery', 'map', 'geomap'].includes(id) && E.cbFamilyOf(id)); }
  cbC() { return ((this.state.csPages || {})[this.state.plotKind]) || {}; }
  cbSet(p) { this.csSet(typeof p === 'function' ? p(this.cbC()) : p); }
  cbSwitch(k) {
    const S = this.state, cur = this.cbC(), next = (S.csPages || {})[k] || {}, keep = {};
    ['x', 'y', 'group', 'facet', 'lo', 'hi', 'vars', 'stat', 'sel', 'ys', 't0', 't1', 'title', 'subtitle', 'source'].forEach(f => { if (cur[f] != null && next[f] == null) keep[f] = cur[f]; });
    this.setState(s => ({ csPages: Object.assign({}, s.csPages, { [k]: Object.assign({}, keep, next) }) }), () => this.csOpen(k));
  }
  cbNumeric() { return (this.state.cols || []).filter(v => { const m = this.effMeta(v.name); return m && (m.type === 'numeric' || m.treatAs === 'numeric'); }); }
  cbVarSel(key, label, type, optional, extra) {
    const h = React.createElement, c = this.cbC(), list = type === 'num' ? this.cbNumeric() : (this.state.cols || []);
    const opts = [['', optional ? 'None' : 'Pick a variable…']].concat(list.map(v => [v.name, v.name + (v.label ? ' — ' + String(v.label).slice(0, 40) : '')]));
    return this.tlField(label, this.tlSelect(c[key] || '', opts, val => this.cbSet(Object.assign({ [key]: val }, extra || {})), label, { className: 'tl-select cb-vsel' }));
  }
  cbChoice(key, label, options, def) { const c = this.cbC(); return this.tlField(label, this.tlSelect(c[key] != null ? c[key] : def, options, val => this.cbSet({ [key]: val }), label)); }
  cbSeg(key, options, def, aria) { const c = this.cbC(); return this.tlSeg(options, c[key] != null ? c[key] : def, val => this.cbSet({ [key]: val }), { 'aria-label': aria }); }
  cbCheck(key, label, def) { const h = React.createElement, c = this.cbC(); return h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: c[key] != null ? !!c[key] : !!def, onChange: e => this.cbSet({ [key]: e.target.checked }) }), label); }
  cbText(key, label, placeholder, width) { const c = this.cbC(); return this.tlField(label, this.tlText(c[key] || '', val => this.cbSet({ [key]: val }), { k: key + '|' + this.state.plotKind, placeholder, aria: label, width })); }
  cbLevels(v, cap) {
    if (!v || !this.effMeta(v)) return []; const c = this.cbC(), id = this.state.plotKind, mx = this.cbCatCap(id, v, c), mode = this.cbCatMode(v, c), info = this.cbCatInfo(v);
    const grouped = mode && mode !== 'each' || !mode && info.distinct > 40;
    return this.memo('cbLv|' + v + '|' + mode + '|' + mx + '|' + (this.state.dver || 0), () => { const r = this._E.freqOf(this.cbCatLab(v, c, mx), null).rows.map(q => String(q.label)); return grouped ? r.sort(this._E.cbNatural) : r; }).slice(0, cap || 400);
  }
  // ---- many categories: number variables go into ranges (15–19, 20–24 …), text into the largest ones plus “Other”
  cbCatMode(v, c) { return String(((c || {}).grp || {})[v] || ''); }
  cbCatCap(id, v, c) { return id === 'heatmap' && v === c.x ? 120 : id === 'heatmap' && v === c.group ? 60 : 40; }
  cbCatInfo(v) {
    return this.memo('cbci|' + v + '|' + (this.state.dver || 0), () => {
      const raw = this._raw, idx = this.colIdx(v), col = idx >= 0 ? raw.cols[idx] : null, vl = raw && raw.vlabs && raw.vlabs[v], m = this.effMeta(v) || {};
      const labelled = vl instanceof Map ? vl.size > 0 : !!(vl && Object.keys(vl).length);
      const cv = this.vals(v);
      if (cv && cv.kind === 'num' && !labelled && col && col.k === 'n') {
        const a = cv.a, seen = new Set(); let lo = Infinity, hi = -Infinity, allInt = true;
        for (let i = 0; i < a.length; i++) { const x = a[i]; if (!isFinite(x)) continue; if (x < lo) lo = x; if (x > hi) hi = x; if (allInt && !Number.isInteger(x)) allInt = false; if (seen.size <= 5000) seen.add(x); }
        return { num: true, lo, hi, allInt, distinct: seen.size > 5000 ? Math.max(m.distinct || 0, 5001) : seen.size };
      }
      const L = this.groupLab(v) || [], counts = new Map(); for (let i = 0; i < L.length; i++) { const x = L[i]; if (x == null || x === '') continue; const k = String(x); counts.set(k, (counts.get(k) || 0) + 1); }
      return { num: false, counts, distinct: counts.size };
    });
  }
  cbBins(info, w) { const start = Math.floor(info.lo / w + 1e-9) * w; return { start, n: Math.floor((info.hi - start) / w + 1e-9) + 1 }; }
  cbWidths(info) {
    if (!(info.hi > info.lo)) return [];
    const out = []; for (let e = -4; e <= 9; e++) for (const k of [1, 2, 2.5, 5]) { const w = Number((k * Math.pow(10, e)).toPrecision(6)); if (info.allInt && !Number.isInteger(w)) continue; const n = this.cbBins(info, w).n; if (n >= 3 && n <= 60) out.push({ w, n }); }
    return out;
  }
  cbAutoWidth(info) { const ws = this.cbWidths(info); const ok = ws.filter(x => x.n <= 20); return ok.length ? ok[0].w : ws.length ? ws[ws.length - 1].w : 1; }
  cbRangeLab(a, w, allInt) {
    const r = x => { const v = Number(x.toPrecision(10)); return Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : String(v); };
    return allInt ? (w === 1 ? r(a) : r(a) + '–' + r(a + w - 1)) : r(a) + '–' + r(a + w);
  }
  cbCatLab(v, c, cap) {
    const base = this.groupLab(v) || [], mode = this.cbCatMode(v, c), info = this.cbCatInfo(v), mx = cap || 40;
    if (mode === 'each' || (!mode && info.distinct <= 40)) return base;  // automatic: group above 40 values; “each value” allowed up to the chart’s limit
    const dv = this.state.dver || 0;
    if (info.num) {
      const w = mode && isFinite(+mode) && +mode > 0 ? +mode : this.cbAutoWidth(info);
      return this.memo('cbbin|' + v + '|' + w + '|' + dv, () => { const a = this.vals(v).a, { start } = this.cbBins(info, w), out = new Array(a.length), seen = new Map();
        for (let i = 0; i < a.length; i++) { const x = a[i]; if (!isFinite(x)) { out[i] = null; continue; } const lo = start + Math.floor((x - start) / w + 1e-9) * w; let l = seen.get(lo); if (l === undefined) { l = this.cbRangeLab(lo, w, info.allInt); seen.set(lo, l); } out[i] = l; }
        return out; });
    }
    const top = mode && isFinite(+mode) && +mode > 0 ? +mode : 20;
    return this.memo('cbtop|' + v + '|' + top + '|' + dv, () => { const keep = new Set([...info.counts].sort((p, q) => q[1] - p[1]).slice(0, top).map(e => e[0]));
      return Array.from(base, x => x == null || x === '' ? null : keep.has(String(x)) ? x : this._E.CB_OTHER); });
  }
  // the control in the data sentence: shown for a category variable with more than 12 values
  cbCatKeys(id, c) {
    if (['coefficient', 'modelcompare', 'prediction', 'marginal', 'interaction', 'event', 'conjoint', 'hist', 'box', 'scatter', 'matrix', 'corrmap', 'paired', 'hexbin'].includes(id)) return ['facet'];
    return { pie: ['x', 'facet'], donut: ['x', 'facet'], bar: ['x'], dot: ['x'], groupbar: ['x', 'y'], stackcount: ['x', 'y'], stack: ['x', 'y'], likert: ['x'], gbox: ['x'], violin: ['x', 'facet'], line: ['group'], area: ['group'], panel: ['group'], multiline: ['group'], mean: ['x', 'facet'], proportion: ['x', 'facet'], dumbbell: ['x', 'facet'], slope: ['x', 'facet'], heatmap: ['x', 'group', 'facet'], density: ['group', 'facet'], scatterplain: ['group', 'facet'], smooth: ['group', 'facet'], survival: ['group', 'facet'] }[id] || [];
  }
  cbCatControl(id, k) {
    const c = this.cbC(), v = c[k]; if (!v || !this.effMeta(v)) return null;
    const info = this.cbCatInfo(v), mode = this.cbCatMode(v, c), mx = this.cbCatCap(id, v, c);
    if (info.distinct <= 12 && !mode) return null;
    const set = val => this.cbSet(cc => ({ grp: Object.assign({}, cc.grp, { [v]: val }), sel: k === 'group' ? [] : cc.sel }));
    const many = info.distinct > 40, nTxt = info.distinct > 5000 ? 'more than 5,000' : info.distinct.toLocaleString('en-US');
    let opts;
    if (info.num) {
      const aw = this.cbAutoWidth(info), ws = this.cbWidths(info), nb = w => this.cbBins(info, w).n;
      opts = many ? [['', 'Ranges of ' + this.cbRangeW(aw) + ' (' + nb(aw) + ' groups) — automatic']] : [['', 'Each value (' + nTxt + ')']];
      opts = opts.concat(ws.filter(x => !(many && x.w === aw)).map(x => [String(x.w), 'Ranges of ' + this.cbRangeW(x.w) + ' (' + x.n + ' groups)']));
      if (many && info.distinct <= mx) opts.push(['each', 'Each value (' + nTxt + ')']);
    } else {
      const autoTop = 20;
      opts = many ? [['', 'The ' + autoTop + ' largest, the rest as Other — automatic']] : [['', 'All ' + nTxt + ' categories']];
      opts = opts.concat([5, 8, 10, 15, 20, 25, 30, 39].filter(n => n < info.distinct && n < mx && !(many && n === autoTop)).map(n => [String(n), 'The ' + n + ' largest, the rest as Other']));
      if (many && info.distinct <= mx) opts.push(['each', 'All ' + nTxt + ' categories']);
    }
    const seen = new Set(); opts = opts.filter(o => { if (seen.has(o[0]) && o[0] !== '') return false; seen.add(o[0]); return true; });
    const cur = opts.some(o => o[0] === mode) ? mode : '';
    return this.tlField(v + ' has ' + nTxt + ' values', this.tlSelect(cur, opts.filter((o, i) => !(o[0] === '' && i > 0)), set, 'Group ' + v));
  }
  cbRangeW(w) { return Math.abs(w) >= 1000 ? w.toLocaleString('en-US') : String(w); }

  // the data sentence for each chart
  cbFields(id) {
    const h = React.createElement, c = this.cbC(), f = [], E = this._E, est = ['coefficient', 'modelcompare', 'prediction', 'marginal', 'interaction', 'event', 'conjoint'].includes(id);
    if (id === 'pie' || id === 'donut') f.push(this.cbVarSel('x', 'Show the share of each', 'any'), this.cbVarSel('facet', 'One per', 'any', true), this.cbChoice('sort', 'Slice order', [['size', 'Largest first'], ['category', 'Category order']], 'size'), this.cbText('other', 'Combine slices under (%)', '0', 90), this.cbCheck('missing', 'Include missing as a slice'));
    else if (id === 'bar' || id === 'dot') { const st = c.stat || 'count'; f.push(this.cbChoice('stat', 'Show', [['count', 'the number of rows'], ['percent', 'the % of rows'], ['mean', 'the mean of'], ['sum', 'the sum of']], 'count')); if (st === 'mean' || st === 'sum') f.push(this.cbVarSel('y', 'Variable', 'num')); f.push(this.cbVarSel('x', 'For each category of', 'any')); }
    else if (id === 'groupbar' || id === 'stackcount') f.push(this.cbVarSel('x', 'For each category of', 'any'), this.cbVarSel('y', 'Split by', 'any'), this.cbChoice('stat', 'Show', [['count', 'Counts'], ['percent', '% within each category']], id === 'stackcount' ? 'count' : 'count'));
    else if (id === 'stack') f.push(this.cbVarSel('x', 'For each category of', 'any'), this.cbVarSel('y', 'Show the % of each', 'any'));
    else if (id === 'likert') { f.push(this.cbVarSel('x', 'Groups', 'any'), this.cbVarSel('y', 'Responses', 'any')); const lv = this.cbLevels(c.y, 9); f.push(this.cbText('order', 'Response order (low → high, separated by |)', lv.join('|'), 320), this.cbText('neutral', 'Neutral response (centered)', 'optional', 160)); }
    else if (id === 'hist') f.push(this.cbVarSel('x', 'Numeric variable', 'num'), this.cbText('bins', 'Number of bars (blank = automatic)', 'auto', 120), this.cbChoice('stat', 'Height', [['count', 'Count'], ['percent', 'Percent']], 'count'));
    else if (id === 'box') f.push(this.cbVarSel('x', 'Numeric variable', 'num'));
    else if (id === 'gbox' || id === 'violin') { f.push(this.cbVarSel('x', 'Groups', 'any'), this.cbVarSel('y', 'Numeric variable', 'num')); if (id === 'violin') f.push(this.cbCheck('points', 'Show individual points')); }
    else if (id === 'density') f.push(this.cbVarSel('x', 'Numeric variable', 'num'), this.cbVarSel('group', 'Compare groups', 'any', true));
    else if (['line', 'area', 'panel', 'multiline'].includes(id)) {
      const st = c.stat || 'mean';
      f.push(this.cbChoice('stat', 'Show', [['mean', 'the mean of'], ['sum', 'the sum of'], ['pct', 'the % equal to 1 of'], ['count', 'the number of rows']], 'mean'));
      if (st !== 'count') f.push(this.cbVarSel('y', 'Outcome', 'num'));
      f.push(this.cbVarSel('x', 'Over (time)', 'num'), this.cbVarSel('group', id === 'panel' ? 'One panel per' : 'Split by', 'any', id !== 'panel', { sel: [] }));
      if (c.group) { const lv = this.cbLevels(c.group, 60), auto = lv.slice(0, id === 'panel' ? 24 : 10), sel0 = (c.sel || []).filter(k => lv.includes(k)), sel = sel0.length ? sel0 : auto, max = id === 'panel' ? 24 : 12;
        f.push(this.tlField('Which ' + c.group + ' (' + sel.length + ' of ' + lv.length + ')', h('div', { className: 'tl-row cb-sel' }, lv.map(k => this.tlChip(this.cbDisplay(this.cbKeySetsLite(c.group), 'series', k), sel.includes(k), () => { const cur = sel; this.cbSet({ sel: cur.includes(k) ? cur.filter(x => x !== k) : cur.length >= max ? cur : [...cur, k] }); }, { key: k }))))); }
      f.push(this.cbText('t0', 'From', 'first', 80), this.cbText('t1', 'To', 'last', 80));
      if (st === 'mean' || st === 'pct') f.push(this.cbCheck('ci', 'Shade the 95% interval'));
      if (st !== 'count') { const ys = c.ys || []; f.push(this.tlField('More outcomes (optional)', this.tlSelect('', [['', '+ add an outcome']].concat(this.cbNumeric().filter(v => v.name !== c.y && !ys.includes(v.name)).map(v => [v.name, v.name])), val => { if (val) this.cbSet({ ys: [...ys, val] }); }, 'Add an outcome'), ys.length ? h('div', { className: 'tl-row' }, ys.map(v => this.tlChip(v + ' ×', true, () => this.cbSet({ ys: ys.filter(x => x !== v) }), { key: v }))) : null)); }
    }
    else if (['scatterplain', 'smooth', 'hexbin', 'scatter'].includes(id)) { f.push(this.cbVarSel('x', 'Across (X)', 'num'), this.cbVarSel('y', 'Up (Y)', 'num')); if (id !== 'hexbin' && id !== 'scatter') f.push(this.cbVarSel('group', 'Color by', 'any', true)); if (id === 'scatter') f.push(this.cbCheck('labels', 'Label points with')); if (id === 'scatter' && c.labels) f.push(this.cbVarSel('labVar', 'Label variable', 'any')); }
    else if (id === 'matrix' || id === 'corrmap') { const vars = c.vars || [], max = id === 'matrix' ? 6 : 12; f.push(this.tlField('Numeric variables (' + (id === 'matrix' ? '2–6' : '2–12') + ')', this.tlSelect('', [['', vars.length >= max ? 'Maximum reached' : '+ add a variable']].concat(this.cbNumeric().filter(v => !vars.includes(v.name)).map(v => [v.name, v.name])), val => { if (val && vars.length < max) this.cbSet({ vars: [...vars, val] }); }, 'Add a variable'), vars.length ? h('div', { className: 'tl-row' }, vars.map(v => this.tlChip(v + ' ×', true, () => this.cbSet({ vars: vars.filter(x => x !== v) }), { key: v }))) : null)); }
    else if (id === 'heatmap') f.push(this.cbVarSel('x', 'Columns', 'any'), this.cbVarSel('group', 'Rows', 'any'), this.cbVarSel('y', 'Mean of', 'num'));
    else if (id === 'mean' || id === 'proportion') f.push(this.cbVarSel('x', 'Groups', 'any'), this.cbVarSel('y', id === 'mean' ? 'Mean of' : 'Share equal to 1 of (0/1 variable)', 'num'));
    else if (id === 'dumbbell' || id === 'slope') f.push(this.cbVarSel('x', 'Categories', 'any'), this.cbVarSel('lo', 'First value (e.g. 2016)', 'num'), this.cbVarSel('y', 'Second value (e.g. 2020)', 'num'));
    else if (id === 'paired') f.push(this.cbVarSel('x', 'Before', 'num'), this.cbVarSel('y', 'After', 'num'));
    else if (id === 'survival') f.push(this.cbVarSel('x', 'Time to event (0 or more)', 'num'), this.cbVarSel('y', 'Event happened (1) or censored (0)', 'num'), this.cbVarSel('group', 'Compare groups', 'any', true));
    else if (est) {
      const sources = [['columns', 'Estimate columns in the dataset']].concat(['coefficient', 'prediction', 'interaction'].includes(id) ? [['current', 'The regression I just ran']] : []).concat(id === 'modelcompare' ? [['saved', 'Models saved in the regression table']] : []);
      f.push(this.cbChoice('source', 'Results from', sources, 'columns'));
      if ((c.source || 'columns') === 'columns') { const catE = ['coefficient', 'modelcompare', 'marginal', 'conjoint'].includes(id); f.push(this.cbVarSel('x', catE ? 'Term or level' : 'X value', catE ? 'any' : 'num'), this.cbVarSel('y', 'Estimate', 'num'), this.cbVarSel('lo', 'Lower bound', 'num', id === 'conjoint'), this.cbVarSel('hi', 'Upper bound', 'num', id === 'conjoint'), this.cbVarSel('group', id === 'modelcompare' ? 'Model' : 'Group', 'any', true)); if (id === 'conjoint') f.push(this.cbVarSel('attr', 'Attribute (feature)', 'any', true), this.cbChoice('refLine', 'Reference line at', [['0', '0 (AMCE)'], ['0.5', '0.5 (marginal means)']], '0')); }
    }
    const canFacet = !['corrmap', 'matrix', 'paired', 'panel', 'hist', 'box', 'bar', 'dot', 'stack', 'gbox', 'line', 'area', 'multiline', 'scatter', 'pie', 'donut'].includes(id) && !(est && c.source && c.source !== 'columns');
    if (canFacet) f.push(this.cbVarSel('facet', 'One chart per (optional)', 'any', true));
    for (const k of this.cbCatKeys(id, c)) { const el = this.cbCatControl(id, k); if (el) f.push(el); }
    return f;
  }

  // compute the chart model(s) — memoized on everything that changes the numbers, so restyling is instant
  cbBuild(id) {
    const S = this.state, E = this._E, c = this.cbC(), w = this.wArr(), mask = this.mask();
    const dataKey = JSON.stringify([id, ['x', 'y', 'group', 'facet', 'lo', 'hi', 'vars', 'stat', 'sel', 'ys', 't0', 't1', 'ci', 'order', 'neutral', 'sort', 'other', 'missing', 'bins', 'points', 'source', 'attr', 'refLine', 'labVar', 'labels', 'grp'].map(k => c[k]), S.weightVar, this.filterSig(), S.dver || 0, this.alpha()]);
    return this.memo('cb|' + dataKey, () => this.cbCompute(id, c, w, mask));
  }
  cbCompute(id, c, w, mask) {
    const E = this._E, need = (...ks) => { for (const k of ks) if (!c[k] || !this.effMeta(c[k])) throw Error('Choose the variables above to draw the chart.'); };
    const num = v => { const nv = v ? this.numVals(v) : null; if (!nv) throw Error('“' + v + '” is not a number variable.'); return nv.a; };
    const lab = v => this.cbCatLab(v, c, this.cbCatCap(id, v, c));
    const roles = { series: null, cats: null, panels: null };
    const crit = df => E.ttCritical(this.alpha(), df);
    const prep = (kind, o) => E.csPrepare(kind, Object.assign({ mask, w }, o));
    // pies and donuts: one panel per category of the split variable, one legend
    if (id === 'pie' || id === 'donut') { need('x'); const d = prep(id, { x: lab(c.x), facet: c.facet ? lab(c.facet) : [], missing: !!c.missing, facetRequired: !!c.facet }); roles.series = c.x; roles.panels = c.facet || null; return { models: [E.cbModel(id, d, { sort: c.sort, other: +c.other || 0 })], data: d, roles }; }
    if (id === 'bar' || id === 'dot') { need('x'); const st = c.stat || 'count'; if (st === 'mean' || st === 'sum') need('y'); const a = E.cbAggCat(lab(c.x), null, st === 'mean' || st === 'sum' ? num(c.y) : null, w, mask, { stat: st }); roles.cats = c.x;
      return { models: [{ type: 'cat', mode: id === 'dot' ? 'dot' : 'single', colorBy: 'cat', cats: a.cats, series: ['All'], seriesKeys: ['All'], vals: a.vals, pct: a.pct, table: a.table, headers: ['Category', st, 'n'], n: a.n, excluded: a.excluded, weighted: !!w }], data: a, roles }; }
    if (['groupbar', 'stackcount', 'stack', 'likert'].includes(id)) { need('x', 'y'); const kind = id === 'stack' ? 'stackcount' : id, d = prep(kind, { x: lab(c.x), y: lab(c.y), facet: c.facet ? lab(c.facet) : [], facetRequired: !!c.facet }); roles.cats = c.x; roles.series = c.y; roles.panels = c.facet || null;
      return { models: this.cbPanels(d, rr => E.cbModel(kind, rr, { stat: id === 'stack' ? 'percent' : c.stat, order: c.order, neutral: c.neutral })), data: d, roles }; }
    if (id === 'hist' || id === 'box') { need('x'); const d = E.descNum(this.nvA(c.x), w); if (!(d.n >= 2)) throw Error('Not enough valid values.'); roles.series = null;
      if (id === 'box') return { models: [{ type: 'box', groups: [E.cbBoxStats(c.x, d)], seriesKeys: [c.x], xTitle: c.x, n: d.n, excluded: d.missing, table: [[c.x, d.n, d.mn, d.q1, d.med, d.q3, d.mx, d.mean]], headers: ['Variable', 'n', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'Mean'], note: 'Box = middle half of the values (Q1 to Q3); line = median; diamond = mean; whiskers reach 1.5 × the box length.' }], data: d, roles };
      const bins = E.cbHistBins(d, +c.bins || 0), pct = c.stat === 'percent', tot = bins.reduce((t, b) => t + b.c, 0); if (pct) bins.forEach(b => { b.c = 100 * b.c / tot; });
      return { models: [{ type: 'xy', bins, series: [], seriesKeys: ['All'], zero: true, pct, xTitle: c.x, yTitle: pct ? 'Percent' : (w ? 'Weighted count' : 'Count'), n: d.n, excluded: d.missing, table: bins.map(b => [b.a, b.b, b.c]), headers: ['From', 'To', pct ? 'Percent' : 'Count'], note: bins.length + ' bars of equal width' + (+c.bins ? '' : ' (Freedman–Diaconis rule)') + '.' }], data: d, roles }; }
    if (id === 'gbox') { need('x', 'y'); const G = E.groupsOf(lab(c.x), this.nvA(c.y), w, 40), L = G.levels.filter(g => g.n >= 2 && isFinite(g.sd)).sort((a, b) => E.cbNatural(a.label, b.label)); if (L.length < 1) throw Error('Need at least one group with 2 or more values.'); roles.series = c.x;
      return { models: [{ type: 'box', groups: L.map(g => E.cbBoxStats(String(g.label), g)), seriesKeys: L.map(g => String(g.label)), showN: true, yTitle: c.y, xTitle: c.x, n: L.reduce((t, g) => t + g.n, 0), excluded: 0, table: L.map(g => [g.label, g.n, g.q1, g.med, g.q3, g.mean]), headers: ['Group', 'n', 'Q1', 'Median', 'Q3', 'Mean'], note: G.capped ? 'Showing the 40 largest of ' + G.totalLevels + ' groups.' : '' }], data: G, roles }; }
    if (['line', 'area', 'panel', 'multiline'].includes(id)) {
      const st = c.stat || 'mean'; need('x'); if (st !== 'count') need('y');
      const t = num(c.x), g = c.group ? lab(c.group) : null, lvAll = c.group ? this.cbLevels(c.group, 400) : [];
      const sel0 = c.group ? (c.sel || []).filter(v => lvAll.includes(v)) : [], sel = c.group ? (sel0.length ? sel0 : lvAll.slice(0, id === 'panel' ? 24 : 10)) : null;
      const outcomes = st === 'count' ? [null] : [c.y, ...(c.ys || [])].filter(Boolean);
      const series = []; let n = 0, excl = 0, times = [];
      // GM26 .70: when no time has both the outcome and the split, say which times each one has (merged surveys)
      const why = () => { const cov = (get, isLab) => { const ys = new Set(); for (let i = 0; i < t.length; i++) { if (mask && !mask[i]) continue; const tv = t[i]; if (!isFinite(tv)) continue; const v = get(i); if (isLab ? (v != null && v !== '') : isFinite(v)) ys.add(tv); } return [...ys].sort((a2, b2) => a2 - b2); }, list = a2 => a2.length ? a2.join(', ') : 'none';
        const yv0 = outcomes[0], yA = yv0 ? num(yv0) : null, yc = yA ? cov(i => yA[i], false) : null, gc = g ? cov(i => g[i], true) : null;
        if (yc && gc) { const both = yc.filter(x => gc.includes(x)); if (!both.length) return 'No ' + c.x + ' has both ' + yv0 + ' and ' + c.group + ': ' + yv0 + ' has data in ' + list(yc) + '; ' + c.group + ' in ' + list(gc) + '. Split by another variable, or by none.'; }
        if (yc && !yc.length) return yv0 + ' has no values with a ' + c.x + ' here.';
        return 'No rows with both a time and an outcome for these selections.'; };
      try {
      outcomes.forEach(yv => { const r = E.cbTimeAgg(t, yv ? num(yv) : new Float64Array(t.length), g, w, mask, { stat: st, sel, t0: c.t0, t1: c.t1, ci: !!c.ci, alpha: this.alpha() }); n += r.n; excl += r.excluded; times = times.concat(r.times); r.series.forEach(s => series.push(Object.assign({}, s, { key: outcomes.length > 1 ? (yv + (g ? ' · ' + s.key : '')) : s.key, group: s.key, outcome: yv }))); });
      } catch (e0) { if (/No rows with both a time/.test(e0.message)) throw Error(why()); throw e0; }
      if (!series.length) throw Error(why());
      roles.series = outcomes.length > 1 ? null : (c.group || null);
      const statT = { mean: 'Mean of ', sum: 'Sum of ', pct: '% equal to 1 of ', count: 'Number of rows' }[st] + (st === 'count' ? '' : outcomes.join(', '));
      const mk = ss => ({ type: 'xy', xTime: true, series: ss.map(s => Object.assign({}, s, { style: id === 'area' ? 'area' : 'line', band: !!c.ci && (st === 'mean' || st === 'pct') && id !== 'area' })), seriesKeys: ss.map(s => s.key), pct: st === 'pct', zero: st !== 'mean', yTitle: statT, xTitle: c.x, n, excluded: excl, weighted: !!w, table: ss.flatMap(s => s.pts.map(p => [s.key, p.x, p.y, p.n].concat(c.ci ? [p.lo, p.hi] : []))), headers: ['Series', c.x, statT, 'n'].concat(c.ci ? ['Lower', 'Upper'] : []), note: (st === 'mean' ? 'Each point is the ' + (w ? 'weighted ' : '') + 'mean at that time. ' : st === 'sum' ? 'Each point is the ' + (w ? 'weighted ' : '') + 'sum at that time. ' : '') + 'Lines break where a series has no observation.' + (c.group && !(c.sel && c.sel.length) && lvAll.length > sel.length ? ' Showing the ' + sel.length + ' most frequent of ' + lvAll.length + ' groups — pick others below.' : '') });
      if (id === 'panel') { if (!c.group) throw Error('Choose the variable that makes one panel per category.'); const groupsP = [...new Set(series.map(s => s.group))]; roles.panels = c.group; roles.series = null; return { models: groupsP.map(gk => Object.assign(mk(series.filter(s => s.group === gk).map(s => Object.assign({}, s, { key: s.outcome || 'All' }))), { panel: gk })), data: null, roles, sel, levels: lvAll }; }
      let ss = series; if (id === 'area' && (st === 'sum' || st === 'count')) ss = E.cbStackSeries(series);
      return { models: [mk(ss)], data: null, roles, sel, levels: lvAll };
    }
    if (id === 'scatter') {
      need('x', 'y'); const cr = this.bgMemo('pcorr|' + c.x + '|' + c.y, 'corr', () => [this.nvA(c.x), this.nvA(c.y), w], 'Computing the scatterplot');
      if (cr.pending) return { pending: true }; if (cr.error) throw Error(cr.error);
      const stride = Math.max(1, Math.ceil(cr.xs.length / 4000)), pts = [], labs = c.labels && c.labVar ? (this.groupLab(c.labVar) || []) : null;
      for (let i = 0; i < cr.xs.length; i += stride) pts.push({ x: cr.xs[i], y: cr.ys[i], k: 'All' });
      const xr = [Math.min(...cr.xs), Math.max(...cr.xs)];
      const M = { type: 'xy', points: pts, series: [{ key: 'Fitted line', pts: xr.map(x => ({ x, y: cr.fit.icept + cr.fit.slope * x })), style: 'fit' }], seriesKeys: ['All'], xTitle: c.x, yTitle: c.y, subtitle: 'r = ' + cr.pearson.r.toFixed(2) + ' · n = ' + cr.n.toLocaleString('en-US') + ' · fitted line: ' + c.y + ' = ' + E.cbFmt(cr.fit.icept) + (cr.fit.slope >= 0 ? ' + ' : ' − ') + E.cbFmt(Math.abs(cr.fit.slope)) + ' × ' + c.x, n: cr.n, excluded: 0, weighted: !!w, table: [['Pearson r', cr.pearson.r], ['Spearman rho', cr.spearman.r], ['Slope', cr.fit.slope], ['Intercept', cr.fit.icept], ['n', cr.n]], headers: ['Statistic', 'Value'], note: stride > 1 ? 'Showing ' + pts.length.toLocaleString('en-US') + ' of ' + cr.n.toLocaleString('en-US') + ' points; r and the line use all of them.' : '' };
      if (labs) { const xa = this.nvA(c.x), ya = this.nvA(c.y); M.points = []; for (let i = 0; i < xa.length && M.points.length < 400; i++) if (isFinite(xa[i]) && isFinite(ya[i]) && (!mask || mask[i])) M.points.push({ x: xa[i], y: ya[i], k: 'All', lab: labs[i] == null ? '' : String(labs[i]), t: labs[i] == null ? '' : String(labs[i]) }); M.pointLabels = true; }
      return { models: [M], data: cr, roles };
    }
    if (id === 'matrix') {
      const vars = (c.vars || []).filter(v => this.numVals(v)); if (vars.length < 2) throw Error('Add at least two number variables.');
      const arrs = vars.map(v => this.numVals(v).a), cm = E.corrMatrix(arrs, w), ranges = arrs.map(a => { let lo = Infinity, hi = -Infinity; for (const v of a) if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; });
      const cells = vars.map((_, i) => vars.map((__, j) => { if (i === j) return null; if (i > j) { const pts = [], n = arrs[0].length, st = Math.max(1, Math.ceil(n / 600)); for (let r = 0; r < n; r += st) if (isFinite(arrs[j][r]) && isFinite(arrs[i][r])) pts.push([arrs[j][r], arrs[i][r]]); return { pts }; } const q = cm[i][j] || cm[j][i]; return q ? { r: q.r, n: q.n } : null; }));
      return { models: [{ type: 'matrix', vars, cells, ranges, seriesKeys: ['All'], n: arrs[0].length, excluded: 0, table: vars.flatMap((v, i) => vars.map((u, j) => i < j && cells[i][j] ? [v, u, cells[i][j].r, cells[i][j].n] : null).filter(Boolean)), headers: ['Variable', 'Variable', 'r', 'n'], note: 'Below the diagonal: scatterplots (up to 600 points each). Above: Pearson correlations.' }], data: null, roles };
    }
    if (id === 'corrmap') {
      const vars = (c.vars || []).filter(v => this.numVals(v)); if (vars.length < 2) throw Error('Add at least two number variables.');
      const m = E.corrMatrix(vars.map(v => this.numVals(v).a), w), rows = []; vars.forEach((vi, i) => vars.forEach((vj, j) => { const q = i === j ? { r: 1, n: null } : (m[i][j] || m[j][i]); if (q && isFinite(q.r)) rows.push({ x: vj, g: vi, y: q.r, w: 1, n: q.n }); }));
      return { models: [E.cbModel('corrmap', { rows, n: this._raw.n, excluded: 0 }, {})], data: null, roles };
    }
    if (['coefficient', 'modelcompare', 'prediction', 'marginal', 'interaction', 'event', 'conjoint'].includes(id)) {
      const d = this.cbEstimates(id, c); roles.series = c.group || null; roles.cats = ['coefficient', 'modelcompare', 'marginal'].includes(id) ? (c.source && c.source !== 'columns' ? null : c.x) : null;
      if (id === 'conjoint') { if (c.attr) { const al = this.groupLab(c.attr) || []; d.rows.forEach(r => { r.a = al[r.i] == null ? '' : String(al[r.i]); }); } return { models: [E.cbConjoint(d, { refLine: +(c.refLine || 0), xmin: c.xmin, xmax: c.xmax, ylabel: c.ylabel, font: { s: 11, m: 12, l: 14 }[c.text] || 12 })], data: d, roles }; }
      return { models: [E.cbModel(d.kind || id, d, {})], data: d, roles };
    }
    // the remaining chart-suite pages: same preparation as before (weights, subgroup, facets)
    const catX = ['violin', 'mean', 'proportion', 'dumbbell', 'slope', 'heatmap'].includes(id);
    const needs = { density: ['x'], violin: ['x', 'y'], mean: ['x', 'y'], proportion: ['x', 'y'], dumbbell: ['x', 'lo', 'y'], slope: ['x', 'lo', 'y'], paired: ['x', 'y'], heatmap: ['x', 'group', 'y'], scatterplain: ['x', 'y'], smooth: ['x', 'y'], hexbin: ['x', 'y'], survival: ['x', 'y'] }[id] || ['x'];
    need(...needs);
    const getN = k => c[k] ? num(c[k]) : [];
    const d = prep(id, { x: catX ? lab(c.x) : getN('x'), y: getN('y'), lo: getN('lo'), g: c.group ? lab(c.group) : [], facet: c.facet ? lab(c.facet) : [], groupRequired: !!c.group, facetRequired: !!c.facet, w: ['proportion', 'survival', 'paired', 'mean'].includes(id) ? null : w });
    roles.panels = c.facet || null;
    if (['density', 'scatterplain', 'smooth', 'survival'].includes(id)) roles.series = c.group || null;
    if (id === 'violin') roles.series = c.x; if (id === 'slope') roles.series = c.x; if (id === 'heatmap') { roles.cats = c.x; roles.series = c.group; roles.rows = c.group; }
    if (['mean', 'proportion', 'dumbbell'].includes(id)) roles.cats = c.x;
    const models = this.cbPanels(d, rr => E.cbModel(id, rr, { critical: crit, points: !!c.points, lo: c.lo, y: c.y, x: c.x, firstLabel: c.lo, secondLabel: c.y }));
    if (id === 'heatmap') models.forEach(m => { m.xTitle = c.x; m.yTitle = c.group; m.valueTitle = 'Mean of ' + c.y; });
    return { models, data: d, roles };
  }
  cbPanels(d, fn) {
    if (!d.panels || d.panels.size <= 1) return [fn(d)];
    return [...d.panels].map(([panel, rr]) => Object.assign(fn(Object.assign({}, d, { rows: rr, n: rr.length, panels: null })), { panel }));
  }
  // model results: from estimate columns, the current regression, or saved models (as the chart suite did)
  cbEstimates(id, c) {
    const S = this.state, E = this._E, src = c.source || 'columns';
    if (src === 'current') {
      const snap = this._csModel; if (!snap || snap.spec !== this.regSpec() || snap.dver !== (S.dver || 0) || snap.data !== this.dataSig()) throw Error('Run the current specification in Tests → Regression first.');
      if (id === 'coefficient') { const crit = E.ttCritical(this.alpha(), snap.model.dfR || snap.model.n - 1); const rows = snap.model.coefs.filter(q => q.term !== '(constant)').map((q, i) => ({ x: this.termLab(q.term), y: q.b, lo: q.b - crit * q.se, hi: q.b + crit * q.se, g: 'Current model', w: 1, i })); return { rows, n: snap.model.n, excluded: 0, panels: new Map([['All', rows]]) }; }
      const mg = this._csMargins; if (!mg || mg.spec !== snap.spec || mg.dver !== snap.dver) throw Error('Generate predictions in Tests → Regression first, then come back here.');
      if (id === 'interaction' && !mg.by) throw Error('Pick a grouping variable in the regression predictions to show an interaction.');
      const rows = mg.result.series.flatMap(s => s.pts.map((p, i) => ({ x: p.x, y: p.y, lo: p.lo, hi: p.hi, g: s.label || 'Prediction', w: 1, i })));
      return { rows, n: snap.model.n, excluded: 0, panels: new Map([['All', rows]]), kind: mg.result.xCat ? 'coefficient' : null };
    }
    if (src === 'saved') {
      const models = S.regTab || []; if (!models.length) throw Error('Add models to the regression table in Tests → Regression first.');
      if (new Set(models.map(m => m.mdl)).size > 1) throw Error('Compare models from the same model family, or import estimates on a common scale.');
      const rows = models.flatMap((m, mi) => m.rows.filter(q => !q.tail).map((q, i) => { const z = E.ttCritical(this.alpha(), m.df || 1e9); return { x: this.termLab ? this.termLab(q.term) : q.term, y: q.b, lo: q.b - z * q.se, hi: q.b + z * q.se, g: m.name || 'Model ' + (mi + 1), w: 1, i }; })).filter(r => isFinite(r.y) && isFinite(r.lo) && isFinite(r.hi));
      return { rows, n: rows.length, excluded: 0, panels: new Map([['All', rows]]) };
    }
    const catE = ['coefficient', 'modelcompare', 'marginal', 'conjoint'].includes(id);
    for (const k of id === 'conjoint' ? ['x', 'y'] : ['x', 'y', 'lo', 'hi']) if (!c[k] || !this.effMeta(c[k])) throw Error('Choose the variables above to draw the chart.');
    const get = (k, cat) => c[k] ? (cat ? this.groupLab(c[k]) : (this.numVals(c[k]) || {}).a) : [];
    return E.csPrepare(id, { x: get('x', catE), y: get('y'), lo: get('lo') || [], hi: get('hi') || [], g: c.group ? this.groupLab(c.group) : [], mask: this.mask(), groupRequired: !!c.group });
  }

  // names and colors: shared by variable (value labels for number codes), or kept with this chart
  cbNameMap(v) { return v ? Object.assign({}, (this.state.cbNames || {})[v] || {}) : {}; }
  cbColorMap(v) { return v ? Object.assign({}, (this.state.cbColors || {})[v] || {}) : {}; }
  cbRename(v, key, name, everywhere) {
    name = String(name || '').trim(); const raw = this._raw, c = this.cbC();
    if (!v || !everywhere) { this.cbSet(cc => ({ names: Object.assign({}, cc.names, { [key]: name }) })); return; }
    const idx = this.colIdx(v), col = idx >= 0 ? raw.cols[idx] : null;
    if (col && col.k === 'n' && name) {
      let code = Number(key); const vm = raw.vlabs && raw.vlabs[v];
      if (!isFinite(code) && vm instanceof Map) for (const [k2, l2] of vm) if (String(l2) === String(key)) code = k2;
      if (isFinite(code)) {
        this.snap('label ' + v); raw.vlabs = raw.vlabs || {}; const mp = new Map(vm instanceof Map ? vm : []); mp.set(code, name); raw.vlabs[v] = mp; this.rememberLabels([v]); this.clearMemo();
        // keep this category's color under its new name
        this.setState(s => { const cm = Object.assign({}, (s.cbColors || {})[v] || {}); if (cm[key]) { cm[name] = cm[key]; delete cm[key]; } return { dver: (s.dver || 0) + 1, cbColors: Object.assign({}, s.cbColors, { [v]: cm }) }; });
        this.stataLog('label define ' + v + '_lb ' + code + ' "' + name.replace(/"/g, "'") + '", modify'); this.stataLog('label values ' + v + ' ' + v + '_lb');
        return;
      }
    }
    this.setState(s => ({ cbNames: Object.assign({}, s.cbNames, { [v]: Object.assign({}, (s.cbNames || {})[v] || {}, { [key]: name }) }) }));
  }
  cbRecolor(v, key, hex) {
    if (!v) { this.cbSet(cc => ({ colors: Object.assign({}, cc.colors, { [key]: hex }) })); return; }
    this.setState(s => ({ cbColors: Object.assign({}, s.cbColors, { [v]: Object.assign({}, (s.cbColors || {})[v] || {}, { [key]: hex }) }) }));
  }
  cbOptions(id, res, c) {
    const S = this.state, E = this._E, roles = res.roles || {}, pal = E.CB_PALETTES[c.palette || 'sendero'] || E.CB_PALETTES.sendero;
    const pal2 = c.palette ? pal : [S.chartColor || pal[0], ...pal.filter(x => x.toLowerCase() !== String(S.chartColor || pal[0]).toLowerCase())];
    const merge = (v, own) => Object.assign({}, this.cbNameMap(v), own || {});
    const statT = { count: 'Number of rows', percent: '% of rows', mean: 'Mean of ' + (c.y || ''), sum: 'Sum of ' + (c.y || '') }[c.stat || 'count'];
    const auto = this.cbAutoTitle(id, c);
    const src = [];
    const m0 = (res.models || [])[0] || {};
    if (m0.n != null) src.push('n = ' + Number(m0.n).toLocaleString('en-US') + (m0.excluded ? ' (' + Number(m0.excluded).toLocaleString('en-US') + ' left out)' : ''));
    if (S.weightVar && this.wArr()) src.push('weighted by ' + S.weightVar);
    const cs = this.conds(); if (cs.length) src.push('rows: ' + cs.map(q => this.condLabel(q)).join(' & '));
    if (S.fileName) src.unshift(String(S.fileName).replace(/\.[^.]+$/, ''));
    return {
      title: c.title != null && c.title !== '' ? c.title : auto, subtitle: c.subtitle || undefined, source: c.source2 != null && c.source2 !== '' ? c.source2 : src.join(' · '),
      xTitle: c.xlabel ? c.xlabel : undefined, yTitle: c.ylabel ? c.ylabel : (id === 'bar' || id === 'dot' ? statT : undefined), description: c.description || '',
      names: Object.assign({}, merge(roles.series, null), c.names || {}), catNames: Object.assign({}, merge(roles.cats, null), c.names || {}), panelNames: Object.assign({}, merge(roles.panels, null), c.names || {}),
      colors: Object.assign({}, this.cbColorMap(roles.series), c.colors || {}), catColors: Object.assign({}, this.cbColorMap(roles.cats), c.colors || {}),
      palette: pal2, highlight: c.highlight || '', eachColor: !!c.eachColor, patterns: !!c.patterns,
      values: c.values || 'none', valueKeys: c.valueKeys || null, fmt: c.fmt || 'auto', decimals: c.decimals === '' || c.decimals == null ? null : +c.decimals,
      legend: c.legend || 'auto', size: c.size || 'auto', text: c.text || (c.font ? (+c.font <= 11 ? 's' : +c.font >= 14 ? 'l' : 'm') : 'm'), zero: c.zero === '1' || c.zero === true ? true : c.zero === '0' || c.zero === false ? false : undefined, log: !!c.log, grid: c.grid !== false,
      xmin: c.xmin, xmax: c.xmax, xStep: c.xstep, ymin: c.ymin, ymax: c.ymax, sort: c.barSort || 'none', horizontal: c.horizontal || 'auto', everyX: c.everyX === '1' || c.everyX === true ? true : undefined,
      lineWidth: c.lineWidth || 'normal', markers: c.markers !== false, dashes: Object.assign({}, ((S.cbDash || {})[roles.series || ''] || {}), c.dashes || {}), sliceLabels: c.sliceLabels || (['count', 'both'].includes(c.labels) ? c.labels : undefined)
    };
  }
  cbAutoTitle(id, c) {
    const st = c.stat || (['line', 'area', 'panel', 'multiline'].includes(id) ? 'mean' : 'count'), y = [c.y, ...(c.ys || [])].filter(Boolean).join(', ');
    if (id === 'pie' || id === 'donut') return 'Share of ' + (c.x || '…') + (c.facet ? ' by ' + c.facet : '');
    if (id === 'bar' || id === 'dot') return ({ count: 'Number of rows', percent: '% of rows', mean: 'Mean of ' + (c.y || '…'), sum: 'Sum of ' + (c.y || '…') }[st]) + ' by ' + (c.x || '…');
    if (['groupbar', 'stackcount', 'stack', 'likert'].includes(id)) return (c.y || '…') + ' by ' + (c.x || '…');
    if (['line', 'area', 'panel', 'multiline'].includes(id)) return ({ mean: 'Mean of ', sum: 'Sum of ', pct: '% equal to 1 of ', count: 'Number of rows' }[st]) + (st === 'count' ? '' : y || '…') + ' by ' + (c.x || '…') + (c.group ? ' and ' + c.group : '');
    if (id === 'hist' || id === 'box') return 'Distribution of ' + (c.x || '…');
    if (['gbox', 'violin', 'mean', 'proportion'].includes(id)) return (id === 'proportion' ? '% equal to 1 of ' : id === 'mean' ? 'Mean of ' : '') + (c.y || '…') + ' by ' + (c.x || '…');
    if (['scatter', 'scatterplain', 'smooth', 'hexbin'].includes(id)) return (c.y || '…') + ' and ' + (c.x || '…');
    if (id === 'density') return 'Distribution of ' + (c.x || '…') + (c.group ? ' by ' + c.group : '');
    if (id === 'dumbbell' || id === 'slope') return (c.lo || '…') + ' and ' + (c.y || '…') + ' by ' + (c.x || '…');
    if (id === 'heatmap') return 'Mean of ' + (c.y || '…') + ' by ' + (c.x || '…') + ' and ' + (c.group || '…');
    return this._E.cbTitleOf(id);
  }

  // ---- the page
  cbRender() {
    const h = React.createElement, S = this.state, E = this._E, id = S.plotKind, fam = E.cbFamilyOf(id), c = this.cbC(), kindId = id === 'multiline' ? 'line' : id;
    const top = h('div', { className: 'cb-top' },
      h('button', { type: 'button', className: 'tl-link', onClick: () => this.csOpen('__gallery') }, '← All charts'),
      this.cbIcon(fam.icon, 40), h('h2', null, fam.q),
      h('div', { className: 'tl-row cb-kinds', role: 'group', 'aria-label': 'Chart type' }, fam.kinds.filter(k => !['map', 'geomap'].includes(k[0])).map(([k, t]) => this.tlChip(t, k === kindId, () => this.cbSwitch(k), { key: k }))));
    // GM26 .70: 1 the variables (searchable boxes: type part of a name or of its label), 2 the chart, 3 customize
    const fields = h('section', { className: 'tl-panel cb-data' }, h('div', { className: 'tl-ptitle' }, h('h3', null, '1 · Variables'), h('span', null, (fam.d ? fam.d + ' ' : '') + 'Type part of a name or a label to find a variable.')), h('div', { className: 'cb-fields' }, ...this.cbFields(id)));
    let res = null, err = '';
    try { res = this.cbBuild(id); } catch (e) { err = e.message; }
    let chart;
    if (err) chart = h('section', { className: 'tl-panel cb-chart' }, this.tlBanner(/Choose the variables|Pick a|Add at least/.test(err) ? 'info' : 'warn', err));
    else if (res.pending) chart = h('section', { className: 'tl-panel cb-chart' }, this.tlPending('Computing in the background'));
    else {
      let o; try { o = this.cbOptions(id, res, c); } catch (e) { o = {}; }
      const figs = [], errs = [];
      // shared scales across panels unless asked otherwise
      const models = res.models;
      if (models.length > 1 && c.scales !== 'independent') { const vals = []; models.forEach(m => { if (m.type === 'xy') m.series.forEach(s => s.pts.forEach(p => { vals.push(p.y); if (isFinite(p.lo)) vals.push(p.lo); if (isFinite(p.hi)) vals.push(p.hi); })); if (m.type === 'cat' && m.mode !== 'stack100' && m.mode !== 'diverge') m.vals.forEach(r => r.forEach(q => { if (q) [q.v, q.lo, q.hi].forEach(v => { if (isFinite(v)) vals.push(v); }); })); }); if (vals.length && o.ymin == null && o.ymax == null) { const lo = Math.min(...vals), hi = Math.max(...vals); if (models[0].type === 'xy') { o.ymin = models[0].zero || o.zero ? Math.min(0, lo) : lo - (hi - lo) * 0.06; o.ymax = hi + (hi - lo) * 0.06; } } }
      models.forEach((m, i) => {
        const key = 'cb-' + id + '-' + i, oo = Object.assign({}, o, { clipId: 'cbc' + i + id.replace(/\W/g, '') });
        if (m.panel != null) oo.subtitle = (oo.panelNames && oo.panelNames[m.panel]) || String(m.panel);
        if (m.type === 'xy' && m.subtitle && !c.subtitle) oo.subtitle = m.subtitle;
        try {
          const sc = E.cbScene(m, oo); (this._plotName || (this._plotName = {}))[key] = (oo.title || 'Chart') + (m.panel != null ? ' — ' + m.panel : '');
          figs.push(h('figure', { key, className: 'cb-fig' }, h('svg', { viewBox: '0 0 ' + sc.width + ' ' + sc.height, role: 'img', 'aria-label': oo.description || oo.title || 'Chart', ref: this.svgRef(key), dangerouslySetInnerHTML: { __html: sc.markup } }), this.tlExportRow(key, String(oo.title || 'chart').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + (models.length > 1 ? '-' + (i + 1) : ''))));
        } catch (e) { errs.push(e.message); }
      });
      const m0 = models[0] || {}, table = models.length > 1 ? models.flatMap(m => (m.table || []).map(r => [m.panel, ...r])) : (m0.table || []), headers = (models.length > 1 ? ['Panel'] : []).concat(m0.headers || []);
      const fmtCell = v => typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 6 })) : v == null ? '' : String(v);
      chart = h('section', { className: 'tl-panel cb-chart' },
        errs.length ? this.tlBanner('warn', errs[0]) : null,
        h('div', { className: models.length > 1 ? 'cb-figs multi' : 'cb-figs' }, ...figs),
        m0.note || (models[1] || {}).note ? h('p', { className: 'tl-hint cb-note' }, m0.note) : null,
        table.length ? h('details', { className: 'cb-table' }, h('summary', null, 'Data behind the chart (' + table.length.toLocaleString('en-US') + ' rows)'),
          h('div', { className: 'tl-row' }, this.tlBtn('Copy data', () => { const tsv = [headers.join('\t')].concat(table.map(r => r.map(fmtCell).join('\t'))).join('\n'); try { navigator.clipboard.writeText(tsv).then(() => this.flash('Copied ' + table.length + ' rows'), () => this.flash('Could not copy')); } catch (e) { this.flash('Could not copy'); } })),
          h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, headers.map((t, i) => h('th', { key: i }, t)))), h('tbody', null, table.slice(0, 500).map((r, i) => h('tr', { key: i }, r.map((v, j) => h('td', { key: j, className: typeof v === 'number' ? 'n' : '' }, fmtCell(v))))))))) : null);
    }
    const custom = err || (res && res.pending) ? null : this.cbCustomize(id, res, c);
    return h('div', { className: 'tl cb' }, top, fields, chart, custom);
  }

  // ---- Customize: Labels · Values · Colors · Axes & size
  cbCustomize(id, res, c) {
    const h = React.createElement, S = this.state, E = this._E, tab = c.ctab || 'labels', roles = res.roles || {}, models = res.models || [], m0 = models[0] || {};
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist', 'aria-label': 'Customize the chart' }, [['labels', 'Labels'], ['values', 'Values'], ['colors', 'Colors'], ['axes', 'Axes & size']].map(([k, t]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: tab === k ? 'on' : '', onClick: () => this.cbSet({ ctab: k }) }, t)));
    const sets = this.cbKeySets(id, res);
    const everywhere = c.namesHere !== true;
    let body;
    if (tab === 'labels') {
      const nameRows = sets.filter(s => s.keys.length).map(s => h('div', { key: s.role, className: 'tl-col' }, h('span', { className: 'tl-lbl' }, s.title + (s.v ? ' (' + s.v + ')' : '')),
        h('div', { className: 'cb-names' }, s.keys.slice(0, 40).map(k => { const cur = (s.map || {})[k]; return h('div', { key: k, className: 'cb-name' }, h('code', null, String(k).length > 18 ? String(k).slice(0, 17) + '…' : String(k)), h('span', { 'aria-hidden': 'true' }, '→'), h('input', { className: 'tl-input', key: 'nm|' + s.role + '|' + k + '|' + (cur || ''), defaultValue: cur && cur !== String(k) ? cur : '', placeholder: String(k), 'aria-label': 'Name for ' + k, onBlur: e => { if (e.target.value.trim() !== (cur && cur !== String(k) ? cur : '')) this.cbRename(s.v, String(k), e.target.value, everywhere && !!s.v); }, onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } })); }))));
      body = h('div', { className: 'cb-pane' },
        h('div', { className: 'tl-col' }, nameRows.length ? nameRows : h('p', { className: 'tl-hint' }, 'This chart has no categories to name.'),
          nameRows.length ? h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: everywhere, onChange: e => this.cbSet({ namesHere: !e.target.checked }) }), 'Use these names in every chart and table (number codes are saved as value labels)') : null),
        h('div', { className: 'tl-col' }, this.cbText('title', 'Title', this.cbAutoTitle(id, c), 340), this.cbText('subtitle', 'Subtitle', 'optional', 340), this.cbText('source2', 'Source line', 'automatic: file · n · weight · rows', 340),
          h('div', { className: 'tl-row' }, this.cbText('xlabel', 'X-axis title', 'automatic', 160), this.cbText('ylabel', 'Y-axis title', 'automatic', 160)),
          this.tlField('Legend', this.cbSeg('legend', [['auto', 'Automatic'], ['end', 'Names at the line ends'], ['top', 'On top'], ['bottom', 'Below'], ['none', 'None']], 'auto', 'Legend')),
          this.cbText('description', 'Description for screen readers', 'optional', 340)));
    } else if (tab === 'values') {
      const lineish = models.some(m => m.type === 'xy' && m.series && m.series.some(s => s.style === 'line' || s.style === 'area')), pie = m0.type === 'pie', stack = m0.type === 'cat' && (m0.mode === 'stack' || m0.mode === 'stack100' || m0.mode === 'diverge');
      const opts = lineish ? [['none', 'None'], ['all', 'Every point'], ['last', 'Last point'], ['firstlast', 'First and last']] : stack ? [['none', 'None'], ['all', 'Every segment'], ['total', 'Totals only']] : [['none', 'None'], ['all', 'On every bar or point']];
      const ser = lineish ? (sets.find(s => s.role === 'series') || { keys: [] }).keys : [];
      body = h('div', { className: 'cb-pane' },
        h('div', { className: 'tl-col' },
          pie ? this.tlField('On each slice', this.cbSeg('sliceLabels', [['percent', 'Percent'], ['count', 'Count'], ['both', 'Both'], ['name', 'Name and percent'], ['none', 'None']], 'percent', 'Slice labels')) : this.tlField('Values on the chart', this.cbSeg('values', opts, 'none', 'Values on the chart')),
          lineish && ser.length > 1 && (c.values || 'none') !== 'none' ? this.tlField('Which lines get values', h('div', { className: 'tl-row' }, ser.map(k => { const on = !c.valueKeys || c.valueKeys.includes(String(k)); return h('label', { key: k, className: 'cb-check' }, h('input', { type: 'checkbox', checked: on, onChange: e => { const cur = c.valueKeys || ser.map(String); this.cbSet({ valueKeys: e.target.checked ? [...new Set([...cur, String(k)])] : cur.filter(x => x !== String(k)) }); } }), this.cbDisplay(sets, 'series', k)); }))) : null,
          ['bar', 'dot', 'mean', 'proportion', 'groupbar', 'stackcount'].includes(id) ? this.tlField('Order of the categories', this.cbSeg('barSort', [['none', 'As in the data'], ['desc', 'Largest first'], ['asc', 'Smallest first'], ['name', 'By name']], 'none', 'Order')) : null),
        h('div', { className: 'tl-col' },
          this.tlField('Number format', this.cbSeg('fmt', [['auto', 'Automatic'], ['full', '17,500'], ['k', '17.5k']], 'auto', 'Number format')),
          this.tlField('Decimals', this.cbSeg('decimals', [['', 'Auto'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], '', 'Decimals')),
          lineish ? this.tlField('Years on the axis', this.cbSeg('everyX', [['', 'Automatic'], ['1', 'Every year with data']], '', 'Years on the axis')) : null));
    } else if (tab === 'colors') {
      const sw = sets.filter(s => s.colorable && s.keys.length);
      body = h('div', { className: 'cb-pane' },
        h('div', { className: 'tl-col' }, sw.length ? sw.map(s => h('div', { key: s.role, className: 'tl-col' }, h('span', { className: 'tl-lbl' }, 'A color for each ' + s.unit + (s.v ? ' (' + s.v + ')' : '')),
          h('div', { className: 'cb-swatches' }, s.keys.slice(0, 40).map((k, i) => h('label', { key: k, className: 'cb-swatch' }, h('input', { type: 'color', value: this.cbColorOf(s, k, i, c), 'aria-label': 'Color for ' + k, onChange: e => this.cbRecolor(s.v, String(k), e.target.value) }), h('span', null, this.cbDisplay(sets, s.role, k))))),
          s.role === 'cats' && s.keys.length > 1 ? h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: !!c.eachColor, onChange: e => this.cbSet({ eachColor: e.target.checked }) }), 'A different color for each bar') : null)) : h('p', { className: 'tl-hint' }, 'This chart uses one color — pick it from a palette, or set the main color in Settings.'),
          sw.length ? h('span', { className: 'tl-hint' }, 'Colors are kept for each variable, so the same category has the same color in every chart.') : null),
        h('div', { className: 'tl-col' },
          this.tlField('Palette', h('div', { className: 'tl-row' }, [['sendero', 'GM26'], ['okabe', 'Colorblind-safe'], ['gray', 'Grays for printing'], ['bold', 'Bold']].map(([k, t]) => h('button', { key: k, type: 'button', className: 'tl-chip cb-pal' + ((c.palette || 'sendero') === k ? ' on' : ''), 'aria-pressed': (c.palette || 'sendero') === k ? 'true' : 'false', onClick: () => this.cbSet({ palette: k }) }, E.CB_PALETTES[k].slice(0, 4).map((col, j) => h('i', { key: j, style: { background: col } })), t)))),
          sw.length ? this.tlField('Highlight one', this.tlSelect(c.highlight || '', [['', 'Nothing — all in color']].concat(sw[0].keys.slice(0, 40).map(k => [String(k), this.cbDisplay(sets, sw[0].role, k)])), v => this.cbSet({ highlight: v }), 'Highlight one')) : null,
          sw.length && sw.some(s => s.role === 'series') && models.some(m => m.type === 'xy') ? this.tlField('Line style', h('div', { className: 'tl-row' }, this.cbSeg('lineWidth', [['thin', 'Thin'], ['normal', 'Normal'], ['thick', 'Thick']], 'normal', 'Line width'), this.cbCheck('markers', 'Dots on the lines', true))) : null,
          this.cbCheck('patterns', 'Add patterns to filled areas (for black-and-white printing)')));
    } else {
      const xy = models.some(m => m.type === 'xy'), cat = m0.type === 'cat';
      body = h('div', { className: 'cb-pane' },
        h('div', { className: 'tl-col' },
          cat || xy ? this.tlField('Start the value axis at zero', this.cbSeg('zero', [['', 'Automatic'], ['1', 'Yes'], ['0', 'No']], '', 'Start at zero')) : null,
          xy ? this.cbCheck('log', 'Log scale for the values') : null,
          this.cbCheck('grid', 'Light grid lines', true),
          cat && m0.mode !== 'diverge' ? this.tlField('Bars', this.cbSeg('horizontal', [['auto', 'Automatic'], ['no', 'Vertical'], ['yes', 'Horizontal']], 'auto', 'Bars')) : null,
          models.length > 1 ? this.tlField('Panels', this.cbSeg('scales', [['shared', 'Same scale'], ['independent', 'Own scale each']], 'shared', 'Panel scales')) : null,
          h('div', { className: 'tl-row' }, this.cbText('ymin', 'Y minimum', 'auto', 90), this.cbText('ymax', 'Y maximum', 'auto', 90), xy ? this.cbText('xmin', 'X minimum', 'auto', 90) : null, xy ? this.cbText('xmax', 'X maximum', 'auto', 90) : null, xy ? this.cbText('xstep', 'X interval', 'auto', 90) : null),
          xy ? h('span', { className: 'tl-hint' }, m0.xTime ? 'X interval: the years between labels — 1 = every year, 2 = every two years. Years without data are shown too.' : 'X interval: the distance between labels on the X axis, e.g. 5 or 10.') : null),
        h('div', { className: 'tl-col' },
          this.tlField('Size', this.cbSeg('size', [['auto', 'Automatic'], ['report', 'Report (3:2)'], ['slide', 'Slide (16:9)'], ['square', 'Square']], 'auto', 'Size')),
          this.tlField('Text', this.cbSeg('text', [['s', 'Small'], ['m', 'Normal'], ['l', 'Large']], 'm', 'Text size'))));
    }
    return h('section', { className: 'tl-panel cb-custom' }, h('div', { className: 'cb-ctitle' }, h('h3', null, 'Customize')), tabs, body);
  }
  cbKeySets(id, res) {
    const models = res.models || [], m0 = models[0] || {}, roles = res.roles || {}, c = this.cbC(), out = [];
    const uniq = a => [...new Set(a.map(String))];
    let series = [], cats = [], panels = [];
    models.forEach(m => {
      if (m.type === 'cat') { cats = cats.concat(m.cats); if (m.series && !(m.series.length === 1 && m.series[0] === 'All')) series = series.concat(m.series); }
      else if (m.type === 'pie') { series = series.concat(m.seriesKeys); panels = panels.concat(m.panels.length > 1 ? m.panels.map(p => p.key) : []); }
      else if (m.type === 'xy') series = series.concat((m.series || []).filter(s => s.style !== 'fit').map(s => s.key)).concat(m.points && !(m.series || []).length ? [...new Set(m.points.map(p => p.k))] : []);
      else if (m.type === 'box') series = series.concat(m.groups.map(g => g.key));
      else if (m.type === 'grid') { cats = cats.concat(m.xs); series = series.concat(m.ys); }
      else if (m.type === 'pair') { if (m.kind === 'slope') series = series.concat(m.pts.map(p => p.label)); else if (m.kind === 'dumbbell') { cats = cats.concat(m.pts.map(p => p.label)); series = series.concat(['__first', '__second']); } }
      if (m.panel != null) panels.push(m.panel);
    });
    series = uniq(series).filter(k => k !== 'All' || !roles.series); cats = uniq(cats); panels = uniq(panels);
    const fam = id === 'dumbbell' ? { series: 'dot', cats: 'row' } : {};
    const sNames = Object.assign({}, this.cbNameMap(roles.series), c.names || {}), cNames = Object.assign({}, this.cbNameMap(roles.cats), c.names || {}), pNames = Object.assign({}, this.cbNameMap(roles.panels), c.names || {});
    if (m0.seriesNames) Object.keys(m0.seriesNames).forEach(k => { if (sNames[k] == null) sNames[k] = m0.seriesNames[k]; });
    if (series.length && !(series.length === 1 && series[0] === 'All')) out.push({ role: 'series', title: m0.type === 'pie' ? 'Slices' : m0.type === 'box' ? 'Groups' : m0.type === 'xy' ? 'Lines and groups' : 'Groups', unit: m0.type === 'pie' ? 'slice' : m0.type === 'xy' ? 'line or group' : fam.series || 'group', v: roles.series, keys: series, map: sNames, colorable: true });
    if (cats.length) out.push({ role: 'cats', title: m0.type === 'grid' ? 'Columns' : 'Categories', unit: fam.cats || 'bar or point', v: roles.cats, keys: cats, map: cNames, colorable: m0.type === 'cat' && (m0.colorBy === 'cat') });
    if (panels.length) out.push({ role: 'panels', title: 'Panels', unit: 'panel', v: roles.panels, keys: panels, map: pNames, colorable: false });
    if (!out.some(s => s.colorable)) out.push({ role: 'single', title: '', unit: 'chart', v: null, keys: ['All'], map: {}, colorable: m0.type !== 'raw' && m0.type !== 'grid', hidden: true });
    return out;
  }
  cbKeySetsLite(v) { return [{ role: 'series', map: this.cbNameMap(v) }]; }
  cbDisplay(sets, role, k) { const s = sets.find(x => x.role === role) || sets[0]; const n = s && s.map && s.map[k]; return n != null && String(n).trim() !== '' ? String(n) : (k === 'All' ? 'All' : String(k)); }
  cbColorOf(s, k, i, c) {
    const E = this._E, pal = E.CB_PALETTES[c.palette || 'sendero'] || E.CB_PALETTES.sendero, S = this.state;
    const own = Object.assign({}, this.cbColorMap(s.v), c.colors || {}); if (own[k]) return own[k];
    const base = c.palette ? pal : [S.chartColor || pal[0], ...pal.filter(x => x.toLowerCase() !== String(S.chartColor || pal[0]).toLowerCase())];
    if (s.role === 'cats') return base[(c.eachColor ? i : 0) % base.length];
    return base[i % base.length];
  }

  // ---- the gallery: nine questions
  // GM26 .70: small pictures of each chart type (gallery and menu)
  cbIcon(k, size) {
    const h = React.createElement, kids = [], G = '#2E7D58', D = '#1F5C44', O = '#E5912A';
    const R = (x, y, w, hh, f) => kids.push(h('rect', { key: 'r' + kids.length, x, y, width: w, height: hh, fill: f || G }));
    if (k === 'bars') [[6, 18, 10, 18], [20, 8, 10, 28], [34, 24, 10, 12], [48, 14, 10, 22]].forEach(r => R(...r));
    else if (k === 'hist') [[6, 28, 9, 8], [15, 16, 9, 20], [24, 6, 9, 30], [33, 14, 9, 22], [42, 26, 9, 10]].forEach(r => R(...r));
    else if (k === 'pie') kids.push(h('circle', { key: 'a', cx: 32, cy: 20, r: 16, fill: '#C9D6CE' }), h('path', { key: 'b', d: 'M32,20 L32,4 A16,16 0 0 1 47.2,25 Z', fill: D }));
    else if (k === 'line') kids.push(h('polyline', { key: 'a', points: '4,30 16,27 28,28 40,16 52,12 60,8', fill: 'none', stroke: G, strokeWidth: 3 }), h('polyline', { key: 'b', points: '4,34 16,33 28,33 40,26 52,24 60,20', fill: 'none', stroke: O, strokeWidth: 3 }));
    else if (k === 'scatter') { [[8, 30], [16, 26], [22, 28], [30, 20], [38, 18], [46, 12], [54, 10]].forEach((q, i) => kids.push(h('circle', { key: i, cx: q[0], cy: q[1], r: 2.6, fill: G }))); kids.push(h('line', { key: 'l', x1: 4, y1: 32, x2: 60, y2: 8, stroke: O, strokeWidth: 2 })); }
    else if (k === 'ci') [[14, 8, 30, 19], [32, 14, 34, 24], [50, 4, 22, 13]].forEach((q, i) => kids.push(h('line', { key: 'l' + i, x1: q[0], x2: q[0], y1: q[1], y2: q[2], stroke: D, strokeWidth: 2 }), h('circle', { key: 'c' + i, cx: q[0], cy: q[3], r: 4, fill: D })));
    else if (k === 'likert') [['#B0572F', 4, 14], ['#E5912A', 18, 10], ['#DDD6C8', 28, 8], ['#80B79B', 36, 12], ['#2E7D58', 48, 12]].forEach(q => R(q[1], 12, q[2], 14, q[0]));
    else if (k === 'coef') kids.push(h('line', { key: 'z', x1: 32, y1: 2, x2: 32, y2: 38, stroke: '#9A917F', strokeDasharray: '3 3' }), ...[[36, 56, 9, 46], [14, 30, 20, 22], [28, 46, 31, 37]].flatMap((q, i) => [h('line', { key: 'l' + i, x1: q[0], x2: q[1], y1: q[2], y2: q[2], stroke: D, strokeWidth: 2 }), h('circle', { key: 'c' + i, cx: q[3], cy: q[2], r: 3.5, fill: D })]));
    else if (k === 'map') kids.push(h('path', { key: 'm', d: 'M6,10 L22,6 L30,14 L44,8 L58,14 L54,30 L36,34 L20,30 L8,24 Z', fill: '#80B79B', stroke: D }));
    else if (k === 'heat') [['#1F5C44', '#80B79B', '#EFE7D6'], ['#80B79B', '#1F5C44', '#E5912A'], ['#EFE7D6', '#E5912A', '#1F5C44']].forEach((row, i) => row.forEach((f, j) => R(14 + j * 12, 4 + i * 11, 11, 10, f)));
    else if (k === 'dumbbell') [[8, 40, 9], [18, 52, 20], [12, 30, 31]].forEach((q, i) => kids.push(h('line', { key: 'l' + i, x1: q[0], x2: q[1], y1: q[2], y2: q[2], stroke: '#9A917F', strokeWidth: 2 }), h('circle', { key: 'a' + i, cx: q[0], cy: q[2], r: 4, fill: O }), h('circle', { key: 'b' + i, cx: q[1], cy: q[2], r: 4, fill: D })));
    else if (k === 'step') kids.push(h('polyline', { key: 'a', points: '4,6 16,6 16,12 28,12 28,20 40,20 40,26 60,26', fill: 'none', stroke: G, strokeWidth: 3 }), h('polyline', { key: 'b', points: '4,6 12,6 12,16 22,16 22,28 36,28 36,34 60,34', fill: 'none', stroke: O, strokeWidth: 3 }));
    const w = size || 64; return h('svg', { viewBox: '0 0 64 40', width: w, height: w * 40 / 64, 'aria-hidden': 'true', focusable: 'false' }, kids);
  }
  cbGallery() {
    const h = React.createElement, E = this._E;
    return h('div', { className: 'tl cb' },
      h('div', { className: 'cb-top' }, h('h2', null, 'Charts'), h('span', { className: 'tl-hint' }, 'Pick a chart type, then the variables.'), h('button', { type: 'button', className: 'tl-link', style: { marginLeft: 'auto' }, onClick: () => this.csOpen('__directory') }, 'Output — everything you have run →')),
      h('div', { className: 'cb-gallery' }, E.CB_FAMILIES.map(f => h('section', { key: f.id, className: 'cb-fam', 'aria-label': f.q },
        h('div', { className: 'cb-famtop' }, this.cbIcon(f.icon), h('div', null, h('h3', null, f.q), f.d ? h('p', null, f.d) : null)),
        h('div', { className: 'cb-famkinds' }, f.kinds.map(([k, t]) => h('button', { key: k, type: 'button', className: 'tl-chip', onClick: () => this.csOpen(k) }, t)))))));
  }
  cbVals(out) {
    const S = this.state, E = this._E; if (E && E.cbFamilyOf && !out.isPlots) this.cbTabLinks(out); if (!out.isPlots || !E || !E.cbFamilyOf) return;
    if (S.plotKind === '__gallery') { out.isChartSuite = true; out.isPlotsLegacy = false; out.plotEmpty = false; out.chartSuiteEl = this.cbGallery(); return; }
    if (!this.cbHandles(S.plotKind)) return;
    out.isChartSuite = true; out.isPlotsLegacy = false; out.plotEmpty = false; out.chartPageHeader = null;
    out.chartSuiteEl = this.cbRender();
  }
  cbMenu(R) {
    const E = this._E, h = R.createElement;
    // GM26 .70: every chart type at once, grouped under its name — no folded questions
    return h('nav', { 'aria-label': 'Chart types', className: 'cs-menu cb-menu' },
      h('div', { className: 'cb-mtop' }, h('button', { type: 'button', onClick: () => this.csOpen('__gallery') }, 'All charts'), h('button', { type: 'button', onClick: () => this.csOpen('__directory') }, 'Output — everything you have run')),
      ...E.CB_FAMILIES.map(f => h('div', { key: f.id, className: 'cb-mgroup', role: 'group', 'aria-label': f.q },
        h('div', { className: 'cb-mhead' }, this.cbIcon(f.icon, 28), h('span', null, f.q)),
        h('div', { className: 'cb-mitems' }, ...f.kinds.map(([id, t]) => h('button', { type: 'button', key: id, className: 'cb-mitem', onClick: () => this.csOpen(id) }, t))))));
  }
  // ---- the same Customize panel, compact, under charts in other tabs (Univariate breakdown)
  // o: { cfg, set(patch), sets: [{ role, title, v, keys, map, colorable }], lineish, open() }
  cbMini(o) {
    const h = React.createElement, E = this._E, cfg = o.cfg || {}, tab = cfg.tab || 'labels', set = o.set;
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist', 'aria-label': 'Customize this chart' }, [['labels', 'Labels'], ['values', 'Values'], ['colors', 'Colors']].map(([k, t]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: tab === k ? 'on' : '', onClick: () => set({ tab: k }) }, t)));
    const seg = (key, opts, def, aria) => this.tlSeg(opts, cfg[key] != null ? cfg[key] : def, v => set({ [key]: v }), { 'aria-label': aria });
    const txt = (key, label, ph) => this.tlField(label, this.tlText(cfg[key] || '', v => set({ [key]: v }), { k: 'mini|' + key + '|' + (o.id || ''), placeholder: ph, aria: label, width: 300 }));
    let body;
    if (tab === 'labels') body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, o.sets.filter(s => s.keys.length && s.role !== 'single').map(s => h('div', { key: s.role, className: 'tl-col' }, h('span', { className: 'tl-lbl' }, s.title + (s.v ? ' (' + s.v + ')' : '')),
        h('div', { className: 'cb-names' }, s.keys.slice(0, 40).map(k => { const cur = s.map[k]; return h('div', { key: k, className: 'cb-name' }, h('code', null, String(k).length > 18 ? String(k).slice(0, 17) + '…' : String(k)), h('span', { 'aria-hidden': 'true' }, '→'), h('input', { className: 'tl-input', key: 'mn|' + k + '|' + (cur || ''), defaultValue: cur && cur !== String(k) ? cur : '', placeholder: String(k), 'aria-label': 'Name for ' + k, onBlur: e => { const val = e.target.value.trim(); if (val === (cur && cur !== String(k) ? cur : '')) return; if (s.v) this.cbRename(s.v, String(k), val, true); else set({ names: Object.assign({}, cfg.names, { [k]: val }) }); }, onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } })); })))),
        o.sets.some(s => s.v && s.keys.length) ? h('span', { className: 'tl-hint' }, 'Names for coded values are saved as value labels, so tables and every chart use them.') : null),
      h('div', { className: 'tl-col' }, txt('title', 'Title', o.autoTitle || ''), txt('subtitle', 'Subtitle', 'optional'), txt('source', 'Source line', 'automatic'), this.tlField('Legend', seg('legend', [['auto', 'Automatic'], ['end', 'Names at the line ends'], ['top', 'On top'], ['none', 'None']], 'auto', 'Legend'))));
    else if (tab === 'values') body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, this.tlField('Values on the chart', seg('values', o.lineish ? [['none', 'None'], ['all', 'Every point'], ['last', 'Last point'], ['firstlast', 'First and last']] : [['none', 'None'], ['all', 'On every bar']], 'none', 'Values on the chart')),
        o.lineish ? this.tlField('Years on the axis', seg('everyX', [['', 'Automatic'], ['1', 'Every year with data']], '', 'Years on the axis')) : null,
        this.tlField('Axis starts at', seg('zero', [['', 'Automatic'], ['1', 'Zero'], ['0', 'Near the data']], '', 'Axis starts at'))),
      h('div', { className: 'tl-col' }, this.tlField('Number format', seg('fmt', [['auto', 'Automatic'], ['full', '17,500'], ['k', '17.5k']], 'auto', 'Number format')), this.tlField('Decimals', seg('decimals', [['', 'Auto'], ['0', '0'], ['1', '1'], ['2', '2']], '', 'Decimals'))));
    else body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, o.sets.filter(s => s.colorable && s.keys.length).map(s => h('div', { key: s.role, className: 'cb-swatches' }, s.keys.slice(0, 40).map((k, i) => h('label', { key: k, className: 'cb-swatch' }, h('input', { type: 'color', value: (s.colors && s.colors[k]) || o.colorOf(k, i), 'aria-label': 'Color for ' + k, onChange: e => { if (s.v && k !== 'Total') this.cbRecolor(s.v, String(k), e.target.value); else set({ colors: Object.assign({}, cfg.colors, { [k]: e.target.value }) }); } }), h('span', null, (s.map[k] && String(s.map[k]).trim()) || String(k))))))),
      h('div', { className: 'tl-col' }, this.tlField('Palette', h('div', { className: 'tl-row' }, [['sendero', 'GM26'], ['okabe', 'Colorblind-safe'], ['gray', 'Grays for printing'], ['bold', 'Bold']].map(([k, t]) => h('button', { key: k, type: 'button', className: 'tl-chip cb-pal' + ((cfg.palette || 'sendero') === k ? ' on' : ''), 'aria-pressed': (cfg.palette || 'sendero') === k ? 'true' : 'false', onClick: () => set({ palette: k }) }, E.CB_PALETTES[k].slice(0, 4).map((c, j) => h('i', { key: j, style: { background: c } })), t))))));
    return h('div', { className: 'tl cb cb-mini' }, h('section', { className: 'tl-panel cb-custom' }, h('div', { className: 'cb-ctitle' }, h('h3', null, 'Customize this chart'), o.open ? h('button', { type: 'button', className: 'tl-link', style: { marginLeft: 'auto' }, onClick: o.open }, 'More options in Charts →') : null), tabs, body));
  }
  // ---- charts in the analysis tabs: a link under each opens the same chart in the Charts tab, ready to customize
  cbOpenWith(id, page) { this.setState(s => ({ csPages: Object.assign({}, s.csPages, { [id]: Object.assign({}, (s.csPages || {})[id] || {}, page) }) }), () => { this.csOpen(id); try { window.scrollTo({ top: 0 }); } catch (e) {} }); }
  cbTabLinks(out) {
    const h = React.createElement, S = this.state, isNum = v => { const m = v && this.effMeta(v); return !!m && m.treatAs === 'numeric'; };
    const wrap = (slot, id, page, what) => { if (!out[slot] || !id) return; out[slot] = h('div', { className: 'cb-under' }, out[slot], h('button', { type: 'button', className: 'cb-more', onClick: () => this.cbOpenWith(id, page), title: 'Open this chart in the Charts tab with the same variables' }, h('span', { 'aria-hidden': 'true' }, '✎ '), 'Names, values at each point, colors — customize ' + (what || 'this chart') + ' in Charts →')); };
    const v = S.exploreVar;
    if (S.tab === 'one' && v) { wrap('barChartEl', 'bar', { x: v, stat: 'count' }, 'the bar chart'); wrap('histChart', 'hist', { x: v }, 'the histogram'); wrap('boxChart', 'box', { x: v }, 'the box plot'); }
    if (S.tab === 'two' && S.xVar && S.yVar) {
      wrap('scatterChartEl', 'scatter', { x: S.xVar, y: S.yVar }, 'the scatter plot');
      wrap('stackChartEl', 'stackcount', { x: S.xVar, y: S.yVar, stat: 'percent' }, 'the stacked bars');
      const cat = isNum(S.xVar) ? S.yVar : S.xVar, num = cat === S.xVar ? S.yVar : S.xVar; wrap('gboxChartEl', 'gbox', { x: cat, y: num }, 'the group box plot');
    }
    if (S.tab === 'ttest' && out.ttChartEl) {
      if (S.ttMode === 'paired' && S.exploreVar && S.ttY2) wrap('ttChartEl', 'paired', { x: S.exploreVar, y: S.ttY2 }, 'the paired chart');
      else if (S.ttMode === 'groups' && S.ttG && S.exploreVar) wrap('ttChartEl', 'mean', { x: S.ttG, y: S.exploreVar }, 'the group means');
    }
    if (S.tab === 'reg') { wrap('coefPlotEl', 'coefficient', { source: 'current' }, 'the coefficient plot'); wrap('mgChartEl', 'prediction', { source: 'current' }, 'the predictions'); }
    if (S.tab === 'ts' && S.tsT && isNum(S.tsT) && (S.tsY || S.tsAggregate === 'count')) wrap('tsChartEl', 'line', { x: S.tsT, y: S.tsY || '', stat: S.tsAggregate === 'sum' ? 'sum' : S.tsAggregate === 'count' ? 'count' : 'mean' }, 'the series');
  }

