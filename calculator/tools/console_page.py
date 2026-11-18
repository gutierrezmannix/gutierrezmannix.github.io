"""Console page, build .103.

  component  src/console-page.js (cp* methods) before descFor(); the render values; the console records actions,
             not views (the auto-log of the screen fires only when armed by a typed command, a Run button or
             Print in console); typed weights / summarize / tabulate / describe / tostring / conditions follow Stata
  template   src/console-page.css, the Console button after the Tests / Charts / Data menus, the page itself above
             the work grid (which is hidden while the console is open), Print in console in the export bar
Called from tools/build.py after the other integrators. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _between(text, begin, end, body, anchor, after=False):
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    i = text.index(anchor)
    if after:
        i += len(anchor)
        return text[:i] + '\n' + body + text[i:]
    return text[:i] + body + '\n' + text[i:]


def _one(text, old, new, what, count=1):
    if new in text:
        return text
    n = text.count(old)
    if n != count:
        raise RuntimeError(f'console_page: expected {count} anchor(s) for {what}, found {n}')
    return text.replace(old, new)


GEN_OLD = '        const c = part.trim().match(/^([A-Za-z_]\\w*)\\s*(==|!=|~=|>=|<=|>|<|=)\\s*(.+)$/);\n        if (!c) return fail(\'Could not read the condition "\' + part.trim() + \'" — write it like  ent == 7  or  year >= 2015\');'
GEN_INS = '        const mm = part.trim().match(/^(!|~)?\\s*missing\\(\\s*([A-Za-z_]\\w*)\\s*\\)$/i); if (mm) { const v = raw.names.find(n => n.toLowerCase() === mm[2].toLowerCase()); if (!v) return fail(\'"\' + mm[2] + \'" is not a variable in this dataset\'); conds.push({ v, op: mm[1] ? \'!=\' : \'==\', val: \'.\' }); continue; }\n'


def integrate_component(c):
    methods = (ROOT / 'src' / 'console-page.js').read_text()
    c = _between(c, '  // GM26 console page begin', '  // GM26 console page end', methods.rstrip(), '  descFor() {')
    more = (ROOT / 'src' / 'console-more.js').read_text()
    c = _between(c, '  // GM26 console more begin', '  // GM26 console more end', more.rstrip(), '  descFor() {')
    # render values
    c = _one(c, "    out.isPredict = S.tab === 'predict'; if (out.isPredict) out.prEl = this.prRender();",
             "    out.isPredict = S.tab === 'predict'; if (out.isPredict) out.prEl = this.prRender();\n"
             "    out.cpShow = !!S.cpOpen && S.screen === 'work'; if (out.cpShow) out.cpEl = this.cpRender(); else this._cpWasOpen = false;\n"
             "    out.cpGridHide = out.cpShow ? 'display: none;' : ''; out.cpBtnStyle = S.cpOpen ? 'background: var(--c194F39, #194F39); color: #FFFFFF; border-color: var(--c194F39, #194F39);' : '';\n"
             "    out.cpToggle = () => (this.state.cpOpen ? this.cpClose() : this.cpOpenPage()); out.cpPrintView = () => this.cpPrintView();\n"
             "    out.cpCanPrint = !S.cpOpen && S.screen === 'work' && !!this._raw && (() => { try { return !!this.descFor(); } catch (e) { return false; } })();",
             'render values')
    # the screen is logged only when armed; the side pane's Console tab now opens the console page
    c = _one(c, "    if (!this._raw || !this._E) return;\n    let d = this.descFor();",
             "    if (!this._raw || !this._E) return;\n"
             "    this.cpWatchSettings();\n"
             "    if (this.state.mfPane === 'output' && this.state.screen === 'work') { const skip = this._cpSkip && Date.now() - this._cpSkip < 600; if (!skip && !this.state.cpOpen) this._cpBack = this.state.tab; this.setState(skip ? { mfPane: 'plots' } : { mfPane: 'plots', cpOpen: true }, () => { if (!skip) { try { window.scrollTo(0, 0); } catch (e) {} } }); }\n"
             "    let d = this.descFor();", 'console page redirect')
    c = _one(c, "      if (d && (this._cxQuiet || fltQuiet)) d = null; if (d) d = this.cxAdopt(d);",
             "      if (d && (this._cxQuiet || fltQuiet)) d = null; if (d && !this.cpArmed()) d = null; let cpSrc = ''; if (d) { cpSrc = this.cpTakeArm(); d = this.cxAdopt(d); }",
             'log only when armed')
    c = _one(c, "upd.conLog = [...this.state.conLog, this.tagSg({ ...d, res, tbl,", "upd.conLog = [...this.state.conLog, this.tagSg({ ...d, src: cpSrc, res, tbl,", 'auto-log source')
    c = _one(c, "this.regRText(d) : d.tblR })].slice(-60); }", "this.regRText(d) : d.tblR })].slice(-500); }", 'auto-log length')
    c = _one(c, "return { conLog: [...base, this.tagSg({ ...d, res, tbl,", "return { conLog: [...base, this.tagSg({ ...d, src: this.cpSrc(), res, tbl,", 'runDirect source')
    c = _one(c, "this.regRText(d) : d.tblR })].slice(-60) };", "this.regRText(d) : d.tblR })].slice(-500) };", 'runDirect length')
    c = _one(c, "  pushLog(entry) { entry = this.tagSg(entry);", "  pushLog(entry) { entry = this.tagSg(entry); if (!entry.src) entry.src = this.cpSrc();", 'pushLog source')
    c = _one(c, "entry].slice(-60) }; }", "entry].slice(-500) }; }", 'pushLog length')
    # what arms the log: typed commands that open a page, the command builder, the Run button of the regression page
    c = _one(c, "    const done = (msg, patch, after) => {\n      this.setState(Object.assign({ mfCmd: ''",
             "    const done = (msg, patch, after) => { if (patch && patch.tab) this.cpArm('typed');\n      this.setState(Object.assign({ mfCmd: ''", 'arm typed')
    c = _one(c, "  runVerb(v, vals) {\n    this.jumpArm();", "  runVerb(v, vals) {\n    this.jumpArm(); this.cpArm('typed');", 'arm builder')
    c = _one(c, "out.regRun = () => { if (!this.state.depVar || !this.state.predictors.length) return; this._regRan = this.regSpec(); this.forceUpdate(); };",
             "out.regRun = () => { if (!this.state.depVar || !this.state.predictors.length) return; this._regRan = this.regSpec(); this.cpArm('page'); this.forceUpdate(); };", 'arm regression run')
    # the side pane keeps Plots, Report and Help; the console has its own page
    c = _one(c, "const DT = [['plots', 'Plots', nP], ['output', 'Console', S.conLog.length], ['report', 'Report', nPins], ['help', 'Help', 0]];",
             "const DT = [['plots', 'Plots', nP], ['report', 'Report', nPins], ['help', 'Help', 0]];", 'dock tabs')
    # typed commands as in Stata: summarize and tabulate of one variable print in the console (short summarize unless
    # detail), weights apply to their own command, describe takes a varlist, tostring takes gen(), conditions
    # understand missing() / inlist() / inrange()
    c = _one(c, "if (v0 === 'mean' || v0 === 'tabstat' || toks.length !== 1 || O.detail || O.d || (this.cxBareNumeric(V(toks[0])) && (this.effMeta(V(toks[0])) || {}).treatAs !== 'numeric')) return this.cxRun(v0 === 'mean' ? 'mean' : v0 === 'tabstat' ? 'tabstat' : 'summarize', s, { done, fail }); const hint = this.cxTextNumberHint(V(toks[0])); if (hint) return fail(hint); verb = 'summarize'; vars = [toks[0]]; }",
             "const hint = toks.length === 1 && V(toks[0]) ? this.cxTextNumberHint(V(toks[0])) : ''; if (hint) return fail(hint); return this.cxRun(v0 === 'mean' ? 'mean' : v0 === 'tabstat' ? 'tabstat' : 'summarize', s, { done, fail }); }",
             'summarize in the console')
    c = _one(c, "      else if (vb === 'tab') { if (!toks.length) return fail('tabulate needs a variable');",
             "      else if (vb === 'tab') { if (toks.length === 1 && !opts.svy) return this.cxRun('tab1', s, { done, fail }); if (!toks.length) return fail('tabulate needs a variable');", 'tabulate in the console')
    c = _one(c, "if (toks.length > 1) return this.cxRun('tab1', s, { done, fail }); verb = 'tabulate'; vars = [toks[0]]; }",
             "return this.cxRun('tab1', s, { done, fail }); }", 'tab1 in the console')
    c = _one(c, "      else if (vb === 'describe') verb = 'describe';",
             "      else if (vb === 'describe') { verb = 'describe'; if (toks.length) { const DL = this.cxVarlist(toks.join(' ')); if (DL.bad.length) return fail('variable ' + DL.bad[0] + ' not found'); opts.dvars = DL.vars; } }", 'describe varlist')
    c = _one(c, "if (verb === 'describe') { delete patch.conSig; this.setState(patch); this.runDirect({ t: 'describe' });",
             "if (verb === 'describe') { delete patch.conSig; this.setState(patch); this.runDirect(opts.dvars ? { t: 'describe', vars: opts.dvars } : { t: 'describe' });", 'describe varlist run')
    c = _one(c, "if (d.t === 'describe') return dial === 'stata' ? 'describe' : 'str(df)';",
             "if (d.t === 'describe') return dial === 'stata' ? 'describe' + (d.vars ? ' ' + d.vars.join(' ') : '') : (d.vars ? 'str(df[c(' + d.vars.map(v => JSON.stringify(v)).join(', ') + ')])' : 'str(df)');", 'describe command text')
    c = _one(c, "    if (d.t === 'describe') {\n      const raw = this._raw, cols = this.state.cols;",
             "    if (d.t === 'describe') return this.cpDescribe(d);\n    if (d.t === 'describe-old') {\n      const raw = this._raw, cols = this.state.cols;", 'describe table')
    c = _one(c, "    if (opts.w) { patch.weightVar = opts.w; patch.weightAuto = false; }",
             "    if (opts.w) { if (opts.w !== S.weightVar) this._cxW = { prev: S.weightVar, prevAuto: S.weightAuto, val: opts.w }; patch.weightVar = opts.w; patch.weightAuto = false; }", 'weight per command')
    c = _one(c, "  stataConds(ifs) {\n    const raw = this._raw, out = [];", "  stataConds(ifs) {\n    if (this.cpConds) return this.cpConds(ifs);\n    const raw = this._raw, out = [];", 'conditions')
    c = _one(c, "        const cond = c.op === '==' ? {", "        const cond = c.t === 'in' || c.t === 'rng' ? c : c.op === '==' && c.val !== '.' ? {", 'conditions to the subgroup')
    c = _one(c, "    if ((m = s.match(/^(destring|tostring)\\s+(.+?)(?:\\s*,.*)?$/i))) {",
             "    if (/^tostring\\s.*\\bgen(?:erate)?\\s*\\(/i.test(s)) return this.cpTostringGen(s, varlist, fail, ok);\n    if ((m = s.match(/^(destring|tostring)\\s+(.+?)(?:\\s*,.*)?$/i))) {", 'tostring gen()')
    c = _one(c, GEN_OLD, GEN_INS + GEN_OLD, 'generate if missing()')
    # build .105 / .106: typed commands that run on the Tests engine (ranksum, anova, mixed, stcox, pca …) and the
    # inspection and statistics commands of src/console-more.js (lookfor, levelsof, table, ci, swilk, egen …)
    c = _one(c, "    if (this.runStataExtra(s)) return;\n    const low = {};",
             "    if (this.cpEngine && this.cpEngine(s)) return;\n    if (this.cqRun && this.cqRun(s)) return;\n    if (this.runStataExtra(s)) return;\n    const low = {};", 'engine and more commands')
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 console page begin -->', '<!-- GM26 console page end -->'
    block = begin + '<style>' + (ROOT / 'src' / 'console-page.css').read_text() + '</style><sc-if value="{{ cpShow }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Console">{{ cpEl }}</div></sc-if>' + end
    grid_old = '      <div class="mf-grid" style="grid-template-columns: {{ layoutCols }};">'
    grid_new = '      <div class="mf-grid" style="grid-template-columns: {{ layoutCols }}; {{ cpGridHide }}">'
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        t = t[:a] + block + t[b:]
    else:
        t = _one(t, grid_old, block + '\n' + grid_old, 'console page block')
    t = _one(t, grid_old, grid_new, 'grid hidden while the console is open')
    t = _one(t, '</sc-for>        <button class="mf-btn" sc-camel-on-click="{{ mfSettingsToggle }}"',
             '</sc-for>        <button class="mf-btn mf-cpbtn" sc-camel-on-click="{{ cpToggle }}" style="{{ cpBtnStyle }}" title="The console: type Stata commands and see every command the page ran (Ctrl+K)">›_ Console<kbd>Ctrl K</kbd></button>\n        <button class="mf-btn" sc-camel-on-click="{{ mfSettingsToggle }}"', 'Console button')
    t = _one(t, '<div class="mf-exportbar">            <sc-if value="{{ exportInBar }}"',
             '<div class="mf-exportbar"><sc-if value="{{ cpCanPrint }}" hint-placeholder-val="{{ false }}"><button class="mf-btn mf-btn-sm" sc-camel-on-click="{{ cpPrintView }}" title="Print this page\'s Stata command and output in the console, once">›_ Print in console</button></sc-if>            <sc-if value="{{ exportInBar }}"', 'Print in console')
    return t
