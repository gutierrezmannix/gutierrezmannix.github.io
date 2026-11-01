  // GM26 net lab begin
  // ===== Networks analysis (Design A): Data · Overview · Map · People · Groups · Ties & similarity · Over time · Save
  nlDefaults() {
    return { step: 'data', from: '', to: '', id: '', label: '', short: true, weight: '', type: '', keep: {}, twoWay: {}, date: '', y0: '', y1: '', minW: 1, directed: true, attrs: null,
      map: { kind: 'stress', color: 'group', size: 'degree', which: 'top', topN: 30, minW: 1, arrows: 'auto', isolates: 'strip', small: 'side', font: 12, sel: null, show: 'all', hi: '' },
      people: { q: 'attention', all: false, broker: '' }, groups: { method: 'louvain', k: 4, res: 1, attr: '' },
      ties: { attr: '', model: null, drop: false, run: 0 }, time: { attr: '' }, save: { vars: null, anon: false } };
  }
  nlS() { const d = this.nlDefaults(), s = this.state.nl || {}; const o = Object.assign({}, d, s); for (const k of ['map', 'people', 'groups', 'ties', 'time', 'save']) o[k] = Object.assign({}, d[k], s[k] || {}); return o; }
  nlSet(patch) { this.setState(st => ({ nl: Object.assign({}, st.nl || {}, typeof patch === 'function' ? patch(this.nlS()) : patch) })); }
  nlSetIn(k, patch) { this.setState(st => { const cur = Object.assign({}, this.nlDefaults()[k], (st.nl || {})[k] || {}); return { nl: Object.assign({}, st.nl || {}, { [k]: Object.assign(cur, typeof patch === 'function' ? patch(cur) : patch) }) }; }); }
  nlPal(i) { return ['#2E7D58', '#C4681E', '#357F93', '#7E57C2', '#B0572F', '#C2185B', '#6B8E23', '#E5912A', '#1A5061', '#8C6D3F', '#5D5648', '#4C9A6A'][((i % 12) + 12) % 12]; }
  // ---- files
  async nlLoad(kind, file) {
    const E = await this._engineP;
    try {
      const buf = await file.arrayBuffer(), u8 = new Uint8Array(buf, 0, Math.min(16, buf.byteLength)); let head = ''; for (let i = 0; i < u8.length; i++) head += String.fromCharCode(u8[i]);
      const isDta = head.startsWith('<stata_dta>') || (/\.dta$/i.test(file.name) && u8[0] >= 102 && u8[0] <= 119), isX = (u8[0] === 0x50 && u8[1] === 0x4B) || /\.xlsx?$/i.test(file.name);
      const raw = isDta ? await E.parseDTA(buf, () => {}) : isX ? await E.parseXLSX(buf, () => {}) : await E.parseCSV(buf, () => {});
      this.nlTake(kind, raw, file.name);
    } catch (e) { this.flash('Could not read ' + file.name + ': ' + (e.message || e)); }
  }
  nlUseCurrent(kind) { if (this._raw) this.nlTake(kind, this._raw, (this.state.fileName || 'current dataset') + ' (current)'); }
  nlTake(kind, raw, name) {
    const E = this._E; this._nlVer = (this._nlVer || 0) + 1;
    if (kind === 'e') { this._nlE = raw; this._nlEname = name; } else { this._nlN = raw; this._nlNname = name; }
    const g = E.nlGuess(this._nlE, this._nlN), patch = {};
    if (kind === 'e' && this._nlE) { Object.assign(patch, { from: g.from, to: g.to, weight: g.weight || '', type: g.type || '', date: g.date || '', keep: {}, twoWay: {}, y0: '', y1: '' });
      if (g.type) { const b = E.nlBuild(this._nlE, null, { from: g.from, to: g.to, type: g.type }); if (!b.error) { const tw = {}; for (const [t, r] of Object.entries(b.info.typeRecip)) if (r >= 0.95) tw[t] = true; patch.twoWay = tw; } } }
    if (this._nlN && (kind === 'n' || !this.nlS().id)) Object.assign(patch, { id: g.id, label: g.label, attrs: g.attrs });
    if (kind === 'e' && !this._nlN) Object.assign(patch, { id: '', label: '', attrs: null });
    patch.ties = Object.assign({}, this.nlS().ties, { model: null }); patch.map = Object.assign({}, this.nlS().map, { sel: null, color: 'group' });
    this.nlSet(patch);
  }
  nlClearNodes() { this._nlN = null; this._nlNname = ''; this._nlVer = (this._nlVer || 0) + 1; this.nlSet({ id: '', label: '', attrs: null }); }
  nlOpts(o) { return { from: o.from, to: o.to, id: o.id, label: o.label, short: o.short, weight: o.weight, type: o.type, keep: o.keep, twoWay: o.twoWay, date: o.date, y0: +o.y0 || 0, y1: +o.y1 || 0, minW: +o.minW || 0, directed: o.directed !== false, attrs: o.attrs || undefined }; }
  nlNet(o) {
    if (!this._nlE) return null; o = o || this.nlS();
    const key = 'nlnet|' + (this._nlVer || 0) + '|' + JSON.stringify(this.nlOpts(o));
    this._nlMemo = this._nlMemo || {}; if (this._nlMemo.k === key) return this._nlMemo.v;
    const v = this._E.nlBuild(this._nlE, this._nlN, this.nlOpts(o)); if (v.net) v.key = key; this._nlMemo = { k: key, v }; return v;
  }
  nlJob(net, name, fn, args, label) { const J = this.tlJob('nl|' + net.key + '|' + name, fn, () => args, label); if (!J.done && J.p && typeof J.p === 'object') return Object.assign({}, J, { p: J.p.p, label: J.p.msg || label }); return J; }
  nlFile(kind) {
    const h = React.createElement, ref = el => { this['_nlIn' + kind] = el; };
    return h('input', { type: 'file', accept: '.csv,.tsv,.txt,.xlsx,.xlsm,.dta', style: { display: 'none' }, ref, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) this.nlLoad(kind, f); e.target.value = ''; } });
  }
  // ---- the whole tab
  nlRender() {
    const h = React.createElement;
    if (!this._E || !this._E.nlBuild) return this.tlPending('Starting the network engine');
    const o = this.nlS();
    const steps = [['data', 'Data'], ['overview', 'Overview'], ['map', 'Map'], ['people', 'People'], ['groups', 'Groups'], ['ties', 'Ties & similarity'], ['time', 'Over time'], ['save', 'Save']];
    const B = this.nlNet(o), ok = B && B.net, cur = steps.findIndex(s => s[0] === o.step);
    const bar = h('nav', { className: 'tl-steps', 'aria-label': 'Network analysis steps' },
      steps.map(([k, l], i) => [i ? h('span', { key: 's' + i, className: 'tl-sep', 'aria-hidden': 'true' }) : null,
        h('button', { key: k, type: 'button', className: 'tl-step' + (i === cur ? ' on' : i < cur ? ' done' : ''), disabled: !ok && i > 0, 'aria-current': i === cur ? 'step' : undefined, onClick: () => this.nlSet({ step: k }) }, h('i', null, i < cur ? '✓' : String(i + 1)), l)]));
    const title = ok ? h('div', { className: 'nl-title' }, h('b', null, 'NETWORKS'), h('span', null, this.fmtN(B.net.n) + ' ' + (B.net.n === 1 ? 'node' : 'nodes') + ' · ' + this.fmtN(B.net.edges.length) + ' ties · ' + (B.net.directed ? 'directed' : 'undirected') + (B.net.weighted ? ' · weighted' : '')), h('span', { className: 'r' }, this._nlEname ? h('span', { className: 'tl-chip soft' }, 'Ties: ' + this._nlEname) : null, this._nlNname ? h('span', { className: 'tl-chip soft' }, 'People: ' + this._nlNname) : null)) : null;
    let body;
    if (o.step === 'data' || !ok) body = this.nlStepData(o, B);
    else if (o.step === 'overview') body = this.nlStepOverview(o, B);
    else if (o.step === 'map') body = this.nlStepMap(o, B);
    else if (o.step === 'people') body = this.nlStepPeople(o, B);
    else if (o.step === 'groups') body = this.nlStepGroups(o, B);
    else if (o.step === 'ties') body = this.nlStepTies(o, B);
    else if (o.step === 'time') body = this.nlStepTime(o, B);
    else body = this.nlStepSave(o, B);
    return h('div', { className: 'tl nl' }, this.nlFile('e'), this.nlFile('n'), title, bar, body);
  }
  nlNav(o, prev, next) { const h = React.createElement; return h('div', { className: 'tl-navrow' }, prev ? this.tlBtn('← ' + prev[1], () => this.nlSet({ step: prev[0] })) : h('span'), next ? this.tlBtn(next[1] + ' →', () => this.nlSet({ step: next[0] }), 'green') : null); }
  nlWhat(...kids) { const h = React.createElement; return h('div', { className: 'nl-what' }, h('b', null, 'WHAT THIS MEANS'), ...kids); }
  // ---- step 1: data
  nlStepData(o, B) {
    const h = React.createElement, E = this._E, er = this._nlE, nr = this._nlN;
    const cols = raw => raw ? raw.names.map(n => [n, n]) : [];
    const ePanel = this.tlPanel('1 · Ties (edges file)', er ? this.fmtN(er.n) + ' rows' : 'required — one row per tie', h('div', { className: 'tl-row' }, this.tlBtn(er ? 'Load another…' : 'Load ties file…', () => this._nlIne && this._nlIne.click(), er ? '' : 'green'), this.tlBtn('Use current dataset', () => this.nlUseCurrent('e'))),
      !er ? h('p', { className: 'tl-hint' }, 'A CSV, Excel or Stata file with one row per tie: who sends it and who receives it (NodeXL, Gephi and UCINET edge lists work as they are). Optional columns: tie strength, kind of tie, date.') : h(React.Fragment, null,
        B && B.info && E.nlGuess(er, null).nodexl ? this.tlBanner('info', h('b', null, 'NodeXL export recognised. '), 'Columns were matched for you — change anything below.') : null,
        h('div', { className: 'tl-row wide' }, this.tlField('Who sends the tie', this.tlSelect(o.from, cols(er), v => this.nlSet({ from: v }), 'Who sends the tie')), this.tlField('Who receives it', this.tlSelect(o.to, cols(er), v => this.nlSet({ to: v }), 'Who receives it')), this.tlField('Tie strength', this.tlSelect(o.weight, [['', 'none (count each row)']].concat(cols(er)), v => this.nlSet({ weight: v }), 'Tie strength'))),
        h('div', { className: 'tl-row wide' }, this.tlField('Kind of tie', this.tlSelect(o.type, [['', 'none']].concat(cols(er)), v => this.nlSet({ type: v, keep: {}, twoWay: {} }), 'Kind of tie')), this.tlField('Date', this.tlSelect(o.date, [['', 'none']].concat(cols(er)), v => this.nlSet({ date: v, y0: '', y1: '' }), 'Date'))),
        this.tlField('Direction', this.tlSeg([[true, 'Directed — who → whom'], [false, 'Undirected — a tie is a tie']], o.directed !== false, v => this.nlSet({ directed: v }))),
        B && B.info && Object.keys(B.info.types).length ? this.tlField('Which ties to keep', h('div', { className: 'tl-row' }, Object.entries(B.info.types).map(([t, c]) => this.tlChip((o.keep[t] === false ? '' : '✓ ') + t + ' · ' + this.fmtN(c), o.keep[t] !== false, () => this.nlSet({ keep: Object.assign({}, o.keep, { [t]: o.keep[t] === false }) }), { key: t }))),
          o.directed !== false ? h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'Two-way kinds (recorded once, mean both ways):'), Object.keys(B.info.types).map(t => this.tlChip((o.twoWay[t] ? '⇄ ' : '') + t, !!o.twoWay[t], () => this.nlSet({ twoWay: Object.assign({}, o.twoWay, { [t]: !o.twoWay[t] }) }), { key: 'tw' + t, title: B.info.typeRecip[t] >= 0.95 ? 'This kind is already recorded in both directions in your file' : undefined }))) : null) : null,
        h('div', { className: 'tl-row wide' }, B && B.info && B.info.wMax > 1 ? this.tlField('Only ties with strength ≥', this.tlNum(+o.minW || 1, v => this.nlSet({ minW: v }), { min: 1, max: B.info.wMax, aria: 'Minimum tie strength' })) : null,
          B && B.info && Object.keys(B.info.years).length ? this.tlField('Years', h('div', { className: 'tl-row' }, this.tlSelect(o.y0, [['', 'from the start']].concat(Object.keys(B.info.years).map(y => [y, y])), v => this.nlSet({ y0: v }), 'First year'), h('span', { className: 'tl-hint' }, 'to'), this.tlSelect(o.y1, [['', 'the end']].concat(Object.keys(B.info.years).map(y => [y, y])), v => this.nlSet({ y1: v }), 'Last year'))) : null)));
    let attrs = null, check = null;
    if (nr) {
      const roles = E.nlColumnRoles(nr, 'n'), use = roles.filter(r => r.role === 'cat' || r.role === 'num'), hidden = roles.filter(r => !(r.role === 'cat' || r.role === 'num') && r.name !== o.id && r.name !== o.label), sel = new Set(o.attrs || use.map(r => r.name));
      attrs = this.tlField('Characteristics to use (picked for you)', h('div', { className: 'tl-row' }, use.filter(r => r.name !== o.id && r.name !== o.label).map(r => this.tlChip((sel.has(r.name) ? '✓ ' : '') + r.name + ' · ' + (r.role === 'num' ? 'number' : r.levels + ' groups') + (r.missing ? ' · ' + r.missing + ' missing' : ''), sel.has(r.name), () => { const s2 = new Set(sel); if (s2.has(r.name)) s2.delete(r.name); else s2.add(r.name); this.nlSet({ attrs: [...s2] }); }, { key: r.name }))),
        hidden.length ? h('details', { className: 'tl-details' }, h('summary', null, hidden.length + ' other columns hidden (IDs, names, text, NodeXL display or metric columns)'), h('div', { className: 'tl-row' }, hidden.map(r => this.tlChip('+ ' + r.name + ' · ' + r.role, false, () => this.nlSet({ attrs: [...sel, r.name] }), { key: r.name })))) : null);
      // cross-check with NodeXL's own metrics already in the people file
      const ni = nr.names.indexOf('In-Degree');
      if (B && B.net && ni >= 0 && B.net.rowOf) { let m = 0, tot = 0; for (let i = 0; i < B.net.n; i++) { const r = B.net.rowOf[i]; if (r < 0) continue; const raw0 = nr.cols[ni].a[r]; if (raw0 == null || String(raw0).trim() === '') continue; const v = Number(raw0); if (!isFinite(v)) continue; tot++; if (v === B.net.inn[i].size + B.net.selfTies[i] || v === B.net.inn[i].size) m++; }
        if (tot) check = this.tlBanner(m >= 0.9 * tot ? 'ok' : 'warn', h('b', null, (m >= 0.9 * tot ? '✓ Checked against NodeXL’s own columns. ' : 'Different from NodeXL’s columns. ')), 'In-degree matches for ' + m + ' of ' + tot + ' people (NodeXL also counts each person’s own tweets as a tie to themselves). NodeXL’s betweenness ignores direction — choose “Undirected” to reproduce it.'); }
    }
    const nPanel = this.tlPanel('2 · People (nodes file)', nr ? this.fmtN(nr.n) + ' rows · optional' : 'optional — characteristics such as party, gender, age', h('div', { className: 'tl-row' }, this.tlBtn(nr ? 'Load another…' : 'Load people file…', () => this._nlInn && this._nlInn.click()), this.tlBtn('Use current dataset', () => this.nlUseCurrent('n')), nr ? this.tlBtn('Remove', () => this.nlClearNodes()) : null),
      !nr ? h('p', { className: 'tl-hint' }, 'One row per person (or organisation) with an ID that matches the ties file, plus their characteristics. People without any tie are kept (isolates).') : h(React.Fragment, null,
        h('div', { className: 'tl-row wide' }, this.tlField('Person ID (matches the ties)', this.tlSelect(o.id, cols(nr), v => this.nlSet({ id: v }), 'Person ID')), this.tlField('Label people with', this.tlSelect(o.label, cols(nr), v => this.nlSet({ label: v }), 'Label people with')), this.tlField('Shorten labels', this.tlChip('drop “Rep.”, “Senator”, “Office of”…', !!o.short, () => this.nlSet({ short: !o.short })))),
        B && B.net ? h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'ID'), h('th', null, 'label'))), h('tbody', null, B.net.ids.slice(0, 4).map((id, i) => h('tr', { key: id }, h('td', { className: 'w' }, id), h('td', null, B.net.labels[i]))))) : null,
        attrs, check));
    const err = B && B.error ? this.tlBanner('warn', B.error) : null;
    const info = B && B.info ? h('div', { className: 'tl-stats' }, this.tlStat('people', this.fmtN(B.info.nodes), B.info.isolates ? B.info.isolates + ' without ties' : 'all have ties'), this.tlStat('ties', this.fmtN(B.info.ties), B.info.merged ? this.fmtN(B.info.merged) + ' repeated rows merged' : 'after cleaning'), this.tlStat('self-ties', this.fmtN(B.info.self), 'removed'), this.tlStat('unmatched IDs', this.fmtN(B.info.unknown + B.info.missEnd), B.info.unknown ? 'ties whose people are not in the people file' : 'all found')) : null;
    return h(React.Fragment, null, err, h('div', { className: 'nl-two' }, ePanel, nPanel), info, B && B.net ? this.nlNav(o, null, ['overview', 'Overview']) : null);
  }
  // ---- step 2: overview
  nlStepOverview(o, B) {
    const h = React.createElement, net = B.net, E = this._E;
    const S = this.memo('nlsum|' + net.key, () => E.nlSummary(net));
    const cug = this.nlJob(net, 'cug', 'nlCug', [net, 100, 26], 'Comparing with random networks');
    const lv = this.nlJob(net, 'louvain', 'nlLouvain', [net, {}], 'Finding groups');
    const tri = net.directed && net.n <= 3000 ? this.nlJob(net, 'uman', 'nlTriadUman', [net, net.n > 600 ? 10 : 30, 26], 'Comparing triads with chance') : null;
    const f3 = x => isFinite(x) ? this.fmt(x, 3) : '—', pct = x => isFinite(x) ? Math.round(100 * x) + '%' : '—';
    // small shares keep their digits (0.2%, not 0%)
    const pctS = x => !isFinite(x) ? '—' : x > 0 && x < 0.001 ? (100 * x).toFixed(2) + '%' : x > 0 && x < 0.01 ? (100 * x).toFixed(1) + '%' : x > 0.99 && x < 1 ? (Math.floor(1000 * x) / 10).toFixed(1) + '%' : pct(x);
    const C = cug.done && cug.value ? cug.value : null;
    const tiles = h('div', { className: 'tl-stats' },
      this.tlStat('density', f3(S.density), pctS(S.density) + ' of all possible ties exist'),
      S.reciprocity != null ? this.tlStat('reciprocity', f3(S.reciprocity), pct(S.reciprocity) + ' of ties are returned' + (C && C.reciprocity ? ' · random: ' + f3(C.reciprocity.mean) : '')) : this.tlStat('mean degree', this.fmt(S.meanDeg, 1), 'ties per person'),
      this.tlStat('clustering', f3(S.transitivity), C ? 'random networks: ' + f3(C.transitivity.mean) + ' (up to ' + f3(C.transitivity.hi) + ')' : 'friends of friends who are friends'),
      this.tlStat('average distance', this.fmt(S.avgDist, 2) + ' steps', 'longest: ' + S.diameter + (S.reachShare < 0.999 ? ' · ' + pct(1 - S.reachShare) + ' of pairs cannot reach each other' : ' · everyone reachable')),
      this.tlStat('centralization', this.fmt(S.centralization, 2), S.centralization > 0.5 ? 'attention very concentrated' : S.centralization > 0.25 ? 'moderately concentrated' : 'spread out'),
      this.tlStat('separate pieces', this.fmtN(S.components), 'largest: ' + this.fmtN(S.largest) + (S.isolates ? ' · ' + this.fmtN(S.isolates) + ' without ties' : '')),
      this.tlStat('groups', lv.done && lv.value ? String(lv.value.sizes.filter(s => s > 1).length) : '…', lv.done && lv.value ? 'modularity Q = ' + f3(lv.value.Q) : 'finding groups'));
    const words = [];
    words.push(S.density > 0.25 ? 'A dense network: many of the possible ties exist (Kadushin ch. 3). ' : S.density < 0.02 ? 'A sparse network: only a small share of possible ties exist, so it is held together by a few well-connected nodes and bridges. ' : 'A network of moderate density. ');
    if (S.reciprocity != null) words.push(Math.round(100 * S.reciprocity) + '% of ties are returned' + (C && C.reciprocity ? (S.reciprocity > C.reciprocity.hi ? ', far more than in random networks of the same size' : '') : '') + '. ');
    if (C) words.push(S.transitivity > C.transitivity.hi ? '“Friends of friends” are tied more often than chance would produce (clustering ' + f3(S.transitivity) + ' vs ' + f3(C.transitivity.mean) + '). ' : 'Clustering is close to what random networks show. ');
    if (S.components > 1 || S.isolates) words.push('The network has ' + S.components + ' separate piece' + (S.components === 1 ? '' : 's') + (S.isolates ? ' and ' + S.isolates + ' nodes without ties' : '') + '; distances are measured within pieces. ');
    const tot = Object.values(S.distHist).reduce((a, b) => a + b, 0) || 1, dmax = Math.max(...Object.keys(S.distHist).map(Number), 0);
    const dist = this.tlPanel('How many steps apart?', 'share of reachable pairs' + (S.sampledDistances ? ' (sample)' : ''), null, ...Array.from({ length: Math.min(dmax, 12) }, (_, i) => i + 1).map(k => h('div', { key: k, className: 'nl-hb' }, h('span', null, k + (k === 1 ? ' step' : ' steps')), h('span', { className: 'trk' }, h('i', { style: { width: (100 * (S.distHist[k] || 0) / tot).toFixed(1) + '%' } })), h('span', { className: 'n' }, Math.round(100 * (S.distHist[k] || 0) / tot) + '%'))),
      net.directed ? (() => { const none = net.n * (net.n - 1) / 2 - S.mutualDyads - S.asymDyads, all = Math.max(1, net.n * (net.n - 1) / 2), seg = (v, bg, fg, lab) => h('i', { title: lab + ': ' + this.fmtN(v) + ' (' + pctS(v / all) + ')', style: { flex: Math.max(v, 0.001), minWidth: v ? '6px' : 0, background: bg, color: fg } }, lab + ' ' + this.fmtN(v)), key = (bg, lab, v) => h('span', null, h('i', { style: { background: bg } }), lab + ' ' + this.fmtN(v) + ' (' + pctS(v / all) + ')');
        return h('div', null, h('span', { className: 'tl-lbl' }, 'Pairs (dyad census)'), h('div', { className: 'nl-dy' }, seg(S.mutualDyads, '#2E7D58', '#fff', 'mutual'), seg(S.asymDyads, '#F5C778', '#5a4210', 'one-way'), seg(none, '#E3DCCE', '#433D31', 'none')),
          h('div', { className: 'nl-dyk' }, key('#2E7D58', 'mutual', S.mutualDyads), key('#F5C778', 'one-way', S.asymDyads), key('#E3DCCE', 'no tie', none))); })() : null,
      this.nlHist(net.directed ? S.inDeg : S.deg, net.directed ? 'Ties received (in-degree)' : 'Ties per node (degree)'));
    let triP = null;
    if (S.triads) {
      const TN = { '003': 'nobody connected', '012': 'one one-way tie', '102': 'one mutual pair', '021D': 'one sends to two', '021U': 'two send to one', '021C': 'chain A→B→C', '111D': 'mutual pair + tie in', '111U': 'mutual pair + tie out', '030T': 'closed, transitive', '030C': 'cycle', '201': 'two mutual pairs, open', '120D': 'closed: one sends to a mutual pair', '120U': 'closed: a mutual pair sends to one', '120C': 'closed chain + mutual', '210': 'almost all mutual', '300': 'all three mutual' };
      const ex = tri && tri.done && tri.value ? tri.value : null, mx = Math.max(...S.triads, ...(ex || [0]));
      triP = this.tlPanel('Triads vs chance', 'the “periodic table” of networks (Kadushin ch. 2) — bar = seen, | = expected if only reciprocity mattered', null,
        h('div', { className: 'nl-tri', style: { '--nw': (Math.max(...S.triads.map(v => this.fmtN(v).length), ...(ex || []).map(v => this.fmtN(Math.round(v)).length), 4) * 6.6 + 6).toFixed(0) + 'px' } }, E.NL_TRIADS.map((t, k) => h('div', { key: t, className: 'nl-trow' }, h('span', { className: 'tc' }, t), h('span', { className: 'tb' }, h('i', { style: { width: (100 * S.triads[k] / mx).toFixed(1) + '%' } }), ex ? h('u', { style: { left: (100 * ex[k] / mx).toFixed(1) + '%' } }) : null), h('span', { className: 'tn' }, this.fmtN(S.triads[k])), h('span', { className: 'tn m' }, ex ? this.fmtN(Math.round(ex[k])) : '…'), h('span', { className: 'td' }, TN[t])))),
        ex ? h('span', { className: 'tl-hint' }, (() => { const r = E.NL_TRIADS.map((t, k) => [t, ex[k] ? S.triads[k] / ex[k] : NaN]).filter(x => isFinite(x[1]) && S.triads[E.NL_TRIADS.indexOf(x[0])] > 5).sort((a, b) => b[1] - a[1]); return r.length ? 'Most over-represented: ' + r.slice(0, 2).map(([t, v]) => t + ' (' + this.fmt(v, 1) + '× chance)').join(', ') + '. Most under-represented: ' + r.slice(-2).map(([t, v]) => t + ' (' + this.fmt(v, 2) + '×)').join(', ') + '.' : ''; })()) : this.tlPending('Simulating', tri && tri.p));
    }
    return h(React.Fragment, null, tiles, this.nlWhat(words.join('')), h('div', { className: 'nl-two' }, dist, triP), this.nlNav(o, ['data', 'Data'], ['map', 'Map']));
  }
  nlHist(vals, label) {
    const h = React.createElement, mx = Math.max(0, ...vals), bw = Math.max(1, Math.ceil((mx + 1) / 14)), bins = Array.from({ length: Math.floor(mx / bw) + 1 }, () => 0);
    for (const v of vals) bins[Math.floor(v / bw)]++; const top = Math.max(1, ...bins);
    return h('div', null, h('span', { className: 'tl-lbl' }, label), h('div', { className: 'nl-hist' }, bins.map((c, i) => h('div', { key: i, title: c + ' with ' + (bw === 1 ? i * bw : i * bw + '–' + (i * bw + bw - 1)) }, h('i', { style: { height: Math.round(80 * c / top) + 'px' } }), h('span', null, bw === 1 ? i : i * bw)))));
  }
