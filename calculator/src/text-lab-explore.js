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
      this.tlRcode('toks_p <- tokens(corp, remove_punct = TRUE, remove_url = TRUE) |> tokens_tolower()   # stopwords kept: phrases need them\ntextstat_collocations(toks_p, size = ' + P.size + ', min_count = ' + min + ')   # can take several minutes on long texts'));
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
    const tbl = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl tl-wraph' }, h('thead', null, h('tr', null, h('th', null, 'Word'), h('th', { className: 'n' }, K.measure === 'chi2' ? 'χ²' : K.measure === 'lr' ? 'G²' : K.measure === 'exact' ? 'odds ratio' : 'PMI'), h('th', { className: 'n' }, 'p'), h('th', { className: 'n' }, tName.slice(0, 18) + ' per 10k'), h('th', { className: 'n' }, rName.slice(0, 18) + ' per 10k'))),
      h('tbody', null, top.concat(bot).map(r => h('tr', { key: r.f }, h('td', { className: 'w' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.tlSet({ q: FT.label[r.f], sub: 'context', qOff: [] }) }, FT.label[r.f])), h('td', { className: 'n' }, K.measure === 'exact' ? (r.or === Infinity ? '∞' : this.fmt(r.or, 2)) : this.fmt(r.stat, 1)), h('td', { className: 'n' }, isFinite(r.p) ? (r.p < 0.001 ? '<.001' : r.p.toFixed(3)) : '—'), h('td', { className: 'n' }, rate(r.a, res.Tt)), h('td', { className: 'n' }, rate(r.b, res.Tr)))))));
    const words = arr => arr.slice(0, 5).map(r => FT.label[r.f]).join(', ');
    const sig = res.rows.filter(r => isFinite(r.p) && r.p < 0.001);
    const story = this.tlBanner('ok', h('b', null, 'What this means: '), tName + ' uses ' + words(top) + ' much more than ' + rName + '. ' + (bot.length ? rName.charAt(0).toUpperCase() + rName.slice(1) + ' uses ' + words(bot) + ' more. ' : '') + this.fmtN(sig.length) + ' words differ with p < .001 (each used at least ' + K.min + ' times). Read them in context before quoting.');
    return h('div', { className: 'tl-col' }, this.tlPanel('Compare groups', 'which words set one group apart (textstat_keyness)', null, ctl, story, svg, this.tlExportRow('tlkey', 'keyness'), tbl,
      this.tlRcode('# dfmat is the cleaned dfm from the recipe above (stopwords removed), as on this page\n' + (ref >= 0 ? 'dfk <- dfm_subset(dfmat, `' + by + '` %in% c("' + tName + '", "' + rName + '"))   # against one group only\n' : 'dfk <- dfmat\n') + 'key <- textstat_keyness(dfm_group(dfk, groups = `' + by + '`), target = "' + tName + '", measure = "' + K.measure + '")\n' + (K.measure === 'exact' ? 'Tt <- sum(key$n_target); Tr <- sum(key$n_reference)   # all words of each side\nkey$log_or <- log(((key$n_target + 0.5) * (Tr - key$n_reference + 0.5)) / ((key$n_reference + 0.5) * (Tt - key$n_target + 0.5)))\n' : '') + 'key <- key[key$n_target + key$n_reference >= ' + K.min + ', ]   # words used at least ' + K.min + ' times, as the page shows\n' + (K.measure === 'exact' ? 'key <- key[order(-key$log_or, key$p), ]   # ranked as on the page: log odds ratio (+0.5), then p\n' : '') + 'head(key, ' + n + '); tail(key, ' + n + ')\n' + (K.measure === 'exact' ? 'key$exact <- key$log_or   # the plot needs finite values: draw the log odds ratio, as on the page\n' : '') + 'textplot_keyness(key, n = ' + n + ')')));
  }

  // in context: kwic + match list + by group
  // ---- the search shared by In context, Over time and Connections: the words in T.q, the forms unticked in T.qOff
  tlSearchField(T, after, k) { return this.tlField('Search', this.tlText(T.q || '', v => { this.tlSet({ q: v, qOff: [] }); if (after) after(v); }, { placeholder: 'e.g. corrup*, "guardia nacional", #covid19', aria: 'Search words', width: 300, mono: true, k: k || 'q' })); }
  tlSearchHelp(T) { return React.createElement('span', { className: 'tl-hint' }, '* any ending · ? one letter · "two words" = phrase · -word = never count · #tag · @name · accents ' + (T.rec.fold ? 'ignored (ñ kept)' : 'respected')); }
  tlSearchAll(ctx) { const { T, C } = ctx, E = this._E, q = T.q || ''; return this.memo('tlQall|' + C.key + '|' + q + '|' + T.rec.fold, () => E.tlLookup(C, E.tlCompileDict(C, [{ name: 'q', keys: q }], !!T.rec.fold))[0]); }
  tlSearchForms(ctx) {
    const h = React.createElement, { T } = ctx, E = this._E, q = T.q || ''; if (!q.trim()) return null;
    const off = new Set(T.qOff || []), forms = [...this.tlSearchAll(ctx).forms.entries()].sort((a, b) => b[1] - a[1]);
    if (!forms.length) return this.tlBanner('warn', 'No word in the texts matches “' + q + '”. Check the spelling, or add * for any ending (corrup*).');
    const row = h('div', { className: 'tl-forms' }, ...forms.slice(0, 40).map(([w, c]) => { const isOff = off.has(w) || off.has(E.tlFold(w)); return h('label', { key: w, className: 'tl-form' + (isOff ? ' off' : '') }, h('input', { type: 'checkbox', checked: !isOff, onChange: () => this.tlSet({ qOff: isOff ? [...off].filter(x => x !== w && x !== E.tlFold(w)) : [...off, w] }) }), w, h('em', null, ' ' + this.fmtN(c))); }), forms.length > 40 ? h('span', { className: 'tl-hint' }, '+ ' + (forms.length - 40) + ' more') : null);
    return h('div', { className: 'tl-col tl-search-forms' }, h('span', { className: 'tl-lbl' }, 'This search matched ' + forms.length + ' different word' + (forms.length === 1 ? '' : 's') + ' · untick any that do not belong'), row);
  }
  tlContext(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E;
    const q = T.q || '';
    const search = h('div', { className: 'tl-row wide' }, this.tlSearchField(T),
      this.tlField('Words each side', this.tlNum(T.win, v => this.tlSet({ win: v }), { min: 1, max: 30, aria: 'Words of context' })),
      this.tlField('Sort by', this.tlSeg([['row', 'Row'], ['pre', 'Word before'], ['post', 'Word after'], ['group', 'Group']], T.sort, v => this.tlSet({ sort: v }))));
    const help = this.tlSearchHelp(T);
    if (!q.trim()) return this.tlPanel('In context', 'read every use of a word (kwic)', null, search, help, this.tlBanner('info', 'Type a word, or click any word in a table. Wildcards show every form they match, so you can drop the wrong ones.'));
    const off = new Set(T.qOff || []);
    const comp = this.memo('tlQ|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.rec.fold, () => E.tlCompileDict(C, [{ name: 'q', keys: q, off }], !!T.rec.fold));
    const look = this.memo('tlQL|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.rec.fold, () => E.tlLookup(C, comp)[0]);
    const mask = ctx.mask;
    let hits = 0, docs = 0, n = 0; for (let d = 0; d < look.counts.length; d++) { if (mask && !mask[d]) continue; const v = look.counts[d]; if (!isFinite(v)) continue; n++; if (v > 0) { docs++; hits += v; } }
    const K = this.memo('tlKW|' + C.key + '|' + q + '|' + [...off].join(',') + '|' + T.win + '|' + T.rec.fold + '|' + (mask ? this.filterSig() : ''), () => E.tlKwic(C, C.texts, comp, { window: T.win, limit: 500, mask }));
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null;
    let rows = K.rows.slice();
    if (T.sort === 'pre') rows.sort((a, b) => (a.pre.split(' ').pop() || '').localeCompare(b.pre.split(' ').pop() || ''));
    else if (T.sort === 'post') rows.sort((a, b) => a.post.localeCompare(b.post));
    else if (T.sort === 'group' && G) rows.sort((a, b) => (G.g[a.doc] - G.g[b.doc]) || a.doc - b.doc);
    // build .98: each side is as wide as its words need (about 62 px a word), the table scrolls sideways with the keyword in
    // the middle, the row number opens that row in the Data tab, and clicking a line shows the passage around it
    const side = Math.max(300, Math.round(T.win * 62)), openI = T.kwOpen != null ? T.kwOpen : -1;
    const kwic = h('div', { className: 'tl-tblwrap tall tl-kwicwrap', ref: el => { if (!el) return; el.style.setProperty('--kwvw', el.clientWidth + 'px'); el.onscroll = () => { for (const d of el.querySelectorAll('.tl-pass')) d.style.transform = 'translateX(' + el.scrollLeft + 'px)'; }; if (el.dataset.c !== String(T.win) + '|' + q) { el.dataset.c = String(T.win) + '|' + q; el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2); } } },
      h('table', { className: 'tl-kwic' }, h('tbody', null, rows.slice(0, 200).flatMap((r, i) => {
        const open = openI === i, rowN = this.tlRowOf(C, r.doc) + 1;
        const tr = h('tr', { key: i, className: open ? 'open' : '', title: open ? 'Click to close the passage' : 'Click to read the passage around it', onClick: () => this.tlSet({ kwOpen: open ? -1 : i }) },
          h('td', { className: 'meta' }, h('button', { type: 'button', className: 'tl-link', title: 'Open row ' + this.fmtN(rowN) + ' in the Data tab', 'aria-label': 'Open row ' + rowN + ' in the Data tab', onClick: e => { e.stopPropagation(); this.tlGoRow(C, r.doc); } }, 'row ' + this.fmtN(rowN)), G && G.g[r.doc] >= 0 ? ' · ' + G.labels[G.g[r.doc]] : ''),
          h('td', { className: 'pre', style: { minWidth: side + 'px', maxWidth: side + 'px' } }, r.pre), h('td', { className: 'kw' }, r.kw), h('td', { className: 'post', style: { minWidth: side + 'px', maxWidth: side + 'px' } }, r.post));
        return open ? [tr, h('tr', { key: 'p' + i, className: 'tl-kwic-pass' }, h('td', { colSpan: 4 }, this.tlPassage(C, r, 60)))] : [tr];
      }))));
    const copy = this.tlBtn(this.state.copied === 'tlk' ? 'Copied ✓' : 'Copy all ' + this.fmtN(K.rows.length) + ' lines', () => this.copyTSV('tlk', 'row\tgroup\tbefore\tkeyword\tafter\n' + K.rows.map(r => [this.tlRowOf(C, r.doc) + 1, G && G.g[r.doc] >= 0 ? G.labels[G.g[r.doc]] : '', r.pre, r.kw, r.post].join('\t')).join('\n')));
    let byG = null;
    if (G) {
      const st = G.labels.map(() => ({ n: 0, hit: 0, times: 0 }));
      for (let d = 0; d < look.counts.length; d++) { const g = G.g[d]; if (g < 0 || (mask && !mask[d])) continue; const v = look.counts[d]; if (!isFinite(v)) continue; st[g].n++; if (v > 0) { st[g].hit++; st[g].times += v; } }
      const ord = st.map((s, i) => i).filter(i => st[i].n).sort((a, b) => st[b].hit / st[b].n - st[a].hit / st[a].n).slice(0, 30);
      byG = this.tlBarsSvg('tlkwg', ord.map(i => ({ label: G.labels[i], value: 100 * st[i].hit / st[i].n, note: this.fmtN(st[i].hit) + ' of ' + this.fmtN(st[i].n), color: this.tlPal(0) })), { title: '% of texts that mention it, by ' + T.by, xlab: '% of texts', pct: true });
    }
    return h('div', { className: 'tl-col' }, this.tlPanel('In context', 'every use of the search, with the words around it (kwic)', null, search, help,
      this.tlSearchForms(ctx),
      this.tlBanner('ok', h('b', null, this.fmtN(docs) + ' texts'), ' (' + this.tlPct(docs / Math.max(1, n)) + ') mention it, ' + this.fmtN(hits) + ' times in total.' + (K.rows.length < hits ? ' Showing the first ' + Math.min(200, K.rows.length) + ' lines.' : '')),
      kwic, h('div', { className: 'tl-row' }, copy, this.tlBtn('Use as a dictionary category', () => { const T2 = this.tlS(), d = (T2.dict || []).filter(x => x.keys.trim()); this.tlSet({ dict: d.concat([{ name: q.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)[0] || 'category', keys: q, off: [...off] }]), step: 'measure', msub: 'dict' }); }), this.tlBtn('See it over time', () => this.tlSet({ sub: 'time', time: Object.assign({}, T.time, { what: 'search' }) }))),
      this.tlRcode('kwic(toks, pattern = ' + (q.indexOf('"') >= 0 || /\s/.test(q.replace(/,\s*/g, ',')) ? 'phrase(' : '') + this.tlRvec(E.tlParsePatterns(q).filter(p => !p.neg).map(p => { const w = p.parts.join(' '); return T.rec.fold ? E.tlFold(w) : w; })) + (q.indexOf('"') >= 0 || /\s/.test(q.replace(/,\s*/g, ',')) ? ')' : '') + ', window = ' + T.win + ', valuetype = "glob")')),
      byG ? this.tlPanel('By ' + T.by, null, null, byG, this.tlExportRow('tlkwg', 'mentions-by-group')) : null);
  }

  // the row of a kwic line, opened in the Data tab (its text column in view)
  tlGoRow(C, d) { const r = this.tlRowOf(C, d), T = this.tlS(); this.deBrowse(T.v); this.setState({ bRow: r, mfMobile: 'analysis' }); this.flash('Row ' + this.fmtN(r + 1) + ' in the Data tab'); }
  // the passage around a kwic line: win words each side of the keyword, from the original text
  tlPassage(C, r, win) {
    const h = React.createElement, a = C.off[r.doc], b = C.off[r.doc + 1], i = a + r.pos, L = Math.max(1, String(r.kw).split(' ').length), lo = Math.max(a, i - win), hi = Math.min(b - 1, i + L - 1 + win), s = String(C.texts[r.doc]), cl = x => x.replace(/\s+/g, ' ');
    // sticky does not work inside a table cell, so the passage follows the table's sideways scroll by hand
    return h('div', { className: 'tl-pass', ref: el => { const w = el && el.closest && el.closest('.tl-kwicwrap'); if (w) el.style.transform = 'translateX(' + w.scrollLeft + 'px)'; } }, (lo > a ? '… ' : '') + cl(s.slice(C.start[lo], C.start[i])), h('mark', null, cl(s.slice(C.start[i], C.end[i + L - 1]))), cl(s.slice(C.end[i + L - 1], C.end[hi])) + (hi < b - 1 ? ' …' : ''));
  }
  // words in each text before cleaning (links, numbers and stop words are not words; shared with Save → n_words)
  tlRawWords(C) { return this.memo('tlNW|' + C.key, () => { const nd = C.off.length - 1, w = new Float64Array(nd); for (let d = 0; d < nd; d++) { let k = 0; for (let i = C.off[d]; i < C.off[d + 1]; i++) if (C.kind[C.tok[i]] === 1) k++; w[d] = k; } return w; }); }

  // over time
  tlTimeUnit(TM, D) { const span = D.max - D.min; return TM.unit && TM.unit !== 'auto' ? TM.unit : D.yearOnly || span > 365 * 6 ? 'year' : span > 365 * 2 ? 'quarter' : span > 120 ? 'month' : span > 30 ? 'week' : 'day'; }
  // one value per period for each series; defs: [{ name, color, inc(d), x(d) }]
  tlPeriodLabel(k, unit) { const p2 = x => String(x).padStart(2, '0'); return unit === 'year' ? String(k) : unit === 'quarter' ? Math.floor(k / 4) + ' Q' + (k % 4 + 1) : unit === 'month' ? Math.floor(k / 12) + '-' + p2(k % 12 + 1) : unit === 'week' ? new Date((k * 7 - 3) * 86400000).toISOString().slice(0, 10) : new Date(k * 86400000).toISOString().slice(0, 10); }
  tlTimeAgg(ctx, D, unit, defs, measure, fill) {
    const { C, FT } = ctx, E = this._E, nd = C.off.length - 1, mask = ctx.mask, per = new Map();
    for (let d = 0; d < nd; d++) {
      if (C.blank[d] || (mask && !mask[d])) continue;
      const pr = E.tlPeriod(D.day[d], unit); if (!pr) continue;
      let o = per.get(pr.k); if (!o) { o = { k: pr.k, label: pr.label, s: defs.map(() => ({ n: 0, hit: 0, sum: 0, words: 0, v: measure === 'median' ? [] : null })) }; per.set(pr.k, o); }
      const words = FT.foff[d + 1] - FT.foff[d];
      for (let i = 0; i < defs.length; i++) { const df = defs[i]; if (!df.inc(d)) continue; const x = df.x(d); if (!isFinite(x)) continue; const s = o.s[i]; s.n++; s.sum += x; if (x > 0) s.hit++; s.words += words; if (s.v) s.v.push(x); }
    }
    let ps = [...per.values()].sort((p, q) => p.k - q.k);
    if (fill && ps.length > 1) { const all = []; for (let k = ps[0].k, i = 0; k <= ps[ps.length - 1].k; k++) { if (ps[i] && ps[i].k === k) all.push(ps[i++]); else all.push({ k, label: this.tlPeriodLabel(k, unit), s: defs.map(() => ({ n: 0, hit: 0, sum: 0, words: 0, v: measure === 'median' ? [] : null })) }); } ps = all; }
    const med = v => { const a = v.slice().sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const val = s => !s.n ? (fill ? 0 : NaN) : measure === 'pct' ? 100 * s.hit / s.n : measure === 'count' || measure === 'sum' ? s.sum : measure === 'rate' ? (s.words ? 1e4 * s.sum / s.words : NaN) : measure === 'median' ? med(s.v) : s.sum / s.n;
    // with zero-filling, each line runs from that series' first to its last observed period
    const series = defs.map((df, i) => { const pts = ps.map(p => val(p.s[i])); if (fill) { const has = ps.map(p => p.s[i].n > 0), a = has.indexOf(true), b = has.lastIndexOf(true); for (let j = 0; j < pts.length; j++) if (a < 0 || j < a || j > b) pts[j] = NaN; } return { name: df.name, color: df.color, dash: df.dash, pts }; });
    return { xs: ps.map(p => p.label), series };
  }
  // build .98: the layouts of a timeline with several words / categories. With a group column (president, party …):
  // one chart with a line per word and the groups' eras marked along the time axis (the default: presidents follow one
  // another, so each word stays one line); word × group (colour = word, dashes = group); the groups pooled; one chart
  // per group; one chart per word.
  tlTimeLayouts(ctx, many, combined, itemLab) {
    const { T, C } = ctx, by = T.by, G = by ? this.tlGroupsOf(T, C, by) : null;
    if (!many) return G ? [['author', '']] : [['none', '']];
    const L = [];
    if (G) L.push(['item-era', 'One line per ' + itemLab + ', ' + by + ' marked'], ['item-group', itemLab + ' × ' + by]);
    L.push(['item', G ? 'One line per ' + itemLab + ', groups pooled' : 'One line per ' + itemLab]);
    if (G) L.push(['grid-author', 'One chart per ' + by], ['grid-item', 'One chart per ' + itemLab]);
    if (combined && G) L.push(['author', 'All together, one line per ' + by]);
    return L;
  }
  tlTimeDefault(ctx, many) { return ctx.T.by ? (many ? 'item-era' : 'author') : (many ? 'item' : 'none'); }
  tlTimeUsesBy(lines) { return ['author', 'item-group', 'grid-author', 'grid-item'].includes(lines); }
  tlTimeCharts(ctx, D, unit, o) {
    const { T } = ctx, charts = [], DASH = ['', '7 4', '2 3', '9 3 2 3', '4 2', '12 3'], key = o.key || 'tltime';
    const one = (k, title, defs, eras) => charts.push({ key: k, title, eras: !!eras, data: this.memo(o.sig + '|' + o.lines + '|' + k, () => this.tlTimeAgg(ctx, D, unit, defs, o.measure, !!o.fill)) });
    const parts = o.parts, single = o.single, ylab = o.ylab, lines = o.lines, gdefs = this.tlGroupDefs(ctx, null).defs;
    if (lines === 'author') one(key, o.t1, this.tlGroupDefs(ctx, single.x).defs);
    else if (lines === 'none') one(key, o.t1, [{ name: 'All texts', color: this.tlPal(0), inc: () => true, x: single.x }]);
    else if (lines === 'item' || lines === 'item-era') one(key, ylab + ' · each ' + o.itemLab, parts.map((it, k) => ({ name: it.name, color: this.tlPal(k), inc: () => true, x: it.x })), lines === 'item-era');
    else if (lines === 'item-group') one(key, ylab + ' · each ' + o.itemLab + ' by ' + T.by, parts.flatMap((it, k) => gdefs.map((gd, gi) => ({ name: it.name + ' · ' + gd.name, color: this.tlPal(k), dash: DASH[gi % DASH.length], inc: gd.inc, x: it.x }))));
    else if (lines === 'grid-author') gdefs.slice(0, 6).forEach((gd, gi) => one(key + gi, gd.name + ' · ' + ylab, parts.map((it, k) => ({ name: it.name, color: this.tlPal(k), inc: gd.inc, x: it.x }))));
    else parts.slice(0, 9).forEach((it, k) => one(key + k, it.name + ' · ' + ylab, this.tlGroupDefs(ctx, it.x).defs));
    charts.forEach(ch => { ch.eras = ch.eras ? this.memo(o.sig + '|eras|' + ch.key, () => this.tlEras(ctx, D, unit, ch.data.xs, gdefs)) : null; });
    return charts;
  }
  // where each group's texts begin and end along the time axis (as positions among the periods drawn)
  tlEras(ctx, D, unit, xs, gdefs) {
    const { C } = ctx, E = this._E, nd = C.off.length - 1, mask = ctx.mask, at = new Map(xs.map((x, i) => [x, i])), span = gdefs.map(() => ({ a: Infinity, b: -Infinity }));
    for (let d = 0; d < nd; d++) { if (C.blank[d] || (mask && !mask[d])) continue; const pr = E.tlPeriod(D.day[d], unit); if (!pr) continue; const i = at.get(pr.label); if (i == null) continue; for (let g = 0; g < gdefs.length; g++) if (gdefs[g].inc(d)) { const s = span[g]; if (i < s.a) s.a = i; if (i > s.b) s.b = i; } }
    return gdefs.map((gd, g) => ({ name: gd.name, a: span[g].a, b: span[g].b })).filter(e => e.a <= e.b).sort((p, q) => p.a - q.a || p.b - q.b);
  }
  // one line per group (groups too small to chart are left out)
  tlGroupDefs(ctx, x) {
    const { T, C } = ctx, G = T.by ? this.tlGroupsOf(T, C, T.by) : null;
    if (!G) return { G, defs: [{ name: 'All texts', color: this.tlPal(0), inc: () => true, x }] };
    const groups = G.labels.map((l, i) => i).filter(i => G.count[i] >= Math.max(5, 0.002 * C.docs)).sort((p, q) => G.count[q] - G.count[p]).slice(0, 6);
    return { G, defs: groups.map((g, i) => ({ name: G.labels[g], color: this.tlPal(i), inc: d => G.g[d] === g, x })) };
  }
  // numeric columns for the timeline: variables made in this tab first, then the rest of the data
  tlVarOpts(T) {
    const tags = this.state.genTags || {}, cols = (this.state.cols || []).filter(c => c.name !== T.v && ((this.effMeta(c.name) || c).treatAs || c.type) === 'numeric');
    return { made: cols.filter(c => tags[c.name] === 'text').map(c => c.name), other: cols.filter(c => tags[c.name] !== 'text').map(c => c.name) };
  }
  tlFirstDoc(C) { return this.memo('tlFD|' + C.key, () => { const n = C.off.length - 1, f = new Uint8Array(n); let last = -1; for (let d = 0; d < n; d++) { const r = this.tlRowOf(C, d); if (r !== last) { f[d] = 1; last = r; } } return f; }); }
  tlRPeriod(T, unit) { const d = 'as.Date(df$`' + T.date + '`, tryFormats = c("%Y-%m-%d", "%d.%m.%y", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y"))'; return unit === 'year' ? 'format(' + d + ', "%Y")' : unit === 'quarter' ? 'paste(format(' + d + ', "%Y"), quarters(' + d + '))' : unit === 'month' ? 'format(' + d + ', "%Y-%m")' : unit === 'week' ? 'format(' + d + ', "%G-W%V")' : 'format(' + d + ', "%Y-%m-%d")'; }
  tlMeasureLab(m, what) { return m === 'count' ? 'times mentioned' : m === 'rate' ? 'mentions per 10,000 words' : m === 'mean' ? 'mean per text' : m === 'sum' ? 'total' : '% of texts that mention ' + (what || 'it'); }
  // R code for a search or dictionary category over time: the dictionary, the hits per text, then per period
  tlTimeRDict(T, TM, its, measure, P, by) {
    const E = this._E, fw = x => T.rec.fold ? 'fold(' + x + ')' : x, isSearch = TM.what === 'search', names = its.map(it => it.name);
    const pats = it => E.tlParsePatterns(it.combined ? T.q : it.name).filter(p => !p.neg).map(p => p.parts.join(' '));
    const L = [];
    if (isSearch) {
      L.push('dict <- dictionary(list(' + its.map(it => '`' + it.name + '` = ' + fw(this.tlRvec(pats(it)))).join(', ') + '))   # your search');
      if ((T.qOff || []).length) L.push('toks_q <- tokens_remove(toks, ' + fw(this.tlRvec(T.qOff)) + ', valuetype = "fixed")   # minus the forms you unticked');
    } else L.push('# dict: the dictionary from the Measure step (its R code is there)');
    L.push('hits <- convert(dfm(tokens_lookup(' + (isSearch && (T.qOff || []).length ? 'toks_q' : 'toks') + ', dict, nested_scope = "key")), to = "data.frame")', 'df$period <- ' + P);
    const cols = names.map(n => '`' + n + '`').join(', ');
    if (measure === 'rate') L.push('agg <- aggregate(cbind(' + cols + ', words) ~ period' + by + ', data = cbind(df, hits[-1], words = ntoken(toks_clean)), FUN = sum)', 'agg[' + this.tlRvec(names) + '] <- 10000 * agg[' + this.tlRvec(names) + '] / agg$words   # mentions per 10,000 words', 'agg');
    else if (measure === 'count') L.push('aggregate(cbind(' + cols + ') ~ period' + by + ', data = cbind(df, hits[-1]), FUN = sum)   # times mentioned');
    else L.push('aggregate(cbind(' + cols + ') ~ period' + by + ', data = cbind(df, 100 * (hits[-1] > 0)), FUN = mean)   # % of texts that mention it');
    return L.join('\n');
  }
  tlTime(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, TM = T.time, set = p => this.tlSetIn('time', p);
    const dateOpts = [['', 'pick a date column']].concat((this.state.cols || []).map(c => c.name).filter(n => n !== T.v).map(n => [n, n]));
    const head = this.tlField('Date column', this.tlSelect(T.date, dateOpts, v => { this._tlDateTouched = true; this.tlSet({ date: v }); }, 'Date column'));
    if (!T.date) return this.tlPanel('Over time', null, null, head, this.tlBanner('info', 'Pick the column with dates (or years).'));
    const D = this.tlDates(T, C);
    if (!D || !D.ok) return this.tlPanel('Over time', null, null, head, this.tlBanner('warn', '“' + T.date + '” does not look like dates.'));
    const unit = this.tlTimeUnit(TM, D), cats = this.tlCats(T), V = this.tlVarOpts(T), fold = !!T.rec.fold;
    const isVar = /^var:/.test(TM.what), vname = isVar ? TM.what.slice(4) : '';
    const whatOpts = [['ntexts', 'Number of texts'], ['search', 'Search: ' + (T.q || '—')]].concat(cats.length > 1 ? [['catall', 'All dictionary categories']] : []).concat(cats.map((c, j) => ['cat' + j, 'Category: ' + c.name])).concat([['len', 'Length of the texts']]).concat(isVar ? [[TM.what, 'Saved variable →']] : []);
    const varOpts = [['', V.made.length ? 'pick a saved variable' : 'none saved yet (Save step)']].concat(V.made.map(n => ['var:' + n, n])).concat(V.other.map(n => ['var:' + n, n + ' · data']));
    // the things to chart: each is a word, a category or a variable with a value per text
    let items = [], measure = TM.measure, ylab, kind = 'count';
    const qLook = keys => this.memo('tlQL1|' + C.key + '|' + keys + '|' + (T.qOff || []).join(',') + '|' + fold, () => E.tlLookup(C, E.tlCompileDict(C, [{ name: 'q', keys, off: new Set(T.qOff || []) }], fold))[0]).counts;
    if (isVar) {
      kind = 'var'; measure = TM.vmeasure; const first = this.tlFirstDoc(C);
      const names = Array.from(new Set([vname].concat((TM.vars || []).filter(n => n !== vname && (V.made.includes(n) || V.other.includes(n))))));
      items = names.map(n => { const vv = this.valsCore(n); return vv && vv.kind === 'num' ? { name: n, x: d => first[d] ? vv.a[this.tlRowOf(C, d)] : NaN } : null; }).filter(Boolean);
      ylab = measure === 'pct' ? '% of texts above 0' : measure === 'sum' ? 'total' : 'mean per text';
    } else if (TM.what === 'ntexts') { kind = 'ntexts'; measure = 'sum'; const first = this.tlFirstDoc(C); items = [{ name: 'Number of texts', x: d => first[d] ? 1 : NaN }]; ylab = 'number of texts'; }
    else if (TM.what === 'words' || TM.what === 'len') { // build .98: how long the texts are, and how that changed
      kind = 'len'; const of = TM.lenOf || 'all', as = TM.lenAs || 'mean'; measure = as; const rawW = of === 'all' ? this.tlRawWords(C) : null;
      items = [{ name: of === 'chars' ? 'characters per text' : of === 'kept' ? 'words per text (after cleaning)' : 'words per text', x: of === 'kept' ? d => FT.foff[d + 1] - FT.foff[d] : of === 'chars' ? d => String(C.texts[d] == null ? '' : C.texts[d]).length : d => rawW[d] }];
      ylab = (as === 'sum' ? 'total ' : as === 'median' ? 'median ' : 'mean ') + (of === 'chars' ? 'characters' : 'words') + (as === 'sum' ? ' per ' + unit : ' per text') + (of === 'kept' ? ' (after cleaning)' : ''); }
    else if (TM.what === 'search') {
      const ps = E.tlParsePatterns(T.q || ''), inc = ps.filter(p => !p.neg), neg = ps.filter(p => p.neg).map(p => p.src).join(', ');
      if (inc.length) { const all = qLook(T.q); items = [{ name: T.q, x: d => all[d], combined: true }].concat(inc.length > 1 ? inc.map(p => { const keys = (p.parts.length > 1 ? '"' + p.parts.join(' ') + '"' : p.src) + (neg ? ', ' + neg : ''), cn = qLook(keys); return { name: p.parts.join(' '), x: d => cn[d] }; }) : []); }
      ylab = this.tlMeasureLab(measure);
    } else {
      const L = this.tlDictLook(ctx);
      if (L) items = (TM.what === 'catall' ? L.cats.map((c, i) => i) : [Number(TM.what.slice(3))]).filter(i => L.res[i]).map(i => ({ name: L.cats[i].name, x: d => L.res[i].counts[d] }));
      ylab = this.tlMeasureLab(measure);
    }
    const combined = items.find(it => it.combined), parts = items.filter(it => !it.combined), many = parts.length > 1;
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null;
    const itemLab = kind === 'var' ? 'variable' : 'word / category', lineOpts = this.tlTimeLayouts(ctx, many, combined, itemLab);   // one series: the Plot by variable alone decides
    const lines = lineOpts.some(o => o[0] === TM.lines) ? TM.lines : lineOpts[0][0];
    // number of texts: as a count, or as the % of all texts (each line's texts spread over the periods)
    const nOpts = [['count', 'Count'], ['share', '% of all texts']];
    const nm = kind === 'ntexts' && nOpts.some(o => o[0] === TM.nmeasure) ? TM.nmeasure : 'count';
    if (kind === 'ntexts' && nm === 'share') ylab = '% of all texts';
    const sig = 'tlTA|' + FT.sig + '|' + T.date + '|' + T.time.order + '|' + unit + '|' + TM.what + (kind === 'len' ? ':' + (TM.lenOf || 'all') : '') + '|' + measure + '|' + lines + '|' + T.by + '|' + T.mergeCase + '|' + this.filterSig() + '|' + (kind === 'var' ? (this._dataRev || 0) + items.map(i => i.name).join(',') : JSON.stringify(this.tlCats(T)) + '|' + (T.q || '') + '|' + (T.qOff || []).join(','));
    const single = combined || parts[0], t1 = !single ? '' : kind === 'ntexts' ? (nm === 'count' ? 'Number of texts per ' + unit : 'Share of all texts in each ' + unit) : kind === 'len' ? ylab[0].toUpperCase() + ylab.slice(1) : single.name + ' · ' + ylab;
    const charts = items.length ? this.tlTimeCharts(ctx, D, unit, { parts, single, lines, measure, ylab, sig, fill: kind === 'ntexts', t1, itemLab }) : [];
    if (kind === 'ntexts' && nm !== 'count') charts.forEach(ch => {
      const S = ch.data.series, xs = ch.data.xs, fin = v => isFinite(v) ? v : 0;
      const series = S.map(se => { const tot = se.pts.reduce((a, v) => a + fin(v), 0); return Object.assign({}, se, { pts: se.pts.map(v => isFinite(v) && tot ? 100 * v / tot : NaN) }); });
      ch.data = { xs, series };
    });
    const ctl = h('div', { className: 'tl-col' }, h('div', { className: 'tl-row wide' }, head,
        this.tlField('Show', this.tlSelect(TM.what, whatOpts, v => set({ what: v }), 'What to show')),
        this.tlField('Or a saved variable', this.tlSelect(isVar ? TM.what : '', varOpts, v => set({ what: v || 'words' }), 'Saved variable')),
        isVar ? this.tlField('As', this.tlSeg([['mean', 'Mean per text'], ['pct', '% of texts above 0'], ['sum', 'Total']], TM.vmeasure, v => set({ vmeasure: v })))
          : TM.what === 'ntexts' ? this.tlField('As', this.tlSeg(nOpts, nm, v => set({ nmeasure: v })))
          : kind === 'len' ? h(React.Fragment, null, this.tlField('Count', this.tlSeg([['all', 'All words'], ['kept', 'Words kept after cleaning'], ['chars', 'Characters']], TM.lenOf || 'all', v => set({ lenOf: v }))), this.tlField('As', this.tlSeg([['mean', 'Mean per text'], ['median', 'Median per text'], ['sum', 'Total per ' + unit]], TM.lenAs || 'mean', v => set({ lenAs: v }))))
          : this.tlField('As', this.tlSeg([['pct', '% of texts'], ['count', 'Count'], ['rate', 'Per 10k words']], TM.measure, v => set({ measure: v })))),
      isVar && V.made.length > 1 ? this.tlField('Compare with other saved variables', h('div', { className: 'tl-row' }, ...V.made.filter(n => n !== vname).map(n => { const on = (TM.vars || []).includes(n); return this.tlChip((on ? '✓ ' : '+ ') + n, on, () => set({ vars: on ? (TM.vars || []).filter(x => x !== n) : (TM.vars || []).concat([n]), lines: on ? TM.lines : (TM.lines === 'auto' || TM.lines === 'author' || TM.lines === 'none' ? (G ? 'item-era' : 'item') : TM.lines) }), { key: n }); }))) : null,
      // search right here (the same search as In context): typing switches Show to it
      h('div', { className: 'tl-row wide' }, this.tlSearchField(T, v => set({ what: v.trim() ? 'search' : (TM.what === 'search' ? 'ntexts' : TM.what) }), 'qt'), this.tlSearchHelp(T)),
      TM.what === 'search' ? this.tlSearchForms(ctx) : null,
      TM.what === 'search' && (T.q || '').trim() && parts.length < 2 ? h('span', { className: 'tl-hint' }, 'Tip: search several words separated by commas (e.g. salud, covid, pandemia) to give each word its own line.') : null,
      h('div', { className: 'tl-row wide' },
        // the group column can be chosen here too (the same setting as Groups to compare in step 1): a line per author, party, outlet …
        this.tlField('Plot by', this.tlSelect(T.by || '', [['', 'none — all texts together']].concat(this.tlGroupCols(T.v).map(n => [n, n])), v => { this._tlByTouched = true; this.tlSet({ by: v }); set({ lines: v ? (many ? 'item-era' : 'author') : (many ? 'item' : 'none') }); }, 'Plot by variable')),
        many && lineOpts.length > 1 ? this.tlField('Layout', this.tlSeg(lineOpts, lines, v => set({ lines: v }))) : null,
        this.tlField('By', this.tlSeg([['auto', 'Auto (' + unit + ')'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day']], TM.unit, v => set({ unit: v })))));
    const P = this.tlRPeriod(T, unit), by = G && this.tlTimeUsesBy(lines) ? ' + `' + T.by + '`' : '';
    const rcode = kind === 'var' ? 'df$period <- ' + P + '\naggregate(cbind(' + items.map(i => '`' + i.name + '`').join(', ') + ') ~ period' + by + ', data = df, FUN = ' + (measure === 'pct' ? 'function(v) 100 * mean(v > 0)' : measure === 'sum' ? 'sum' : 'mean') + ')'
      : kind === 'ntexts' ? 'df$period <- ' + P + '\n' + (nm === 'count' ? 'table(df$period' + (by ? ', df$`' + T.by + '`' : '') + ')        # number of texts per period' + (by ? ' and ' + T.by : '')
        : '100 * prop.table(table(df$period' + (by ? ', df$`' + T.by + '`), margin = 2)   # % of each ' + T.by + '’s texts in each period' : '))   # % of all texts in each period'))
      : kind === 'len' ? 'df$len <- ' + ((TM.lenOf || 'all') === 'chars' ? 'nchar(df$`' + T.v + '`)' : (TM.lenOf || 'all') === 'kept' ? 'ntoken(toks_clean)' : 'ntoken(toks)') + '   # ' + items[0].name + '\ndf$period <- ' + P + '\naggregate(len ~ period' + by + ', data = df, FUN = ' + (TM.lenAs || 'mean') + ')'
      : this.tlTimeRDict(T, TM, parts.length ? parts : items, measure, P, by);
    const need = !items.length;
    return this.tlPanel('Over time', 'by ' + unit + (G ? ' · ' + T.by : ''), null, ctl,
      D.ambiguous ? this.tlBanner('info', 'Dates like 02.03.18 are read as ' + (D.order === 'dmy' ? 'day.month.year' : 'month.day.year') + '. ', this.tlBtn('Switch', () => set({ order: D.order === 'dmy' ? 'mdy' : 'dmy' }))) : null,
      need ? this.tlBanner('info', isVar ? '“' + vname + '” is not a numeric variable.' : 'Type a search in the Search box above (several words separated by commas give one line each), build dictionary categories in Measure, or pick a saved variable to chart it over time.') : null,
      ...charts.map(ch => h('div', { key: ch.key, className: 'tl-col' }, this.tlLinesSvg(ch.key, ch.data.xs, ch.data.series, { ylab, pct: measure === 'pct' || (kind === 'ntexts' && nm !== 'count'), title: ch.title, eras: ch.eras }), this.tlExportRow(ch.key, 'over-time-' + this._E.tlVarName(ch.title.split(' · ')[0])))),
      need ? null : this.tlRcode(rcode));
  }

  // connections: fcm + textplot_network
  tlNetwork(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, NW = T.net, set = p => this.tlSetIn('net', p), E = this._E;
    const q = (T.q || '').trim(), view = T.wview === 'tag' ? 'tag' : 'word', win = NW.context === 'window' ? 5 : 0;
    // with a search: the words found together with it, the matched forms (minus the unticked ones) joined into one node
    let seeds = [];
    if (q) seeds = this.memo('tlNetSeed|' + FT.sig + '|' + q + '|' + (T.qOff || []).join(',') + '|' + T.rec.fold, () => {
      const K = E.tlCompileDict(C, [{ name: 'q', keys: q, off: new Set(T.qOff || []) }], !!T.rec.fold)[0], fs = new Set();
      for (let t = 0; t < C.types.length; t++) if (K.singles[t]) { const f = FT.fid[t]; if (f >= 0 && FT.count[f] > 0) fs.add(f); }
      return [...fs];
    });
    const focus = q && seeds.length > 0;
    let feats, M, labelOf, sizeOf, hub = -1, near = null;
    const cmaxAll = Math.max(1, ...this.tlTop(ctx, view, NW.n, cnt).map(w => cnt.count[w.f]));
    if (focus) {
      // the words most over-represented with the search (keyness, chi2), not merely the most frequent ones:
      // long texts contain every common word, so raw co-occurrence would put "entonces", "va" … first
      const key = this.memo('tlNetKey|' + FT.sig + '|' + seeds.join(',') + '|' + win, () => { const nr = E.tlFcmNear(FT, seeds, { window: win }); return Object.assign(E.tlKeyness(nr.tc, nr.rc, { minCount: 10 }), { tc: nr.tc, nIn: nr.nIn, nAll: nr.nAll }); });
      const cand = key.rows.filter(r => r.stat > 0 && r.a >= 5 && this.tlKindOk(FT.kind[r.f], view === 'tag' ? 'tag' : 'word'));
      near = { rows: cand.slice(0, Math.max(4, NW.n - 1)), tc: key.tc, share: key.nAll ? key.nIn / key.nAll : 0 };
      feats = [-1].concat(near.rows.map(r => r.f)); hub = 0;
      M = this.memo('tlNetF|' + FT.sig + '|' + feats.join(',') + '|' + seeds.join(',') + '|' + win, () => { const node = new Int32Array(FT.count.length).fill(-1); seeds.forEach(f => { node[f] = 0; }); feats.forEach((f, i) => { if (i) node[f] = i; }); return E.tlFcmNodes(FT, node, feats.length, { window: win }); });
      const hubCount = seeds.reduce((a, f) => a + cnt.count[f], 0);
      labelOf = i => i === 0 ? q : FT.label[feats[i]]; sizeOf = i => i === 0 ? 1 : Math.min(1, cnt.count[feats[i]] / Math.max(1, hubCount, cmaxAll));
    } else {
      feats = this.tlTop(ctx, view, NW.n, cnt).map(w => w.f);
      M = this.memo('tlNet|' + FT.sig + '|' + NW.n + '|' + NW.context + '|' + T.wview, () => E.tlFcm(FT, feats, { window: win }));
      labelOf = i => FT.label[feats[i]]; sizeOf = i => cnt.count[feats[i]] / cmaxAll;
    }
    const n = feats.length, edges = []; let mx = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const w = M[i * n + j]; if (w > 0) edges.push([i, j, w]); if (w > mx) mx = w; }
    edges.sort((a, b) => b[2] - a[2]);
    // with a search every word keeps its link to the searched word; the other links are thinned as usual
    const hubE = focus ? edges.filter(e => e[0] === hub || e[1] === hub) : [], rest = focus ? edges.filter(e => e[0] !== hub && e[1] !== hub) : edges;
    const keepN = Math.max(n, Math.round(rest.length * (1 - NW.minFreq)));
    const kept = hubE.concat(rest.slice(0, Math.min(keepN, 3 * n))).map(([i, j, w]) => [i, j, w / mx]);
    // with a search the layout is a star: each word is pulled toward the search by its keyness rank (strongest
    // closest), so the very common words do not pile up in one knot; the links between the words are still drawn
    const layE = focus ? feats.slice(1).map((f, k) => [0, k + 1, 1 - 0.8 * k / Math.max(1, n - 2)]) : kept;
    const W = 760, H = 480, lay = this.memo('tlNetL|' + FT.sig + '|' + feats.join(',') + '|' + NW.context + '|' + kept.length + '|' + (focus ? q : ''), () => E.tlForceLayout(n, layE, 11, W, H));
    const svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': focus ? 'Words found together with ' + q : 'Word co-occurrence network', ref: this.svgRef('tlnet'), className: 'tl-svg' },
      h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      // with a search: links to it in blue and on top, the links between the other words faint behind them
      kept.filter(e => !focus || (e[0] !== hub && e[1] !== hub)).map(([i, j, w], k) => h('line', { key: 'e' + k, x1: lay.x[i], y1: lay.y[i], x2: lay.x[j], y2: lay.y[j], stroke: '#2E7D58', strokeOpacity: focus ? 0.06 + 0.25 * w : 0.15 + 0.6 * w, strokeWidth: focus ? 0.5 + 1.5 * w : 0.6 + 4 * w })),
      focus ? (() => { const hw = Math.max(1e-9, ...kept.filter(e => e[0] === hub || e[1] === hub).map(e => e[2])); return kept.filter(e => e[0] === hub || e[1] === hub).map(([i, j, w], k) => h('line', { key: 'h' + k, x1: lay.x[i], y1: lay.y[i], x2: lay.x[j], y2: lay.y[j], stroke: '#1A5061', strokeOpacity: 0.3 + 0.5 * w / hw, strokeWidth: 1 + 4 * w / hw })); })() : null,
      feats.map((f, i) => i).sort((a, b) => (a === hub) - (b === hub)).map(i => { const z = Math.sqrt(Math.max(0, sizeOf(i))), r = i === hub ? 14 : 3 + 9 * z; return h('g', { key: 'n' + i }, h('circle', { cx: lay.x[i], cy: lay.y[i], r, fill: i === hub ? '#1A5061' : '#C4681E', fillOpacity: i === hub ? 1 : 0.85 }), h('text', { x: lay.x[i], y: lay.y[i] - r - 3, textAnchor: 'middle', fontSize: i === hub ? 16 : 11 + 5 * z, fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: i === hub ? 700 : 600, fill: i === hub ? '#1A5061' : '#1A1711', stroke: '#FFFFFF', strokeWidth: 3, strokeLinejoin: 'round', paintOrder: 'stroke' }, labelOf(i))); }));
    const top = focus ? near.rows.slice(0, 8) : [];
    const note = focus ? (n < 2 ? this.tlBanner('warn', 'No word stands out ' + (win ? 'within 5 words of' : 'in the texts that use') + ' “' + q + '” yet (it needs to be used more often). Try Same text, or a broader search.')
      : this.tlBanner('ok', h('b', null, q), ' (' + this.fmtN(seeds.length) + ' word form' + (seeds.length === 1 ? '' : 's') + ', one node) with the ' + (n - 1) + ' words that stand out most ' + (win ? 'within 5 words of it' : 'in the texts that use it') + ' — used more there than elsewhere (keyness, χ²). Strongest: ' + top.map(t => FT.label[t.f] + ' (' + this.fmtN(t.a) + '×)').join(', ') + '. Clear the search to see the whole network.'
        + (!win && near.share > 0.5 ? ' Note: ' + q + ' is in ' + this.tlPct(near.share) + ' of the texts, so “Same text” mostly compares long texts with short ones — choose “Within 5 words” for the words used right next to it.' : '')))
      : q ? this.tlBanner('warn', '“' + q + '” is not among the cleaned words (it may be a stopword, a phrase that is not joined, or all its forms are unticked), so the whole network is shown.') : null;
    // in R: every feature the search's words match (folded like the recipe when accents are ignored), minus the unticked forms
    const fw = x => T.rec.fold ? 'fold(' + x + ')' : x, pats = focus ? E.tlParsePatterns(q).filter(p => !p.neg && p.parts.length === 1).map(p => p.parts[0]) : [];
    // keep only the chosen words before fcm(): an fcm of the whole vocabulary can run out of memory on long texts
    const fcmR = sel => win ? 'fcmat <- fcm(tokens_select(toks_clean, ' + sel + ', valuetype = "fixed", padding = TRUE), context = "window", window = 5) |> fcm_remove("")' : 'fcmat <- fcm(dfm_select(dfmat, ' + sel + ', valuetype = "fixed"))';
    const kwR = focus ? fw(this.tlRvec(pats)) + '))   # every form your search matches' + ((T.qOff || []).length ? '\nkw <- setdiff(kw, ' + fw(this.tlRvec(T.qOff)) + ')   # minus the forms you unticked' : '') : '';
    return this.tlPanel('Connections', focus ? 'the words found together with your search (fcm + textplot_network)' : 'which words appear together (fcm + textplot_network)', null,
      h('div', { className: 'tl-row wide' }, this.tlSearchField(T, null, 'qn'), this.tlSearchHelp(T)),
      q ? this.tlSearchForms(ctx) : h('span', { className: 'tl-hint' }, 'Search a word (e.g. corrup*) to see only the words that appear together with it.'),
      h('div', { className: 'tl-row wide' }, this.tlField('Words', this.tlNum(NW.n, v => set({ n: v }), { min: 5, max: 120, aria: 'Number of words' })), this.tlField('Together means', this.tlSeg([['doc', 'Same text'], ['window', 'Within 5 words']], NW.context, v => set({ context: v }))), this.tlField('Show links', this.tlSeg([[0.5, 'Strongest half'], [0.8, 'Top 20%'], [0, 'All']], NW.minFreq, v => set({ minFreq: v })))),
      note, svg, this.tlExportRow('tlnet', focus ? 'word-network-' + this._E.tlVarName(q) : 'word-network'),
      this.tlRcode(focus
        ? 'kw <- featnames(dfm_select(dfmat, pattern = ' + kwR + '\n' + (win
            ? 'near_in  <- dfm(tokens_remove(tokens_keep(toks_clean, pattern = kw, window = 5), pattern = kw))\nnear_out <- dfm(tokens_remove(toks_clean, pattern = kw, window = 5))\nkey <- textstat_keyness(rbind(near_in, near_out), target = seq_len(ndoc(near_in)))\n'
            : 'has <- rowSums(dfm_select(dfmat, pattern = kw)) > 0   # texts that use the search\nkey <- textstat_keyness(dfm_remove(dfmat, pattern = kw), target = has)\n')
          + 'near <- head(key$feature[key$chi2 > 0 & key$n_target >= 5 & key$n_target + key$n_reference >= 10], ' + (n - 1) + ')\n' + fcmR('c(kw, near)') + '\ntextplot_network(fcmat, min_freq = ' + (NW.minFreq || 0.5) + ')   # in R each form of the search is its own node'
        : 'feat <- names(topfeatures(dfmat, ' + NW.n + '))\n' + fcmR('feat') + '\ntextplot_network(fcmat, min_freq = ' + (NW.minFreq || 0.5) + ')'));
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
      this.tlRcode((CU.what === 'groups' ? (CU.byYear && T.date ? 'grp <- interaction(df$`' + T.by + '`, ' + this.tlRPeriod(T, 'year') + ', sep = " ", drop = TRUE)   # ' + T.by + ' × year\n' : '') + 'dfmat_g <- dfm_group(dfmat, groups = ' + (CU.byYear && T.date ? 'grp)' : '`' + T.by + '`)') + '\ndfmat_g <- dfm_subset(dfmat_g, ntoken(dfmat_g) >= 200)   # groups with 200+ words, as on the page\ndfmat_g <- dfm_select(dfmat_g, names(topfeatures(dfmat, ' + topF.length + ')))' : CU.what === 'texts' ? 'keep <- which(ntoken(dfmat) >= 5)   # texts with 5+ words, an even sample of them as on the page\npick <- head(keep[seq(1, length(keep), by = max(1, length(keep) %/% ' + labels.length + '))], ' + labels.length + ')\ndfmat_g <- dfm_select(dfmat[pick, ], names(topfeatures(dfmat, ' + topF.length + ')))\ndfmat_g <- dfm_subset(dfmat_g, ntoken(dfmat_g) > 0)'
        : 'fc <- as.matrix(fcm(dfm_weight(dfm_select(dfmat, names(topfeatures(dfmat, ' + topF.length + '))), scheme = "boolean"), tri = FALSE)); diag(fc) <- 0   # texts where two words meet\ndfmat_g <- as.dfm(fc)') + '\n' + (CU.weight === 'prop' ? 'dfmat_g <- dfm_weight(dfmat_g, scheme = "prop")\n' : CU.weight === 'tfidf' ? 'dfmat_g <- dfm_tfidf(dfmat_g)\n' : '') + (['cosine', 'correlation', 'jaccard'].includes(dist) ? 'd <- as.dist(1 - as.matrix(textstat_simil(dfmat_g, method = "' + dist + '")))' : 'd <- as.dist(as.matrix(textstat_dist(dfmat_g, method = "' + dist + '")))') + '\nhc <- hclust(d, method = "' + CU.link + '")\nk <- min(' + k + ', ndoc(dfmat_g) - 1)   # fewer clusters than items\nplot(hc); if (k >= 2) rect.hclust(hc, k = k)\ncor(d, cophenetic(hc))   # ' + (isFinite(H.coph) ? H.coph.toFixed(3) : '') + '\ncutree(hc, k = k)')));
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
        this.tlRcode('textstat_summary(corp)\ntextstat_lexdiv(tokens_subset(toks, ntoken(toks) >= 50), measure = "MATTR", MATTR_window = 50)   # texts of 50+ words; needs a lot of memory on long texts\ntextstat_readability(corp, measure = "Flesch")')));
  }
