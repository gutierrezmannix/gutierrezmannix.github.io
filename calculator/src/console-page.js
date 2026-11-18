  // GM26 console page begin
  // The console as its own page (build .103), laid out like Stata's main window: Review (the commands so far) on the
  // left, Results in the middle (oldest first, the whole session), Variables on the right, the command line at the
  // bottom. Opened from Console in the top bar or Ctrl+K; Esc or Back returns to the page underneath, which stays as
  // it was. The console records actions, not views: a typed command, a Run / Fit / Apply button, or Print in console.
  // Looking at a variable or switching tabs writes nothing (the Record switch brings the old behaviour back).
  cpArm(src) { this._cpArm = Date.now(); this._cpArmSrc = src || 'page'; }
  cpArmed() { return !!this.state.conAuto || !!(this._cpArm && Date.now() - this._cpArm < 8000); }
  cpTakeArm() { const s = this._cpArm ? (this._cpArmSrc || 'page') : 'page'; this._cpArm = 0; return s; }
  cpSrc() { return this._cpTyping && Date.now() - this._cpTyping < 3000 ? 'typed' : 'page'; }
  cpOpenPage() { this._cpBack = this.state.tab; this.setState({ cpOpen: true, mfNav: '', mfFile: false, menu: '' }, () => { try { window.scrollTo(0, 0); } catch (e) {} setTimeout(() => this._cpIn && this._cpIn.focus({ preventScroll: true }), 30); }); }
  cpClose() { this.setState({ cpOpen: false }); }
  // the view on screen, printed once (the Print in console button above each page)
  cpPrintView() { const d = this.descFor(); if (!d) { this.flash('Nothing on this page to print yet'); return; } this.cpArm('page'); this.setState({ conSig: '' }); this.flash('Printed in the console'); }
  cpNote(cmd, msg, kind) { this.setState(s => ({ cpErrs: [...(s.cpErrs || []), { at: s.conLog.length, cmd, msg: msg || '', kind: kind || 'note' }].slice(-300) })); }
  cpTabName(t) { return ({ one: 'Univariate', two: 'Bivariate', corr: 'Correlation matrix', ttest: 't-tests', reg: 'Regression', plots: 'Charts', sem: 'SEM', ergm: 'Networks', text: 'Text analysis', predict: 'Predict', ts: 'Time series', data: 'Data', browse: 'Browse', analysis: 'Tests', maps: 'Maps' })[t] || 'the page'; }
  // run one line: what the console prints comes from the log; errors and notes are kept beside it, in order
  cpRun(text, then) {
    const s = String(text || '').replace(/^\s*[.>]\s*/, '').trim(); if (!s) { if (then) then(); return; }
    this._cpHist = (this._cpHist || []).concat([s]).slice(-300); this._cpHi = null;
    const n0 = this.state.conLog.length; this._cpTyping = Date.now();
    if (/^(\*|\/\/)/.test(s)) { this.cpNote(s, '', 'comment'); if (then) then(); return; }
    if (/^(cls|clear\s+results)$/i.test(s)) { this.setState({ conFrom: this.state.conLog.length }); if (then) then(); return; }
    if (/^(browse|br|edit|ed|help|h|search)\b/i.test(s)) this.setState({ cpOpen: false });
    this.setState({ mfCmdErr: '', mfCmdOk: '' }, () => {
      try { this.runCmdLine(s); } catch (e) { this.setState({ mfCmdErr: String(e && e.message || e) }); }
      setTimeout(() => {
        const S = this.state;
        if (S.mfCmdErr) { this.cpNote(s, S.mfCmdErr, 'err'); this.setState({ mfCmdErr: '' }); }
        else if (S.conLog.length === n0) {
          const ok = String(S.mfCmdOk || '').replace(/^✓\s*/, '').trim();
          // a command that opened a page logs when the page has run (a regression); anything else gets its note now
          const pending = this._cpArm && Date.now() - this._cpArm < 3000;
          setTimeout(() => { if (this.state.conLog.length === n0) this.cpNote(s, ok && ok.toLowerCase() !== s.toLowerCase() ? ok : '', 'note'); }, pending ? 1500 : 0);
        }
        if (then) then();
      }, 90);
    });
  }
  // several lines in order (the do-file box): comments are echoed, /// joins a line to the next
  cpRunMany(text) {
    const lines = []; let buf = '';
    for (const raw of String(text || '').split(/\r?\n/)) { const l = raw.replace(/\s+$/, ''); if (/\s\/\/\/\s*$/.test(l) || /^\/\/\/$/.test(l.trim())) { buf += l.replace(/\/\/\/\s*$/, ' '); continue; } lines.push(buf + l); buf = ''; }
    if (buf) lines.push(buf);
    const todo = lines.map(l => l.trim()).filter(Boolean); let i = 0;
    const next = () => { if (i >= todo.length) return; const l = todo[i++]; this.cpRun(l, () => setTimeout(next, 120)); };
    next();
  }
  // text of the session for Copy / Save log (.log) and the commands alone for Save do-file (.do)
  cpLogText(items, dial) {
    return items.map(it => it.err ? '. ' + it.err.cmd + (it.err.msg ? '\n' + it.err.msg : '') : this.cpCmdOf(it.d, dial).split('\n').map(l => (dial === 'r' ? '> ' : '. ') + l).join('\n') + (this.cpTblOf(it.d, dial) ? '\n\n' + this.cpTblOf(it.d, dial) : it.d.res ? '\n' + it.d.res : '')).join('\n\n');
  }
  cpCmdOf(d, dial) { try { return this.cmdText(d, dial) || ''; } catch (e) { return ''; } }
  cpTblOf(d, dial) { try { return this.conTable(d, dial) || ''; } catch (e) { return ''; } }
  cpItems() {
    const S = this.state, from = Math.min(S.conFrom || 0, S.conLog.length), log = S.conLog.slice(from), errs = (S.cpErrs || []).filter(e => e.at >= from), items = []; let ei = 0;
    log.forEach((d, i) => { const at = from + i; while (ei < errs.length && errs[ei].at <= at) items.push({ err: errs[ei++] }); items.push({ d, at }); });
    while (ei < errs.length) items.push({ err: errs[ei++] });
    return items;
  }
  // command words for completion at the start of the line
  cpVerbs() { return ['summarize', 'tabulate', 'tab1', 'tab2', 'tabstat', 'mean', 'describe', 'codebook', 'count', 'list', 'correlate', 'pwcorr', 'ttest', 'ttesti', 'oneway', 'regress', 'logit', 'logistic', 'ologit', 'poisson', 'margins', 'marginsplot', 'estat vif', 'histogram', 'scatter', 'twoway', 'line', 'graph bar', 'graph box', 'graph matrix', 'generate', 'replace', 'recode', 'rename', 'drop', 'keep', 'destring', 'tostring', 'label variable', 'label define', 'label values', 'mvdecode', 'svyset', 'tsset', 'display', 'set level', 'alpha', 'help']; }
  cpCompletions(v, pos) {
    const before = v.slice(0, pos), m = before.match(/([A-Za-z_][\w]*)$/); if (!m) return { tok: '', list: [] };
    const tok = m[1], first = !/\S\s/.test(before.replace(/^\s*[.]\s*/, '')), low = tok.toLowerCase();
    if (first) return { tok, list: this.cpVerbs().filter(c => c.startsWith(low) && c !== low).slice(0, 7).map(c => ({ name: c, sub: 'command' })) };
    const cols = (this.state.cols || []).filter(c => !(this.state.hiddenVars || []).includes(c.name));
    const a = cols.filter(c => c.name.toLowerCase().startsWith(low)), b = cols.filter(c => !c.name.toLowerCase().startsWith(low) && ((c.label || '').toLowerCase().includes(low) || c.name.toLowerCase().includes(low)));
    return { tok, list: a.concat(b).slice(0, 7).filter(c => c.name !== tok).map(c => ({ name: c.name, sub: c.label || '' })) };
  }
  cpInsert(word, replaceTok) {
    const el = this._cpIn; if (!el) return; const v = el.value, pos = el.selectionStart == null ? v.length : el.selectionStart;
    let before = v.slice(0, pos); const after = v.slice(pos);
    if (replaceTok) before = before.replace(/[A-Za-z_][\w]*$/, ''); else if (before && !/\s$/.test(before)) before += ' ';
    const ins = word + (after.startsWith(' ') ? '' : ' '); el.value = before + ins + after; const p = (before + ins).length; el.focus(); el.setSelectionRange(p, p);
    this.cpSuggest();
  }
  cpSuggest() { clearTimeout(this._cpSugT); this._cpSugT = setTimeout(() => { const el = this._cpIn; if (!el) return; const c = this.cpCompletions(el.value, el.selectionStart == null ? el.value.length : el.selectionStart); const key = c.tok + '|' + c.list.map(x => x.name).join(','); if (key !== this._cpSugKey) { this._cpSugKey = key; this.setState({ cpSug: c }); } }, 110); }
  cpKey(e) {
    const el = e.target, hist = this._cpHist || [];
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = el.value; el.value = ''; this._cpSugKey = ''; this.setState({ cpSug: null }); this.cpRun(v); return; }
    if (e.key === 'Tab') { const sg = this.state.cpSug; if (sg && sg.list && sg.list.length) { e.preventDefault(); this.cpInsert(sg.list[0].name, true); } return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!hist.length) return; e.preventDefault();
      let i = this._cpHi == null ? hist.length : this._cpHi; i += e.key === 'ArrowUp' ? -1 : 1; i = Math.max(0, Math.min(hist.length, i)); this._cpHi = i;
      el.value = i === hist.length ? '' : hist[i]; const p = el.value.length; el.setSelectionRange(p, p); return;
    }
    if (e.key === 'Escape') { if (this.state.cpSug && this.state.cpSug.list && this.state.cpSug.list.length) { e.stopPropagation(); this._cpSugKey = ''; this.setState({ cpSug: null }); } }
  }
  cpKeys() {
    if (this._cpKeysOn) return; this._cpKeysOn = true;
    window.addEventListener('keydown', e => {
      if (!this.state.cpOpen) return;
      if (e.key === 'Escape' && !e.defaultPrevented) { const sg = this.state.cpSug; if (sg && sg.list && sg.list.length) return; e.preventDefault(); this.cpClose(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && !e.shiftKey && this._cpOpenedAt && Date.now() - this._cpOpenedAt > 400) { this._cpSkip = Date.now(); setTimeout(() => this.setState({ cpOpen: false, mfPane: this.state.mfPane === 'output' ? 'plots' : this.state.mfPane }), 0); }
    });
  }
  cpDownload(text, name, type) { this.dlBlob(new Blob([text], { type: type || 'text/plain' }), name); this.flash('Saved ' + name); }
  cpRender() {
    const h = React.createElement, S = this.state, dial = S.dialect === 'r' ? 'r' : 'stata', items = this.cpItems(); this.cpKeys();
    if (!this._cpOpenedAt || !this._cpWasOpen) this._cpOpenedAt = Date.now(); this._cpWasOpen = true;
    const base = (S.fileName || 'gm26').replace(/\.[^.]+$/, ''), prompt = dial === 'r' ? '> ' : '. ', CAP = 400;
    // Review: every command, numbered; a click puts it back in the command line, a double click runs it
    const revRows = items.map((it, k) => {
      const cmd = it.err ? it.err.cmd : this.cpCmdOf(it.d, dial).split('\n')[0], cls = 'cp-rv' + (it.err && it.err.kind === 'err' ? ' err' : !it.err && it.d.src !== 'typed' ? ' page' : '');
      return h('button', { key: k, type: 'button', className: cls, title: (it.err && it.err.kind === 'err' ? 'Error · ' : !it.err && it.d.src !== 'typed' ? 'From a button on the page · ' : '') + 'click to edit, double-click to run again', onClick: () => { if (this._cpIn) { this._cpIn.value = cmd; this._cpIn.focus(); } }, onDoubleClick: () => this.cpRun(cmd) }, h('span', { className: 'n' }, k + 1), cmd);
    });
    // Results: oldest first; long tables are cut on screen (Copy and Save log keep everything)
    const resRows = items.map((it, k) => {
      if (it.err) return h('div', { key: 'e' + k, className: 'cp-item' }, h('div', { className: 'cp-cmd' + (it.err.kind === 'comment' ? ' cmt' : '') }, prompt + it.err.cmd), it.err.msg ? h('div', { className: it.err.kind === 'err' ? 'cp-err' : 'cp-note' }, it.err.msg) : null);
      const d = it.d, cmd = this.cpCmdOf(d, dial), tbl = this.cpTblOf(d, dial), lines = tbl ? tbl.split('\n') : [];
      const cut = lines.length > CAP ? lines.slice(0, CAP).join('\n') + '\n\n  … ' + this.fmtN(lines.length - CAP) + ' more lines (Copy or Save log keeps the whole table)' : tbl;
      return h('div', { key: 'd' + it.at, className: 'cp-item' },
        cmd.split('\n').map((l, i) => h('div', { key: i, className: 'cp-cmd' }, (/^\s/.test(l) || /^\}/.test(l) ? '  ' : prompt) + l, i === 0 && d.src !== 'typed' ? h('span', { className: 'cp-src' }, (dial === 'r' ? '  # ' : '  * ') + 'from ' + (d.t === 'asx' ? 'Tests ▾' : 'the page')) : null)),
        cut ? h('pre', { className: 'cp-tbl' }, cut) : d.res ? h('div', { className: 'cp-note' }, d.res) : null,
        d.t === 'plot' ? h('button', { type: 'button', className: 'cp-link', onClick: () => { this.rerunCmd(d); this.cpClose(); } }, 'View the graph →') : null);
    });
    const sg = S.cpSug && S.cpSug.list && S.cpSug.list.length ? S.cpSug : null;
    const cols = (S.cols || []).filter(c => !(S.hiddenVars || []).includes(c.name)), vq = String(S.cpVarQ || '').toLowerCase();
    const shown = (vq ? cols.filter(c => c.name.toLowerCase().includes(vq) || (c.label || '').toLowerCase().includes(vq)) : cols).slice(0, 400);
    const tpl = [['summarize', 'summarize ', 'Obs, mean, sd, min, max'], ['summarize, detail', 'summarize , detail', 'percentiles and moments'], ['tabulate', 'tabulate ', 'one-way frequencies'], ['tabulate y x, row chi2', 'tabulate  , row chi2', 'two-way table with a test'], ['tabstat', 'tabstat , stat(mean sd n)', 'table of statistics'], ['mean', 'mean ', 'means with CIs'], ['pwcorr', 'pwcorr , sig obs', 'pairwise correlations'], ['ttest', 'ttest , by()', 'two-sample t-test'], ['oneway', 'oneway  , tabulate', 'one-way ANOVA'], ['regress', 'regress ', 'linear regression'], ['logit', 'logit ', 'logistic regression'], ['margins', 'margins ', 'after a model'], ['histogram', 'histogram ', 'graph'], ['scatter', 'scatter ', 'graph'], ['generate', 'generate  = ', 'new variable'], ['recode', 'recode  (1 2 = 1) (3 4 = 2), gen()', 'regroup values'], ['label define', 'label define  1 "" 2 ""', 'value labels'], ['svyset', 'svyset  [pw=], strata()', 'survey design']];
    const menu = S.cpMenu ? h('div', { className: 'cp-menu', role: 'menu' }, tpl.map(([l, t, sub]) => h('button', { key: l, type: 'button', role: 'menuitem', onClick: () => { this.setState({ cpMenu: false }); const el = this._cpIn; if (el) { el.value = t; el.focus(); const p = t.indexOf(' ') + 1 || t.length; el.setSelectionRange(p, p); } } }, h('b', null, l), h('span', null, sub)))) : null;
    const resRef = el => { if (!el) return; const n = items.length; if (n !== this._cpLastN) { this._cpLastN = n; el.scrollTop = el.scrollHeight; } };
    const sizeRef = el => { if (!el) return; this._cpBox = el; const fit = () => { if (!this._cpBox || !this._cpBox.isConnected) return; const el = this._cpBox, r = el.getBoundingClientRect(), z = el.offsetHeight ? r.height / el.offsetHeight : 1, docTop = r.top + (window.scrollY || 0); const want = Math.round(Math.max(420, (window.innerHeight - docTop - 12) / (z > 0.2 ? z : 1))); if (Math.abs(want - (parseFloat(el.style.height) || 0)) > 1) el.style.height = want + 'px'; }; fit(); requestAnimationFrame(fit); if (!this._cpFitOn) { this._cpFitOn = true; window.addEventListener('resize', () => this._cpFit && this._cpFit()); try { new ResizeObserver(() => this._cpFit && this._cpFit()).observe(document.body); } catch (e) {} } this._cpFit = fit; };
    const btn = (label, onClick, title, cls) => h('button', { type: 'button', className: 'cp-btn' + (cls ? ' ' + cls : ''), onClick, title }, label);
    const head = h('div', { className: 'cp-head' },
      h('div', { className: 'cp-title' }, h('b', null, 'Console'), h('span', null, this.fmtN(this._raw ? this._raw.n : 0) + ' obs · ' + this.fmtN(cols.length) + ' vars')),
      h('div', { className: 'cp-seg', role: 'group', 'aria-label': 'Language' }, ['stata', 'r'].map(k => h('button', { key: k, type: 'button', 'aria-pressed': String(dial === k), onClick: () => this.setState({ dialect: k }) }, k === 'r' ? 'R' : 'Stata'))),
      h('div', { className: 'cp-seg', role: 'group', 'aria-label': 'What the console records', title: 'What I run: typed commands and Run / Apply buttons. Also what I open: every page you look at, as before.' }, [[false, 'Record what I run'], [true, 'Also what I open']].map(([k, l]) => h('button', { key: String(k), type: 'button', 'aria-pressed': String(!!S.conAuto === k), onClick: () => this.setState({ conAuto: k }) }, l))),
      h('div', { style: { flex: 1 } }),
      btn('Copy', () => this.copyTSV('cplog', this.cpLogText(items, dial)), 'Copy the commands and output'),
      btn('Save log', () => this.cpDownload(this.cpLogText(items, dial) + '\n', base + (dial === 'r' ? '-console.txt' : '.log')), 'Download the commands and output as text'),
      btn(dial === 'r' ? 'Save script' : 'Save do-file', () => this.cpDownload((dial === 'r' ? '# ' : '* ') + 'Commands from GM26 · ' + (S.fileName || '') + '\n' + items.filter(it => !it.err || it.err.kind !== 'err').map(it => it.err ? it.err.cmd : this.cpCmdOf(it.d, dial)).filter(Boolean).join('\n') + '\n', base + (dial === 'r' ? '.R' : '.do')), 'Download the commands only'),
      btn('Clear', () => this.setState({ conFrom: S.conLog.length }), 'Clear the Results window (the log is kept in the session; like Stata’s cls)'),
      btn('← Back to ' + this.cpTabName(S.tab), () => this.cpClose(), 'Esc', 'back'));
    const rev = h('div', { className: 'cp-rev' }, h('div', { className: 'cp-ph' }, h('span', null, 'Review'), h('span', null, items.length)),
      h('div', { className: 'cp-list' }, revRows.length ? revRows : h('p', { className: 'cp-empty' }, 'Commands you run appear here.')),
      h('p', { className: 'cp-hint' }, 'Click a line to edit it, double-click to run it again. Blue lines came from buttons on the page.'));
    const vars = h('div', { className: 'cp-vars' }, h('div', { className: 'cp-ph' }, h('span', null, 'Variables'), h('span', null, this.fmtN(cols.length))),
      h('input', { className: 'cp-vq', type: 'search', placeholder: 'filter variables', 'aria-label': 'Filter variables', defaultValue: S.cpVarQ || '', onChange: e => { const v = e.target.value; clearTimeout(this._cpVqT); this._cpVqT = setTimeout(() => this.setState({ cpVarQ: v }), 150); } }),
      h('div', { className: 'cp-list' }, shown.map(c => h('button', { key: c.name, type: 'button', className: 'cp-var', title: (c.label || c.name) + ' — click to type it', onClick: () => this.cpInsert(c.name) }, h('span', null, c.name), h('em', null, c.label || '')))),
      h('p', { className: 'cp-hint' }, 'Click a name to type it at the cursor.'));
    const doBox = S.cpDo ? h('div', { className: 'cp-do' }, h('textarea', { 'aria-label': 'Do-file', placeholder: '* several commands, one per line\nsummarize edad\ntabulate sexo', defaultValue: S.cpDoText || '', spellCheck: false, onChange: e => { this._cpDoText = e.target.value; } }),
      h('div', { className: 'cp-dorow' }, btn('Run all', () => { const t = this._cpDoText != null ? this._cpDoText : (S.cpDoText || ''); this.setState({ cpDoText: t }); this.cpRunMany(t); }, 'Run every line in order', 'run'), btn('Close', () => this.setState({ cpDo: false, cpDoText: this._cpDoText != null ? this._cpDoText : S.cpDoText })), h('span', { className: 'cp-hint' }, 'Lines run one after another; * and // lines are comments; /// continues a line.'))) : null;
    const mid = h('div', { className: 'cp-mid' },
      h('div', { className: 'cp-res', ref: resRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Results' }, resRows.length ? resRows : h('div', { className: 'cp-empty big' }, h('b', null, 'Type a Stata command below and press Enter.'), h('br'), 'For example  summarize ' + ((cols.find(c => c.type === 'numeric') || {}).name || 'x') + '  or  tabulate ' + ((cols.find(c => c.type !== 'numeric') || cols[0] || {}).name || 'x') + '. Buttons on the page that run something print their command here too.')),
      doBox,
      sg ? h('div', { className: 'cp-sug', role: 'listbox' }, sg.list.map((x, i) => h('button', { key: x.name, type: 'button', role: 'option', className: i === 0 ? 'on' : '', onMouseDown: e => { e.preventDefault(); this.cpInsert(x.name, true); } }, h('span', null, x.name), h('em', null, i === 0 ? 'Tab · ' + x.sub : x.sub)))) : null,
      h('div', { className: 'cp-cl' }, h('span', { className: 'cp-prompt' }, prompt.trim()),
        h('input', { ref: el => { this._cpIn = el; }, className: 'cp-in', type: 'text', autoComplete: 'off', spellCheck: false, 'aria-label': 'Command', placeholder: dial === 'r' ? 'Stata command (the console reads Stata and a few R calls)' : 'Stata command — e.g.  tabulate sexo  ·  ↑ ↓ earlier commands · Tab completes', onKeyDown: e => this.cpKey(e), onInput: () => this.cpSuggest(), onClick: () => this.cpSuggest(), onBlur: () => setTimeout(() => { if (this.state.cpSug) { this._cpSugKey = ''; this.setState({ cpSug: null }); } }, 150) }),
        h('div', { className: 'cp-mwrap' }, btn('Commands ▾', () => this.setState({ cpMenu: !S.cpMenu }), 'Pick a command to fill in'), menu),
        btn('Do-file', () => this.setState({ cpDo: !S.cpDo }), 'Several commands at once'),
        btn('Run', () => { const el = this._cpIn; if (!el) return; const v = el.value; el.value = ''; this.cpRun(v); }, 'Run the command (Enter)', 'run')));
    return h('section', { className: 'cp', ref: sizeRef, 'aria-label': 'Console' }, head, rev, mid, vars);
  }
  // Stata conditions for console commands: x == 3, x != ., missing(x), !missing(x), inlist(x, 1, 2), inrange(x, a, b),
  // joined with & (parentheses are respected when splitting)
  cpConds(ifs) {
    const raw = this._raw, E = this._E, out = [];
    if (/\|/.test(ifs)) return { err: 'Join conditions with & — | (or) is not supported here.' };
    const find = n => raw.names.find(x => x.toLowerCase() === String(n).toLowerCase()), unq = x => String(x).trim().replace(/^"(.*)"$/, '$1');
    const notVar = n => ({ err: '"' + n + '" is not a variable in this dataset' });
    const parts = []; let dep = 0, cur = '';
    for (const ch of String(ifs)) { if (ch === '(') dep++; if (ch === ')') dep--; if (ch === '&' && dep === 0) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    for (const p0 of parts.map(p => p.trim()).filter(Boolean)) {
      let m;
      if ((m = p0.match(/^(!|~)?\s*missing\(\s*([A-Za-z_]\w*)\s*\)$/i))) { const v = find(m[2]); if (!v) return notVar(m[2]); const mt = this.effMeta(v); out.push({ v, t: 'op', op: m[1] ? '!=' : '==', val: '.', cat: !mt || mt.treatAs !== 'numeric' }); continue; }
      if ((m = p0.match(/^inlist\(\s*([A-Za-z_]\w*)\s*,(.+)\)$/i))) { const v = find(m[1]); if (!v) return notVar(m[1]); const mt = this.effMeta(v), isNum = !!mt && mt.treatAs === 'numeric'; out.push({ v, t: 'in', vals: m[2].split(',').map(unq).map(x => /^-?\d+(\.\d+)?$/.test(x) ? (isNum ? E.numLab(parseFloat(x)) : String(this.vlabel(v, parseFloat(x)))) : x) }); continue; }
      if ((m = p0.match(/^inrange\(\s*([A-Za-z_]\w*)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i))) { const v = find(m[1]); if (!v) return notVar(m[1]); out.push({ v, t: 'rng', lo: m[2], hi: m[3] }); continue; }
      const c = p0.match(/^([A-Za-z_]\w*)\s*(==|!=|~=|>=|<=|>|<|=)\s*(.+)$/);
      if (!c) return { err: 'Could not read the condition "' + p0 + '" — write it like  ent == 7,  year >= 2015,  !missing(x)  or  inlist(ent, 1, 7, 9)' };
      const v = find(c[1]); if (!v) return notVar(c[1]);
      const mt = this.effMeta(v), val = unq(c[3]);
      out.push({ v, t: 'op', op: c[2] === '=' ? '==' : c[2] === '~=' ? '!=' : c[2], val, cat: !mt || mt.treatAs !== 'numeric' });
    }
    return { conds: out };
  }
  // describe in Stata 17's layout; with a varlist only those variables (and no dataset header), as in Stata
  cpDescribe(d) {
    const raw = this._raw, S = this.state, hid = S.hiddenVars || [];
    const cols = d.vars ? d.vars.map(v => S.cols.find(c => c.name === v)).filter(Boolean) : S.cols.filter(c => !hid.includes(c.name));
    const L = (s, w) => { s = String(s); return s.length >= w ? s.slice(0, w - 2) + '~ ' : s + ' '.repeat(w - s.length); };
    const typeOf = name => {
      const i = raw.names.indexOf(name); if (i < 0) return ['', '']; const c = raw.cols[i], a = c.a, n = a.length, step = Math.max(1, Math.floor(n / 20000));
      if (c.k === 's') { let mx = 1; for (let r = 0; r < n; r += step) { const v = a[r]; if (v != null) { const l = String(v).length; if (l > mx) mx = l; } } return mx > 2045 ? ['strL', '%9s'] : ['str' + mx, '%-' + Math.min(mx, 30) + 's']; }
      let allInt = true, lo = Infinity, hi = -Infinity; for (let r = 0; r < n; r += step) { const v = a[r]; if (!Number.isFinite(v)) continue; if (v % 1) { allInt = false; break; } if (v < lo) lo = v; if (v > hi) hi = v; }
      if (!allInt) return ['double', '%10.0g']; if (lo >= -127 && hi <= 100) return ['byte', '%8.0g']; if (lo >= -32767 && hi <= 32740) return ['int', '%8.0g']; return ['long', '%12.0g'];
    };
    const vl = name => raw.vlabs && raw.vlabs[name] && raw.vlabs[name].size ? name : '';
    let o = '';
    if (!d.vars) o += 'Contains data from ' + (S.fileName || 'data') + '\n Observations: ' + this.fmtN(raw.n).padStart(14) + '\n    Variables: ' + this.fmtN(cols.length).padStart(14) + '\n' + '-'.repeat(79) + '\n';
    o += 'Variable      Storage   Display    Value\n    name         type    format    label      Variable label\n' + '-'.repeat(79) + '\n';
    for (const c of cols) { const [ty, fm] = typeOf(c.name); o += L(c.name, 16) + L(ty, 8) + L(fm, 11) + L(vl(c.name), 11) + (c.label || raw.labels[raw.names.indexOf(c.name)] || '') + '\n'; }
    return o + '-'.repeat(79);
  }
  // tostring x, gen(x_s): a new text copy, the original stays as it is
  cpTostringGen(s, varlist, fail, ok) {
    const m = s.match(/^tostring\s+(.+?)\s*,(.*)$/i); if (!m) return fail('tostring: use  tostring x, gen(x_s)');
    const L = varlist(m[1]); if (L.bad.length) return fail('variable ' + L.bad[0] + ' not found');
    const names = String((m[2].match(/\bgen(?:erate)?\s*\(\s*([^)]*)\)/i) || [])[1] || '').trim().split(/\s+/).filter(Boolean);
    if (names.length !== L.vars.length) return fail('tostring: gen() needs one new name for each variable');
    const raw = this._raw, E = this._E;
    for (const nm of names) { if (!/^[A-Za-z_]\w{0,31}$/.test(nm)) return fail(nm + ' is not a valid name'); if (raw.names.some(x => x.toLowerCase() === nm.toLowerCase())) return fail('variable ' + nm + ' already defined'); }
    L.vars.forEach((v, j) => { const i = raw.names.indexOf(v), c = raw.cols[i]; const a = c.k === 'n' ? Array.from(c.a, x => Number.isFinite(x) ? String(E.numLab(x)) : '') : Array.from(c.a, x => x == null ? '' : String(x)); this.addDerivedCol(names[j], { k: 's', a }, raw.labels[i] || '', 'gen'); });
    this.clearMemo(); this.stataLog(s, names.join(' ') + ' generated as str');
    ok(s); return true;
  }
  // ---- build .104: every page function prints its Stata command
  // a page's own command (and table) into the console, once, marked as coming from the page
  cpPrint(o) { if (!o || !(o.stata || o.r)) return; this.pushLog({ t: 'stata', stata: o.stata || '* (no Stata command for this)', r: o.r || '# (no R code for this)', tbl: o.tbl || '', res: o.res || '' }); this.flash('Printed in the console'); }
  // TSV (as copied for Excel) to a plain text table for the console
  cpTsvText(tsv) {
    const rows = String(tsv || '').split('\n').map(l => l.split('\t')); if (!rows.length) return '';
    const n = Math.max(...rows.map(r => r.length)), w = Array.from({ length: n }, (_, j) => Math.min(28, Math.max(...rows.map(r => String(r[j] == null ? '' : r[j]).length))));
    const line = r => r.map((v, j) => { v = String(v == null ? '' : v).slice(0, 28); return j === 0 ? v.padEnd(w[j]) + ' |' : v.padStart(w[j] + 2); }).join('');
    return [line(rows[0]), '-'.repeat(w[0] + 1) + '+' + '-'.repeat(w.slice(1).reduce((a, x) => a + x + 2, 0)), ...rows.slice(1).map(line)].join('\n');
  }
  // the command for a chart under its download buttons (tlExportRow): chart-builder charts by their key
  cpCmdFor(key) { if (!/^cb-/.test(String(key))) return null; try { return this.cpChartCmd(this.state.plotKind, this.cbC ? this.cbC() : {}); } catch (e) { return null; } }
  cpPrintFor(key) { const c = this.cpCmdFor(key); if (c) this.cpPrint(c); }
  // Stata (and R) commands that draw what each chart-builder chart draws; charts with no official Stata command name
  // the user-written one (ssc install …)
  cpChartCmd(id, c) {
    const S = this.state, w = S.weightVar || '', cs = this.conds ? this.conds() : [], ifs = cs.length ? ' if ' + cs.map(k => this.condExpr(k, 'stata')).join(' & ') : '';
    const aw = w ? ' [aw=' + w + ']' : '', pw = w ? ' [pw=' + w + ']' : '', q = s => JSON.stringify(String(s || '')), x = c.x, y = c.y, g = c.group, f = c.facet;
    const o = (...a) => { const l = a.filter(Boolean); return l.length ? ', ' + l.join(' ') : ''; }, ttl = c.title ? 'title(' + q(c.title) + ')' : '', byf = f ? 'by(' + f + ')' : '';
    const need = (...v) => { if (v.some(z => !z)) throw new Error('pick the variables first'); };
    const vars = (c.vars || []).join(' '), R = [], ST = [];
    if (id === 'bar' || id === 'dot') { need(x); const st = c.stat || 'count'; const gr = id === 'dot' ? 'graph dot' : 'graph hbar'; ST.push(st === 'mean' || st === 'sum' ? (need(y), gr + ' (' + st + ') ' + y + aw + ifs + o('over(' + x + ', sort(1) descending)', ttl)) : gr + ' (' + (st === 'percent' ? 'percent' : 'count') + ')' + (st === 'percent' ? aw : '') + ifs + o('over(' + x + ', sort(1) descending)', ttl)); R.push('library(ggplot2)', st === 'mean' || st === 'sum' ? 'ggplot(df, aes(' + x + ', ' + y + ')) + stat_summary(fun = ' + st + ', geom = "col")' : 'ggplot(df, aes(' + x + ')) + geom_bar(' + (st === 'percent' ? 'aes(y = after_stat(100 * prop), group = 1)' : '') + ') + coord_flip()'); }
    else if (id === 'groupbar' || id === 'stackcount') { need(x, y); ST.push('graph hbar (' + (c.stat === 'percent' ? 'percent' : 'count') + ')' + ifs + o('over(' + y + ') over(' + x + ')', 'asyvars', id === 'stackcount' ? 'stack' : '', c.stat === 'percent' ? 'percentages' : '', ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + x + ', fill = ' + y + ')) + geom_bar(position = "' + (id === 'stackcount' ? 'stack' : 'dodge') + '")'); }
    else if (id === 'stack') { need(x, y); ST.push('graph hbar' + aw + ifs + o('over(' + y + ') over(' + x + ')', 'asyvars stack percentages', ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + x + ', fill = ' + y + ')) + geom_bar(position = "fill") + coord_flip()'); }
    else if (id === 'likert') { need(y); ST.push('* Likert chart: ssc install likert (or the same bars below)', 'graph hbar (percent)' + aw + ifs + o('over(' + y + ')', x ? 'over(' + x + ')' : '', 'asyvars stack percentages', ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + (x || '""') + ', fill = ' + y + ')) + geom_bar(position = "fill") + coord_flip()'); }
    else if (id === 'pie' || id === 'donut') { need(x); ST.push((id === 'donut' ? '* donut: a pie with a hole is not built in; the pie\n' : '') + 'graph pie' + aw + ifs + o('over(' + x + ')', 'plabel(_all percent, format(%4.1f))', byf, ttl)); R.push('library(ggplot2)', 'ggplot(df, aes("", fill = ' + x + ')) + geom_bar(width = 1) + coord_polar("y")'); }
    else if (id === 'hist') { need(x); ST.push((w ? '* histogram takes frequency weights only; the weight is left out\n' : '') + 'histogram ' + x + ifs + o(c.stat === 'percent' ? 'percent' : 'frequency', c.bins && c.bins !== 'auto' ? 'bin(' + c.bins + ')' : '', ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + x + ')) + geom_histogram(' + (c.bins && c.bins !== 'auto' ? 'bins = ' + c.bins : '') + ')'); }
    else if (id === 'density') { need(x); ST.push(g ? 'twoway kdensity ' + x + aw + ifs + o('by(' + g + ', note(""))', ttl) : 'kdensity ' + x + aw + ifs + o(ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + x + (g ? ', colour = ' + g : '') + ')) + geom_density()'); }
    else if (id === 'box') { need(x); ST.push('graph box ' + x + aw + ifs + o(ttl)); R.push('boxplot(df$' + x + ')'); }
    else if (id === 'gbox' || id === 'violin') { need(x, y); ST.push((id === 'violin' ? '* violin plot: ssc install vioplot\nvioplot ' + y + ifs + ', over(' + x + ')\n* or the box plot:\n' : '') + 'graph box ' + y + aw + ifs + o('over(' + x + ')', ttl)); R.push('library(ggplot2)', 'ggplot(df, aes(' + x + ', ' + y + ')) + geom_' + (id === 'violin' ? 'violin' : 'boxplot') + '()'); }
    else if (['scatterplain', 'scatter', 'smooth', 'hexbin'].includes(id)) { need(x, y);
      if (id === 'hexbin') ST.push('* hexbin: ssc install hexplot', 'hexplot ' + y + ' ' + x + ifs);
      else if (id === 'scatterplain' && g) ST.push('separate ' + y + ', by(' + g + ') veryshortlabel', 'scatter ' + y + '?* ' + x + ifs + o(ttl));
      else ST.push('twoway (scatter ' + y + ' ' + x + ')' + (id === 'scatter' ? ' (lfit ' + y + ' ' + x + ')' : id === 'smooth' ? ' (lowess ' + y + ' ' + x + ')' : '') + ifs + o(ttl));
      R.push('library(ggplot2)', 'ggplot(df, aes(' + x + ', ' + y + (g ? ', colour = ' + g : '') + ')) + ' + (id === 'hexbin' ? 'geom_hex()' : 'geom_point()' + (id === 'scatter' ? ' + geom_smooth(method = "lm")' : id === 'smooth' ? ' + geom_smooth(method = "loess")' : ''))); }
    else if (id === 'matrix') { need(vars); ST.push('graph matrix ' + vars + aw + ifs + o('half', ttl)); R.push('pairs(df[c(' + (c.vars || []).map(q).join(', ') + ')])'); }
    else if (id === 'corrmap') { need(vars); ST.push('* heat map: ssc install heatplot', 'correlate ' + vars + aw + ifs, 'matrix C = r(C)', 'heatplot C, values(format(%4.2f)) lower'); R.push('cor(df[c(' + (c.vars || []).map(q).join(', ') + ')], use = "pairwise.complete.obs")'); }
    else if (id === 'heatmap') { need(x, g, y); ST.push('* heat map: ssc install heatplot', 'heatplot ' + y + ' i.' + g + ' i.' + x + aw + ifs + ', statistic(mean) values(format(%9.2f))'); R.push('aggregate(' + y + ' ~ ' + g + ' + ' + x + ', df, mean)'); }
    else if (id === 'mean' || id === 'proportion') { need(x, y); ST.push((id === 'proportion' ? 'proportion ' + y + pw + ifs + ', over(' + x + ')\n' : 'mean ' + y + pw + ifs + ', over(' + x + ')\n') + 'regress ' + y + ' i.' + x + pw + ifs, 'margins ' + x, 'marginsplot, recast(scatter)' + (c.title ? ' title(' + q(c.title) + ')' : '')); R.push('aggregate(' + y + ' ~ ' + x + ', df, function(v) c(mean = mean(v), lo = t.test(v)$conf.int[1], hi = t.test(v)$conf.int[2]))'); }
    else if (id === 'dumbbell' || id === 'slope') { need(x, c.lo, y); ST.push('encode ' + x + ', generate(' + x + '_c)   // skip if ' + x + ' is already numeric', id === 'dumbbell' ? 'twoway (rspike ' + c.lo + ' ' + y + ' ' + x + '_c, horizontal) (scatter ' + x + '_c ' + c.lo + ') (scatter ' + x + '_c ' + y + ')' + ifs : 'twoway (pcspike ' + c.lo + ' ' + x + '_c ' + y + ' ' + x + '_c)' + ifs); R.push('library(ggplot2)', 'ggplot(df) + geom_segment(aes(x = ' + c.lo + ', xend = ' + y + ', y = ' + x + ', yend = ' + x + '))'); }
    else if (id === 'paired') { need(x, y); ST.push('graph dot (mean) ' + x + ' ' + y + aw + ifs, 'ttest ' + y + ' == ' + x + ifs); R.push('t.test(df$' + y + ', df$' + x + ', paired = TRUE)'); }
    else if (id === 'survival') { need(x, y); ST.push('stset ' + x + ', failure(' + y + ')', 'sts graph' + (g ? ', by(' + g + ')' : '')); R.push('library(survival)', 'plot(survfit(Surv(' + x + ', ' + y + ') ~ ' + (g || '1') + ', data = df))'); }
    else if (['coefficient', 'prediction', 'interaction', 'marginal', 'event', 'modelcompare', 'conjoint'].includes(id)) {
      if ((c.source || 'columns') === 'current' && this.descFor && (this.descFor() || {}).t === 'reg') { const reg = this.cmdText(this.tagSg(this.descFor()), 'stata'); ST.push(reg, id === 'coefficient' ? '* coefficient plot: ssc install coefplot\ncoefplot, drop(_cons) xline(0)' : id === 'interaction' ? 'margins ' + ((S.regIx || [])[0] ? (S.regIx[0].a + '#' + S.regIx[0].b) : (S.mgX || '')) + '\nmarginsplot' : 'margins ' + (S.mgX || '') + '\nmarginsplot'); }
      else { need(x, y); ST.push('* estimates stored as variables: ' + y + ' (estimate)' + (c.lo ? ', ' + c.lo + ' – ' + c.hi + ' (bounds)' : ''), 'twoway ' + (c.lo && c.hi ? '(rcap ' + c.lo + ' ' + c.hi + ' ' + x + ') ' : '') + '(scatter ' + y + ' ' + x + ')' + ifs + o('yline(0)', ttl)); }
      R.push('# see Regression → the R code of the model'); }
    else if (id === 'map') { ST.push('* map: ssc install spmap (shapefile converted with spshape2dta)', 'spmap ' + (y || 'value') + ' using coords.dta, id(_ID) fcolor(Blues) clmethod(quantile)'); R.push('library(sf); library(ggplot2)', 'ggplot(shapes) + geom_sf(aes(fill = ' + (y || 'value') + '))'); }
    else if (['line', 'area', 'panel', 'multiline'].includes(id)) { need(x, y);
      const cd = this.cbCoded ? this.cbCoded(y) : null, st = this.cbTlStat ? this.cbTlStat(c, cd) : 'mean', gby = g ? ' ' + g : '', how = g ? (id === 'panel' ? 'twoway line ~ ' + x + ', by(' + g + ')' : 'xtset ' + g + ' ' + x + '\nxtline ~, overlay') : 'twoway ' + (id === 'area' ? 'area' : 'line') + ' ~ ' + x;
      const enc = g && !(this.effMeta(g) && this.effMeta(g).type === 'numeric') ? 'encode ' + g + ', generate(' + g + '_c)\n' : '', gg = enc ? g + '_c' : g, how2 = enc ? how.replace(new RegExp('\\b' + g + '\\b', 'g'), gg) : how;
      ST.push('preserve');
      if (st === 'each' || st === 'eachn') { ST.push('tabulate ' + y + ', generate(_a)', 'collapse (' + (st === 'eachn' ? 'sum' : 'mean') + ') _a*' + (st === 'eachn' ? '' : pw) + ifs + ', by(' + x + gby + ')'); if (st === 'each') ST.push('foreach v of varlist _a* {', '    replace `v\' = 100 * `v\'', '}'); ST.push(enc + how2.replace('~', '_a*')); }
      else if (st === 'one' && cd) { const k = (c.ans != null ? c.ans : (cd.codes[0] || {}).key); ST.push('generate byte _ans = (' + y + ' == ' + k + ') if !missing(' + y + ')', 'collapse (mean) _ans' + pw + ifs + ', by(' + x + gby + ')', 'replace _ans = 100 * _ans', enc + how2.replace('~', '_ans')); }
      else ST.push('collapse (mean) ' + y + pw + ifs + ', by(' + x + gby + ')', enc + how2.replace('~', y));
      ST.push('restore'); if (c.smooth) ST.splice(ST.length - 1, 0, '* the page also smooths the line (moving average); see tssmooth ma');
      R.push('library(ggplot2)', 'a <- aggregate(' + y + ' ~ ' + x + (g ? ' + ' + g : '') + ', df, mean)', 'ggplot(a, aes(' + x + ', ' + y + (g ? ', colour = ' + g : '') + ')) + geom_line()'); }
    else return null;
    return { stata: ST.join('\n'), r: R.join('\n') };
  }
  // Settings that change later commands print once: the page weight, the survey design, missing codes, the level
  cpWatchSettings() {
    const S = this.state; if (S.screen !== 'work' || !this._raw) { this._cpSet = null; return; }
    const snap = { w: S.weightVar || '', psu: S.svyPsu || '', st: S.svyStrata || '', mc: String(S.missingCodes || '').trim(), a: String(S.alphaSel || '') }, prev = this._cpSet; this._cpSet = snap;
    if (!prev || (this._cpTyping && Date.now() - this._cpTyping < 3000)) return;   // first look, or a typed command that logs itself
    if (snap.w !== prev.w) this.pushLog({ t: 'stata', stata: snap.w ? '* the page now weights every analysis by ' + snap.w + ' (the commands below carry [pw=' + snap.w + '] or [aw=' + snap.w + '])' : '* the page weight is cleared', r: snap.w ? '# the page now weights every analysis by ' + snap.w : '# the page weight is cleared', res: '' });
    if (snap.psu !== prev.psu || snap.st !== prev.st) this.pushLog({ t: 'stata', stata: snap.psu || snap.st ? 'svyset ' + (snap.psu || '_n') + (snap.w ? ' [pw=' + snap.w + ']' : '') + (snap.st ? ', strata(' + snap.st + ')' : '') : 'svyset, clear', r: snap.psu || snap.st ? 'des <- survey::svydesign(ids = ~' + (snap.psu || '1') + (snap.st ? ', strata = ~' + snap.st : '') + (snap.w ? ', weights = ~' + snap.w : '') + ', data = df, nest = TRUE)' : 'rm(des)', res: '' });
    if (snap.mc !== prev.mc && snap.mc) this.pushLog({ t: 'stata', stata: 'mvdecode _all, mv(' + snap.mc.split(/[\s,;]+/).filter(Boolean).join(' ') + ')', r: 'df[df %in% c(' + snap.mc.split(/[\s,;]+/).filter(Boolean).join(', ') + ')] <- NA', res: 'treated as missing in every numeric variable' });
    if (snap.a !== prev.a && Number(snap.a) > 0) this.pushLog({ t: 'stata', stata: 'set level ' + +(100 * (1 - Number(snap.a))).toFixed(2), r: '# conf.level = ' + +(1 - Number(snap.a)).toFixed(4), res: '' });
  }
  // GM26 console page end
