  // ---- step 3: explore
  tlStepExplore(ctx) {
    const h = React.createElement, T = ctx.T;
    const subs = [['words', 'Words'], ['phrases', 'Phrases'], ['compare', 'Compare groups'], ['context', 'In context'], ['time', 'Over time'], ['connections', 'Connections'], ['clusters', 'Clusters'], ['stats', 'Text stats']];
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist' }, subs.map(([k, l]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': T.sub === k ? 'true' : 'false', className: T.sub === k ? 'on' : '', onClick: () => this.tlSet({ sub: k }) }, l)));
    const body = T.sub === 'phrases' ? this.tlPhrases(ctx) : T.sub === 'compare' ? this.tlCompare(ctx) : T.sub === 'context' ? this.tlContext(ctx) : T.sub === 'time' ? this.tlTime(ctx) : T.sub === 'connections' ? this.tlNetwork(ctx) : T.sub === 'clusters' ? this.tlClusters(ctx) : T.sub === 'stats' ? this.tlStatsView(ctx) : this.tlWords(ctx);
    return h('div', { className: 'tl-col' }, tabs, body, this.tlNav(['clean', 'Clean'], ['measure', 'Next: Measure']));
  }
  tlAddStop(w) { const T = this.tlS(), ex = T.rec.extra || []; if (!ex.includes(w)) { this.tlSetIn('rec', { extra: ex.concat([w]) }); this.flash('“' + w + '” added to your stopwords — every result updated'); } }
  tlKindOk(k, view) { return view === 'tag' ? k === 2 || k === 3 : view === 'phrase' ? k === 7 : view === 'all' ? true : k === 1 || k === 5; }
  tlTop(ctx, view, n, counts) {
    const { FT } = ctx, cnt = counts || ctx.cnt, out = [];
    for (const f of cnt.order) { if (!this.tlKindOk(FT.kind[f], view)) continue; out.push({ f, label: FT.label[f], count: cnt.count[f], docs: cnt.docf[f] }); if (out.length >= n) break; }
    return out;
  }

  // words: table + cloud / bars
  tlWords(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, CL = T.cloud;
    const view = T.wview, rows = this.tlTop(ctx, view, Math.max(200, T.wn), cnt);
    const views = [['word', 'Words'], ['tag', '#Tags & @names'], ['phrase', 'Phrases'], ['all', 'Everything']];
    const table = this.tlPanel('Word counts', 'click a word to see it in context', h('span', null, this.tlBtn(this.state.copied === 'tlw' ? 'Copied ✓' : 'Copy table', () => this.copyTSV('tlw', 'word\tcount\ttexts\tpct_texts\n' + rows.map(r => [r.label, r.count, r.docs, (100 * r.docs / Math.max(1, cnt.docs)).toFixed(2)].join('\t')).join('\n')))),
      this.tlSeg(views, view, v => this.tlSet({ wview: v })),
      h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' },
        h('thead', null, h('tr', null, h('th', { className: 'n' }, '#'), h('th', null, 'Word'), h('th', { className: 'n' }, 'Count'), h('th', { className: 'n' }, 'Texts'), h('th', { className: 'n' }, '% texts'), h('th', null, h('span', { className: 'tl-sr' }, 'Leave out')))),
        h('tbody', null, rows.slice(0, T.wn).map((r, i) => h('tr', { key: r.f },
          h('td', { className: 'n' }, i + 1),
          h('td', { className: 'w' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.tlSet({ q: FT.R.forms === 'none' ? (FT.kind[r.f] === 7 ? '"' + r.label + '"' : r.label) : r.label + '*', step: 'explore', sub: 'context', qOff: [] }), title: FT.nforms[r.f] > 1 ? FT.nforms[r.f] + ' written forms' : undefined }, r.label), FT.nforms[r.f] > 1 ? h('span', { className: 'tl-forms-n' }, ' +' + (FT.nforms[r.f] - 1)) : null),
          h('td', { className: 'n' }, this.fmtN(r.count)), h('td', { className: 'n' }, this.fmtN(r.docs)), h('td', { className: 'n' }, this.tlPct(r.docs / Math.max(1, cnt.docs))),
          h('td', { className: 'x' }, h('button', { type: 'button', className: 'tl-x', title: 'Leave “' + r.label + '” out (add to your stopwords)', 'aria-label': 'Leave out ' + r.label, onClick: () => this.tlAddStop(FT.kind[r.f] === 7 ? r.label : r.label) }, '×'))))))),
      h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'Show'), this.tlSeg([[25, '25'], [50, '50'], [100, '100'], [200, '200']], T.wn, v => this.tlSet({ wn: v }))));
    const chart = this.tlCloudPanel(ctx);
    return h('div', { className: 'tl-grid c-r' }, table, chart);
  }
  // colour bands: defaults rounded from the data; "min" is the lower edge of each band
  tlAutoBands(vals) {
    const s = vals.slice().sort((a, b) => b - a); if (!s.length) return [{ min: 0, color: '#2E7D58' }];
    const nice = x => { if (x <= 0) return 0; const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
    const q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
    const c = ['#194F39', '#2E7D58', '#C4681E', '#9C8F78'];
    const mins = Array.from(new Set([nice(q(0.06)), nice(q(0.25)), nice(q(0.6))])).filter(x => x > 0).sort((a, b) => b - a);
    return mins.map((m, i) => ({ min: m, color: c[i] })).concat([{ min: 0, color: c[3] }]);
  }
  tlCloudPanel(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, CL = T.cloud, set = p => this.tlSetIn('cloud', p);
    const split = CL.split, G = split ? this.tlGroupsOf(T, C, split) : null;
    const view = T.wview === 'all' ? 'word' : T.wview;
    // value used for colour bands
    const basisVal = (w, cn) => CL.basis === 'pct' ? 100 * w.docs / Math.max(1, cn.docs) : CL.basis === 'rank' ? w.rank : w.count;
    const allWords = this.tlTop(ctx, view, CL.max, cnt).map((w, i) => Object.assign(w, { rank: i + 1 }));
    const bands = CL.bands || this.tlAutoBands(allWords.map(w => basisVal(w, cnt)));
    const colorOf = (w, cn, gi) => {
      if (CL.colorBy === 'one') return CL.one;
      if (CL.colorBy === 'group' && gi != null) return this.tlPal(gi);
      if (CL.colorBy === 'category') { const cat = this.tlWordCats(ctx)[w.f]; return cat != null ? this.tlPal(cat) : '#B5AA96'; }
      const v = basisVal(w, cn); if (CL.basis === 'rank') { const sorted = bands.slice().sort((a, b) => a.min - b.min); for (const b of sorted) if (v <= (b.min || Infinity)) return b.color; return sorted[sorted.length - 1].color; }
      for (const b of bands) if (v >= b.min) return b.color; return bands[bands.length - 1].color;
    };
    const opts = { shape: CL.shape, rotate: CL.rotate, seed: CL.seed, font: CL.font };
    let figs = [], title = 'Word cloud';
    if (!G || CL.view === 'all') {
      const words = allWords.map(w => ({ text: w.label, value: w.count, color: colorOf(w, cnt) }));
      figs.push(this.tlCloudFig('tlcloud', words, 760, 440, opts, 'All ' + this.fmtN(cnt.docs) + ' texts · top ' + words.length + ' ' + (view === 'tag' ? 'tags' : view === 'phrase' ? 'phrases' : 'words')));
    } else if (CL.view === 'compare') {
      const groups = this.tlPickGroups(G, CL);
      const gc = this._E.tlGroupCounts(FT, G.g, G.labels.length, ctx.mask);
      const items = this.tlCompareWords(ctx, gc, groups, CL.max, view);
      figs.push(this.tlCloudFig('tlcloudcmp', items.map(it => ({ text: it.label, value: it.dev, color: this.tlPal(groups.indexOf(it.g)), sector: groups.indexOf(it.g), nSect: groups.length })), 760, 460, Object.assign({}, opts, { sectors: groups.length }), 'Comparison cloud of ' + split + ' · size = how much more often the group uses the word', groups.map((g, i) => [G.labels[g], this.tlPal(i)])));
      title = 'Comparison cloud';
    } else {
      const groups = this.tlPickGroups(G, CL), gc = this._E.tlGroupCounts(FT, G.g, G.labels.length, ctx.mask);
      const per = groups.map(g => { const a = gc.counts[g], docs = new Int32Array(FT.nF); const order = FT.order.filter(f => a[f] > 0 && this.tlKindOk(FT.kind[f], view)).sort((x, y) => a[y] - a[x]).slice(0, CL.max); return { g, words: order.map((f, i) => ({ f, label: FT.label[f], count: a[f], docs: 0, rank: i + 1 })) }; });
      const gmax = Math.max(1, ...per.map(p => p.words[0] ? p.words[0].count : 1)), gmin = Math.min(...per.map(p => p.words.length ? p.words[p.words.length - 1].count : 1));
      per.forEach((p, i) => {
        const docsG = gc.docs[p.g];
        if (!p.words.length) return;
        figs.push(this.tlCloudFig('tlcloudg' + i, p.words.map(w => ({ text: w.label, value: w.count, color: CL.colorBy === 'group' ? this.tlPal(i) : colorOf(Object.assign({}, w, { docs: w.count }), { docs: docsG }, i) })), 560, 360, Object.assign({}, opts, CL.same ? { vmax: gmax, vmin: gmin } : {}), G.labels[p.g] + ' · ' + this.fmtN(docsG) + ' texts' + (p.words.length < 10 ? ' · only ' + p.words.length + ' different words' : ''), null, true));
      });
      title = 'Word clouds by ' + split;
    }
    const groupOpts = [['', 'none — whole dataset']].concat(this.tlGroupCols(T.v).map(n => [n, n]));
    const bandRows = (CL.colorBy === 'bands') ? h('div', { className: 'tl-bands' },
      h('span', { className: 'tl-lbl' }, 'Colour rules · ' + (CL.basis === 'rank' ? 'rank up to' : CL.basis === 'pct' ? '% of texts at least' : 'used at least')),
      ...bands.map((b, i) => h('div', { key: i, className: 'tl-band' },
        h('input', { type: 'color', value: b.color, 'aria-label': 'Band colour', onChange: e => { const nb = bands.map((x, j) => j === i ? Object.assign({}, x, { color: e.target.value }) : x); set({ bands: nb }); } }),
        i === bands.length - 1 && CL.basis !== 'rank' ? h('span', { className: 'tl-hint' }, 'everything else') : this.tlNum(b.min, v => { const nb = bands.map((x, j) => j === i ? Object.assign({}, x, { min: v }) : x).sort((a, c) => CL.basis === 'rank' ? a.min - c.min : c.min - a.min); set({ bands: nb }); }, { min: 0, step: CL.basis === 'pct' ? 0.1 : 1, width: 78, aria: 'Band threshold' }),
        h('span', { className: 'tl-cnt' }, allWords.filter(w => colorOf(w, cnt) === b.color).length + ' words'),
        bands.length > 2 ? h('button', { type: 'button', className: 'tl-x', 'aria-label': 'Remove band', onClick: () => set({ bands: bands.filter((_, j) => j !== i) }) }, '×') : null)),
      h('div', { className: 'tl-row' }, this.tlBtn('+ Add band', () => { const sorted = bands.slice(); sorted.splice(Math.max(0, sorted.length - 1), 0, { min: Math.round((sorted[Math.max(0, sorted.length - 2)].min || 10) / 2), color: '#357F93' }); set({ bands: sorted }); }), this.tlBtn('Reset', () => set({ bands: null }))),
      this.tlField('Bands are based on', this.tlSeg([['count', 'Times used'], ['pct', '% of texts'], ['rank', 'Rank']], CL.basis, v => set({ basis: v, bands: null })))) : null;
    const controls = h('div', { className: 'tl-ctl' },
      h('div', { className: 'tl-row' }, this.tlField('Split by', this.tlSelect(split, groupOpts, v => set({ split: v, view: v ? (CL.view === 'all' ? 'each' : CL.view) : 'each' }), 'Split word cloud by')),
        split ? this.tlField('Show', this.tlSeg([['each', 'One cloud per group'], ['compare', 'One comparison cloud'], ['all', 'Whole dataset']], CL.view, v => set({ view: v }))) : null),
      split && G ? h('div', { className: 'tl-row' }, this.tlField('Groups', h('div', { className: 'tl-row' }, this.tlNum(CL.gN, v => set({ gN: v, gPick: [] }), { min: 1, max: 24, aria: 'Number of groups', width: 56 }), h('span', { className: 'tl-hint' }, 'largest of ' + G.labels.length), G.labels.length > 1 ? this.tlSelect('', [['', 'or pick…']].concat(G.labels.map((l, i) => [String(i), l + ' (' + G.count[i] + ')'])), v => { if (v === '') return; const cur = (CL.gPick || []).map(Number); const k = Number(v); set({ gPick: cur.includes(k) ? cur.filter(x => x !== k) : cur.concat([k]) }); }, 'Pick groups') : null, (CL.gPick || []).length ? this.tlBtn('Clear picks', () => set({ gPick: [] })) : null)), CL.view === 'each' ? this.tlChip('Same size scale', CL.same, () => set({ same: !CL.same })) : null) : null,
      this.tlField('Colour by', this.tlSeg([['bands', 'Frequency bands'], ['group', 'Group'], ['category', 'Dictionary category'], ['one', 'One colour']], CL.colorBy, v => set({ colorBy: v }))),
      CL.colorBy === 'one' ? h('input', { type: 'color', value: CL.one, 'aria-label': 'Cloud colour', onChange: e => set({ one: e.target.value }) }) : null,
      bandRows,
      h('div', { className: 'tl-row' }, this.tlField('Words', this.tlNum(CL.max, v => set({ max: v }), { min: 5, max: 300, aria: 'Maximum words', width: 64 })), this.tlField('Shape', this.tlSelect(CL.shape, [['ellipse', 'Ellipse'], ['circle', 'Circle'], ['square', 'Rectangle'], ['diamond', 'Diamond'], ['star', 'Star'], ['triangle', 'Triangle']], v => set({ shape: v }), 'Cloud shape')), this.tlField('Rotate', this.tlSelect(String(CL.rotate), [['0', 'None'], ['0.2', '20% of words'], ['0.5', 'Half']], v => set({ rotate: Number(v) }), 'Rotation')), this.tlField('Font', this.tlSelect(CL.font, [['Hanken Grotesk', 'Hanken Grotesk'], ['Bricolage Grotesque', 'Bricolage'], ['Space Mono', 'Space Mono'], ['Georgia', 'Georgia (serif)']], v => set({ font: v }), 'Font')), this.tlField('Layout', this.tlBtn('Shuffle', () => set({ seed: (CL.seed * 7 + 13) % 99991 })))));
    const chartToggle = this.tlSeg([['cloud', 'Cloud'], ['bars', 'Bar chart']], T.wchart, v => this.tlSet({ wchart: v }));
    if (T.wchart === 'bars') {
      const top = this.tlTop(ctx, view, 20, cnt);
      return this.tlPanel('Most frequent ' + (view === 'tag' ? 'tags' : view === 'phrase' ? 'phrases' : 'words'), null, chartToggle, this.tlBarsSvg('tlbars', top.map(w => ({ label: w.label, value: w.count, color: colorOf(Object.assign({}, w, { rank: 0 }), cnt) })), { title: 'Top 20 by count · ' + this.fmtN(cnt.docs) + ' texts', xlab: 'times used' }), this.tlExportRow('tlbars', 'word-frequencies'));
    }
    return this.tlPanel(title, figs.length > 1 ? figs.length + ' clouds' : 'bigger = more frequent', chartToggle, h('div', { className: figs.length > 1 ? 'tl-cloudgrid' : 'tl-col' }, ...figs), controls);
  }
  tlPal(i) { return ['#2E7D58', '#A3540F', '#357F93', '#8C6D1F', '#7A5A9E', '#C4681E', '#1A5061', '#9C4A08', '#5D7D2E', '#B0476B', '#4F6D8C', '#6B6455'][i % 12]; }
  tlPickGroups(G, CL) { const pick = (CL.gPick || []).map(Number).filter(k => k < G.labels.length); if (pick.length) return pick; return G.labels.map((l, i) => i).sort((a, b) => G.count[b] - G.count[a]).slice(0, CL.gN); }
  tlCompareWords(ctx, gc, groups, max, view) {
    const { FT } = ctx, rel = groups.map(g => { const t = gc.tot[g] || 1; return f => gc.counts[g][f] / t; });
    const cand = FT.order.filter(f => this.tlKindOk(FT.kind[f], view)).slice(0, 3000), out = [];
    for (const f of cand) { const ps = rel.map(r => r(f)), mean = ps.reduce((a, b) => a + b, 0) / ps.length; let b = 0; for (let i = 1; i < ps.length; i++) if (ps[i] > ps[b]) b = i; const dev = ps[b] - mean; if (dev > 0) out.push({ f, label: FT.label[f], g: groups[b], dev }); }
    return out.sort((a, b) => b.dev - a.dev).slice(0, max);
  }
  tlCloudFig(key, words, W, H, opts, caption, legend, small) {
    const h = React.createElement, lay = this.tlCloudLayout(words, W, H, opts);
    const fam = opts.font === 'Georgia' ? 'Georgia, serif' : "'" + opts.font + "', sans-serif", wt = opts.font === 'Space Mono' ? 700 : opts.font === 'Bricolage Grotesque' ? 700 : 600;
    const svg = h('svg', { viewBox: '0 0 ' + W + ' ' + (H + 22 + (legend ? 20 : 0)), width: '100%', role: 'img', 'aria-label': caption, ref: this.svgRef(key), className: 'tl-svg' },
      h('rect', { x: 0, y: 0, width: W, height: H + 22 + (legend ? 20 : 0), fill: '#FFFFFF' }),
      lay.placed.map((p, i) => h('text', { key: i, x: p.x.toFixed(1), y: p.y.toFixed(1), fontSize: p.size.toFixed(1), fontFamily: fam, fontWeight: wt, fill: p.color, transform: p.rot ? 'rotate(-90 ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')' : undefined }, p.text)),
      legend ? h('g', null, legend.map(([l, c], i) => h('g', { key: i }, h('rect', { x: 8 + i * 170, y: H + 4, width: 10, height: 10, rx: 2, fill: c }), h('text', { x: 22 + i * 170, y: H + 13, fontSize: 11, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#3D3629' }, String(l).slice(0, 24))))) : null,
      h('text', { x: 6, y: H + (legend ? 34 : 15), fontSize: 9.5, fontFamily: "'Space Mono', monospace", fill: '#8A8070' }, caption + (lay.dropped ? ' · ' + lay.dropped + ' words did not fit' : '')));
    this._plotName = this._plotName || {}; this._plotName[key] = 'wordcloud';
    return h('figure', { key, className: 'tl-fig' + (small ? ' small' : '') }, svg, this.tlExportRow(key, key === 'tlcloud' ? 'wordcloud' : 'wordcloud-' + key.replace('tlcloud', '')));
  }

  // phrases: textstat_collocations
  tlPhrases(ctx) {
    const h = React.createElement, { T, C } = ctx, P = T.coll, langs = this.tlLangs(T, C);
    const min = P.min || Math.max(5, Math.round(C.docs / 2000));
    const key = 'tlCol|' + C.key + '|' + P.size + '|' + min + '|' + langs.join(',') + '|' + T.rec.fold;
    const J = this.tlJob(key, 'tlCollocations', () => [this.tlSlim(C), { size: P.size, minCount: min, langs, fold: !!T.rec.fold, stopSource: T.rec.stopSource }], 'Scoring phrases');
    const phrases = (T.rec.phrases || []).map(p => Array.isArray(p) ? p.join(' ') : p);
    const ctl = h('div', { className: 'tl-row wide' }, this.tlField('Length', this.tlSeg([[2, '2 words'], [3, '3 words']], P.size, v => this.tlSetIn('coll', { size: v }))), this.tlField('Seen at least', h('div', { className: 'tl-row' }, this.tlNum(min, v => this.tlSetIn('coll', { min: v }), { min: 2, aria: 'Minimum count' }), h('span', { className: 'tl-hint' }, 'times'))));
    if (!J.done) return this.tlPanel('Phrases', 'words that appear together more than chance', null, ctl, this.tlPending(J.label, J.p));
    const rows = (J.value || []).slice(0, 60);
    return this.tlPanel('Phrases', 'words that appear together more than chance (textstat_collocations)', null, ctl,
      this.tlBanner('info', 'λ measures how strongly the words stick together; z is λ divided by its standard error (z above 3.3 ≈ p < .001). Phrases start and end with a content word. ', h('b', null, 'Join'), ' makes a phrase count as one word everywhere.'),
      h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Phrase'), h('th', { className: 'n' }, 'Count'), h('th', { className: 'n' }, 'λ'), h('th', { className: 'n' }, 'z'), h('th', null, ''))),
        h('tbody', null, rows.map(r => { const p = r.words.join(' '), on = phrases.includes(p); return h('tr', { key: p }, h('td', { className: 'w' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.tlSet({ q: '"' + p + '"', sub: 'context', qOff: [] }) }, p)), h('td', { className: 'n' }, this.fmtN(r.count)), h('td', { className: 'n' }, r.lambda.toFixed(2)), h('td', { className: 'n' }, r.z.toFixed(1)), h('td', null, this.tlChip(on ? '✓ joined' : 'Join', on, () => this.tlSetIn('rec', { phrases: on ? phrases.filter(x => x !== p) : phrases.concat([p]) })))); })))),
      this.tlRcode('toks <- tokens(corp, remove_punct = TRUE, remove_url = TRUE) |> tokens_tolower()\ntextstat_collocations(toks, size = ' + P.size + ', min_count = ' + min + ')'));
  }
  tlSlim(C) { return { n: C.n, docs: C.docs, types: C.types, kind: C.kind, tok: C.tok, brk: C.brk, off: C.off, blank: C.blank }; }

  // compare groups: textstat_keyness
  tlCompare(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, K = T.key, set = p => this.tlSetIn('key', p);
    const by = T.by, grpOpts = [['', 'pick a group column']].concat(this.tlGroupCols(T.v).map(n => [n, n]));
    const head = this.tlField('Compare groups in', this.tlSelect(by, grpOpts, v => { this._tlByTouched = true; this.tlSet({ by: v, key: Object.assign({}, K, { target: '', ref: '__rest' }) }); }, 'Group column'));
    if (!by) return this.tlPanel('Compare groups', 'which words set one group apart (keyness)', null, head, this.tlBanner('info', 'Pick a column such as author, party or year.'));
    const G = this.tlGroupsOf(T, C, by); if (!G || G.labels.length < 2) return this.tlPanel('Compare groups', null, null, head, this.tlBanner('warn', 'This column needs at least two groups.'));
    const order = G.labels.map((l, i) => i).sort((a, b) => G.count[b] - G.count[a]);
    const tgt = K.target !== '' && G.labels.includes(K.target) ? G.labels.indexOf(K.target) : order[0];
    const ref = K.ref === '__rest' ? -1 : G.labels.includes(K.ref) ? G.labels.indexOf(K.ref) : (order[1] ?? -1);
    const gc = this.memo('tlGC|' + FT.sig + '|' + by + '|' + T.mergeCase, () => this._E.tlGroupCounts(FT, G.g, G.labels.length, ctx.mask));
    const tc = gc.counts[tgt], rc = ref >= 0 ? gc.counts[ref] : (() => { const r = new Float64Array(FT.nF); for (let g = 0; g < G.labels.length; g++) if (g !== tgt) { const a = gc.counts[g]; for (let f = 0; f < FT.nF; f++) r[f] += a[f]; } return r; })();
    const res = this.memo('tlK|' + FT.sig + '|' + by + '|' + tgt + '|' + ref + '|' + K.measure + '|' + K.min, () => this._E.tlKeyness(tc, rc, { measure: K.measure, minCount: K.min }));
    const n = K.n, top = res.rows.slice(0, n), bot = res.rows.slice(-n).reverse().filter(r => r.stat < 0);
    const tName = G.labels[tgt], rName = ref >= 0 ? G.labels[ref] : 'everyone else';
    const opts = [['__rest', 'everyone else']].concat(order.filter(g => g !== tgt).map(g => [G.labels[g], G.labels[g] + ' (' + G.count[g] + ')']));
    const ctl = h('div', { className: 'tl-row wide' }, head,
      this.tlField('Target', this.tlSelect(tName, order.map(g => [G.labels[g], G.labels[g] + ' (' + G.count[g] + ')']), v => set({ target: v }), 'Target group')),
      this.tlField('Against', this.tlSelect(ref >= 0 ? G.labels[ref] : '__rest', opts, v => set({ ref: v }), 'Reference group')),
      this.tlField('Measure', this.tlSeg([['chi2', 'Chi-square'], ['lr', 'Likelihood ratio'], ['exact', 'Fisher exact'], ['pmi', 'Pointwise mutual information']], K.measure, v => set({ measure: v }))),
      this.tlField('Minimum uses', this.tlNum(K.min, v => set({ min: v }), { min: 1, aria: 'Minimum count' })),
      this.tlField('Words each side', this.tlNum(K.n, v => set({ n: v }), { min: 3, max: 40, aria: 'Words each side' })));
    const svg = this.tlKeynessSvg('tlkey', top, bot, FT, tName, rName, K.measure);
    const rate = (c, t) => t ? (1e4 * c / t).toFixed(1) : '—';
    const tbl = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Word'), h('th', { className: 'n' }, K.measure === 'chi2' ? 'χ²' : K.measure === 'lr' ? 'G²' : K.measure === 'exact' ? 'odds ratio' : 'PMI'), h('th', { className: 'n' }, 'p'), h('th', { className: 'n' }, tName.slice(0, 18) + ' per 10k'), h('th', { className: 'n' }, rName.slice(0, 18) + ' per 10k'))),
      h('tbody', null, top.concat(bot).map(r => h('tr', { key: r.f }, h('td', { className: 'w' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.tlSet({ q: FT.label[r.f], sub: 'context', qOff: [] }) }, FT.label[r.f])), h('td', { className: 'n' }, this.fmt(r.stat, 1)), h('td', { className: 'n' }, isFinite(r.p) ? (r.p < 0.001 ? '<.001' : r.p.toFixed(3)) : '—'), h('td', { className: 'n' }, rate(r.a, res.Tt)), h('td', { className: 'n' }, rate(r.b, res.Tr)))))));
    const words = arr => arr.slice(0, 5).map(r => FT.label[r.f]).join(', ');
    const sig = res.rows.filter(r => isFinite(r.p) && r.p < 0.001);
    const story = this.tlBanner('ok', h('b', null, 'What this means: '), tName + ' uses ' + words(top) + ' much more than ' + rName + '. ' + (bot.length ? rName.charAt(0).toUpperCase() + rName.slice(1) + ' uses ' + words(bot) + ' more. ' : '') + this.fmtN(sig.length) + ' words differ with p < .001 (each used at least ' + K.min + ' times). Read them in context before quoting.');
    return h('div', { className: 'tl-col' }, this.tlPanel('Compare groups', 'which words set one group apart (textstat_keyness)', null, ctl, story, svg, this.tlExportRow('tlkey', 'keyness'), tbl,
      this.tlRcode('dfmat <- dfm(toks)\ntextstat_keyness(dfm_group(dfmat, groups = ' + by + '), target = "' + tName + '", measure = "' + K.measure + '")' + (ref >= 0 ? '\n# against one group only: dfm_subset(dfmat, ' + by + ' %in% c("' + tName + '", "' + rName + '")) first' : '') + '\ntextplot_keyness(key, n = ' + n + ')')));
  }

  // in context: kwic + match list + by group
  tlContext(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E;
    const q = T.q || '';
    const search = h('div', { className: 'tl-row wide' }, this.tlField('Search', this.tlText(q, v => this.tlSet({ q: v, qOff: [] }), { placeholder: 'e.g. corrup*, "guardia nacional", #covid19', aria: 'Search words', width: 300, mono: true, k: 'q' })),
      this.tlField('Words each side', this.tlNum(T.win, v => this.tlSet({ win: v }), { min: 1, max: 30, aria: 'Words of context' })),
      this.tlField('Sort by', this.tlSeg([['row', 'Row'], ['pre', 'Word before'], ['post', 'Word after'], ['group', 'Group']], T.sort, v => this.tlSet({ sort: v }))));
    const help = h('span', { className: 'tl-hint' }, '* any ending · ? one letter · "two words" = phrase · -word = never count · #tag · @name · accents ' + (T.rec.fold ? 'ignored (ñ kept)' : 'respected'));
    if (!q.trim()) return this.tlPanel('In context', 'read every use of a word (kwic)', null, search, help, this.tlBanner('info', 'Type a word, or click any word in a table. Wildcards show every form they match, so you can drop the wrong ones.'));
    const off = new Set(T.qOff || []);
    const comp = this.memo('tlQ|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.rec.fold, () => E.tlCompileDict(C, [{ name: 'q', keys: q, off }], !!T.rec.fold));
    const all = this.memo('tlQall|' + C.key + '|' + q + '|' + T.rec.fold, () => E.tlLookup(C, E.tlCompileDict(C, [{ name: 'q', keys: q }], !!T.rec.fold))[0]);
    const look = this.memo('tlQL|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.rec.fold, () => E.tlLookup(C, comp)[0]);
    const mask = ctx.mask;
    let hits = 0, docs = 0, n = 0; for (let d = 0; d < look.counts.length; d++) { if (mask && !mask[d]) continue; const v = look.counts[d]; if (!isFinite(v)) continue; n++; if (v > 0) { docs++; hits += v; } }
    const forms = [...all.forms.entries()].sort((a, b) => b[1] - a[1]);
    const formRow = h('div', { className: 'tl-forms' }, ...forms.slice(0, 40).map(([w, c]) => { const isOff = off.has(w) || off.has(E.tlFold(w)); return h('label', { key: w, className: 'tl-form' + (isOff ? ' off' : '') }, h('input', { type: 'checkbox', checked: !isOff, onChange: () => this.tlSet({ qOff: isOff ? [...off].filter(x => x !== w && x !== E.tlFold(w)) : [...off, w] }) }), w, h('em', null, ' ' + this.fmtN(c))); }), forms.length > 40 ? h('span', { className: 'tl-hint' }, '+ ' + (forms.length - 40) + ' more') : null);
    const K = this.memo('tlKW|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.win + '|' + T.rec.fold + '|' + (mask ? this.filterSig() : ''), () => E.tlKwic(C, C.texts, comp, { window: T.win, limit: 500, mask }));
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null;
    let rows = K.rows.slice();
    if (T.sort === 'pre') rows.sort((a, b) => (a.pre.split(' ').pop() || '').localeCompare(b.pre.split(' ').pop() || ''));
    else if (T.sort === 'post') rows.sort((a, b) => a.post.localeCompare(b.post));
    else if (T.sort === 'group' && G) rows.sort((a, b) => (G.g[a.doc] - G.g[b.doc]) || a.doc - b.doc);
    const kwic = h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-kwic' }, h('tbody', null, rows.slice(0, 200).map((r, i) => h('tr', { key: i }, h('td', { className: 'meta' }, 'row ' + this.fmtN(this.tlRowOf(C, r.doc) + 1) + (G && G.g[r.doc] >= 0 ? ' · ' + G.labels[G.g[r.doc]] : '')), h('td', { className: 'pre' }, r.pre), h('td', { className: 'kw' }, r.kw), h('td', { className: 'post' }, r.post))))));
    const copy = this.tlBtn(this.state.copied === 'tlk' ? 'Copied ✓' : 'Copy all ' + this.fmtN(K.rows.length) + ' lines', () => this.copyTSV('tlk', 'row\tgroup\tbefore\tkeyword\tafter\n' + K.rows.map(r => [this.tlRowOf(C, r.doc) + 1, G && G.g[r.doc] >= 0 ? G.labels[G.g[r.doc]] : '', r.pre, r.kw, r.post].join('\t')).join('\n')));
    let byG = null;
    if (G) {
      const st = G.labels.map(() => ({ n: 0, hit: 0, times: 0 }));
      for (let d = 0; d < look.counts.length; d++) { const g = G.g[d]; if (g < 0 || (mask && !mask[d])) continue; const v = look.counts[d]; if (!isFinite(v)) continue; st[g].n++; if (v > 0) { st[g].hit++; st[g].times += v; } }
      const ord = st.map((s, i) => i).filter(i => st[i].n).sort((a, b) => st[b].hit / st[b].n - st[a].hit / st[a].n).slice(0, 30);
      byG = this.tlBarsSvg('tlkwg', ord.map(i => ({ label: G.labels[i], value: 100 * st[i].hit / st[i].n, note: this.fmtN(st[i].hit) + ' of ' + this.fmtN(st[i].n), color: this.tlPal(0) })), { title: '% of texts that mention it, by ' + T.by, xlab: '% of texts', pct: true });
    }
    return h('div', { className: 'tl-col' }, this.tlPanel('In context', 'every use of the search, with the words around it (kwic)', null, search, help,
      h('span', { className: 'tl-lbl' }, 'This search matched ' + forms.length + ' different word' + (forms.length === 1 ? '' : 's') + ' · untick any that do not belong'), formRow,
      this.tlBanner('ok', h('b', null, this.fmtN(docs) + ' texts'), ' (' + this.tlPct(docs / Math.max(1, n)) + ') mention it, ' + this.fmtN(hits) + ' times in total.' + (K.rows.length < hits ? ' Showing the first ' + Math.min(200, K.rows.length) + ' lines.' : '')),
      kwic, h('div', { className: 'tl-row' }, copy, this.tlBtn('Use as a dictionary category', () => { const T2 = this.tlS(), d = (T2.dict || []).filter(x => x.keys.trim()); this.tlSet({ dict: d.concat([{ name: q.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || 'category', keys: q, off: [...off] }]), step: 'measure', msub: 'dict' }); }), this.tlBtn('See it over time', () => this.tlSet({ sub: 'time', time: Object.assign({}, T.time, { what: 'search' }) }))),
      this.tlRcode('kwic(toks, pattern = ' + this.tlRvec(E.tlParsePatterns(q).filter(p => !p.neg).map(p => p.parts.join(' '))) + ', window = ' + T.win + ', valuetype = "glob")')),
      byG ? this.tlPanel('By ' + T.by, null, null, byG, this.tlExportRow('tlkwg', 'mentions-by-group')) : null);
  }

  // over time
  tlTime(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, TM = T.time, set = p => this.tlSetIn('time', p);
    const dateOpts = [['', 'pick a date column']].concat((this.state.cols || []).map(c => c.name).filter(n => n !== T.v).map(n => [n, n]));
    const head = this.tlField('Date column', this.tlSelect(T.date, dateOpts, v => { this._tlDateTouched = true; this.tlSet({ date: v }); }, 'Date column'));
    if (!T.date) return this.tlPanel('Over time', null, null, head, this.tlBanner('info', 'Pick the column with dates (or years).'));
    const D = this.tlDates(T, C);
    if (!D || !D.ok) return this.tlPanel('Over time', null, null, head, this.tlBanner('warn', '“' + T.date + '” does not look like dates.'));
    const span = D.max - D.min, unit = TM.unit !== 'auto' ? TM.unit : D.yearOnly || span > 365 * 6 ? 'year' : span > 365 * 2 ? 'quarter' : span > 120 ? 'month' : span > 30 ? 'week' : 'day';
    const cats = (T.dict || []).filter(c => c.keys && c.keys.trim());
    const whatOpts = [['search', 'Search: ' + (T.q || '—')]].concat(cats.map((c, i) => ['cat' + i, 'Category: ' + (c.name || 'category ' + (i + 1))])).concat([['words', 'Words per text']]);
    let counts = null, label = '';
    if (TM.what === 'search' && T.q) { const comp = this.memo('tlQ|' + C.key + '|' + T.q + '|' + (T.qOff || []).join(',') + '|' + T.rec.fold, () => E.tlCompileDict(C, [{ name: 'q', keys: T.q, off: new Set(T.qOff || []) }], !!T.rec.fold)); counts = this.memo('tlQL|' + C.key + '|' + T.q + '|' + (T.qOff || []).join(',') + '|' + T.rec.fold, () => E.tlLookup(C, comp)[0]).counts; label = T.q; }
    else if (/^cat\d+$/.test(TM.what)) { const i = +TM.what.slice(3), L = this.tlDictLook(ctx); if (L && L.res[i]) { counts = L.res[i].counts; label = L.cats[i].name; } }
    const measure = TM.what === 'words' ? 'mean' : TM.measure;
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null, groups = G ? this.tlPickGroups(G, { gN: 6, gPick: [] }) : [null];
    const per = new Map();
    const nd = C.off.length - 1, mask = ctx.mask;
    for (let d = 0; d < nd; d++) {
      if (C.blank[d] || (mask && !mask[d])) continue; const pr = E.tlPeriod(D.day[d], unit); if (!pr) continue;
      const g = G ? groups.indexOf(G.g[d]) : 0; if (g < 0) continue;
      let o = per.get(pr.k); if (!o) { o = { k: pr.k, label: pr.label, s: groups.map(() => ({ n: 0, hit: 0, times: 0, words: 0 })) }; per.set(pr.k, o); }
      const s = o.s[g]; s.n++; const words = FT.foff[d + 1] - FT.foff[d]; s.words += words;
      if (counts) { const v = counts[d]; if (v > 0) { s.hit++; s.times += v; } }
    }
    const ps = [...per.values()].sort((a, b) => a.k - b.k);
    const val = s => !s.n ? NaN : TM.what === 'words' ? s.words / s.n : measure === 'count' ? s.times : measure === 'rate' ? (s.words ? 1e4 * s.times / s.words : NaN) : 100 * s.hit / s.n;
    const series = groups.map((g, i) => ({ name: G ? G.labels[g] : 'All texts', color: this.tlPal(i), pts: ps.map(p => val(p.s[i])) }));
    const ylab = TM.what === 'words' ? 'words per text (after cleaning)' : measure === 'count' ? 'times mentioned' : measure === 'rate' ? 'mentions per 10,000 words' : '% of texts that mention it';
    const ctl = h('div', { className: 'tl-row wide' }, head,
      this.tlField('Show', this.tlSelect(TM.what, whatOpts, v => set({ what: v }), 'What to show')),
      TM.what !== 'words' ? this.tlField('As', this.tlSeg([['pct', '% of texts'], ['count', 'Count'], ['rate', 'Per 10k words']], TM.measure, v => set({ measure: v }))) : null,
      this.tlField('By', this.tlSeg([['auto', 'Auto (' + unit + ')'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day']], TM.unit, v => set({ unit: v }))));
    const need = TM.what !== 'words' && !counts;
    return this.tlPanel('Over time', 'by ' + unit + (G ? ' and ' + T.by : ''), null, ctl,
      D.ambiguous ? this.tlBanner('info', 'Dates like 02.03.18 are read as ' + (D.order === 'dmy' ? 'day.month.year' : 'month.day.year') + '. ', this.tlBtn('Switch', () => set({ order: D.order === 'dmy' ? 'mdy' : 'dmy' }))) : null,
      need ? this.tlBanner('info', 'Type a search in “In context”, or build a dictionary category, to chart it over time.') : this.tlLinesSvg('tltime', ps.map(p => p.label), series, { ylab, pct: measure === 'pct' && TM.what !== 'words', title: (label ? label + ' · ' : '') + ylab }),
      need ? null : this.tlExportRow('tltime', 'over-time'),
      need ? null : this.tlRcode('dict <- dictionary(list(x = ' + this.tlRvec(E.tlParsePatterns(label || T.q || '').filter(p => !p.neg).map(p => p.parts.join(' '))) + '))\nhits <- dfm(tokens_lookup(toks, dict))\ndf$period <- format(as.Date(df$' + T.date + '), "%Y")\naggregate(as.numeric(hits[, "x"]) > 0 ~ period' + (G ? ' + ' + T.by : '') + ', data = df, FUN = mean)'));
  }

  // connections: fcm + textplot_network
  tlNetwork(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, NW = T.net, set = p => this.tlSetIn('net', p), E = this._E;
    const feats = this.tlTop(ctx, T.wview === 'tag' ? 'tag' : 'word', NW.n, cnt).map(w => w.f);
    const M = this.memo('tlNet|' + FT.sig + '|' + NW.n + '|' + NW.context + '|' + T.wview, () => E.tlFcm(FT, feats, { window: NW.context === 'window' ? 5 : 0 }));
    const n = feats.length, edges = []; let mx = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const w = M[i * n + j]; if (w > 0) edges.push([i, j, w]); if (w > mx) mx = w; }
    edges.sort((a, b) => b[2] - a[2]);
    const keepN = Math.max(n, Math.round(edges.length * (1 - NW.minFreq)));
    const kept = edges.slice(0, Math.min(keepN, 3 * n)).map(([i, j, w]) => [i, j, w / mx]);
    const W = 760, H = 480, lay = this.memo('tlNetL|' + FT.sig + '|' + NW.n + '|' + NW.context + '|' + kept.length, () => E.tlForceLayout(n, kept, 11, W, H));
    const cmax = Math.max(1, ...feats.map(f => cnt.count[f]));
    const svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Word co-occurrence network', ref: this.svgRef('tlnet'), className: 'tl-svg' },
      h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      kept.map(([i, j, w], k) => h('line', { key: 'e' + k, x1: lay.x[i], y1: lay.y[i], x2: lay.x[j], y2: lay.y[j], stroke: '#2E7D58', strokeOpacity: 0.15 + 0.6 * w, strokeWidth: 0.6 + 4 * w })),
      feats.map((f, i) => { const r = 3 + 9 * Math.sqrt(cnt.count[f] / cmax); return h('g', { key: 'n' + i }, h('circle', { cx: lay.x[i], cy: lay.y[i], r, fill: '#C4681E', fillOpacity: 0.85 }), h('text', { x: lay.x[i], y: lay.y[i] - r - 3, textAnchor: 'middle', fontSize: 11 + 5 * Math.sqrt(cnt.count[f] / cmax), fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 600, fill: '#1A1711' }, FT.label[f])); }));
    return this.tlPanel('Connections', 'which words appear together (fcm + textplot_network)', null,
      h('div', { className: 'tl-row wide' }, this.tlField('Words', this.tlNum(NW.n, v => set({ n: v }), { min: 5, max: 120, aria: 'Number of words' })), this.tlField('Together means', this.tlSeg([['doc', 'Same text'], ['window', 'Within 5 words']], NW.context, v => set({ context: v }))), this.tlField('Show links', this.tlSeg([[0.5, 'Strongest half'], [0.8, 'Top 20%'], [0, 'All']], NW.minFreq, v => set({ minFreq: v })))),
      svg, this.tlExportRow('tlnet', 'word-network'),
      this.tlRcode('fcmat <- fcm(toks_clean, context = "' + (NW.context === 'window' ? 'window", window = 5' : 'document"') + ')\nfeat <- names(topfeatures(dfmat, ' + NW.n + '))\ntextplot_network(fcm_select(fcmat, pattern = feat), min_freq = ' + (NW.minFreq || 0.5) + ')'));
  }

  // clusters: textstat_simil/dist + hclust dendrogram
  tlClusters(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, CU = T.clu, set = p => this.tlSetIn('clu', p), E = this._E;
    const ctl = [];
    let labels = [], rows = [], note = '', rowDocs = null;
    const nW = Math.min(3000, cnt.order.length);
    const topF = cnt.order.filter(f => FT.kind[f] !== 4).slice(0, CU.what === 'words' ? CU.nWords : nW);
    if (CU.what === 'groups') {
      const by = T.by;
      if (!by) return this.tlPanel('Clusters', null, null, this.tlBanner('info', 'Pick a group column in Texts (step 1), or cluster texts or words instead.'), this.tlSeg([['groups', 'Groups'], ['texts', 'Texts'], ['words', 'Words']], CU.what, v => set({ what: v })));
      const G = this.tlGroupsOf(T, C, by), D = CU.byYear && T.date ? this.tlDates(T, C) : null;
      const key = new Map(), lab = [];
      const nd = C.off.length - 1, gid = new Int32Array(nd).fill(-1);
      for (let d = 0; d < nd; d++) { if (C.blank[d] || (ctx.mask && !ctx.mask[d]) || G.g[d] < 0) continue; let k = G.labels[G.g[d]]; if (D) { const y = E.tlPeriod(D.day[d], 'year'); if (!y) continue; k += ' ' + y.label; } let id = key.get(k); if (id === undefined) { id = lab.length; key.set(k, id); lab.push(k); } gid[d] = id; }
      const gc = E.tlGroupCounts(FT, gid, lab.length, null);
      const minWords = 200, keepIdx = lab.map((l, i) => i).filter(i => gc.tot[i] >= minWords).sort((a, b) => lab[a].localeCompare(lab[b], undefined, { numeric: true }));
      labels = keepIdx.map(i => lab[i]); rows = keepIdx.map(i => Array.from(topF, f => gc.counts[i][f]));
      note = labels.length + ' groups with 200+ words' + (keepIdx.length < lab.length ? ' (' + (lab.length - keepIdx.length) + ' smaller ones left out)' : '');
      ctl.push(T.date ? h('div', { className: 'tl-row' }, this.tlChip('Split each group by year', CU.byYear, () => set({ byYear: !CU.byYear }))) : null);
    } else if (CU.what === 'texts') {
      const nd = C.off.length - 1, ids = []; for (let d = 0; d < nd; d++) if (!C.blank[d] && (!ctx.mask || ctx.mask[d]) && FT.foff[d + 1] - FT.foff[d] >= 5) ids.push(d);
      const step = Math.max(1, Math.floor(ids.length / CU.nTexts)), pick = ids.filter((_, i) => i % step === 0).slice(0, CU.nTexts);
      const idx = new Map(topF.map((f, i) => [f, i]));
      rows = pick.map(d => { const r = new Float64Array(topF.length); for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { const k = idx.get(FT.ftok[i]); if (k !== undefined) r[k]++; } return Array.from(r); });
      labels = pick.map(d => 'row ' + (this.tlRowOf(C, d) + 1)); rowDocs = pick;
      note = pick.length + ' texts' + (step > 1 ? ' (an even sample of ' + this.fmtN(ids.length) + ')' : '');
      ctl.push(this.tlField('Texts', this.tlNum(CU.nTexts, v => set({ nTexts: v }), { min: 10, max: 500, aria: 'Number of texts' })));
    } else {
      const M = this.memo('tlNetW|' + FT.sig + '|' + CU.nWords, () => E.tlFcm(FT, topF, { window: 0 }));
      const n = topF.length; labels = topF.map(f => FT.label[f]); rows = topF.map((f, i) => Array.from({ length: n }, (_, j) => i === j ? cnt.docf[f] : M[i * n + j]));
      note = n + ' most frequent words · profiles = which other words they appear with';
      ctl.push(this.tlField('Words', this.tlNum(CU.nWords, v => set({ nWords: v }), { min: 5, max: 150, aria: 'Number of words' })));
    }
    if (rows.length < 3) return this.tlPanel('Clusters', null, null, this.tlSeg([['groups', 'Groups'], ['texts', 'Texts'], ['words', 'Words']], CU.what, v => set({ what: v })), this.tlBanner('warn', 'Need at least 3 groups or texts with enough words.'));
    const W = rows.map(r => { const s = r.reduce((a, b) => a + b, 0) || 1; return CU.weight === 'prop' ? r.map(x => x / s) : r.slice(); });
    if (CU.weight === 'tfidf') { const df = rows[0].map((_, j) => rows.reduce((a, r) => a + (r[j] > 0 ? 1 : 0), 0)); W.forEach(r => r.forEach((x, j, a) => { a[j] = x * Math.log10(rows.length / Math.max(1, df[j])); })); }
    const dist = CU.link === 'ward.D2' ? 'euclidean' : CU.dist;
    const sig = FT.sig + '|' + CU.what + '|' + labels.join('¦').length + '|' + labels.length + '|' + CU.weight + '|' + dist + '|' + CU.link + '|' + T.by + CU.byYear + CU.nWords + CU.nTexts;
    const Dm = this.memo('tlCluD|' + sig, () => E.tlMatrixDist(W, dist));
    const H = this.memo('tlCluH|' + sig, () => E.tlHclust(Dm, labels.length, CU.link));
    const k = Math.max(1, Math.min(labels.length, CU.k)), cl = E.tlCutree(H, labels.length, k);
    const svg = this.tlDendroSvg('tldendro', H, labels, cl, k, CU.orient);
    const controls = h('div', { className: 'tl-ctl' },
      this.tlField('Cluster', this.tlSeg([['groups', 'Groups'], ['texts', 'Texts'], ['words', 'Words']], CU.what, v => set({ what: v }))), ...ctl,
      this.tlField('Word weights', this.tlSeg([['prop', '% of words'], ['tfidf', 'tf-idf'], ['count', 'Counts']], CU.weight, v => set({ weight: v }))),
      this.tlField('Distance', this.tlSeg([['cosine', 'Cosine'], ['correlation', 'Correlation'], ['euclidean', 'Euclidean'], ['manhattan', 'Manhattan'], ['jaccard', 'Jaccard']], dist, v => set({ dist: v, link: CU.link === 'ward.D2' && v !== 'euclidean' ? 'average' : CU.link }))),
      this.tlField('Joining rule (linkage)', this.tlSeg([['average', 'Average'], ['ward.D2', 'Ward'], ['complete', 'Complete'], ['single', 'Single']], CU.link, v => set({ link: v })), h('span', { className: 'tl-hint' }, 'Ward needs Euclidean distance; picking Ward switches it for you.')),
      this.tlField('Cut into', h('div', { className: 'tl-row' }, this.tlNum(k, v => set({ k: v }), { min: 1, max: Math.min(30, labels.length), aria: 'Number of clusters' }), h('span', { className: 'tl-hint' }, 'clusters'))),
      this.tlField('Display', this.tlSeg([['h', 'Horizontal'], ['v', 'Vertical']], CU.orient, v => set({ orient: v }))),
      this.tlStat('How well the tree fits', isFinite(H.coph) ? H.coph.toFixed(2) : '—', 'cophenetic correlation · above 0.75 is good'),
      CU.what !== 'words' ? this.tlBtn('Save cluster as a variable', () => this.tlSaveCluster(ctx, CU, labels, cl, rowDocs), 'primary') : null);
    const members = Array.from({ length: k }, (_, i) => labels.filter((_, j) => cl[j] === i + 1));
    return h('div', { className: 'tl-grid c-cl' }, this.tlPanel('Settings', null, null, controls), this.tlPanel('Dendrogram', note + ' · ' + dist + ' distance · ' + CU.link + ' linkage', null, svg, this.tlExportRow('tldendro', 'dendrogram'),
      h('div', { className: 'tl-clusters' }, members.map((m, i) => h('div', { key: i, className: 'tl-cluster' }, h('span', { className: 'sw', style: { background: this.tlPal(i) } }), h('b', null, 'Cluster ' + (i + 1) + ' · ' + m.length), ' ', m.slice(0, 18).join(', ') + (m.length > 18 ? ' …' : '')))),
      this.tlRcode((CU.what === 'groups' ? 'dfmat_g <- dfm_group(dfm_select(dfmat, names(topfeatures(dfmat, ' + topF.length + '))), groups = ' + T.by + (CU.byYear && T.date ? ' + year' : '') + ')' : CU.what === 'texts' ? 'dfmat_g <- dfm_sample(dfmat, ' + labels.length + ')' : 'dfmat_g <- t(fcm(dfm_select(dfmat, names(topfeatures(dfmat, ' + topF.length + ')))))') + '\n' + (CU.weight === 'prop' ? 'dfmat_g <- dfm_weight(dfmat_g, scheme = "prop")\n' : CU.weight === 'tfidf' ? 'dfmat_g <- dfm_tfidf(dfmat_g)\n' : '') + (['cosine', 'correlation', 'jaccard'].includes(dist) ? 'd <- as.dist(1 - as.matrix(textstat_simil(dfmat_g, method = "' + dist + '")))' : 'd <- as.dist(as.matrix(textstat_dist(dfmat_g, method = "' + dist + '")))') + '\nhc <- hclust(d, method = "' + CU.link + '")\nplot(hc); rect.hclust(hc, k = ' + k + ')\ncor(d, cophenetic(hc))   # ' + (isFinite(H.coph) ? H.coph.toFixed(3) : '') + '\ncutree(hc, k = ' + k + ')')));
  }

  // text stats
  tlStatsView(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, lang = this.tlStemLang(T, C);
    const S = this.memo('tlStats|' + C.key + '|' + lang, () => E.tlTextStats(C, C.texts, { lang, window: 50 }));
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null, groups = G ? G.labels.map((l, i) => i).sort((a, b) => G.count[b] - G.count[a]).slice(0, 20) : [null];
    const nd = C.off.length - 1, mask = ctx.mask;
    const agg = groups.map(g => { const o = { n: 0, tokens: 0, types: 0, sents: 0, mattr: 0, nm: 0, read: 0, nr: 0, wlen: 0 }; for (let d = 0; d < nd; d++) { if (C.blank[d] || (mask && !mask[d]) || (G && G.g[d] !== g)) continue; o.n++; o.tokens += S.tokens[d]; o.types += S.types[d]; o.sents += S.sents[d]; if (isFinite(S.mattr[d])) { o.mattr += S.mattr[d]; o.nm++; } if (isFinite(S.read[d])) { o.read += S.read[d]; o.nr++; } if (isFinite(S.wlen[d])) o.wlen += S.wlen[d]; } return o; });
    const rows = groups.map((g, i) => { const o = agg[i]; return [G ? G.labels[g] : 'All texts', this.fmtN(o.n), this.fmt(o.tokens / o.n, 1), this.fmt(o.types / o.n, 1), this.fmt(o.sents / o.n, 1), this.fmt(o.wlen / o.n, 2), o.nm ? (o.mattr / o.nm).toFixed(3) : '—', o.nr ? this.fmt(o.read / o.nr, 1) : '—']; });
    const lens = []; for (let d = 0; d < nd; d++) if (!C.blank[d] && (!mask || mask[d])) lens.push(S.tokens[d]);
    lens.sort((a, b) => a - b);
    const q = p => lens.length ? lens[Math.min(lens.length - 1, Math.floor(p * lens.length))] : 0;
    const bins = 20, mx = q(0.99) || 1, hist = new Array(bins).fill(0); for (const v of lens) hist[Math.min(bins - 1, Math.floor(v / mx * bins))]++;
    const histSvg = this.tlBarsSvg('tllen', hist.map((c, i) => ({ label: Math.round(i * mx / bins) + '–' + Math.round((i + 1) * mx / bins), value: c, color: '#357F93' })), { title: 'Words per text (all words, before cleaning)', xlab: 'number of texts', vertical: true });
    return h('div', { className: 'tl-col' }, this.tlPanel('Text statistics', G ? 'by ' + T.by : 'all texts', null,
      h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, ['Group', 'Texts', 'Words', 'Different words', 'Sentences', 'Letters per word', 'Vocabulary richness (MATTR)', lang === 'en' ? 'Reading ease (Flesch)' : 'Reading ease (Fernández-Huerta)'].map((c, i) => h('th', { key: i, className: i ? 'n' : '' }, c)))), h('tbody', null, rows.map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j, className: j ? 'n' : 'w' }, c))))))),
      this.tlBanner('info', 'Averages per text. MATTR is the share of different words in every 50-word window (textstat_lexdiv(measure = "MATTR")); it does not fall as texts get longer the way the plain type–token ratio does. Reading ease: higher = easier; the Spanish score uses Fernández-Huerta’s formula with approximate syllable counts.'),
      this.tlBtn('Save word counts as variables', () => { this.tlSetIn('save', { nwords: true }); this.tlSet({ step: 'save' }); })),
      this.tlPanel('Length of the texts', 'median ' + q(0.5) + ' words · 90% have ' + q(0.05) + '–' + q(0.95), null, histSvg, this.tlExportRow('tllen', 'text-lengths'),
        this.tlRcode('textstat_summary(corp)\ntextstat_lexdiv(toks, measure = "MATTR", MATTR_window = 50)\ntextstat_readability(corp, measure = "Flesch")')));
  }
