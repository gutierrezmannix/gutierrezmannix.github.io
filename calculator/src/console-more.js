  // GM26 console more begin
  // Build .106: more of everyday Stata in the console. Macros (local, global, scalar) and display with text and
  // formats; loops (foreach, forvalues) typed line by line or in the do-file box; the prefixes quietly, capture,
  // noisily and by / bysort; housekeeping commands that change nothing here (set more off, log using …); and
  // inspection and statistics commands printed as Stata prints them: lookfor, ds, levelsof, isid, label list,
  // table, proportion, ci, spearman, sdtest, swilk, egen, encode, decode, xtile, return list, preserve / restore,
  // kdensity and graph pie. Statistics follow Stata's definitions (checked against R in tests/console-more.test.mjs).
  cqStore(k) { const key = '_cq' + k; if (!this[key]) this[key] = {}; return this[key]; }
  cqBraces(s) { let d = 0, q = false; for (const ch of String(s)) { if (ch === '"') q = !q; else if (!q && ch === '{') d++; else if (!q && ch === '}') d--; } return d; }
  // `name' (local), $name and ${name} (global; only names that are defined, so R's df$x is left alone)
  cqExpand(s) {
    const L = this.cqStore('L'), G = this.cqStore('G'); let out = String(s), k = 0;
    while (/`(\w+)'/.test(out) && k++ < 20) out = out.replace(/`(\w+)'/g, (m, n) => L[n] != null ? String(L[n]) : '');
    return out.replace(/\$\{(\w+)\}|\$([A-Za-z_]\w*)/g, (m, a, b) => { const n = a || b; return G[n] != null ? String(G[n]) : m; });
  }
  // numbers as Stata's display shows them (8 significant digits, no leading zero)
  cqNum(v) {
    if (typeof v !== 'number') return String(v); if (!Number.isFinite(v)) return '.';
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    let t = Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-5 && v !== 0) ? v.toExponential(7).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2') : String(+v.toPrecision(8));
    return t.replace(/^(-?)0\./, '$1.');
  }
  cqFmt(v, f) {
    const m = String(f || '').match(/^%(-)?(\d+)\.(\d+)([fgec])(c)?$/); if (!m || typeof v !== 'number') return this.cqNum(v);
    if (!Number.isFinite(v)) return '.'.padStart(+m[2]);
    const d = +m[3]; let t = m[4] === 'f' ? v.toFixed(d) : m[4] === 'e' ? v.toExponential(d) : this.cqNum(+v.toPrecision(Math.max(1, d || 8)));
    if (m[5]) t = t.replace(/^(-?\d+)/, x => Number(x).toLocaleString('en-US'));
    return m[1] ? t.padEnd(+m[2]) : t.padStart(+m[2]);
  }
  // normal, t, chi2 and F tails and their inverses (Stata's names), from the engine's distribution functions
  cqPhi(z) { const p = this._E.pZ(z) / 2; return z < 0 ? p : 1 - p; }
  cqInv(f, p, lo, hi, inc) { let a = lo, b = hi; for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if ((f(m) < p) === inc) a = m; else b = m; } return (a + b) / 2; }
  cqFn(name, x) {
    const E = this._E, n = name.toLowerCase(), A = x.length;
    const tt = (df, t) => { const p = E.pT(t, df) / 2; return t > 0 ? p : 1 - p; };
    const F = {
      normal: () => this.cqPhi(x[0]), invnormal: () => x[0] > 0 && x[0] < 1 ? this.cqInv(z => this.cqPhi(z), x[0], -40, 40, true) : NaN,
      ttail: () => tt(x[0], x[1]), invttail: () => x[1] > 0 && x[1] < 1 ? this.cqInv(t => tt(x[0], t), x[1], -1e4, 1e4, false) : NaN,
      chi2tail: () => x[1] <= 0 ? 1 : E.pChi2(x[1], x[0]), invchi2tail: () => this.cqInv(c => E.pChi2(c, x[0]), x[1], 0, 1e5, false),
      chi2: () => x[1] <= 0 ? 0 : 1 - E.pChi2(x[1], x[0]),
      ftail: () => E.pF(x[2], x[0], x[1]), invftail: () => this.cqInv(f => E.pF(f, x[0], x[1]), x[2], 0, 1e6, false),
      max: () => Math.max(...x.filter(Number.isFinite)), min: () => Math.min(...x.filter(Number.isFinite)),
      round: () => A > 1 ? Math.round(x[0] / x[1]) * x[1] : Math.round(x[0]), mod: () => x[0] - x[1] * Math.floor(x[0] / x[1]),
      comb: () => { let r = 1; for (let i = 1; i <= x[1]; i++) r = r * (x[0] - x[1] + i) / i; return Math.round(r); },
      floor: () => Math.floor(x[0]), ceil: () => Math.ceil(x[0]), int: () => Math.trunc(x[0]), trunc: () => Math.trunc(x[0]),
      logit: () => Math.log(x[0] / (1 - x[0])), invlogit: () => 1 / (1 + Math.exp(-x[0])), log10: () => Math.log10(x[0]),
      sqrt: () => Math.sqrt(x[0]), ln: () => Math.log(x[0]), log: () => Math.log(x[0]), exp: () => Math.exp(x[0]), abs: () => Math.abs(x[0]),
      missing: () => Number.isFinite(x[0]) ? 0 : 1, lnfactorial: () => { let s = 0; for (let i = 2; i <= x[0]; i++) s += Math.log(i); return s; },
    };
    return F[n] ? F[n]() : undefined;
  }
  // an expression: r(), e(), _b[], scalars and macros first, then Stata's functions, then arithmetic
  cqEval(ex) {
    let s = String(ex || '').trim(); if (!s) return { err: 'nothing to evaluate' };
    if (/^"[^"]*"$/.test(s)) return { str: s.slice(1, -1) };
    const R = this._cpR || {}, Sc = this.cqStore('S'), raw = this._raw;
    const num = v => '(' + (Number.isFinite(v) ? String(v) : 'NaN') + ')';
    s = s.replace(/\br\((\w+)\)/g, (m, k) => R[k] !== undefined ? num(R[k]) : num(NaN));
    s = s.replace(/\b_N\b/g, raw ? String(raw.n) : 'NaN').replace(/\b_rc\b/g, String(this._cqRc || 0)).replace(/\b_pi\b|\bc\(pi\)/g, String(Math.PI));
    s = s.replace(/\bc\(level\)/g, String(+(100 * (1 - (this.alpha ? this.alpha() : 0.05))).toFixed(2)));
    for (const k of Object.keys(Sc)) if (typeof Sc[k] === 'number') s = s.replace(new RegExp('(^|[^\\w.])' + k + '(?![\\w(])', 'g'), (m, a) => a + num(Sc[k]));
    // innermost functions with numeric arguments, until none are left
    for (let k = 0; k < 40; k++) {
      const m = s.match(/\b([A-Za-z]\w*)\(\s*((?:\(?-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\)?|NaN|\(NaN\))(?:\s*,\s*(?:\(?-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\)?|NaN|\(NaN\)))*)\s*\)/i);
      if (!m) break;
      const args = m[2].split(',').map(a => Number(a.replace(/[()\s]/g, ''))), v = this.cqFn(m[1], args);
      if (v === undefined) return { err: 'unknown function ' + m[1] + '()' };
      s = s.slice(0, m.index) + num(v) + s.slice(m.index + m[0].length);
    }
    if (/NaN/.test(s)) return { v: NaN };
    const E = this._E, p = E.parseFormula(s.replace(/\(\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*\)/gi, '($1)'), []);
    if (p.error) return { err: p.error.replace(/unknown variable/, 'not found:') };
    return { v: E.evalRPN(p.rpn, () => NaN) };
  }
  // display "text" exp %fmt exp _n _col(#)
  cqDisplay(rest) {
    let s = String(rest || ''), out = '', fmt = '', k = 0;
    while (s.trim() && k++ < 200) {
      s = s.replace(/^\s+/, ''); let m;
      if ((m = s.match(/^"([^"]*)"/)) || (m = s.match(/^`"(.*?)"'/))) { out += m[1]; s = s.slice(m[0].length); continue; }
      if ((m = s.match(/^%-?\d+\.\d+[fgec]c?/))) { fmt = m[0]; s = s.slice(m[0].length); continue; }
      if ((m = s.match(/^(_n|_newline)(?:\((\d+)\))?/))) { out += '\n'.repeat(m[2] ? +m[2] : 1); s = s.slice(m[0].length); continue; }
      if ((m = s.match(/^(_col|_column)\((\d+)\)/))) { const line = out.split('\n').pop(); out += ' '.repeat(Math.max(0, +m[2] - 1 - line.length)); s = s.slice(m[0].length); continue; }
      if ((m = s.match(/^_skip\((\d+)\)/))) { out += ' '.repeat(+m[1]); s = s.slice(m[0].length); continue; }
      // an expression runs to the next quote at depth 0
      let i = 0, d = 0; for (; i < s.length; i++) { const ch = s[i]; if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; else if (ch === '"' && d === 0) break; else if (ch === '%' && d === 0 && /^%-?\d+\.\d+[fgec]/.test(s.slice(i))) break; }
      const ex = s.slice(0, i).trim(); s = s.slice(i); if (!ex) continue;
      const r = this.cqEval(ex); if (r.err) return { err: r.err };
      out += r.str !== undefined ? r.str : fmt ? this.cqFmt(r.v, fmt) : this.cqNum(r.v); fmt = '';
    }
    return { text: out };
  }
  cqPrint(s, text, r) { this.pushLog({ t: 'stata', stata: s, r: r || '# (no R code for this)', tbl: text || '', res: '' }); }
  cqErr(s, msg, then) { this.cpNote(s, msg, 'err'); this._cqRc = 198; if (then) then(); return true; }
  // add a condition to a command's if (before its weight and options)
  cqAddIf(cmd, cond) {
    let i = 0, d = 0, q = false; for (; i < cmd.length; i++) { const ch = cmd[i]; if (ch === '"') q = !q; else if (q) continue; else if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; else if (ch === ',' && d === 0) break; }
    let head = cmd.slice(0, i), tail = cmd.slice(i), w = ''; const wm = head.match(/\[[^\]]*\]/); if (wm) { w = ' ' + wm[0]; head = head.replace(wm[0], ' ').replace(/\s+$/, ''); }
    head = /\sif\s/.test(head) ? head.replace(/\s+$/, '') + ' & ' + cond : head.replace(/\s+$/, '') + ' if ' + cond;
    return head + w + (tail ? tail : '');
  }
  cqValText(v, x) { if (x == null) return '.'; if (typeof x === 'number') { const l = this.vlabel(v, x); return l === String(x) ? this.cqNum(x) : l; } return String(x); }
  cqCondFor(v, x) { return x == null ? 'missing(' + v + ')' : typeof x === 'number' ? v + ' == ' + x : v + ' == "' + String(x).replace(/"/g, '') + '"'; }
  // the groups of a varlist among the rows in use, in Stata's sort order (missing last)
  cqGroups(vars, mk) {
    const raw = this._raw, cols = vars.map(v => raw.cols[raw.names.indexOf(v)]), keys = new Map();
    for (let i = 0; i < raw.n; i++) { if (mk && !mk[i]) continue; const vals = cols.map(c => { const x = c.a[i]; return x == null || x === '' || (typeof x === 'number' && !Number.isFinite(x)) ? null : x; }); const k = JSON.stringify(vals); if (!keys.has(k)) keys.set(k, vals); }
    const cmp = (a, b) => { for (let j = 0; j < a.length; j++) { const x = a[j], y = b[j]; if (x === y) continue; if (x == null) return 1; if (y == null) return -1; if (typeof x === 'number' && typeof y === 'number') return x - y; return String(x) < String(y) ? -1 : 1; } return 0; };
    return [...keys.values()].sort(cmp);
  }
  // ---- before the command reaches the parser: loops, macros, prefixes, housekeeping (the console page only)
  cqPre(s, then) {
    const fin = () => { if (then) then(); };
    if (this._cqLoop) {
      const L = this._cqLoop; L.lines.push(s); L.depth += this.cqBraces(s);
      if (L.depth <= 0) { this._cqLoop = null; this.setState({ cpLoopN: 0 }); this.cqLoopRun(L.lines, then); }
      else { this.setState({ cpLoopN: L.lines.length }); fin(); }
      return true;
    }
    if (/^(foreach|forvalues|forvalue|forvalu|forval|forva|forv|while)\b/i.test(s)) {
      if (!/\{\s*$/.test(s)) return this.cqErr(s, 'program error: open brace required — the loop body goes on the next lines, closed by } on a line of its own', then);
      this._cqLoop = { lines: [s], depth: this.cqBraces(s) }; this.setState({ cpLoopN: 1 }); fin(); return true;
    }
    if (/^\}\s*$/.test(s)) return this.cqErr(s, 'unexpected } — no loop is open', then);
    s = this.cqExpand(s); let m;
    if ((m = s.match(/^(local|loca|loc|global|globa|glob|glo|gl)\s+([A-Za-z_]\w*)\s*(=|:)?\s*([\s\S]*)$/i))) {
      const st = /^g/i.test(m[1]) ? this.cqStore('G') : this.cqStore('L'); let v = m[4];
      if (m[3] === '=') { const r = this.cqEval(v); if (r.err) return this.cqErr(s, r.err, then); v = r.str !== undefined ? r.str : this.cqNum(r.v); }
      else if (m[3] === ':') return this.cqErr(s, 'extended macro functions (local x : …) are not available here', then);
      else { const q = v.match(/^`?"([\s\S]*)"'?$/); if (q) v = q[1]; }
      st[m[2]] = v; this.cpNote(s, '', 'note'); fin(); return true;
    }
    if ((m = s.match(/^sca(?:l|la|lar)?\s+(?:def(?:i|in|ine)?\s+)?([A-Za-z_]\w*)\s*=\s*(.+)$/i))) {
      const r = this.cqEval(m[2]); if (r.err) return this.cqErr(s, r.err, then);
      this.cqStore('S')[m[1]] = r.str !== undefined ? r.str : r.v; this.cpNote(s, '', 'note'); fin(); return true;
    }
    if ((m = s.match(/^(sca(?:l|la|lar)?|ma(?:c|cr|cro)?)\s+(list|li|dir|drop)\b\s*(.*)$/i))) {
      const sc = /^s/i.test(m[1]), st = sc ? this.cqStore('S') : null, G = this.cqStore('G'), L = this.cqStore('L'), names = m[3].trim().split(/\s+/).filter(Boolean);
      if (/^drop$/i.test(m[2])) { const all = !names.length || names.includes('_all'); for (const o of sc ? [st] : [G, L]) for (const k of Object.keys(o)) if (all || names.includes(k) || names.includes('_' + k)) delete o[k]; this.cpNote(s, '', 'note'); fin(); return true; }
      const text = sc ? Object.keys(st).filter(k => !names.length || names.includes(k)).map(k => k.padStart(13) + ' = ' + (typeof st[k] === 'number' ? this.cqNum(st[k]).padStart(10) : st[k])).join('\n')
        : [...Object.keys(G).map(k => (k + ':').padEnd(16) + G[k]), ...Object.keys(L).map(k => ('_' + k + ':').padEnd(16) + L[k])].join('\n');
      this.cqPrint(s, text); fin(); return true;
    }
    if ((m = s.match(/^(di|dis|disp|displ|displa|display)(?:\s+([\s\S]*))?$/i))) {
      if (!m[2]) { this.cqPrint(s, ''); fin(); return true; }
      const r = this.cqDisplay(m[2]); if (r.err) return this.cqErr(s, r.err, then); this.cqPrint(s, r.text, 'cat(' + JSON.stringify(r.text) + ')'); fin(); return true;
    }
    if ((m = s.match(/^(quietly|quietl|quiet|quie|qui|capture|captur|captu|capt|cap|noisily|noisil|noisi|nois|noi)\s*:?\s+([\s\S]+)$/i))) {
      const kind = /^q/i.test(m[1]) ? 'q' : /^c/i.test(m[1]) ? 'c' : 'n'; let inner = m[2], noisy = false, mm;
      if (kind === 'n') return inner;
      if (kind === 'c' && (mm = inner.match(/^(noisily|noisil|noisi|nois|noi)\s*:?\s+([\s\S]+)$/i))) { noisy = true; inner = mm[2]; }
      const n0 = this.state.conLog.length, e0 = (this.state.cpErrs || []).length;
      this.cpRun(inner, () => {
        const S = this.state, base = (S.cpErrs || []).slice(0, e0), added = (S.cpErrs || []).slice(e0), errs = added.filter(e => e.kind === 'err');
        this._cqRc = errs.length ? 198 : 0;
        const echo = { at: n0, cmd: s, msg: '', kind: 'note', run: this._cpRunId, typed: this._cpRunText }, patch = {};
        if (kind === 'q') { patch.conLog = S.conLog.slice(0, n0); patch.cpErrs = [...base, echo, ...errs.map(e => Object.assign({}, e, { at: n0 }))]; }
        else if (!noisy) { patch.conLog = S.conLog.slice(0, n0); patch.cpErrs = [...base, echo]; }
        else patch.cpErrs = [...base, echo, ...added.filter(e => e.kind === 'err' || e.cmd === '')];
        this.setState(patch, fin);
      }, true);
      return true;
    }
    if ((m = s.match(/^(by|bys|byso|bysor|bysort)\s+([^:]+?)\s*:\s*([\s\S]+)$/i))) {
      const vs = m[2].replace(/\([^)]*\)/g, ' ').replace(/,\s*(sort|stable|rc0)\s*$/i, '').trim(), inner = m[3].trim();
      const L = this.cxVarlist(vs); if (L.bad.length) return this.cqErr(s, 'variable ' + L.bad[0] + ' not found', then); if (!L.vars.length) return this.cqErr(s, 'varlist required', then);
      if (/^egen\s/i.test(inner)) return inner + (/,/.test(inner) ? ' by(' + L.vars.join(' ') + ')' : ', by(' + L.vars.join(' ') + ')');
      if (/^(g|ge|gen|gene|gener|genera|generat|generate|replace)\s/i.test(inner)) return this.cqErr(s, 'by …: generate is not available here (it needs _n / _N within groups) — for group statistics use  egen newvar = mean(x), by(' + L.vars.join(' ') + ')', then);
      if (/^(by|bys|bysort|quietly|qui|capture|cap)\b/i.test(inner)) return this.cqErr(s, 'by … : ' + inner.split(/\s/)[0] + ' cannot be nested here', then);
      const groups = this.cqGroups(L.vars, this.mask()); if (groups.length > 60) return this.cqErr(s, 'by … : ' + groups.length + ' groups — too many to print one by one here (60 at most); use tabstat …, by() or table', then);
      this.cpNote(s, '', 'note'); let i = 0;
      const next = () => { if (i >= groups.length) return fin(); const g = groups[i++];
        this.cpNote('', '-'.repeat(78) + '\n-> ' + L.vars.map((v, j) => v + ' = ' + this.cqValText(v, g[j])).join(', '), 'note');
        this.cpRun(this.cqAddIf(inner, L.vars.map((v, j) => this.cqCondFor(v, g[j])).join(' & ')), () => setTimeout(next, 40), true); };
      next(); return true;
    }
    // housekeeping that changes nothing here
    if (/^set\s+(more|linesize|varabbrev|type|rmsg|trace|tracedepth|matsize|maxvar|scheme|graphics|output|showbaselevels|showemptycells|cformat|pformat|sformat|emptycells|fvlabel|dp|autotabgraphs|niceness|max_memory|segmentsize|charset|locale_ui)\b/i.test(s) || /^(version|vers)\s+[\d.]+\s*$/i.test(s) || /^(pause|discard|exit|timer\s+(clear|on|off)\b.*|program\s+drop\b.*|macro\s+shift|creturn\s+list|query\b.*)\s*$/i.test(s)) { this.cpNote(s, '', 'note'); fin(); return true; }
    if ((m = s.match(/^set\s+seed\s+(\d+)\s*$/i))) { this._cqSeed = +m[1]; this.cpNote(s, '', 'note'); fin(); return true; }
    if (/^(log|cmdlog)\s+(using|close|off|on|query)\b/i.test(s)) { this.cpNote(s, /close|off|query/i.test(s) ? '' : 'note: the console keeps the whole session — Save log (.log) and Save do-file (.do) above save it', 'note'); fin(); return true; }
    if (/^clear(\s+all)?\s*$/i.test(s)) return this.cqErr(s, 'clear would remove the data from the calculator — open another file with File ▸ Open, or use Clear above to clear the console', then);
    return s;
  }
  // foreach / forvalues: the body runs once per value, with the loop's local set; nested loops run when reached
  cqLoopRun(lines, then) {
    const fin = () => { if (then) then(); }, head = lines[0], body = lines.slice(1, -1), last = lines[lines.length - 1].replace(/\}\s*$/, '').trim();
    if (last) body.push(last);
    const echo = [head, ...body.map((l, i) => '  ' + (i + 2) + '. ' + l), '  ' + (body.length + 2) + '. }'].join('\n');
    let m, name, vals;
    try {
      if ((m = head.match(/^foreach\s+([A-Za-z_]\w*)\s+(in|of\s+(varlist|varl|newlist|newl|numlist|numl|local|loc|global|glo))\s+([\s\S]*?)\s*\{\s*$/i))) {
        name = m[1]; const how = (m[3] || 'in').toLowerCase(), list = this.cqExpand(m[4]).trim();
        if (how === 'in' || /^newl/.test(how)) vals = (list.match(/"[^"]*"|\S+/g) || []).map(x => x.replace(/^"|"$/g, ''));
        else if (/^varl/.test(how)) { const L = this.cxVarlist(list); if (L.bad.length) throw new Error('variable ' + L.bad[0] + ' not found'); vals = L.vars; }
        else if (/^numl/.test(how)) vals = this.cqNumlist(list);
        else { const st = /^loc/.test(how) ? this.cqStore('L') : this.cqStore('G'); vals = String(st[list] || '').match(/"[^"]*"|\S+/g) || []; vals = vals.map(x => x.replace(/^"|"$/g, '')); }
      } else if ((m = head.match(/^forv(?:a|al|alu|alue|alues)?\s+([A-Za-z_]\w*)\s*=\s*([\s\S]*?)\s*\{\s*$/i))) { name = m[1]; vals = this.cqNumlist(this.cqExpand(m[2]), true); }
      else if (/^while\b/i.test(head)) throw new Error('while loops are not available here — use foreach or forvalues');
      else throw new Error('could not read the loop: use  foreach v of varlist a b c {   or   forvalues i = 1/5 {');
    } catch (e) { this.cpNote(echo, e.message, 'err'); return fin(); }
    if (vals.length * Math.max(1, body.length) > 600) { this.cpNote(echo, 'this loop would run ' + vals.length * body.length + ' commands — 600 at most here', 'err'); return fin(); }
    this.cpNote(echo, '', 'note', lines.join('\n')); const L = this.cqStore('L'); let vi = 0;
    const iter = () => {
      if (vi >= vals.length) return fin(); L[name] = vals[vi++]; let li = 0;
      const step = () => { if (li >= body.length) return setTimeout(iter, 20); const l = body[li++]; if (!l.trim()) return step(); this.cpRun(l, () => setTimeout(step, 30), true); };
      step();
    };
    iter();
  }
  // an open loop is dropped (Esc in the command line, or a do-file that ends before its })
  cqLoopCancel(err) { const L = this._cqLoop; if (!L) return; this._cqLoop = null; this.setState({ cpLoopN: 0 }); this.cpNote(L.lines.join('\n'), err || '(loop cancelled — nothing ran)', err ? 'err' : 'note'); }
  cqNumlist(s, range) {
    const out = [], toks = String(s).trim().replace(/\s*\/\s*/g, '/').replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')').split(/\s+/).filter(Boolean);
    for (const t of toks) { let m;
      if ((m = t.match(/^(-?[\d.]+)\/(-?[\d.]+)$/))) { const a = +m[1], b = +m[2], st = a <= b ? 1 : -1; for (let x = a; st > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += st) out.push(+x.toFixed(10)); }
      else if ((m = t.match(/^(-?[\d.]+)\((-?[\d.]+)\)(-?[\d.]+)$/))) { const a = +m[1], d = +m[2], b = +m[3]; if (!d) throw new Error('invalid numlist'); for (let x = a; d > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += d) out.push(+x.toFixed(10)); }
      else if (/^-?[\d.]+$/.test(t)) out.push(+t); else throw new Error('invalid numlist: ' + t);
      if (out.length > 10000) throw new Error('numlist too long');
    }
    if (range && toks.length !== 1) throw new Error('forvalues takes one range: 1/5 or 1(2)9');
    return out.map(String);
  }
  // ---- commands read by the parser (console page and the command bar)
  cqRun(s) {
    const w0 = ((s.match(/^[a-z_]\w*/i) || [''])[0]).toLowerCase(), raw = this._raw;
    const known = /^(lookfor|lookf|ds|levelsof|levelso|levels|isid|label|lab|labe|table|proportion|proportio|proporti|proport|propor|propo|prop|ci|cii|spearman|spearma|spearm|spear|sdtest|swilk|egen|encode|decode|xtile|return|ereturn|preserve|restore|kdensity|kdens|graph|gr|order|sort|gsort|format|compress|notes|collapse|reshape|merge|append|qnorm|pnorm|set)$/;
    if (!known.test(w0) || /^[A-Za-z_][\w.]*\(/.test(s)) return false; // R calls (table(df$x)) are not Stata
    if (/^(label|lab|labe)$/.test(w0) && !/^\w+\s+(list|li|lis|dir)\b/i.test(s)) return false;
    if (/^(graph|gr)$/.test(w0) && !/^\w+\s+pie\b/i.test(s)) return false;
    if (w0 === 'set' && !/^set\s+obs\b/i.test(s)) return false;
    if (w0 === 'table' && /,/.test(s)) return false;
    const fail = msg => { this.setState({ mfCmdErr: msg, mfCmdOk: '' }); return true; };
    const ok = msg => { this.setState({ mfCmdErr: '', mfCmdOk: '✓ ' + (msg || s) }); return true; };
    try { return this.cqRunOne(s, w0, fail, ok); } catch (e) { return fail(String(e && e.message || e)); }
  }
  cqRunOne(s, w0, fail, ok) {
    const raw = this._raw, E = this._E, P = this.cxSplit(s), O = this.cxOpts(P.opt), T = P.toks, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v);
    const list = toks => { const L = this.cxVarlist(toks.join(' ')); if (L.bad.length) throw new Error('variable ' + L.bad[0] + ' not found'); return L.vars; };
    const maskOf = () => { let conds = []; if (P.ifs) { const r = this.stataConds(P.ifs); if (r.err) throw new Error(r.err); conds = r.conds; } return this.cxMaskFor(conds); };
    const say = (msg, okMsg) => { this.pushLog({ t: 'stata', stata: s, r: '# ' + w0 + ' changes nothing in R', tbl: msg || '', res: '' }); return ok(okMsg); };
    const meta = v => this.effMeta(v) || {}, rcode = v => 'df$' + (/^[A-Za-z.][\w.]*$/.test(v) ? v : '`' + v + '`');
    if (P.wt) return fail(w0 + ' runs unweighted here — drop [' + P.wt + '=' + P.wv + ']');
    switch (w0) {
      case 'lookfor': case 'lookf': {
        const terms = T.map(t => t.toLowerCase()); if (!terms.length) return fail('lookfor needs a word, e.g.  lookfor age');
        const hit = raw.names.filter((n, i) => terms.some(t => n.toLowerCase().includes(t) || String(raw.labels[i] || '').toLowerCase().includes(t)));
        this.cqPrint(s, hit.length ? this.cpDescribe({ vars: hit }) : '', 'grep(' + JSON.stringify(terms.join('|')) + ', c(names(df), sapply(df, function(v) attr(v, "label") %||% "")), ignore.case = TRUE, value = TRUE)'); return ok();
      }
      case 'ds': {
        let vars = T.length ? list(T) : raw.names.slice(); const has = String(O.has || '').toLowerCase(), not = String(O.not || '').toLowerCase();
        const isStr = v => raw.cols[raw.names.indexOf(v)].k !== 'n';
        if (/^type\s+str|^type\s+string/.test(has)) vars = vars.filter(isStr); else if (/^type\s+num/.test(has)) vars = vars.filter(v => !isStr(v)); else if (/^vall/.test(has)) vars = vars.filter(v => raw.vlabs && raw.vlabs[v] && raw.vlabs[v].size); else if (/^varl/.test(has)) vars = vars.filter(v => raw.labels[raw.names.indexOf(v)]);
        if (/^type\s+str/.test(not)) vars = vars.filter(v => !isStr(v)); else if (/^type\s+num/.test(not)) vars = vars.filter(isStr);
        const w = Math.min(32, Math.max(8, ...vars.map(v => v.length)) + 2), per = Math.max(1, Math.floor(78 / w)), rows = [];
        for (let i = 0; i < vars.length; i += per) rows.push(vars.slice(i, i + per).map(v => v.padEnd(w)).join('').replace(/\s+$/, ''));
        this._cpR = { varlist: vars.join(' ') }; this.cqPrint(s, rows.join('\n'), 'names(df)'); return ok();
      }
      case 'levelsof': case 'levelso': case 'levels': {
        if (T.length !== 1) return fail('levelsof takes one variable'); const v = list(T)[0], c = raw.cols[raw.names.indexOf(v)], mk = maskOf();
        const g = this.cqGroups([v], mk).map(x => x[0]).filter(x => x != null || O.missing);
        const txt = g.map(x => x == null ? '.' : typeof x === 'number' ? this.cqNum(x) : (/[\s"]/.test(String(x)) ? '`"' + x + '"\'' : String(x))).join(' ');
        const out = c.k === 'n' ? txt : g.map(x => '`"' + x + '"\'').join(' ');
        if (O.local) this.cqStore('L')[String(O.local).trim()] = c.k === 'n' ? txt : g.map(x => /\s/.test(x) ? '"' + x + '"' : x).join(' ');
        this._cpR = { levels: out, r: g.length }; this.cqPrint(s, O.local ? out : out, 'sort(unique(' + rcode(v) + '))'); return ok();
      }
      case 'isid': {
        const vars = list(T); if (!vars.length) return fail('isid needs a varlist'); const mk = maskOf(), seen = new Set(), cols = vars.map(v => raw.cols[raw.names.indexOf(v)]);
        for (let i = 0; i < raw.n; i++) { if (mk && !mk[i]) continue; const k = cols.map(c => { const x = c.a[i]; return x == null || (typeof x === 'number' && !Number.isFinite(x)) ? null : x; }); if (!O.missok && k.some(x => x == null)) return fail('variable' + (vars.length > 1 ? 's ' : ' ') + vars.join(' ') + ' should never be missing'); const key = JSON.stringify(k); if (seen.has(key)) return fail('variable' + (vars.length > 1 ? 's ' : ' ') + vars.join(' ') + (vars.length > 1 ? ' do' : ' does') + ' not uniquely identify the observations'); seen.add(key); }
        this.cqPrint(s, '', 'stopifnot(!anyDuplicated(df[c(' + vars.map(v => JSON.stringify(v)).join(', ') + ')]))'); return ok();
      }
      case 'label': case 'lab': case 'labe': {
        const names = T.slice(1).length ? list(T.slice(1)) : raw.names.filter(v => raw.vlabs && raw.vlabs[v] && raw.vlabs[v].size), out = [];
        if (/^dir$/i.test(T[0])) { this.cqPrint(s, names.join('\n')); return ok(); }
        for (const v of names) { const m = raw.vlabs && raw.vlabs[v]; if (!m || !m.size) continue; out.push(v + ':', ...[...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, l]) => R(this.cqNum(k), 12) + ' ' + l)); }
        this.cqPrint(s, out.join('\n'), names.length === 1 ? 'attr(' + rcode(names[0]) + ', "labels")' : '# value labels: attr(df$x, "labels")'); return ok();
      }
      case 'table': {
        if (T.length < 1 || T.length > 2) return fail('table takes one or two variables here (Stata 17: table rowvar colvar)'); const vars = list(T), mk = maskOf();
        this.cqPrint(s, this.cqTable(vars, mk), vars.length === 1 ? 'table(' + rcode(vars[0]) + ')' : 'addmargins(table(' + rcode(vars[0]) + ', ' + rcode(vars[1]) + '))'); return ok();
      }
      case 'proportion': case 'proportio': case 'proporti': case 'proport': case 'propor': case 'propo': case 'prop': {
        if (!T.length) return fail('proportion needs a variable'); const vars = list(T), mk = maskOf(), lv = this.cqLevel(O); if (lv.err) return fail(lv.err);
        this.cqPrint(s, this.cqProportion(vars, mk, lv.a), vars.map(v => 'prop.table(table(' + rcode(v) + '))').join('\n')); return ok();
      }
      case 'ci': case 'cii': return this.cqCi(s, w0, T, O, maskOf, list, fail, ok);
      case 'spearman': case 'spearma': case 'spearm': case 'spear': {
        const vars = list(T); if (vars.length !== 2) return fail('spearman takes two variables here'); const mk = maskOf(), a = this.cxNum(vars[0], mk), b = this.cxNum(vars[1], mk);
        if (!a || !b) return fail('spearman needs numeric variables'); const r = this.cqSpearman(a, b); if (r.n < 3) return fail('insufficient observations');
        this._cpR = { N: r.n, rho: r.rho, p: r.p };
        const tbl = [' Number of obs = ' + R(this.fmtN(r.n), 7), "Spearman's rho = " + R(r.rho.toFixed(4), 11), '', 'Test of H0: ' + vars[0] + ' and ' + vars[1] + ' are independent', '    Prob > |t| = ' + R(r.p.toFixed(4), 11)].join('\n');
        this.cqPrint(s, tbl, 'cor.test(' + rcode(vars[0]) + ', ' + rcode(vars[1]) + ', method = "spearman", exact = FALSE)'); return ok();
      }
      case 'sdtest': return this.cqSdtest(s, T, O, maskOf, list, fail, ok);
      case 'swilk': {
        const vars = list(T); if (!vars.length) return fail('swilk needs a variable'); const mk = maskOf(), rows = [], notes = [];
        for (const v of vars) { const a = this.cxNum(v, mk); if (!a) { notes.push(v + ' is text'); continue; } const x = Array.from(a).filter(Number.isFinite); const r = this.cqSwilk(x); if (r.err) { notes.push(v + ': ' + r.err); continue; } this._cpR = { N: r.n, W: r.w, V: r.v, z: r.z, p: r.p };
          rows.push(R(this.abbr(v, 12), 12) + ' |' + R(this.fmtN(r.n), 11) + R(r.w.toFixed(5), 10) + R(this.cqSig(r.v, 4), 11) + R(r.z.toFixed(3), 10) + R(r.p.toFixed(5), 11)); }
        const tbl = ['', '                   Shapiro–Wilk W test for normal data', '', '    Variable |        Obs       W           V         z       Prob>z', '-------------+------------------------------------------------------', ...rows, ...notes.map(n => 'note: ' + n)].join('\n');
        this.cqPrint(s, tbl, vars.map(v => 'shapiro.test(' + rcode(v) + ')').join('\n')); return ok();
      }
      case 'egen': return this.cqEgen(s, fail, ok);
      case 'encode': case 'decode': {
        if (T.length !== 1) return fail(w0 + ' takes one variable'); const v = list(T)[0], gen = String(O.generate || O.gen || O.g || '').trim(); if (!gen) return fail('option generate() required');
        if (!/^[A-Za-z_]\w{0,31}$/.test(gen)) return fail(gen + ' invalid name'); if (raw.names.includes(gen)) return fail('variable ' + gen + ' already defined');
        const i0 = raw.names.indexOf(v), c = raw.cols[i0], mk = maskOf();
        if (w0 === 'encode') {
          if (c.k === 'n') return fail(v + ': not a string variable (encode makes numbers from text)');
          const levels = [...new Set(Array.from(c.a).filter((x, i) => x != null && x !== '' && (!mk || mk[i])))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0), code = new Map(levels.map((l, j) => [l, j + 1]));
          const a = Float64Array.from(c.a, (x, i) => (!mk || mk[i]) && code.has(x) ? code.get(x) : NaN);
          raw.vlabs = raw.vlabs || {}; raw.vlabs[gen] = new Map(levels.map((l, j) => [j + 1, String(l)]));
          this.addDerivedCol(gen, { k: 'n', a }, raw.labels[i0] || '', 'gen'); this.clearMemo();
          this.pushLog({ t: 'stata', stata: s, r: rcode(gen).replace(/^df\$/, 'df$') + ' <- as.integer(factor(' + rcode(v) + '))', tbl: '', res: '' }); return ok(gen + ' created: ' + levels.length + ' levels, labelled');
        }
        if (c.k !== 'n') return fail(v + ': not a numeric variable (decode makes text from value labels)');
        const vl = raw.vlabs && raw.vlabs[v]; if (!vl || !vl.size) return fail(v + ' has no value label attached');
        const a = Array.from(c.a, (x, i) => (!mk || mk[i]) && Number.isFinite(x) && vl.has(x) ? vl.get(x) : '');
        this.addDerivedCol(gen, { k: 's', a }, raw.labels[i0] || '', 'gen'); this.clearMemo();
        this.pushLog({ t: 'stata', stata: s, r: rcode(gen) + ' <- as.character(haven::as_factor(' + rcode(v) + '))', tbl: '', res: '' }); return ok(gen + ' created as text');
      }
      case 'xtile': {
        const m = s.match(/^xtile\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)/i); if (!m) return fail('xtile: use  xtile newvar = var, nquantiles(4)');
        const gen = m[1], v = list([m[2]])[0]; if (raw.names.includes(gen)) return fail('variable ' + gen + ' already defined');
        const nq = O.nquantiles !== undefined ? Number(O.nquantiles) : O.nq !== undefined ? Number(O.nq) : O.n !== undefined ? Number(O.n) : 2; if (!(Number.isInteger(nq) && nq >= 2 && nq <= 1000)) return fail('nquantiles() takes a whole number of 2 or more');
        const mk = maskOf(), a = this.cxNum(v, mk); if (!a) return fail(v + ' is not numeric');
        const st = E.descNum(a, null); if (!st.n) return fail('no observations');
        const cut = Array.from({ length: nq - 1 }, (_, k) => this.cxPct(st, (k + 1) / nq));
        const out = Float64Array.from(a, x => { if (!Number.isFinite(x)) return NaN; let k = 0; while (k < cut.length && x > cut[k]) k++; return k + 1; });
        this.addDerivedCol(gen, { k: 'n', a: out }, nq + ' quantiles of ' + v, 'gen'); this.clearMemo();
        const miss = out.reduce((n, x) => n + (Number.isFinite(x) ? 0 : 1), 0);
        this.pushLog({ t: 'stata', stata: s, r: rcode(gen) + ' <- cut(' + rcode(v) + ', c(-Inf, quantile(' + rcode(v) + ', (1:' + (nq - 1) + ')/' + nq + ', type = 2, na.rm = TRUE), Inf), labels = FALSE)', tbl: miss ? '(' + this.fmtN(miss) + ' missing values generated)' : '', res: '' }); return ok();
      }
      case 'return': case 'ereturn': {
        if (!/^(list|li)$/i.test(T[0] || '')) return fail(w0 + ': use  ' + w0 + ' list');
        if (w0 === 'ereturn') { this.cqPrint(s, '', '# e(): keep the model object in R, e.g. m <- lm(…); summary(m)'); return ok('ereturn list: model results are shown on the Regression page'); }
        const r = this._cpR || {}, ks = Object.keys(r), sc = ks.filter(k => typeof r[k] === 'number'), mc = ks.filter(k => typeof r[k] !== 'number');
        const out = []; if (sc.length) out.push('', 'scalars:', ...sc.map(k => R('r(' + k + ')', 17) + ' =  ' + (Number.isFinite(r[k]) ? String(+r[k].toPrecision(15)) : '.'))); if (mc.length) out.push('', 'macros:', ...mc.map(k => R('r(' + k + ')', 17) + ' : "' + r[k] + '"'));
        this.cqPrint(s, out.join('\n'), '# r(): in R, keep the result object, e.g. s <- summary(x)'); return ok();
      }
      case 'preserve': {
        const S = this.state; this._cqKeep = { flt: S.flt, hiddenVars: (S.hiddenVars || []).slice(), subg: S.subg, names: raw.names.slice() };
        return say('', 'preserve: keep / drop since now can be undone with restore');
      }
      case 'restore': {
        const k = this._cqKeep; if (!k) return fail('nothing to restore');
        const patch = { hiddenVars: k.hiddenVars, subg: k.subg }; if (JSON.stringify(this.state.flt) !== JSON.stringify(k.flt)) patch.flt = k.flt;
        if (!O.preserve && !O.p) this._cqKeep = null;
        const added = raw.names.filter(n => !k.names.includes(n)); this.clearMemo(); this.setState(patch);
        return say(added.length ? 'note: the row filters and hidden variables are back as they were; variables created since (' + added.join(' ') + ') stay — drop them under Edit data if needed' : '', 'restored');
      }
      case 'kdensity': case 'kdens': {
        if (T.length !== 1) return fail('kdensity takes one variable'); const v = list(T)[0]; if (raw.cols[raw.names.indexOf(v)].k !== 'n') return fail(v + ' is not numeric');
        this.cpArm('typed'); this.setState({ tab: 'plots', plotKind: 'density', pX: v, pY: '', mfMobile: 'analysis', mfCmdErr: '', mfCmdOk: '✓ ' + s }); return true;
      }
      case 'graph': case 'gr': {
        const ov = O.over || T[1]; if (!ov) return fail('graph pie: use  graph pie, over(x)'); const v = list([String(ov).split(/[\s,]/)[0]])[0];
        this.cpArm('typed'); this.setState({ tab: 'plots', plotKind: 'pie', pX: v, pY: '', mfMobile: 'analysis', mfCmdErr: '', mfCmdOk: '✓ ' + s }); return true;
      }
      case 'set': {
        const m = s.match(/^set\s+obs\s+(\d[\d,]*)\s*$/i); if (!m) return fail('set obs: use  set obs 100');
        const N = Number(m[1].replace(/,/g, '')), n0 = raw.n;
        if (N < n0) return fail('obs was ' + this.fmtN(n0) + ', now ' + this.fmtN(N) + ' — set obs cannot drop observations; keep the ones you want with  keep if …');
        if (N * Math.max(1, raw.cols.length) > 4e6) return fail(this.fmtN(N) + ' observations × ' + raw.cols.length + ' variables is more than the browser can hold here (4 million cells)');
        if (N > n0) this.addRows(N - n0);
        this.pushLog({ t: 'stata', stata: s, r: N > n0 ? 'df[(nrow(df) + 1):' + N + ', ] <- NA' : '# nrow(df) is already ' + N, tbl: 'Number of observations (_N) was ' + this.fmtN(n0) + ', now ' + this.fmtN(N) + '.', res: '' });
        return ok('set obs ' + N);
      }
      case 'qnorm': case 'pnorm': return fail(w0 + ' (normal probability plot) is not drawn here — swilk ' + (T[0] || 'x') + ' tests normality, and histogram ' + (T[0] || 'x') + ', normal compares the shape');
      case 'order': { const vars = list(T); if (!vars.length) return fail('order needs a varlist'); return say('note: the calculator keeps the file\'s variable order; the console accepts order and changes nothing'); }
      case 'sort': case 'gsort': { list(T.map(t => t.replace(/^[+-]/, ''))); return say('note: row order does not change any result here; Browse shows the file\'s order'); }
      case 'format': { const fm = T[T.length - 1] || ''; if (!/^%/.test(fm)) return fail('format: use  format varlist %fmt'); list(T.slice(0, -1)); return say('note: the console prints numbers in Stata\'s default formats; display formats are not stored'); }
      case 'compress': return say('  (0 bytes saved)');
      case 'notes': return say('');
      case 'collapse': return fail('collapse would replace the data — use Univariate → Break down by groups for the same table, or Time series to collapse records into a series');
      case 'reshape': return fail('reshape: use Tests ▾ → Data management → Reshape long / wide, which saves the reshaped data as a new file');
      case 'merge': case 'append': return fail(w0 + ': the console cannot open other files — use Tests ▾ → Data management → ' + (w0 === 'merge' ? 'Merge' : 'Append') + ' and pick the second file there');
    }
    return false;
  }
  cqSig(v, d) { return Number.isFinite(v) ? (Math.abs(v) >= 1000 ? String(Math.round(v)) : String(+v.toPrecision(d))) : '.'; }
  cqLevel(O) { if (O.level === undefined) return { a: this.alpha ? this.alpha() : 0.05, lv: 100 * (1 - (this.alpha ? this.alpha() : 0.05)) }; const lv = Number(O.level); if (!(lv >= 10 && lv <= 99.99)) return { err: 'level() takes a confidence level between 10 and 99.99' }; return { a: 1 - lv / 100, lv }; }
  // Stata 17 table: frequencies, one or two variables, with totals
  cqTable(vars, mk) {
    const E = this._E, R = (x, n) => String(x).padStart(n), f = x => this.fmtN(x);
    if (vars.length === 1) {
      const v = vars[0], a = this.cxLab(v, mk), fr = E.freqOf(a, null), rows = this.descOrder(v, fr.rows), lw = Math.max(9, v.length, ...rows.map(r => String(r.label).length + 2), 7);
      const line = '-'.repeat(lw + 13);
      return [line, ' '.repeat(lw) + ' |  Frequency', '-'.repeat(lw + 1) + '+' + '-'.repeat(11), v.padEnd(lw) + ' |', ...rows.map(r => ('  ' + r.label).padEnd(lw) + ' |' + R(f(r.c), 11)), '  Total'.padEnd(lw) + ' |' + R(f(fr.totalW), 11), line].join('\n');
    }
    const [yv, xv] = vars, ya = this.cxLab(yv, mk), xa = this.cxLab(xv, mk), yl = this.descOrder(yv, E.freqOf(ya, null).rows).map(r => r.label), xl = this.descOrder(xv, E.freqOf(xa, null).rows).map(r => r.label);
    const cell = new Map(); let tot = 0; const rt = new Map(), ct = new Map();
    for (let i = 0; i < ya.length; i++) { const y = ya[i], x = xa[i]; if (y == null || x == null) continue; const k = y + '\u0001' + x; cell.set(k, (cell.get(k) || 0) + 1); rt.set(y, (rt.get(y) || 0) + 1); ct.set(x, (ct.get(x) || 0) + 1); tot++; }
    const lw = Math.max(9, yv.length, ...yl.map(l => String(l).length + 2)), cw = Math.max(9, ...xl.map(l => String(l).length + 1), 6), cols = [...xl, 'Total'];
    const width = lw + 2 + cols.length * (cw + 1), line = '-'.repeat(width);
    const head2 = ' '.repeat(lw) + ' |' + cols.map(c => R(String(c).slice(0, cw), cw + 1)).join('');
    const head1 = ' '.repeat(lw) + ' |' + R(xv, Math.min(width - lw - 2, Math.floor((cols.length * (cw + 1) + xv.length) / 2)));
    const body = yl.map(y => ('  ' + y).padEnd(lw) + ' |' + xl.map(x => R(cell.get(y + '\u0001' + x) ? f(cell.get(y + '\u0001' + x)) : '', cw + 1)).join('') + R(f(rt.get(y) || 0), cw + 1));
    const totRow = '  Total'.padEnd(lw) + ' |' + xl.map(x => R(f(ct.get(x) || 0), cw + 1)).join('') + R(f(tot), cw + 1);
    return [line, head1, head2, '-'.repeat(lw + 1) + '+' + '-'.repeat(width - lw - 2), yv.padEnd(lw) + ' |', ...body, totRow, line].join('\n');
  }
  // proportion: SE = sqrt(p(1-p)/(n-1)), logit-transformed CI with t(n-1), as Stata's proportion
  cqProportion(vars, mk, alpha) {
    const E = this._E, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v), out = [];
    let n = Infinity; const labs = vars.map(v => this.cxLab(v, mk));
    // casewise deletion across the varlist, as Stata
    const use = []; for (let i = 0; i < (labs[0] || []).length; i++) if (labs.every(a => a[i] != null)) use.push(i); n = use.length;
    if (!n) return 'no observations';
    const t = E.critInv(alpha, n - 1), lw = 12;
    out.push('Proportion estimation' + ' '.repeat(22) + 'Number of obs = ' + R(this.fmtN(n), 7), '', '-'.repeat(62), ' '.repeat(13) + '|' + ' '.repeat(35) + 'Logit', ' '.repeat(13) + '| Proportion   Std. err.     [' + +(100 * (1 - alpha)).toFixed(2) + '% conf. interval]', '-------------+' + '-'.repeat(48));
    vars.forEach((v, j) => {
      const cnt = new Map(); for (const i of use) { const l = labs[j][i]; cnt.set(l, (cnt.get(l) || 0) + 1); }
      const rows = this.descOrder(v, [...cnt.entries()].map(([label, c]) => ({ label, c })));
      out.push(R(this.abbr(v, lw), lw) + ' |');
      for (const r of rows) { const p = r.c / n, se = Math.sqrt(p * (1 - p) / (n - 1)); let lo = 0, hi = 1;
        if (p > 0 && p < 1) { const l = Math.log(p / (1 - p)), sl = se / (p * (1 - p)); lo = 1 / (1 + Math.exp(-(l - t * sl))); hi = 1 / (1 + Math.exp(-(l + t * sl))); }
        out.push(R(this.abbr(String(r.label), lw), lw) + ' |' + R(G(p), 11) + R(G(se), 12) + R(G(lo), 14) + R(G(hi), 12)); }
    });
    out.push('-'.repeat(62)); return out.join('\n');
  }
  cqCi(s, w0, T, O, maskOf, list, fail, ok) {
    const E = this._E, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v), lv = this.cqLevel(O); if (lv.err) return fail(lv.err);
    let kind = 'means', toks = T; if (T[0] && /^(mean|means|prop|propo|propor|proport|proporti|proportio|proportion|proportions|var|vari|varia|varian|varianc|variance|variances|pois|poiss|poisso|poisson)$/i.test(T[0])) { kind = /^m/i.test(T[0]) ? 'means' : /^p(r|$)/i.test(T[0]) && !/^pois/i.test(T[0]) ? 'props' : /^v/i.test(T[0]) ? 'vars' : 'pois'; toks = T.slice(1); }
    if (O.binomial || O.b) kind = 'props';
    if (w0 === 'cii') return this.cqCii(s, kind, toks, O, lv, fail, ok);
    if (kind === 'vars' || kind === 'pois') return fail('ci ' + T[0] + ' is not available here — use ci means or ci proportions');
    const vars = list(toks); if (!vars.length) return fail('ci needs a variable'); const mk = maskOf(), rows = [], lvl = +lv.lv.toFixed(2);
    const head = kind === 'props' ? [' '.repeat(57) + (O.wald ? '-- Wald ---' : O.wilson ? '-- Wilson --' : O.agresti ? '-- Agresti–Coull --' : O.jeffreys ? '-- Jeffreys --' : '-- Binomial exact --'), '    Variable |        Obs  Proportion    Std. err.       [' + lvl + '% conf. interval]'] : ['    Variable |        Obs        Mean    Std. err.       [' + lvl + '% conf. interval]'];
    for (const v of vars) {
      const a = this.cxNum(v, mk); if (!a) { rows.push(R(this.abbr(v, 12), 12) + ' |' + R(0, 11)); continue; }
      const x = Array.from(a).filter(Number.isFinite), n = x.length; if (!n) { rows.push(R(this.abbr(v, 12), 12) + ' |' + R(0, 11)); continue; }
      if (kind === 'means') { const st = E.descNum(Float64Array.from(x), null), se = st.sd / Math.sqrt(n), t = n > 1 ? E.critInv(lv.a, n - 1) : NaN; this._cpR = { N: n, mean: st.mean, se, lb: st.mean - t * se, ub: st.mean + t * se, level: lvl };
        rows.push(R(this.abbr(v, 12), 12) + ' |' + R(this.fmtN(n), 11) + R(G(st.mean), 12) + R(G(se), 12) + R(G(st.mean - t * se), 15) + R(G(st.mean + t * se), 11)); }
      else { if (x.some(z => z !== 0 && z !== 1)) return fail(v + ' is not a 0/1 variable'); const k = x.reduce((u, z) => u + z, 0), r = this.cqPropCi(k, n, lv.a, O); this._cpR = { N: n, proportion: k / n, se: Math.sqrt(k / n * (1 - k / n) / n), lb: r[0], ub: r[1], level: lvl };
        rows.push(R(this.abbr(v, 12), 12) + ' |' + R(this.fmtN(n), 11) + R(G(k / n), 12) + R(G(Math.sqrt(k / n * (1 - k / n) / n)), 12) + R(G(r[0]), 15) + R(G(r[1]), 11) + (r[2] ? r[2] : '')); }
    }
    const tbl = [...head, '-------------+---------------------------------------------------------------', ...rows].join('\n');
    this.cqPrint(s, tbl, kind === 'means' ? vars.map(v => 't.test(df$' + v + ', conf.level = ' + (1 - lv.a) + ')$conf.int').join('\n') : vars.map(v => 'binom.test(sum(df$' + v + ', na.rm = TRUE), sum(!is.na(df$' + v + ')), conf.level = ' + (1 - lv.a) + ')$conf.int').join('\n')); return ok();
  }
  cqCii(s, kind, toks, O, lv, fail, ok) {
    const E = this._E, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v), x = toks.map(Number), lvl = +lv.lv.toFixed(2); if (x.some(v => !Number.isFinite(v))) return fail('cii takes numbers');
    if (kind === 'means') { if (x.length !== 3) return fail('cii means #obs #mean #sd'); const [n, m, sd] = x, se = sd / Math.sqrt(n), t = E.critInv(lv.a, n - 1);
      this.cqPrint(s, ['    Variable |        Obs        Mean    Std. err.       [' + lvl + '% conf. interval]', '-------------+---------------------------------------------------------------', '             |' + R(this.fmtN(n), 11) + R(G(m), 12) + R(G(se), 12) + R(G(m - t * se), 15) + R(G(m + t * se), 11)].join('\n'), 'm <- ' + m + '; s <- ' + sd + '; n <- ' + n + '\nm + c(-1, 1) * qt(' + (1 - lv.a / 2) + ', n - 1) * s / sqrt(n)'); return ok(); }
    if (kind === 'props') { if (x.length !== 2) return fail('cii proportions #obs #successes'); const [n, k] = x; if (!(Number.isInteger(n) && Number.isInteger(k) && k >= 0 && k <= n && n > 0)) return fail('#successes must be a whole number from 0 to #obs'); const r = this.cqPropCi(k, n, lv.a, O);
      this.cqPrint(s, [' '.repeat(57) + (O.wald ? '-- Wald ---' : O.wilson ? '-- Wilson --' : O.agresti ? '-- Agresti–Coull --' : O.jeffreys ? '-- Jeffreys --' : '-- Binomial exact --'), '    Variable |        Obs  Proportion    Std. err.       [' + lvl + '% conf. interval]', '-------------+---------------------------------------------------------------', '             |' + R(this.fmtN(n), 11) + R(G(k / n), 12) + R(G(Math.sqrt(k / n * (1 - k / n) / n)), 12) + R(G(r[0]), 15) + R(G(r[1]), 11) + (r[2] || '')].join('\n'), 'binom.test(' + k + ', ' + n + ', conf.level = ' + (1 - lv.a) + ')$conf.int'); return ok(); }
    return fail('cii: use  cii means #obs #mean #sd   or   cii proportions #obs #successes');
  }
  // proportion intervals: exact (Clopper–Pearson, Stata's default), Wald, Wilson, Agresti–Coull, Jeffreys
  cqPropCi(k, n, a, O) {
    const p = k / n, z = this.cqInv(t => this.cqPhi(t), 1 - a / 2, -40, 40, true);
    if (O.wald) { const se = Math.sqrt(p * (1 - p) / n); return [p - z * se, p + z * se]; }
    if (O.wilson) { const d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }
    if (O.agresti) { const nn = n + z * z, pp = (k + z * z / 2) / nn, h = z * Math.sqrt(pp * (1 - pp) / nn); return [pp - h, pp + h]; }
    const qb = (q, A, B) => this.cqInv(x => this.cqBetai(A, B, x), q, 0, 1, true);
    if (O.jeffreys) return [k === 0 ? 0 : qb(a / 2, k + 0.5, n - k + 0.5), k === n ? 1 : qb(1 - a / 2, k + 0.5, n - k + 0.5)];
    const lo = k === 0 ? 0 : qb(a / 2, k, n - k + 1), hi = k === n ? 1 : qb(1 - a / 2, k + 1, n - k);
    return [lo, hi, k === 0 || k === n ? '*' : ''];
  }
  // the regularized incomplete beta I_x(A, B) from the engine's F tail: I_x(A, B) = Ftail(2B, 2A, A(1-x)/(Bx))
  cqBetai(A, B, x) { if (x <= 0) return 0; if (x >= 1) return 1; return this._E.pF(A * (1 - x) / (B * x), 2 * B, 2 * A); }
  cqSpearman(a, b) {
    const xs = [], ys = []; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && Number.isFinite(b[i])) { xs.push(a[i]); ys.push(b[i]); }
    const rank = v => { const idx = v.map((x, i) => i).sort((i, j) => v[i] - v[j]), r = new Array(v.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; };
    const n = xs.length; if (n < 3) return { n };
    const rx = rank(xs), ry = rank(ys), mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = rx[i] - mx, dy = ry[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    const rho = sxy / Math.sqrt(sxx * syy), t = rho * Math.sqrt((n - 2) / Math.max(1e-300, 1 - rho * rho)), p = Math.abs(rho) >= 1 ? 0 : this._E.pT(t, n - 2);
    return { n, rho, p };
  }
  cqSdtest(s, T, O, maskOf, list, fail, ok) {
    const E = this._E, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v), lv = this.cqLevel(O); if (lv.err) return fail(lv.err); const mk = maskOf(), lvl = +lv.lv.toFixed(2);
    const stat = (x, lab) => { const st = E.descNum(Float64Array.from(x), null), n = st.n, se = st.sd / Math.sqrt(n), t = E.critInv(lv.a, n - 1); return { n, sd: st.sd, line: R(this.abbr(String(lab), 8), 8) + ' |' + R(this.fmtN(n), 8) + R(G(st.mean), 12) + R(G(se), 12) + R(G(st.sd), 12) + R(G(st.mean - t * se), 12) + R(G(st.mean + t * se), 12) }; };
    const head = (w) => ['', w, '-'.repeat(78), (w === 'One-sample test of variance' ? 'Variable' : '   Group') + ' |     Obs        Mean    Std. err.   Std. dev.   [' + lvl + '% conf. interval]', '---------+' + '-'.repeat(68)];
    const tails = (lo, hi) => [lo, hi, 2 * Math.min(lo, hi)];
    const joined = T.join(' '); let m;
    if ((m = joined.match(/^(\S+)\s*==\s*(-?[\d.]+)$/))) {
      const v = list([m[1]])[0], sd0 = Number(m[2]), a = this.cxNum(v, mk); if (!a) return fail(v + ' is not numeric'); const x = Array.from(a).filter(Number.isFinite); if (x.length < 2) return fail('insufficient observations'); if (!(sd0 > 0)) return fail('the hypothesized standard deviation must be positive');
      const A = stat(x, v), df = A.n - 1, c = df * A.sd * A.sd / (sd0 * sd0), up = E.pChi2(c, df), [lo, hi, two] = tails(1 - up, up);
      this._cpR = { N: A.n, sd: A.sd, chi2: c, df, p_l: lo, p_u: hi, p: Math.min(1, two) };
      this.cqPrint(s, [...head('One-sample test of variance'), A.line, '-'.repeat(78), '    sd = sd(' + v + ')' + ' '.repeat(Math.max(1, 42 - v.length)) + 'c = chi2 = ' + R(c.toFixed(4), 8), 'H0: sd = ' + this.cqNum(sd0) + ' '.repeat(Math.max(1, 39 - this.cqNum(sd0).length)) + 'Degrees of freedom = ' + R(df, 8), '', '    Ha: sd < ' + this.cqNum(sd0) + '                 Ha: sd != ' + this.cqNum(sd0) + '                   Ha: sd > ' + this.cqNum(sd0), ' Pr(C < c) = ' + lo.toFixed(4) + '         2*(C < c) = ' + Math.min(1, two).toFixed(4) + '           Pr(C > c) = ' + hi.toFixed(4)].join('\n'), 'var.test is two-sample; one sample: pchisq((n - 1) * var(x) / ' + sd0 + '^2, n - 1)'); return ok();
    }
    let g1, g2, l1, l2, v;
    if (O.by) { if (T.length !== 1) return fail('sdtest: use  sdtest y, by(group)'); v = list(T)[0]; const gv = list([O.by])[0], a = this.cxNum(v, mk); if (!a) return fail(v + ' is not numeric'); const groups = this.cqGroups([gv], mk).filter(x => x[0] != null); if (groups.length !== 2) return fail(groups.length > 2 ? 'more than 2 groups found, only 2 allowed' : 'only one group found'); const col = this._raw.cols[this._raw.names.indexOf(gv)].a;
      [g1, g2] = groups.map(gg => { const out = []; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && col[i] === gg[0]) out.push(a[i]); return out; }); [l1, l2] = groups.map(gg => this.cqValText(gv, gg[0])); }
    else if ((m = joined.match(/^(\S+)\s*==\s*(\S+)$/))) { const [x1, x2] = list([m[1], m[2]]), a = this.cxNum(x1, mk), b = this.cxNum(x2, mk); if (!a || !b) return fail('sdtest needs numeric variables'); g1 = Array.from(a).filter(Number.isFinite); g2 = Array.from(b).filter(Number.isFinite); l1 = x1; l2 = x2; }
    else return fail('sdtest: use  sdtest y, by(group)   or   sdtest y == #   or   sdtest y1 == y2');
    if (g1.length < 2 || g2.length < 2) return fail('insufficient observations');
    const A = stat(g1, l1), B = stat(g2, l2), C = stat(g1.concat(g2), 'Combined'), f = (A.sd * A.sd) / (B.sd * B.sd), d1 = A.n - 1, d2 = B.n - 1, up = E.pF(f, d1, d2), [lo, hi, two] = tails(1 - up, up);
    this._cpR = { N_1: A.n, N_2: B.n, sd_1: A.sd, sd_2: B.sd, F: f, df_1: d1, df_2: d2, p_l: lo, p_u: hi, p: Math.min(1, two) };
    const ratio = O.by ? 'ratio = sd(' + l1 + ') / sd(' + l2 + ')' : 'ratio = sd(' + l1 + ') / sd(' + l2 + ')';
    this.cqPrint(s, [...head('Variance ratio test'), A.line, B.line, '---------+' + '-'.repeat(68), C.line, '-'.repeat(78), '    ' + ratio + ' '.repeat(Math.max(1, 62 - ratio.length)) + 'f = ' + R(f.toFixed(4), 8), 'H0: ratio = 1' + ' '.repeat(35) + 'Degrees of freedom = ' + R(d1 + ', ' + d2, 8), '', '    Ha: ratio < 1               Ha: ratio != 1                 Ha: ratio > 1', '  Pr(F < f) = ' + lo.toFixed(4) + '         2*Pr(F > f) = ' + Math.min(1, two).toFixed(4) + '           Pr(F > f) = ' + hi.toFixed(4)].join('\n'),
      O.by ? 'var.test(' + v + ' ~ ' + O.by + ', data = df)' : 'var.test(df$' + l1 + ', df$' + l2 + ')'); return ok();
  }
  // Shapiro–Wilk W (Royston 1992, as Stata's swilk and R's shapiro.test); V = (1 − W) relative to its median under normality
  cqSwilk(x) {
    const n = x.length; if (n < 4) return { err: 'needs at least 4 observations' }; if (n > 5000) return { err: 'more than 5,000 observations — too many for the Shapiro–Wilk approximation (Stata suggests sfrancia)' };
    x = x.slice().sort((a, b) => a - b); if (x[n - 1] - x[0] < 1e-19) return { err: 'all values are identical' };
    const poly = (c, v) => { let r = 0; for (let i = c.length - 1; i >= 0; i--) r = r * v + c[i]; return r; };
    const qn = p => this.cqInv(z => this.cqPhi(z), p, -40, 40, true), nn2 = Math.floor(n / 2), a = new Array(nn2 + 1).fill(0);
    const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
    const m = [0]; let summ2 = 0; for (let i = 1; i <= nn2; i++) { m[i] = qn((i - 0.375) / (n + 0.25)); summ2 += m[i] * m[i]; }
    summ2 *= 2; const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n), a1 = poly(c1, rsn) - m[1] / ssumm2; let i1, fac;
    if (n > 5) { i1 = 3; const a2 = -m[2] / ssumm2 + poly(c2, rsn); fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2)); a[2] = a2; }
    else { i1 = 2; fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1)); }
    a[1] = a1; for (let i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
    const mean = x.reduce((s, v) => s + v, 0) / n; let ss = 0; for (const v of x) ss += (v - mean) * (v - mean);
    let num = 0; for (let i = 1; i <= nn2; i++) num += a[i] * (x[n - i] - x[i - 1]);
    let w = num * num / ss; if (w > 1) w = 1;
    const y0 = Math.log(1 - w), ln = Math.log(n); let mu, sg, y = y0;
    if (n <= 11) { const gamma = poly([-2.273, 0.459], n); if (y >= gamma) return { n, w, v: NaN, z: Infinity, p: 1e-99 }; y = -Math.log(gamma - y); mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n); sg = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n)); }
    else { mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln); sg = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln)); }
    const z = (y - mu) / sg, p = 1 - this.cqPhi(z);
    return { n, w, v: Math.exp(y - mu), z, p };
  }
  // egen newvar = fcn(arguments) [if] [, by(varlist)]
  cqEgen(s, fail, ok) {
    const raw = this._raw, E = this._E;
    const m = s.match(/^egen\s+(?:(byte|int|long|float|double|str\d*)\s+)?([A-Za-z_]\w*)\s*=\s*([A-Za-z]\w*)\(([^)]*)\)\s*(?:if\s+([^,]+?))?\s*(?:,\s*(.*))?$/i);
    if (!m) return fail('egen: use  egen newvar = mean(x), by(group)   (mean sd sum total min max median count rank std pctile iqr group tag rowmean rowtotal rowmin rowmax rowmiss rownonmiss rowsd)');
    const gen = m[2], fn = m[3].toLowerCase(), arg = m[4].trim(), ifs = (m[5] || '').trim(), O = this.cxOpts(m[6] || '');
    if (!/^[A-Za-z_]\w{0,31}$/.test(gen)) return fail(gen + ' invalid name'); if (raw.names.includes(gen)) return fail('variable ' + gen + ' already defined');
    let conds = []; if (ifs) { const r = this.stataConds(ifs); if (r.err) return fail(r.err); conds = r.conds; }
    const mk = this.cxMaskFor(conds), n = raw.n, use = i => !mk || mk[i];
    const byL = O.by ? this.cxVarlist(String(O.by)) : { vars: [], bad: [] }; if (byL.bad.length) return fail('variable ' + byL.bad[0] + ' not found');
    const vl = t => { const L = this.cxVarlist(t); if (L.bad.length) throw new Error('variable ' + L.bad[0] + ' not found'); return L.vars; };
    // the argument: a variable or an expression of numeric variables
    const valsOf = ex => { const L = this.cxVarlist(ex); if (!L.bad.length && L.vars.length === 1) { const a = this.cxNum(L.vars[0], null); if (!a) throw new Error(L.vars[0] + ' is not numeric'); return a; } const r = this.evalExprAll(ex); if (r.error) throw new Error(r.error); return r.a; };
    // group index of each row (by() variables; one group without by())
    let gi = new Int32Array(n), ng = 1;
    if (byL.vars.length) { const cols = byL.vars.map(v => raw.cols[raw.names.indexOf(v)].a), map = new Map(); for (let i = 0; i < n; i++) { const k = JSON.stringify(cols.map(c => { const x = c[i]; return x == null || (typeof x === 'number' && !Number.isFinite(x)) ? null : x; })); if (!map.has(k)) map.set(k, map.size); gi[i] = map.get(k); } ng = map.size; }
    const out = new Float64Array(n).fill(NaN); let rcode = '';
    const perGroup = (a, f) => { const bins = Array.from({ length: ng }, () => []); for (let i = 0; i < n; i++) if (use(i) && Number.isFinite(a[i])) bins[gi[i]].push(a[i]); const val = bins.map(b => f(b)); for (let i = 0; i < n; i++) if (use(i)) out[i] = val[gi[i]]; };
    const pct = (b, p) => { if (!b.length) return NaN; const st = E.descNum(Float64Array.from(b), null); return this.cxPct(st, p); };
    const mean = b => b.length ? b.reduce((s, v) => s + v, 0) / b.length : NaN, sd = b => { if (b.length < 2) return NaN; const mu = mean(b); return Math.sqrt(b.reduce((s, v) => s + (v - mu) * (v - mu), 0) / (b.length - 1)); };
    const R = 'df$' + gen + ' <- ', by = byL.vars.length ? ', ' + (byL.vars.length === 1 ? 'df$' + byL.vars[0] : 'interaction(' + byL.vars.map(v => 'df$' + v).join(', ') + ')') : '';
    try {
      if (['mean', 'sd', 'sum', 'total', 'min', 'max', 'median', 'count', 'pctile', 'iqr', 'std', 'rank', 'mode', 'kurt', 'skew', 'mad', 'mdev'].includes(fn)) {
        if (!arg) return fail(fn + '() needs an argument'); const a = valsOf(arg);
        if (fn === 'mean') perGroup(a, mean); else if (fn === 'sd') perGroup(a, sd); else if (fn === 'sum' || fn === 'total') perGroup(a, b => b.reduce((s, v) => s + v, 0));
        else if (fn === 'min') perGroup(a, b => b.length ? Math.min(...b) : NaN); else if (fn === 'max') perGroup(a, b => b.length ? Math.max(...b) : NaN);
        else if (fn === 'median') perGroup(a, b => pct(b, 0.5)); else if (fn === 'count') perGroup(a, b => b.length);
        else if (fn === 'pctile') { const p = O.p !== undefined ? Number(O.p) : 50; if (!(p > 0 && p < 100)) return fail('p() takes a number between 0 and 100'); perGroup(a, b => pct(b, p / 100)); }
        else if (fn === 'iqr') perGroup(a, b => pct(b, 0.75) - pct(b, 0.25));
        else if (fn === 'std') { const mu = new Float64Array(ng), sdv = new Float64Array(ng), bins = Array.from({ length: ng }, () => []); for (let i = 0; i < n; i++) if (use(i) && Number.isFinite(a[i])) bins[gi[i]].push(a[i]); bins.forEach((b, k) => { mu[k] = mean(b); sdv[k] = sd(b); }); const M = O.mean !== undefined ? Number(O.mean) : 0, S = O.sd !== undefined ? Number(O.sd) : O.std !== undefined ? Number(O.std) : 1; for (let i = 0; i < n; i++) if (use(i) && Number.isFinite(a[i])) out[i] = M + S * (a[i] - mu[gi[i]]) / sdv[gi[i]]; }
        else if (fn === 'rank') { const bins = Array.from({ length: ng }, () => []); for (let i = 0; i < n; i++) if (use(i) && Number.isFinite(a[i])) bins[gi[i]].push(i); for (const b of bins) { const idx = b.slice().sort((p, q) => O.field ? a[q] - a[p] : a[p] - a[q]); for (let k = 0; k < idx.length;) { let j = k; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[k]]) j++; const r = O.field || O.track ? k + 1 : O.unique ? null : (k + j) / 2 + 1; for (let q = k; q <= j; q++) out[idx[q]] = r === null ? q + 1 : r; k = j + 1; } } }
        else return fail('egen ' + fn + '() is not available here');
        rcode = fn === 'rank' ? R + 'ave(df$' + arg + by + ', FUN = rank)' : fn === 'std' ? R + 'ave(df$' + arg + by + ', FUN = function(v) (v - mean(v, na.rm = TRUE)) / sd(v, na.rm = TRUE))' : R + 'ave(df$' + arg + by + ', FUN = function(v) ' + ({ mean: 'mean', sd: 'sd', sum: 'sum', total: 'sum', min: 'min', max: 'max', median: 'median', count: 'length', iqr: 'IQR' }[fn] === 'length' ? 'sum(!is.na(v))' : ({ mean: 'mean', sd: 'sd', sum: 'sum', total: 'sum', min: 'min', max: 'max', median: 'median', iqr: 'IQR' }[fn] || 'quantile') + '(v, na.rm = TRUE)') + ')';
        if (fn === 'count') { for (let i = 0; i < n; i++) if (use(i) && !Number.isFinite(out[i])) out[i] = 0; }
      } else if (fn === 'group' || fn === 'tag') {
        const vars = vl(arg); if (!vars.length) return fail(fn + '() needs a varlist'); const cols = vars.map(v => raw.cols[raw.names.indexOf(v)].a), key = i => cols.map(c => { const x = c[i]; return x == null || (typeof x === 'number' && !Number.isFinite(x)) ? null : x; });
        if (fn === 'group') { const groups = this.cqGroups(vars, mk), idx = new Map(groups.map((g, k) => [JSON.stringify(g), k + 1])); for (let i = 0; i < n; i++) { if (!use(i)) continue; const k = key(i); if (!O.missing && k.some(x => x == null)) continue; out[i] = idx.get(JSON.stringify(k)); } rcode = R + 'as.integer(interaction(' + vars.map(v => 'df$' + v).join(', ') + ', drop = TRUE, lex.order = TRUE))'; }
        else { const seen = new Set(); for (let i = 0; i < n; i++) { if (!use(i)) continue; const k = JSON.stringify(key(i)); out[i] = seen.has(k) ? 0 : 1; seen.add(k); } rcode = R + 'as.integer(!duplicated(df[c(' + vars.map(v => JSON.stringify(v)).join(', ') + ')]))'; }
      } else if (/^row(mean|total|min|max|miss|nonmiss|sd)$/.test(fn)) {
        const vars = vl(arg); if (!vars.length) return fail(fn + '() needs a varlist'); const cols = vars.map(v => { const a = this.cxNum(v, null); if (!a && !/miss/.test(fn)) throw new Error(v + ' is not numeric'); return a || Float64Array.from(raw.cols[raw.names.indexOf(v)].a, x => x == null || x === '' ? NaN : 0); });
        for (let i = 0; i < n; i++) { if (!use(i)) continue; const v = cols.map(c => c[i]).filter(Number.isFinite), k = v.length;
          out[i] = fn === 'rowmean' ? (k ? v.reduce((s, x) => s + x, 0) / k : NaN) : fn === 'rowtotal' ? v.reduce((s, x) => s + x, 0) : fn === 'rowmin' ? (k ? Math.min(...v) : NaN) : fn === 'rowmax' ? (k ? Math.max(...v) : NaN) : fn === 'rowmiss' ? cols.length - k : fn === 'rownonmiss' ? k : sd(v); }
        rcode = R + ({ rowmean: 'rowMeans', rowtotal: 'rowSums', rowmin: 'apply', rowmax: 'apply', rowmiss: 'rowSums(is.na', rownonmiss: 'rowSums(!is.na', rowsd: 'apply' }[fn]) + '(df[c(' + vars.map(v => JSON.stringify(v)).join(', ') + ')]' + (/miss/.test(fn) ? '))' : /min|max|sd/.test(fn) ? ', 1, ' + fn.slice(3) + ', na.rm = TRUE)' : ', na.rm = TRUE)');
      } else return fail('egen ' + fn + '() is not available here — mean sd sum total min max median count rank std pctile iqr group tag rowmean rowtotal rowmin rowmax rowmiss rownonmiss rowsd');
    } catch (e) { return fail(String(e.message || e)); }
    this.addDerivedCol(gen, { k: 'n', a: out }, '', 'gen'); this.clearMemo();
    const miss = out.reduce((k, x) => k + (Number.isFinite(x) ? 0 : 1), 0);
    this.pushLog({ t: 'stata', stata: s, r: rcode, tbl: miss ? '(' + this.fmtN(miss) + ' missing value' + (miss === 1 ? '' : 's') + ' generated)' : '', res: '' });
    return ok(gen + ' created');
  }
  // ---- build .111: ranksum, signrank, kwallis, prtest and bitest computed and printed as Stata does. Stata's
  // normal approximations carry no continuity correction (R's wilcox.test default does), and signrank keeps the zero
  // differences in the ranking with their own variance adjustment, as Stata documents.
  cqRank(xs) {
    const idx = xs.map((_, i) => i).sort((i, j) => xs[i] - xs[j]), r = new Array(xs.length); let ties = 0;
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++; const t = j - i + 1, avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; ties += t * t * t - t; i = j + 1; }
    return { r, ties };
  }
  cqTests(body, v0, fail) {
    const raw = this._raw, P = this.cxSplit(body), O = this.cxOpts(P.opt), T = P.toks, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v);
    let conds = []; if (P.ifs) { const r = this.stataConds(P.ifs); if (r.err) return fail(r.err); conds = r.conds; }
    const mk = this.cxMaskFor(conds), V = t => this.cpVar(t), num = v => { const a = this.cxNum(v, mk); if (!a) throw new Error(v + ' is not numeric'); return a; };
    const sum = a => a.reduce((s, v) => s + v, 0), pz = z => 2 * (1 - this.cqPhi(Math.abs(z))), p4 = x => x.toFixed(4);
    const lab = (g, x) => typeof x === 'string' ? g + '=="' + x + '"' : g + '==' + this.cqNum(x);
    const print = (tbl, r) => { this.pushLog({ t: 'stata', stata: body, r, tbl, res: '' }); this.setState({ mfCmdOk: '✓ ' + v0 }); return true; };
    const varLines = rows => rows.map(([l, v]) => l.padEnd(19) + R(v.toFixed(2), 11));
    const twoGroups = (gv, a) => { const gc = raw.cols[raw.names.indexOf(gv)].a, groups = this.cqGroups([gv], mk).filter(x => x[0] != null && !(typeof x[0] === 'number' && !Number.isFinite(x[0]))), out = [[], []];
      if (groups.length !== 2) throw new Error(groups.length > 2 ? 'more than 2 groups found, only 2 allowed' : 'only one group found');
      for (let i = 0; i < raw.n; i++) { if (!Number.isFinite(a[i])) continue; const j = gc[i] === groups[0][0] ? 0 : gc[i] === groups[1][0] ? 1 : -1; if (j >= 0) out[j].push(a[i]); }
      return { groups: groups.map(x => x[0]), out }; };
    if (v0 === 'ranksum') {
      if (T.length !== 1 || !O.by) return fail('ranksum: use  ranksum y, by(group)');
      const y = V(T[0]), g = V(O.by), { groups, out } = twoGroups(g, num(y)), xs = [...out[0], ...out[1]], n1 = out[0].length, n2 = out[1].length, n = n1 + n2;
      if (!n1 || !n2) return fail('insufficient observations');
      const { r, ties } = this.cqRank(xs), T1 = sum(r.slice(0, n1)), T2 = n * (n + 1) / 2 - T1, E1 = n1 * (n + 1) / 2, E2 = n2 * (n + 1) / 2;
      const vu = n1 * n2 * (n + 1) / 12, adj = n > 1 ? -n1 * n2 * ties / (12 * n * (n - 1)) : 0, va = vu + adj, z = (T1 - E1) / Math.sqrt(va), p = pz(z);
      this._cpR = { N_1: n1, N_2: n2, z, Var_a: va, sum_obs: T1, sum_exp: E1, p };
      const gl = x => this.abbr(this.cqValText(g, x), 12);
      return print(['', 'Two-sample Wilcoxon rank-sum (Mann–Whitney) test', '', R(this.abbr(g, 12), 12) + ' |      Obs    Rank sum    Expected', '-------------+---------------------------------',
        R(gl(groups[0]), 12) + ' |' + R(this.fmtN(n1), 9) + R(G(T1), 12) + R(G(E1), 12), R(gl(groups[1]), 12) + ' |' + R(this.fmtN(n2), 9) + R(G(T2), 12) + R(G(E2), 12), '-------------+---------------------------------',
        R('Combined', 12) + ' |' + R(this.fmtN(n), 9) + R(G(T1 + T2), 12) + R(G(E1 + E2), 12), '', ...varLines([['Unadjusted variance', vu], ['Adjustment for ties', adj]]), ' '.repeat(22) + '----------', ...varLines([['Adjusted variance', va]]), '',
        'H0: ' + y + '(' + lab(g, groups[0]) + ') = ' + y + '(' + lab(g, groups[1]) + ')', '         z = ' + z.toFixed(3), 'Prob > |z| = ' + p4(p)].join('\n'),
        'wilcox.test(' + y + ' ~ ' + g + ', data = df, exact = FALSE, correct = FALSE)  # Stata: no continuity correction');
    }
    if (v0 === 'signrank') {
      const mm = T.join(' ').match(/^(\S+)\s*=\s*(\S+)$/); if (!mm) return fail('signrank: use  signrank before = after   or   signrank y = #');
      const a = num(V(mm[1])), isC = /^-?(\d+\.?\d*|\.\d+)$/.test(mm[2]), b = isC ? null : num(V(mm[2])), c = isC ? Number(mm[2]) : 0, d = [];
      for (let i = 0; i < raw.n; i++) { const x = a[i], w = isC ? c : b[i]; if (Number.isFinite(x) && Number.isFinite(w)) d.push(x - w); }
      const n = d.length; if (!n) return fail('no observations');
      const { r } = this.cqRank(d.map(Math.abs)), nz = d.filter(x => x !== 0), { ties } = this.cqRank(nz.map(Math.abs));
      let sp = 0, sn = 0, s0 = 0, np = 0, nn = 0, n0 = 0; d.forEach((x, i) => { if (x > 0) { sp += r[i]; np++; } else if (x < 0) { sn += r[i]; nn++; } else { s0 += r[i]; n0++; } });
      const tot = n * (n + 1) / 2, E = (tot - s0) / 2, vu = n * (n + 1) * (2 * n + 1) / 24, ta = -ties / 48, za = -n0 * (n0 + 1) * (2 * n0 + 1) / 24, va = vu + ta + za, z = va > 0 ? (sp - E) / Math.sqrt(va) : NaN, p = pz(z);
      this._cpR = { N_pos: np, N_neg: nn, N_tie: n0, sum_pos: sp, sum_neg: sn, z, Var_a: va, p };
      const row = (l, k, s, e) => R(l, 12) + ' |' + R(this.fmtN(k), 9) + R(G(s), 12) + R(G(e), 12);
      return print(['', 'Wilcoxon signed-rank test', '', '        Sign |      Obs   Sum ranks    Expected', '-------------+---------------------------------', row('Positive', np, sp, E), row('Negative', nn, sn, E), row('Zero', n0, s0, s0), '-------------+---------------------------------', row('All', n, tot, tot), '',
        ...varLines([['Unadjusted variance', vu], ['Adjustment for ties', ta], ['Adjustment for zeros', za]]), ' '.repeat(22) + '----------', ...varLines([['Adjusted variance', va]]), '', 'H0: ' + mm[1] + ' = ' + mm[2], '         z = ' + z.toFixed(3), 'Prob > |z| = ' + p4(p)].join('\n'),
        isC ? 'wilcox.test(df$' + mm[1] + ', mu = ' + c + ', exact = FALSE, correct = FALSE)' : 'wilcox.test(df$' + mm[1] + ', df$' + mm[2] + ', paired = TRUE, exact = FALSE, correct = FALSE)  # R drops zero differences; Stata keeps them');
    }
    if (v0 === 'kwallis') {
      if (T.length !== 1 || !O.by) return fail('kwallis: use  kwallis y, by(group)');
      const y = V(T[0]), g = V(O.by), a = num(y), gc = raw.cols[raw.names.indexOf(g)].a, groups = this.cqGroups([g], mk).filter(x => x[0] != null), xs = [], gi = [];
      for (let i = 0; i < raw.n; i++) { if (!Number.isFinite(a[i])) continue; const j = groups.findIndex(x => x[0] === gc[i]); if (j >= 0) { xs.push(a[i]); gi.push(j); } }
      const n = xs.length, k = groups.length; if (k < 2) return fail('only one group found');
      const { r, ties } = this.cqRank(xs), Rs = new Array(k).fill(0), ns = new Array(k).fill(0); r.forEach((v, i) => { Rs[gi[i]] += v; ns[gi[i]]++; });
      const H = 12 / (n * (n + 1)) * Rs.reduce((s, v, j) => s + v * v / ns[j], 0) - 3 * (n + 1), Ht = H / (1 - ties / (n * n * n - n)), df = k - 1, E = this._E;
      const p = E.pChi2(H, df), pt = E.pChi2(Ht, df);
      this._cpR = { df, chi2: H, chi2_adj: Ht };
      const labs = groups.map(x => this.abbr(this.cqValText(g, x[0]), 20)), w1 = Math.max(g.length, ...labs.map(l => l.length)), w2 = Math.max(3, ...ns.map(v => this.fmtN(v).length)), w3 = Math.max(8, ...Rs.map(v => v.toFixed(2).length));
      const line = '  +' + '-'.repeat(w1 + 2) + '-' + '-'.repeat(w2 + 2) + '-' + '-'.repeat(w3 + 2) + '+', mid = '  |' + '-'.repeat(w1 + 2) + '+' + '-'.repeat(w2 + 2) + '+' + '-'.repeat(w3 + 2) + '|';
      return print(['', 'Kruskal–Wallis equality-of-populations rank test', '', line, '  | ' + R(g, w1) + ' | ' + R('Obs', w2) + ' | ' + R('Rank sum', w3) + ' |', mid, ...labs.map((l, j) => '  | ' + R(l, w1) + ' | ' + R(this.fmtN(ns[j]), w2) + ' | ' + R(Rs[j].toFixed(2), w3) + ' |'), line, '',
        'chi2(' + df + ') = ' + R(H.toFixed(3), 9), 'Prob = ' + R(p4(p), 11), '', 'chi2(' + df + ') with ties = ' + R(Ht.toFixed(3), 9), 'Prob = ' + R(p4(pt), 11)].join('\n'),
        'kruskal.test(' + y + ' ~ ' + g + ', data = df)  # = the "with ties" line');
    }
    const lv = this.cqLevel(O); if (lv.err) return fail(lv.err); const z0 = this.cqInv(t => this.cqPhi(t), 1 - lv.a / 2, -40, 40, true), lvl = +lv.lv.toFixed(2);
    const tails = (z, l) => ['', l[0], ' Pr(Z < z) = ' + p4(this.cqPhi(z)) + '         Pr(|Z| > |z|) = ' + p4(pz(z)) + '          Pr(Z > z) = ' + p4(1 - this.cqPhi(z))];
    if (v0 === 'prtest') {
      if (O.by) {
        if (T.length !== 1) return fail('prtest: use  prtest y, by(group)'); const y = V(T[0]), g = V(O.by), { groups, out } = twoGroups(g, num(y));
        if (out.some(x => x.some(v => v !== 0 && v !== 1))) return fail(y + ' is not a 0/1 variable');
        const [a1, a2] = out, n1 = a1.length, n2 = a2.length, p1 = sum(a1) / n1, p2 = sum(a2) / n2, d = p1 - p2, pp = (sum(a1) + sum(a2)) / (n1 + n2);
        const s1 = Math.sqrt(p1 * (1 - p1) / n1), s2 = Math.sqrt(p2 * (1 - p2) / n2), sd = Math.sqrt(s1 * s1 + s2 * s2), s0 = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)), z = d / s0;
        this._cpR = { N_1: n1, N_2: n2, P_1: p1, P_2: p2, z, p: pz(z) };
        const l1 = this.cqValText(g, groups[0]), l2 = this.cqValText(g, groups[1]), row = (l, m, s) => R(this.abbr(l, 12), 12) + ' |' + R(G(m), 11) + R(G(s), 11) + ' '.repeat(22) + R(G(m - z0 * s), 11) + R(G(m + z0 * s), 12);
        return print(['', 'Two-sample test of proportions' + R(this.abbr(l1, 12) + ': Number of obs = ' + R(this.fmtN(n1), 8), 48), R(this.abbr(l2, 12) + ': Number of obs = ' + R(this.fmtN(n2), 8), 78), '-'.repeat(78),
          '       Group |       Mean   Std. err.      z    P>|z|     [' + lvl + '% conf. interval]', '-------------+' + '-'.repeat(64), row(l1, p1, s1), row(l2, p2, s2), '-------------+' + '-'.repeat(64), row('diff', d, sd),
          '             |  under H0:' + R(G(s0), 11) + R(z.toFixed(2), 8) + R(pz(z).toFixed(3), 8), '-'.repeat(78), '        diff = prop(' + l1 + ') - prop(' + l2 + ')' + R('z = ' + R(z.toFixed(4), 8), Math.max(12, 74 - 23 - l1.length - l2.length)), '    H0: diff = 0', '',
          '    Ha: diff < 0                 Ha: diff != 0                 Ha: diff > 0', ...tails(z, ['']).slice(2)].join('\n'), 'prop.test(table(df$' + g + ', df$' + y + ')[, 2:1], correct = FALSE)');
      }
      const mm = T.join(' ').match(/^(\S+)\s*==\s*(\d*\.?\d+)$/); if (!mm) return fail('prtest: use  prtest y == 0.5   or   prtest y, by(group)');
      const y = V(mm[1]), p0 = Number(mm[2]); if (!(p0 > 0 && p0 < 1)) return fail('the hypothesized proportion must be between 0 and 1');
      const x = Array.from(num(y)).filter(Number.isFinite); if (x.some(v => v !== 0 && v !== 1)) return fail(y + ' is not a 0/1 variable'); const n = x.length; if (!n) return fail('no observations');
      const ph = sum(x) / n, se = Math.sqrt(ph * (1 - ph) / n), z = (ph - p0) / Math.sqrt(p0 * (1 - p0) / n);
      this._cpR = { N: n, P: ph, z, p: pz(z) };
      return print(['', 'One-sample test of proportion' + R('Number of obs      = ' + R(this.fmtN(n), 9), 49), '-'.repeat(78), '    Variable |       Mean   Std. err.                     [' + lvl + '% conf. interval]', '-------------+' + '-'.repeat(64),
        R(this.abbr(y, 12), 12) + ' |' + R(G(ph), 11) + R(G(se), 11) + ' '.repeat(22) + R(G(ph - z0 * se), 11) + R(G(ph + z0 * se), 12), '-'.repeat(78), '    p = proportion(' + y + ')' + R('z = ' + R(z.toFixed(4), 8), 61 - y.length), 'H0: p = ' + this.cqNum(p0), '',
        '     Ha: p < ' + this.cqNum(p0) + '                 Ha: p != ' + this.cqNum(p0) + '                   Ha: p > ' + this.cqNum(p0), ...tails(z, ['']).slice(2)].join('\n'), 'prop.test(sum(df$' + y + ', na.rm = TRUE), sum(!is.na(df$' + y + ')), p = ' + p0 + ', correct = FALSE)');
    }
    if (v0 === 'bitest') {
      const mm = T.join(' ').match(/^(\S+)\s*==\s*(\d*\.?\d+)$/); if (!mm) return fail('bitest: use  bitest y == 0.5');
      const y = V(mm[1]), p0 = Number(mm[2]); if (!(p0 > 0 && p0 < 1)) return fail('the hypothesized probability must be between 0 and 1');
      const x = Array.from(num(y)).filter(Number.isFinite); if (x.some(v => v !== 0 && v !== 1)) return fail(y + ' is not a 0/1 variable'); const n = x.length, k = sum(x); if (!n) return fail('no observations');
      const r = this.cqBinom(n, k, p0); this._cpR = { N: n, k, p_l: r.lo, p_u: r.hi, p: r.two };
      const L = ['', '    Variable |        N   Observed k   Expected k   Assumed p   Observed p', '-------------+------------------------------------------------------------',
        R(this.abbr(y, 12), 12) + ' |' + R(this.fmtN(n), 9) + R(k, 13) + R(this.cqNum(+(n * p0).toFixed(2)), 13) + R(p0.toFixed(5), 12) + R((k / n).toFixed(5), 13), '',
        ('  Pr(k >= ' + k + ')').padEnd(26) + '= ' + r.hi.toFixed(6) + '  (one-sided test)', ('  Pr(k <= ' + k + ')').padEnd(26) + '= ' + r.lo.toFixed(6) + '  (one-sided test)', ('  ' + r.label).padEnd(26) + '= ' + r.two.toFixed(6) + '  (two-sided test)'];
      return print(L.join('\n'), 'binom.test(sum(df$' + y + ', na.rm = TRUE), sum(!is.na(df$' + y + ')), p = ' + p0 + ')');
    }
    return false;
  }
  // build .111: a weight that came from a typed svyset applies to svy: commands only, as in Stata; other analyses run
  // unweighted (the weight comes back with the next command). A weight chosen in Settings still applies everywhere.
  cqSvyScope(text) {
    if (this._cqSvyRerun) { this._cqSvyRerun = false; return false; }
    const S = this.state, s = String(text || '').trim().replace(/^[.>]\s*/, '');
    if (!S.weightVar || S.weightVar !== this._svysetW || /^svy/i.test(s)) return false;
    if (!/^(su|sum|summ|summa|summar|summari|summariz|summarize|mean|ta|tab|tabu|tabul|tabula|tabulat|tabulate|tab1|tab2|tabstat|table|pwcorr|cor|corr|correlate|ttest|oneway|anova|regress|reg|logit|logistic|ologit|oprobit|poisson|histogram|hist|graph|gr|scatter|twoway|tw|line|kdensity|ci|proportion|prop|spearman|sdtest|swilk)\b|^(summary|table|lm|glm|aov|t\.test|cor\.test|cor|hist|plot|boxplot|barplot)\s*\(/i.test(s)) return false;
    this._cxW = { prev: S.weightVar, prevAuto: S.weightAuto, val: '' }; this.clearMemo(); this._cxQuiet = true;
    this.setState({ weightVar: '', weightAuto: false }, () => { this._cxQuiet = false; this._cqSvyRerun = true; try { this.runCmdLine(text); } finally { this._cqSvyRerun = false; } });
    return true;
  }
  // margins as Stata prints them (predictive margins with delta-method standard errors), from the Regression page's result
  cqMarginsText(mg, want) {
    const S = this.state, R = (x, n) => String(x).padStart(n), G = v => this.stataG(v), fam = mg.family, ols = fam === 'ols';
    const lvl = +(100 * (1 - (this.alpha ? this.alpha() : 0.05))).toFixed(2), st = ols ? 't' : 'z';
    const expr = ols ? 'Linear prediction, predict()' : fam === 'poisson' ? 'Predicted number of events, predict()' : 'Pr(' + S.depVar + '), predict()';
    const vce = S.regVce === 'svy' ? 'Linearized' : S.regVce === 'robust' || S.regVce === 'cluster' ? 'Robust' : ols ? 'OLS' : 'OIM';
    const row = (lab, q) => R(this.abbr(String(lab), 12), 12) + ' |' + R(G(q.y), 11) + R(G(q.se), 11) + R(Number.isFinite(q.t) ? q.t.toFixed(2) : '.', 9) + R(Number.isFinite(q.p) ? q.p.toFixed(3) : '.', 8) + R(G(q.lo), 13) + R(G(q.hi), 12);
    const out = ['Predictive margins'.padEnd(54) + 'Number of obs = ' + R(this.fmtN(mg.n), 8), 'Model VCE: ' + vce, '', 'Expression: ' + expr];
    const body = [];
    if (mg.xCat) {
      body.push(R(this.abbr(want.by ? want.x + '#' + want.by : want.x, 12), 12) + ' |');
      for (const s of mg.series) for (const q of s.pts) body.push(row(want.by ? q.x + '#' + s.label : q.x, q));
    } else {
      const legend = []; let k = 0;
      for (const s of mg.series) for (const q of s.pts) { k++; legend.push(R(k + '._at: ', 9) + want.x + ' = ' + G(q.x) + (want.by ? ', ' + want.by + ' = ' + s.label : '')); body.push(row(k, q)); }
      out.push('', ...legend); body.unshift(R('_at', 12) + ' |');
    }
    if (mg.sampled) out.push('', 'note: averaged over a random sample of ' + this.fmtN(mg.sampN) + ' rows (large data)');
    return [...out, '', '-'.repeat(78), '             |            Delta-method', '             |     Margin   std. err.      ' + st + '    P>|' + st + '|     [' + lvl + '% conf. interval]', '-------------+' + '-'.repeat(64), ...body, '-'.repeat(78)].join('\n');
  }
  // binomial tails; the two-sided p sums every outcome no more likely than the one observed (as Stata and R)
  cqBinom(n, k, p) {
    const lf = new Float64Array(n + 1); for (let i = 2; i <= n; i++) lf[i] = lf[i - 1] + Math.log(i);
    const pm = new Float64Array(n + 1); for (let i = 0; i <= n; i++) pm[i] = Math.exp(lf[n] - lf[i] - lf[n - i] + i * Math.log(p) + (n - i) * Math.log(1 - p));
    let lo = 0, hi = 0; for (let i = 0; i <= n; i++) { if (i <= k) lo += pm[i]; if (i >= k) hi += pm[i]; }
    const d = pm[k] * (1 + 1e-7), m = n * p; let two = 0, other = null;
    for (let i = 0; i <= n; i++) if (pm[i] <= d) two += pm[i];
    if (k >= m) { for (let i = 0; i < m; i++) if (pm[i] <= d) other = i; } else { for (let i = n; i > m; i--) if (pm[i] <= d) other = i; }
    const label = other == null ? (k >= m ? 'Pr(k >= ' + k + ')' : 'Pr(k <= ' + k + ')') : k >= m ? 'Pr(k <= ' + other + ' or k >= ' + k + ')' : 'Pr(k <= ' + k + ' or k >= ' + other + ')';
    return { lo: Math.min(1, lo), hi: Math.min(1, hi), two: Math.min(1, two), label };
  }
  // GM26 console more end
