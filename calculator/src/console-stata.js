  // GM26 console commands begin
  // Console commands that print what Stata (or R) prints for the same command line (build .55).
  // - An `if` typed after a command applies to that command only. Commands that open a page set the Subgroup bar
  //   while they run; the next typed command puts back the Subgroup the user had (cxScopeIf). The Subgroup bar set
  //   with the mouse still applies to every command, as everywhere else on the page.
  // - summarize / mean / tabstat / correlate / pwcorr / tab1 / tab2 with several variables or options, and the
  //   pooled-variance t-test, are computed here and printed in Stata's layout (console entries of type "cx").
  // - tabulate with two variables opens the crosstab page and prints Stata's table with the options typed
  //   (frequencies by default; row, column, cell, chi2, V).
  // level(#) / conf.level on a t-test applies to that command only too: the next command puts back the confidence
  // level the user had (Settings, or  set level). Neither is restored when the user changed it in between.
  cxScopeIf(text) {
    const k = this._cxIf, lv = this._cxLevel, patch = {}; this._cxIf = null; this._cxLevel = null; this._cxPending = null;
    if (k && JSON.stringify((this.state.subg && this.state.subg.all) || []) === k.sig) patch.subg = k.prev;
    if (lv && String(this.state.alphaSel) === lv.val) patch.alphaSel = lv.prev;
    if (!Object.keys(patch).length) return false;
    this.clearMemo(); this._cxQuiet = true;
    this.setState(patch, () => { this._cxQuiet = false; this.runCmdLine(text); });
    return true;
  }
  cxBareNumeric(name) { const raw = this._raw, i = raw ? raw.names.indexOf(name) : -1; return i >= 0 && raw.cols[i].k === 'n'; }
  // Stata varlists: names (any case), x*, x?, a-b (a range in dataset order) and _all.
  cxVarlist(str) {
    const raw = this._raw, out = [], bad = [];
    const V = n => raw.names.find(x => x.toLowerCase() === String(n || '').toLowerCase()) || null;
    for (const tk of String(str || '').trim().split(/\s+/).filter(Boolean)) {
      if (tk === '_all' || tk === '*') { out.push(...raw.names); continue; }
      if (/[*?]/.test(tk)) { const re = new RegExp('^' + tk.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); const hit = raw.names.filter(n => re.test(n)); if (hit.length) out.push(...hit); else bad.push(tk); continue; }
      if (/^\w+-\w+$/.test(tk) && !V(tk)) { const [a, b] = tk.split('-').map(V), ia = raw.names.indexOf(a), ib = raw.names.indexOf(b); if (ia >= 0 && ib >= 0) { out.push(...raw.names.slice(Math.min(ia, ib), Math.max(ia, ib) + 1)); continue; } bad.push(tk); continue; }
      const v = V(tk); if (v) out.push(v); else bad.push(tk);
    }
    return { vars: [...new Set(out)], bad };
  }
  // Rows used by a console command: the page filter and Subgroup bar, and the command's own if.
  cxMaskFor(conds) {
    const base = this.mask(); let mk = base ? Uint8Array.from(base) : null;
    for (const c of conds || []) {
      const cm = this.condMask(c); if (!cm) throw new Error('"' + c.v + '" is not a variable in this dataset');
      if (!mk) mk = Uint8Array.from(cm); else for (let i = 0; i < mk.length; i++) mk[i] &= cm[i];
    }
    return mk;
  }
  cxNum(name, mk) { const core = this.numCore(name); if (!core) return null; const a = new Float64Array(core.a.length); for (let i = 0; i < a.length; i++) a[i] = (!mk || mk[i]) ? core.a[i] : NaN; return a; }
  cxLab(name, mk) {
    const core = this.valsCore(name); if (!core) return null; const E = this._E;
    const a = core.kind === 'num' ? Array.from(core.a, v => Number.isFinite(v) ? String(this.vlabel(name, E.numLab(v))) : null) : Array.from(core.a, v => v == null || v === '' ? null : String(v));
    if (mk) for (let i = 0; i < a.length; i++) if (!mk[i]) a[i] = null;
    return a;
  }
  cxWeights(wv, kind, mk) {
    if (!wv) return null; const m = this.state.cols.find(c => c.name === wv); if (!m) return null;
    const w = this._E.weightArr(this._raw, m); if (!w) return null;
    const out = new Float64Array(w.length); for (let i = 0; i < w.length; i++) out[i] = (!mk || mk[i]) && w[i] > 0 ? w[i] : NaN; return out;
  }
  // Text values that are numbers written with a decimal comma or thousands separators: the destring that reads them.
  cxTextNumberHint(name) {
    const raw = this._raw, i = raw ? raw.names.indexOf(name) : -1; if (i < 0 || raw.cols[i].k !== 's') return '';
    const a = raw.cols[i].a; let seen = 0, dec = 0, thou = 0, ex = '';
    for (let r = 0; r < a.length && seen < 400; r++) { const v = String(a[r] == null ? '' : a[r]).trim(); if (!v || v === '.' || /^(NA|N\/A|na|n\/a|NULL|null)$/.test(v)) continue; seen++; if (/^[-+]?\d+,\d+$/.test(v) && !/^[-+]?\d{1,3},\d{3}$/.test(v)) { dec++; ex = ex || v; } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) { thou++; ex = ex || v; } }
    if (!seen || (dec + thou) / seen < 0.5) return '';
    return dec >= thou
      ? name + ' is stored as text: values such as "' + ex + '" use a decimal comma. Convert it with  destring ' + name + ', replace dpcomma'
      : name + ' is stored as text: values such as "' + ex + '" use commas between thousands. Convert it with  destring ' + name + ', replace ignore(",")';
  }
  // Stata command text with the conditions in place of @IF@ (the typed if plus the Subgroup bar).
  cxCmd(d, dial) {
    const conds = [...(d.sg || []), ...(d.ifc || [])];
    if (dial !== 'stata') return this.withIf(d.r, conds, 'r');
    const ex = conds.map(c => this.condExpr(c, 'stata')).filter(Boolean).join(' & ');
    return String(d.stata).replace('@IF@', ex ? ' if ' + ex : '').replace(/@AND@/g, ex ? ' & ' + ex : '');
  }
  cxSplit(s) {
    // "verb varlist [if exp] [weight] [, options]" → parts (Stata's order)
    let body = s, opt = '', wt = '';
    const ci = body.indexOf(','); if (ci >= 0) { opt = body.slice(ci + 1).trim(); body = body.slice(0, ci); }
    const wm = body.match(/\[\s*(pw|aw|fw|iw|pweight|aweight|fweight|iweight)\s*=\s*([^\]]+)\]/i); if (wm) { wt = wm[1].slice(0, 1).toLowerCase() + 'w'; body = body.replace(wm[0], ' '); }
    const im = body.match(/\s+if\s+(.+)$/); const ifs = im ? im[1].trim() : ''; if (im) body = body.slice(0, im.index);
    const toks = body.trim().split(/\s+/).filter(Boolean);
    return { verb: toks.shift() || '', toks, ifs, wt, wv: wm ? wm[2].trim() : '', opt };
  }
  cxOpts(optStr) { const O = {}; String(optStr || '').replace(/(\w+)\s*\(([^)]*)\)|(\w+)/g, (all, k, v, flag) => { if (k) O[k.toLowerCase()] = v.trim(); else if (flag) O[flag.toLowerCase()] = true; return ''; }); return O; }
  cxRows(rows, every) { const out = []; rows.forEach((r, i) => { if (i && every && i % every === 0) out.push(null); out.push(r); }); return out; }
  // ---- the commands ----
  cxRun(kind, s, ctx) {
    const P = this.cxSplit(s), O = this.cxOpts(P.opt), S = this.state, E = this._E, fail = ctx.fail;
    let conds = [];
    if (P.ifs) { const r = this.stataConds(P.ifs); if (r.err) return fail(r.err); conds = r.conds; }
    const L = kind === 'ttestpool' ? { vars: [], bad: [] } : this.cxVarlist(P.toks.join(' ')); if (L.bad.length) return fail((L.bad.length > 1 ? 'Not variables: ' : 'Not a variable: ') + L.bad.join(' '));
    let wv = '', wt = P.wt;
    if (P.wv) { wv = this._raw.names.find(n => n.toLowerCase() === P.wv.toLowerCase()); if (!wv) return fail('"' + P.wv + '" is not a variable in this dataset'); }
    else if (S.weightVar) { wv = S.weightVar; wt = kind === 'mean' ? 'pw' : 'aw'; }
    if (kind === 'mean' && wv && wt !== 'pw' && wt !== 'fw') return fail('mean takes sampling weights [pw=' + wv + '] or frequency weights [fw=' + wv + ']');
    let mk; try { mk = this.cxMaskFor(conds); } catch (e) { return fail(e.message); }
    const w = wv ? this.cxWeights(wv, wt, mk) : null;
    const wtxt = wv ? ' [' + wt + '=' + wv + ']' : '', otxt = P.opt ? ', ' + P.opt : '';
    const verb = P.verb.toLowerCase(), q = v => '"' + v + '"', rvec = vs => 'df[, c(' + vs.map(q).join(', ') + ')]';
    let vars = L.vars, out;
    try {
      if (kind === 'summarize' || kind === 'mean' || kind === 'tabstat') {
        if (!vars.length) vars = this._raw.names.filter((n, i) => this._raw.cols[i].k === 'n');
        if (kind === 'summarize' && wt === 'pw') return fail('pweights may not be used with summarize — use  mean ' + vars.join(' ') + ' [pw=' + wv + ']');
        if (kind === 'summarize') out = O.detail || O.d ? this.cxSumDetail(vars, mk, w, wt) : this.cxSum(vars, mk, w, wt);
        else if (kind === 'mean') out = this.cxMean(vars, mk, w, wt);
        else out = this.cxTabstat(vars, mk, w, O);
        const what = kind === 'mean' ? 'Means with standard errors and ' + Math.round((1 - this.alpha()) * 100) + '% confidence intervals' : kind === 'tabstat' ? 'Table of statistics' : (O.detail || O.d) ? 'Detailed summary statistics (percentiles, smallest and largest values, skewness, kurtosis)' : 'Summary statistics (observations, mean, SD, min, max)';
        out.expl = what + ' for ' + (vars.length > 4 ? vars.length + ' variables' : vars.join(', ')) + (wv ? ', weighted by ' + wv : '');
        out.stata = verb + (P.toks.length ? ' ' + P.toks.join(' ') : '') + '@IF@' + wtxt + otxt;
        out.r = kind === 'mean' ? (vars.length > 1 ? 'd <- na.omit(' + rvec(vars) + ')\nsapply(d, function(v) t.test(v)$conf.int)' : 't.test(df$' + vars[0] + ')') : (O.detail || O.d) && kind === 'summarize' ? vars.map(v => 'summary(df$' + v + ', quantile.type = 2)\nquantile(df$' + v + ', c(0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99), type = 2, na.rm = TRUE)').join('\n') : 'summary(' + rvec(vars) + ')';
      } else if (kind === 'correlate' || kind === 'pwcorr') {
        if (vars.length < 2) return fail(verb + ' needs at least two variables, e.g.  ' + verb + ' x y z');
        out = kind === 'correlate' ? this.cxCorrelate(vars, mk, w) : this.cxPwcorr(vars, mk, w, O);
        out.expl = kind === 'correlate' ? 'Correlation matrix of ' + vars.join(', ') + ' using only rows complete on every variable' : 'Pairwise correlations of ' + vars.join(', ') + ': each pair uses all rows complete for that pair' + (O.sig ? ', with p-values' : '');
        out.stata = verb + ' ' + P.toks.join(' ') + '@IF@' + wtxt + otxt;
        out.r = kind === 'correlate' ? 'cor(' + rvec(vars) + ', use = "complete.obs")' : (O.sig ? 'psych::corr.test(' + rvec(vars) + ', adjust = "none")' : 'cor(' + rvec(vars) + ', use = "pairwise.complete.obs")');
      } else if (kind === 'tab1') {
        if (!vars.length) return fail('tab1 needs a variable');
        out = { tbl: vars.map(v => (vars.length > 1 ? '-> tabulation of ' + v + '\n\n' : '') + this.cxTab1(v, mk, w)).join('\n\n'), res: vars.length + ' frequency table' + (vars.length === 1 ? '' : 's') };
        out.expl = 'Frequency table of ' + vars.join(', '); out.stata = 'tab1 ' + P.toks.join(' ') + '@IF@' + wtxt + otxt; out.r = vars.map(v => 'table(df$' + v + ', useNA = "no")').join('\n');
      } else if (kind === 'tab2') {
        if (vars.length < 2) return fail('tab2 needs at least two variables');
        const tabs = []; for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) tabs.push('-> tabulation of ' + vars[i] + ' by ' + vars[j] + '\n\n' + this.cxTab2(vars[i], vars[j], mk, w, O).tbl);
        out = { tbl: tabs.join('\n\n'), res: tabs.length + ' two-way tables' };
        out.expl = 'Two-way tables of every pair of ' + vars.join(', '); out.stata = 'tab2 ' + P.toks.join(' ') + '@IF@' + wtxt + otxt; out.r = 'table(df$' + vars[0] + ', df$' + vars[1] + ')';
      } else if (kind === 'ttestpool') {
        if (wv) return fail('ttest does not take weights — clear the weight (Settings) or use  regress ' + ctx.y + ' i.' + ctx.g + ' [pw=' + wv + ']');
        const y = this._raw.names.find(n => n.toLowerCase() === String(ctx.y).toLowerCase()), g = this._raw.names.find(n => n.toLowerCase() === String(ctx.g).toLowerCase());
        if (!y) return fail('"' + ctx.y + '" is not a variable in this dataset'); if (!g) return fail('"' + ctx.g + '" is not a variable in this dataset');
        const lev = O.level ? Number(O.level) : NaN;
        out = this.cxTtestPooled(y, g, mk, ctx.alpha || (Number.isFinite(lev) && lev > 10 && lev < 100 ? 1 - lev / 100 : this.alpha()), !!ctx.welch);
        out.expl = ctx.welch ? 'Two-sample t-test with unequal variances and Welch’s (1947) degrees of freedom: does mean ' + y + ' differ between the 2 groups of ' + g + '?' : 'Two-sample t-test with equal variances (pooled standard deviation): does mean ' + y + ' differ between the 2 groups of ' + g + '?';
        out.stata = 'ttest ' + y + '@IF@, by(' + g + ')' + (ctx.welch ? ' welch' : '') + (O.level ? ' level(' + O.level + ')' : '');
        out.r = (ctx.welch ? '# R reports Satterthwaite’s degrees of freedom; Stata’s welch option uses Welch’s (1947) formula\n' : '') + 't.test(' + y + ' ~ ' + g + ', data = df, var.equal = ' + (ctx.welch ? 'FALSE' : 'TRUE') + (ctx.alpha ? ', conf.level = ' + (1 - ctx.alpha) : O.level ? ', conf.level = ' + Number(O.level) / 100 : '') + ')';
        if (ctx.dial === 'r') out.stata = 'ttest ' + y + '@IF@, by(' + g + ')' + (ctx.alpha ? ' level(' + Math.round(100 * (1 - ctx.alpha)) + ')' : '');
      } else return fail('Unknown command');
    } catch (e) { return fail(e.message || String(e)); }
    if (out.error) return fail(out.error);
    this.pushLog({ t: 'cx', stata: out.stata, r: out.r, ifc: conds, tbl: out.tbl, res: out.res || '', expl: out.expl });
    const lab = (s.length > 70 ? s.slice(0, 68) + '…' : s) + (conds.length ? '   · the if applies to this command only' : '');
    return ctx.done(lab, { mfPane: 'output', mfDock: true, mfMobile: 'dock' });
  }
  cxSum(vars, mk, w, wt) {
    const R = (v, n) => String(v).padStart(n), G = v => this.stataG(v), E = this._E, fw = wt === 'fw', notes = [];
    const head = w && !fw ? ['    Variable |     Obs      Weight        Mean   Std. dev.       Min        Max', '-------------+-----------------------------------------------------------------'] : ['    Variable |        Obs        Mean    Std. dev.       Min        Max', '-------------+---------------------------------------------------------'];
    let shown = 0;
    const rows = vars.map(v => {
      const nm = R(this.abbr(v, 12), 12), a = this.cxNum(v, mk);
      if (!a) { const h = this.cxTextNumberHint(v); if (h) notes.push('note: ' + h); return nm + ' |' + R(0, w && !fw ? 8 : 11); }
      const s = E.descNum(a, w); if (!s.n) return nm + ' |' + R(0, w && !fw ? 8 : 11); shown++;
      if (fw) { const N = s.sw, sd = N > 1 ? Math.sqrt(this.cxSS(s) / (N - 1)) : NaN; return nm + ' |' + R(this.fmtN(N), 11) + R(G(s.mean), 12) + R(G(sd), 12) + R(G(s.mn), 11) + R(G(s.mx), 11); }
      return w ? nm + ' |' + R(this.fmtN(s.n), 8) + R(G(s.sw), 12) + R(G(s.mean), 12) + R(G(s.sd), 12) + R(G(s.mn), 10) + R(G(s.mx), 11) : nm + ' |' + R(this.fmtN(s.n), 11) + R(G(s.mean), 12) + R(G(s.sd), 12) + R(G(s.mn), 11) + R(G(s.mx), 11);
    });
    const tbl = [...head, ...this.cxRows(rows, 5).map(r => r === null ? head[1] : r), ...notes].join('\n');
    return { tbl, res: shown + ' of ' + vars.length + ' variable' + (vars.length === 1 ? '' : 's') + ' summarized' };
  }
  cxSS(s) { let ss = 0; for (let i = 0; i < s.n; i++) ss += s.ws[i] * (s.xs[i] - s.mean) ** 2; return ss; }
  cxPct(s, p) { const target = p * s.sw; let cum = 0; for (let i = 0; i < s.n; i++) { cum += s.ws[i]; if (cum >= target - 1e-9 * Math.max(1, s.sw)) { if (Math.abs(cum - target) < 1e-9 * Math.max(1, s.sw) && i + 1 < s.n) return (s.xs[i] + s.xs[i + 1]) / 2; return s.xs[i]; } } return s.xs[s.n - 1]; }
  cxSumDetail(vars, mk, w, wt) {
    const R = (v, n) => String(v).padStart(n), G = v => this.stataG(v), E = this._E, blocks = [];
    for (const v of vars) {
      const a = this.cxNum(v, mk), lab = (this.effMeta(v) || {}).label || v;
      const title = ' '.repeat(Math.max(0, Math.floor((61 - Math.min(61, lab.length)) / 2))) + lab.slice(0, 61);
      if (!a) { const h = this.cxTextNumberHint(v); blocks.push(title + '\n' + '-'.repeat(61) + '\n' + (h ? 'note: ' + h : 'no observations (' + v + ' is text)')); continue; }
      const s = E.descNum(a, w); if (!s.n) { blocks.push(title + '\n' + '-'.repeat(61) + '\nno observations'); continue; }
      const sw = s.sw, m = s.mean; let m2 = 0, m3 = 0, m4 = 0;
      for (let i = 0; i < s.n; i++) { const d = s.xs[i] - m, wi = s.ws[i]; m2 += wi * d * d; m3 += wi * d * d * d; m4 += wi * d * d * d * d; }
      m2 /= sw; m3 /= sw; m4 /= sw;
      const sd = wt === 'fw' ? (sw > 1 ? Math.sqrt(m2 * sw / (sw - 1)) : NaN) : s.sd, obs = wt === 'fw' ? sw : s.n;
      const P = [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99].map(p => this.cxPct(s, p)), lbl = [' 1%', ' 5%', '10%', '25%', '50%', '75%', '90%', '95%', '99%'];
      const sm = i => i < s.n ? R(G(s.xs[i]), 15) : R('', 15), lg = i => s.n - 4 + i >= 0 && s.n - 4 + i < s.n ? R(G(s.xs[s.n - 4 + i]), 15) : R('', 15), side = (k, val) => '       ' + k.padEnd(12) + R(val, 11);
      const L = [title, '-'.repeat(61), '      Percentiles      Smallest',
        lbl[0] + R(G(P[0]), 13) + sm(0), lbl[1] + R(G(P[1]), 13) + sm(1), lbl[2] + R(G(P[2]), 13) + sm(2) + side('Obs', this.fmtN(obs)), lbl[3] + R(G(P[3]), 13) + sm(3) + side('Sum of wgt.', G(sw)), '',
        lbl[4] + R(G(P[4]), 13) + R('', 15) + side('Mean', G(m)), ' '.repeat(24) + 'Largest' + side('Std. dev.', G(sd)),
        lbl[5] + R(G(P[5]), 13) + lg(0), lbl[6] + R(G(P[6]), 13) + lg(1) + side('Variance', G(sd * sd)), lbl[7] + R(G(P[7]), 13) + lg(2) + side('Skewness', G(m3 / Math.pow(m2, 1.5))), lbl[8] + R(G(P[8]), 13) + lg(3) + side('Kurtosis', G(m4 / (m2 * m2)))];
      blocks.push(L.map(x => x.replace(/\s+$/, '')).join('\n'));
    }
    return { tbl: blocks.join('\n\n'), res: 'detailed summary of ' + vars.length + ' variable' + (vars.length === 1 ? '' : 's') };
  }
  cxMean(vars, mk, w, wt) {
    const R = (v, n) => String(v).padStart(n), G = v => this.stataG(v), E = this._E, alpha = this.alpha();
    const arrs = vars.map(v => { const a = this.cxNum(v, mk); if (!a) throw new Error(v + ' is text — mean needs numeric variables' + (this.cxTextNumberHint(v) ? '. ' + this.cxTextNumberHint(v) : '')); return a; });
    const N = arrs[0].length, ok = []; for (let i = 0; i < N; i++) if (arrs.every(a => Number.isFinite(a[i])) && (!w || Number.isFinite(w[i]))) ok.push(i);
    const n = ok.length; if (n < 2) return { error: 'mean: fewer than 2 complete observations' };
    const nObs = w && wt === 'fw' ? ok.reduce((t, i) => t + w[i], 0) : n, crit = E.critInv(alpha, nObs - 1), pct = Math.round((1 - alpha) * 100);
    const rows = arrs.map((a, k) => {
      let mean, se;
      if (w && wt === 'fw') { let sw = 0, sx = 0; for (const i of ok) { sw += w[i]; sx += w[i] * a[i]; } mean = sx / sw; let ss = 0; for (const i of ok) ss += w[i] * (a[i] - mean) ** 2; se = Math.sqrt(ss / (sw - 1) / sw); }
      else if (w) { let sw = 0, sx = 0; for (const i of ok) { sw += w[i]; sx += w[i] * a[i]; } mean = sx / sw; let ss = 0; for (const i of ok) ss += (w[i] * (a[i] - mean)) ** 2; se = Math.sqrt(n / (n - 1) * ss) / sw; }
      else { let sx = 0; for (const i of ok) sx += a[i]; mean = sx / n; let ss = 0; for (const i of ok) ss += (a[i] - mean) ** 2; se = Math.sqrt(ss / (n - 1) / n); }
      return R(this.abbr(vars[k], 12), 12) + ' |' + R(G(mean), 11) + R(G(se), 11) + R(G(mean - crit * se), 14) + R(G(mean + crit * se), 12);
    });
    const dash = '-'.repeat(62);
    const tbl = ['Mean estimation'.padEnd(41) + 'Number of obs = ' + R(this.fmtN(nObs), 5), '', dash, '             |       Mean   Std. err.     [' + pct + '% conf. interval]', '-------------+------------------------------------------------', ...rows, dash].join('\n');
    return { tbl, res: 'n = ' + this.fmtN(nObs) };
  }
  cxTabstat(vars, mk, w, O) {
    const R = (v, n) => String(v).padStart(n), G = v => this.stataG(v), E = this._E;
    if (O.by) throw new Error('tabstat …, by() is under Univariate → Break down by groups (the same table, with any statistic)');
    const want = String(O.statistics || O.stats || O.s || 'mean').toLowerCase().split(/\s+/).filter(Boolean).flatMap(x => x === 'q' ? ['p25', 'p50', 'p75'] : [x]);
    const NAMES = { mean: 'Mean', sd: 'SD', n: 'N', count: 'N', sum: 'Sum', min: 'Min', max: 'Max', range: 'Range', var: 'Variance', variance: 'Variance', cv: 'CV', semean: 'SE(mean)', median: 'p50', p50: 'p50', p1: 'p1', p5: 'p5', p10: 'p10', p25: 'p25', p75: 'p75', p90: 'p90', p95: 'p95', p99: 'p99', iqr: 'IQR', skewness: 'Skewness', kurtosis: 'Kurtosis' };
    const bad = want.filter(x => !NAMES[x]); if (bad.length) throw new Error('tabstat: unknown statistic ' + bad.join(', ') + ' — use mean sd n sum min max range var cv semean median p1 p5 p10 p25 p50 p75 p90 p95 p99 iqr skewness kurtosis');
    const st = vars.map(v => { const a = this.cxNum(v, mk); if (!a) throw new Error(v + ' is text — tabstat needs numeric variables'); return E.descNum(a, w); });
    const val = (s, k) => { if (!s.n) return NaN; const m = s.mean; let m2 = 0, m3 = 0, m4 = 0; for (let i = 0; i < s.n; i++) { const d = s.xs[i] - m; m2 += s.ws[i] * d * d; m3 += s.ws[i] * d ** 3; m4 += s.ws[i] * d ** 4; } m2 /= s.sw; m3 /= s.sw; m4 /= s.sw;
      return k === 'mean' ? m : k === 'sd' ? s.sd : k === 'n' || k === 'count' ? s.n : k === 'sum' ? m * s.sw : k === 'min' ? s.mn : k === 'max' ? s.mx : k === 'range' ? s.mx - s.mn : k === 'var' || k === 'variance' ? s.sd * s.sd : k === 'cv' ? s.sd / m : k === 'semean' ? s.sd / Math.sqrt(s.n) : k === 'iqr' ? this.cxPct(s, .75) - this.cxPct(s, .25) : k === 'skewness' ? m3 / Math.pow(m2, 1.5) : k === 'kurtosis' ? m4 / (m2 * m2) : this.cxPct(s, (k === 'median' ? 50 : Number(k.slice(1))) / 100); };
    const line = '-'.repeat(10 + 10 * vars.length);
    const tbl = ['   Stats |' + vars.map(v => R(this.abbr(v, 8), 10)).join(''), '---------+' + '-'.repeat(10 * vars.length), ...want.map(k => R(NAMES[k], 8) + ' |' + st.map(s => R(k === 'n' || k === 'count' ? String(s.n) : G(val(s, k)), 10)).join('')), line].join('\n');
    return { tbl, res: want.length + ' statistic' + (want.length === 1 ? '' : 's') + ' for ' + vars.length + ' variable' + (vars.length === 1 ? '' : 's') };
  }
  cxCorrHead(vars) { const R = (v, n) => String(v).padStart(n); return [R('', 13) + '|' + vars.map(v => R(this.abbr(v, 8), 9)).join(''), '-------------+' + '-'.repeat(9 * vars.length)]; }
  cxCorrelate(vars, mk, w) {
    const R = (v, n) => String(v).padStart(n), E = this._E;
    const arrs = vars.map(v => { const a = this.cxNum(v, mk); if (!a) throw new Error(v + ' is text — correlate needs numeric variables'); return a; });
    const N = arrs[0].length; let n = 0; const cc = arrs.map(() => new Float64Array(N));
    for (let i = 0; i < N; i++) { const ok = arrs.every(a => Number.isFinite(a[i])) && (!w || Number.isFinite(w[i])); if (ok) n++; arrs.forEach((a, k) => { cc[k][i] = ok ? a[i] : NaN; }); }
    if (n < 3) return { error: 'correlate: fewer than 3 rows are complete on every variable' };
    const cm = E.corrMatrix(cc, w), f4 = v => Number.isFinite(v) ? v.toFixed(4) : '.';
    const rows = vars.map((v, i) => R(this.abbr(v, 12), 12) + ' |' + vars.slice(0, i + 1).map((_, j) => R(j === i ? '1.0000' : f4(cm[i][j].r), 9)).join(''));
    return { tbl: ['(obs=' + this.fmtN(n) + ')', '', ...this.cxCorrHead(vars), ...rows].join('\n'), res: vars.length + ' × ' + vars.length + ' correlations · n ' + this.fmtN(n) };
  }
  cxPwcorr(vars, mk, w, O) {
    const R = (v, n) => String(v).padStart(n), E = this._E, star = O.star ? Number(O.star) : NaN, sig = !!O.sig, obs = !!O.obs;
    const arrs = vars.map(v => { const a = this.cxNum(v, mk); if (!a) throw new Error(v + ' is text — pwcorr needs numeric variables'); return a; });
    const cm = E.corrMatrix(arrs, w), f4 = v => Number.isFinite(v) ? v.toFixed(4) : '.';
    const nOf = a => { let k = 0; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && (!w || Number.isFinite(w[i]))) k++; return k; };
    const out = [...this.cxCorrHead(vars)], blank = '             |';
    vars.forEach((v, i) => {
      out.push(R(this.abbr(v, 12), 12) + ' |' + vars.slice(0, i + 1).map((_, j) => { if (j === i) return R('1.0000', 9); const c = cm[i][j]; return R(f4(c.r) + (Number.isFinite(star) && c.p <= star ? '*' : ''), 9); }).join('') + ' ');
      if (sig) out.push(blank + vars.slice(0, i + 1).map((_, j) => j === i ? R('', 9) : R(f4(cm[i][j].p), 9)).join('').replace(/\s+$/, ''));
      if (obs) out.push(blank + vars.slice(0, i + 1).map((_, j) => R(j === i ? nOf(arrs[i]) : cm[i][j].n, 9)).join(''));
      if (sig || obs) out.push(blank);
    });
    return { tbl: out.map(x => x.replace(/\s+$/, '')).join('\n'), res: vars.length + ' variables, pairwise' };
  }
  cxOrder(name, labels) { return this.descOrder(name, labels.map(l => ({ label: l }))).map(r => r.label); }
  cxTab1(v, mk, w) {
    const R = (x, n) => String(x).padStart(n), G = x => this.stataG(x), a = this.cxLab(v, mk), E = this._E;
    const fr = E.freqOf(a, w), rows = this.descOrder(v, fr.rows), tot = fr.totalW;
    if (!rows.length) return v + ': no observations';
    const lw = Math.min(24, Math.max(11, v.length, ...rows.map(r => String(r.label).length))), cnt = x => w ? G(x) : this.fmtN(x); let cum = 0;
    const out = [R(this.abbr(v, lw), lw) + ' |      Freq.     Percent        Cum.', '-'.repeat(lw + 1) + '+-----------------------------------'];
    for (const r of rows) { cum += r.c; out.push(R(String(r.label).slice(0, lw), lw) + ' |' + R(cnt(r.c), 11) + R((100 * r.c / tot).toFixed(2), 12) + R((100 * cum / tot).toFixed(2), 12)); }
    out.push('-'.repeat(lw + 1) + '+-----------------------------------', R('Total', lw) + ' |' + R(cnt(tot), 11) + R('100.00', 12));
    return out.join('\n');
  }
  // Two-way table in Stata's layout: frequencies by default; row / column / cell percentages; chi2; Cramér's V.
  cxTab2(yv, xv, mk, w, O) {
    const E = this._E, R = (x, n) => String(x).padStart(n), G = x => this.stataG(x);
    const ya = this.cxLab(yv, mk), xa = this.cxLab(xv, mk); if (!ya || !xa) return { error: 'not a variable' };
    const yL = this.cxOrder(yv, [...new Set(ya.filter(v => v != null))]), xL = this.cxOrder(xv, [...new Set(xa.filter(v => v != null))]);
    if (yL.length > 400 || xL.length > 60) return { error: 'too many values to tabulate (' + yL.length + ' × ' + xL.length + ') — Stata stops at 12,000 rows and 1,200 columns; group the values first (Data → Recode)' };
    const yi = new Map(yL.map((l, i) => [l, i])), xi = new Map(xL.map((l, i) => [l, i])), C = yL.map(() => xL.map(() => 0));
    let n = 0; for (let i = 0; i < ya.length; i++) { if (ya[i] == null || xa[i] == null) continue; const wi = w ? w[i] : 1; if (!Number.isFinite(wi)) continue; C[yi.get(ya[i])][xi.get(xa[i])] += wi; n += wi; }
    const rT = C.map(r => r.reduce((a, b) => a + b, 0)), cT = xL.map((_, j) => C.reduce((a, r) => a + r[j], 0));
    const showF = !O.nofreq, stats = [showF ? 'frequency' : null, O.row ? 'row percentage' : null, O.column || O.col ? 'column percentage' : null, O.cell ? 'cell percentage' : null].filter(Boolean);
    const cntf = x => w ? G(x) : this.fmtN(x), pc = (a, b) => b > 0 ? (100 * a / b).toFixed(2) : '.';
    const cellLines = (cells, rowTot, colTots, tot) => { const L2 = []; if (showF) L2.push([cells.map(cntf), cntf(rowTot)]); if (O.row) L2.push([cells.map(c => pc(c, rowTot)), pc(rowTot, rowTot)]); if (O.column || O.col) L2.push([cells.map((c, j) => pc(c, colTots[j])), pc(rowTot, tot)]); if (O.cell) L2.push([cells.map(c => pc(c, tot)), pc(rowTot, tot)]); return L2; };
    const lw = Math.max(10, Math.min(16, Math.max(this.abbr(yv, 16).length, ...yL.map(l => String(l).length)))), cw = 11;
    const lab = l => String(l).length > lw ? String(l).slice(0, lw) : String(l), clab = l => String(l).length > 10 ? String(l).slice(0, 10) : String(l);
    const xTitle = (this.effMeta(xv) || {}).label || xv, block = cw * xL.length;
    const sep = '-'.repeat(lw + 1) + '+' + '-'.repeat(block) + '+' + '-'.repeat(cw - 1);
    const out = [];
    if (stats.length > 1) { const kw = Math.max(...stats.map(s2 => s2.length), 3) + 2; out.push('+' + '-'.repeat(kw) + '+', '| Key' + ' '.repeat(kw - 4) + '|', '|' + '-'.repeat(kw) + '|', ...stats.map(s2 => { const pad = kw - s2.length, l2 = Math.floor(pad / 2); return '|' + ' '.repeat(l2) + s2 + ' '.repeat(pad - l2) + '|'; }), '+' + '-'.repeat(kw) + '+', ''); }
    const title = xTitle.slice(0, block); out.push(' '.repeat(lw + 1) + '|' + ' '.repeat(Math.max(0, Math.floor((block - title.length) / 2))) + title);
    out.push(R(this.abbr(yv, lw), lw) + ' |' + xL.map(l => R(clab(l), cw)).join('') + ' |' + R('Total', cw - 1), sep);
    yL.forEach((l, r) => { cellLines(C[r], rT[r], cT, n).forEach((pair, k) => out.push(R(k ? '' : lab(l), lw) + ' |' + pair[0].map(v => R(v, cw)).join('') + ' |' + R(pair[1], cw - 1) + ' ')); if (stats.length > 1) out.push(sep); });
    if (stats.length === 1) out.push(sep);
    cellLines(cT, n, cT, n).forEach((pair, k) => out.push(R(k ? '' : 'Total', lw) + ' |' + pair[0].map(v => R(v, cw)).join('') + ' |' + R(pair[1], cw - 1) + ' '));
    const ct = { counts: C, colW: cT }, ch = yL.length >= 2 && xL.length >= 2 ? E.chi2Of(ct) : { error: 'need a 2×2 table' };
    if ((O.chi2 || O.v) && !ch.error) {
      out.push('');
      if (O.chi2) out.push(('Pearson chi2(' + ch.df + ') = ').padStart(28) + R(ch.stat.toFixed(4), 8) + '   Pr = ' + ch.p.toFixed(3));
      if (O.v) out.push("Cramér's V = ".padStart(28) + R(ch.V.toFixed(4), 8));
      if (O.chi2 && ch.smallShare > 0) out.push('', 'note: ' + Math.round(100 * ch.smallShare) + '% of cells have an expected count below 5 — the chi-square p-value may be inaccurate; use Fisher\'s exact test instead (Tests ▾ → Proportions & categorical tests).');
    }
    return { tbl: out.map(x => x.replace(/\s+$/, '')).join('\n'), res: yL.length + ' × ' + xL.length + ' table · n ' + cntf(n) + (ch.error ? '' : ' · chi2(' + ch.df + ') = ' + ch.stat.toFixed(2) + ' · p = ' + this.fmtP(ch.p)) };
  }
  // The crosstab entry logged by the page (tabulate y x): Stata's table with the options typed in the console,
  // or column percentages with chi2 when the table was made with the mouse.
  cxCtTable(d) {
    const O = d.cxo || { column: true, chi2: true }, mk = this.mask(), w = this.wArr();
    const r = this.cxTab2(d.y, d.x, mk, w ? Float64Array.from(w, v => v > 0 ? v : NaN) : null, O);
    return r.error ? '' : r.tbl;
  }
  cxPend(kind, toks, s) {
    const P = this.cxSplit(s), stata = P.verb.toLowerCase() + ' ' + P.toks.join(' ') + '@IF@' + (P.wv ? ' [' + P.wt + '=' + P.wv + ']' : '') + (P.opt ? ', ' + P.opt : '');
    const O = this.cxOpts(P.opt), V = n => this._raw.names.find(x => x.toLowerCase() === String(n).toLowerCase()) || n;
    this.setState({ conSig: '' }); // log the table again even when the same crosstab is already on screen
    this._cxPending = { t: kind, y: V(toks[0]), x: V(toks[1]), opts: O, stata, r: 'table(df$' + V(toks[0]) + ', df$' + V(toks[1]) + ')' + (O.chi2 ? '\nchisq.test(table(df$' + V(toks[0]) + ', df$' + V(toks[1]) + '), correct = FALSE)' : ''), at: Date.now() };
  }
  cxAdopt(d) {
    const p = this._cxPending; if (!d || !p || Date.now() - p.at > 15000 || d.t !== p.t || d.x !== p.x || d.y !== p.y) return d;
    this._cxPending = null; return Object.assign({}, d, { cxStata: p.stata, cxR: p.r, cxo: p.opts });
  }
  // Student's pooled test (Stata's default), or with welch: unequal variances and Welch's (1947) degrees of freedom.
  cxTtestPooled(y, g, mk, alpha, welch) {
    const E = this._E, R = (v, n) => String(v).padStart(n), G = v => this.stataG(v), p4 = v => Number.isFinite(v) ? v.toFixed(4) : '.', ab = v => { v = String(v); return v.length > 8 ? v.slice(0, 6) + '~' + v.slice(-1) : v; };
    const ya = this.cxNum(y, mk); if (!ya) return { error: y + ' is text — the t-test needs a numeric outcome' };
    const ga = this.cxLab(g, mk), lv = this.cxOrder(g, [...new Set(ga.filter((v, i) => v != null && Number.isFinite(ya[i])))]);
    if (lv.length !== 2) return { error: g + ' has ' + lv.length + ' groups with data here — ttest …, by() needs exactly 2 (use  oneway ' + y + ' ' + g + '  for more)' };
    const grp = lv.map(l => { const xs = []; for (let i = 0; i < ya.length; i++) if (ga[i] === l && Number.isFinite(ya[i])) xs.push(ya[i]); const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return { label: l, n, mean: m, sd, xs }; });
    if (grp.some(x => x.n < 2)) return { error: 'each group needs at least 2 observations' };
    const [a, b] = grp, all = a.xs.concat(b.xs), N = all.length, M = all.reduce((s, v) => s + v, 0) / N, SD = Math.sqrt(all.reduce((s, v) => s + (v - M) ** 2, 0) / (N - 1));
    const va = a.sd ** 2 / a.n, vb = b.sd ** 2 / b.n, df = welch ? -2 + (va + vb) ** 2 / (va ** 2 / (a.n + 1) + vb ** 2 / (b.n + 1)) : a.n + b.n - 2, sp = Math.sqrt(((a.n - 1) * a.sd ** 2 + (b.n - 1) * b.sd ** 2) / (a.n + b.n - 2)), se = welch ? Math.sqrt(va + vb) : sp * Math.sqrt(1 / a.n + 1 / b.n), diff = a.mean - b.mean, t = diff / se, p = E.pT(t, df);
    if (!(se > 0)) return { error: 'no variation inside the groups' };
    const pct = Math.round((1 - alpha) * 100), cr = E.critInv(alpha, df), lo = t < 0 ? p / 2 : 1 - p / 2;
    const row = (lab, n, m, sd) => { const s2 = sd / Math.sqrt(n), c = E.critInv(alpha, n - 1); return R(lab, 8) + ' |' + R(this.fmtN(n), 8) + R(G(m), 12) + R(G(s2), 12) + R(G(sd), 12) + R(G(m - c * s2), 12) + R(G(m + c * s2), 12); };
    const dash = '-'.repeat(78), mid = '---------+' + '-'.repeat(68);
    const tbl = ['Two-sample t test with ' + (welch ? 'unequal' : 'equal') + ' variances', dash, '   Group |     Obs        Mean    Std. err.   Std. dev.   [' + pct + '% conf. interval]', mid, row(ab(a.label), a.n, a.mean, a.sd), row(ab(b.label), b.n, b.mean, b.sd), mid, row('Combined', N, M, SD), mid,
      R('diff', 8) + ' |' + R('', 8) + R(G(diff), 12) + R(G(se), 12) + R('', 12) + R(G(diff - cr * se), 12) + R(G(diff + cr * se), 12), dash,
      ('    diff = mean(' + ab(a.label) + ') - mean(' + ab(b.label) + ')').padEnd(66) + 't = ' + R(p4(t), 8), (welch ? 'H0: diff = 0'.padEnd(39) + "Welch's degrees of freedom = " + R(G(df), 8) : 'H0: diff = 0'.padEnd(49) + 'Degrees of freedom = ' + R(df, 8)), '',
      '    Ha: diff < 0'.padEnd(33) + 'Ha: diff != 0'.padEnd(30) + 'Ha: diff > 0', ' Pr(T < t) = ' + p4(lo) + '         Pr(|T| > |t|) = ' + p4(p) + '          Pr(T > t) = ' + p4(1 - lo)].join('\n');
    return { tbl, res: 't(' + (welch ? this.fmt(df, 2) : df) + ') = ' + this.fmt(t, 3) + ' · p = ' + this.fmtP(p) + (welch ? ' · unequal variances (Welch df)' : ' · equal variances') };
  }
  // destring with Stata's rules: refuses to turn text into missing values unless force is given; dpcomma reads
  // decimal commas; ignore("chars") removes characters such as thousands separators first.
  cxDestring(s, list, optStr, varlist, fail, ok) {
    const O = this.cxOpts(optStr), L = varlist(list); if (L.bad.length) return fail('Not variables: ' + L.bad.join(' '));
    const raw = this._raw, gen = O.generate || O.gen || O.g ? String(O.generate || O.gen || O.g).split(/\s+/).filter(Boolean) : null;
    if (!O.replace && !gen) return fail('destring needs  , replace  or  , generate(newname) — e.g.  destring ' + (L.vars[0] || 'x') + ', replace');
    if (gen && gen.length !== L.vars.length) return fail('generate() needs one new name for each variable (' + L.vars.length + ')');
    if (gen) for (const g of gen) { const e = this.validName(g); if (e) return fail('generate(' + g + '): ' + e); }
    const ign = O.ignore != null ? String(O.ignore).replace(/^"(.*)"$/, '$1') : '';
    const parse = v => { let t = v == null ? '' : String(v).trim(); for (const ch of ign) t = t.split(ch).join(''); t = t.trim(); if (t === '' || t === '.' || /^\.[a-z]$/.test(t)) return { miss: true }; if (O.dpcomma) { if (t.includes('.')) return { bad: true }; t = t.replace(',', '.'); } const x = Number(t); return Number.isFinite(x) && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) ? { x } : { bad: true }; };
    const plan = [], msgs = [];
    for (const [k, v] of L.vars.entries()) {
      const i = raw.names.indexOf(v), col = raw.cols[i];
      if (col.k === 'n') { msgs.push(v + ': already numeric; no ' + (gen ? 'generate' : 'replace')); continue; }
      const a = new Float64Array(raw.n); let bad = 0, ex = '';
      for (let r = 0; r < raw.n; r++) { const p = parse(col.a[r]); if (p.miss) a[r] = NaN; else if (p.bad) { a[r] = NaN; bad++; if (!ex) ex = String(col.a[r]).trim(); } else a[r] = p.x; }
      if (bad && !O.force) {
        const h = this.cxTextNumberHint(v);
        return fail(v + ': contains nonnumeric characters (' + this.fmtN(bad) + ' values, e.g. "' + ex + '"); no ' + (gen ? 'generate' : 'replace') + '. ' + (h && !O.dpcomma && !ign ? h.replace(/^.*?Convert it with\s+/, 'Try  ') + '. ' : '') + 'Add  force  to turn those values into missing (.).');
      }
      plan.push({ v, i, a, bad, g: gen ? gen[k] : null });
    }
    if (!plan.length) return fail(msgs.join(' · '));
    const rx = v => 'df$' + v, rconv = v => { let e = rx(v); if (ign) e = 'gsub("[' + ign.replace(/[\]\\^-]/g, '\\$&') + ']", "", ' + e + ')'; if (O.dpcomma) e = 'sub(",", ".", ' + e + ', fixed = TRUE)'; return 'as.numeric(' + e + ')'; };
    for (const p of plan) {
      const res = (p.g ? p.g + ' created from ' + p.v : p.v + ' is now NUMERIC') + (p.bad ? ' · ' + this.fmtN(p.bad) + ' value' + (p.bad === 1 ? '' : 's') + ' could not be read as numbers and became missing (.) because of force' : '');
      const cmd = { stata: 'destring ' + p.v + ', ' + (p.g ? 'generate(' + p.g + ')' : 'replace') + (ign ? ' ignore("' + ign + '")' : '') + (O.dpcomma ? ' dpcomma' : '') + (O.force ? ' force' : ''), r: (p.g ? rx(p.g) : rx(p.v)) + ' <- ' + rconv(p.v) };
      if (p.g) { this.addDerivedCol(p.g, { k: 'n', a: p.a }, raw.labels[p.i] || '', 'gen'); this.pushLog({ t: 'retype', name: p.g, str: false, res, cmd }); }
      else {
        this.snap('change type of ' + p.v); raw.cols[p.i] = { k: 'n', a: p.a };
        this.setState(st => { const tr = { ...st.treat }; delete tr[p.v]; return { treat: tr }; });
        this.reprofile([p.i]); this.pushLog({ t: 'retype', name: p.v, str: false, res, cmd });
      }
    }
    this.clearMemo();
    return ok(s + (msgs.length ? '   (' + msgs.join(' · ') + ')' : ''));
  }
  cxImportCmd(dial) {
    const S = this.state, f = S.fileName || 'data.csv', c = (this._raw && this._raw.csv) || {}, xl = /\.(xlsx|xlsm|xltx|xltm|xls)$/i.test(f), sheet = this._xlsx && this._xlsx.name === f ? this._xlsx.sheet : '';
    const sav = /\.z?sav$/i.test(f);
    if (sav) return dial === 'stata' ? 'import spss using "' + f + '", clear' : 'df <- as.data.frame(haven::as_factor(haven::read_sav("' + f + '")))';
    if (dial === 'stata') {
      if (xl) return 'import excel "' + f + '",' + (sheet ? ' sheet("' + sheet + '")' : '') + ' firstrow clear';
      return 'import delimited "' + f + '",' + (c.delim === ';' ? ' delimiters(";")' : c.delim === '|' ? ' delimiters("|")' : '') + (c.decComma ? ' decimalseparator(,) groupseparator(.)' : '') + ' clear';
    }
    if (xl) return 'df <- as.data.frame(readxl::read_excel("' + f + '"' + (sheet ? ', sheet = "' + sheet + '"' : '') + '))';
    if (c.delim === ';') return c.decComma ? 'df <- read.csv2("' + f + '", na.strings = c("", "NA"))' : 'df <- read.csv("' + f + '", sep = ";", na.strings = c("", "NA"))';
    if (c.delim === '\t') return 'df <- read.delim("' + f + '", na.strings = c("", "NA"))';
    if (c.delim === '|') return 'df <- read.csv("' + f + '", sep = "|", na.strings = c("", "NA"))';
    return 'df <- read.csv("' + f + '", na.strings = c("", "NA"))';
  }
  // Small coefficients keep two significant digits instead of rounding to 0.00.
  cxNum2(v, d) { if (!Number.isFinite(v)) return ''; if (Math.abs(v) >= 1e5) return v.toExponential(2); if (v !== 0 && Math.abs(v) < 0.5 * Math.pow(10, -d)) return Number(v.toPrecision(2)).toString().replace(/^(-?)0\./, '$10.'); return v.toFixed(d); }
  // GM26 console commands end
