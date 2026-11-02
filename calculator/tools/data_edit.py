"""Edit data (Design B): three jobs in plain words — fix a variable · make a new variable · choose what to use.

  component  src/data-edit.js (fix a variable · make a new variable from a recipe · choose rows and variables · save as CSV)
  template   src/data-edit.css and the tab block
  fixes      empty undo steps, CSV silently dropping hidden variables, range groups that did not match the
             Stata command shown, renamed variables losing their value labels, typed-but-not-picked variables
             in pickers, the Data menu opening over other buttons, the filter chip shown twice
Called from tools/text_lab.py.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _one(text, old, new, what):
    if new in text and old not in text:
        return text  # already applied
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'data_edit: expected one anchor for {what}, found {n}')
    return text.replace(old, new)


def _between(text, begin, end, body, anchor):
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    i = text.index(anchor)
    return text[:i] + body + '\n' + text[i:]


def _sc_end(t, start):
    level = 0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>', t[start:]):
        level += -1 if m[0].startswith('</') else 1
        if level == 0:
            return start + m.end()
    raise RuntimeError('data_edit: unbalanced sc-if')


DO_RECODE = """  doRecode() {
    // groups from numeric ranges, stored like Stata's  recode x (a/b=1 "Low") …, gen(y): codes 1, 2, 3… with value labels
    const S = this.state, v = S.rcVar, raw = this._raw;
    if (!v) return this.setState({ rcErr: 'pick a source variable' });
    const name = (S.rcName || '').trim() || (v.slice(0, 26) + '_grp');
    const bad = this.validName(name);
    if (bad) return this.setState({ rcErr: bad });
    const rows = (S.rcRows || []).map(r => ({ f: parseFloat(r.f), t: parseFloat(r.t), l: String(r.l || '').trim() })).filter(r => isFinite(r.f) && isFinite(r.t) && r.l);
    if (!rows.length) return this.setState({ rcErr: 'fill at least one range: from, to and a label' });
    if (rows.some(r => r.f > r.t)) return this.setState({ rcErr: 'each range needs from ≤ to' });
    if (this.colIdx(v) < 0) return this.setState({ rcErr: '"' + v + '" is no longer in the dataset — pick a source variable', rcVar: '' });
    const a = this.deNumAll ? this.deNumAll(v) : null, base = a ? { kind: 'num', a } : this.valsCore(v);
    if (!base || base.kind !== 'num') return this.setState({ rcErr: '"' + v + '" holds text — ranges need a number variable' });
    const allNum = rows.every(r => isFinite(Number(r.l)));
    rows.forEach((r, i) => { r.c = allNum ? Number(r.l) : i + 1; });
    const n = base.a.length, out = new Float64Array(n); out.fill(NaN); let hit = 0;
    for (let i = 0; i < n; i++) { const x = base.a[i]; if (!isFinite(x)) continue; const r = rows.find(r2 => x >= r2.f && x <= r2.t); if (r) { out[i] = r.c; hit++; } }
    this.addDerivedCol(name, { k: 'n', a: out }, 'groups of ' + v, 'recode');
    if (!allNum) { raw.vlabs = raw.vlabs || {}; raw.vlabs[name] = new Map(rows.map(r => [r.c, r.l])); this.rememberLabels([name]); this.clearMemo(); this.setState(s => ({ dver: (s.dver || 0) + 1 })); }
    const msg = name + ' created: ' + rows.length + ' groups · ' + this.fmtN(hit) + ' rows grouped' + (hit < n ? ' · ' + this.fmtN(n - hit) + ' missing or outside every range' : '');
    this.setState({ rcName: '', rcErr: '', rcMsg: msg, rcRows: [{ f: '', t: '', l: '' }, { f: '', t: '', l: '' }, { f: '', t: '', l: '' }] });
    this.pushLog({ t: 'recode', v, name, rows, res: rows.length + ' groups · n recoded = ' + this.fmtN(hit) + ' (values outside the ranges become missing)' });
  }
"""


def integrate_component(c):
    methods = (ROOT / 'src' / 'data-edit.js').read_text()
    c = _between(c, '  // GM26 edit data begin', '  // GM26 edit data end', '  // GM26 edit data begin\n' + methods.rstrip() + '\n  // GM26 edit data end', '  descFor() {')
    if '// GM26 edit data render' not in c:
        old = '    if (out.isErgm) out.nlEl = this.nlRender();'
        if c.count(old) != 1:
            raise RuntimeError('data_edit: render anchor')
        c = c.replace(old, old + '\n    // GM26 edit data render\n    if (out.isData) out.deEl = this.deRender();')
    # range groups: numeric codes with value labels (as the Stata command says), and the default name
    a = c.index('  doRecode() {')
    b = c.index('  doRename() {', a)
    c = c[:a] + DO_RECODE + c[b:]
    c = _one(c, """'(' + r.f + '/' + r.t + '=' + (i + 1) + ' "' + r.l + '")').join(' ') + ', gen(' + d.name + ')'""",
             """'(' + r.f + '/' + r.t + '=' + (r.c != null ? r.c : i + 1) + (r.c != null && String(r.c) === r.l ? '' : ' "' + r.l + '"') + ')').join(' ') + ' (else=.), gen(' + d.name + ')'""", 'recode command')
    # alpha with reversed items
    c = _one(c, """'alpha ' + d.items.join(' ') + ', asis' : 'psych::alpha(df[, c(' + d.items.map(v => '"' + v + '"').join(', ') + ')])';""",
             """'alpha ' + d.items.join(' ') + (d.rev && d.rev.length ? ', reverse(' + d.rev.join(' ') + ') item' : ', asis') : 'psych::alpha(df[, c(' + d.items.map(v => '"' + v + '"').join(', ') + ')]' + (d.rev && d.rev.length ? ', keys = c(' + d.rev.map(v => '"' + v + '"').join(', ') + ')' : '') + ')';""", 'alpha command')
    # no empty undo steps: snapshot only once the change is known to be valid
    c = _one(c, """    this.snap('recode ' + name, [idx]);
    const col = raw.cols[idx], isNum = col.k === 'n';
    const pairs = Object.entries(this.state.bcMap || {}).map(([o, nv]) => [o, String(nv).trim()]).filter(([o, nv]) => nv !== '' && nv !== o);
    if (!pairs.length) return this.setState({ bcErr: 'type a new value next to at least one value' });
    if (isNum) { const badP = pairs.find(([, nv]) => nv !== '.' && !isFinite(Number(nv))); if (badP) return this.setState({ bcErr: '"' + badP[1] + '" is not a number — switch the type to TEXT first if you want words' }); }
""", """    const col = raw.cols[idx], isNum = col.k === 'n';
    const pairs = Object.entries(this.state.bcMap || {}).map(([o, nv]) => [o, String(nv).trim()]).filter(([o, nv]) => nv !== '' && nv !== o);
    if (!pairs.length) return this.setState({ bcErr: 'type a new value next to at least one value' });
    if (isNum) { const badP = pairs.find(([, nv]) => nv !== '.' && !isFinite(Number(nv))); if (badP) return this.setState({ bcErr: '"' + badP[1] + '" is a word but ' + name + ' holds numbers — add it as a value label, or turn ' + name + ' into text first' }); }
    this.snap('recode ' + name, [idx]);
""", 'recodeCol snapshot')
    c = _one(c, """    this.snap('replace ' + name, [idx]);
    let nv = null, str = null;
    if (isNum) { const r = this.evalExprAll(vtxt); if (r.error) return this.setState({ rpErr: r.error }); nv = r.a; }
    else str = vtxt === '.' ? '' : vtxt.replace(/^"(.*)"$/, '$1');
""", """    let nv = null, str = null;
    if (isNum) { const r = this.evalExprAll(vtxt); if (r.error) return this.setState({ rpErr: r.error }); nv = r.a; }
    else str = vtxt === '.' ? '' : vtxt.replace(/^"(.*)"$/, '$1');
    this.snap('replace ' + name, [idx]);
""", 'doReplace snapshot')
    c = _one(c, """    this.snap('add ' + k + ' rows', raw.cols.map((c, i) => c.k === 's' ? i : -1).filter(i => i >= 0));
    if ((raw.n + k) * raw.cols.length > 4e6) return this.setState({ bErr: 'This dataset is too large to add rows in the browser — add them in Excel/Stata and reload.' });
""", """    if ((raw.n + k) * raw.cols.length > 4e6) return this.setState({ bErr: 'This dataset is too large to add rows in the browser — add them in Excel/Stata and reload.' });
    this.snap('add ' + k + ' rows', raw.cols.map((c, i) => c.k === 's' ? i : -1).filter(i => i >= 0));
""", 'addRows snapshot')
    # Save as CSV: hidden variables are left out only on purpose, and the save is confirmed
    c = _one(c, """  saveCsv() {
    this._dirty = false; this.setState({ dirty: false });
    const raw = this._raw, hid = new Set(this.state.hiddenVars || []);""", """  saveCsv(withHidden) {
    this._dirty = false; this.setState({ dirty: false });
    const raw = this._raw, hid = new Set(withHidden === true ? [] : (this.state.hiddenVars || []).filter(v => raw.names.includes(v)));""", 'saveCsv hidden')
    c = _one(c, """    a.download = (this.state.fileName || 'my-dataset').replace(/\\.(csv|dta|tsv|txt|tab|xlsx|xlsm|xls|json)$/i, '').replace(/\\.gm26$/i, '') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }""", """    a.download = (this.state.fileName || 'my-dataset').replace(/\\.(csv|dta|tsv|txt|tab|xlsx|xlsm|xls|json)$/i, '').replace(/\\.gm26$/i, '') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.setState({ undoMsg: 'Saved ' + a.download + ' · ' + this.fmtN(raw.n) + ' rows × ' + idx.length + ' variables' + (hid.size ? ' (' + hid.size + ' hidden left out)' : '') });
    clearTimeout(this._umT); this._umT = setTimeout(() => this.setState({ undoMsg: '' }), 4000);
  }""", 'saveCsv message')
    # renaming keeps value labels and the READ AS choice
    c = _one(c, """    this._raw.names[idx] = to;
    this.clearMemo();
    const ren = x => x === from ? to : x;""", """    this._raw.names[idx] = to;
    if (this._raw.vlabs && this._raw.vlabs[from]) { this._raw.vlabs[to] = this._raw.vlabs[from]; delete this._raw.vlabs[from]; }
    this.clearMemo();
    const ren = x => x === from ? to : x;""", 'rename value labels')
    c = _one(c, """      rnFrom: '', rnTo: '', rnErr: ''
    }));
    this.pushLog({ t: 'rename', from, to, res: '' });""", """      rnFrom: '', rnTo: '', rnErr: '', treat: Object.fromEntries(Object.entries(s.treat || {}).map(([k, x]) => [ren(k), x]))
    }));
    this.pushLog({ t: 'rename', from, to, res: '' });""", 'rename treat')
    # pickers: a variable name typed exactly (without clicking the suggestion) is accepted when the box loses focus
    c = _one(c, """        blur: () => setTimeout(() => { if (this.state.pk === id) this.setState({ pk: null, pq: '' }); }, 260),""",
             """        blur: () => setTimeout(() => { if (this.state.pk !== id) return; const q = String(this.state.pq || '').trim().toLowerCase(), hit = q ? visAll.find(c => c.name.toLowerCase() === q && (!filterFn || filterFn(c))) : null; this.setState({ pk: null, pq: '' }); if (hit && hit.name !== current) setFn(hit.name); }, 260),""", 'picker blur')
    # Data menu: one entry per task, each opening it directly
    c = _one(c, """        ['New variable (generate / replace)', go({ tab: 'data', nvTab: 'build' })],
        ['Edit a variable (rename · type · recode · delete)', go({ tab: 'data' })],
        ['Add rows · save as CSV', go({ tab: 'data' })],
        ['Recode into groups', go({ tab: 'data' })],
        ['Hide variables (drop / keep)', go({ tab: 'data' })],
        ['Filter rows (keep if)', go({ tab: 'data' })],
        ["Scale reliability (Cronbach's alpha)", go({ tab: 'data' })]""", """        ['Fix a variable (rename · labels · recode · delete)', () => { this.setState(closeMenu); this.deGo('var'); }],
        ['Make a new variable (0/1 · groups · scale · formula)', () => { this.setState(closeMenu); this.deGo('new'); }],
        ['Choose what to use (rows · variables)', () => { this.setState(closeMenu); this.deGo('use'); }]""", 'Data menu')
    c = _one(c, """            ['Edit data — all tools', goT({ tab: 'data' })]
          ].concat(navItems('Data').slice(1)), 'See, browse and edit the data: overview, data view, variable labels, new variables, recode, filter']""",
             """          ].concat(navItems('Data').slice(1)), 'See, browse and edit the data: overview, data view, variable labels, fix or make variables, choose rows and variables']""", 'Data nav')
    c = _one(c, "['data', 'Edit data — new variable · recode · filter']", "['data', 'Edit data — fix · make · choose what to use']", 'data links')
    # Console entries for data steps open the matching task
    c = _one(c, """if (['gen', 'nvgen', 'replace', 'recode', 'rename', 'dropv', 'restorev', 'filter', 'unfilter', 'cralpha'].includes(d.t)) { this.setState(Object.assign({ tab: 'data', nvTab: 'build' }""",
             """if (['gen', 'nvgen', 'replace', 'recode', 'rename', 'dropv', 'restorev', 'filter', 'unfilter', 'cralpha'].includes(d.t)) { this.setState(Object.assign({ tab: 'data', nvTab: 'build', deTask: '', de: Object.assign({}, this.state.de, { task: { gen: 'new', nvgen: 'new', replace: 'new', recode: 'new', rename: 'var', dropv: 'use', restorev: 'use', filter: 'use', unfilter: 'use', cralpha: 'scale' }[d.t] }) }""", 'log routing')
    # one chip for the rows in use (the filter was listed twice: as Filter and inside Subgroup)
    c = _one(c, """      if (S.flt && S.flt.on) chips.push({ label: 'Filter: ' + this.fltText(S.flt), on: true, title: 'Row filter (keep if) — click to edit it under Edit data', click: () => this.setState({ tab: 'data', mfMobile: 'analysis', mfFile: false, mfNav: '' }) });\n""", '', 'filter chip')
    c = _one(c, """title: 'Subgroup applied to every tab — click to edit', click: () => { this.setState({ mfMobile: 'analysis', mfFile: false, mfNav: '' }); this.scrollToLabel('Subgroup (if)'); } });""",
             """title: 'Rows used by every analysis — click to edit', click: () => { if (!this.sgTab()) return this.deGo('rows'); this.setState({ mfMobile: 'analysis', mfFile: false, mfNav: '' }); this.scrollToLabel('Subgroup (if)'); } });""", 'subgroup chip')
    c = _one(c, """    out.sbFilter = (S.flt && S.flt.on) ? 'FILTER ON: ' + this.fltText(S.flt) : 'FILTER: OFF';
    out.sbFilterStyle = "font-family: var(--fMono, 'Space Mono', monospace); font-size: 10.5px; white-space: nowrap; " + ((S.flt && S.flt.on) ?""",
             """    const sbC = this._raw ? this.conds('one') : [];
    out.sbFilter = sbC.length ? 'ROWS: ' + sbC.map(c => this.condLabel(c)).join(' & ') : 'ROWS: ALL';
    out.sbFilterStyle = "font-family: var(--fMono, 'Space Mono', monospace); font-size: 10.5px; white-space: nowrap; " + (sbC.length ?""", 'status bar rows')
    # Browse: clicking a column name opens it in Change a variable
    c = _one(c, """  openColPanel(name) { this.setState({ bColMenu: name, bcName: name, bcMap: {}, bcMsg: '', bcErr: '', bcDelArm: false, rnErr: '' }); }""",
             """  openColPanel(name) { this._deRn = null; this.setState(s => ({ bColMenu: name, bcName: name, bcMap: {}, bcMsg: '', bcErr: '', bcDelArm: false, rnErr: '', rpMsg: '', rpErr: '', rcErr: '', rcMsg: '', deTask: '', de: Object.assign({}, s.de, { task: 'var', v: name, armDel: '', vl: null }) })); }""", 'openColPanel')
    c = _one(c, """      data: 'Prepare data before analysis: make a NEW VARIABLE (name it, pick numeric or text, choose a starting value, then fill it with REPLACE \\u2026 IF and check it in PREVIEW), EDIT A VARIABLE (rename, change its type, recode its values, hide or delete it), RECODE numeric ranges into groups, add rows or save the data as CSV, and check scale reliability with Cronbach\\u2019s alpha. To analyse only some rows, use the IF subgroup bar on each tab.',""",
             """      data: 'Prepare data before analysis in three jobs: FIX A VARIABLE (rename it, say what it measures, choose whether it holds groups or numbers, write what each code means and change values in one table, change values only where a condition is true, delete), MAKE A NEW VARIABLE (pick a recipe: yes/no 0/1, groups from a number, a scale from several questions with Cronbach\\u2019s alpha, a calculation, copy and recode, or blank) and CHOOSE WHAT TO USE (which rows go into analyses, which variables show in the lists). Every change can be undone; Save data as CSV can keep only the rows in use.',""", 'help text')
    # Stata/R commands: a number variable read as categories is compared with numbers (democrat == 1, not == "1")
    c = _one(c, """    const m = this.effMeta(c.v), isCat = !m || m.treatAs !== 'numeric';
    const q = x => isCat ? '"' + x + '"' : x;""", """    const m = this.effMeta(c.v), isCat = !m || m.treatAs !== 'numeric', ci = this._raw ? this._raw.names.indexOf(c.v) : -1, numStore = ci >= 0 && this._raw.cols[ci].k === 'n';
    const bare = x => numStore && (x === '.' || (String(x).trim() !== '' && isFinite(Number(x))));
    const q = x => isCat && !bare(x) ? '"' + x + '"' : x;""", 'condExpr quoting')
    c = _one(c, """    return c.v + ' ' + c.op + ' ' + (c.cat ? '"' + c.val + '"' : c.val);
  }
  withIf(base, sg, dial) {""", """    return c.v + ' ' + c.op + ' ' + (c.cat && !bare(c.val) ? '"' + c.val + '"' : c.val);
  }
  withIf(base, sg, dial) {""", 'condExpr op quoting')
    c = _one(c, '"route":{"tab":"data"}', '"route":{"tab":"data","deTask":"scale"}', 'model guide route')
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 edit data begin -->', '<!-- GM26 edit data end -->'
    css = (ROOT / 'src' / 'data-edit.css').read_text()
    block = begin + '<style>' + css + '</style><sc-if value="{{ isData }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Data tools">{{ deEl }}</div></sc-if>' + end
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        t = t[:a] + block + t[b:]
    else:
        a = t.index('<sc-if value="{{ isData }}"')
        b = _sc_end(t, a)
        t = t[:a] + block + t[b:]
    # the Data menu now sits in the middle of the toolbar: open it under its own button, not over Tests and Charts
    t = _one(t, '.mf-navwrap:has(> .mf-nav[data-nav="datam"]) .mf-menu { left: auto; right: 0; }', '.mf-navwrap:has(> .mf-nav[data-nav="datam"]) .mf-menu { left: 0; right: auto; }', 'Data menu position')
    return t
