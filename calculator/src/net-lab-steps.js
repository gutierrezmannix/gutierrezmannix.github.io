  // ---- measures shared by Map, People and Groups
  nlMeasures(net) {
    if (net.n <= 800) return { done: true, value: this.memo('nlmeas|' + net.key, () => this._E.nlNodeMeasures(net)) };
    return this.nlJob(net, 'measures', 'nlNodeMeasures', [net, {}], 'Measuring every node');
  }
  nlMeasureList(net, M) {
    const L = [['degree', net.directed ? 'Ties (in + out)' : 'Ties (degree)'], ...(net.directed ? [['indegree', 'Ties received (in-degree)'], ['outdegree', 'Ties sent (out-degree)']] : []), ['strengthIn', net.directed ? 'Strength received' : 'Strength'], ['betweenness', 'Bridge (betweenness)'], ['harmonic', 'Reach (harmonic closeness)'], ['closeness', 'Closeness'], ['eigenvector', 'Connected to the well-connected (eigenvector)'], ['pagerank', 'PageRank'], ['constraint', 'Constraint (low = broker)'], ['effsize', 'Effective size'], ['connectedness', 'Connectedness (Fowler)'], ['core', 'Core (k-core)'], ['clustering', 'Local clustering'], ['reach2', 'Reach in 2 steps']];
    return L.filter(([k]) => M && M[k]);
  }
  nlColorBy(net, o, groups) {
    const key = o.map.color;
    if (key === 'group' && groups) return { f: i => this.nlPal(groups.member[i]), legend: groups.sizes.slice(0, 10).map((s, g) => ['Group ' + (g + 1) + ' (' + s + ')', this.nlPal(g)]) };
    const a = key && net.attrs[key];
    if (a && a.kind === 'cat') { const lv = a.levels.slice(0, 12), idx = new Map(lv.map((l, i) => [l, i])); return { f: i => a.v[i] == null ? '#C9C0B0' : idx.has(a.v[i]) ? this.nlPal(idx.get(a.v[i])) : '#9C9180', legend: lv.map((l, i) => [key + ' = ' + l + ' (' + a.v.filter(v => v === l).length + ')', this.nlPal(i)]).concat(a.missing ? [['missing (' + a.missing + ')', '#C9C0B0']] : []) }; }
    if (a && a.kind === 'num') { const xs = Array.from(a.x).filter(isFinite), lo = Math.min(...xs), hi = Math.max(...xs); const col = t => { const c0 = [232, 241, 235], c1 = [25, 79, 57]; return 'rgb(' + c0.map((c, k) => Math.round(c + (c1[k] - c) * t)).join(',') + ')'; }; return { f: i => isFinite(a.x[i]) ? col(hi > lo ? (a.x[i] - lo) / (hi - lo) : 0.5) : '#C9C0B0', legend: [[key + ' ' + this.fmt(lo, 2), col(0)], [this.fmt(hi, 2), col(1)]] }; }
    return { f: () => '#2E7D58', legend: [] };
  }
  // the map: readable layout (separate pieces, isolates strip), labels that never overlap, ego highlight
  nlMapSvg(net, M, o, cfg) {
    const h = React.createElement, E = this._E, W = cfg.W || 820, Hh = cfg.H || 600, mo = Object.assign({}, o.map, cfg.map || {});
    const sizeArr = mo.size === 'same' || !M[mo.size] ? null : Array.from(M[mo.size], v => isFinite(v) ? (mo.size === 'constraint' ? 1 - Math.min(1, v) : v) : 0);
    const mx = sizeArr ? Math.max(1e-12, ...sizeArr) : 1, rmin = net.n > 600 ? 2 : 3, rmax = net.n > 600 ? 9 : 13;
    const R = Float64Array.from({ length: net.n }, (_, i) => sizeArr ? rmin + (rmax - rmin) * Math.sqrt(Math.max(0, sizeArr[i]) / mx) : 5);
    const gsig = cfg.group ? Array.from(cfg.group).join('') : '';
    const lk = 'layout|' + mo.kind + '|' + mo.size + '|' + mo.isolates + '|' + mo.small + '|' + W + 'x' + Hh + '|' + (mo.kind === 'group' ? (cfg.groupKey || '') : '') + '|' + gsig.length;
    const job = this.nlJob(net, lk, 'nlLayout', [net, { W, H: Hh, kind: mo.kind, radius: R, isolates: mo.isolates, small: mo.small, group: mo.kind === 'group' || mo.kind === 'circle' ? cfg.group || null : null, seed: 1 }], 'Drawing the network');
    if (!job.done) return this.tlPending(job.label || 'Drawing the network', job.p);
    const L = job.value; if (!L) return this.tlBanner('warn', 'The map could not be drawn.');
    const col = cfg.color || (() => '#2E7D58'), sel = mo.sel != null && mo.sel < net.n ? mo.sel : null;
    let focus = null; if (sel != null) { focus = new Set([sel, ...net.und[sel]]); }
    if (cfg.focus) focus = cfg.focus;
    const vis = i => L.shown[i] && (!cfg.only || cfg.only.has(i));
    const kids = [h('rect', { key: 'bg', width: W, height: Hh, fill: '#FFFFFF' })];
    if (mo.arrows === 'auto') mo.arrows = net.edges.length / Math.max(1, net.n) <= 8;
    if (net.directed && mo.arrows) kids.push(h('defs', { key: 'defs' }, h('marker', { id: 'nlarr', viewBox: '0 0 6 6', refX: 5.5, refY: 3, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto' }, h('path', { d: 'M0,0.7L6,3L0,5.3Z', fill: '#8C8270' })), h('marker', { id: 'nlarr2', viewBox: '0 0 6 6', refX: 5.5, refY: 3, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto' }, h('path', { d: 'M0,0.7L6,3L0,5.3Z', fill: '#2E7D58' }))));
    const minW = +mo.minW || 1, types = net.types || [], dashT = new Set(types.slice(1));
    const edges = net.edges.filter(([a, b, w]) => w >= minW && vis(a) && vis(b) && L.shown[a] === 1 && L.shown[b] === 1);
    const lw = w => net.weighted ? Math.min(3.2, 0.6 + 0.55 * Math.log(w)) : (net.n > 300 ? 0.7 : 0.9);
    const many = edges.length > 2500, dense = edges.length / Math.max(1, net.n), baseOp = dense > 8 ? 0.13 : dense > 4 ? 0.22 : net.n > 300 ? 0.32 : 0.42;
    mo.arrows = mo.arrows === 'auto' ? dense <= 8 : !!mo.arrows;
    if (many) { let d0 = '', d1 = ''; for (const [a, b] of edges) { const seg = 'M' + L.x[a].toFixed(1) + ',' + L.y[a].toFixed(1) + 'L' + L.x[b].toFixed(1) + ',' + L.y[b].toFixed(1); if (focus && (focus.has(a) && focus.has(b))) d1 += seg; else d0 += seg; } kids.push(h('path', { key: 'e0', d: d0, stroke: '#7E7563', strokeOpacity: focus ? 0.06 : 0.18, strokeWidth: 0.6, fill: 'none' }), d1 ? h('path', { key: 'e1', d: d1, stroke: '#2E7D58', strokeOpacity: 0.7, strokeWidth: 0.9, fill: 'none' }) : null); }
    else {
      const seen = new Set();
      edges.forEach(([a, b, w, t], k) => {
        let x1 = L.x[a], y1 = L.y[a], x2 = L.x[b], y2 = L.y[b]; const on = focus ? (sel != null ? (a === sel || b === sel) : focus.has(a) && focus.has(b)) : false;
        const back = net.directed && net.out[b].has(a), key2 = Math.min(a, b) + ',' + Math.max(a, b);
        if (net.directed && back && !mo.arrows) { if (seen.has(key2)) return; seen.add(key2); }
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        if (net.directed && mo.arrows) { x2 -= dx / len * (R[b] + 2); y2 -= dy / len * (R[b] + 2); x1 += dx / len * R[a]; y1 += dy / len * R[a]; }
        const bend = net.directed && mo.arrows && back ? 4 : 0, mxp = (x1 + x2) / 2 - dy / len * bend, myp = (y1 + y2) / 2 + dx / len * bend;
        kids.push(h('path', { key: 'e' + k, d: 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + 'Q' + mxp.toFixed(1) + ',' + myp.toFixed(1) + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1), stroke: on ? '#2E7D58' : '#7E7563', strokeOpacity: focus ? (on ? 0.8 : 0.07) : baseOp, strokeWidth: lw(w) * (dense > 8 ? 0.8 : 1) + (on ? 0.4 : 0), strokeDasharray: dashT.has(t) ? '3 2' : undefined, fill: 'none', markerEnd: net.directed && mo.arrows ? (on ? 'url(#nlarr2)' : 'url(#nlarr)') : undefined }));
      });
    }
    const order = Array.from({ length: net.n }, (_, i) => i).filter(vis).sort((a, b) => R[a] - R[b]);
    for (const i of order) { const fade = focus && !focus.has(i); kids.push(h('circle', { key: 'n' + i, cx: L.x[i].toFixed(1), cy: L.y[i].toFixed(1), r: (L.shown[i] === 2 ? 3 : R[i]).toFixed(1), fill: col(i), fillOpacity: fade ? 0.22 : (L.shown[i] === 2 ? 0.6 : 0.95), stroke: '#FFFFFF', strokeWidth: L.shown[i] === 2 ? 0 : 1.1, style: { cursor: 'pointer' }, onClick: () => this.nlSetIn('map', { sel: sel === i ? null : i }) }, h('title', null, net.labels[i] + (net.labels[i] !== net.ids[i] ? ' (' + net.ids[i] + ')' : '') + ' · ' + net.und[i].size + ' ties'))); }
    if (sel != null) kids.push(h('circle', { key: 'ring', cx: L.x[sel], cy: L.y[sel], r: R[sel] + 4, fill: 'none', stroke: '#1A1711', strokeWidth: 1.8, pointerEvents: 'none' }));
    if (L.side) kids.push(h('text', { key: 'side', x: L.side.x, y: L.side.y, fontSize: 9.5, fill: '#6B6455', fontFamily: "'Space Mono', monospace" }, L.side.count + ' SMALL SEPARATE GROUP' + (L.side.count === 1 ? '' : 'S')));
    if (L.strip) kids.push(h('text', { key: 'strip', x: L.strip.x, y: L.strip.y, fontSize: 9.5, fill: '#6B6455', fontFamily: "'Space Mono', monospace" }, L.strip.count + ' WITH NO TIES (isolates)'));
    // labels
    const fs = +mo.font || 11, rank = sizeArr ? order.slice().sort((a, b) => sizeArr[b] - sizeArr[a]) : order.slice().sort((a, b) => net.und[b].size - net.und[a].size);
    let pick = mo.which === 'none' ? [] : mo.which === 'all' ? rank.filter(i => L.shown[i] === 1) : mo.which === 'clicked' ? [] : rank.filter(i => L.shown[i] === 1).slice(0, +mo.topN || 30);
    if (sel != null) pick = [sel, ...[...net.und[sel]].sort((a, b) => R[b] - R[a]).slice(0, 12)].concat(pick.filter(i => i !== sel));
    if (cfg.labelOnly) pick = pick.filter(i => cfg.labelOnly.has(i));
    const obst = order.filter(i => R[i] > rmin + 2).slice(-60).map(i => [L.x[i] - R[i], L.y[i] - R[i], L.x[i] + R[i], L.y[i] + R[i]]);
    const placed = E.nlPlaceLabels(pick.map(i => ({ i, x: L.x[i], y: L.y[i], r: R[i], text: net.labels[i], must: i === sel })), obst, { fs, bounds: [2, 2, W - 2, Hh - 2], must: 6 });
    for (const p of placed) kids.push(h('text', { key: 'l' + p.i, x: p.x.toFixed(1), y: p.y.toFixed(1), textAnchor: p.anchor, fontSize: fs, fontWeight: 600, fill: '#1A1711', fontFamily: "'Hanken Grotesk', system-ui, sans-serif", stroke: '#FFFFFF', strokeWidth: 3.2, paintOrder: 'stroke', strokeLinejoin: 'round', pointerEvents: 'none' }, p.text));
    return h('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: '100%', role: 'img', 'aria-label': cfg.title || 'Network map', ref: this.svgRef(cfg.key || 'nlmap'), className: 'tl-svg nl-map' }, ...kids);
  }
  nlLegend(colors, M, o, net) {
    const h = React.createElement;
    return h('div', { className: 'nl-legend' }, colors.legend.map(([l, c], i) => h('span', { key: i }, h('i', { style: { background: c } }), l)),
      h('span', null, 'size = ' + ((this.nlMeasureList(net, M).find(m => m[0] === o.map.size) || [0, 'same size'])[1]).toLowerCase()), net.weighted ? h('span', null, 'line width = tie strength') : null, (net.types || []).length > 1 ? h('span', null, 'dashed = ' + net.types.slice(1).join(', ')) : null);
  }
  // ---- step 3: map
  nlStepMap(o, B) {
    const h = React.createElement, net = B.net, mo = o.map, setM = p => this.nlSetIn('map', p);
    const MJ = this.nlMeasures(net); if (!MJ.done) return this.tlPending(MJ.label, MJ.p); const M = MJ.value;
    const lv = this.nlJob(net, 'louvain', 'nlLouvain', [net, {}], 'Finding groups'); const groups = lv.done ? lv.value : null;
    const attrOpts = Object.keys(net.attrs).map(k => [k, k + (net.attrs[k].kind === 'num' ? ' (number)' : '')]);
    const colors = this.nlColorBy(net, o, groups);
    const grpArr = mo.color && net.attrs[mo.color] && net.attrs[mo.color].kind === 'cat' ? Int32Array.from(net.attrs[mo.color].v, v => v == null ? 999 : net.attrs[mo.color].levels.indexOf(v)) : groups ? groups.member : null;
    // show: everyone / top 20 / bottom 20 / one group (Fowler's figures)
    let only = null; const rankBy = M[mo.size] || M.degree;
    if (mo.show === 'top20' || mo.show === 'bottom20') { const ord = Array.from({ length: net.n }, (_, i) => i).filter(i => net.und[i].size).sort((a, b) => rankBy[b] - rankBy[a]); only = new Set(mo.show === 'top20' ? ord.slice(0, 20) : ord.slice(-20)); }
    const ctl = h('div', { className: 'tl-col nl-ctl' },
      this.tlField('Layout', this.tlSeg([['stress', 'Clean'], ['force', 'Force'], ['circle', 'Circle'], ['group', 'By group']], mo.kind, v => setM({ kind: v }))),
      this.tlField('Colour by', this.tlSelect(mo.color, [['', 'one colour'], ['group', 'groups found (step 5)']].concat(attrOpts), v => setM({ color: v }), 'Colour by')),
      this.tlField('Size by', this.tlSelect(mo.size, this.nlMeasureList(net, M).concat([['same', 'same size']]), v => setM({ size: v }), 'Size by')),
      this.tlField('Label with', this.tlSelect(o.label, (this._nlN ? this._nlN.names : [o.from]).map(n => [n, n]), v => this.nlSet({ label: v }), 'Label with'), this.tlChip('shorten titles', !!o.short, () => this.nlSet({ short: !o.short }))),
      this.tlField('Label which', this.tlSeg([['top', 'top ' + (mo.topN || 30)], ['all', 'all'], ['clicked', 'clicked'], ['none', 'none']], mo.which, v => setM({ which: v })), mo.which === 'top' ? this.tlNum(+mo.topN || 30, v => setM({ topN: v }), { min: 1, max: 500, aria: 'How many labels' }) : null, h('span', { className: 'tl-hint' }, 'labels never overlap; hover any dot for its name')),
      this.tlField('Ties', h('div', { className: 'tl-row' }, net.directed ? this.tlChip('arrows', mo.arrows === 'auto' ? net.edges.length / Math.max(1, net.n) <= 8 : !!mo.arrows, () => setM({ arrows: !(mo.arrows === 'auto' ? net.edges.length / Math.max(1, net.n) <= 8 : !!mo.arrows) })) : null, net.weighted || B.info.wMax > 1 ? h('span', { className: 'tl-hint' }, 'show strength ≥') : null, net.weighted || B.info.wMax > 1 ? this.tlNum(+mo.minW || 1, v => setM({ minW: v }), { min: 1, max: B.info.wMax, aria: 'Show ties with strength at least' }) : null)),
      this.tlField('Isolates' + (B.info.isolates ? ' (' + B.info.isolates + ')' : ''), this.tlSeg([['strip', 'strip below'], ['hide', 'hide'], ['map', 'in the map']], mo.isolates, v => setM({ isolates: v }))),
      this.tlField('Small separate groups', this.tlSeg([['side', 'side column'], ['hide', 'hide'], ['map', 'in the map']], mo.small, v => setM({ small: v }))),
      this.tlField('Show', this.tlSeg([['all', 'everyone'], ['top20', 'top 20'], ['bottom20', 'bottom 20']], mo.show, v => setM({ show: v }))),
      this.tlField('Text size', this.tlNum(+mo.font || 11, v => setM({ font: v }), { min: 7, max: 20, aria: 'Label text size' })),
      this.tlField('Find', this.tlText('', v => { const q = v.trim().toLowerCase(); if (!q) return; const i = net.labels.findIndex(l => l.toLowerCase().includes(q)); const j = i >= 0 ? i : net.ids.findIndex(l => l.toLowerCase().includes(q)); if (j >= 0) setM({ sel: j }); else this.flash('Nobody called “' + v + '”'); }, { placeholder: 'name…', aria: 'Find a person' })));
    const svg = this.nlMapSvg(net, M, o, { color: colors.f, group: grpArr, groupKey: mo.color || 'louvain', only, title: 'Network map', key: 'nlmap' });
    const sel = mo.sel != null && mo.sel < net.n ? mo.sel : null;
    return h(React.Fragment, null, h('div', { className: 'nl-mapgrid' }, ctl,
      h('div', { className: 'tl-col' }, svg, this.nlLegend(colors, M, o, net), this.tlExportRow('nlmap', 'network-map')),
      sel != null ? this.nlInspector(net, M, sel, o) : h('div', { className: 'tl-panel nl-insp' }, h('p', { className: 'tl-hint' }, 'Click anyone on the map to see their ties, measures and broker roles. Use “top 20 / bottom 20” to compare the most and least connected (Fowler, figs. 3–4).'))),
      this.nlNav(o, ['overview', 'Overview'], ['people', 'People']));
  }
  nlInspector(net, M, i, o) {
    const h = React.createElement, rank = (arr, desc = true) => 1 + Array.from(arr).filter(v => desc ? v > arr[i] : v < arr[i]).length;
    const outs = [...net.wout[i]].sort((a, b) => b[1] - a[1]).slice(0, 6), ins = [...net.win[i]].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const cat = Object.keys(net.attrs).find(k => net.attrs[k].kind === 'cat' && net.attrs[k].levels.length <= 8);
    const br = cat && net.directed ? this.memo('nlbrk|' + net.key + '|' + cat, () => this._E.nlBrokerage(net, cat)) : null;
    const nm = j => net.labels[j];
    return h('div', { className: 'tl-panel nl-insp' }, h('div', { className: 'tl-ptitle' }, h('h3', null, net.labels[i]), h('div', { className: 'tl-pr' }, this.tlBtn('×', () => this.nlSetIn('map', { sel: null }), '', { 'aria-label': 'Close' }))),
      h('span', { className: 'tl-hint' }, net.ids[i] + Object.keys(net.attrs).slice(0, 4).map(k => ' · ' + k + ' ' + (net.attrs[k].v[i] == null ? '—' : net.attrs[k].v[i])).join('')),
      h('div', { className: 'tl-stats two' }, net.directed ? this.tlStat('received', String(net.inn[i].size)) : this.tlStat('ties', String(net.und[i].size)), net.directed ? this.tlStat('sent', String(net.out[i].size)) : this.tlStat('strength', this.fmt(M.strengthIn[i], 0)), this.tlStat('bridge rank', '#' + rank(M.betweenness), 'betweenness ' + this.fmt(M.betweenness[i], 1)), this.tlStat('constraint', isFinite(M.constraint[i]) ? this.fmt(M.constraint[i], 2) : '—', 'low = broker')),
      br ? h('div', null, h('span', { className: 'tl-lbl' }, 'Broker roles (' + cat + ')'), h('p', { className: 'tl-hint' }, ['coordinator', 'gatekeeper', 'representative', 'consultant', 'liaison'].filter(r => br[r][i]).map(r => r + ' ' + br[r][i]).join(' · ') || 'none — no open two-step paths through this person')) : null,
      outs.length ? h('div', null, h('span', { className: 'tl-lbl' }, net.directed ? 'Sends most to' : 'Strongest ties'), h('p', { className: 'tl-hint' }, outs.map(([j, w]) => nm(j) + (net.weighted ? ' ' + w : '')).join(' · '))) : null,
      net.directed && ins.length ? h('div', null, h('span', { className: 'tl-lbl' }, 'Receives most from'), h('p', { className: 'tl-hint' }, ins.map(([j, w]) => nm(j) + (net.weighted ? ' ' + w : '')).join(' · '))) : null);
  }
  // ---- step 4: people
  nlQuestions(net) {
    return [['attention', 'Who gets the most attention?', net.directed ? 'indegree' : 'degree', 'ties received · in-degree'], ...(net.directed ? [['outreach', 'Who reaches out most?', 'outdegree', 'ties sent · out-degree']] : []),
      ['bridges', 'Who are the bridges?', 'betweenness', 'betweenness'], ['reach', 'Who can reach everyone fastest?', 'harmonic', 'closeness · harmonic'], ['eigen', 'Connected to the well-connected?', 'eigenvector', 'eigenvector · PageRank'],
      ['brokers', 'Who brokers between groups?', 'constraint', 'constraint · effective size · roles'], ['connected', 'Best connected, counting tie strength?', 'connectedness', 'Fowler’s connectedness'], ['core', 'Who sits in the core?', 'core', 'k-core']];
  }
  nlStepPeople(o, B) {
    const h = React.createElement, net = B.net, MJ = this.nlMeasures(net); if (!MJ.done) return this.tlPending(MJ.label, MJ.p); const M = MJ.value;
    const Q = this.nlQuestions(net), q = Q.find(x => x[0] === o.people.q) || Q[0], key = q[2], asc = key === 'constraint';
    const idx = Array.from({ length: net.n }, (_, i) => i).filter(i => isFinite(M[key][i])).sort((a, b) => asc ? M[key][a] - M[key][b] : M[key][b] - M[key][a]);
    const rows = o.people.all ? idx : idx.slice(0, 15), f = (x, d) => isFinite(x) ? this.fmt(x, d) : '—';
    const rk = arr => { const ord = Array.from({ length: net.n }, (_, i) => i).sort((a, b) => arr[b] - arr[a]), r = new Int32Array(net.n); ord.forEach((v, k) => { r[v] = k + 1; }); return r; };
    const rB = this.memo('nlrkb|' + net.key, () => rk(M.betweenness)), rD = this.memo('nlrkd|' + net.key, () => rk(net.directed ? M.indegree : M.degree));
    const cat = this.nlBestAttr(net) || Object.keys(net.attrs).find(k => net.attrs[k].kind === 'cat');
    const cols = [['#', null], ['name', null], ...(cat ? [[cat, null]] : []), ...(net.directed ? [['received', 'indegree', 0], ['sent', 'outdegree', 0]] : [['ties', 'degree', 0]]), ...(net.weighted ? [['strength', 'strengthIn', 0]] : []), ['bridge (rank)', 'betweenness', 1], [M.connectednessHarmonic ? 'reach' : 'closeness', M.connectednessHarmonic ? 'harmonic' : 'closeness', 2], ['eigenvector', 'eigenvector', 2], ['constraint', 'constraint', 2], ['connected', 'connectedness', 2], ['core', 'core', 0]];
    const tbl = h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-tbl nl-ppl' }, h('thead', null, h('tr', null, cols.map(([l, k], c) => h('th', { key: c, className: k ? 'n' + (k === key || (key === 'harmonic' && k === 'closeness') ? ' hl' : '') : '' }, l)))),
      h('tbody', null, rows.map((i, r) => h('tr', { key: i }, h('td', { className: 'x' }, r + 1), h('td', { className: 'w nm' }, net.labels[i]), cat ? h('td', null, net.attrs[cat].v[i] == null ? '—' : net.attrs[cat].v[i]) : null,
        ...cols.slice(cat ? 3 : 2).map(([l, k, d], c) => h('td', { key: c, className: 'n' + (k === key ? ' hl' : '') }, k === 'betweenness' ? h(React.Fragment, null, f(M[k][i], 1), h('em', null, ' #' + rB[i])) : f(M[k][i], d))))))));
    const top = idx.slice(0, 3).map(i => net.labels[i]), tb = idx[0];
    const msg = { attention: top.join(', ') + ' receive the most ties. Popularity is the simplest kind of centrality (Kadushin ch. 3); in Fowler’s cosponsorship study it is the number of colleagues who support a legislator.',
      outreach: top.join(', ') + ' send the most ties — the most active members.',
      bridges: top.join(', ') + ' sit on the most shortest paths between others: if they left, messages would have to take longer routes. ' + (rD[tb] > 5 ? net.labels[tb] + ' is the #1 bridge but only #' + rD[tb] + ' by ties received — bridges and popular people are not the same (Kadushin ch. 3).' : ''),
      reach: top.join(', ') + ' can reach everyone in the fewest steps' + (M.connectednessHarmonic ? ' (harmonic closeness, because not everyone can reach everyone)' : '') + '.',
      eigen: top.join(', ') + ' are tied to people who are themselves well tied — “popular among the popular” (Bonacich).',
      brokers: top.join(', ') + ' have the lowest constraint: their contacts are not tied to one another, so they bridge structural holes and can broker between groups (Burt). High constraint means a closed, cohesive circle.',
      connected: top.join(', ') + ' are best connected once tie strength counts: strong, repeated ties make people closer (Fowler’s connectedness, distances = 1 / strength).',
      core: 'The core (k = ' + Math.max(...M.core) + ') has ' + Array.from(M.core).filter(c => c === Math.max(...M.core)).length + ' members, each tied to at least ' + Math.max(...M.core) + ' others in the core (core/periphery, Kadushin ch. 4).' }[q[0]];
    const mk = ['degree', 'betweenness', 'harmonic', 'eigenvector', 'constraint', 'connectedness', 'core'].concat(net.weighted ? ['strengthIn'] : []), ML = { degree: 'ties', betweenness: 'bridge', harmonic: 'reach', eigenvector: 'eigen', constraint: 'constraint', connectedness: 'connected', core: 'core', strengthIn: 'strength' };
    const cor = this.memo('nlcor|' + net.key, () => mk.map(a => mk.map(b => { const ok = Array.from({ length: net.n }, (_, i) => i).filter(i => isFinite(M[a][i]) && isFinite(M[b][i])); const xa = ok.map(i => M[a][i]), xb = ok.map(i => M[b][i]), ma = xa.reduce((s, v) => s + v, 0) / ok.length, mb = xb.reduce((s, v) => s + v, 0) / ok.length; let sab = 0, sa = 0, sb = 0; xa.forEach((v, k) => { sab += (v - ma) * (xb[k] - mb); sa += (v - ma) ** 2; sb += (xb[k] - mb) ** 2; }); return sa && sb ? sab / Math.sqrt(sa * sb) : NaN; })));
    const heat = v => !isFinite(v) ? '#F2ECE1' : v >= 0 ? 'rgba(46,125,88,' + Math.abs(v).toFixed(2) + ')' : 'rgba(176,87,47,' + Math.abs(v).toFixed(2) + ')';
    const cm = h('table', { className: 'nl-hm' }, h('tbody', null, h('tr', null, h('td'), mk.map(a => h('th', { key: a }, ML[a]))), mk.map((a, i) => h('tr', { key: a }, h('th', null, ML[a]), mk.map((b, j) => h('td', { key: b, style: { background: heat(cor[i][j]), color: Math.abs(cor[i][j]) > 0.55 ? '#fff' : '#1A1711' } }, isFinite(cor[i][j]) ? cor[i][j].toFixed(2) : '—'))))));
    const tsv = () => [['name', 'id', ...mk].join('\t')].concat(Array.from({ length: net.n }, (_, i) => [net.labels[i], net.ids[i], ...mk.map(k => isFinite(M[k][i]) ? +M[k][i].toFixed(6) : '')].join('\t'))).join('\n');
    return h(React.Fragment, null,
      h('div', { className: 'nl-qgrid' }, Q.map(([k, t, , sub]) => h('button', { key: k, type: 'button', className: 'nl-q' + (k === q[0] ? ' on' : ''), onClick: () => this.nlSetIn('people', { q: k }) }, h('b', null, t), h('span', null, sub)))),
      this.tlPanel(q[1], 'sorted by ' + q[3] + ' · ' + rows.length + ' of ' + idx.length, h('div', { className: 'tl-row' }, this.tlBtn(o.people.all ? 'Top 15' : 'Show all ' + idx.length, () => this.nlSetIn('people', { all: !o.people.all })), this.tlBtn(this.state.copied === 'nlppl' ? 'Copied ✓' : 'Copy table', () => this.copyTSV('nlppl', tsv())), this.tlBtn('Add to the people data →', () => this.nlSet({ step: 'save' }), 'green')), tbl),
      h('div', { className: 'nl-two' }, this.nlWhat(msg), this.tlPanel('Do the measures agree?', 'correlations (Fowler, Table 6)', null, cm, h('span', { className: 'tl-hint' }, 'Measures that correlate highly tell the same story; low or negative correlations (e.g. constraint) add something different.'))),
      this.nlNav(o, ['map', 'Map'], ['groups', 'Groups']));
  }
  // ---- step 5: groups
  nlGroups(net, o) {
    const g = o.groups, E = this._E;
    if (g.method === 'louvain') { const J = this.nlJob(net, 'louvain' + (g.res !== 1 ? g.res : ''), 'nlLouvain', [net, { resolution: +g.res || 1 }], 'Finding groups'); return J.done ? Object.assign({ done: true, name: 'Communities', note: 'modularity Q = ' + this.fmt(J.value.Q, 3) }, J.value) : J; }
    if (g.method === 'components') { const C = this.memo('nlcomp|' + net.key, () => E.nlComponents(net)); return { done: true, value: true, member: C.comp, sizes: C.sizes, name: 'Separate pieces', note: C.sizes.filter(s => s > 1).length + ' pieces with ties' }; }
    if (g.method === 'core') { const M = this.nlMeasures(net); if (!M.done) return M; const core = M.value.core, mx = Math.max(...core), ks = [...new Set(core)].sort((a, b) => b - a), member = Int32Array.from(core, c => ks.indexOf(c)); return { done: true, value: true, member, sizes: ks.map(k => Array.from(core).filter(c => c === k).length), names: ks.map(k => k === mx ? 'Core (k = ' + k + ')' : 'k = ' + k), name: 'Core / periphery', note: 'k-cores: everyone in the k-core has at least k ties inside it' }; }
    if (g.method === 'equiv') { const J = this.nlJob(net, 'equiv' + g.k, 'nlEquivalence', [net, +g.k || 4], 'Comparing tie profiles'); return J.done ? Object.assign({ done: true, name: 'Same position', note: 'structural equivalence: people tied to the same others' }, J.value) : J; }
    if (g.method === 'cliques') { const C = this.memo('nlclq|' + net.key, () => E.nlCliques(net)); const member = new Int32Array(net.n).fill(-1); C.cliques.slice(0, 12).forEach((c, k) => c.forEach(v => { if (member[v] < 0) member[v] = k; })); return { done: true, value: true, member, sizes: C.cliques.slice(0, 12).map(c => c.length), cliques: C, name: 'Cliques', note: C.cliques.length + ' cliques of 3 or more' + (C.mutualOnly ? ' (mutual ties)' : '') + (C.capped ? ' — first 5,000' : '') }; }
  }
  nlStepGroups(o, B) {
    const h = React.createElement, net = B.net, G = this.nlGroups(net, o); if (!G.done) return this.tlPending(G.label || 'Finding groups', G.p);
    const MJ = this.nlMeasures(net); if (!MJ.done) return this.tlPending(MJ.label, MJ.p); const M = MJ.value;
    const k = G.sizes.length, gname = j => (G.names && G.names[j]) || (o.groups.method === 'cliques' ? 'Clique ' + (j + 1) : 'Group ' + (j + 1));
    const cat = o.groups.attr && net.attrs[o.groups.attr] ? o.groups.attr : this.nlBestAttr(net) || Object.keys(net.attrs).find(a => net.attrs[a].kind === 'cat');
    const kShow = Math.min(k, 12), blocks = this.memo('nlblk|' + net.key + '|' + o.groups.method + o.groups.k + o.groups.res, () => this._E.nlBlocks(net, G.member, kShow));
    const cards = Array.from({ length: kShow }, (_, j) => { const mem = Array.from({ length: net.n }, (_, i) => i).filter(i => G.member[i] === j).sort((a, b) => M.degree[b] - M.degree[a]); if (mem.length < 2 && o.groups.method !== 'cliques') return null;
      const comp = cat ? net.attrs[cat].levels.map(l => [l, mem.filter(i => net.attrs[cat].v[i] === l).length]).filter(x => x[1]) : [];
      return h('div', { key: j, className: 'nl-gcard' }, h('div', { className: 'gh' }, h('i', { style: { background: this.nlPal(j) } }), h('b', null, gname(j)), h('em', null, mem.length + ' members')), h('span', { className: 'tl-hint' }, mem.slice(0, 6).map(i => net.labels[i]).join(', ') + (mem.length > 6 ? '…' : '')),
        comp.length ? h('div', { className: 'nl-pbar' }, comp.map(([l, c], t) => h('i', { key: t, title: cat + ' = ' + l + ': ' + c, style: { flex: c, background: this.nlPal(t + 6) } }))) : null, comp.length ? h('span', { className: 'tl-hint' }, comp.map(([l, c]) => cat + ' ' + l + ': ' + c).join(' · ') + (isFinite(blocks.density[j] && blocks.density[j][j]) ? ' · ties inside ' + this.fmt(blocks.density[j][j], 2) : '')) : null); }).filter(Boolean);
    const heat = v => isFinite(v) ? 'rgba(46,125,88,' + Math.min(1, v * 1.2).toFixed(2) + ')' : '#F2ECE1';
    const bt = kShow > 1 ? h('table', { className: 'nl-hm' }, h('tbody', null, h('tr', null, h('td'), Array.from({ length: kShow }, (_, j) => h('th', { key: j }, 'G' + (j + 1)))), blocks.density.map((r, i) => h('tr', { key: i }, h('th', null, 'G' + (i + 1)), r.map((v, j) => h('td', { key: j, style: { background: heat(v), color: v > 0.45 ? '#fff' : '#1A1711' } }, isFinite(v) ? v.toFixed(2) : '—')))))) : null;
    const color = i => G.member[i] >= 0 && G.member[i] < 12 ? this.nlPal(G.member[i]) : '#C9C0B0';
    const svg = this.nlMapSvg(net, M, o, { color, group: G.member, groupKey: o.groups.method, W: 640, H: 460, key: 'nlgroups', title: 'Groups', map: { which: 'top', topN: 16, sel: null } });
    const saveIt = () => { this.nlSetIn('save', { group: { method: o.groups.method, member: Array.from(G.member, v => v + 1), name: G.name } }); this.nlSet({ step: 'save' }); };
    const words = o.groups.method === 'louvain' ? 'Communities have many ties inside and few between (modularity Q = ' + this.fmt(G.Q, 2) + '; above 0.3 is a clear group structure). Groups are found by the Louvain method; change the resolution for more, smaller groups. Members belong to one group only — real social circles overlap (Kadushin ch. 4, 8).' : o.groups.method === 'core' ? 'The core is the most cohesive part of the network; the periphery is tied mostly to the core (Kadushin ch. 4).' : o.groups.method === 'equiv' ? 'People in the same position are tied to the same others, even if they are not tied to each other — like roles (blockmodels, White, Boorman & Breiger).' : o.groups.method === 'cliques' ? 'A clique is a set where everyone is tied to everyone (maximal complete subgraph). The largest are shown; people can be in several cliques.' : 'Separate pieces cannot reach each other at all.';
    return h(React.Fragment, null,
      h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Find groups by'), this.tlSeg([['louvain', 'Communities'], ['core', 'Core / periphery'], ['cliques', 'Cliques'], ['equiv', 'Same position'], ['components', 'Separate pieces']], o.groups.method, v => this.nlSetIn('groups', { method: v })),
        o.groups.method === 'louvain' ? h(React.Fragment, null, h('span', { className: 'tl-hint' }, 'resolution'), this.tlNum(+o.groups.res || 1, v => this.nlSetIn('groups', { res: v }), { min: 0.2, max: 4, step: 0.1, aria: 'Resolution' })) : null,
        o.groups.method === 'equiv' ? h(React.Fragment, null, h('span', { className: 'tl-hint' }, 'positions'), this.tlNum(+o.groups.k || 4, v => this.nlSetIn('groups', { k: v }), { min: 2, max: 20, aria: 'Number of positions' })) : null,
        cat ? h(React.Fragment, null, h('span', { className: 'tl-hint' }, 'describe by'), this.tlSelect(cat, Object.keys(net.attrs).filter(a => net.attrs[a].kind === 'cat').map(a => [a, a]), v => this.nlSetIn('groups', { attr: v }), 'Describe groups by')) : null),
      h('div', { className: 'nl-gmap' }, h('div', { className: 'tl-col' }, svg, h('div', { className: 'nl-legend' }, Array.from({ length: kShow }, (_, j) => h('span', { key: j }, h('i', { style: { background: this.nlPal(j) } }), gname(j))), h('span', null, G.note)), this.tlExportRow('nlgroups', 'network-groups')),
        h('div', { className: 'tl-col' }, (() => { if (o.groups.method === 'cliques') return null; const multi = G.sizes.filter(s => s > 1).length, rest = G.sizes.filter((s, j) => s > 1 && j >= kShow); return rest.length ? h('span', { className: 'tl-hint' }, 'Showing ' + cards.length + ' of ' + multi + ' groups. The other ' + rest.length + ' (' + this.fmtN(rest.reduce((a, b) => a + b, 0)) + ' members, ' + (rest.length === 1 ? 'a small group' : 'all small') + ') are grey on the map and left out of the table below; Save keeps every group.') : null; })(), h('div', { className: 'nl-gcards' }, cards), bt ? h('div', null, h('span', { className: 'tl-lbl' }, 'Ties within / between groups (density)'), bt) : null, this.nlWhat(words), h('div', { className: 'tl-row' }, this.tlBtn('Save groups as a variable →', saveIt, 'primary')))),
      this.nlNav(o, ['people', 'People'], ['ties', 'Ties & similarity']));
  }
