  // ---- Edit data (Design B): three jobs in plain words — fix a variable · make a new variable · choose what to use
  // Every change can be undone and is written to the Console as a Stata (or R) command.
  deDefaults() { return { task: 'var', v: '', vl: null, armDel: '', armNum: '', whereOpen: false, storeOpen: false, recipe: '', grpV: '', cpV: '', cpMap: null, cpName: '', dmName: '', dmDesc: '', dmElse: '0', dmConds: null, ccName: '', ccExpr: '', ccDesc: '', bkName: '', bkText: false, rowsV: '', rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '', colsQ: '', moreOpen: false, saveOpen: false, saveRows: false, withHidden: false, scaleRev: [], scaleName: '', scaleHow: 'mean' }; }
  // older task names (links, saved sessions, console entries) open the job that now holds them
  deNorm(d) { if (d.recipe === 'dummy' || d.recipe === 'blank') d.recipe = ''; const t = d.task; if (t === 'scale') { d.task = 'new'; d.recipe = 'scale'; } else if (t === 'rows' || t === 'cols') d.task = 'use'; else if (t !== 'var' && t !== 'new' && t !== 'use') d.task = 'var'; return d; }
  // state.de holds the tab's choices; state.deTask (set by links such as the model guide) opens a task once
  deOf(s) { const d = Object.assign(this.deDefaults(), s.de || {}); if (s.deTask) d.task = s.deTask; return this.deNorm(d); }
  deS() { return this.deOf(this.state); }
  deSet(p) { this.setState(s => { const cur = this.deOf(s); return { de: Object.assign(cur, typeof p === 'function' ? p(cur) : p), deTask: '' }; }); }
  deGo(task, extra) { this.setState(s => ({ tab: 'data', mfMobile: 'analysis', mfNav: '', deTask: '', de: this.deNorm(Object.assign(this.deOf(s), { task, armDel: '' }, extra || {})) })); }
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

  deCmdLines(stata, r) { const S = this.state, isR = S.dialect === 'r', L = (isR ? r : stata) || []; if (!L.length) return null; const p = isR ? '> ' : '. '; return React.createElement('div', { className: 'de-cmd', title: 'The same step as ' + (isR ? 'R' : 'Stata') + ' commands' }, L.map(x => p + x).join('\n')); }
  deIcon(k) {
    const h = React.createElement, P = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };
    if (k === 'var') return h('svg', P, h('path', { d: 'M12 20h9' }), h('path', { d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' }));
    if (k === 'new') return h('svg', P, h('path', { d: 'M12 5v14M5 12h14' }));
    return h('svg', P, h('path', { d: 'M3 5h18M6 12h12M10 19h4' }));
  }

  // ---- the tab
  deRender() {
    const h = React.createElement, S = this.state, D = this.deS(), raw = this._raw;
    if (!raw || !this._E) return null;
    const hid = (S.hiddenVars || []).filter(v => raw.names.includes(v)), nU = (this._undo || []).length, nC = this.deConds().length;
    const useSub = (nC ? this.fmtN(this.deKept()) + ' of ' + this.fmtN(raw.n) + ' rows' : 'rows · variables') + (hid.length ? ' · ' + hid.length + ' hidden' : '');
    const tasks = [['var', 'Fix a variable', 'rename · labels · recode'], ['new', 'Make a new variable', 'create it · set its values'], ['use', 'Choose what to use', useSub]];
    const saveBtn = (nC || hid.length)
      ? this.tlBtn('Save data as CSV ▾', () => this.deSet(d => ({ saveOpen: !d.saveOpen })), 'primary', { title: 'Choose which rows and variables go into the file', 'aria-expanded': D.saveOpen ? 'true' : 'false' })
      : this.tlBtn('Save data as CSV', () => this.deSaveCsv(false, false), 'primary', { title: 'Download the data with every change you made; open it again any time from File' });
    const head = h('div', { className: 'de-head' },
      h('h2', null, 'Edit data'),
      h('span', { className: 'de-dims' }, this.fmtN(raw.n) + ' rows × ' + raw.names.length + ' variables' + (hid.length ? ' · ' + hid.length + ' hidden' : '')),
      h('div', { className: 'de-head-r' },
        nU ? this.tlBtn('↶ Undo: ' + (S.undoLabel || 'last change'), () => this.undo(), '', { title: 'Undo the last change (Ctrl/⌘+Z)' }) : null,
        saveBtn));
    const save = (nC || hid.length) && D.saveOpen ? h('div', { className: 'de-save', role: 'group', 'aria-label': 'Save data as CSV' },
      h('span', { className: 'tl-lbl' }, 'Save data as CSV'),
      nC ? h('label', { className: 'de-check' }, h('input', { type: 'checkbox', checked: !!D.saveRows, onChange: e => this.deSet({ saveRows: e.target.checked }) }), 'Only the ' + this.fmtN(this.deKept()) + ' rows in use (like Stata’s keep if)') : null,
      hid.length ? h('label', { className: 'de-check' }, h('input', { type: 'checkbox', checked: !!D.withHidden, onChange: e => this.deSet({ withHidden: e.target.checked }) }), 'Include the ' + hid.length + ' hidden variable' + (hid.length === 1 ? '' : 's')) : null,
      h('span', { className: 'tl-hint' }, (D.saveRows && nC ? this.fmtN(this.deKept()) : this.fmtN(raw.n)) + ' rows × ' + (raw.names.length - (D.withHidden ? 0 : hid.length)) + ' variables'),
      this.tlBtn('Download CSV', () => this.deSaveCsv(!!D.withHidden, !!(D.saveRows && nC)), 'primary')) : null;
    const nav = h('div', { className: 'de-tasks', role: 'tablist', 'aria-label': 'Edit data tasks' }, tasks.map(([k, l, sub]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': D.task === k ? 'true' : 'false', className: 'de-task' + (D.task === k ? ' on' : ''), onClick: () => this.deSet(Object.assign({ task: k, armDel: '', armNum: '' }, k === 'new' ? { recipe: '', waysOpen: false } : {})) },
      h('span', { className: 'ic' }, this.deIcon(k)), h('span', { className: 'tx' }, h('b', null, l), h('span', null, sub)))));
    const body = D.task === 'new' ? this.deTaskNew(D) : D.task === 'use' ? this.deTaskUse(D) : this.deTaskVar(D);
    return h('div', { className: 'tl de' }, head, save, nav, body, h('p', { className: 'tl-hint de-foot' }, 'Every change can be undone (Ctrl/⌘+Z) and appears in the Console as a ' + (S.dialect === 'r' ? 'R' : 'Stata') + ' command. Changes live in this tab until you save the data as CSV or save the session (File).'));
  }

  // ---- 1. fix a variable: name and description · what kind it is · its values · change only some rows · delete
  dePickVar(n) {
    this._deRn = null;
    this.setState({ bColMenu: n, bcMap: {}, bcMsg: '', bcErr: '', rnErr: '', rpMsg: '', rpErr: '', rpVal: '', rpConds: [{ v: '', op: '==', val: '' }], rcErr: '', rcMsg: '', rcName: '', rcRows: [{ f: '', t: '', l: '' }, { f: '', t: '', l: '' }, { f: '', t: '', l: '' }] });
    this.deSet({ v: n, armDel: '', vl: null });
  }
  deTaskVar(D) {
    const h = React.createElement, S = this.state, v = D.v && this.colIdx(D.v) >= 0 ? D.v : '';
    if (!this._raw.names.length) return this.tlPanel('Fix a variable', 'this dataset has no variables yet', null, // GM26 .66: a new, empty dataset
      h('p', { className: 'de-hint' }, 'Start with Make a new variable: give it a name, choose numbers or text and what every row starts as, then set its values or type them in Browse.'),
      h('div', { className: 'tl-row' }, this.tlBtn('Make a new variable →', () => this.deGo('new', { recipe: '' }), 'primary')));
    if (!v) return this.tlPanel('Fix a variable', 'pick the variable you want to work on', null,
      h('div', { className: 'tl-row wide' }, this.tlField('Variable', this.deVarSelect('', n => this.dePickVar(n), { aria: 'Variable to change' })), h('span', { className: 'tl-hint' }, 'Tip: in Browse, click a column name to open it here.')),
      h('p', { className: 'de-hint' }, 'Rename it, say what it measures, choose whether it holds groups or numbers, write what each code means, change or merge values, or delete it — all on one page.'));
    const I = this.deInfo(v), hid = (S.hiddenVars || []).includes(v);
    const top = h('div', { className: 'tl-panel de-card' }, h('div', { className: 'de-cardb' },
      h('div', { className: 'tl-row' }, this.deVarSelect(v, n => this.dePickVar(n), { aria: 'Variable to change' }),
        h('span', { className: 'de-pill' }, this.fmtN(I.filled) + ' filled · ' + this.fmtN(I.missing) + ' missing'),
        h('span', { className: 'de-pill' }, this.fmtN(I.levels.length) + ' value' + (I.levels.length === 1 ? '' : 's')),
        h('button', { type: 'button', className: 'tl-link de-right', onClick: () => this.deBrowse(v) }, 'See it in Browse →')),
      h('div', { className: 'de-namegrid' },
        this.tlField('Name', h('div', { className: 'tl-row' }, h('input', { className: 'tl-input mono', key: 'rn' + v, defaultValue: v, 'aria-label': 'Name', spellCheck: false, style: { width: '170px' }, onChange: e => { this._deRn = e.target.value; }, onKeyDown: e => { if (e.key === 'Enter') { this._deRn = e.target.value; this.deRename(v); } } }), this.tlBtn('Rename', () => this.deRename(v)))),
        this.tlField('Description (what it measures)', h('input', { className: 'tl-input', key: 'lb' + v + '|' + I.label, defaultValue: I.label, placeholder: 'e.g. Age in years', 'aria-label': 'Description (variable label)', style: { width: '100%' }, onBlur: e => this.deSetLabel(v, e.target.value), onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); this.deSetLabel(v, e.target.value); } } }))),
      hid ? h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, v + ' is hidden from the variable lists.'), this.tlBtn('Show it again', () => this.deToggleHide(v))) : null,
      this.deMsgs(S.bcMsg, S.bcErr || S.rnErr)));
    // what kind of variable: groups or numbers (storage follows; text that holds numbers can be converted)
    const kind = I.num ? I.treat : 'categorical', armed = D.armNum === v;
    let lost = 0; if (!I.num) for (const r of I.levels) { const t = String(r.label).trim(); if (t !== '.' && !isFinite(Number(t))) lost += r.c; }
    const card = (k, title, eg) => h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': kind === k ? 'true' : 'false', className: 'de-kind' + (kind === k ? ' on' : ''), onClick: () => this.deSetKind(v, k, I, lost) },
      h('b', null, h('span', { className: 'de-radio', 'aria-hidden': 'true' }), title), h('span', null, eg));
    const kinds = this.tlPanel('What kind of variable is it?', null, null,
      h('div', { className: 'de-kinds', role: 'radiogroup', 'aria-label': 'What kind of variable is it?' },
        card('categorical', 'Groups', 'Each value is a group or category, e.g. party, region, yes/no. Tables count them; tests compare them.'),
        card('numeric', 'Numbers', 'Amounts or scores where an average makes sense, e.g. age, income, turnout, a 0–10 rating.')),
      armed ? this.tlBanner('warn', this.fmtN(lost) + ' value' + (lost === 1 ? ' is a word' : 's are words') + ' and would become missing (.). ', this.tlBtn('Convert ' + v + ' to numbers anyway', () => this.deSetKind(v, 'numeric', I, 0), 'green'), this.tlBtn('Cancel', () => this.deSet({ armNum: '' }))) : null,
      h('div', { className: 'tl-row' }, h('span', { className: 'tl-hint' }, I.num ? 'Saved as numbers' + (I.vl && I.vl.size ? ' with labels, like Stata.' : '.') : 'Saved as text (words).'),
        h('button', { type: 'button', className: 'tl-link', 'aria-expanded': D.storeOpen ? 'true' : 'false', onClick: () => this.deSet(d => ({ storeOpen: !d.storeOpen })) }, D.storeOpen ? 'Hide storage options' : 'Storage options')),
      D.storeOpen ? h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Stored as'), this.tlSeg([['n', 'Numbers', 'Values are numbers (codes or amounts)'], ['s', 'Text', 'Values are words']], I.num ? 'n' : 's', k => { if ((k === 's') === I.num) this.retypeCol(v, k === 's'); }, { 'aria-label': 'Stored as' }),
        h('span', { className: 'tl-hint' }, I.num ? 'Switching to text keeps every value as written.' : 'Switching to numbers: anything that is not a number becomes missing (.).')) : null);
    const delArmed = D.armDel === v;
    const where = h('div', { className: 'tl-panel de-fold' + (D.whereOpen ? ' open' : '') },
      h('button', { type: 'button', className: 'de-foldh', 'aria-expanded': D.whereOpen ? 'true' : 'false', onClick: () => this.deSet(d => ({ whereOpen: !d.whereOpen })) },
        h('span', { className: 'chev', 'aria-hidden': 'true' }, D.whereOpen ? '▾' : '▸'), h('b', null, 'Change values only in some rows'), h('span', { className: 'sub' }, 'e.g. turnout = . where country is “Chad”'), h('span', { className: 'de-st' }, 'replace … if')),
      D.whereOpen ? h('div', { className: 'de-cardb' }, this.deReplaceBox(v)) : null);
    return h(React.Fragment, null, top, kinds, this.deValuesTable(D, I), where,
      h('div', { className: 'tl-row de-endrow' }, this.tlBtn(delArmed ? 'Click again to delete ' + v : 'Delete ' + v + '…', () => this.deDelete(v), 'de-danger' + (delArmed ? ' armed' : ''), { 'aria-label': delArmed ? 'Confirm: delete ' + v : 'Delete ' + v }), delArmed ? h('span', { className: 'tl-hint' }, 'Undo brings it back.') : null));
  }
  deSetKind(v, k, I, lost) {
    if (k === 'categorical') { this.deSet({ armNum: '' }); if (I.num && I.treat !== 'categorical') this.deSetTreat(v, 'categorical'); return; }
    if (I.num) { this.deSet({ armNum: '' }); if (I.treat !== 'numeric') this.deSetTreat(v, 'numeric'); return; }
    if (lost > 0) return this.deSet({ armNum: v });
    this.deSet({ armNum: '' }); this.retypeCol(v, false); this.deSetTreat(v, 'numeric');
  }
  // one table for every value: how many rows, what it means (value label) and what to change it to (recode)
  deValuesTable(D, I) {
    const h = React.createElement, S = this.state, v = I.v, nLv = I.levels.length, mp = S.bcMap || {};
    if (!nLv) return this.tlPanel('Its values', null, null, h('p', { className: 'de-hint' }, v + ' has no values yet. Type them in Browse, or fill it with “Change values only in some rows” below.'));
    if (nLv > 60 || (I.num && I.treat === 'numeric' && nLv > 20)) {
      if (I.num) {
        const a = this.deNumAll(v), xs = a ? Array.from(a).filter(x => isFinite(x)).sort((p, q) => p - q) : [], med = xs.length ? (xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2) : NaN;
        return this.tlPanel('Its values', null, null, h('p', { className: 'de-hint' }, this.fmtN(nLv) + ' different values, from ' + I.levels[0].label + ' to ' + I.levels[nLv - 1].label + (isFinite(med) ? ' · median ' + this.numberText(med) : '') + ' — too many to list one by one.'),
          h('div', { className: 'tl-row' }, this.tlBtn('Make groups from it →', () => { this.setState({ rcVar: v, rcErr: '', rcMsg: '' }); this.deSet({ task: 'new', recipe: 'groups', grpV: v }); }, 'green', { title: 'e.g. a median split, terciles, quartiles or your own ranges — a new variable' }),
            h('span', { className: 'tl-hint' }, 'or change some rows with “Change values only in some rows” below.')));
      }
      return this.tlPanel('Its values', null, null, h('p', { className: 'de-hint' }, this.fmtN(nLv) + ' different values (for example names or IDs) — too many to list. Edit single cells in Browse, or use “Change values only in some rows” below.'));
    }
    const cur = I.vl || new Map(), draft = D.vl && D.vl.__v === v ? D.vl : { __v: v }, labs = I.num;
    const maxC = Math.max(...I.levels.map(r => r.c));
    const rows = I.levels.map(r => {
      const k = String(r.label), code = Number(k), have = labs && cur.has(code) ? cur.get(code) : '', lab = draft[k] != null ? draft[k] : have;
      return h('tr', { key: k }, h('td', { className: 'code' }, k),
        h('td', { className: 'cnt' }, h('span', { className: 'de-bar', 'aria-hidden': 'true' }, h('i', { style: { width: Math.max(2, Math.round(100 * r.c / maxC)) + '%' } })), h('span', { className: 'c' }, this.fmtN(r.c))),
        labs ? h('td', null, h('input', { className: 'tl-input', value: lab, placeholder: 'what ' + k + ' means', 'aria-label': 'Label for ' + k, onChange: e => { const t = e.target.value; this.deSet(d => ({ vl: Object.assign({}, d.vl && d.vl.__v === v ? d.vl : { __v: v }, { [k]: t }) })); this.setState({ bcMsg: '', bcErr: '' }); } })) : null,
        h('td', null, h('input', { className: 'tl-input mono', value: mp[k] == null ? '' : mp[k], placeholder: 'keep', 'aria-label': 'New value for ' + k, onChange: e => { const val = e.target.value; this.setState(s => ({ bcMap: Object.assign({}, s.bcMap, { [k]: val }), bcMsg: '', bcErr: '' })); } })));
    });
    const pairs = Object.entries(mp).map(([o, nv]) => [o, String(nv).trim()]).filter(([o, nv]) => nv !== '' && nv !== o && I.levels.some(r => String(r.label) === o));
    const words = I.num ? pairs.filter(([, nv]) => nv !== '.' && !isFinite(Number(nv))) : [];
    const newLabs = this.deLabelDraft(v, I, draft), labChanged = !!newLabs;
    // the commands this will run
    const st = [], rr = [];
    if (labChanged) { const lb = (v.length > 28 ? v.slice(0, 28) : v) + '_lb'; if (newLabs.size) { st.push('label define ' + lb + ' ' + [...newLabs].sort((a, b) => a[0] - b[0]).map(([c, l]) => c + ' "' + String(l).replace(/"/g, "'") + '"').join(' ') + ', replace', 'label values ' + v + ' ' + lb); rr.push('attr(df$' + v + ', "labels") <- c(' + [...newLabs].sort((a, b) => a[0] - b[0]).map(([c, l]) => '"' + String(l).replace(/"/g, "'") + '" = ' + c).join(', ') + ')'); } else { st.push('label values ' + v + ' .'); rr.push('attr(df$' + v + ', "labels") <- NULL'); } }
    if (pairs.length && !words.length) { try { st.push(this.cmdText({ t: 'vrecode', name: v, str: !I.num, pairs }, 'stata')); rr.push(this.cmdText({ t: 'vrecode', name: v, str: !I.num, pairs }, 'r')); } catch (e) {} }
    let act;
    if (words.length) act = this.tlBanner('warn', '“' + words[0][1] + '” is a word, but ' + v + ' holds numbers. To name a code, type the word under “What it means”. ',
      this.tlBtn('Keep the numbers and use the words as labels (recommended)', () => this.deWordsToLabels(v, pairs), 'green'),
      this.tlBtn('Turn ' + v + ' into text with these words', () => this.deWordsToText(v)));
    else act = h('div', { className: 'tl-row' }, this.tlBtn('Apply', () => this.deApplyValues(v), (pairs.length || labChanged) ? 'green' : '', { disabled: !(pairs.length || labChanged) }),
      (pairs.length || labChanged) ? this.tlBtn('Clear', () => { this.setState({ bcMap: {} }); this.deSet({ vl: null }); }) : null,
      labs && cur.size && !labChanged && !pairs.length ? this.tlBtn('Remove all labels', () => this.deApplyLabels(v, true)) : null,
      h('span', { className: 'tl-hint' }, (labs ? 'Leave “Change to” as keep to leave a value as it is. ' : 'Type a new value to change one; leave keep to leave it. ') + 'Type . to make a value missing.'));
    return this.tlPanel('Its values', labs ? 'write what each code means, or change a value' : 'change or merge values', null,
      h('div', { className: 'tl-tblwrap de-vtw' }, h('table', { className: 'de-vt' }, h('thead', null, h('tr', null, h('th', null, 'Value'), h('th', null, 'Rows'), labs ? h('th', null, 'What it means (label)') : null, h('th', null, 'Change to'))), h('tbody', null, rows))),
      act, st.length && !words.length ? this.deCmdLines(st, rr) : null);
  }
  // the labels the table would save, or null when nothing changed
  deLabelDraft(v, I, draft) {
    if (!I.num || !draft) return null; const cur = I.vl || new Map(), mp = new Map(cur); let ch = false;
    Object.keys(draft).forEach(k => { if (k === '__v') return; const t = String(draft[k]).trim(), code = Number(k); if (!isFinite(code)) return; const was = cur.has(code) ? cur.get(code) : ''; if (t === was) return; ch = true; if (t) mp.set(code, t); else mp.delete(code); });
    return ch ? mp : null;
  }
  deApplyValues(v) {
    const I = this.deInfo(v); if (!I) return;
    const D = this.deS(), draft = D.vl && D.vl.__v === v ? D.vl : null, mp = this.deLabelDraft(v, I, draft);
    const pairs = Object.entries(this.state.bcMap || {}).map(([o, nv]) => [o, String(nv).trim()]).filter(([o, nv]) => nv !== '' && nv !== o);
    let lm = '';
    if (mp) { this.deApplyLabels(v); lm = mp.size + ' label' + (mp.size === 1 ? '' : 's') + ' saved'; }
    if (pairs.length) { this.recodeCol(v); if (lm) this.setState(s => ({ bcMsg: lm + ' · ' + s.bcMsg })); }
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
  // a list of conditions (if … and …): which rows match right now
  deCondEval(conds) {
    const raw = this._raw, ready = conds.filter(c => this.deCondReady(c)), unfinished = conds.filter(c => c.v && !this.deCondReady(c));
    let mk = null, bad = '';
    for (const c of ready) { const o = this.deCondObj(c); if (!o.cat && o.val !== '.' && !isFinite(parseFloat(o.val))) { bad = c.v + ' holds numbers — compare it with a number (or . for missing)'; break; } const m2 = this.condMask(o); if (!m2) continue; if (!mk) mk = Uint8Array.from(m2); else for (let i = 0; i < mk.length; i++) mk[i] &= m2[i]; }
    let hit = raw.n; if (mk) { hit = 0; for (let i = 0; i < mk.length; i++) hit += mk[i]; }
    return { ready, unfinished, mk, bad, hit, cs: ready.map(c => this.deCondObj(c)) };
  }
  deCondRows(conds, set, firstPh) {
    const h = React.createElement, blank = { v: '', op: '==', val: '' };
    const setCond = (i, p) => set(conds.map((c, j) => j === i ? Object.assign({}, c, p) : c));
    return conds.map((c, i) => {
      let lv = []; if (c.v && this.colIdx(c.v) >= 0) { const L = this.deLevels(c.v), isN = this._raw.cols[this.colIdx(c.v)].k === 'n'; if (L.length <= 400) lv = L.slice(0, 200).map(r => [String(r.label), isN ? this.vlabel(c.v, r.label) : '']); }
      const m = c.v ? this.effMeta(c.v) : null;
      return h('div', { key: 'c' + i, className: 'de-cond' },
        h('span', { className: 'de-and' }, i ? 'and' : 'if'),
        this.deVarSelect(c.v, n => setCond(i, { v: n, val: '' }), { placeholder: i ? 'variable…' : firstPh, aria: 'Condition ' + (i + 1) + ' variable' }),
        this.tlSelect(c.op || '==', [['==', 'is'], ['!=', 'is not'], ['>', 'is more than'], ['>=', 'is at least'], ['<', 'is less than'], ['<=', 'is at most']], op => setCond(i, { op }), 'Condition ' + (i + 1) + ' comparison', { className: 'tl-select de-op' }),
        h('input', { className: 'tl-input', value: c.val == null ? '' : c.val, list: 'de-l' + i, placeholder: m ? (m.treatAs === 'numeric' ? 'a number, or .' : 'pick or type a value') : 'value', 'aria-label': 'Condition ' + (i + 1) + ' value', style: { width: '150px' }, onChange: e => setCond(i, { val: e.target.value }) }),
        h('datalist', { id: 'de-l' + i }, lv.map(([x, l]) => h('option', { key: x, value: x, label: l && l !== x ? l : undefined }))),
        (conds.length > 1 || c.v) ? h('button', { type: 'button', className: 'de-x', title: 'Remove this condition', 'aria-label': 'Remove condition ' + (i + 1), onClick: () => { const cs = conds.filter((_, j) => j !== i); set(cs.length ? cs : [blank]); } }, '×') : null);
    });
  }
  dePreview(name, cols, mk, newVals) {
    const h = React.createElement, raw = this._raw, rows = []; for (let i = 0; i < raw.n && rows.length < 6; i++) { if (mk && !mk[i]) continue; rows.push(i); }
    if (!rows.length) return null;
    const cell = (nm, i) => { const cc = raw.cols[this.colIdx(nm)]; if (!cc) return ''; const x = cc.a[i]; if (cc.k === 'n') return isFinite(x) ? this.vlabel(nm, this._E.numLab(x)) : '.'; return x == null || x === '' ? '""' : String(x); };
    return h('div', { className: 'tl-tblwrap de-prev' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'row'), newVals ? h('th', null, name) : null, cols.map(nm => h('th', { key: nm }, nm + (!newVals && nm === name ? ' (now)' : ''))))),
      h('tbody', null, rows.map(i => h('tr', { key: i }, h('td', { className: 'n' }, this.fmtN(i + 1)), newVals ? h('td', { className: 'de-newv' }, newVals) : null, cols.map(nm => h('td', { key: nm }, cell(nm, i))))))));
  }
  // replace … if on a variable that exists: value + conditions, with a live count of the rows that will change and a preview
  deReplaceBox(name) {
    const h = React.createElement, S = this.state, raw = this._raw, ci = this.colIdx(name); if (ci < 0) return null;
    const num = raw.cols[ci].k === 'n';
    const conds = S.rpConds && S.rpConds.length ? S.rpConds : [{ v: '', op: '==', val: '' }];
    const E = this.deCondEval(conds), { ready, unfinished, mk, bad, hit, cs } = E;
    const vt = (S.rpVal || '').trim();
    const lvT = !num ? (() => { const L = this.deLevels(name); return L.length <= 400 ? L.slice(0, 200).map(r => String(r.label)) : []; })() : [];
    const countMsg = unfinished.length ? 'Finish the condition on ' + unfinished[0].v + ' — type a value.' : bad ? bad : !ready.length ? 'No condition: all ' + this.fmtN(raw.n) + ' rows will change.' : this.fmtN(hit) + ' of ' + this.fmtN(raw.n) + ' rows match.';
    const vv = num ? vt : '"' + (vt === '.' ? '' : vt.replace(/^"(.*)"$/, '$1')) + '"';
    const canRun = !unfinished.length && !bad && (vt !== '' || !num);
    return h('div', { className: 'tl-col' },
      h('div', { className: 'de-cond' }, h('span', { className: 'de-and' }, 'set'), h('b', { className: 'mono' }, name), h('span', null, '='),
        h('input', { className: 'tl-input' + (num ? ' mono' : ''), value: S.rpVal || '', list: num ? undefined : 'de-lt', placeholder: num ? 'a number, . for missing, or a formula' : 'text, e.g. north (empty = missing)', 'aria-label': 'New value', style: { width: '250px' }, onChange: e => this.setState({ rpVal: e.target.value, rpMsg: '', rpErr: '' }) }),
        num ? null : h('datalist', { id: 'de-lt' }, lvT.map(x => h('option', { key: x, value: x })))),
      ...this.deCondRows(conds, cs2 => this.setState({ rpConds: cs2, rpMsg: '', rpErr: '' }), 'every row — or pick a variable…'),
      h('div', { className: 'tl-row' }, this.tlBtn('+ and another condition', () => this.setState({ rpConds: [...conds, { v: '', op: '==', val: '' }] })),
        h('span', { className: 'de-count' + (unfinished.length || bad ? ' warn' : ''), role: 'status' }, countMsg)),
      h('div', { className: 'tl-row' }, this.tlBtn('Replace', () => this.setState({ nvCur: name }, () => this.doReplace()), canRun ? 'green' : '', { disabled: !canRun }), canRun && (vt || !num) ? this.deCmd({ t: 'replace', name, val: vv, conds: cs }) : null),
      this.deMsgs(S.rpMsg, S.rpErr),
      h('p', { className: 'tl-hint' }, 'Run it as many times as you need, e.g. = 1 if region is North, then = 2 if region is South. Formulas can use other variables: income / 1000, ln(gdp).'),
      this.dePreview(name, [name, ...new Set(ready.map(c => c.v).filter(x => x !== name))].slice(0, 4), mk, null));
  }

  // ---- 2. make a new variable: pick a recipe, then name, rule and preview on one screen
  deRecipes() {
    return [
      ['groups', 'Groups from a number', 'Age → 18–29, 30–44…, a median split or quartiles.', 'recode … , gen()', 'bars'],
      ['scale', 'Scale from several questions', 'Average the trust items; checks first that they fit together (Cronbach’s alpha).', 'alpha · egen rowmean', 'lines'],
      ['calc', 'Calculation', 'Log, ratio or difference, e.g. gdp / population.', 'generate', 'ƒx'],
      ['copy', 'Copy and recode', 'Merge categories into a new variable, e.g. 7-point party ID → 3 groups.', 'recode … , gen()', 'grid']];
  }
  deRecipeIcon(k) {
    const h = React.createElement, P = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, L = Object.assign({ fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }, P);
    if (k === 'bars') return h('svg', Object.assign({ fill: 'currentColor' }, P), h('rect', { x: 3, y: 12, width: 4, height: 9, rx: 1 }), h('rect', { x: 10, y: 7, width: 4, height: 14, rx: 1 }), h('rect', { x: 17, y: 3, width: 4, height: 18, rx: 1 }));
    if (k === 'lines') return h('svg', L, h('path', { d: 'M4 7h10M4 12h16M4 17h7' }));
    if (k === 'grid') return h('svg', L, h('path', { d: 'M8 4v16M16 4v16M4 8h16M4 16h16' }));
    if (k === 'box') return h('svg', L, h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }));
    return h('span', { className: 'mono' }, k);
  }
  // GM26 .68: the simple way first, as in Stata — 1 create it (name · numbers or text · what every row starts as:
  // generate), 2 change values (set = value if …: replace … if, as often as needed, or type them in Browse). The other
  // recipes (groups from a number, a scale, a calculation, copy and recode) sit under "More ways to make a variable".
  deTaskNew(D) {
    const h = React.createElement, S = this.state, raw = this._raw;
    const isNum = (S.nvType || 'num') === 'num', st = S.nvStart || (isNum ? '.' : 'empty');
    const nm = (S.nvName || '').trim();
    const startOpts = isNum ? [['.', 'missing (.)'], ['0', '0'], ['1', '1'], ['other', 'other…']] : [['empty', 'empty ("")'], ['other', 'other…']];
    const startTxt = isNum ? (st === 'other' ? ((S.nvOther || '').trim() || '…') : st) : '"' + (st === 'other' ? (S.nvOther || '').trim().replace(/^"(.*)"$/, '$1') : '') + '"';
    const setNv = p => this.setState(Object.assign({ nvErr: '', nvMsg: '' }, p));
    const create = this.tlPanel('1 · Create it', 'name · numbers or text · what every row starts as', null,
      h('div', { className: 'de-namegrid' },
        this.tlField('Name', h('input', { className: 'tl-input mono', value: S.nvName || '', placeholder: 'e.g. democrat', 'aria-label': 'Name of the new variable', spellCheck: false, onChange: e => setNv({ nvName: e.target.value }), onKeyDown: e => { if (e.key === 'Enter') this.doNewVar(); } })),
        this.tlField('Holds', this.tlSeg([['num', 'Numbers'], ['str', 'Text (words)']], isNum ? 'num' : 'str', k => setNv({ nvType: k, nvStart: k === 'num' ? '.' : 'empty', nvOther: '' }), { 'aria-label': 'Holds' }))),
      this.tlField('Every row starts as', h('div', { className: 'tl-row' },
        this.tlSeg(startOpts, st, k => setNv({ nvStart: k }), { 'aria-label': 'Every row starts as' }),
        st === 'other' ? h('input', { className: 'tl-input' + (isNum ? ' mono' : ''), value: S.nvOther || '', placeholder: isNum ? 'a number, or a formula: income / 1000' : 'e.g. unknown', 'aria-label': 'Starting value', style: { width: '240px' }, onChange: e => setNv({ nvOther: e.target.value }), onKeyDown: e => { if (e.key === 'Enter') this.doNewVar(); } }) : null)),
      h('div', { className: 'tl-row' }, this.tlBtn('Create ' + (nm || 'the variable'), () => this.doNewVar(), 'primary'),
        this.deCmdLines([(isNum ? 'generate ' : 'generate str ') + (nm || 'name') + ' = ' + startTxt], ['df$' + (nm || 'name') + ' <- ' + (isNum ? (startTxt === '.' ? 'NA' : startTxt) : startTxt)])),
      this.deMsgs(S.nvMsg, S.nvErr));
    const cur = S.nvCur && this.colIdx(S.nvCur) >= 0 ? S.nvCur : '';
    const pickCur = n => this.setState({ nvCur: n, rpVal: '', rpConds: [{ v: '', op: '==', val: '' }], rpMsg: '', rpErr: '' });
    const change = this.tlPanel('2 · Change values', 'set a value where a rule is true — repeat for each value', null,
      h('div', { className: 'tl-row' }, this.tlField('Variable', this.deVarSelect(cur, pickCur, { placeholder: 'the variable you just made, or any other…', aria: 'Variable to change' })),
        cur ? h('button', { type: 'button', className: 'tl-link', onClick: () => this.deBrowse(cur) }, 'Type values by hand in Browse →') : null),
      cur ? this.deReplaceBox(cur) : h('p', { className: 'de-hint' }, raw.names.length ? 'Create a variable above, or pick one, then set its values here — e.g. set democrat = 1 if party is "Democrat".' : 'Create a variable above, then set its values here or type them in Browse.'));
    // more ways (the recipes), folded
    const R = this.deRecipes(), more = R.some(r => r[0] === D.recipe) ? D.recipe : '';
    const waysOpen = !!(D.waysOpen || more);
    const moreEl = h('section', { className: 'tl-panel de-more' },
      h('button', { type: 'button', className: 'de-moreh', 'aria-expanded': waysOpen ? 'true' : 'false', onClick: () => this.deSet({ waysOpen: !waysOpen, recipe: waysOpen ? '' : D.recipe }) }, (waysOpen ? '▾ ' : '▸ ') + 'More ways to make a variable', h('span', null, 'groups from a number · scale · calculation · copy and recode')),
      waysOpen ? h('div', { className: 'de-recipes', role: 'radiogroup', 'aria-label': 'More ways to make a variable' }, R.map(([k, t, d, stx, ic]) => h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': more === k ? 'true' : 'false', className: 'de-rc' + (more === k ? ' on' : ''), onClick: () => { this.setState({ deMsg: '', deErr: '' }); this.deSet({ recipe: more === k ? '' : k, waysOpen: true }); } },
        h('span', { className: 'rt' }, h('span', { className: 'ic' }, this.deRecipeIcon(ic)), h('b', null, t)), h('span', { className: 'rd' }, d), h('span', { className: 'de-st' }, stx)))) : null);
    let body = null;
    if (more === 'groups') body = this.deRecipeGroups(D);
    else if (more === 'scale') body = this.deTaskScale(D);
    else if (more === 'calc') body = this.deRecipeCalc(D);
    else if (more === 'copy') body = this.deRecipeCopy(D);
    // a recipe from More ways replaces the two steps while it is open (one form at a time)
    if (more) return h(React.Fragment, null, h('div', { className: 'tl-row' }, this.tlBtn('← Back to Create it · Change values', () => { this.setState({ deMsg: '', deErr: '' }); this.deSet({ recipe: '', waysOpen: false }); })), moreEl, body);
    return h(React.Fragment, null, create, change, moreEl);
  }
  deNameRow(nameKey, descKey, D, ph) {
    const h = React.createElement;
    return h('div', { className: 'de-namegrid' },
      this.tlField('Name', h('input', { className: 'tl-input mono', value: D[nameKey] || '', placeholder: ph, 'aria-label': 'Name of the new variable', spellCheck: false, onChange: e => { this.setState({ deErr: '', deMsg: '' }); this.deSet({ [nameKey]: e.target.value }); } })),
      descKey ? this.tlField('Description (optional)', h('input', { className: 'tl-input', value: D[descKey] || '', placeholder: 'what it measures', 'aria-label': 'Description of the new variable', onChange: e => this.deSet({ [descKey]: e.target.value }) })) : null);
  }
  deNewName(nm) { nm = String(nm || '').trim(); return { nm, bad: nm ? this.validName(nm) : 'type a name for the new variable' }; }
  deDone(name, msg) { this.clearMemo(); this.setState({ deErr: '', deMsg: msg, deLast: name }); }
  deDoneRow() {
    const h = React.createElement, S = this.state, nm = S.deLast && this.colIdx(S.deLast) >= 0 ? S.deLast : '';
    return h(React.Fragment, null, S.deErr ? this.tlBanner('warn', S.deErr) : null,
      S.deMsg ? this.tlBanner('ok', S.deMsg + ' ', nm ? h('button', { type: 'button', className: 'tl-link', onClick: () => this.deBrowse(nm) }, 'See it in Browse →') : null, nm ? h('button', { type: 'button', className: 'tl-link', onClick: () => { this.dePickVar(nm); this.deSet({ task: 'var' }); } }, 'Fix or label it →') : null) : null);
  }
  // Yes / No: generate x = 0 (or .) · replace x = 1 if …
  deRecipeDummy(D) {
    const h = React.createElement, raw = this._raw, conds = D.dmConds && D.dmConds.length ? D.dmConds : [{ v: '', op: '==', val: '' }];
    const E = this.deCondEval(conds), { ready, unfinished, bad, hit, mk, cs } = E, else0 = D.dmElse !== '.';
    const nm = (D.dmName || '').trim() || 'new';
    const msg = unfinished.length ? 'Finish the condition on ' + unfinished[0].v + ' — type a value.' : bad ? bad : !ready.length ? 'Pick a variable and a value: the rows where the rule is true get 1.' : this.fmtN(hit) + ' of ' + this.fmtN(raw.n) + ' rows will be 1 · ' + this.fmtN(raw.n - hit) + ' will be ' + (else0 ? '0' : 'missing (.)');
    const ok = ready.length && !unfinished.length && !bad;
    return this.tlPanel('Yes / No variable', '1 where the rule is true', null,
      this.deNameRow('dmName', 'dmDesc', D, 'e.g. dem_senator'),
      h('span', { className: 'tl-lbl' }, 'It is 1 when…'),
      ...this.deCondRows(conds, cs2 => { this.setState({ deErr: '', deMsg: '' }); this.deSet({ dmConds: cs2 }); }, 'pick a variable…'),
      h('div', { className: 'tl-row' }, this.tlBtn('+ another condition', () => this.deSet({ dmConds: [...conds, { v: '', op: '==', val: '' }] })),
        h('span', { className: 'tl-lbl' }, 'Everyone else is'), this.tlSeg([['0', '0'], ['.', 'missing (.)']], else0 ? '0' : '.', k => this.deSet({ dmElse: k }), { 'aria-label': 'Everyone else is' })),
      h('div', { className: ok ? 'de-okline' : 'de-count' + (unfinished.length || bad ? ' warn' : ''), role: 'status' }, msg),
      ok ? this.dePreview(nm, [...new Set(ready.map(c => c.v))].slice(0, 3), mk, '1') : null,
      h('div', { className: 'tl-row' }, this.tlBtn('Create ' + ((D.dmName || '').trim() || 'the variable'), () => this.deMakeDummy(), ok ? 'primary' : '', { disabled: !ok })),
      ok ? this.deCmdLines(['generate ' + nm + ' = ' + (else0 ? '0' : '.'), this.cmdText({ t: 'replace', name: nm, val: '1', conds: cs }, 'stata')], ['df$' + nm + ' <- ' + (else0 ? '0' : 'NA'), this.cmdText({ t: 'replace', name: nm, val: '1', conds: cs }, 'r')]) : null,
      this.deDoneRow());
  }
  deMakeDummy() {
    const D = this.deS(), { nm, bad } = this.deNewName(D.dmName); if (bad) return this.setState({ deErr: bad, deMsg: '' });
    const conds = D.dmConds || [], E = this.deCondEval(conds);
    if (!E.ready.length || E.unfinished.length || E.bad) return this.setState({ deErr: E.bad || 'finish the rule first', deMsg: '' });
    const n = this._raw.n, else0 = D.dmElse !== '.', out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = E.mk && !E.mk[i] ? (else0 ? 0 : NaN) : 1;
    const desc = String(D.dmDesc || '').trim();
    this.addDerivedCol(nm, { k: 'n', a: out }, desc, 'gen');
    this.pushLog({ t: 'nvgen', name: nm, str: false, start: else0 ? '0' : '.', res: 'new numeric variable · ' + this.fmtN(n) + ' rows' });
    this.pushLog({ t: 'replace', name: nm, val: '1', conds: E.cs, res: '(' + this.fmtN(E.hit) + ' real change' + (E.hit === 1 ? '' : 's') + ' made)' });
    if (desc) this.stataLog('label variable ' + nm + ' "' + desc.replace(/"/g, "'") + '"');
    this.deDone(nm, nm + ' created: ' + this.fmtN(E.hit) + ' rows are 1, ' + this.fmtN(n - E.hit) + ' are ' + (else0 ? '0' : 'missing') + '.');
    this.deSet({ dmName: '', dmDesc: '', dmConds: null });
  }
  // groups from a number: the ranges editor (quick fill, your own ranges)
  deRecipeGroups(D) {
    const h = React.createElement, S = this.state, v = D.grpV && this.colIdx(D.grpV) >= 0 && this.deNumAll(D.grpV) ? D.grpV : '';
    return this.tlPanel('Groups from a number', 'one group per range', null,
      h('div', { className: 'tl-row wide' }, this.tlField('Make groups from', this.deVarSelect(v, n => { this.setState({ rcVar: n, rcErr: '', rcMsg: '', rcName: '', rcRows: [{ f: '', t: '', l: '' }, { f: '', t: '', l: '' }, { f: '', t: '', l: '' }] }); this.deSet({ grpV: n }); }, { placeholder: 'pick a number variable…', aria: 'Make groups from', filter: c => (this.effMeta(c.name) || {}).type === 'numeric' }))),
      v ? this.deGroupsBox(this.deInfo(v)) : h('p', { className: 'de-hint' }, 'Pick a number variable such as age, income or ideology. You can split it at the median, into equal-size groups, or into ranges you type.'));
  }
  // calculation: generate x = formula
  deRecipeCalc(D) {
    const h = React.createElement, ex = D.ccExpr || '', nm = (D.ccName || '').trim() || 'new';
    return this.tlPanel('Calculation', 'a number from a formula', null,
      this.deNameRow('ccName', 'ccDesc', D, 'e.g. gdp_pc'),
      this.tlField('Formula', h('div', { className: 'tl-row' }, h('input', { className: 'tl-input mono', value: ex, placeholder: 'e.g. gdp / population   or   ln(income)   or   age >= 18', 'aria-label': 'Formula', style: { flex: '1 1 300px' }, onChange: e => { this.setState({ deErr: '', deMsg: '' }); this.deSet({ ccExpr: e.target.value }); }, onKeyDown: e => { if (e.key === 'Enter') this.deMakeCalc(); } }),
        this.deVarSelect('', n => this.deSet(d => { const f = d.ccExpr || ''; return { ccExpr: /\(\)\s*$/.test(f) ? f.replace(/\(\)\s*$/, '(' + n + ')') : (f && !/[\s(+\-*/^]$/.test(f) ? f + ' ' : f) + n }; }), { placeholder: '+ insert a variable', aria: 'Insert a variable into the formula', filter: c => (this.effMeta(c.name) || {}).type === 'numeric' }))),
      h('span', { className: 'tl-hint' }, 'Use + − * / ^ and ( ). Functions: ln() log10() sqrt() exp() abs() round() floor() ceil(). A comparison gives 1 or 0: age >= 18. Rows with a missing input get missing (.).'),
      h('div', { className: 'tl-row' }, this.tlBtn('Create ' + ((D.ccName || '').trim() || 'the variable'), () => this.deMakeCalc(), ex.trim() ? 'primary' : '', { disabled: !ex.trim() }), ex.trim() ? this.deCmdLines(['generate ' + nm + ' = ' + ex.trim()], ['df$' + nm + ' <- ' + ex.trim()]) : null),
      this.deDoneRow());
  }
  deMakeCalc() {
    const D = this.deS(), { nm, bad } = this.deNewName(D.ccName); if (bad) return this.setState({ deErr: bad, deMsg: '' });
    const ex = String(D.ccExpr || '').trim(); if (!ex) return this.setState({ deErr: 'type a formula', deMsg: '' });
    const r = this.evalExprAll(ex); if (r.error) return this.setState({ deErr: r.error, deMsg: '' });
    let ok = 0; for (const x of r.a) if (isFinite(x)) ok++;
    const desc = String(D.ccDesc || '').trim();
    this.addDerivedCol(nm, { k: 'n', a: r.a }, desc, 'new');
    this.pushLog({ t: 'nvgen', name: nm, str: false, start: ex, res: 'new numeric variable · ' + this.fmtN(ok) + ' rows with a value' });
    if (desc) this.stataLog('label variable ' + nm + ' "' + desc.replace(/"/g, "'") + '"');
    this.deDone(nm, nm + ' created: ' + this.fmtN(ok) + ' of ' + this.fmtN(this._raw.n) + ' rows have a value' + (ok < this._raw.n ? ' (the rest have a missing input)' : '') + '.');
    this.deSet({ ccName: '', ccExpr: '', ccDesc: '' });
  }
  // copy and recode: each old value goes into a new group; the new variable stores 1, 2, 3… with the group names as labels
  deCopyPlan(v, map) {
    const I = this.deInfo(v); if (!I) return null;
    const groups = []; const codeOf = new Map();
    for (const r of I.levels) { const g = String((map || {})[String(r.label)] || '').trim(); if (!g) continue; if (!groups.some(x => x.name === g)) groups.push({ name: g, vals: [], c: 0 }); const G = groups.find(x => x.name === g); G.vals.push(String(r.label)); G.c += r.c; }
    const real = groups.filter(g => g.name !== '.'), allNum = real.length > 0 && real.every(g => isFinite(Number(g.name)));
    real.forEach((g, i) => { g.code = allNum ? Number(g.name) : i + 1; });
    groups.forEach(g => g.vals.forEach(x => codeOf.set(x, g.name === '.' ? NaN : g.code)));
    let miss = I.missing; for (const r of I.levels) if (!codeOf.has(String(r.label)) || !isFinite(codeOf.get(String(r.label)))) miss += r.c;
    return { I, groups: real, codeOf, allNum, miss };
  }
  deRecipeCopy(D) {
    const h = React.createElement, S = this.state, v = D.cpV && this.colIdx(D.cpV) >= 0 ? D.cpV : '';
    const pick = h('div', { className: 'tl-row wide' }, this.tlField('Copy from', this.deVarSelect(v, n => { this.setState({ deErr: '', deMsg: '' }); this.deSet({ cpV: n, cpMap: null, cpName: '' }); }, { placeholder: 'pick a variable with groups…', aria: 'Copy from', filter: c => c.distinct > 0 && c.distinct <= 60 })));
    if (!v) return this.tlPanel('Copy and recode', 'merge categories into a new variable', null, pick, h('p', { className: 'de-hint' }, 'Pick a variable with up to 60 values (for example 7-point party ID). Type the new group next to each value; values with the same group name end up together. The original variable is not changed.'), this.deDoneRow());
    const P = this.deCopyPlan(v, D.cpMap), I = P.I, mp = D.cpMap || {}, maxC = Math.max(...I.levels.map(r => r.c));
    const nm = (D.cpName || '').trim() || (v.slice(0, 27) + '_r');
    const rows = I.levels.map(r => { const k = String(r.label), lab = I.num ? this.vlabel(v, k) : k; return h('tr', { key: k }, h('td', { className: 'code' }, k), I.num ? h('td', { className: 'lab' }, lab !== k ? lab : '') : null,
      h('td', { className: 'cnt' }, h('span', { className: 'de-bar', 'aria-hidden': 'true' }, h('i', { style: { width: Math.max(2, Math.round(100 * r.c / maxC)) + '%' } })), h('span', { className: 'c' }, this.fmtN(r.c))),
      h('td', null, h('input', { className: 'tl-input', value: mp[k] == null ? '' : mp[k], placeholder: 'missing', list: 'de-cpg', 'aria-label': 'New group for ' + k, onChange: e => { const t = e.target.value; this.setState({ deErr: '', deMsg: '' }); this.deSet(d => ({ cpMap: Object.assign({}, d.cpMap, { [k]: t }) })); } }))); });
    const sum = P.groups.length ? P.groups.map(g => g.name + (P.allNum ? '' : ' (' + g.code + ')') + ': ' + this.fmtN(g.c)).join(' · ') + ' · missing: ' + this.fmtN(P.miss) : 'Type a group name next to the values you want to keep. Blank values become missing (.).';
    // the commands: recode for number variables, generate + replace for text
    let st = [], rr = [];
    if (P.groups.length) {
      const lb = (nm.length > 28 ? nm.slice(0, 28) : nm) + '_lb', q = x => '"' + String(x).replace(/"/g, "'") + '"';
      if (I.num) st.push('recode ' + v + ' ' + P.groups.map(g => '(' + g.vals.join(' ') + ' = ' + g.code + (P.allNum ? '' : ' ' + q(g.name)) + ')').join(' ') + ' (else = .), gen(' + nm + ')');
      else { st.push('generate ' + nm + ' = .'); P.groups.forEach(g => st.push('replace ' + nm + ' = ' + g.code + ' if inlist(' + v + ', ' + g.vals.map(q).join(', ') + ')')); if (!P.allNum) st.push('label define ' + lb + ' ' + P.groups.map(g => g.code + ' ' + q(g.name)).join(' ') + ', replace', 'label values ' + nm + ' ' + lb); }
      rr.push('df$' + nm + ' <- NA'); P.groups.forEach(g => rr.push('df$' + nm + '[df$' + v + ' %in% c(' + g.vals.map(x => I.num ? x : q(x)).join(', ') + ')] <- ' + g.code));
      if (!P.allNum) rr.push('attr(df$' + nm + ', "labels") <- c(' + P.groups.map(g => q(g.name) + ' = ' + g.code).join(', ') + ')');
    }
    return this.tlPanel('Copy and recode', 'merge categories into a new variable — ' + v + ' stays as it is', null, pick,
      h('div', { className: 'tl-tblwrap de-vtw' }, h('table', { className: 'de-vt' }, h('thead', null, h('tr', null, h('th', null, 'Value'), I.num ? h('th', null, 'Means') : null, h('th', null, 'Rows'), h('th', null, 'New group'))), h('tbody', null, rows))),
      h('datalist', { id: 'de-cpg' }, P.groups.map(g => h('option', { key: g.name, value: g.name }))),
      h('div', { className: P.groups.length ? 'de-okline' : 'de-count', role: 'status' }, sum),
      h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'New variable'), h('input', { className: 'tl-input mono', value: D.cpName || '', placeholder: v.slice(0, 27) + '_r', 'aria-label': 'Name of the new variable', spellCheck: false, style: { width: '190px' }, onChange: e => { this.setState({ deErr: '', deMsg: '' }); this.deSet({ cpName: e.target.value }); } }),
        this.tlBtn('Create ' + nm, () => this.deMakeCopy(), P.groups.length ? 'primary' : '', { disabled: !P.groups.length })),
      st.length ? this.deCmdLines(st, rr) : null,
      this.deDoneRow());
  }
  deMakeCopy() {
    const D = this.deS(), v = D.cpV; if (!v || this.colIdx(v) < 0) return this.setState({ deErr: 'pick a variable to copy', deMsg: '' });
    const { nm, bad } = this.deNewName((D.cpName || '').trim() || (v.slice(0, 27) + '_r')); if (bad) return this.setState({ deErr: bad, deMsg: '' });
    const P = this.deCopyPlan(v, D.cpMap); if (!P.groups.length) return this.setState({ deErr: 'type a group next to at least one value', deMsg: '' });
    const raw = this._raw, col = raw.cols[this.colIdx(v)], n = raw.n, out = new Float64Array(n); out.fill(NaN);
    for (let i = 0; i < n; i++) { const x = col.a[i], k = col.k === 'n' ? (isFinite(x) ? this._E.numLab(x) : null) : (x == null || String(x).trim() === '' ? null : String(x)); if (k != null && P.codeOf.has(k)) out[i] = P.codeOf.get(k); }
    this.addDerivedCol(nm, { k: 'n', a: out }, (raw.labels[this.colIdx(v)] || v) + ' (recoded)', 'recode');
    if (!P.allNum) { raw.vlabs = raw.vlabs || {}; raw.vlabs[nm] = new Map(P.groups.map(g => [g.code, g.name])); this.rememberLabels([nm]); this.setState(s => ({ dver: (s.dver || 0) + 1 })); }
    const q = x => '"' + String(x).replace(/"/g, "'") + '"', lb = (nm.length > 28 ? nm.slice(0, 28) : nm) + '_lb';
    const res = P.groups.length + ' groups · ' + this.fmtN(n - P.miss) + ' rows grouped · ' + this.fmtN(P.miss) + ' missing';
    if (P.I.num) this.pushLog({ t: 'stata', stata: 'recode ' + v + ' ' + P.groups.map(g => '(' + g.vals.join(' ') + ' = ' + g.code + (P.allNum ? '' : ' ' + q(g.name)) + ')').join(' ') + ' (else = .), gen(' + nm + ')', r: 'df$' + nm + ' <- NA\n' + P.groups.map(g => 'df$' + nm + '[df$' + v + ' %in% c(' + g.vals.join(', ') + ')] <- ' + g.code).join('\n'), res });
    else { this.pushLog({ t: 'nvgen', name: nm, str: false, start: '.', res: '' }); P.groups.forEach(g => this.pushLog({ t: 'stata', stata: 'replace ' + nm + ' = ' + g.code + ' if inlist(' + v + ', ' + g.vals.map(q).join(', ') + ')', r: 'df$' + nm + '[df$' + v + ' %in% c(' + g.vals.map(q).join(', ') + ')] <- ' + g.code, res: '' })); if (!P.allNum) this.deLabelCmds(nm, new Map(P.groups.map(g => [g.code, g.name]))); }
    this.deDone(nm, nm + ' created: ' + res + '. ' + v + ' is unchanged.');
    this.deSet({ cpName: '', cpMap: null });
  }
  // blank: generate x = .  (or an empty text variable), then type the values in Browse
  deRecipeBlank(D) {
    const h = React.createElement, nm = (D.bkName || '').trim() || 'new';
    return this.tlPanel('Blank variable', 'type the values yourself', null,
      this.deNameRow('bkName', null, D, 'e.g. notes'),
      this.tlField('Holds', this.tlSeg([['n', 'Numbers'], ['s', 'Text (words)']], D.bkText ? 's' : 'n', k => this.deSet({ bkText: k === 's' }), { 'aria-label': 'Holds' })),
      h('div', { className: 'tl-row' }, this.tlBtn('Create ' + ((D.bkName || '').trim() || 'the variable'), () => this.deMakeBlank(), 'primary'), this.deCmdLines([D.bkText ? 'generate str ' + nm + ' = ""' : 'generate ' + nm + ' = .'], ['df$' + nm + ' <- ' + (D.bkText ? '""' : 'NA')])),
      this.deDoneRow());
  }
  deMakeBlank() {
    const D = this.deS(), { nm, bad } = this.deNewName(D.bkName); if (bad) return this.setState({ deErr: bad, deMsg: '' });
    const n = this._raw.n, a = new Float64Array(n); a.fill(NaN);
    this.addDerivedCol(nm, D.bkText ? { k: 's', a: new Array(n).fill('') } : { k: 'n', a }, '', 'new');
    this.pushLog({ t: 'nvgen', name: nm, str: !!D.bkText, start: D.bkText ? '""' : '.', res: 'new ' + (D.bkText ? 'text' : 'numeric') + ' variable · ' + this.fmtN(n) + ' rows' });
    this.deDone(nm, nm + ' created — every row is empty. Type the values in Browse.');
    this.deSet({ bkName: '' });
  }

  // ---- make a scale (Cronbach's alpha, then the scale score) — the “Scale from several questions” recipe
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
    const kept = this.deConds().length ? ' (on the ' + this.fmtN(this.deKept()) + ' rows in use — see Choose what to use)' : '';
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


  // ---- 3. choose what to use: rows (the same subgroup as the IF bar on every tab) · variables shown in the lists · more
  deTaskUse(D) {
    const h = React.createElement, raw = this._raw;
    const more = h('div', { className: 'tl-panel de-fold' + (D.moreOpen ? ' open' : '') },
      h('button', { type: 'button', className: 'de-foldh', 'aria-expanded': D.moreOpen ? 'true' : 'false', onClick: () => this.deSet(d => ({ moreOpen: !d.moreOpen })) },
        h('span', { className: 'chev', 'aria-hidden': 'true' }, D.moreOpen ? '▾' : '▸'), h('b', null, 'More'), h('span', { className: 'sub' }, 'add empty rows to type new cases in Browse')),
      D.moreOpen ? h('div', { className: 'de-cardb' },
        h('div', { className: 'tl-row' }, this.tlBtn('+ 1 row', () => this.addRows(1)), this.tlBtn('+ 10 rows', () => this.addRows(10)), this.tlBtn('+ 100 rows', () => this.addRows(100)), h('button', { type: 'button', className: 'tl-link', onClick: () => { const n = raw.n; this.setState({ tab: 'browse', browseMode: 'data', bRow: Math.max(0, n - 12) }); } }, 'Type into them in Browse →')),
        h('span', { className: 'tl-hint' }, 'New rows start empty (.). Typing in the last row of Browse adds more automatically.'),
        this.state.bErr ? this.tlBanner('warn', this.state.bErr) : null) : null);
    return h(React.Fragment, null, this.deRowsPanel(D), this.deColsPanel(D), more);
  }
  deRowsPanel(D) {
    const h = React.createElement, S = this.state, raw = this._raw, E = this._E;
    const sg = (S.subg && S.subg.all) || [], flt = S.flt && S.flt.on ? S.flt : null, kept = this.deKept();
    const chips = [];
    if (flt) [flt, ...(flt.more || [])].forEach((c, i) => chips.push(h('span', { key: 'f' + i, className: 'de-cnd' }, c.v + ' ' + c.op + ' ' + c.val, i === 0 ? h('button', { type: 'button', className: 'de-x', title: 'Remove (typed as keep if)', 'aria-label': 'Remove the keep-if filter', onClick: () => this.clearFilter() }, '×') : null)));
    sg.forEach((c, i) => chips.push(h('span', { key: 's' + i, className: 'de-cnd' }, this.condLabel(c), h('button', { type: 'button', className: 'de-x', title: 'Remove', 'aria-label': 'Remove ' + this.condLabel(c), onClick: () => { this.clearMemo(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: (s.subg.all || []).filter((_, j) => j !== i) }) })); } }, '×'))));
    const pct = raw.n ? Math.round(1000 * kept / raw.n) / 10 : 100;
    const meter = h('div', { className: 'de-meter', role: 'img', 'aria-label': this.fmtN(kept) + ' of ' + this.fmtN(raw.n) + ' rows in use' }, h('i', { style: { width: pct + '%' } }));
    const status = chips.length ? h('div', { className: 'tl-col' }, h('div', { className: 'tl-row' }, h('span', { className: 'tl-lbl' }, 'Keeping rows where'), ...chips.flatMap((c, i) => i ? [h('span', { key: 'a' + i, className: 'de-and' }, 'and'), c] : [c])),
      h('div', { className: 'tl-row' }, h('span', { className: 'de-count', role: 'status' }, 'Analyses and charts use ' + this.fmtN(kept) + ' of ' + this.fmtN(raw.n) + ' rows.'), this.tlBtn('Use all rows', () => { this.clearMemo(); if (flt) this.clearFilter(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: [] }) })); })), meter)
      : h('div', { className: 'tl-col' }, h('span', { className: 'de-count', role: 'status' }, 'All ' + this.fmtN(raw.n) + ' rows are in use.'), meter);
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
    return this.tlPanel('Rows', 'which cases go into analyses and charts', h('span', { className: 'de-st' }, 'keep if'), status,
      h('div', { className: 'tl-row wide' }, this.tlField(chips.length ? 'And also keep rows where' : 'Keep rows where', this.deVarSelect(v, n => this.deSet({ rowsV: n, rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '' }), { placeholder: 'pick a variable…', aria: 'Keep rows where' }))),
      builder,
      h('p', { className: 'tl-hint' }, 'Rows left out are only set aside, not deleted. This is the same subgroup as the IF bar above every analysis, so changing it in either place changes both. To save only these rows, use Save data as CSV ▾ at the top.'));
  }
  deKeepRows(v, c) { this.clearMemo(); this.setState(s => ({ subg: Object.assign({}, s.subg, { all: [...((s.subg && s.subg.all) || []).filter(x => x.v !== v), Object.assign({ v }, c)] }) })); this.deSet({ rowsV: '', rowsSel: [], rowsLo: '', rowsHi: '', rowsQ: '' }); }

  deColsPanel(D) {
    const h = React.createElement, S = this.state, hid = new Set(S.hiddenVars || []), nz = x => this.tlNorm(x), q = nz((D.colsQ || '').trim()); // GM26 .70: accents ignored
    const all = S.cols, match = q ? all.filter(c => nz(c.name).includes(q) || nz(c.label || '').includes(q)) : all;
    const empty = all.filter(c => !hid.has(c.name) && !(c.valid > 0));
    // GM26 .70: every variable is listed (no cap of 400)
    const rows = match.map(c => { const on = !hid.has(c.name), m = this.effMeta(c.name) || {}; return h('label', { key: c.name, className: 'de-vrow' + (on ? '' : ' off') },
      h('input', { type: 'checkbox', checked: on, onChange: () => this.deToggleHide(c.name) }), h('b', { className: 'mono' }, c.name), h('span', { className: 'lab' }, c.label || ''),
      h('span', { className: 'de-pill' }, m.treatAs === 'numeric' ? 'numbers' : 'groups'), h('span', { className: 'c' }, (c.valid > 0 ? this.fmtN(c.valid) + ' filled' : 'empty'))); });
    return this.tlPanel('Variables', hid.size ? hid.size + ' of ' + all.length + ' hidden' : 'which ones appear in the lists', h('span', { className: 'de-st' }, 'drop / keep varlist'),
      h('div', { className: 'tl-row' }, h('input', { className: 'tl-input', value: D.colsQ || '', placeholder: 'search ' + all.length + ' variables', 'aria-label': 'Search variables', style: { flex: '1 1 220px' }, onChange: e => this.deSet({ colsQ: e.target.value }) }),
        empty.length ? this.tlBtn('Hide empty (' + empty.length + ')', () => this.deHide(empty.map(c => c.name)), '', { title: 'Hide the variables with no values at all' }) : null,
        match.length && match.some(c => !hid.has(c.name)) && q ? this.tlBtn('Hide these ' + match.filter(c => !hid.has(c.name)).length, () => this.deHide(match.filter(c => !hid.has(c.name)).map(c => c.name))) : null,
        hid.size ? this.tlBtn('Show all', () => { this.setState({ hiddenVars: [] }); this.pushLog({ t: 'restorev', res: '' }); }) : null),
      h('div', { className: 'de-list', role: 'group', 'aria-label': 'Variables (ticked = shown)' }, rows),
      q ? h('span', { className: 'tl-hint' }, this.fmtN(match.length) + ' of ' + this.fmtN(all.length) + ' variables match.') : null,
      h('p', { className: 'tl-hint' }, 'Ticked variables appear in every list. Hidden ones stay in the data; Save data as CSV leaves them out unless you include them.'));
  }
  deHide(list) { const S = this.state, cur = S.hiddenVars || [], add = list.filter(v => !cur.includes(v)); if (!add.length) return; this.setState({ hiddenVars: [...cur, ...add] }); this.pushLog({ t: 'dropv', list: add, res: 'hidden from variable lists — data untouched, restore any time' }); }

  // Save as CSV: every row, or only the rows in use (as Stata's keep if would leave them); hidden variables out unless included
  deSaveCsv(withHidden, onlyRows) {
    this._dirty = false; this.setState({ dirty: false });
    const raw = this._raw, hid = new Set(withHidden ? [] : (this.state.hiddenVars || []).filter(v => raw.names.includes(v))), mk = onlyRows ? this.deMask() : null;
    const idx = raw.names.map((n, i) => i).filter(i => !hid.has(raw.names[i]));
    const q = s => /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const lines = [idx.map(i => q(raw.names[i])).join(',')]; let nOut = 0;
    for (let r = 0; r < raw.n; r++) { if (mk && !mk[r]) continue; nOut++; lines.push(idx.map(i => { const c = raw.cols[i], v = c.a[r]; return c.k === 'n' ? this.numberText(v) : q(String(v == null ? '' : v)); }).join(',')); }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (this.state.fileName || 'my-dataset').replace(/\.(csv|dta|tsv|txt|tab|xlsx|xlsm|xls|json)$/i, '').replace(/\.gm26$/i, '') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.setState({ undoMsg: 'Saved ' + a.download + ' · ' + this.fmtN(nOut) + ' rows' + (mk ? ' in use' : '') + ' × ' + idx.length + ' variables' + (hid.size ? ' (' + hid.size + ' hidden left out)' : '') });
    clearTimeout(this._umT); this._umT = setTimeout(() => this.setState({ undoMsg: '' }), 4000);
    this.deSet({ saveOpen: false });
  }
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
  deSetTreat(v, mode) { this.clearMemo(); this.setState(s => ({ treat: Object.assign({}, s.treat, { [v]: mode }), bcMsg: v + ' is now read as ' + (mode === 'numeric' ? 'numbers (averages, histograms)' : 'groups (counts, bar charts)'), bcErr: '' })); }
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
