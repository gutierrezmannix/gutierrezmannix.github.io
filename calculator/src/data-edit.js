  // ---- Edit data (Design A): one place for each job, no overlapping tools
  // Tasks: change a variable · new variable · make a scale · rows · show / hide variables. Every change can be undone.
  deDefaults() { return { task: 'var', v: '', mode: 'values', vl: null, armDel: '', rowsV: '', rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '', colsQ: '', withHidden: false, scaleRev: [], scaleName: '', scaleHow: 'mean' }; }
  // state.de holds the tab's choices; state.deTask (set by links such as the model guide) opens a task once
  deOf(s) { const d = Object.assign(this.deDefaults(), s.de || {}); if (s.deTask) d.task = s.deTask; return d; }
  deS() { return this.deOf(this.state); }
  deSet(p) { this.setState(s => { const cur = this.deOf(s); return { de: Object.assign(cur, typeof p === 'function' ? p(cur) : p), deTask: '' }; }); }
  deGo(task, extra) { this.setState(s => ({ tab: 'data', mfMobile: 'analysis', mfNav: '', deTask: '', de: Object.assign(this.deOf(s), { task, armDel: '' }, extra || {}) })); }
  deBrowse(v) { const hid = this.state.hiddenVars || [], vis = this.state.cols.filter(c => !hid.includes(c.name)), k = vis.findIndex(c => c.name === v); this.setState({ tab: 'browse', browseMode: 'data', bCol: Math.max(0, k - 2) }); }
  // rows used by analyses on every tab (the IF subgroup and any filter typed as a command)
  deConds() { return this.conds('one'); }
  deMask() {
    const cs = this.deConds(); if (!cs.length) return null;
    let mk = null;
    for (const c of cs) { const m = this.condMask(c); if (!m) continue; if (!mk) mk = Uint8Array.from(m); else for (let i = 0; i < mk.length; i++) mk[i] &= m[i]; }
    return mk;
  }
  deKept() { const mk = this.deMask(); if (!mk) return this._raw.n; let k = 0; for (let i = 0; i < mk.length; i++) k += mk[i]; return k; }
  // numeric values of a numeric-stored variable on every row (missing codes applied), also when it is analysed as categories
  deNumAll(v) {
    const m = this.effMeta(v); if (!m || m.type !== 'numeric') return null;
    const ac = (this.state.autoScreen && m.autoCodes && m.autoCodes.length) ? m.autoCodes : null;
    return this.memo('deN|' + v + '|' + (ac ? ac.join(',') : ''), () => { let t = this.toks(); if (ac) t = { strs: t.strs, nums: new Set([...t.nums, ...ac]), any: true }; const c = this._E.colVals(this._raw, Object.assign({}, m, { treatAs: 'numeric' }), t); return c && c.kind === 'num' ? c.a : null; });
  }
  // the values actually stored (codes, not their labels), with counts — what recoding and labelling work on
  deLevels(v) {
    const i = this.colIdx(v); if (i < 0) return [];
    const col = this._raw.cols[i];
    return this.memo('deLv|' + v + '|' + (this._dataRev || 0), () => {
      const m = new Map();
      if (col.k === 'n') { for (const x of col.a) if (isFinite(x)) { const k = this._E.numLab(x); m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([label, c]) => ({ label, c })).sort((p, q) => parseFloat(p.label) - parseFloat(q.label)); }
      for (const x of col.a) { const k = x == null ? '' : String(x); if (k.trim() === '') continue; m.set(k, (m.get(k) || 0) + 1); }
      return [...m].map(([label, c]) => ({ label, c })).sort((p, q) => q.c - p.c);
    });
  }
  deInfo(v) {
    const raw = this._raw, i = this.colIdx(v); if (i < 0) return null;
    const m = this.effMeta(v) || {}, col = raw.cols[i];
    let filled = 0; for (let r = 0; r < raw.n; r++) { const x = col.a[r]; if (col.k === 'n' ? isFinite(x) : (x != null && String(x).trim() !== '')) filled++; }
    const lv = this.deLevels(v);
    return { v, i, m, col, num: col.k === 'n', treat: m.treatAs === 'numeric' ? 'numeric' : 'categorical', filled, missing: raw.n - filled, levels: lv, label: raw.labels[i] || '', vl: raw.vlabs && raw.vlabs[v] instanceof Map ? raw.vlabs[v] : null };
  }
  deVarSelect(value, onChange, o) {
    o = o || {}; const S = this.state, hid = new Set(S.hiddenVars || []);
    const list = S.cols.filter(c => !o.filter || o.filter(c));
    const opts = [['', o.placeholder || 'Pick a variable…']].concat(list.map(c => { const m = this.effMeta(c.name); return [c.name, c.name + (c.label ? ' — ' + String(c.label).slice(0, 42) : '') + '   · ' + (m && m.treatAs === 'numeric' ? 'number' : 'categories') + (hid.has(c.name) ? ' · hidden' : '')]; }));
    return this.tlSelect(value || '', opts, onChange, o.aria || 'Variable', { className: 'tl-select de-vsel' });
  }
  deMsgs(okText, errText) {
    const h = React.createElement;
    return h(React.Fragment, null, okText ? this.tlBanner('ok', okText) : null, errText ? this.tlBanner('warn', errText) : null);
  }
  deCmd(d) { const S = this.state; try { const t = this.cmdText(d, S.dialect); return t ? React.createElement('div', { className: 'de-cmd', title: 'The same step as a ' + (S.dialect === 'r' ? 'R' : 'Stata') + ' command' }, (S.dialect === 'r' ? '> ' : '. ') + t.split('\n').join('\n' + (S.dialect === 'r' ? '> ' : '. '))) : null; } catch (e) { return null; } }

  // ---- the tab
  deRender() {
    const h = React.createElement, S = this.state, D = this.deS(), raw = this._raw;
    if (!raw || !this._E) return null;
    const hid = (S.hiddenVars || []).filter(v => raw.names.includes(v)), nU = (this._undo || []).length, nC = this.deConds().length;
    const tasks = [
      ['var', 'Change a variable', 'rename · type · labels · recode · delete'],
      ['new', 'New variable', 'formula · dummy · fill in rows'],
      ['scale', 'Make a scale', 'Cronbach’s alpha · scale score'],
      ['rows', nC ? 'Rows · ' + this.fmtN(this.deKept()) + ' of ' + this.fmtN(raw.n) : 'Rows', 'use only some rows · add rows'],
      ['cols', hid.length ? 'Show / hide variables · ' + hid.length + ' hidden' : 'Show / hide variables', 'tidy long variable lists']
    ];
    const head = h('div', { className: 'de-head' },
      h('h2', null, 'Edit data'),
      h('span', { className: 'de-dims' }, this.fmtN(raw.n) + ' rows × ' + raw.names.length + ' variables' + (hid.length ? ' · ' + hid.length + ' hidden' : '')),
      h('div', { className: 'de-head-r' },
        nU ? this.tlBtn('↶ Undo: ' + (S.undoLabel || 'last change'), () => this.undo(), '', { title: 'Undo the last change (Ctrl/⌘+Z)' }) : null,
        hid.length ? h('label', { className: 'de-check', title: 'Hidden variables are left out of the CSV unless you tick this' }, h('input', { type: 'checkbox', checked: !!D.withHidden, onChange: e => this.deSet({ withHidden: e.target.checked }) }), 'include the ' + hid.length + ' hidden') : null,
        this.tlBtn('Save data as CSV', () => this.saveCsv(!!D.withHidden), 'primary', { title: 'Download the data with every change you made; open it again any time from File' })));
    const nav = h('div', { className: 'de-tasks', role: 'tablist', 'aria-label': 'Edit data tasks' }, tasks.map(([k, l, sub]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': D.task === k ? 'true' : 'false', className: 'de-task' + (D.task === k ? ' on' : ''), title: sub, onClick: () => this.deSet({ task: k, armDel: '' }) }, l)));
    const body = D.task === 'new' ? this.deTaskNew(D) : D.task === 'scale' ? this.deTaskScale(D) : D.task === 'rows' ? this.deTaskRows(D) : D.task === 'cols' ? this.deTaskCols(D) : this.deTaskVar(D);
    return h('div', { className: 'tl de' }, head, nav, body, h('p', { className: 'tl-hint de-foot' }, 'Every change here can be undone (Ctrl/⌘+Z) and is written to the Console as a ' + (S.dialect === 'r' ? 'R' : 'Stata') + ' command. Changes live in this tab until you save the data as CSV or save the session (File).'));
  }

  // ---- 1. change a variable
  dePickVar(n) {
    this._deRn = null;
    this.setState({ bColMenu: n, bcMap: {}, bcMsg: '', bcErr: '', rnErr: '', rpMsg: '', rpErr: '', rpVal: '', rpConds: [{ v: '', op: '==', val: '' }], rcErr: '', rcMsg: '', rcName: '', rcRows: [{ f: '', t: '', l: '' }, { f: '', t: '', l: '' }, { f: '', t: '', l: '' }] });
    this.deSet({ v: n, armDel: '', vl: null });
  }
  deTaskVar(D) {
    const h = React.createElement, S = this.state, v = D.v && this.colIdx(D.v) >= 0 ? D.v : '';
    const pick = h('div', { className: 'tl-row wide' }, this.tlField('Variable', this.deVarSelect(v, n => this.dePickVar(n), { aria: 'Variable to change' })),
      v ? h('button', { type: 'button', className: 'tl-link', onClick: () => this.deBrowse(v) }, 'See it in Browse →') : h('span', { className: 'tl-hint' }, 'Tip: in Browse, click a column name to open it here.'));
    if (!v) return this.tlPanel('Change a variable', 'pick the variable you want to work on', null, pick,
      h('p', { className: 'de-hint' }, 'Rename it, describe it, choose whether it holds numbers or text, change or label its values, group a number into ranges, change values only where a condition is true, hide it or delete it — all in one place.'));
    const I = this.deInfo(v), hid = (S.hiddenVars || []).includes(v);
    const cont = I.num && I.levels.length > 20, lo = cont ? I.levels[0].label : '', hi = cont ? I.levels[I.levels.length - 1].label : '';
    const top = cont ? [] : I.levels.slice().sort((a, b) => b.c - a.c).slice(0, 8).map(r => { const lab = I.num ? this.vlabel(v, r.label) : String(r.label); return String(r.label) + (lab !== String(r.label) ? ' “' + lab + '”' : '') + ' (' + this.fmtN(r.c) + ')'; });
    const about = h('div', { className: 'de-kv' },
      h('span', { className: 'de-pill' }, 'stored as ' + (I.num ? 'numbers' : 'text')),
      h('span', { className: 'de-pill' }, 'analysed as ' + (I.treat === 'numeric' ? 'a number scale' : 'categories')),
      h('span', { className: 'de-pill' }, this.fmtN(I.filled) + ' filled · ' + this.fmtN(I.missing) + ' missing'),
      h('span', { className: 'de-pill' }, this.fmtN(I.levels.length) + ' different values'),
      cont ? h('span', { className: 'tl-hint de-top' }, 'values from ' + lo + ' to ' + hi) : top.length ? h('span', { className: 'tl-hint de-top' }, 'most common: ' + top.join(' · ')) : null);
    // name, description, type
    const nameIn = h('input', { className: 'tl-input mono', key: 'rn' + v, defaultValue: v, 'aria-label': 'Name', spellCheck: false, style: { width: '190px' }, onChange: e => { this._deRn = e.target.value; }, onKeyDown: e => { if (e.key === 'Enter') { this._deRn = e.target.value; this.deRename(v); } } });
    const delArmed = D.armDel === v;
    const props = this.tlPanel('Name, description and type', null, null,
      h('div', { className: 'de-grid2' },
        this.tlField('Name', h('div', { className: 'tl-row' }, nameIn, this.tlBtn('Rename', () => this.deRename(v)))),
        this.tlField('Description (variable label)', h('input', { className: 'tl-input', key: 'lb' + v + '|' + I.label, defaultValue: I.label, placeholder: 'e.g. Age in years', 'aria-label': 'Description (variable label)', style: { width: '100%' }, onBlur: e => this.deSetLabel(v, e.target.value), onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); this.deSetLabel(v, e.target.value); } } })),
        this.tlField('Stored as', this.tlSeg([['n', 'Numbers', 'Values are numbers (you can average them)'], ['s', 'Text', 'Values are words or codes']], I.num ? 'n' : 's', k => { if ((k === 's') === I.num) this.retypeCol(v, k === 's'); }, { 'aria-label': 'Stored as' }),
          h('span', { className: 'tl-hint' }, I.num ? 'Switching to text keeps every value as written.' : 'Switching to numbers: anything that is not a number becomes missing (.).')),
        this.tlField('Analysed as', I.num ? this.tlSeg([['categorical', 'Categories (groups)', 'Frequency tables, bar charts, dummies in regression'], ['numeric', 'A number scale', 'Mean, standard deviation, histograms']], I.treat, k => this.deSetTreat(v, k), { 'aria-label': 'Analysed as' }) : h('span', { className: 'tl-hint' }, 'Text is always analysed as categories.'),
          I.num ? h('span', { className: 'tl-hint' }, 'Codes like 0/1 or 1–5 are read as categories automatically — change it here (the same as READ AS in Overview).') : null)),
      h('div', { className: 'tl-row' },
        this.tlBtn(hid ? 'Show it in variable lists' : 'Hide it from variable lists', () => this.deToggleHide(v), '', { title: 'Hiding keeps the data; it only tidies the lists' }),
        this.tlBtn(delArmed ? 'Click again to delete ' + v : 'Delete variable…', () => this.deDelete(v), 'de-danger' + (delArmed ? ' armed' : ''), { 'aria-label': delArmed ? 'Confirm: delete ' + v : 'Delete ' + v }),
        delArmed ? h('span', { className: 'tl-hint' }, 'Undo brings it back.') : null),
      this.deMsgs(S.bcMsg, S.bcErr || S.rnErr));
    return h(React.Fragment, null, this.tlPanel('Change a variable', null, null, pick, about), props, this.deValuesPanel(D, I));
  }
  deValuesPanel(D, I) {
    const h = React.createElement, S = this.state, v = I.v, nLv = I.levels.length;
    const modes = [['values', 'One value at a time', nLv > 0 && nLv <= 40], ['labels', 'Value labels', I.num && nLv > 0 && nLv <= 60], ['groups', 'Group into ranges', I.num], ['where', 'Only where… (replace if)', true]].filter(m => m[2]);
    const mode = modes.some(m => m[0] === D.mode) ? D.mode : modes[0][0];
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist' }, modes.map(([k, l]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': mode === k ? 'true' : 'false', className: mode === k ? 'on' : '', onClick: () => this.deSet({ mode: k }) }, l)));
    let body;
    if (mode === 'values') body = this.deRecodeBox(I);
    else if (mode === 'labels') body = this.deLabelsBox(D, I);
    else if (mode === 'groups') body = this.deGroupsBox(I);
    else body = this.deReplaceBox(v);
    const sub = nLv > 40 ? nLv + ' different values — one-at-a-time recoding is for up to 40; group the values into ranges or use “Only where…”' : 'change values in this variable';
    return this.tlPanel('Change its values', sub, null, tabs, body);
  }
  deRecodeBox(I) {
    const h = React.createElement, S = this.state, v = I.v, mp = S.bcMap || {};
    const rows = I.levels.map(r => {
      const k = String(r.label), lab = this.vlabel(v, k);
      return h('div', { key: k, className: 'de-val' }, h('span', { className: 'v', title: k + (lab !== k ? ' “' + lab + '”' : '') }, k + (lab !== k ? ' “' + lab + '”' : '')), h('span', { className: 'c' }, this.fmtN(r.c)), h('span', { 'aria-hidden': 'true' }, '→'),
        h('input', { className: 'tl-input mono', value: mp[k] == null ? '' : mp[k], placeholder: 'new', 'aria-label': 'New value for ' + k, onChange: e => { const val = e.target.value; this.setState(s => ({ bcMap: Object.assign({}, s.bcMap, { [k]: val }), bcMsg: '', bcErr: '' })); } }));
    });
    const pairs = Object.entries(mp).map(([o, nv]) => [o, String(nv).trim()]).filter(([o, nv]) => nv !== '' && nv !== o);
    const words = I.num ? pairs.filter(([, nv]) => nv !== '.' && !isFinite(Number(nv))) : [];
    let act;
    if (!pairs.length) act = h('span', { className: 'tl-hint' }, 'Type a new value next to any value you want to change; leave the rest blank. Type . to make a value missing.');
    else if (words.length) act = this.tlBanner('warn', '“' + words[0][1] + '” is a word, but ' + v + ' holds numbers. ',
      this.tlBtn('Keep the numbers and show the words as labels (recommended)', () => this.deWordsToLabels(v, pairs), 'green'),
      this.tlBtn('Turn ' + v + ' into text with these words', () => this.deWordsToText(v)));
    else act = h('div', { className: 'tl-row' }, this.tlBtn('Apply ' + pairs.length + ' change' + (pairs.length === 1 ? '' : 's'), () => this.recodeCol(v), 'green'), this.tlBtn('Clear', () => this.setState({ bcMap: {} })), this.deCmd({ t: 'vrecode', name: v, str: !I.num, pairs }));
    return h('div', { className: 'tl-col' }, h('div', { className: 'de-vals' }, rows), act);
  }
  deLabelsBox(D, I) {
    const h = React.createElement, v = I.v, cur = I.vl || new Map(), draft = D.vl && D.vl.__v === v ? D.vl : { __v: v };
    const rows = I.levels.map(r => {
      const k = String(r.label), code = Number(k), have = cur.has(code) ? cur.get(code) : '', val = draft[k] != null ? draft[k] : have;
      return h('div', { key: k, className: 'de-val' }, h('span', { className: 'v' }, k), h('span', { className: 'c' }, this.fmtN(r.c)), h('span', { 'aria-hidden': 'true' }, '='),
        h('input', { className: 'tl-input', value: val, placeholder: 'label', 'aria-label': 'Label for ' + k, style: { width: '150px', flex: '0 0 150px' }, onChange: e => { const t = e.target.value; this.deSet(d => ({ vl: Object.assign({}, d.vl && d.vl.__v === v ? d.vl : { __v: v }, { [k]: t }) })); } }));
    });
    const changed = Object.keys(draft).some(k => k !== '__v');
    return h('div', { className: 'tl-col' }, h('p', { className: 'de-hint' }, 'Labels name the codes (for example 1 = “Female”, 2 = “Male”). The numbers stay the same, so every analysis still works; tables and charts show the words.'),
      h('div', { className: 'de-vals' }, rows),
      h('div', { className: 'tl-row' }, this.tlBtn('Save labels', () => this.deApplyLabels(v), changed ? 'green' : ''), cur.size ? this.tlBtn('Remove all labels', () => this.deApplyLabels(v, true)) : null));
  }
  deGroupsBox(I) {
    const h = React.createElement, S = this.state, v = I.v, a = this.deNumAll(v);
    let mn = Infinity, mx = -Infinity; if (a) for (const x of a) if (isFinite(x)) { if (x < mn) mn = x; if (x > mx) mx = x; }
    const rows = (S.rcRows && S.rcRows.length ? S.rcRows : [{ f: '', t: '', l: '' }]);
    const setRow = (i, p) => this.setState(s => ({ rcVar: v, rcErr: '', rcMsg: '', rcRows: (s.rcRows && s.rcRows.length ? s.rcRows : [{ f: '', t: '', l: '' }]).map((r, j) => j === i ? Object.assign({}, r, p) : r) }));
    const inp = (val, ph, set, w, aria) => h('input', { className: 'tl-input mono', value: val || '', placeholder: ph, 'aria-label': aria, style: { width: w + 'px' }, onChange: e => set(e.target.value) });
    const ranges = rows.map((r, i) => h('div', { key: 'g' + i, className: 'tl-row' }, h('span', { className: 'de-gn' }, String(i + 1)), inp(r.f, 'from', x => setRow(i, { f: x }), 90, 'Range ' + (i + 1) + ' from'), h('span', null, 'to'), inp(r.t, 'to', x => setRow(i, { t: x }), 90, 'Range ' + (i + 1) + ' to'), h('span', null, '='),
      h('input', { className: 'tl-input', value: r.l || '', placeholder: 'label, e.g. Low', 'aria-label': 'Range ' + (i + 1) + ' label', style: { width: '170px' }, onChange: e => setRow(i, { l: e.target.value }) }),
      rows.length > 1 ? h('button', { type: 'button', className: 'de-x', title: 'Remove this range', 'aria-label': 'Remove range ' + (i + 1), onClick: () => this.setState(s => ({ rcRows: (s.rcRows || []).filter((_, j) => j !== i) })) }, '×') : null));
    const name = S.rcVar === v ? (S.rcName || '') : '';
    return h('div', { className: 'tl-col' },
      h('p', { className: 'de-hint' }, 'Makes a new variable with one group per range (' + v + ' runs from ' + (isFinite(mn) ? this.numberText(mn) + ' to ' + this.numberText(mx) : '—') + '). Each value goes to the first range it fits (from ≤ value ≤ to); values outside every range become missing. The new variable stores 1, 2, 3… with your labels, like Stata’s recode … , gen().'),
      h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Quick fill'), this.tlBtn('2 groups (median split)', () => this.deGroupFill(v, 2)), this.tlBtn('3 equal-size groups', () => this.deGroupFill(v, 3)), this.tlBtn('4 equal-size groups (quartiles)', () => this.deGroupFill(v, 4))),
      ...ranges,
      h('div', { className: 'tl-row' }, this.tlBtn('+ range', () => this.setState(s => ({ rcVar: v, rcRows: [...(s.rcRows || []), { f: '', t: '', l: '' }] }))),
        h('span', { className: 'tl-lbl' }, 'New variable'), h('input', { className: 'tl-input mono', value: name, placeholder: v.slice(0, 26) + '_grp', 'aria-label': 'Name of the new grouped variable', style: { width: '170px' }, onChange: e => this.setState({ rcVar: v, rcName: e.target.value, rcErr: '' }) }),
        this.tlBtn('Create the grouped variable', () => this.setState({ rcVar: v }, () => this.doRecode()), 'green')),
      this.deMsgs(S.rcVar === v ? S.rcMsg : '', S.rcVar === v ? S.rcErr : ''));
  }
  // replace … if: value + conditions, with a live count of the rows that will change and a preview
  deCondReady(c) { return c.v && String(c.val == null ? '' : c.val).trim() !== ''; }
  deCondObj(c) { const m = this.effMeta(c.v); return { v: c.v, t: 'op', op: c.op || '==', val: String(c.val).trim().replace(/^"(.*)"$/, '$1'), cat: !m || m.treatAs !== 'numeric' }; }
  deReplaceBox(name) {
    const h = React.createElement, S = this.state, raw = this._raw, ci = this.colIdx(name); if (ci < 0) return null;
    const col = raw.cols[ci], num = col.k === 'n';
    const conds = S.rpConds && S.rpConds.length ? S.rpConds : [{ v: '', op: '==', val: '' }];
    const setCond = (i, p) => this.setState(s => ({ rpMsg: '', rpErr: '', rpConds: (s.rpConds && s.rpConds.length ? s.rpConds : [{ v: '', op: '==', val: '' }]).map((c, j) => j === i ? Object.assign({}, c, p) : c) }));
    const condEls = conds.map((c, i) => {
      let lv = []; if (c.v && this.colIdx(c.v) >= 0) { const L = this.deLevels(c.v), isN = this._raw.cols[this.colIdx(c.v)].k === 'n'; if (L.length <= 400) lv = L.slice(0, 200).map(r => [String(r.label), isN ? this.vlabel(c.v, r.label) : '']); }
      const m = c.v ? this.effMeta(c.v) : null;
      return h('div', { key: 'c' + i, className: 'de-cond' },
        h('span', { className: 'de-and' }, i ? 'and' : 'if'),
        this.deVarSelect(c.v, n => setCond(i, { v: n, val: '' }), { placeholder: i ? 'variable…' : 'every row — or pick a variable…', aria: 'Condition ' + (i + 1) + ' variable' }),
        this.tlSelect(c.op || '==', [['==', 'is'], ['!=', 'is not'], ['>', 'is more than'], ['>=', 'is at least'], ['<', 'is less than'], ['<=', 'is at most']], op => setCond(i, { op }), 'Condition ' + (i + 1) + ' comparison', { className: 'tl-select de-op' }),
        h('input', { className: 'tl-input', value: c.val == null ? '' : c.val, list: 'de-l' + i, placeholder: m ? (m.treatAs === 'numeric' ? 'a number, or .' : 'pick or type a value') : 'value', 'aria-label': 'Condition ' + (i + 1) + ' value', style: { width: '150px' }, onChange: e => setCond(i, { val: e.target.value }) }),
        h('datalist', { id: 'de-l' + i }, lv.map(([x, l]) => h('option', { key: x, value: x, label: l && l !== x ? l : undefined }))),
        (conds.length > 1 || c.v) ? h('button', { type: 'button', className: 'de-x', title: 'Remove this condition', 'aria-label': 'Remove condition ' + (i + 1), onClick: () => this.setState(s => { const cs = (s.rpConds || []).filter((_, j) => j !== i); return { rpConds: cs.length ? cs : [{ v: '', op: '==', val: '' }], rpMsg: '', rpErr: '' }; }) }, '×') : null);
    });
    // which rows match right now
    const ready = conds.filter(c => this.deCondReady(c)), unfinished = conds.filter(c => c.v && !this.deCondReady(c));
    let mk = null, bad = '';
    for (const c of ready) { const o = this.deCondObj(c); if (!o.cat && o.val !== '.' && !isFinite(parseFloat(o.val))) { bad = c.v + ' holds numbers — compare it with a number (or . for missing)'; break; } const m2 = this.condMask(o); if (!m2) continue; if (!mk) mk = Uint8Array.from(m2); else for (let i = 0; i < mk.length; i++) mk[i] &= m2[i]; }
    let hit = raw.n; if (mk) { hit = 0; for (let i = 0; i < mk.length; i++) hit += mk[i]; }
    const vt = (S.rpVal || '').trim();
    const lvT = !num ? (() => { const L = this.deLevels(name); return L.length <= 400 ? L.slice(0, 200).map(r => String(r.label)) : []; })() : [];
    const countMsg = unfinished.length ? 'Finish the condition on ' + unfinished[0].v + ' — type a value.' : bad ? bad : !ready.length ? 'No condition: all ' + this.fmtN(raw.n) + ' rows will change.' : this.fmtN(hit) + ' of ' + this.fmtN(raw.n) + ' rows match.';
    // preview: the first matching rows with the variables involved
    const show = [name, ...new Set(ready.map(c => c.v).filter(x => x !== name))].slice(0, 4);
    const prevRows = []; for (let i = 0; i < raw.n && prevRows.length < 6; i++) { if (mk && !mk[i]) continue; prevRows.push(i); }
    const cell = (nm, i) => { const cc = raw.cols[this.colIdx(nm)]; if (!cc) return ''; const x = cc.a[i]; if (cc.k === 'n') return isFinite(x) ? this.vlabel(nm, this._E.numLab(x)) : '.'; return x == null || x === '' ? '""' : String(x); };
    const preview = h('div', { className: 'tl-tblwrap de-prev' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'row'), show.map(nm => h('th', { key: nm }, nm + (nm === name ? ' (now)' : ''))))),
      h('tbody', null, prevRows.map(i => h('tr', { key: i }, h('td', { className: 'n' }, this.fmtN(i + 1)), show.map(nm => h('td', { key: nm }, cell(nm, i))))))));
    const cs = ready.map(c => this.deCondObj(c));
    const vv = num ? vt : '"' + (vt === '.' ? '' : vt.replace(/^"(.*)"$/, '$1')) + '"';
    const canRun = !unfinished.length && !bad && (vt !== '' || !num);
    return h('div', { className: 'tl-col' },
      h('div', { className: 'de-cond' }, h('span', { className: 'de-and' }, 'set'), h('b', { className: 'mono' }, name), h('span', null, '='),
        h('input', { className: 'tl-input' + (num ? ' mono' : ''), value: S.rpVal || '', list: num ? undefined : 'de-lt', placeholder: num ? 'a number, . for missing, or a formula' : 'text, e.g. north (empty = missing)', 'aria-label': 'New value', style: { width: '250px' }, onChange: e => this.setState({ rpVal: e.target.value, rpMsg: '', rpErr: '' }) }),
        num ? null : h('datalist', { id: 'de-lt' }, lvT.map(x => h('option', { key: x, value: x })))),
      ...condEls,
      h('div', { className: 'tl-row' }, this.tlBtn('+ and another condition', () => this.setState(s => ({ rpConds: [...(s.rpConds && s.rpConds.length ? s.rpConds : [{ v: '', op: '==', val: '' }]), { v: '', op: '==', val: '' }] }))),
        h('span', { className: 'de-count' + (unfinished.length || bad ? ' warn' : ''), role: 'status' }, countMsg)),
      h('div', { className: 'tl-row' }, this.tlBtn('Replace', () => this.setState({ nvCur: name }, () => this.doReplace()), canRun ? 'green' : '', { disabled: !canRun }), canRun && (vt || !num) ? this.deCmd({ t: 'replace', name, val: vv, conds: cs }) : null),
      this.deMsgs(S.rpMsg, S.rpErr),
      h('p', { className: 'tl-hint' }, 'Run it as many times as you need, e.g. = 1 if region is North, then = 2 if region is South. Formulas can use other variables: income / 1000, ln(gdp).'),
      prevRows.length ? preview : null);
  }

  // ---- 2. new variable
  deTaskNew(D) {
    const h = React.createElement, S = this.state, isNum = (S.nvType || 'num') === 'num', st = S.nvStart || (isNum ? '.' : 'empty');
    const setType = k => this.setState({ nvType: k, nvStart: k === 'num' ? '.' : 'empty', nvOther: '', nvErr: '' });
    const starts = isNum ? [['.', 'Missing (.)'], ['0', 'Zero (0)'], ['other', 'A number or formula…']] : [['empty', 'Empty'], ['other', 'This text…']];
    const recipes = h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Ideas'),
      h('button', { type: 'button', className: 'tl-chip', onClick: () => this.setState({ nvType: 'num', nvStart: '0', nvErr: '' }) }, 'A 0/1 dummy'),
      h('button', { type: 'button', className: 'tl-chip', onClick: () => this.setState({ nvType: 'num', nvStart: 'other', nvOther: S.nvOther || 'ln()', nvErr: '' }) }, 'A formula (log, ratio…)'),
      h('button', { type: 'button', className: 'tl-chip', onClick: () => this.setState({ nvType: 'str', nvStart: 'empty', nvErr: '' }) }, 'Text categories'),
      h('button', { type: 'button', className: 'tl-chip', onClick: () => this.deSet({ task: 'var', mode: 'groups' }) }, 'Groups from a number →'),
      h('button', { type: 'button', className: 'tl-chip', onClick: () => this.deSet({ task: 'scale' }) }, 'Average of several items →'));
    const formula = st === 'other' ? h('div', { className: 'tl-col' },
      h('div', { className: 'tl-row' }, h('input', { className: 'tl-input' + (isNum ? ' mono' : ''), value: S.nvOther || '', placeholder: isNum ? 'e.g. 1   or   income / population   or   ln(gdp)' : 'e.g. unknown', 'aria-label': isNum ? 'Starting number or formula' : 'Starting text', style: { flex: '1 1 300px' }, onChange: e => this.setState({ nvOther: e.target.value, nvErr: '' }), onKeyDown: e => { if (e.key === 'Enter') this.doNewVar(); } }),
        isNum ? this.deVarSelect('', n => this.setState(s => { const f = s.nvOther || ''; return { nvOther: /\(\)\s*$/.test(f) ? f.replace(/\(\)\s*$/, '(' + n + ')') : (f && !/[\s(+\-*/^]$/.test(f) ? f + ' ' : f) + n }; }), { placeholder: '+ insert a variable', aria: 'Insert a variable into the formula', filter: c => (this.effMeta(c.name) || {}).type === 'numeric' }) : null),
      isNum ? h('span', { className: 'tl-hint' }, 'Use + − * / ^ and ( ). Functions: ln() log10() sqrt() exp() abs() round() floor() ceil(). A comparison gives 1 or 0: age >= 18. Rows with a missing input get missing (.).') : null) : null;
    const cur = S.nvCur && this.colIdx(S.nvCur) >= 0 ? S.nvCur : '';
    const create = this.tlPanel('1 · Create it', null, null, recipes,
      h('div', { className: 'de-grid2' },
        this.tlField('Name', h('input', { className: 'tl-input mono', value: S.nvName || '', placeholder: 'e.g. region', 'aria-label': 'Name of the new variable', spellCheck: false, onChange: e => this.setState({ nvName: e.target.value, nvErr: '' }), onKeyDown: e => { if (e.key === 'Enter') this.doNewVar(); } })),
        this.tlField('Holds', this.tlSeg([['num', 'Numbers'], ['str', 'Text']], isNum ? 'num' : 'str', setType, { 'aria-label': 'Holds' }))),
      this.tlField('Every row starts as', this.tlSeg(starts, st, k => this.setState({ nvStart: k, nvErr: '' }), { 'aria-label': 'Every row starts as' })),
      formula,
      h('div', { className: 'tl-row' }, this.tlBtn('Create', () => this.doNewVar(), 'primary'), h('span', { className: 'tl-hint' }, st === '.' ? 'Like Stata’s generate x = . — then fill it in step 2.' : st === '0' ? 'Good for a 0/1 dummy: then set it to 1 where a condition is true.' : st === 'empty' ? 'Then fill it in step 2, e.g. "north" if region_code is 1.' : '')),
      this.deMsgs('', S.nvErr));
    const fill = cur ? this.tlPanel('2 · Fill it in', 'working on ' + cur, h('div', { className: 'tl-row' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.deBrowse(cur) }, 'See it in Browse →'), this.tlBtn('Done', () => this.setState({ nvCur: '', rpMsg: '', rpErr: '', rpVal: '' }))), this.deReplaceBox(cur))
      : this.tlPanel('2 · Fill it in', null, null, h('p', { className: 'de-hint' }, 'After you create the variable, set its values here — for every row or only where a condition is true. To change a variable you already have, use Change a variable.'));
    return h(React.Fragment, null, create, fill);
  }

  // ---- 3. make a scale (Cronbach's alpha, then the scale score)
  deScaleItems() { const S = this.state; return (S.crItems || []).filter(v => this.colIdx(v) >= 0); }
  deScaleArrays(items, rev, mk) {
    return items.map(v => {
      const a0 = this.deNumAll(v); if (!a0) return null;
      let mn = Infinity, mx = -Infinity; for (const x of a0) if (isFinite(x)) { if (x < mn) mn = x; if (x > mx) mx = x; }
      const r = rev.includes(v), a = new Float64Array(a0.length);
      for (let i = 0; i < a.length; i++) a[i] = (mk && !mk[i]) ? NaN : (r ? mn + mx - a0[i] : a0[i]);
      return { v, a, mn, mx, r };
    });
  }
  deAlphaRun(items, rev) {
    items = items || this.deScaleItems(); rev = (rev || this.deS().scaleRev || []).filter(v => items.includes(v));
    if (items.length < 2) return this.setState({ crRes: null, crErr: '' });
    const A = this.deScaleArrays(items, rev, this.deMask()), bad = A.findIndex(x => !x);
    if (bad >= 0) return this.setState({ crRes: null, crErr: '“' + items[bad] + '” is not a number variable — a scale needs numeric items (remove it).' });
    const res = this._E.cronbach(A.map(x => x.a));
    if (res.error) return this.setState({ crRes: null, crErr: res.error });
    // corrected item–rest correlations on the complete rows
    const n = A[0].a.length, ok = new Uint8Array(n); for (let i = 0; i < n; i++) ok[i] = A.every(x => isFinite(x.a[i])) ? 1 : 0;
    const rest = A.map((x, j) => { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0; for (let i = 0; i < n; i++) { if (!ok[i]) continue; let y = 0; for (let k = 0; k < A.length; k++) if (k !== j) y += A[k].a[i]; const xi = x.a[i]; sx += xi; sy += y; sxx += xi * xi; syy += y * y; sxy += xi * y; m++; } const cov = sxy - sx * sy / m, vx = sxx - sx * sx / m, vy = syy - sy * sy / m; return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : NaN; });
    this.setState({ crRes: { alpha: res.alpha, k: res.k, n: res.n, drop: Array.from(res.drop), rest, items: [...items], rev: [...rev] }, crErr: '' });
    this.pushLog({ t: 'cralpha', items: [...items], rev: [...rev], res: 'alpha = ' + this.fmt(res.alpha, 3) + ' · ' + res.k + ' items · n complete = ' + this.fmtN(res.n) });
  }
  deScaleSet(items, rev) { this.setState({ crItems: items, crRes: null, crErr: '' }); this.deSet({ scaleRev: rev }); setTimeout(() => this.deAlphaRun(items, rev), 0); }
  deTaskScale(D) {
    const h = React.createElement, S = this.state, items = this.deScaleItems(), rev = (D.scaleRev || []).filter(v => items.includes(v));
    const add = this.deVarSelect('', n => { if (!items.includes(n)) this.deScaleSet([...items, n], rev); }, { placeholder: '+ add an item (a number variable)…', aria: 'Add an item to the scale', filter: c => (this.effMeta(c.name) || {}).type === 'numeric' && !items.includes(c.name) });
    const chips = items.map(v => h('span', { key: v, className: 'de-item' }, h('b', { className: 'mono' }, v),
      h('label', { className: 'de-check', title: 'Reverse-coded item: high values mean less of the idea (it is flipped: min + max − value)' }, h('input', { type: 'checkbox', checked: rev.includes(v), onChange: e => this.deScaleSet(items, e.target.checked ? [...rev, v] : rev.filter(x => x !== v)) }), 'reverse'),
      h('button', { type: 'button', className: 'de-x', title: 'Remove ' + v, 'aria-label': 'Remove ' + v, onClick: () => this.deScaleSet(items.filter(x => x !== v), rev.filter(x => x !== v)) }, '×')));
    const R = S.crRes && S.crRes.items && S.crRes.items.join('|') === items.join('|') && (S.crRes.rev || []).join('|') === rev.join('|') ? S.crRes : null;
    const kept = this.deConds().length ? ' (on the ' + this.fmtN(this.deKept()) + ' rows in use — see Rows)' : '';
    let res = null;
    if (R) {
      const verdict = R.alpha >= 0.9 ? 'excellent' : R.alpha >= 0.8 ? 'good' : R.alpha >= 0.7 ? 'acceptable' : R.alpha >= 0.6 ? 'questionable' : 'poor';
      const better = R.items.map((v, i) => [v, R.drop[i]]).filter(([, d]) => d > R.alpha + 0.005).sort((a, b) => b[1] - a[1]);
      const neg = R.items.filter((v, i) => R.rest[i] < 0);
      res = h('div', { className: 'tl-col' },
        h('div', { className: 'tl-stats' }, this.tlStat('Cronbach’s alpha', this.fmt(R.alpha, 3), verdict), this.tlStat('Items', String(R.k)), this.tlStat('Complete rows', this.fmtN(R.n), 'rows with every item answered')),
        h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'item'), h('th', { className: 'n' }, 'correlation with the rest'), h('th', { className: 'n' }, 'alpha if removed'))),
          h('tbody', null, R.items.map((v, i) => h('tr', { key: v }, h('td', { className: 'w' }, v + (R.rev.includes(v) ? ' (reversed)' : '')), h('td', { className: 'n' + (R.rest[i] < 0.3 ? ' warn' : '') }, this.fmt(R.rest[i], 3)), h('td', { className: 'n' + (R.drop[i] > R.alpha + 0.005 ? ' warn' : '') }, this.fmt(R.drop[i], 3))))))),
        this.tlBanner(R.alpha >= 0.7 ? 'ok' : 'warn', 'Alpha = ' + this.fmt(R.alpha, 2) + ' (' + verdict + '): ' + (R.alpha >= 0.7 ? 'these items hang together well enough to be averaged into one scale.' : 'these items do not hang together well enough yet — .70 or more is the usual rule.') +
          (neg.length ? ' ' + neg.join(', ') + (neg.length === 1 ? ' goes' : ' go') + ' against the others (negative correlation) — if it is worded the other way round, tick “reverse”.' : '') +
          (better.length ? ' Removing ' + better[0][0] + ' would raise alpha to ' + this.fmt(better[0][1], 2) + '.' : '')));
    }
    const nm = (D.scaleName || '').trim();
    const make = this.tlPanel('2 · Add the scale to the data', null, null,
      h('div', { className: 'tl-row wide' }, this.tlField('Name', h('input', { className: 'tl-input mono', value: D.scaleName || '', placeholder: 'e.g. trust_scale', 'aria-label': 'Name of the scale variable', spellCheck: false, onChange: e => this.deSet({ scaleName: e.target.value }) })),
        this.tlField('Score', this.tlSeg([['mean', 'Mean of the items', 'Keeps the items’ units, e.g. 1–5'], ['sum', 'Sum of the items']], D.scaleHow || 'mean', k => this.deSet({ scaleHow: k }), { 'aria-label': 'Score' })),
        this.tlBtn('Create the scale variable', () => this.deMakeScale(), items.length >= 2 && nm ? 'primary' : '', { disabled: !(items.length >= 2 && nm) })),
      h('span', { className: 'tl-hint' }, 'Computed for every row; a row with any item missing gets missing (.). Reversed items are flipped first.'),
      this.deMsgs(S.crMsg, S.crMkErr));
    return h(React.Fragment, null,
      this.tlPanel('1 · Do these items measure one thing?', 'Cronbach’s alpha' + kept, null,
        h('p', { className: 'de-hint' }, 'Add the survey items that should measure the same idea (for example five trust questions). Alpha shows how consistently they move together, from 0 to 1.'),
        h('div', { className: 'tl-row' }, add), items.length ? h('div', { className: 'tl-row de-items' }, chips) : null,
        items.length === 1 ? h('span', { className: 'tl-hint' }, 'Add at least one more item.') : null,
        S.crErr ? this.tlBanner('warn', S.crErr) : null, res),
      make);
  }
  deMakeScale() {
    const D = this.deS(), items = this.deScaleItems(), rev = (D.scaleRev || []).filter(v => items.includes(v)), name = (D.scaleName || '').trim();
    if (items.length < 2) return this.setState({ crMkErr: 'add at least 2 items first', crMsg: '' });
    const bad = name ? this.validName(name) : 'type a name for the scale';
    if (bad) return this.setState({ crMkErr: bad, crMsg: '' });
    const A = this.deScaleArrays(items, rev, null); if (A.some(x => !x)) return this.setState({ crMkErr: 'every item must be a number variable', crMsg: '' });
    const n = this._raw.n, out = new Float64Array(n), mean = (D.scaleHow || 'mean') === 'mean'; let valid = 0;
    for (let i = 0; i < n; i++) { let s = 0, ok = true; for (const x of A) { const y = x.a[i]; if (!isFinite(y)) { ok = false; break; } s += y; } out[i] = ok ? (mean ? s / A.length : s) : NaN; if (ok) valid++; }
    const terms = A.map(x => x.r ? '(' + this.numberText(x.mn + x.mx) + ' - ' + x.v + ')' : x.v), expr = mean ? '(' + terms.join(' + ') + ') / ' + A.length : terms.join(' + ');
    this.addDerivedCol(name, { k: 'n', a: out }, (mean ? 'mean' : 'sum') + ' of ' + items.join(', '), 'gen');
    this.clearMemo();
    this.setState({ crMkErr: '', crMsg: name + ' added — ' + this.fmtN(valid) + ' rows have a score (' + (mean ? 'mean' : 'sum') + ' of ' + A.length + ' items).' });
    this.deSet({ scaleName: '' });
    this.pushLog({ t: 'nvgen', name, str: false, start: expr, res: 'scale · ' + (mean ? 'mean' : 'sum') + ' of ' + A.length + ' items · n valid = ' + this.fmtN(valid) });
  }

  // ---- 4. rows: use only some rows (the same subgroup as the IF bar on every tab) · add rows
  deTaskRows(D) {
    const h = React.createElement, S = this.state, raw = this._raw, E = this._E;
    const sg = (S.subg && S.subg.all) || [], flt = S.flt && S.flt.on ? S.flt : null, kept = this.deKept();
    const chips = [];
    if (flt) [flt, ...(flt.more || [])].forEach((c, i) => chips.push(h('span', { key: 'f' + i, className: 'de-cnd' }, c.v + ' ' + c.op + ' ' + c.val, i === 0 ? h('button', { type: 'button', className: 'de-x', title: 'Remove (typed as keep if)', 'aria-label': 'Remove the keep-if filter', onClick: () => this.clearFilter() }, '×') : null)));
    sg.forEach((c, i) => chips.push(h('span', { key: 's' + i, className: 'de-cnd' }, this.condLabel(c), h('button', { type: 'button', className: 'de-x', title: 'Remove', 'aria-label': 'Remove ' + this.condLabel(c), onClick: () => { this.clearMemo(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: (s.subg.all || []).filter((_, j) => j !== i) }) })); } }, '×'))));
    const status = chips.length ? h('div', { className: 'tl-col' }, h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Keeping rows where'), ...chips.flatMap((c, i) => i ? [h('span', { key: 'a' + i, className: 'de-and' }, 'and'), c] : [c])),
      h('div', { className: 'tl-row' }, h('span', { className: 'de-count', role: 'status' }, 'Analyses and charts use ' + this.fmtN(kept) + ' of ' + this.fmtN(raw.n) + ' rows.'), this.tlBtn('Use all rows', () => { this.clearMemo(); if (flt) this.clearFilter(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: [] }) })); })))
      : h('span', { className: 'de-count', role: 'status' }, 'All ' + this.fmtN(raw.n) + ' rows are in use.');
    // builder
    const v = D.rowsV && this.colIdx(D.rowsV) >= 0 ? D.rowsV : '';
    let builder = null;
    if (v) {
      const m = this.effMeta(v), f = this.nvLevels(v), lv = f ? f.rows.slice() : [];
      const useLv = !m || m.treatAs !== 'numeric' || lv.length <= 80;
      if (useLv) {
        if (m && m.treatAs === 'numeric') lv.sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
        const q = (D.rowsQ || '').toLowerCase(), sel = new Set(D.rowsSel || []);
        const fr = q ? lv.filter(r => String(r.label).toLowerCase().includes(q) || String(this.vlabel(v, r.label)).toLowerCase().includes(q)) : lv;
        builder = h('div', { className: 'tl-col' },
          lv.length > 20 ? h('input', { className: 'tl-input', value: D.rowsQ || '', placeholder: 'search ' + lv.length + ' values', 'aria-label': 'Search values', onChange: e => this.deSet({ rowsQ: e.target.value }) }) : null,
          h('div', { className: 'tl-row de-lvls' }, fr.slice(0, 150).map(r => { const k = String(r.label), lab = this.vlabel(v, k); return this.tlChip(h(React.Fragment, null, k + (lab !== k ? ' · ' + lab : ''), h('span', { className: 'tl-cnt' }, this.fmtN(r.c))), sel.has(k), () => this.deSet(d => ({ rowsSel: (d.rowsSel || []).includes(k) ? d.rowsSel.filter(x => x !== k) : [...(d.rowsSel || []), k] })), { key: k }); })),
          fr.length > 150 ? h('span', { className: 'tl-hint' }, 'Showing 150 of ' + fr.length + ' — type to narrow.') : null,
          h('div', { className: 'tl-row' }, this.tlBtn(sel.size ? 'Keep rows where ' + v + ' is one of these ' + sel.size : 'Pick one or more values', () => this.deKeepRows(v, { t: 'in', vals: [...sel] }), sel.size ? 'green' : '', { disabled: !sel.size }), this.tlBtn('Select all shown', () => this.deSet({ rowsSel: fr.slice(0, 150).map(r => String(r.label)) })), sel.size ? this.tlBtn('None', () => this.deSet({ rowsSel: [] })) : null));
      } else {
        const lo = (D.rowsLo || '').trim(), hi = (D.rowsHi || '').trim(), okR = (lo !== '' || hi !== '') && (lo === '' || isFinite(parseFloat(lo))) && (hi === '' || isFinite(parseFloat(hi)));
        builder = h('div', { className: 'tl-col' }, h('div', { className: 'tl-row' }, h('span', null, 'from'), h('input', { className: 'tl-input mono', value: D.rowsLo || '', placeholder: 'lowest', 'aria-label': 'From', style: { width: '110px' }, onChange: e => this.deSet({ rowsLo: e.target.value }) }), h('span', null, 'to'), h('input', { className: 'tl-input mono', value: D.rowsHi || '', placeholder: 'highest', 'aria-label': 'To', style: { width: '110px' }, onChange: e => this.deSet({ rowsHi: e.target.value }) }),
          this.tlBtn('Keep this range', () => this.deKeepRows(v, { t: 'rng', lo, hi }), okR ? 'green' : '', { disabled: !okR })),
          h('span', { className: 'tl-hint' }, v + ' runs from ' + E.numLab(m.mn) + ' to ' + E.numLab(m.mx) + ' — leave a box blank for no limit. Both ends are included.'));
      }
    }
    const keep = this.tlPanel('Use only some rows', 'for every analysis and chart', null, status,
      h('div', { className: 'tl-row wide' }, this.tlField(chips.length ? 'And also keep rows where' : 'Keep rows where', this.deVarSelect(v, n => this.deSet({ rowsV: n, rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '' }), { placeholder: 'pick a variable…', aria: 'Keep rows where' }))),
      builder,
      h('p', { className: 'tl-hint' }, 'Nothing is deleted: this is the same subgroup as the IF bar at the top of each analysis tab, and you can remove it any time. The editing tools on this page always change every row — use “Only where…” to limit a change.'));
    const add = this.tlPanel('Add empty rows', null, null,
      h('div', { className: 'tl-row' }, this.tlBtn('+ 1 row', () => this.addRows(1)), this.tlBtn('+ 10 rows', () => this.addRows(10)), this.tlBtn('+ 100 rows', () => this.addRows(100)), h('button', { type: 'button', className: 'tl-link', onClick: () => { const n = raw.n; this.setState({ tab: 'browse', browseMode: 'data', bRow: Math.max(0, n - 12) }); } }, 'Type into them in Browse →')),
      h('span', { className: 'tl-hint' }, 'New rows start empty (.). Typing in the last row of Browse adds more automatically.'),
      S.bErr ? this.tlBanner('warn', S.bErr) : null);
    return h(React.Fragment, null, keep, add);
  }
  deKeepRows(v, c) { this.clearMemo(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: [...((s.subg && s.subg.all) || []).filter(x => x.v !== v), Object.assign({ v }, c)] }) })); this.deSet({ rowsV: '', rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '' }); }

  // ---- 5. show / hide variables
  deTaskCols(D) {
    const h = React.createElement, S = this.state, raw = this._raw, hid = new Set(S.hiddenVars || []), q = (D.colsQ || '').toLowerCase();
    const all = S.cols, match = q ? all.filter(c => c.name.toLowerCase().includes(q) || String(c.label || '').toLowerCase().includes(q)) : all;
    const empty = all.filter(c => !hid.has(c.name) && !(c.valid > 0));
    const rows = match.slice(0, 400).map(c => { const on = !hid.has(c.name), m = this.effMeta(c.name) || {}; return h('label', { key: c.name, className: 'de-vrow' + (on ? '' : ' off') },
      h('input', { type: 'checkbox', checked: on, onChange: () => this.deToggleHide(c.name) }), h('b', { className: 'mono' }, c.name), h('span', { className: 'lab' }, c.label || ''),
      h('span', { className: 'de-pill' }, m.treatAs === 'numeric' ? 'number' : 'categories'), h('span', { className: 'c' }, (c.valid > 0 ? this.fmtN(c.valid) + ' filled' : 'empty'))); });
    return this.tlPanel('Show / hide variables', hid.size ? hid.size + ' of ' + all.length + ' hidden' : 'all ' + all.length + ' shown',
      null,
      h('div', { className: 'tl-row' }, h('input', { className: 'tl-input', value: D.colsQ || '', placeholder: 'search ' + all.length + ' variables', 'aria-label': 'Search variables', style: { flex: '1 1 220px' }, onChange: e => this.deSet({ colsQ: e.target.value }) }),
        empty.length ? this.tlBtn('Hide the ' + empty.length + ' empty variable' + (empty.length === 1 ? '' : 's'), () => this.deHide(empty.map(c => c.name)), '', { title: 'Variables with no values at all' }) : null,
        match.length && match.some(c => !hid.has(c.name)) && q ? this.tlBtn('Hide these ' + match.filter(c => !hid.has(c.name)).length, () => this.deHide(match.filter(c => !hid.has(c.name)).map(c => c.name))) : null,
        hid.size ? this.tlBtn('Show all', () => { this.setState({ hiddenVars: [] }); this.pushLog({ t: 'restorev', res: '' }); }) : null),
      h('div', { className: 'de-list', role: 'group', 'aria-label': 'Variables (ticked = shown)' }, rows),
      match.length > 400 ? h('span', { className: 'tl-hint' }, 'Showing 400 of ' + match.length + ' — search to narrow.') : null,
      h('p', { className: 'tl-hint' }, 'Ticked variables appear in every list. Hidden ones stay in the data — they are only left out of the lists and of Save data as CSV (unless you tick “include hidden” at the top).'));
  }
  deHide(list) { const S = this.state, cur = S.hiddenVars || [], add = list.filter(v => !cur.includes(v)); if (!add.length) return; this.setState({ hiddenVars: [...cur, ...add] }); this.pushLog({ t: 'dropv', list: add, res: 'hidden from variable lists — data untouched, restore any time' }); }

  // ---- actions for one variable
  deRename(v) {
    const to = String(this._deRn != null ? this._deRn : v).trim(); if (!to || to === v) return;
    this.setState({ rnFrom: v, rnTo: to, rnErr: '', bcErr: '', bcMsg: '' }, () => {
      this.doRename();
      if (this._raw.names.includes(to) && !this._raw.names.includes(v)) { this._deRn = null; this.setState({ bColMenu: to, bcMsg: 'Renamed ' + v + ' → ' + to }); this.deSet(d => ({ v: d.v === v ? to : d.v, rowsV: d.rowsV === v ? to : d.rowsV, scaleRev: (d.scaleRev || []).map(x => x === v ? to : x) })); }
    });
  }
  deSetLabel(v, t) {
    const i = this.colIdx(v); if (i < 0) return; t = String(t || '').trim();
    if ((this._raw.labels[i] || '') === t) return;
    this.snap('label ' + v);
    this._raw.labels[i] = t;
    this.setState(s => ({ cols: s.cols.map(c => c.name === v ? Object.assign({}, c, { label: t }) : c), bcMsg: t ? 'Description saved' : 'Description removed', bcErr: '' }));
    this.stataLog('label variable ' + v + ' "' + t.replace(/"/g, "'") + '"');
  }
  deSetTreat(v, mode) { this.clearMemo(); this.setState(s => ({ treat: Object.assign({}, s.treat, { [v]: mode }), bcMsg: v + ' is now analysed as ' + (mode === 'numeric' ? 'a number scale' : 'categories'), bcErr: '' })); }
  deToggleHide(v) { const cur = this.state.hiddenVars || []; if (cur.includes(v)) this.setState({ hiddenVars: cur.filter(x => x !== v) }); else this.deHide([v]); }
  deDelete(v) {
    if (this.deS().armDel !== v) { this.deSet({ armDel: v }); clearTimeout(this._deDelT); this._deDelT = setTimeout(() => { if (this.deS().armDel === v) this.deSet({ armDel: '' }); }, 4000); return; }
    clearTimeout(this._deDelT); this.deleteCol(v); this.deSet({ v: '', armDel: '' }); this.setState({ bcMsg: '', bcErr: '', undoMsg: v + ' deleted — Undo brings it back' });
  }
  deLabelCmds(v, mp) {
    const lbl = (v.length > 28 ? v.slice(0, 28) : v) + '_lb';
    if (!mp || !mp.size) { this.stataLog('label values ' + v + ' .'); return; }
    this.stataLog('label define ' + lbl + ' ' + [...mp].sort((a, b) => a[0] - b[0]).map(([k, l]) => k + ' "' + String(l).replace(/"/g, "'") + '"').join(' ') + ', replace');
    this.stataLog('label values ' + v + ' ' + lbl);
  }
  deSetLabels(v, mp) {
    const raw = this._raw;
    this.snap('labels of ' + v);
    raw.vlabs = raw.vlabs || {};
    if (mp && mp.size) raw.vlabs[v] = mp; else delete raw.vlabs[v];
    this.rememberLabels([v], !(mp && mp.size));
    this.clearMemo();
    this.setState(s => ({ dver: (s.dver || 0) + 1 }));
    this.deLabelCmds(v, mp);
  }
  deWordsToLabels(v, pairs) {
    const raw = this._raw, old = raw.vlabs && raw.vlabs[v] instanceof Map ? raw.vlabs[v] : new Map(), mp = new Map(old);
    const moved = pairs.filter(([, nv]) => nv !== '.' && !isFinite(Number(nv)));
    moved.forEach(([o, nv]) => mp.set(Number(o), nv));
    this.deSetLabels(v, mp);
    const rest = {}; pairs.filter(p => !moved.includes(p)).forEach(([o, nv]) => { rest[o] = nv; });
    this.setState({ bcMap: rest, bcErr: '', bcMsg: 'Labels added: ' + moved.map(([o, nv]) => o + ' = ' + nv).join(', ') + '. The numbers stay the same, so every analysis still works; tables and charts show the words.' + (Object.keys(rest).length ? ' Apply the remaining number changes below.' : '') });
  }
  deWordsToText(v) { const keep = Object.assign({}, this.state.bcMap); this.retypeCol(v, true); this.setState({ bcMap: keep }, () => this.recodeCol(v)); }
  deApplyLabels(v, clear) {
    const D = this.deS(), I = this.deInfo(v); if (!I) return;
    const mp = clear ? new Map() : new Map(I.vl || []), draft = D.vl && D.vl.__v === v ? D.vl : {};
    if (!clear) Object.keys(draft).forEach(k => { if (k === '__v') return; const t = String(draft[k]).trim(), code = Number(k); if (!isFinite(code)) return; if (t) mp.set(code, t); else mp.delete(code); });
    this.deSetLabels(v, mp);
    this.deSet({ vl: null });
    this.setState({ bcMsg: clear ? 'Labels removed from ' + v : mp.size + ' label' + (mp.size === 1 ? '' : 's') + ' saved for ' + v, bcErr: '' });
  }
  deGroupFill(v, k) {
    const a = this.deNumAll(v); if (!a) return;
    const xs = Array.from(a).filter(x => isFinite(x)).sort((p, q) => p - q), n = xs.length;
    if (!n) return this.setState({ rcVar: v, rcErr: v + ' has no values to group', rcMsg: '' });
    // cut points are data values at the 1/k, 2/k … quantiles; group j holds the values above cut j−1 up to cut j (first range that fits)
    const cuts = []; for (let j = 1; j < k; j++) cuts.push(xs[Math.max(0, Math.ceil(j * n / k) - 1)]);
    const cutsU = [...new Set(cuts)].filter(c => c < xs[n - 1]).sort((p, q) => p - q), bounds = [xs[0], ...cutsU, xs[n - 1]], g = bounds.length - 1;
    if (g < 2) return this.setState({ rcVar: v, rcErr: 'Too many rows share the same value to make ' + k + ' groups — type the ranges yourself.', rcMsg: '' });
    const names = g !== k ? bounds.slice(1).map((_, i) => 'Group ' + (i + 1)) : k === 2 ? ['Low', 'High'] : k === 3 ? ['Low', 'Middle', 'High'] : ['Q1 (lowest)', 'Q2', 'Q3', 'Q4 (highest)'];
    const rows = bounds.slice(1).map((t, i) => ({ f: this.numberText(bounds[i]), t: this.numberText(t), l: names[i] }));
    this.setState(s => ({ rcVar: v, rcRows: rows, rcErr: '', rcMsg: g < k ? 'Only ' + g + ' groups were possible (many equal values).' : '', rcName: s.rcVar === v && s.rcName ? s.rcName : (v.slice(0, 26) + '_' + (k === 2 ? 'hl' : k === 3 ? 'g3' : 'q4')) }));
  }
