  // ---- small UI primitives
  tlChip(label, on, onClick, extra) { return React.createElement('button', Object.assign({ type: 'button', className: 'tl-chip' + (on ? ' on' : ''), onClick, 'aria-pressed': on ? 'true' : 'false' }, extra || {}), label); }
  tlSeg(opts, cur, pick, extra) { const h = React.createElement; return h('div', Object.assign({ className: 'tl-row', role: 'group' }, extra || {}), opts.map(([v, l, tip]) => this.tlChip(l, cur === v, () => pick(v), { key: String(v), title: tip || undefined }))); }
  tlField(label, ...kids) { const h = React.createElement; return h('div', { className: 'tl-field' }, h('span', { className: 'tl-lbl' + (/[@#]/.test(String(label)) ? ' ui' : '') }, label), ...kids); }
  tlSelect(value, options, onChange, aria, extra) { const h = React.createElement; return h('select', Object.assign({ className: 'tl-select', value: value == null ? '' : value, onChange: e => onChange(e.target.value), 'aria-label': aria }, extra || {}), options.map(([v, l]) => h('option', { key: String(v), value: v }, l))); }
  tlNum(value, onChange, o) {
    o = o || {}; const h = React.createElement;
    return h('input', { type: 'number', className: 'tl-input num', key: 'n' + value, defaultValue: value, min: o.min, max: o.max, step: o.step || 1, 'aria-label': o.aria, style: { width: (o.width || 64) + 'px' }, onBlur: e => { const x = Number(e.target.value); if (isFinite(x) && x !== value) onChange(o.min != null ? Math.max(o.min, o.max != null ? Math.min(o.max, x) : x) : x); }, onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } });
  }
  tlText(value, onChange, o) {
    o = o || {}; const h = React.createElement;
    return h('input', { type: 'text', className: 'tl-input' + (o.mono ? ' mono' : ''), key: 't' + (o.k || '') + value, defaultValue: value, placeholder: o.placeholder, 'aria-label': o.aria, spellCheck: false, style: o.width ? { width: o.width + 'px' } : (o.flex ? { flex: o.flex } : undefined), onBlur: e => { if (e.target.value !== value) onChange(e.target.value); }, onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); onChange(e.target.value); if (o.clear) e.target.value = ''; } } });
  }
  tlBtn(label, onClick, kind, extra) { return React.createElement('button', Object.assign({ type: 'button', className: 'tl-btn' + (kind ? ' ' + kind : ''), onClick }, extra || {}), label); }
  tlPanel(title, sub, right, ...kids) { const h = React.createElement; return h('section', { className: 'tl-panel' }, (title || right) ? h('div', { className: 'tl-ptitle' }, title ? h('h3', null, title) : null, sub ? h('span', null, sub) : null, right ? h('div', { className: 'tl-pr' }, right) : null) : null, ...kids); }
  tlStat(k, v, s) { const h = React.createElement; return h('div', { className: 'tl-stat' }, h('span', { className: 'k' }, k), h('span', { className: 'v' }, v), s ? h('span', { className: 's' }, s) : null); }
  tlBanner(kind, ...kids) { return React.createElement('div', { className: 'tl-banner ' + (kind || 'info'), role: kind === 'warn' ? 'alert' : 'status' }, ...kids); }
  tlPending(label, p) { const h = React.createElement; return h('div', { className: 'tl-pending', role: 'status' }, h('div', { className: 'tl-spin' }), h('span', null, (label || 'Working') + '…'), p ? h('div', { className: 'tl-pbar' }, h('i', { style: { width: Math.round(100 * p) + '%' } })) : null); }
  tlPct(x, d) { return isFinite(x) ? (100 * x).toFixed(d == null ? 1 : d) + '%' : '—'; }

  // ---- the whole tab
  tlRender() {
    const h = React.createElement, S = this.state;
    if (!this._E || !this._E.tlTokenize) return this.tlPending('Starting the text engine');
    const T = this.tlS();
    if (!this._tlAutoDone || this._tlAutoDone !== this._raw) { this._tlAutoDone = this._raw; this.tlAutoPick(); }
    const steps = [['texts', 'Texts'], ['clean', 'Clean'], ['explore', 'Explore'], ['measure', 'Measure'], ['save', 'Save']];
    const cur = steps.findIndex(s => s[0] === T.step);
    const bar = h('nav', { className: 'tl-steps', 'aria-label': 'Text analysis steps' },
      steps.map(([k, l], i) => [i ? h('span', { key: 's' + i, className: 'tl-sep', 'aria-hidden': 'true' }) : null,
        h('button', { key: k, type: 'button', className: 'tl-step' + (i === cur ? ' on' : i < cur ? ' done' : ''), 'aria-current': i === cur ? 'step' : undefined, onClick: () => this.tlSet({ step: k }) }, h('i', null, i < cur ? '✓' : String(i + 1)), l)]),
      h('span', { className: 'tl-steps-r' }, this.tlBtn(T.code ? 'Hide R code' : 'Recipe · R code', () => this.tlSet({ code: !T.code }), '', { 'aria-expanded': T.code ? 'true' : 'false' })));
    if (!T.v) return h('div', { className: 'tl' }, bar, this.tlStepTexts(T, null));
    const C = this.tlCorpus(T);
    let body;
    if (!C) body = this.tlBanner('warn', 'Pick a column that holds text.');
    else if (C.pending) body = this.tlPending(C.label, C.p);
    else {
      const FT = this.tlFT(T, C);
      if (FT.pending) body = this.tlPending(FT.label);
      else {
        if (!FT.sig) FT.sig = JSON.stringify(FT.R).length + ':' + (FT.total) + ':' + FT.nF + ':' + JSON.stringify(Object.assign({}, FT.R, { lemma: 0 }));
        const ctx = { T, C, FT, mask: this.tlMask(C) };
        ctx.cnt = this.tlCounts(FT, C, ctx.mask);
        body = T.step === 'texts' ? this.tlStepTexts(T, ctx) : T.step === 'clean' ? this.tlStepClean(ctx) : T.step === 'explore' ? this.tlStepExplore(ctx) : T.step === 'measure' ? this.tlStepMeasure(ctx) : this.tlStepSave(ctx);
        if (T.code) body = h(React.Fragment, null, this.tlCodePanel(ctx), body);
      }
    }
    return h('div', { className: 'tl' }, bar, body);
  }
  tlNav(prev, next) {
    const h = React.createElement;
    return h('div', { className: 'tl-navrow' }, prev ? this.tlBtn('← ' + prev[1], () => this.tlSet({ step: prev[0] })) : h('span'), next ? this.tlBtn(next[1] + ' →', () => this.tlSet({ step: next[0] }), 'green') : null);
  }

  // ---- step 1: texts
  tlStepTexts(T, ctx) {
    const h = React.createElement, cols = (this.state.cols || []).map(c => c.name);
    const tcols = this.tlTextCols();
    const textOpts = [['', 'pick a text column']].concat(tcols.map(c => [c.name, c.name + ' · ' + (c.words >= 10 ? Math.round(c.words) : c.words.toFixed(1)) + ' words on average'])).concat(cols.filter(n => !tcols.some(c => c.name === n)).map(n => [n, n]));
    const grpOpts = [['', 'none']].concat(this.tlGroupCols(T.v).map(n => [n, n]));
    const dateOpts = [['', 'none']].concat(cols.filter(n => n !== T.v).map(n => [n, n]));
    const pickers = this.tlPanel('Your texts', 'each row is one document', null,
      h('div', { className: 'tl-row wide' },
        this.tlField('Text', this.tlSelect(T.v, textOpts, v => this.tlSet({ v, step: 'texts' }), 'Text column')),
        this.tlField('Groups to compare (optional)', this.tlSelect(T.by, grpOpts, v => { this._tlByTouched = true; this.tlSet({ by: v }); }, 'Group column')),
        this.tlField('Date (optional)', this.tlSelect(T.date, dateOpts, v => { this._tlDateTouched = true; this.tlSet({ date: v }); }, 'Date column')),
        this.tlField('Unit of analysis', this.tlSeg([['row', 'Each row'], ['sentence', 'Each sentence', 'corpus_reshape(to = "sentences"): every sentence becomes a document; saved variables add up to each row']], T.unit, v => this.tlSet({ unit: v })))));
    if (!ctx) return h('div', { className: 'tl-col' }, pickers, this.tlBanner('info', 'Pick the column that holds your texts: tweets, speeches, open answers, news. Excel and CSV files work the same way.'));
    const { C, FT } = ctx, det = this.tlDetectLang(T, C), E = this._E;
    const notes = [];
    const LN = Object.fromEntries(E.TL_LANGS);
    const langTxt = det.langs.map(l => LN[l] || l).join(' and ');
    if (det.from && det.from !== 'text') notes.push(this.tlBanner('info', h('b', null, langTxt + ' detected. '), this.fmtN(det.top) + ' of ' + this.fmtN(det.n) + ' rows (' + this.tlPct(det.share) + ') say “' + det.langs[0] + '” in ' + det.from + '. ' + (T.rec.langs ? 'You chose: ' + T.rec.langs.map(l => LN[l] || l).join(', ') + '.' : 'Common words in ' + langTxt + ' are removed; change this in Clean.')));
    else notes.push(this.tlBanner('info', h('b', null, langTxt + ' detected '), 'from the most common words in the texts. Common words in ' + langTxt + ' are removed; change this in Clean.'));
    const texts = C.texts; let at = 0, blank = 0;
    for (let i = 0; i < texts.length; i++) { const s = texts[i]; if (s == null) { blank++; continue; } if (s.length >= 32767) at++; }
    if (at) notes.push(this.tlBanner('warn', h('b', null, this.fmtN(at) + ' texts are exactly 32,767 characters long. '), 'That is the most an Excel cell can hold, so these texts were cut off when the file was saved in Excel. Results describe only the part that was kept. If you have the full texts (for example as .txt or .csv), load those instead.'));
    if (blank) notes.push(this.tlBanner('info', this.fmtN(blank) + ' rows have no text. They are left out of every count and get a missing value (.) in saved variables.'));
    const G = this.tlGroupsOf(T, C, T.by);
    if (G && G.merged.length) notes.push(this.tlBanner('info', h('b', null, 'Groups that differ only in capital letters are merged: '), G.merged.map(m => m.join(' + ')).join('; ') + '. ', this.tlBtn(T.mergeCase ? 'Keep them separate' : 'Merge them', () => this.tlSet({ mergeCase: !T.mergeCase }))));
    if (!G && T.by === '' ) {}
    if (T.date) { const D = this.tlDates(T, C); if (D) notes.push(this.tlBanner(D.ok ? 'info' : 'warn', D.ok ? [h('b', { key: 'b' }, this.fmtN(D.ok) + ' dates read '), 'from ' + T.date + ' (' + this.tlDay(D.min) + ' to ' + this.tlDay(D.max) + ').', D.ambiguous || D.autoOrder ? [' Dates like 02.12.18 are read as ', h('b', { key: 'o' }, D.order === 'dmy' ? 'day.month.year' : 'month.day.year'), D.autoOrder ? ' (some values have a day above 12).' : '. ', D.autoOrder ? null : this.tlBtn('Read as ' + (D.order === 'dmy' ? 'month.day.year' : 'day.month.year'), () => this.tlSetIn('time', { order: D.order === 'dmy' ? 'mdy' : 'dmy' }), '', { key: 'sw' })] : null] : '“' + T.date + '” does not look like dates. Over-time charts need dates such as 2025-02-13, 13.02.25, “Feb 13, 2025” or a year.')); }
    let words = 0; for (let i = 0; i < C.tok.length; i++) if (C.kind[C.tok[i]] === 1) words++;
    const samples = []; for (let i = 0, step = Math.max(1, Math.floor(texts.length / 3)); i < texts.length && samples.length < 3; i += step) if (texts[i] != null) samples.push(i);
    const stats = h('div', { className: 'tl-stats' }, this.tlStat('Texts', this.fmtN(C.docs), blank ? this.fmtN(blank) + ' blank' : 'none blank'), this.tlStat('Words', this.fmtN(words), 'before cleaning'), this.tlStat('Words per text', this.fmt(words / Math.max(1, C.docs), 1), 'on average'), this.tlStat('Different words', this.fmtN(C.types.length), 'incl. links, #tags, @names'));
    const sample = this.tlPanel('A look at the texts', null, null, ...samples.map(i => h('div', { key: i, className: 'tl-quote' }, h('span', { className: 'tl-qrow' }, 'row ' + this.fmtN(this.tlRowOf(C, i) + 1)), String(texts[i]).slice(0, 420) + (String(texts[i]).length > 420 ? ' …' : ''))));
    return h('div', { className: 'tl-col' }, pickers, ...notes, stats, sample, this.tlNav(null, ['clean', 'Next: Clean']));
  }
  tlDay(d) { return isFinite(d) ? new Date(d * 86400000).toISOString().slice(0, 10) : '—'; }
  tlDates(T, C) {
    if (!T.date) return null;
    return this.memo('tlD|' + C.key + '|' + T.date + '|' + T.time.order, () => {
      const vv = this.valsCore(T.date); if (!vv) return null;
      const n = C.off.length - 1, vals = new Array(n);
      for (let d = 0; d < n; d++) { const r = this.tlRowOf(C, d), x = vv.a[r]; vals[d] = x; }
      return this._E.tlParseDates(vv.kind === 'num' ? Float64Array.from(vals) : vals, T.time.order === 'auto' ? null : T.time.order);
    });
  }

  // ---- step 2: clean
  tlStepClean(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, E = this._E, R = T.rec, set = p => this.tlSetIn('rec', p);
    const langs = this.tlLangs(T, C), LN = E.TL_LANGS;
    const kindCount = k => { let n = 0; for (let i = 0; i < C.tok.length; i++) if (C.kind[C.tok[i]] === k) n++; return n; };
    const kc = this.memo('tlKC|' + C.key, () => ({ url: kindCount(4), num: kindCount(5), emoji: kindCount(6), tag: kindCount(2), mention: kindCount(3) }));
    const tog = (k, label, n) => this.tlChip([label, n ? h('em', { key: 'n' }, ' ' + this.fmtN(n)) : null], R[k] === 'remove', () => set({ [k]: R[k] === 'remove' ? 'keep' : 'remove' }), { key: k, title: R[k] === 'remove' ? 'Removed — click to keep' : 'Kept — click to remove' });
    const stopLang = l => { const cur = langs.slice(); const i = cur.indexOf(l); if (i >= 0) cur.splice(i, 1); else cur.push(l); set({ langs: cur }); };
    const extra = R.extra || [];
    const addWords = s => { const add = String(s).split(/[,;\n]+/).map(x => x.trim().toLowerCase()).filter(Boolean); if (add.length) set({ extra: Array.from(new Set(extra.concat(add))) }); };
    const stemOk = ['es', 'en'].includes(this.tlStemLang(T, C)), lemOk = ['es', 'en', 'pt', 'fr'].includes(this.tlStemLang(T, C));
    const phrases = (R.phrases || []).map(p => Array.isArray(p) ? p.join(' ') : p);
    const sugg = this.tlPhraseSuggest(T, C);
    const ctl = this.tlPanel('Cleaning', 'every choice applies to all results', null,
      this.tlField('Remove', h('div', { className: 'tl-row' }, tog('url', 'Links', kc.url), tog('num', 'Numbers', kc.num), tog('emoji', 'Emoji & symbols', kc.emoji), this.tlChip('Punctuation', true, () => this.flash('Punctuation is always removed, as tokens(remove_punct = TRUE)'), { title: 'Always removed' }), this.tlChip('Split hyphens', R.hyphen === 'split', () => set({ hyphen: R.hyphen === 'split' ? 'keep' : 'split' }), { title: 'covid-19 → covid, 19' }))),
      h('div', { className: 'tl-row wide' },
        this.tlField('@mentions', this.tlSeg([['keep', 'Keep'], ['remove', 'Remove']], R.mention, v => set({ mention: v }))),
        this.tlField('#hashtags', this.tlSeg([['keep', 'Keep as #tags'], ['word', 'Read as words', '#Covid19 counts as covid19'], ['remove', 'Remove']], R.tag, v => set({ tag: v }))),
        this.tlField('Accents', this.tlSeg([[true, 'Ignore (á = a, ñ kept)'], [false, 'Treat as different']], !!R.fold, v => set({ fold: v })))),
      this.tlField('Common words to leave out (stopwords)',
        h('div', { className: 'tl-row' }, ...LN.map(([k, l]) => this.tlChip(l, langs.includes(k), () => stopLang(k), { key: k })), this.tlChip('None', !langs.length && !!R.langs, () => set({ langs: [] }))),
        h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'List:'), this.tlSeg([['snowball', 'Standard (Snowball)'], ['iso', 'Extended (stopwords-iso)']], R.stopSource, v => set({ stopSource: v })), R.langs ? this.tlBtn('Use the detected language', () => set({ langs: null })) : null),
        h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'Your words:'), ...extra.map(w => this.tlChip([w, h('span', { className: 'x', key: 'x' }, ' ×')], false, () => set({ extra: extra.filter(x => x !== w) }), { key: w, className: 'tl-chip soft', title: 'Remove from the list' })),
          this.tlText('', addWords, { placeholder: 'add words, e.g. vía, rt, cdmx', aria: 'Add stopwords', width: 210, clear: true, k: 'sw' + extra.length }),
          h('label', { className: 'tl-btn', title: 'Import a .txt list (one word per line or comma separated)' }, 'Import .txt', h('input', { type: 'file', accept: '.txt,.csv,text/plain', style: { display: 'none' }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) f.text().then(addWords); e.target.value = ''; } })),
          extra.length ? this.tlBtn('Export', () => this.dlBlob(new Blob([extra.join('\n')], { type: 'text/plain' }), 'my-stopwords.txt')) : null),
        h('span', { className: 'tl-hint' }, 'Tip: click × next to any word in a results table to add it here. Wildcards work: rt* removes rt, rts …')),
      h('div', { className: 'tl-row wide' },
        this.tlField('Word forms', this.tlSeg([['none', 'As written'], ['stem', 'Stems' + (stemOk ? '' : ' (es/en only)'), 'tokens_wordstem: trabajadores, trabajando → trabaj'], ['lemma', 'Lemmas' + (lemOk ? '' : ' (es/en/pt/fr)'), 'dictionary forms: trabajadores → trabajador, becaremos → becar']], R.forms, v => set({ forms: v }))),
        this.tlField('Shortest word', this.tlSeg([[1, '1+'], [2, '2+ letters'], [3, '3+'], [4, '4+']], R.minLen, v => set({ minLen: v })))),
      this.tlField('Join phrases (they count as one word)',
        h('div', { className: 'tl-row' }, ...phrases.map(p => this.tlChip(['✓ ' + p, h('span', { className: 'x', key: 'x' }, ' ×')], false, () => set({ phrases: phrases.filter(x => x !== p) }), { key: p, className: 'tl-chip soft' })),
          this.tlText('', s => { const p = s.trim().toLowerCase().replace(/\s+/g, ' '); if (p.includes(' ') && !phrases.includes(p)) set({ phrases: phrases.concat([p]) }); }, { placeholder: 'type a phrase, e.g. guardia nacional', width: 230, clear: true, k: 'ph' + phrases.length })),
        sugg.pending ? h('span', { className: 'tl-hint' }, 'Finding common phrases…') : h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'Suggested:'), ...sugg.rows.filter(r => !phrases.includes(r.words.join(' '))).slice(0, 10).map(r => this.tlChip(['+ ' + r.words.join(' '), h('em', { key: 'n' }, ' ' + this.fmtN(r.count))], false, () => set({ phrases: phrases.concat([r.words.join(' ')]) }), { key: r.words.join(' '), className: 'tl-chip add', title: 'z = ' + r.z.toFixed(1) })))),
      this.tlField('Rare and very common words', h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, 'Leave out words found in fewer than'), this.tlNum(R.minDoc, v => set({ minDoc: v }), { min: 1, aria: 'Minimum number of texts' }), h('span', { className: 'tl-hint' }, 'texts, or in more than'), this.tlNum(R.maxDocPct, v => set({ maxDocPct: v }), { min: 1, max: 100, aria: 'Maximum percent of texts' }), h('span', { className: 'tl-hint' }, '% of texts (dfm_trim)'))));
    // live preview of one text
    const n = C.off.length - 1, live = []; for (let d = 0; d < n && live.length < 4000; d++) if (!C.blank[d]) live.push(d);
    const pi = ((T.prev % live.length) + live.length) % live.length, d = live[pi];
    const parts = this.tlExplain(ctx, d);
    const nav = h('span', { className: 'tl-pr' }, this.tlBtn('‹', () => this.tlSet({ prev: pi - 1 }), '', { 'aria-label': 'Previous text' }), this.tlBtn('Random', () => this.tlSet({ prev: Math.floor(Math.random() * live.length) })), this.tlBtn('›', () => this.tlSet({ prev: pi + 1 }), '', { 'aria-label': 'Next text' }));
    const before = this.memo('tlWordsAll|' + C.key, () => { let w = 0; for (let i = 0; i < C.tok.length; i++) if (C.kind[C.tok[i]] === 1) w++; return w; });
    const prev = this.tlPanel('See one text change', 'row ' + this.fmtN(this.tlRowOf(C, d) + 1), nav,
      h('div', { className: 'tl-quote' }, String(C.texts[d]).slice(0, 900)),
      h('span', { className: 'tl-lbl' }, 'After cleaning'),
      h('div', { className: 'tl-toks' }, parts.map((p, i) => h('span', { key: i, className: 'tl-tk ' + p.cls, title: p.why }, p.text))),
      R.forms !== 'none' ? h('span', { className: 'tl-lbl' }, R.forms === 'stem' ? 'Counted as (stems)' : 'Counted as (lemmas)') : null,
      R.forms !== 'none' ? h('div', { className: 'tl-toks' }, parts.filter(p => p.feat).map((p, i) => h('span', { key: i, className: 'tl-tk ' + p.cls }, p.feat))) : null,
      h('div', { className: 'tl-legend' }, ['kept', 'stop', 'url', 'tag', 'phr', 'inc', 'rare'].map(c => h('span', { key: c, className: 'tl-tk ' + c }, { kept: 'kept', stop: 'common word', url: 'removed', tag: '#tag / @name', phr: 'phrase', inc: 'inclusive spelling', rare: 'too rare' }[c]))),
      h('div', { className: 'tl-stats' }, this.tlStat('Texts', this.fmtN(C.docs)), this.tlStat('Words kept', this.fmtN(FT.total), 'of ' + this.fmtN(before) + ' words'), this.tlStat('Different words', this.fmtN(FT.order.length), 'before cleaning: ' + this.fmtN(C.types.length)), this.tlStat('Words per text', this.fmt(FT.total / Math.max(1, C.docs), 1), 'after cleaning')));
    return h('div', { className: 'tl-col' }, h('div', { className: 'tl-grid c-l' }, ctl, prev), this.tlNav(['texts', 'Texts'], ['explore', 'Next: Explore']));
  }
  tlExplain(ctx, d) {
    const { T, C, FT } = ctx, E = this._E, R = FT.R, fold = !!R.fold, F = s => fold ? E.tlFold(s) : s;
    const stop = this.memo('tlStopSet|' + JSON.stringify([R.langs, R.stopSource, R.extra, fold]), () => E.tlStopSet(R.langs, R.stopSource, R.extra, fold));
    const ctypeId = this.memo('tlCT|' + FT.sig, () => new Map(FT.ctypes.map((t, i) => [t, i])));
    const s = String(C.texts[d]), out = [], a = C.off[d], b = C.off[d + 1];
    const phr = (R.phrases || []).filter(p => p.length > 1).map(p => p.map(x => F(x)));
    for (let i = a; i < b;) {
      let L = 0;
      for (const p of phr) { if (i + p.length > b) continue; let ok = true; for (let j = 0; j < p.length; j++) if (F(C.types[C.tok[i + j]]) !== p[j] || (j && C.brk[i + j])) { ok = false; break; } if (ok && p.length > L) L = p.length; }
      if (L > 1) { const label = Array.from(C.tok.subarray(i, i + L), t => C.types[t]).join(' '), ct = ctypeId.get(label), f = ct != null ? FT.fid[ct] : -1; out.push({ text: s.slice(C.start[i], C.end[i + L - 1]), cls: f >= 0 && FT.count[f] > 0 ? 'phr' : 'rare', feat: f >= 0 ? FT.label[f] : null, why: 'joined phrase' }); i += L; continue; }
      const t = C.tok[i], k = C.kind[t], w = C.types[t], f = FT.fid[t], text = s.slice(C.start[i], C.end[i]);
      let cls = 'kept', why = '';
      if (k === 4) { cls = R.url === 'remove' ? 'url' : 'kept'; why = 'link'; }
      else if (k === 5) { cls = R.num === 'remove' ? 'url' : 'kept'; why = 'number'; }
      else if (k === 6) { cls = R.emoji === 'remove' ? 'url' : 'kept'; why = 'emoji'; }
      else if (k === 2) { cls = R.tag === 'remove' ? 'url' : R.tag === 'word' ? 'kept' : 'tag'; why = 'hashtag'; }
      else if (k === 3) { cls = R.mention === 'remove' ? 'url' : 'tag'; why = 'mention'; }
      else if (stop.has(F(w))) { cls = 'stop'; why = 'common word (stopword)'; }
      else if ([...w].length < (R.minLen || 1)) { cls = 'stop'; why = 'shorter than ' + R.minLen + ' letters'; }
      else if (/@/.test(w)) { cls = 'inc'; why = 'inclusive spelling kept whole'; }
      if ((cls === 'kept' || cls === 'tag' || cls === 'inc') && (f < 0 || !(FT.count[f] > 0))) { cls = 'rare'; why = 'left out by the rare / common word rule'; }
      out.push({ text, cls, why, feat: f >= 0 && (cls === 'kept' || cls === 'tag' || cls === 'inc') ? FT.label[f] : null });
      i++;
    }
    return out;
  }
  // phrase suggestions: collocations of 2–3 words on the uncleaned tokens (background worker)
  tlPhraseSuggest(T, C) {
    const langs = this.tlLangs(T, C), min = Math.max(5, Math.round(C.docs / 2000));
    const key = 'tlPS|' + C.key + '|' + langs.join(',') + '|' + min;
    const J = this.tlJob(key, 'tlPhraseSugg', () => [C, { langs, fold: !!T.rec.fold, minCount: min, stopSource: T.rec.stopSource }], 'Finding phrases');
    if (!J.done) return { pending: true };
    return { rows: J.value || [] };
  }
  // generic background job with memory: returns { done, value, p }
  tlJob(key, fn, argsFn, label) {
    this._tlJobs = this._tlJobs || {};
    const J = this._tlJobs[key];
    if (J) return J.status === 'done' ? { done: true, value: J.value } : { done: false, p: J.p || 0, label: J.label };
    const job = this._tlJobs[key] = { status: 'run', p: 0, label };
    (async () => {
      let res, ok = false; const args = argsFn();
      try { const w = await this.wkStart(fn, args, p => { job.p = p; clearTimeout(this._tlPT); this._tlPT = setTimeout(() => this.forceUpdate(), 150); }); if (w) { job.worker = w.w; const r = await w.done; if (r.ok) { res = r.v; ok = true; } else job.err = r.e; } } catch (e) { job.err = String(e); }
      if (!ok && !job.cancelled) { try { let v = this._E[fn](...args); if (v && typeof v.next === 'function') { let r; while (!(r = v.next()).done); v = r.value; } res = v; ok = true; } catch (e) { job.err = String(e && e.message || e); } }
      if (job.cancelled) return;
      this._tlJobs[key] = { status: 'done', value: ok ? res : null, err: job.err };
      this.forceUpdate();
    })();
    return { done: false, p: 0, label };
  }
  tlCancel(key) { const J = this._tlJobs && this._tlJobs[key]; if (J && J.worker) { try { J.worker.terminate(); } catch (e) {} } if (J) J.cancelled = true; delete this._tlJobs[key]; this.forceUpdate(); }
