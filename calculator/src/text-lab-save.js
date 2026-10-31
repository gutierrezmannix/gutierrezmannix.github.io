  // ---- step 5: save to the dataset
  tlStepSave(ctx) {
    const h = React.createElement, { T, C, FT } = ctx, SV = T.save, set = p => this.tlSetIn('save', p), E = this._E;
    const L = this.tlDictLook(ctx), cats = L ? L.cats : [];
    const plan = this.tlSavePlan(ctx);
    const opts = h('div', { className: 'tl-col' },
      this.tlField('For each dictionary category' + (cats.length ? ' (' + cats.map(c => c.name).join(', ') + ')' : ''), h('div', { className: 'tl-row' }, this.tlChip('Count of mentions', SV.count, () => set({ count: !SV.count })), this.tlChip('1 / 0 any mention', SV.any, () => set({ any: !SV.any })), this.tlChip('Per 100 words', SV.p100, () => set({ p100: !SV.p100 })), this.tlChip('Share of words (%)', SV.share, () => set({ share: !SV.share }))), !cats.length ? h('span', { className: 'tl-hint' }, 'No categories yet — build them in Measure → Dictionary.') : null),
      this.tlField('Also add', h('div', { className: 'tl-row' }, this.tlChip('Words in the text', SV.nwords, () => set({ nwords: !SV.nwords }), { title: 'All words before cleaning (links, numbers and emoji not counted)' }), this.tlChip('Words kept after cleaning', SV.nkept, () => set({ nkept: !SV.nkept })), this.tlChip('Main topic', SV.topic, () => set({ topic: !SV.topic })), this.tlChip('Topic shares', SV.shares, () => set({ shares: !SV.shares })), this.tlChip('Sentiment score', SV.sent, () => set({ sent: !SV.sent })), this.tlChip('Predicted label', SV.nb, () => set({ nb: !SV.nb })))),
      this.tlField('Rows', this.tlSeg([['all', 'All ' + this.fmtN(this._raw.n) + ' rows'], ['subgroup', 'Current subgroup only (others = missing)']], SV.rows, v => set({ rows: v })), h('span', { className: 'tl-hint' }, 'Rows with no text get a missing value (.), never 0.' + (T.unit === 'sentence' ? ' Sentence results are added up for each row.' : ''))),
      this.tlField('Name prefix', h('div', { className: 'tl-row' }, this.tlText(SV.prefix, v => set({ prefix: v.replace(/[^A-Za-z0-9_]/g, '') }), { aria: 'Variable name prefix', width: 80, mono: true, k: 'pre' }), h('span', { className: 'tl-hint' }, '→ ' + plan.vars.map(v => v.name).slice(0, 6).join(', ') + (plan.vars.length > 6 ? ', …' : '')))),
      plan.problems.map((p, i) => h(React.Fragment, { key: i }, this.tlBanner('warn', p))),
      h('div', { className: 'tl-row' }, this.tlBtn('Add ' + plan.vars.length + ' variable' + (plan.vars.length === 1 ? '' : 's'), () => this.tlSaveRun(ctx, plan), 'primary', { disabled: !plan.vars.length || plan.problems.length > 0 }), this.tlBtn('Download as CSV', () => this.tlSaveCsv(ctx, plan), '', { disabled: !plan.vars.length })));
    const prev = this.tlSavePreview(ctx, plan);
    const done = T.saveMsg ? this.tlBanner(T.saveOk ? 'ok' : 'warn', T.saveMsg) : null;
    return h('div', { className: 'tl-col' }, h('div', { className: 'tl-grid c-save' }, this.tlPanel('Add results to the dataset', 'new columns work in every tab', null, opts, done), this.tlPanel('Preview', 'rows picked to show each case', null, prev, this.tlRcode(this.tlSaveR(ctx, plan)))), this.tlNav(['measure', 'Measure'], null));
  }
  // which columns, with values for every row of the dataset
  tlSavePlan(ctx) {
    const { T, C, FT } = ctx, SV = T.save, E = this._E, raw = this._raw, n = raw.n, nd = C.off.length - 1;
    const L = this.tlDictLook(ctx), cats = L ? L.cats : [], vars = [], problems = [];
    const ours = new Set(Object.keys(this.state.genTags || {}).filter(k => (this.state.genTags || {})[k] === 'text'));
    const taken = new Set(raw.names.filter(x => !ours.has(x)));
    const mk = (base, label) => { const name = E.tlVarName((SV.prefix || '') + base, taken); taken.add(name); return { name, label }; };
    const rowMask = SV.rows === 'subgroup' ? this.mask() : null;
    const perRow = (fn) => { const a = new Float64Array(n).fill(NaN); for (let d = 0; d < nd; d++) { const r = this.tlRowOf(C, d); if (rowMask && !rowMask[r]) continue; if (C.blank[d]) continue; const v = fn(d); a[r] = isFinite(a[r]) ? a[r] + v : v; } return a; };
    const words = this.memo('tlNW|' + C.key, () => { const w = new Float64Array(nd); for (let d = 0; d < nd; d++) { let k = 0; for (let i = C.off[d]; i < C.off[d + 1]; i++) if (C.kind[C.tok[i]] === 1) k++; w[d] = k; } return w; });
    const nwRow = perRow(d => words[d]);
    const names = cats.map(c => c.name.toLowerCase()); const dup = names.find((x, i) => names.indexOf(x) !== i);
    if (dup) problems.push('Two dictionary categories are both called “' + dup + '”. Rename one in Measure → Dictionary.');
    cats.forEach((c, ci) => {
      const cnt = perRow(d => L.res[ci].counts[d]);
      const desc = 'text dictionary ' + c.name + ': ' + c.keys + (c.off.length ? ' (except ' + c.off.join(', ') + ')' : '');
      if (SV.count) vars.push(Object.assign(mk(c.name, 'mentions of ' + desc), { a: cnt, kind: 'count', cat: ci }));
      if (SV.any) vars.push(Object.assign(mk(c.name + '_any', 'any mention (1/0) of ' + desc), { a: Float64Array.from(cnt, v => isFinite(v) ? (v > 0 ? 1 : 0) : NaN), kind: 'any', cat: ci }));
      if (SV.p100) vars.push(Object.assign(mk(c.name + '_p100', 'mentions per 100 words: ' + desc), { a: Float64Array.from(cnt, (v, r) => isFinite(v) && nwRow[r] > 0 ? 100 * v / nwRow[r] : (isFinite(v) ? 0 : NaN)), kind: 'p100', cat: ci }));
      if (SV.share) vars.push(Object.assign(mk(c.name + '_share', '% of words: ' + desc), { a: Float64Array.from(cnt, (v, r) => isFinite(v) && nwRow[r] > 0 ? 100 * v / nwRow[r] : (isFinite(v) ? 0 : NaN)), kind: 'share', cat: ci }));
    });
    if (SV.nwords) vars.push(Object.assign(mk('n_words', ''), { a: nwRow, kind: 'nwords', label: 'number of words in ' + T.v }));
    if (SV.nkept) vars.push(Object.assign(mk('n_kept', ''), { a: perRow(d => FT.foff[d + 1] - FT.foff[d]), kind: 'nkept', label: 'words kept after cleaning in ' + T.v }));
    if (SV.topic || SV.shares) {
      const TD = this.tlTopicDocs(ctx), seeded = T.top.method === 'seeded' ? this.tlSeeds(ctx, TD) : null, J = this._tlJobs && this._tlJobs[this.tlTopicKey(ctx, TD)];
      if (!J || J.status !== 'done' || !J.value) problems.push('Run a topic model first (Measure → Topics).');
      else {
        const M = J.value, K = M.K, theta = this.tlTopicTheta(ctx, TD, M), labels = this.tlTopicLabels(ctx, M, seeded);
        if (SV.topic) { const a = perRow(d => { const r = TD.rows[d]; if (r < 0) return NaN; let b = 0; for (let k = 1; k < K; k++) if (theta[r * K + k] > theta[r * K + b]) b = k; return isFinite(theta[r * K]) ? b + 1 : NaN; }); vars.push(Object.assign(mk('topic', ''), { a, kind: 'topic', label: 'main topic (LDA, k = ' + K + ')', vl: labels })); }
        if (SV.shares) for (let k = 0; k < K; k++) vars.push(Object.assign(mk('topic' + (k + 1), ''), { a: perRow(d => { const r = TD.rows[d]; return r < 0 ? NaN : theta[r * K + k]; }), kind: 'share', label: 'share of topic ' + (k + 1) + ': ' + labels[k] }));
      }
    }
    if (SV.sent) { const sc = this.tlSentScores(ctx); if (!sc) problems.push('Set up Sentiment first (Measure → Sentiment).'); else vars.push(Object.assign(mk('sentiment', ''), { a: perRow(d => sc.v[d]), kind: 'sent', label: sc.name + ' of ' + T.v })); }
    if (SV.nb) {
      const NB = T.nb, G = NB.y ? this.tlGroupsOf(T, C, NB.y) : null, R = G ? this._memo && Object.keys(this._memo).find(k => k.startsWith('tlNB|' + FT.sig + '|' + NB.y + '|')) : null;
      if (!G || !R) problems.push('Run Classify first (Measure → Classify).');
      else { const m2 = this._memo[R].m2; vars.push(Object.assign(mk('pred_' + NB.y, ''), { a: perRow(d => m2.pred[d] >= 0 ? m2.pred[d] + 1 : NaN), kind: 'nb', label: 'predicted ' + NB.y + ' (Naive Bayes)', vl: G.labels })); vars.push(Object.assign(mk('prob_' + NB.y, ''), { a: perRow(d => m2.prob[d]), kind: 'nbp', label: 'probability of the predicted ' + NB.y })); }
    }
    return { vars, problems, cats, L, nwRow };
  }
  tlSavePreview(ctx, plan) {
    const h = React.createElement, { C, T } = ctx, raw = this._raw;
    if (!plan.vars.length) return this.tlBanner('info', 'Choose what to add on the left.');
    const counts = plan.vars.filter(v => v.kind === 'count'), pick = [], seen = new Set();
    const want = [r => counts.some(v => v.a[r] >= 2), r => counts.filter(v => v.a[r] > 0).length >= 2, r => counts.some(v => v.a[r] === 1), r => counts.length && counts.every(v => v.a[r] === 0), r => isFinite(plan.vars[0].a[r])];
    for (const f of want) { for (let r = 0; r < raw.n && pick.length < 5; r++) if (!seen.has(r) && f(r)) { pick.push(r); seen.add(r); break; } }
    const text = this.tlTexts(T.v), cols = plan.vars.slice(0, 9);
    const fmtv = (v, x) => !isFinite(x) ? '.' : (v.kind === 'p100' || v.kind === 'share' || v.kind === 'sent' || v.kind === 'nbp') ? this.fmt(x, 3) : String(Math.round(x * 1000) / 1000);
    const tbl = h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', { className: 'n' }, 'Row'), h('th', null, 'Text'), ...cols.map(v => h('th', { key: v.name, className: 'n' }, v.name)))),
      h('tbody', null, pick.map(r => h('tr', { key: r }, h('td', { className: 'n' }, this.fmtN(r + 1)), h('td', { className: 'txt' }, String(text[r] == null ? '(blank)' : text[r]).slice(0, 140)), ...cols.map(v => h('td', { key: v.name, className: 'n' }, fmtv(v, v.a[r]))))))));
    // totals check: saved columns add up to the dictionary table
    const checks = [];
    if (plan.L) plan.vars.filter(v => v.kind === 'count' || v.kind === 'any').forEach(v => { let s = 0; for (const x of v.a) if (isFinite(x)) s += x; const r = plan.L.res[v.cat], mask = T.save.rows === 'subgroup' ? ctx.mask : null; let exp = 0; for (let d = 0; d < r.counts.length; d++) { if (mask && !mask[d]) continue; const x = r.counts[d]; if (isFinite(x)) exp += v.kind === 'any' ? (x > 0 ? 1 : 0) : x; } checks.push([v.name, s, T.unit === 'sentence' && v.kind === 'any' ? null : exp]); });
    const okAll = checks.every(([, s, e]) => e == null || Math.abs(s - e) < 1e-9);
    return h('div', { className: 'tl-col' }, tbl, checks.length ? this.tlBanner(okAll ? 'ok' : 'warn', okAll ? '✓ Totals match the dictionary table: ' : 'Totals differ from the dictionary table: ', checks.map(([nm, s, e]) => nm + ' sums to ' + this.fmtN(s) + (e != null && Math.abs(s - e) > 1e-9 ? ' (table: ' + this.fmtN(e) + ')' : '')).join(', ') + '.') : null);
  }
  tlSaveRun(ctx, plan) {
    const raw = this._raw, made = [], E = this._E, T = ctx.T;
    this.snap('add text variables');
    const genTags = Object.assign({}, this.state.genTags || {}), treat = Object.assign({}, this.state.treat || {}), update = [];
    for (const v of plan.vars) {
      const ix = raw.names.indexOf(v.name);
      if (ix >= 0) { raw.cols[ix] = { k: 'n', a: v.a }; raw.labels[ix] = v.label; update.push(ix); made.push(v.name + ' (updated)'); }
      else { raw.names.push(v.name); raw.labels.push(v.label); raw.cols.push({ k: 'n', a: v.a }); made.push(v.name); }
      if (v.vl) { raw.vlabs = raw.vlabs || Object.create(null); raw.vlabs[v.name] = new Map(v.vl.map((l, i) => [i + 1, String(l)])); }
      genTags[v.name] = 'text'; treat[v.name] = v.vl ? 'categorical' : 'numeric';
    }
    const newIdx = raw.names.map((n, i) => i).filter(i => !this.state.cols.some(c => c.idx === i));
    const cols = this.state.cols.map(c => update.includes(c.idx) ? Object.assign(E.profileCol(raw, c.idx, this.state.autoScreen), { idx: c.idx }) : c).concat(newIdx.map(i => Object.assign(E.profileCol(raw, i, this.state.autoScreen), { idx: i })));
    this._dataRev = (this._dataRev || 0) + 1; this.clearMemo();
    const msg = 'Added ' + made.join(', ') + '. They are in the variable list and work in every tab; File → Save data keeps them.';
    this.setState({ cols, genTags, treat, nRows: raw.n, dver: (this.state.dver || 0) + 1 });
    this.tlSet({ saveMsg: msg, saveOk: true });
    this.pushLog({ t: 'txdict', r: this.tlSaveR(ctx, plan), res: msg });
  }
  tlSaveCsv(ctx, plan) {
    const raw = this._raw, head = ['row'].concat(plan.vars.map(v => v.name)), lines = [head.join(',')];
    for (let r = 0; r < raw.n; r++) lines.push([r + 1].concat(plan.vars.map(v => isFinite(v.a[r]) ? v.a[r] : '')).join(','));
    this.dlBlob(new Blob([lines.join('\n')], { type: 'text/csv' }), 'text-variables.csv');
  }
  tlSaveCluster(ctx, CU, labels, cl, rowDocs) {
    const { T, C } = ctx, raw = this._raw, a = new Float64Array(raw.n).fill(NaN);
    if (CU.what === 'texts') rowDocs.forEach((d, i) => { a[this.tlRowOf(C, d)] = cl[i]; });
    else { const G = this.tlGroupsOf(T, C, T.by), D = CU.byYear && T.date ? this.tlDates(T, C) : null, idx = new Map(labels.map((l, i) => [l, i])); for (let d = 0; d < C.off.length - 1; d++) { if (G.g[d] < 0) continue; let k = G.labels[G.g[d]]; if (D) { const y = this._E.tlPeriod(D.day[d], 'year'); if (!y) continue; k += ' ' + y.label; } const i = idx.get(k); if (i !== undefined) a[this.tlRowOf(C, d)] = cl[i]; } }
    const name = this._E.tlVarName('cluster_' + (CU.what === 'texts' ? 'text' : T.by), new Set(raw.names));
    this.tlSaveRun(ctx, { vars: [{ name, label: 'cluster (' + CU.link + ' linkage, ' + CU.dist + ', k = ' + CU.k + ')', a, kind: 'cluster' }] });
    this.flash('Added ' + name);
  }

  // ---- R code
  tlRvec(arr) { return 'c(' + arr.map(s => JSON.stringify(s)).join(', ') + ')'; }
  tlRcode(code) { const h = React.createElement; return h('details', { className: 'tl-details code' }, h('summary', null, 'R code (quanteda)'), h('pre', { className: 'tl-code' }, code), this.tlBtn(this.state.copied === 'tlr' ? 'Copied ✓' : 'Copy', () => this.copyTSV('tlr', code))); }
  tlRecipeR(ctx) {
    const { T, C, FT } = ctx, R = FT.R, E = this._E, LN = Object.fromEntries(E.TL_LANGS);
    const file = this.state.fileName || 'data.csv', isX = /\.xlsx?$/i.test(file);
    const L = [];
    L.push('library(quanteda)', 'library(quanteda.textstats)', 'library(quanteda.textplots)');
    L.push(isX ? 'df <- as.data.frame(readxl::read_excel("' + file + '"))' : 'df <- read.csv("' + file + '", encoding = "UTF-8")');
    L.push('corp <- corpus(df, text_field = "' + T.v + '")' + (T.unit === 'sentence' ? ' |> corpus_reshape(to = "sentences")' : ''));
    L.push('toks <- tokens(corp, remove_punct = TRUE, remove_symbols = ' + (R.emoji === 'remove' ? 'TRUE' : 'FALSE') + ', remove_numbers = ' + (R.num === 'remove' ? 'TRUE' : 'FALSE') + ', remove_url = ' + (R.url === 'remove' ? 'TRUE' : 'FALSE') + ', split_hyphens = ' + (R.hyphen === 'split' ? 'TRUE' : 'FALSE') + ', split_tags = ' + (R.tag === 'word' ? 'TRUE' : 'FALSE') + ') |>\n  tokens_tolower()');
    if (R.fold) L.push('# ignore accents (keeps ñ and ç): á→a, é→e, ü→u …', 'fold <- function(x) stringi::stri_trans_general(x, "NFD; [[:Mn:] - [\\\\u0303\\\\u0327]] Remove; NFC")', 'toks <- tokens_replace(toks, types(toks), fold(types(toks)), valuetype = "fixed")');
    if (R.mention === 'remove') L.push('toks <- tokens_remove(toks, "@*")');
    if (R.tag === 'remove') L.push('toks <- tokens_remove(toks, "#*")');
    const ph = (R.phrases || []).map(p => p.join(' '));
    if (ph.length) L.push('toks_c <- tokens_compound(toks, phrase(' + this.tlRvec(R.fold ? ph.map(E.tlFold) : ph) + '), concatenator = " ")'); else L.push('toks_c <- toks');
    const sw = R.langs.map(l => 'stopwords("' + l + '"' + (R.stopSource === 'iso' ? ', source = "stopwords-iso"' : '') + ')');
    if (sw.length || (R.extra || []).length) L.push('stop <- c(' + sw.concat((R.extra || []).length ? [this.tlRvec(R.extra)] : []).join(', ') + ')' + (R.fold ? '\nstop <- fold(stop)' : ''), 'toks_clean <- tokens_remove(toks_c, stop, min_nchar = ' + (R.minLen || 1) + ')');
    else L.push('toks_clean <- tokens_select(toks_c, min_nchar = ' + (R.minLen || 1) + ')');
    if (R.forms === 'stem') L.push('toks_clean <- tokens_wordstem(toks_clean, language = "' + R.stemLang + '")');
    if (R.forms === 'lemma') L.push('# lemmas: spaCy lookup table (spacy-lookups-data, ' + R.stemLang + '_lemma_lookup.json)', 'lem <- jsonlite::fromJSON("' + R.stemLang + '_lemma_lookup.json"); toks_clean <- tokens_replace(toks_clean, names(lem), unlist(lem))');
    L.push('dfmat <- dfm(toks_clean)' + (R.minDoc > 1 ? ' |> dfm_trim(min_docfreq = ' + R.minDoc + ')' : '') + (R.maxDocPct < 100 ? ' |> dfm_trim(max_docfreq = ' + (R.maxDocPct / 100) + ', docfreq_type = "prop")' : ''));
    L.push('topfeatures(dfmat, 25)', 'textplot_wordcloud(dfmat, max_words = ' + T.cloud.max + ', rotation = ' + T.cloud.rotate + ')');
    return '# ' + (LN[R.langs[0]] || '') + ' texts · recipe from GM26 text analysis\n' + L.join('\n');
  }
  tlDictR(ctx, L) {
    const E = this._E, T = ctx.T;
    const vals = c => { const ps = E.tlParsePatterns(c.keys), inc = ps.filter(p => !p.neg).map(p => p.parts.join(' ')); const all = []; for (const p of inc) { all.push(T.rec.fold ? E.tlFold(p) : p); if (!/^[#@]/.test(p) && p.indexOf(' ') < 0) all.push('#' + (T.rec.fold ? E.tlFold(p) : p)); } return all; };
    const hasEx = L.cats.some(c => c.off.length || E.tlParsePatterns(c.keys).some(p => p.neg));
    let r = 'dict <- dictionary(list(\n' + L.cats.map(c => '  ' + JSON.stringify(c.name) + ' = ' + this.tlRvec(vals(c))).join(',\n') + '\n))';
    if (hasEx) r += '\n# exclusions: these words never count\n' + L.cats.filter(c => c.off.length || E.tlParsePatterns(c.keys).some(p => p.neg)).map(c => '# ' + c.name + ': ' + c.off.concat(E.tlParsePatterns(c.keys).filter(p => p.neg).map(p => p.parts.join(' '))).join(', ')).join('\n') + '\n# (remove them first, e.g. tokens_remove(toks, c("seguro")), when they belong to no category)';
    return r + '\ncounts <- convert(dfm(tokens_lookup(toks, dict, nested_scope = "key")), to = "data.frame")';
  }
  tlSaveR(ctx, plan) {
    const { T } = ctx, out = [this.tlRecipeR(ctx)];
    if (plan.L) { out.push(this.tlDictR(ctx, plan.L)); out.push('blank <- is.na(df$' + T.v + ') | trimws(df$' + T.v + ') == ""', 'nw <- ntoken(tokens_select(toks, "^\\\\p{L}", valuetype = "regex"))'); }
    for (const v of plan.vars) {
      const c = v.cat != null ? plan.L.cats[v.cat].name : '';
      if (v.kind === 'count') out.push('df$' + v.name + ' <- ifelse(blank, NA, counts[["' + c + '"]])');
      else if (v.kind === 'any') out.push('df$' + v.name + ' <- ifelse(blank, NA, as.integer(counts[["' + c + '"]] > 0))');
      else if (v.kind === 'p100' || v.kind === 'share') out.push('df$' + v.name + ' <- ifelse(blank, NA, 100 * counts[["' + c + '"]] / pmax(nw, 1))');
      else if (v.kind === 'nwords') out.push('df$' + v.name + ' <- ifelse(blank, NA, nw)');
      else if (v.kind === 'nkept') out.push('df$' + v.name + ' <- ifelse(blank, NA, ntoken(dfmat))');
    }
    const S = this.state.dialect === 'stata';
    return (S ? '* Stata has no text tokenizer; these columns are saved with the dataset.\n* The same columns in R (quanteda):\n' : '') + out.join('\n');
  }
  tlCodePanel(ctx) { const h = React.createElement, code = this.tlRecipeR(ctx); return this.tlPanel('Recipe · R code', 'the cleaning steps every result uses', this.tlBtn(this.state.copied === 'tlrr' ? 'Copied ✓' : 'Copy', () => this.copyTSV('tlrr', code)), h('pre', { className: 'tl-code' }, code)); }

  // ---- export: SVG with the fonts embedded, PNG at 150/300/600 dpi with pHYs metadata
  tlExportRow(key, name) {
    const h = React.createElement;
    return h('div', { className: 'tl-exp' }, h('span', { className: 'tl-hint' }, 'Download'), ...[150, 300, 600].map(dpi => this.tlBtn('PNG ' + dpi + ' dpi', () => this.tlExport(key, name, 'png', dpi), '', { key: dpi })), this.tlBtn('SVG', () => this.tlExport(key, name, 'svg')));
  }
  tlFontCss(svgXml) {
    const fams = ['Hanken Grotesk', 'Bricolage Grotesque', 'Space Mono'].filter(f => svgXml.indexOf(f) >= 0); if (!fams.length) return '';
    const out = [];
    for (const sh of Array.from(document.styleSheets)) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const r of Array.from(rules || [])) { if (r.type !== 5) continue; const fam = (r.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim(); if (fams.includes(fam) && !/italic/.test(r.style.getPropertyValue('font-style'))) out.push(r.cssText); } }
    return out.join('\n');
  }
  async tlExport(key, name, fmt, dpi) {
    const svg = this._svgs && this._svgs[key]; if (!svg || !svg.isConnected) { this.flash('Nothing to save yet'); return; }
    const vb = svg.viewBox.baseVal; let xml = this.svgExport(svg, name);
    xml = xml.replace(/font-family="[^"]*"/g, m => m).replace(/'Hanken Grotesk', Arial, Helvetica, sans-serif/g, "'Hanken Grotesk', Arial, Helvetica, sans-serif");
    const css = this.tlFontCss(xml);
    if (css) xml = xml.replace(/(<svg[^>]*>)/, '$1<defs><style type="text/css"><![CDATA[\n' + css + '\n]]></style></defs>');
    if (fmt === 'svg') { this.dlBlob(new Blob([xml], { type: 'image/svg+xml' }), name + '.svg'); this.flash('Saved ' + name + '.svg (fonts included)'); return; }
    try {
      const url = await this.plotPng({ xml, w: vb.width, h: vb.height }, dpi / 96);
      const png = this.tlPngDpi(this.b64bytes(url), dpi);
      this.dlBlob(new Blob([png], { type: 'image/png' }), name + '-' + dpi + 'dpi.png');
      this.flash('Saved ' + name + '-' + dpi + 'dpi.png (' + Math.round(vb.width * dpi / 96) + ' × ' + Math.round(vb.height * dpi / 96) + ' px)');
    } catch (e) { this.flash('Could not render this plot as PNG'); }
  }
  tlPngDpi(bytes, dpi) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); if (u8.length < 33) return u8;
    const ppm = Math.round(dpi / 0.0254), data = new Uint8Array([0x70, 0x48, 0x59, 0x73, ppm >>> 24, (ppm >>> 16) & 255, (ppm >>> 8) & 255, ppm & 255, ppm >>> 24, (ppm >>> 16) & 255, (ppm >>> 8) & 255, ppm & 255, 1]);
    let c = 0xFFFFFFFF; for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } c = (c ^ 0xFFFFFFFF) >>> 0;
    const chunk = new Uint8Array(4 + 13 + 4); chunk.set([0, 0, 0, 9], 0); chunk.set(data, 4); chunk.set([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255], 17);
    const out = new Uint8Array(u8.length + chunk.length); out.set(u8.subarray(0, 33), 0); out.set(chunk, 33); out.set(u8.subarray(33), 33 + chunk.length); return out;
  }

  // ---- charts (ggplot2-like conventions: light grid, direct labels, no chart junk)
  tlBarsSvg(key, rows, o) {
    const h = React.createElement, n = rows.length; if (!n) return null;
    if (o.vertical) {
      const W = 760, H = 300, L = 46, B = 54, Tt = 28, mx = Math.max(...rows.map(r => r.value), 1), bw = (W - L - 10) / n;
      const ticks = this.tlTicks(0, mx, 4);
      return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': o.title, ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }), h('text', { x: L, y: 16, fontSize: 12, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#1A1711' }, o.title),
        ticks.map((t, i) => { const y = H - B - (H - B - Tt) * t / ticks[ticks.length - 1]; return h('g', { key: i }, h('line', { x1: L, x2: W - 10, y1: y, y2: y, stroke: '#ECE6DA' }), h('text', { x: L - 6, y: y + 3.5, fontSize: 10, textAnchor: 'end', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, this.fmtN(t))); }),
        rows.map((r, i) => { const hh = (H - B - Tt) * r.value / ticks[ticks.length - 1]; return h('g', { key: i }, h('rect', { x: L + i * bw + 1, y: H - B - hh, width: Math.max(1, bw - 2), height: hh, fill: r.color, rx: 1.5 }), i % Math.ceil(n / 10) === 0 ? h('text', { x: L + i * bw + bw / 2, y: H - B + 14, fontSize: 9.5, textAnchor: 'middle', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, r.label) : null); }),
        h('text', { x: (W + L) / 2, y: H - 10, fontSize: 10.5, textAnchor: 'middle', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, 'words per text'), h('text', { x: 12, y: (H - B + Tt) / 2, fontSize: 10.5, textAnchor: 'middle', transform: 'rotate(-90 12 ' + (H - B + Tt) / 2 + ')', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.xlab));
    }
    const rowH = 22, Tt = 30, L = Math.min(230, 14 + 7.2 * Math.max(...rows.map(r => String(r.label).length))), R = 70, W = 760, H = Tt + n * rowH + 34;
    const vals = rows.map(r => r.value), lo = o.diverging ? Math.min(0, ...vals) : 0, hi = Math.max(0, ...vals) || 1, ticks = this.tlTicks(lo, hi, 5), t0 = ticks[0], t1 = ticks[ticks.length - 1];
    const X = v => L + (W - L - R) * (v - t0) / ((t1 - t0) || 1);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': o.title, ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      h('text', { x: 8, y: 18, fontSize: 12.5, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#1A1711' }, o.title),
      ticks.map((t, i) => h('g', { key: i }, h('line', { x1: X(t), x2: X(t), y1: Tt - 4, y2: Tt + n * rowH, stroke: t === 0 ? '#B5AA96' : '#ECE6DA' }), h('text', { x: X(t), y: Tt + n * rowH + 14, fontSize: 10, textAnchor: 'middle', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, o.pct ? t + '%' : this.fmt(t, Math.abs(t1 - t0) < 5 ? 1 : 0)))),
      rows.map((r, i) => { const y = Tt + i * rowH, x0 = X(Math.min(0, r.value)), x1 = X(Math.max(0, r.value)); return h('g', { key: i }, h('text', { x: L - 8, y: y + rowH / 2 + 4, fontSize: 12, textAnchor: 'end', fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 600, fill: '#1A1711' }, String(r.label).slice(0, 34)), h('rect', { x: x0, y: y + 4, width: Math.max(1, x1 - x0), height: rowH - 8, fill: r.color, rx: 2 }), h('text', { x: (r.value >= 0 ? x1 + 5 : x0 - 5), y: y + rowH / 2 + 4, fontSize: 10.5, textAnchor: r.value >= 0 ? 'start' : 'end', fontFamily: "'Space Mono', monospace", fill: '#3D3629' }, (o.pct ? r.value.toFixed(1) + '%' : this.fmt(r.value, Math.abs(r.value) < 10 && r.value % 1 ? 2 : 0)) + (r.note ? '  ' + r.note : ''))); }),
      h('text', { x: (L + W - R) / 2, y: H - 4, fontSize: 10.5, textAnchor: 'middle', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.xlab));
  }
  tlTicks(lo, hi, n) { if (hi === lo) hi = lo + 1; const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, step = (m > 5 ? 10 : m > 2 ? 5 : m > 1 ? 2 : 1) * p, out = []; for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.999; v += step) out.push(Math.round(v / step) * step); return out; }
  tlKeynessSvg(key, top, bot, FT, tName, rName, measure) {
    const h = React.createElement, rows = top.map(r => ({ r, side: 1 })).concat(bot.map(r => ({ r, side: -1 }))), n = Math.max(top.length, bot.length);
    const W = 760, rowH = 21, Tt = 34, H = Tt + n * rowH + 30, mid = W / 2, mx = Math.max(1, ...rows.map(x => Math.abs(x.r.stat))), sc = (mid - 130) / mx;
    const lab = measure === 'chi2' ? 'χ²' : measure === 'lr' ? 'G²' : measure === 'exact' ? 'odds ratio' : 'PMI';
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Keyness of ' + tName + ' against ' + rName, ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      h('text', { x: mid - 10, y: 18, fontSize: 12, fontWeight: 700, textAnchor: 'end', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#A3540F' }, '← more ' + rName), h('text', { x: mid + 10, y: 18, fontSize: 12, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#2E7D58' }, 'more ' + tName + ' →'),
      h('line', { x1: mid, x2: mid, y1: Tt - 6, y2: Tt + n * rowH, stroke: '#3D3629' }),
      top.map((r, i) => { const y = Tt + i * rowH, w = Math.max(1, r.stat * sc); return h('g', { key: 't' + i }, h('rect', { x: mid, y: y + 3, width: w, height: rowH - 6, fill: '#2E7D58', rx: 2 }), h('text', { x: mid + w + 5, y: y + rowH / 2 + 4, fontSize: 11.5, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#1A1711' }, FT.label[r.f]), h('text', { x: mid + w + 9 + 7 * FT.label[r.f].length, y: y + rowH / 2 + 4, fontSize: 9.5, fontFamily: "'Space Mono', monospace", fill: '#8A8070' }, this.fmt(r.stat, 0))); }),
      bot.map((r, i) => { const y = Tt + i * rowH, w = Math.max(1, -r.stat * sc); return h('g', { key: 'b' + i }, h('rect', { x: mid - w, y: y + 3, width: w, height: rowH - 6, fill: '#A3540F', rx: 2 }), h('text', { x: mid - w - 5, y: y + rowH / 2 + 4, fontSize: 11.5, fontWeight: 700, textAnchor: 'end', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#1A1711' }, FT.label[r.f]), h('text', { x: mid - w - 9 - 7 * FT.label[r.f].length, y: y + rowH / 2 + 4, fontSize: 9.5, textAnchor: 'end', fontFamily: "'Space Mono', monospace", fill: '#8A8070' }, this.fmt(-r.stat, 0))); }),
      h('text', { x: mid, y: H - 8, fontSize: 10.5, textAnchor: 'middle', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, 'signed ' + lab + ' (textplot_keyness)'));
  }
  tlLinesSvg(key, xs, series, o) {
    const h = React.createElement, W = 760, H = 330, L = 56, R = 120, Tt = 30, B = 46, n = xs.length;
    const all = series.flatMap(s => s.pts).filter(isFinite), hi = Math.max(...all, 0) || 1, lo = Math.min(0, ...all), ticks = this.tlTicks(lo, hi, 5), t0 = ticks[0], t1 = ticks[ticks.length - 1];
    const X = i => L + (W - L - R) * (n > 1 ? i / (n - 1) : 0.5), Y = v => H - B - (H - B - Tt) * (v - t0) / ((t1 - t0) || 1), every = Math.ceil(n / 10);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': o.title, ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      h('text', { x: 8, y: 18, fontSize: 12.5, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: '#1A1711' }, o.title),
      ticks.map((t, i) => h('g', { key: i }, h('line', { x1: L, x2: W - R, y1: Y(t), y2: Y(t), stroke: '#ECE6DA' }), h('text', { x: L - 6, y: Y(t) + 3.5, fontSize: 10, textAnchor: 'end', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, o.pct ? t + '%' : this.fmt(t, (t1 - t0) < 5 ? 2 : 0)))),
      xs.map((x, i) => i % every === 0 ? h('text', { key: i, x: X(i), y: H - B + 15, fontSize: 9.5, textAnchor: 'middle', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, x) : null),
      series.map((s, si) => { const segs = []; let cur = []; s.pts.forEach((v, i) => { if (isFinite(v)) cur.push(X(i).toFixed(1) + ',' + Y(v).toFixed(1)); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur); const lastI = s.pts.map((v, i) => isFinite(v) ? i : -1).filter(i => i >= 0).pop(); return h('g', { key: si }, segs.map((sg, k) => h('polyline', { key: k, points: sg.join(' '), fill: 'none', stroke: s.color, strokeWidth: 2.2, strokeLinejoin: 'round' })), s.pts.map((v, i) => isFinite(v) && n <= 60 ? h('circle', { key: i, cx: X(i), cy: Y(v), r: 2.6, fill: s.color }) : null), lastI != null && lastI >= 0 ? h('text', { x: X(lastI) + 6, y: Y(s.pts[lastI]) + 4, fontSize: 11, fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif", fill: s.color }, String(s.name).slice(0, 16)) : null); }),
      h('text', { x: 14, y: (H - B + Tt) / 2, fontSize: 10.5, textAnchor: 'middle', transform: 'rotate(-90 14 ' + (H - B + Tt) / 2 + ')', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.ylab));
  }
  tlDendroSvg(key, H, labels, cl, k, orient) {
    const h = React.createElement, n = labels.length, step = Math.max(9, Math.min(20, 520 / n)), maxLab = Math.min(200, 16 + 6.6 * Math.max(...labels.map(l => String(l).length)));
    const hmax = Math.max(...H.height, 1e-9) * 1.04, horiz = orient !== 'v';
    const W = horiz ? 760 : Math.max(760, n * step + 80), Ht = horiz ? n * step + 60 : 420;
    const pos = {}; H.order.forEach((leaf, i) => { pos[-(leaf + 1)] = i; });
    const color = {}; // subtree colour when the subtree lies within one cluster
    const leaves = id => id < 0 ? [-id - 1] : leaves(H.merge[id - 1][0]).concat(leaves(H.merge[id - 1][1]));
    const coord = {}; const at = id => { if (id < 0) return { p: pos[id], hgt: 0 }; if (coord[id]) return coord[id]; const [a, b] = H.merge[id - 1], A = at(a), B = at(b); return (coord[id] = { p: (A.p + B.p) / 2, hgt: H.height[id - 1], a: A, b: B }); };
    for (let s = 1; s <= H.merge.length; s++) { const ls = leaves(s), c = cl[ls[0]]; color[s] = ls.every(x => cl[x] === c) ? this.tlPal(c - 1) : '#6B6455'; }
    const P = horiz ? (p, hg) => [maxLab + 10 + (W - maxLab - 30) * hg / hmax, 30 + p * step] : (p, hg) => [50 + p * step, Ht - maxLab - 10 - (Ht - maxLab - 40) * hg / hmax];
    const segs = [];
    for (let s = 1; s <= H.merge.length; s++) {
      const node = at(s), [a, b] = H.merge[s - 1], A = at(a), B = at(b), col = color[s];
      const p1 = P(A.p, A.hgt), p2 = P(A.p, node.hgt), p3 = P(B.p, node.hgt), p4 = P(B.p, B.hgt);
      segs.push(h('path', { key: s, d: 'M' + p1.join(',') + 'L' + p2.join(',') + 'L' + p3.join(',') + 'L' + p4.join(','), fill: 'none', stroke: col, strokeWidth: 1.6 }));
    }
    const cutH = k > 1 && k < n ? (H.height[n - k - 1] + H.height[n - k]) / 2 : null;
    const ticks = this.tlTicks(0, hmax, 5);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + Ht, width: '100%', role: 'img', 'aria-label': 'Dendrogram', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: Ht, fill: '#FFFFFF' }),
      ticks.filter(t => t <= hmax).map((t, i) => { const a = P(0, t), b = P(n - 1, t); return h('g', { key: 'g' + i }, h('line', { x1: horiz ? a[0] : 40, x2: horiz ? a[0] : W - 10, y1: horiz ? 22 : a[1], y2: horiz ? 30 + (n - 1) * step + 6 : a[1], stroke: '#F1EBDF' }), h('text', { x: horiz ? a[0] : 36, y: horiz ? Ht - 14 : a[1] + 3, fontSize: 9.5, textAnchor: horiz ? 'middle' : 'end', fontFamily: "'Space Mono', monospace", fill: '#8A8070' }, this.fmt(t, 2))); }),
      ...segs,
      cutH != null ? (() => { const a = P(-0.5, cutH), b = P(n - 0.5, cutH); return h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#934425', strokeDasharray: '4 3', strokeWidth: 1.3 }); })() : null,
      H.order.map((leaf, i) => { const [x, y] = P(i, 0); return h('text', { key: 'l' + i, x: horiz ? x - 6 : x, y: horiz ? y + 3.5 : y + 10, fontSize: Math.min(11, step * 0.75), textAnchor: horiz ? 'end' : 'end', transform: horiz ? undefined : 'rotate(-60 ' + x + ' ' + (y + 10) + ')', fontFamily: "'Space Mono', monospace", fontWeight: 700, fill: this.tlPal(cl[leaf] - 1) }, String(labels[leaf]).slice(0, 30)); }));
  }
  tlDotsSvg(key, pts, o) {
    const h = React.createElement, n = pts.length, rowH = 22, W = 760, L = Math.min(240, 16 + 7 * Math.max(...pts.map(p => String(p.label).length))), Tt = 18, H = Tt + n * rowH + 36;
    const xs = pts.flatMap(p => [p.x, p.lo, p.hi]).filter(isFinite), ticks = this.tlTicks(Math.min(...xs), Math.max(...xs), 6), t0 = ticks[0], t1 = ticks[ticks.length - 1], X = v => L + (W - L - 20) * (v - t0) / ((t1 - t0) || 1);
    const ord = pts.map((p, i) => i).sort((a, b) => pts[a].x - pts[b].x);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': o.xlab, ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      ticks.map((t, i) => h('g', { key: i }, h('line', { x1: X(t), x2: X(t), y1: Tt - 6, y2: Tt + n * rowH, stroke: '#ECE6DA' }), h('text', { x: X(t), y: Tt + n * rowH + 14, fontSize: 10, textAnchor: 'middle', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, this.fmt(t, 1)))),
      ord.map((i, r) => { const p = pts[i], y = Tt + r * rowH + rowH / 2; return h('g', { key: i }, h('text', { x: L - 8, y: y + 4, fontSize: 11.5, textAnchor: 'end', fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 600, fill: '#1A1711' }, String(p.label).slice(0, 34)), isFinite(p.lo) ? h('line', { x1: X(p.lo), x2: X(p.hi), y1: y, y2: y, stroke: '#2E7D58', strokeWidth: 2 }) : null, h('circle', { cx: X(p.x), cy: y, r: 4.5, fill: '#194F39' })); }),
      h('text', { x: (L + W) / 2, y: H - 4, fontSize: 10.5, textAnchor: 'middle', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.xlab));
  }
  tlScatterSvg(key, pts, o) {
    const h = React.createElement, W = 760, H = 460, M = 50, xs = pts.map(p => p.x), ys = pts.map(p => p.y), tx = this.tlTicks(Math.min(...xs), Math.max(...xs), 6), ty = this.tlTicks(Math.min(...ys), Math.max(...ys), 6);
    const X = v => M + (W - 2 * M) * (v - tx[0]) / ((tx[tx.length - 1] - tx[0]) || 1), Y = v => H - M - (H - 2 * M) * (v - ty[0]) / ((ty[ty.length - 1] - ty[0]) || 1);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Correspondence analysis', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#FFFFFF' }),
      tx.map((t, i) => h('g', { key: 'x' + i }, h('line', { x1: X(t), x2: X(t), y1: M - 10, y2: H - M, stroke: t === 0 ? '#B5AA96' : '#F1EBDF' }), h('text', { x: X(t), y: H - M + 14, fontSize: 10, textAnchor: 'middle', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, this.fmt(t, 1)))),
      ty.map((t, i) => h('g', { key: 'y' + i }, h('line', { x1: M, x2: W - M, y1: Y(t), y2: Y(t), stroke: t === 0 ? '#B5AA96' : '#F1EBDF' }), h('text', { x: M - 6, y: Y(t) + 3.5, fontSize: 10, textAnchor: 'end', fontFamily: "'Space Mono', monospace", fill: '#6B6455' }, this.fmt(t, 1)))),
      pts.map((p, i) => h('g', { key: i }, h('circle', { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: '#2E7D58' }), h('text', { x: X(p.x) + 7, y: Y(p.y) + 4, fontSize: 11, fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 600, fill: '#1A1711' }, String(p.label).slice(0, 26)))),
      h('text', { x: W / 2, y: H - 12, fontSize: 10.5, textAnchor: 'middle', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.xlab), h('text', { x: 14, y: H / 2, fontSize: 10.5, textAnchor: 'middle', transform: 'rotate(-90 14 ' + H / 2 + ')', fontFamily: "'Hanken Grotesk', sans-serif", fill: '#5D5648' }, o.ylab));
  }

  // ---- word-cloud layout: pixel-accurate packing on a spiral (as wordcloud2 / ggwordcloud), seeded
  tlCloudLayout(words, W, H, o) {
    const key = JSON.stringify([words.map(w => [w.text, w.value, w.color, w.sector]), W, H, o]);
    this._tlCL = this._tlCL || new Map();
    if (this._tlCL.has(key)) return this._tlCL.get(key);
    if (!this._tlFontsReady && document.fonts && document.fonts.load) {
      this._tlFontsReady = 'loading';
      Promise.all(['600 30px "Hanken Grotesk"', '700 30px "Bricolage Grotesque"', '700 30px "Space Mono"'].map(f => document.fonts.load(f).catch(() => null))).then(() => { this._tlFontsReady = true; this._tlCL = new Map(); this.forceUpdate(); });
    }
    const out = { placed: [], dropped: 0 };
    if (!words.length) return out;
    const fam = o.font === 'Georgia' ? 'Georgia, serif' : '"' + o.font + '", sans-serif', wt = o.font === 'Hanken Grotesk' ? 600 : 700;
    const vmax = o.vmax ?? Math.max(...words.map(w => w.value)), vmin = o.vmin ?? Math.min(...words.map(w => w.value));
    const maxF = Math.min(H * 0.2, W * 0.11), minF = Math.max(9.5, maxF * 0.2);
    const cell = 2, GW = Math.ceil(W / cell), GH = Math.ceil(H / cell), board = new Uint8Array(GW * GH);
    let cv = null, ctx = null;
    try { cv = this._tlCv || (this._tlCv = document.createElement('canvas')); ctx = cv.getContext && cv.getContext('2d', { willReadFrequently: true }); } catch (e) { ctx = null; }
    let s = (o.seed >>> 0) || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const shape = o.shape || 'ellipse', cx = GW / 2, cy = GH / 2;
    const inside = (x, y) => { const nx = (x - cx) / (GW / 2), ny = (y - cy) / (GH / 2); if (shape === 'square') return Math.abs(nx) <= 1 && Math.abs(ny) <= 1; if (shape === 'circle') { const r = Math.min(GW, GH) / 2; const dx = (x - cx) / r, dy = (y - cy) / r; return dx * dx + dy * dy <= 1; } if (shape === 'diamond') return Math.abs(nx) + Math.abs(ny) <= 1; if (shape === 'triangle') return ny >= -1 && Math.abs(nx) <= (ny + 1) / 2; if (shape === 'star') { const a = Math.atan2(ny, nx), r = Math.hypot(nx, ny), k = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(2.5 * a + Math.PI / 4)), 2.2); return r <= k; } return nx * nx + ny * ny <= 1.08; };
    const sorted = words.map((w, i) => Object.assign({ i }, w)).sort((a, b) => b.value - a.value);
    const sectors = o.sectors || 0;
    for (const w of sorted) {
      const t = vmax === vmin ? 1 : Math.max(0, Math.min(1, (w.value - vmin) / (vmax - vmin)));
      let size = minF + (maxF - minF) * Math.sqrt(t), placed = false;
      for (let attempt = 0; attempt < 4 && !placed; attempt++, size *= 0.82) {
        const rot = o.rotate > 0 && rnd() < o.rotate ? 1 : 0;
        if (ctx) ctx.font = wt + ' ' + size.toFixed(1) + 'px ' + fam;
        const m = ctx ? ctx.measureText(w.text) : { width: [...w.text].length * size * 0.56, actualBoundingBoxAscent: size * 0.74, actualBoundingBoxDescent: size * 0.22, actualBoundingBoxLeft: 0, actualBoundingBoxRight: [...w.text].length * size * 0.56 }, asc = Math.ceil(m.actualBoundingBoxAscent || size * 0.8), desc = Math.ceil(m.actualBoundingBoxDescent || size * 0.2), l = Math.ceil(m.actualBoundingBoxLeft || 0), r = Math.ceil(m.actualBoundingBoxRight || m.width);
        const pad = Math.max(1, Math.round(size * 0.05)), tw = l + r, th = asc + desc, bw = (rot ? th : tw) + 2 * pad, bh = (rot ? tw : th) + 2 * pad;
        if (bw >= W || bh >= H) continue;
        const ox = rot ? pad + asc : pad + l, oy = rot ? pad + r : pad + asc, sw = Math.ceil(bw / cell), sh = Math.ceil(bh / cell), spr = new Uint8Array(sw * sh);
        if (ctx) {
          cv.width = bw; cv.height = bh; ctx.font = wt + ' ' + size.toFixed(1) + 'px ' + fam; ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
          if (!rot) ctx.fillText(w.text, ox, oy); else { ctx.save(); ctx.translate(ox, oy); ctx.rotate(-Math.PI / 2); ctx.fillText(w.text, 0, 0); ctx.restore(); }
          const img = ctx.getImageData(0, 0, bw, bh).data;
          for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (img[(y * bw + x) * 4 + 3] > 30) spr[(y / cell | 0) * sw + (x / cell | 0)] = 1;
        } else spr.fill(1);
        const cells = []; for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (spr[y * sw + x] || (x > 0 && spr[y * sw + x - 1]) || (x < sw - 1 && spr[y * sw + x + 1]) || (y > 0 && spr[(y - 1) * sw + x]) || (y < sh - 1 && spr[(y + 1) * sw + x])) cells.push(x, y);
        let sx = cx - sw / 2, sy = cy - sh / 2;
        if (sectors > 1) { const a = 2 * Math.PI * (w.sector + 0.5) / sectors - Math.PI / 2; sx += Math.cos(a) * GW * 0.22; sy += Math.sin(a) * GH * 0.22; }
        const a0 = rnd() * 2 * Math.PI, ax = shape === 'circle' ? 1 : GW / GH, maxT = 2 * Math.PI * Math.hypot(GW, GH) / 4;
        for (let tt = 0; tt < maxT; tt += 0.07) {
          const rr = 0.45 * tt, gx = Math.round(sx + rr * Math.cos(tt + a0) * Math.sqrt(ax)), gy = Math.round(sy + rr * Math.sin(tt + a0) / Math.sqrt(ax));
          if (gx < 0 || gy < 0 || gx + sw > GW || gy + sh > GH) continue;
          if (!inside(gx + sw / 2, gy + sh / 2) || !inside(gx, gy + sh / 2) || !inside(gx + sw, gy + sh / 2) || !inside(gx + sw / 2, gy) || !inside(gx + sw / 2, gy + sh)) continue;
          let hit = false; for (let k = 0; k < cells.length; k += 2) if (board[(gy + cells[k + 1]) * GW + gx + cells[k]]) { hit = true; break; }
          if (hit) continue;
          for (let k = 0; k < cells.length; k += 2) board[(gy + cells[k + 1]) * GW + gx + cells[k]] = 1;
          out.placed.push({ text: w.text, x: gx * cell + ox, y: gy * cell + oy, size, rot, color: w.color });
          placed = true; break;
        }
      }
      if (!placed) out.dropped++;
    }
    if (this._tlFontsReady === true) { this._tlCL.set(key, out); if (this._tlCL.size > 60) this._tlCL.delete(this._tlCL.keys().next().value); }
    return out;
  }
  // GM26 text lab end
