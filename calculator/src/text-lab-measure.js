  // ---- step 4: measure
  tlStepMeasure(ctx) {
    const h = React.createElement, T = ctx.T;
    const subs = [['dict', 'Dictionary'], ['sentiment', 'Sentiment'], ['topics', 'Topics'], ['classify', 'Classify'], ['scale', 'Scale']];
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist' }, subs.map(([k, l]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': T.msub === k ? 'true' : 'false', className: T.msub === k ? 'on' : '', onClick: () => this.tlSet({ msub: k }) }, l)));
    const body = T.msub === 'sentiment' ? this.tlSentiment(ctx) : T.msub === 'topics' ? this.tlTopics(ctx) : T.msub === 'classify' ? this.tlClassify(ctx) : T.msub === 'scale' ? this.tlScale(ctx) : this.tlDictionary(ctx);
    return h('div', { className: 'tl-col' }, tabs, body, this.tlNav(['explore', 'Explore'], ['save', 'Next: Save']));
  }
  tlCats(T) { return (T.dict || []).map((c, i) => ({ i, name: (c.name || '').trim() || 'category' + (i + 1), keys: c.keys || '', off: c.off || [] })).filter(c => c.keys.trim()); }
  tlDictLook(ctx) {
    const { T, C } = ctx, E = this._E, cats = this.tlCats(T); if (!cats.length) return null;
    const sig = JSON.stringify(cats) + '|' + T.rec.fold;
    return this.memo('tlDL|' + C.key + '|' + sig, () => { const comp = E.tlCompileDict(C, cats.map(c => ({ name: c.name, keys: c.keys, off: new Set(c.off) })), !!T.rec.fold); return { cats, comp, res: E.tlLookup(C, comp) }; });
  }
  tlWordCats(ctx) {
    const { C, FT } = ctx, L = this.tlDictLook(ctx); if (!L) return {};
    return this.memo('tlWC|' + FT.sig + '|' + JSON.stringify(L.cats), () => { const m = {}; L.comp.forEach((K, ci) => { for (let t = 0; t < C.types.length; t++) if (K.singles[t]) { const f = FT.fid[t]; if (f >= 0 && m[f] == null) m[f] = ci; } }); return m; });
  }
  tlSetCat(i, patch) { this.tlSet(cur => { const d = (cur.dict || []).slice(); while (d.length <= i) d.push({ name: '', keys: '', off: [] }); d[i] = Object.assign({}, d[i], patch); return { dict: d }; }); }
  tlDictionary(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, dict = T.dict && T.dict.length ? T.dict : [{ name: '', keys: '', off: [] }];
    const L = this.tlDictLook(ctx), mask = ctx.mask, fold = !!T.rec.fold;
    const names = dict.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean), dup = names.filter((n, i) => names.indexOf(n) !== i);
    const rows = dict.map((c, i) => {
      const li = L ? L.cats.findIndex(x => x.i === i) : -1, r = li >= 0 ? L.res[li] : null;
      const allForms = li >= 0 ? this.memo('tlDF|' + C.key + '|' + c.keys + '|' + fold, () => [...E.tlLookup(C, E.tlCompileDict(C, [{ name: 'x', keys: c.keys }], fold))[0].forms.entries()].sort((a, b) => b[1] - a[1])) : [];
      const offSet = new Set(c.off || []), open = (T.dictOpen || {})[i];
      const pats = E.tlParsePatterns(c.keys), wild = pats.some(p => /[*?]/.test(p.src));
      const shown = open ? allForms : allForms.slice(0, 10);
      return h('div', { key: i, className: 'tl-cat' + (dup.includes((c.name || '').trim().toLowerCase()) ? ' bad' : '') },
        h('div', { className: 'tl-cat-h' },
          this.tlText(c.name || '', v => this.tlSetCat(i, { name: v }), { placeholder: i === 0 ? 'e.g. economía' : 'category name', aria: 'Category name', width: 150, k: 'cn' + i }),
          h('span', { className: 'tl-eq' }, '='),
          this.tlText(c.keys || '', v => this.tlSetCat(i, { keys: v, off: [] }), { placeholder: i === 0 ? 'econom*, empleo*, salario*, inversion*' : 'keywords, separated by commas', aria: 'Keywords', flex: '1 1 320px', mono: true, k: 'ck' + i }),
          r ? h('span', { className: 'tl-hint' }, allForms.length + ' word' + (allForms.length === 1 ? '' : 's') + ' matched') : null,
          h('button', { type: 'button', className: 'tl-x', 'aria-label': 'Remove category', title: 'Remove category', onClick: () => this.tlSet(cur => ({ dict: (cur.dict || []).filter((_, j) => j !== i) })) }, '×')),
        allForms.length ? h('div', { className: 'tl-forms' }, ...shown.map(([w, n]) => { const isOff = offSet.has(w) || offSet.has(E.tlFold(w)); return h('label', { key: w, className: 'tl-form' + (isOff ? ' off' : '') }, h('input', { type: 'checkbox', checked: !isOff, onChange: () => this.tlSetCat(i, { off: isOff ? [...offSet].filter(x => x !== w && x !== E.tlFold(w)) : [...offSet, w] }) }), w, h('em', null, ' ' + this.fmtN(n))); }),
          allForms.length > 10 ? h('button', { type: 'button', className: 'tl-link', onClick: () => this.tlSet({ dictOpen: Object.assign({}, T.dictOpen, { [i]: !open }) }) }, open ? 'show fewer' : '+ ' + (allForms.length - 10) + ' more') : null) : (c.keys.trim() ? h('span', { className: 'tl-hint' }, 'No text matches these keywords.') : null),
        wild && offSet.size ? h('span', { className: 'tl-hint' }, 'Unticked words are saved as exclusions and never count for this category.') : null);
    });
    const help = this.tlBanner('info', h('b', null, 'How to write keywords: '), h('code', null, 'terror*'), ' = terror, terrorismo, terrorista… · ', h('code', null, '*corrup*'), ' = also anticorrupción · ', h('code', null, '?'), ' = one letter · ', h('code', null, '"guardia nacional"'), ' = phrase · ', h('code', null, '-seguro'), ' = never count · ', h('code', null, '#covid19'), ' = hashtag only · capitals ignored · accents ' + (fold ? 'ignored, ñ kept' : 'respected (turn on “Ignore accents” in Clean)'));
    const io = h('div', { className: 'tl-row' },
      this.tlBtn('+ Add a category', () => this.tlSet(cur => ({ dict: (cur.dict && cur.dict.length ? cur.dict : [{ name: '', keys: '', off: [] }]).concat([{ name: '', keys: '', off: [] }]) }))),
      h('label', { className: 'tl-btn' }, 'Import dictionary', h('input', { type: 'file', accept: '.yml,.yaml,.dic,.txt,.lc3,.cat', style: { display: 'none' }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) f.text().then(t => this.tlImportDict(t, f.name)); e.target.value = ''; } })),
      this.tlBtn('Save as YAML', () => this.dlBlob(new Blob([this.tlDictYaml(T)], { type: 'text/yaml' }), 'dictionary.yml')),
      h('span', { className: 'tl-hint' }, 'Reads LIWC (.dic), quanteda/YAML, Lexicoder (.lc3) and “name: word, word” text files.'));
    let results = null;
    if (L) {
      const st = L.res.map(r => { let m = 0, d = 0, n = 0; for (let k = 0; k < r.counts.length; k++) { if (mask && !mask[k]) continue; const v = r.counts[k]; if (!isFinite(v)) continue; n++; m += v; if (v > 0) d++; } return { m, d, n }; });
      const exact = fold ? this.memo('tlDLx|' + C.key + '|' + JSON.stringify(L.cats), () => E.tlLookup(C, E.tlCompileDict(C, L.cats.map(c => ({ name: c.name, keys: c.keys, off: new Set(c.off) })), false))) : null;
      const ex = exact ? exact.map(r => { let d = 0; for (let k = 0; k < r.counts.length; k++) { if (mask && !mask[k]) continue; if (r.counts[k] > 0) d++; } return d; }) : null;
      const gain = ex ? st.map((s, i) => s.d - ex[i]) : null;
      const tbl = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { className: 'n' }, 'Mentions'), h('th', { className: 'n' }, 'Texts ≥ 1'), h('th', { className: 'n' }, '% texts'), h('th', { className: 'n' }, 'Mean per text'), ex ? h('th', { className: 'n', title: 'Texts found if accents had to match exactly' }, 'Exact accents') : null)),
        h('tbody', null, L.cats.map((c, i) => h('tr', { key: i }, h('td', { className: 'w' }, c.name), h('td', { className: 'n' }, this.fmtN(st[i].m)), h('td', { className: 'n' }, this.fmtN(st[i].d)), h('td', { className: 'n' }, this.tlPct(st[i].d / Math.max(1, st[i].n))), h('td', { className: 'n' }, this.fmt(st[i].m / Math.max(1, st[i].n), 3)), ex ? h('td', { className: 'n' + (gain[i] ? ' warn' : '') }, this.fmtN(ex[i])) : null)))));
      const gainTxt = gain && gain.some(x => x > 0) ? this.tlBanner('ok', 'Ignoring accents finds ' + L.cats.map((c, i) => gain[i] > 0 ? this.fmtN(gain[i]) + ' more ' + c.name + ' texts (+' + Math.round(100 * gain[i] / Math.max(1, ex[i])) + '%)' : null).filter(Boolean).join(', ') + '.') : null;
      // by group
      let byG = null; const G = T.by ? this.tlGroupsOf(T, C, T.by) : null;
      if (G) {
        const groups = G.labels.map((l, i) => i).sort((a, b) => G.count[b] - G.count[a]).slice(0, 15);
        const cell = (gi, ci) => { let n = 0, d = 0; const a = L.res[ci].counts; for (let k = 0; k < a.length; k++) { if (G.g[k] !== gi || (mask && !mask[k]) || !isFinite(a[k])) continue; n++; if (a[k] > 0) d++; } return n ? d / n : NaN; };
        byG = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, T.by), ...L.cats.map((c, i) => h('th', { key: i, className: 'n' }, c.name)))), h('tbody', null, groups.map(g => h('tr', { key: g }, h('td', { className: 'w' }, G.labels[g]), ...L.cats.map((c, ci) => { const v = cell(g, ci); return h('td', { key: ci, className: 'n' }, h('span', { className: 'tl-heat', style: { '--v': isFinite(v) ? Math.min(1, v * 4) : 0 } }, this.tlPct(v))); }))))));
      }
      // correlations
      let corr = null;
      if (L.cats.length >= 2) {
        const cm = this.memo('tlDC|' + C.key + '|' + JSON.stringify(L.cats) + '|' + this.filterSig(), () => { const arrs = L.res.map(r => mask ? Float64Array.from(r.counts, (v, k) => mask[k] ? v : NaN) : r.counts); return this._E.corrMatrix(arrs, null); });
        corr = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'r'), ...L.cats.map((c, i) => h('th', { key: i, className: 'n' }, c.name)))), h('tbody', null, L.cats.map((c, i) => h('tr', { key: i }, h('td', { className: 'w' }, c.name), ...L.cats.map((d, j) => h('td', { key: j, className: 'n' + (j < i && cm[i][j].p < 0.05 ? ' sig' : '') }, j < i ? this.fmt(cm[i][j].r, 3) : j === i ? '1' : '')))))));
      }
      const prec = this.tlPrecision(ctx, L);
      const top = st.map((s, i) => [i, s.d]).sort((a, b) => b[1] - a[1])[0];
      results = this.tlPanel('Results', this.fmtN(st[0].n) + ' texts' + (mask ? ' in the subgroup' : ''), null, tbl, gainTxt,
        this.tlBanner('ok', h('b', null, 'What this means: '), 'the most common category is ' + L.cats[top[0]].name + ', found in ' + this.tlPct(top[1] / Math.max(1, st[top[0]].n)) + ' of texts (' + this.fmtN(st[top[0]].m) + ' mentions). A dictionary finds only the words you list — check the matched words above and a random sample below.'),
        byG ? h('span', { className: 'tl-lbl' }, '% of texts with each category, by ' + T.by) : null, byG,
        corr ? h('span', { className: 'tl-lbl' }, 'Correlations between category counts (Pearson r; orange = p < .05)') : null, corr,
        prec,
        h('div', { className: 'tl-row' }, this.tlBtn('Chart over time', () => this.tlSet({ step: 'explore', sub: 'time', time: Object.assign({}, T.time, { what: 'cat0' }) })), this.tlBtn('Colour the word cloud by category', () => { this.tlSetIn('cloud', { colorBy: 'category' }); this.tlSet({ step: 'explore', sub: 'words' }); }), this.tlBtn('Add as variables →', () => this.tlSet({ step: 'save' }), 'green')),
        this.tlRcode(this.tlDictR(ctx, L)));
    }
    return h('div', { className: 'tl-grid c-dict' }, this.tlPanel('Dictionary', 'group keywords into categories and count them (tokens_lookup)', null, help, dup.length ? this.tlBanner('warn', 'Two categories are both called “' + dup[0] + '”. Rename one: each category becomes its own variable.') : null, ...rows, io), results || this.tlPanel('Results', null, null, this.tlBanner('info', 'Write keywords in a category to see how often they appear.')));
  }
  tlPrecision(ctx, L) {
    const h = React.createElement, { T, C } = ctx, E = this._E, ci = Math.min(L.cats.length - 1, T.precCat || 0), PR = (T.prec || {})[L.cats[ci].name] || {};
    const K = this.memo('tlPS|' + C.key + '|' + JSON.stringify(L.cats[ci]) + '|' + T.rec.fold, () => E.tlKwic(C, C.texts, [L.comp[ci]], { window: 8, limit: 100000 }));
    const rnd = (() => { let s = (T.precSeed || 7) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const idx = K.rows.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const sample = idx.slice(0, 20).map(i => [i, K.rows[i]]);
    const right = Object.values(PR).filter(v => v === 1).length, wrong = Object.values(PR).filter(v => v === 0).length;
    const mark = (i, v) => this.tlSet(cur => { const p = Object.assign({}, cur.prec || {}); p[L.cats[ci].name] = Object.assign({}, p[L.cats[ci].name] || {}, { [i]: v }); return { prec: p }; });
    return h('details', { className: 'tl-details' }, h('summary', null, 'Check accuracy: read 20 random matches' + (right + wrong ? ' · precision ' + this.tlPct(right / (right + wrong), 0) + ' (' + right + ' of ' + (right + wrong) + ' right)' : '')),
      h('div', { className: 'tl-row' }, this.tlSelect(String(ci), L.cats.map((c, i) => [String(i), c.name]), v => this.tlSet({ precCat: Number(v) }), 'Category to check'), this.tlBtn('New sample', () => this.tlSet({ precSeed: (T.precSeed || 7) + 1 }))),
      h('table', { className: 'tl-kwic' }, h('tbody', null, sample.map(([i, r]) => h('tr', { key: i }, h('td', { className: 'meta' }, 'row ' + (this.tlRowOf(C, r.doc) + 1)), h('td', { className: 'pre' }, r.pre), h('td', { className: 'kw' }, r.kw), h('td', { className: 'post' }, r.post), h('td', { className: 'mark' }, this.tlChip('✓', PR[i] === 1, () => mark(i, 1), { title: 'Right' }), this.tlChip('✗', PR[i] === 0, () => mark(i, 0), { title: 'Wrong' })))))));
  }
  tlImportDict(text, name) {
    const cats = []; const add = (n, words) => { const w = words.map(s => s.trim()).filter(Boolean); if (n && w.length) cats.push({ name: n.trim(), keys: w.map(x => /\s/.test(x) ? '"' + x + '"' : x).join(', '), off: [] }); };
    if (/\.dic$/i.test(name) && /^\s*%/.test(text)) {
      const parts = text.split(/^\s*%\s*$/m), head = parts[1] || '', body = parts[2] || '', ids = {};
      head.split(/\n/).forEach(l => { const m = l.trim().split(/\s+/); if (m.length >= 2) ids[m[0]] = m.slice(1).join(' '); });
      const by = {}; body.split(/\n/).forEach(l => { const m = l.trim().split(/\t+|\s{2,}|\s+(?=\d+(\s|$))/); if (m.length < 2) return; const w = m[0]; m.slice(1).forEach(id => { id = id.trim(); if (ids[id]) (by[ids[id]] = by[ids[id]] || []).push(w); }); });
      Object.keys(by).forEach(k => add(k, by[k]));
    } else if (/\.lc3$/i.test(name) || /^\+/m.test(text)) {
      let cur = null; const by = {}; text.split(/\n/).forEach(l => { const s = l.trim(); if (!s) return; if (s[0] === '+') { cur = s.slice(1).trim(); by[cur] = []; } else if (cur) by[cur].push(s.replace(/\s+\d+$/, '')); }); Object.keys(by).forEach(k => add(k, by[k]));
    } else if (/^\s*[^:\n]+:\s*$/m.test(text) && /^\s+-\s/m.test(text)) {
      const stack = [], by = {}; text.split(/\n/).forEach(l => { if (!l.trim() || /^\s*#/.test(l)) return; const ind = l.match(/^\s*/)[0].length, s = l.trim(); if (/^-\s/.test(s)) { const key = stack.map(x => x.k).join('/'); (by[key] = by[key] || []).push(s.slice(2).replace(/^["']|["']$/g, '')); } else if (/:\s*$/.test(s)) { while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop(); stack.push({ ind, k: s.replace(/:\s*$/, '').replace(/^["']|["']$/g, '') }); } else if (/:\s*\[/.test(s)) { const m = s.match(/^([^:]+):\s*\[(.*)\]/); if (m) by[m[1]] = m[2].split(','); } });
      Object.keys(by).forEach(k => add(k, by[k]));
    } else text.split(/\n/).forEach(l => { const m = l.match(/^\s*([^:=]+)[:=](.+)$/); if (m) add(m[1], m[2].split(/[,;]/)); });
    if (!cats.length) { this.flash('No categories found in ' + name); return; }
    this.tlSet(cur => ({ dict: (cur.dict || []).filter(c => c.keys && c.keys.trim()).concat(cats) }));
    this.flash('Imported ' + cats.length + ' categories from ' + name);
  }
  tlDictYaml(T) { return this.tlCats(T).map(c => { const E = this._E, ps = E.tlParsePatterns(c.keys).filter(p => !p.neg).map(p => p.parts.join(' ')); return c.name + ':\n' + ps.map(p => '  - ' + (/[:#\s]/.test(p) ? '"' + p + '"' : p)).join('\n'); }).join('\n') + '\n'; }

  // sentiment: polarity from two dictionary categories (quanteda.sentiment), or a valence list
  tlSentiment(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, SN = T.sent, set = p => this.tlSetIn('sent', p);
    const L = this.tlDictLook(ctx), cats = L ? L.cats.map(c => c.name) : [];
    const opts = [['', '—']].concat(cats.map(c => [c, c]));
    const pi = cats.indexOf(SN.pos), ni = cats.indexOf(SN.neg);
    const ctl = h('div', { className: 'tl-row wide' }, this.tlField('Positive category', this.tlSelect(SN.pos, opts, v => set({ pos: v }), 'Positive category')), this.tlField('Negative category', this.tlSelect(SN.neg, opts, v => set({ neg: v }), 'Negative category')));
    const help = this.tlBanner('info', 'Sentiment here means: does a text use more words from your positive list or from your negative list? Build the two lists in Dictionary (or import a sentiment dictionary such as a LIWC or Lexicoder file). Score = log((positive + 0.5) / (negative + 0.5)), as quanteda.sentiment’s textstat_polarity(); 0 = balanced.');
    const val = h('details', { className: 'tl-details' }, h('summary', null, 'Or use word scores (textstat_valence)'), h('span', { className: 'tl-hint' }, 'One word per line with a score, e.g. “excelente = 3”, “corrupción = -2”. Wildcards work.'), h('textarea', { className: 'tl-input', rows: 5, defaultValue: SN.valence, key: 'val' + SN.valence.length, onBlur: e => set({ valence: e.target.value }), 'aria-label': 'Word scores', style: { width: '100%', fontFamily: 'var(--fMono, monospace)' } }));
    let out = null;
    const score = this.tlSentScores(ctx);
    if (score) {
      const G = T.by ? this.tlGroupsOf(T, C, T.by) : null, mask = ctx.mask, groups = G ? G.labels.map((l, i) => i).sort((a, b) => G.count[b] - G.count[a]).slice(0, 15) : [null];
      const agg = groups.map(g => { let n = 0, s = 0, pos = 0, neg = 0; for (let d = 0; d < score.v.length; d++) { if ((G && G.g[d] !== g) || (mask && !mask[d]) || !isFinite(score.v[d])) continue; n++; s += score.v[d]; if (score.v[d] > 0) pos++; else if (score.v[d] < 0) neg++; } return { n, mean: s / n, pos, neg }; });
      const bars = this.tlBarsSvg('tlsent', groups.map((g, i) => ({ label: G ? G.labels[g] : 'All texts', value: agg[i].mean, note: this.tlPct(agg[i].pos / Math.max(1, agg[i].n), 0) + ' positive · ' + this.tlPct(agg[i].neg / Math.max(1, agg[i].n), 0) + ' negative', color: agg[i].mean >= 0 ? '#2E7D58' : '#A3540F' })), { title: 'Mean ' + score.name + ' per text' + (G ? ' by ' + T.by : ''), xlab: score.name, diverging: true });
      out = this.tlPanel('Results', null, null, bars, this.tlExportRow('tlsent', 'sentiment'), h('div', { className: 'tl-row' }, this.tlBtn('Save the score as a variable →', () => { this.tlSetIn('save', { sent: true }); this.tlSet({ step: 'save' }); }, 'green')), this.tlRcode(score.r));
    }
    return h('div', { className: 'tl-col' }, this.tlPanel('Sentiment', 'polarity from your own word lists', null, help, ctl, val, !L ? this.tlBanner('warn', 'Create a positive and a negative category in Dictionary first.') : null), out);
  }
  tlSentScores(ctx) {
    const { T, C } = ctx, E = this._E, SN = T.sent, L = this.tlDictLook(ctx);
    if (SN.valence && SN.valence.trim()) {
      return this.memo('tlVal|' + C.key + '|' + SN.valence + '|' + T.rec.fold, () => {
        const pairs = SN.valence.split(/\n/).map(l => l.match(/^\s*(.+?)\s*[=:\t,]\s*(-?\d+(?:\.\d+)?)\s*$/)).filter(Boolean).map(m => ({ k: m[1], s: Number(m[2]) }));
        const comp = E.tlCompileDict(C, pairs.map((p, i) => ({ name: 'v' + i, keys: p.k })), !!T.rec.fold), res = E.tlLookup(C, comp), n = C.off.length - 1, v = new Float64Array(n);
        for (let d = 0; d < n; d++) { if (C.blank[d]) { v[d] = NaN; continue; } let s = 0, c = 0; res.forEach((r, i) => { const k = r.counts[d]; if (k > 0) { s += k * pairs[i].s; c += k; } }); v[d] = c ? s / c : NaN; }
        return { v, name: 'valence (mean word score)', r: 'valence(dict) <- ' + JSON.stringify(Object.fromEntries(pairs.map(p => [p.k, p.s]))) + '  # see quanteda.sentiment\ntextstat_valence(toks, dictionary = dict)' };
      });
    }
    if (!L) return null;
    const pi = L.cats.findIndex(c => c.name === SN.pos), ni = L.cats.findIndex(c => c.name === SN.neg); if (pi < 0 || ni < 0 || pi === ni) return null;
    return this.memo('tlPol|' + C.key + '|' + JSON.stringify(L.cats) + pi + ni, () => { const a = L.res[pi].counts, b = L.res[ni].counts; return { v: Float64Array.from(a, (x, d) => isFinite(x) ? Math.log((x + 0.5) / (b[d] + 0.5)) : NaN), name: 'polarity', r: 'library(quanteda.sentiment)\npolarity(dict) <- list(pos = "' + SN.pos + '", neg = "' + SN.neg + '")\ntextstat_polarity(toks, dictionary = dict)   # log((pos + 0.5) / (neg + 0.5))' }; });
  }

  // topics: seededlda
  tlTopicDocs(ctx) {
    const { T, C, FT } = ctx, TP = this.tlTopEff(T, C), nd = C.off.length - 1;
    const minD = TP.min, maxP = TP.maxPct;
    return this.memo('tlTD|' + FT.sig + '|' + minD + '|' + maxP + '|' + TP.pool + '|' + T.by + '|' + T.date + '|' + this.filterSig(), () => {
      const mask = ctx.mask, docf = new Int32Array(FT.nF); let docs = 0;
      for (let d = 0; d < nd; d++) { if (C.blank[d] || (mask && !mask[d])) continue; docs++; const seen = new Set(); for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) seen.add(FT.ftok[i]); for (const f of seen) docf[f]++; }
      const vmap = new Int32Array(FT.nF).fill(-1), vocab = [];
      for (let f = 0; f < FT.nF; f++) if (docf[f] >= minD && 100 * docf[f] / Math.max(1, docs) <= maxP) { vmap[f] = vocab.length; vocab.push(f); }
      const docTok = (d, arr) => { for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { const w = vmap[FT.ftok[i]]; if (w >= 0) arr.push(w); } };
      // per-text streams (always), and pooled streams when asked
      const toks = [], off = [0], rows = [];
      for (let d = 0; d < nd; d++) { if (C.blank[d] || (mask && !mask[d])) { rows.push(-1); continue; } rows.push(off.length - 1); docTok(d, toks); off.push(toks.length); }
      let pool = null;
      if (TP.pool !== 'none' && T.by) {
        const G = this.tlGroupsOf(T, C, T.by), D = TP.pool === 'group-month' && T.date ? this.tlDates(T, C) : null, key = new Map(), pt = [], po = [0], plab = [];
        const members = [];
        for (let d = 0; d < nd; d++) { if (rows[d] < 0 || G.g[d] < 0) continue; let k = G.labels[G.g[d]]; if (D) { const p = this._E.tlPeriod(D.day[d], 'month'); if (!p) continue; k += ' ' + p.label; } let id = key.get(k); if (id === undefined) { id = plab.length; key.set(k, id); plab.push(k); members.push([]); } members[id].push(d); }
        members.forEach(ms => { for (const d of ms) docTok(d, pt); po.push(pt.length); });
        pool = { tok: Int32Array.from(pt), off: Int32Array.from(po), labels: plab };
      }
      return { V: vocab.length, vocab, tok: Int32Array.from(toks), off: Int32Array.from(off), rows: Int32Array.from(rows), docs, pool };
    });
  }
  // vocabulary limits follow the corpus size unless the user set them
  tlTopEff(T, C) { const t = T.top, d = C.docs; return Object.assign({}, t, { min: t.min != null ? t.min : (d >= 5000 ? 10 : d >= 500 ? 5 : 2), maxPct: t.maxPct != null ? t.maxPct : (d >= 5000 ? 5 : d >= 500 ? 20 : 50) }); }
  tlTopicKey(ctx, TD, extra) { const { T, FT } = ctx, TP = this.tlTopEff(T, ctx.C); return 'tlLDA|' + FT.sig + '|' + TD.V + '|' + TD.tok.length + '|' + JSON.stringify([TP.k, TP.method, TP.pool, TP.iter, TP.seed, TP.min, TP.maxPct, TP.residual, TP.method === 'seeded' ? this.tlCats(T) : 0, extra || 0]); }
  tlSeeds(ctx, TD) {
    const { T, C, FT } = ctx, L = this.tlDictLook(ctx); if (!L) return null;
    const K = L.cats.length + T.top.residual, V = TD.V, seeds = new Float64Array(V * K), inv = new Int32Array(FT.nF).fill(-1);
    TD.vocab.forEach((f, w) => { inv[f] = w; });
    const tot = new Float64Array(V); for (let i = 0; i < TD.tok.length; i++) tot[TD.tok[i]]++;
    L.comp.forEach((Kc, k) => { for (let t = 0; t < C.types.length; t++) if (Kc.singles[t]) { const f = FT.fid[t]; const w = f >= 0 ? inv[f] : -1; if (w >= 0) seeds[w * K + k] = tot[w] * 0.01 * 100; } });
    return { seeds, K, labels: L.cats.map(c => c.name).concat(Array.from({ length: T.top.residual }, (_, i) => 'other' + (T.top.residual > 1 ? i + 1 : ''))) };
  }
  tlTopics(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, TP = this.tlTopEff(T, C), set = p => this.tlSetIn('top', p);
    const TD = this.tlTopicDocs(ctx);
    const seeded = TP.method === 'seeded' ? this.tlSeeds(ctx, TD) : null;
    const K = seeded ? seeded.K : TP.k;
    const key = this.tlTopicKey(ctx, TD);
    this._tlJobs = this._tlJobs || {};
    const J = this._tlJobs[key];
    const run = () => this.tlJob(key, 'tlLDA', () => { const src = TD.pool || TD; return [src.tok, src.off, TD.V, K, { iter: TP.iter, seed: TP.seed, seeds: seeded ? seeded.seeds : null }]; }, 'Fitting ' + K + ' topics');
    const ctl = h('div', { className: 'tl-row wide' },
      this.tlField('Method', this.tlSeg([['lda', 'Find topics (LDA)'], ['seeded', 'Seeded by my dictionary']], TP.method, v => set({ method: v }))),
      TP.method === 'lda' ? this.tlField('Topics', this.tlNum(TP.k, v => set({ k: v }), { min: 2, max: 60, aria: 'Number of topics' })) : this.tlField('Extra free topics', this.tlNum(TP.residual, v => set({ residual: v }), { min: 0, max: 20, aria: 'Residual topics' })),
      this.tlField('Documents', this.tlSeg([['none', 'Each text'], ['group', 'Pool by group' + (T.by ? '' : ' (pick a group)')], ['group-month', 'Pool by group × month']], TP.pool, v => set({ pool: v }))),
      this.tlField('Iterations', this.tlNum(TP.iter, v => set({ iter: v }), { min: 100, max: 10000, step: 100, aria: 'Iterations' })),
      this.tlField('Seed', this.tlNum(TP.seed, v => set({ seed: v }), { min: 1, aria: 'Random seed' })),
      this.tlField('Vocabulary', h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'words in ≥'), this.tlNum(TP.min, v => set({ min: v }), { min: 1, aria: 'Minimum texts' }), h('span', { className: 'tl-hint' }, 'texts and ≤'), this.tlNum(TP.maxPct, v => set({ maxPct: v }), { min: 1, max: 100, aria: 'Maximum percent' }), h('span', { className: 'tl-hint' }, '% of texts'))));
    const info = this.tlBanner('info', this.fmtN(TD.V) + ' words are used for topics (' + this.fmtN(TD.tok.length) + ' word occurrences in ' + this.fmtN(TP.pool !== 'none' && TD.pool ? TD.pool.labels.length : TD.docs) + ' documents). Collapsed Gibbs sampling as seededlda::textmodel_lda (α = 0.5, β = 0.1)' + (TP.method === 'seeded' ? '; seed words get pseudo-counts as textmodel_seededlda (weight = 0.01)' : '') + '. Runs in the background; the page stays usable.');
    const seedWarn = TP.method === 'seeded' && !seeded ? this.tlBanner('warn', 'Seeded topics use your dictionary categories as seeds. Create them in Dictionary first.') : null;
    const runRow = h('div', { className: 'tl-row' }, J && J.status === 'run' ? this.tlBtn('Cancel', () => this.tlCancel(key)) : this.tlBtn(J ? 'Run again' : 'Run', () => { if (J) { delete this._tlJobs[key]; } run(); this.forceUpdate(); }, 'green', { disabled: !!seedWarn || TD.V < 5 }), TP.method === 'lda' ? this.tlBtn('Help me choose the number', () => this.tlTopicGrid(ctx, TD)) : null, this.tlBtn('Check stability (3 seeds)', () => this.tlTopicStab(ctx, TD, K, seeded)));
    const grid = this.tlTopicGridView(ctx, TD), stab = this.tlTopicStabView(ctx, TD, K);
    let res = null;
    if (J && J.status === 'run') res = this.tlPending(J.label + ' · ' + Math.round(100 * (J.p || 0)) + '%', J.p);
    else if (J && J.status === 'done' && J.value) res = this.tlTopicResults(ctx, TD, J.value, seeded);
    else if (J && J.status === 'done') res = this.tlBanner('warn', 'The model could not be fitted' + (J.err ? ': ' + J.err : '.'));
    return h('div', { className: 'tl-col' }, this.tlPanel('Topics', 'themes found in the texts (seededlda)', null, ctl, info, seedWarn, runRow, grid, stab), res);
  }
  tlTopicLabels(ctx, M, seeded) { const T = ctx.T, L = T.top.labels || {}; return Array.from({ length: M.K }, (_, k) => L[k] || (seeded ? seeded.labels[k] : 'Topic ' + (k + 1))); }
  tlTopicTheta(ctx, TD, M) {
    // per-text shares: direct when fitted on texts; folded in when fitted on pooled documents
    if (!TD.pool) return M.theta;
    const key = 'tlTheta|' + this.tlTopicKey(ctx, TD);
    return this.memo(key, () => this._E.tlLDAPredict(M, TD.tok, TD.off, { iter: 60 }));
  }
  tlTopicResults(ctx, TD, M, seeded) {
    const h = React.createElement, { T, C, FT } = ctx, V = M.V, labels = this.tlTopicLabels(ctx, M, seeded);
    const theta = this.tlTopicTheta(ctx, TD, M), K = M.K;
    const terms = Array.from({ length: K }, (_, k) => Array.from({ length: V }, (_, w) => w).sort((a, b) => M.phi[k * V + b] - M.phi[k * V + a]).slice(0, 10).map(w => FT.label[TD.vocab[w]]));
    const G = T.by ? this.tlGroupsOf(T, C, T.by) : null, groups = G ? G.labels.map((l, i) => i).filter(i => G.count[i] >= Math.max(10, 0.002 * C.docs)).sort((a, b) => G.count[b] - G.count[a]).slice(0, 4) : [];
    const nd = C.off.length - 1, share = new Float64Array(K), gshare = groups.map(() => new Float64Array(K)), gn = groups.map(() => 0); let n = 0;
    for (let d = 0; d < nd; d++) { const r = TD.rows[d]; if (r < 0) continue; const th = theta.subarray ? theta.subarray(r * K, r * K + K) : theta.slice(r * K, r * K + K); if (!isFinite(th[0])) continue; n++; for (let k = 0; k < K; k++) share[k] += th[k]; if (G) { const gi = groups.indexOf(G.g[d]); if (gi >= 0) { gn[gi]++; for (let k = 0; k < K; k++) gshare[gi][k] += th[k]; } } }
    const open = T.topOpen;
    const cards = h('div', { className: 'tl-topics' }, Array.from({ length: K }, (_, k) => h('div', { key: k, className: 'tl-topic' + (open === k ? ' on' : '') },
      h('div', { className: 'tl-topic-h' }, this.tlText(labels[k], v => this.tlSetIn('top', { labels: Object.assign({}, T.top.labels, { [k]: v }) }), { aria: 'Topic label', width: 170, k: 'tlab' + k }), h('span', null, this.tlPct(share[k] / Math.max(1, n)))),
      h('div', { className: 'tl-topic-w' }, terms[k].join(' · ')),
      ...groups.map((g, gi) => h('div', { key: gi, className: 'tl-tbar' }, h('span', null, String(G.labels[g]).slice(0, 10)), h('span', { className: 'trk' }, h('i', { style: { width: Math.min(100, 100 * (gshare[gi][k] / Math.max(1, gn[gi])) / Math.max(...gshare.map((s, j) => Math.max(...s) / Math.max(1, gn[j])))) + '%', background: this.tlPal(gi) } })), h('span', null, this.tlPct(gshare[gi][k] / Math.max(1, gn[gi]), 1)))),
      this.tlBtn(open === k ? 'Hide texts' : 'Most typical texts', () => this.tlSet({ topOpen: open === k ? null : k }))))) ;
    let typical = null;
    if (open != null && open < K) {
      const sc = []; for (let d = 0; d < nd; d++) { const r = TD.rows[d]; if (r < 0) continue; const v = theta[r * K + open]; if (isFinite(v) && TD.off[r + 1] - TD.off[r] >= 5) sc.push([d, v]); }
      sc.sort((a, b) => b[1] - a[1]);
      typical = this.tlPanel('Most typical texts · ' + labels[open], null, null, ...sc.slice(0, 10).map(([d, v]) => h('div', { key: d, className: 'tl-quote' }, h('span', { className: 'tl-qrow' }, 'row ' + (this.tlRowOf(C, d) + 1) + ' · ' + this.tlPct(v, 0)), String(C.texts[d]).slice(0, 360))));
    }
    const sizes = Array.from({ length: K }, (_, k) => ({ label: labels[k], value: 100 * share[k] / Math.max(1, n), color: this.tlPal(k) }));
    return h('div', { className: 'tl-col' }, this.tlPanel('Topics found', K + ' topics · divergence ' + M.divergence.toFixed(3) + ' · type your own labels', null, cards,
      this.tlBarsSvg('tltopics', sizes, { title: 'Average share of each topic per text', xlab: '% of words', pct: true }), this.tlExportRow('tltopics', 'topic-shares'),
      h('div', { className: 'tl-row' }, this.tlBtn('Save main topic and shares as variables →', () => { this.tlSetIn('save', { topic: true, shares: true }); this.tlSet({ step: 'save' }); }, 'green')),
      this.tlRcode('library(seededlda)\ndfmat_t <- dfm_trim(dfmat, min_docfreq = ' + this.tlTopEff(T, C).min + ') |> dfm_trim(max_docfreq = ' + (this.tlTopEff(T, C).maxPct / 100) + ', docfreq_type = "prop")\n' + (T.top.pool !== 'none' ? 'dfmat_t <- dfm_group(dfmat_t, groups = ' + T.by + (T.top.pool === 'group-month' ? ' + month' : '') + ')\n' : '') + 'set.seed(' + T.top.seed + ')\n' + (seeded ? 'tmod <- textmodel_seededlda(dfmat_t, dict, residual = ' + T.top.residual + ', max_iter = ' + T.top.iter + ')' : 'tmod <- textmodel_lda(dfmat_t, k = ' + K + ', max_iter = ' + T.top.iter + ')') + '\nterms(tmod, 10)\ntopics(tmod)          # main topic of each text\ndivergence(tmod)')), typical);
  }
  tlTopicGrid(ctx, TD) {
    const ks = [5, 10, 15, 20, 25, 30].filter(k => k < TD.V), key = 'tlGrid|' + this.tlTopicKey(ctx, TD, 'grid');
    this._tlGridKey = key; this.tlJob(key, 'tlLDAGrid', () => [(TD.pool || TD).tok, (TD.pool || TD).off, TD.V, ks, { iter: 300, seed: ctx.T.top.seed }], 'Trying 5 to 30 topics'); this.forceUpdate();
  }
  tlTopicGridView(ctx, TD) {
    const h = React.createElement, key = this._tlGridKey; if (!key || !this._tlJobs[key] || key !== 'tlGrid|' + this.tlTopicKey(ctx, TD, 'grid')) return null;
    const J = this._tlJobs[key]; if (J.status !== 'done') return this.tlPending(J.label + ' · ' + Math.round(100 * (J.p || 0)) + '%', J.p);
    const r = J.value || []; if (!r.length) return null; const best = r.reduce((a, b) => b.divergence > a.divergence ? b : a);
    return h('div', { className: 'tl-col' }, this.tlLinesSvg('tlgrid', r.map(x => String(x.k)), [{ name: 'divergence', color: '#2E7D58', pts: r.map(x => x.divergence) }], { ylab: 'regularised topic divergence (higher = more distinct topics)', title: 'Choosing the number of topics (seededlda::divergence, 300 iterations each)' }),
      this.tlBanner('ok', 'Topics are most distinct with ', h('b', null, best.k), '. ', this.tlBtn('Use ' + best.k + ' topics', () => this.tlSetIn('top', { k: best.k, method: 'lda' }))));
  }
  tlTopicStab(ctx, TD, K, seeded) {
    const key = 'tlStab|' + this.tlTopicKey(ctx, TD, 'stab'); this._tlStabKey = key;
    this.tlJob(key, 'tlLDAStability', () => [(TD.pool || TD).tok, (TD.pool || TD).off, TD.V, K, { iter: Math.min(ctx.T.top.iter, 600), seeds: seeded ? seeded.seeds : null, seed: ctx.T.top.seed }], 'Fitting 3 models'); this.forceUpdate();
  }
  tlTopicStabView(ctx, TD, K) {
    const h = React.createElement, key = this._tlStabKey; if (!key || !this._tlJobs[key] || key !== 'tlStab|' + this.tlTopicKey(ctx, TD, 'stab')) return null;
    const J = this._tlJobs[key]; if (J.status !== 'done') return this.tlPending(J.label + ' · ' + Math.round(100 * (J.p || 0)) + '%', J.p);
    const r = J.value; if (!r) return null;
    return this.tlBanner(r.mean >= 0.5 ? 'ok' : 'warn', h('b', null, 'Stability: '), 'across 3 random starts, matched topics share ' + this.tlPct(r.mean, 0) + ' of their top-10 words on average (lowest topic ' + this.tlPct(r.min, 0) + '). ' + (r.mean >= 0.5 ? 'Most topics are stable.' : 'Several topics change from run to run: try fewer topics, more iterations, or pooling short texts.'));
  }

  // classify: textmodel_nb
  tlClassify(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, NB = T.nb, set = p => this.tlSetIn('nb', p), E = this._E;
    const opts = [['', 'pick the column with known labels']].concat(this.tlGroupCols(T.v).map(n => [n, n]));
    const ctl = h('div', { className: 'tl-row wide' }, this.tlField('Labels to learn from', this.tlSelect(NB.y, opts, v => set({ y: v }), 'Label column')), this.tlField('Check on', h('div', { className: 'tl-row' }, this.tlNum(NB.test, v => set({ test: v }), { min: 5, max: 50, aria: 'Hold-out percent' }), h('span', { className: 'tl-hint' }, '% of labelled texts held out'))), this.tlField('Prior', this.tlSeg([['uniform', 'Equal'], ['docfreq', 'By group size']], NB.prior, v => set({ prior: v }))));
    const help = this.tlBanner('info', 'Learns which words go with each label from the rows that have one, checks itself on held-out rows, then predicts a label for rows without one (multinomial Naive Bayes, textmodel_nb with smoothing 1).');
    if (!NB.y) return this.tlPanel('Classify', 'predict a label from the words', null, ctl, help);
    const G = this.tlGroupsOf(T, C, NB.y); if (!G || G.labels.length < 2) return this.tlPanel('Classify', null, null, ctl, this.tlBanner('warn', 'This column needs at least two labels.'));
    const res = this.memo('tlNB|' + FT.sig + '|' + NB.y + '|' + NB.test + '|' + NB.prior + '|' + this.filterSig(), () => {
      const nd = C.off.length - 1, y = G.g, mask = ctx.mask, rnd = (() => { let s = 2024; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
      const train = new Uint8Array(nd), test = new Uint8Array(nd); let nl = 0;
      for (let d = 0; d < nd; d++) { if (y[d] < 0 || C.blank[d] || (mask && !mask[d])) continue; nl++; if (rnd() * 100 < NB.test) test[d] = 1; else train[d] = 1; }
      const m1 = E.tlNaiveBayes(FT, y, G.labels, train, { prior: NB.prior });
      const Kc = G.labels.length, cm = Array.from({ length: Kc }, () => new Array(Kc).fill(0)); let ok = 0, nt = 0;
      for (let d = 0; d < nd; d++) if (test[d] && m1.pred[d] >= 0) { cm[y[d]][m1.pred[d]]++; nt++; if (y[d] === m1.pred[d]) ok++; }
      const all = new Uint8Array(nd); for (let d = 0; d < nd; d++) all[d] = train[d] || test[d];
      const m2 = E.tlNaiveBayes(FT, y, G.labels, all, { prior: NB.prior });
      let unl = 0; for (let d = 0; d < nd; d++) if (y[d] < 0 && !C.blank[d]) unl++;
      const tops = G.labels.map((l, c) => { const o = FT.order.slice(0, 5000).map(f => [f, m2.logPw[c][f] - Math.max(...m2.logPw.map((lp, j) => j === c ? -Infinity : lp[f]))]); return o.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f]) => FT.label[f]); });
      return { acc: nt ? ok / nt : NaN, nt, nl, cm, unl, tops, base: Math.max(...G.count) / G.count.reduce((a, b) => a + b, 0), m2 };
    });
    const groups = G.labels.map((l, i) => i);
    const cmTbl = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'true ↓ / predicted →'), ...groups.map(g => h('th', { key: g, className: 'n' }, String(G.labels[g]).slice(0, 14))), h('th', { className: 'n' }, 'recall'))), h('tbody', null, groups.map(g => h('tr', { key: g }, h('td', { className: 'w' }, G.labels[g]), ...groups.map(p => h('td', { key: p, className: 'n' + (p === g ? ' sig' : '') }, res.cm[g][p])), h('td', { className: 'n' }, this.tlPct(res.cm[g][g] / Math.max(1, res.cm[g].reduce((a, b) => a + b, 0)), 0)))))));
    return h('div', { className: 'tl-col' }, this.tlPanel('Classify', 'predict a label from the words (textmodel_nb)', null, ctl, help,
      this.tlBanner(res.acc > res.base + 0.05 ? 'ok' : 'warn', h('b', null, 'Accuracy on ' + this.fmtN(res.nt) + ' held-out texts: ' + this.tlPct(res.acc) + '. '), 'Always guessing the biggest label would score ' + this.tlPct(res.base) + '. ' + (res.unl ? this.fmtN(res.unl) + ' texts have no label and can get a predicted one.' : '')),
      cmTbl, h('span', { className: 'tl-lbl' }, 'Words that most point to each label'),
      h('div', { className: 'tl-col' }, groups.map(g => h('div', { key: g, className: 'tl-cluster' }, h('span', { className: 'sw', style: { background: this.tlPal(g) } }), h('b', null, G.labels[g] + ': '), res.tops[g].join(', ')))),
      h('div', { className: 'tl-row' }, this.tlBtn('Save predicted label and probability →', () => { this.tlSetIn('save', { nb: true }); this.tlSet({ step: 'save' }); }, 'green')),
      this.tlRcode('library(quanteda.textmodels)\ntrain <- !is.na(docvars(dfmat, "' + NB.y + '"))\ntmod <- textmodel_nb(dfmat[train, ], y = docvars(dfmat, "' + NB.y + '")[train], prior = "' + NB.prior + '")\npredict(tmod, newdata = dfmat[!train, ], type = "class")')));
  }

  // scale: Wordfish, Wordscores, correspondence analysis on groups
  tlScale(ctx) {
    const h = React.createElement, { T, C, FT, cnt } = ctx, SC = T.scale, set = p => this.tlSetIn('scale', p), E = this._E;
    const by = SC.by || T.by, opts = [['', 'pick a group column']].concat(this.tlGroupCols(T.v).map(n => [n, n]));
    const ctl = h('div', { className: 'tl-row wide' }, this.tlField('Place each', this.tlSelect(by, opts, v => set({ by: v }), 'Group column')), this.tlField('Method', this.tlSeg([['wordfish', 'Wordfish'], ['wordscores', 'Wordscores'], ['ca', 'Correspondence analysis']], SC.method, v => set({ method: v }))));
    const help = this.tlBanner('info', SC.method === 'wordfish' ? 'Wordfish places groups on one dimension using only their word use (a Poisson scaling model; textmodel_wordfish). The meaning of the dimension comes from the words at each end.' : SC.method === 'wordscores' ? 'Wordscores: give known positions to some groups (reference texts); the others are placed from the words they share (textmodel_wordscores).' : 'Correspondence analysis maps groups so that groups with similar word use sit close together (textmodel_ca).');
    if (!by) return this.tlPanel('Scale', 'place groups on a dimension', null, ctl, help);
    const G = this.tlGroupsOf(T, C, by); if (!G || G.labels.length < 3) return this.tlPanel('Scale', null, null, ctl, this.tlBanner('warn', 'Scaling needs at least 3 groups.'));
    const gc = this.memo('tlGC|' + FT.sig + '|' + by + '|' + T.mergeCase, () => E.tlGroupCounts(FT, G.g, G.labels.length, ctx.mask));
    const gi = G.labels.map((l, i) => i).filter(i => gc.tot[i] >= 100).sort((a, b) => G.count[b] - G.count[a]).slice(0, 40);
    const feats = cnt.order.filter(f => FT.kind[f] !== 4).slice(0, 1500).filter(f => gi.filter(g => gc.counts[g][f] > 0).length >= 2).slice(0, 1000);
    const M = gi.map(g => Array.from(feats, f => gc.counts[g][f]));
    let out = null;
    if (SC.method === 'wordfish') {
      const key = 'tlWF|' + FT.sig + '|' + by + '|' + gi.join(',');
      const J = this.tlJob(key, 'tlWordfish', () => [M, { iter: 150 }], 'Fitting Wordfish');
      if (!J.done) out = this.tlPending(J.label);
      else if (J.value) { const R = J.value; const ends = feats.map((f, j) => [f, R.beta[j]]).sort((a, b) => a[1] - b[1]); out = h('div', { className: 'tl-col' }, this.tlDotsSvg('tlwf', gi.map((g, i) => ({ label: G.labels[g], x: R.theta[i], lo: R.theta[i] - 1.96 * R.se[i], hi: R.theta[i] + 1.96 * R.se[i] })), { xlab: 'estimated position (θ) with 95% interval' }), this.tlExportRow('tlwf', 'wordfish'), this.tlBanner('info', h('b', null, 'Low end words: '), ends.slice(0, 12).map(e => FT.label[e[0]]).join(', '), h('br'), h('b', null, 'High end words: '), ends.slice(-12).reverse().map(e => FT.label[e[0]]).join(', ')), this.tlRcode('library(quanteda.textmodels)\ntmod <- textmodel_wordfish(dfm_group(dfmat, groups = ' + by + '))\ntextplot_scale1d(tmod)')); }
    } else if (SC.method === 'wordscores') {
      const ref = SC.ref || {};
      const scores = gi.map(g => { const v = ref[G.labels[g]]; return v === '' || v == null ? NaN : Number(v); });
      const inputs = h('div', { className: 'tl-row' }, ...gi.slice(0, 20).map((g, i) => h('label', { key: g, className: 'tl-field' }, h('span', { className: 'tl-lbl' }, String(G.labels[g]).slice(0, 18)), h('input', { type: 'number', className: 'tl-input num', style: { width: '76px' }, defaultValue: ref[G.labels[g]] ?? '', key: 'ws' + g + (ref[G.labels[g]] ?? ''), placeholder: '—', onBlur: e => set({ ref: Object.assign({}, ref, { [G.labels[g]]: e.target.value }) }) }))));
      const nRef = scores.filter(isFinite).length;
      if (nRef < 2) out = h('div', { className: 'tl-col' }, inputs, this.tlBanner('info', 'Give a known position (e.g. −1 and 1) to at least two groups.'));
      else { const R = E.tlWordscores(M, scores); out = h('div', { className: 'tl-col' }, inputs, this.tlDotsSvg('tlws', gi.map((g, i) => ({ label: G.labels[g] + (isFinite(scores[i]) ? ' (reference)' : ''), x: R.score[i] })), { xlab: 'Wordscores position (raw)' }), this.tlExportRow('tlws', 'wordscores'), this.tlRcode('tmod <- textmodel_wordscores(dfm_group(dfmat, groups = ' + by + '), y = refscores)\npredict(tmod)')); }
    } else {
      const R = this.memo('tlCA|' + FT.sig + '|' + by + '|' + gi.join(','), () => E.tlCA(M, 2));
      out = h('div', { className: 'tl-col' }, this.tlScatterSvg('tlca', gi.map((g, i) => ({ label: G.labels[g], x: R.rowCoord[i][0], y: R.rowCoord[i][1] || 0 })), { xlab: 'Dimension 1 (' + this.tlPct(R.inertia[0], 0) + ' of inertia)', ylab: 'Dimension 2 (' + this.tlPct(R.inertia[1] || 0, 0) + ')' }), this.tlExportRow('tlca', 'correspondence-analysis'), this.tlRcode('tmod <- textmodel_ca(dfm_group(dfmat, groups = ' + by + '))\ntextplot_scale1d(tmod, margin = "documents")'));
    }
    return h('div', { className: 'tl-col' }, this.tlPanel('Scale', gi.length + ' groups with 100+ words · ' + feats.length + ' words', null, ctl, help, out));
  }
