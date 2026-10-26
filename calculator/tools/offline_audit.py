"""Fixes from the offline audit of every tab (build 2026-10-25.32).

Each patch is idempotent: it is skipped when its replacement text is already present.
"""


def patch(text, old, new):
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError('offline_audit: expected one anchor, found %d: %s' % (text.count(old), old[:90]))
    return text.replace(old, new)


def integrate_component(c):
    # The cached weight array follows the chosen weight variable, not only the filter (a weight set by svyset or
    # a restored session no longer reuses the previous weight).
    c = patch(c, "return this.memo('w|' + this.filterSig(),", "return this.memo('w|' + this.state.weightVar + '|' + this.filterSig(),")
    # The new-version check is skipped while the browser is offline (no failed request in the console).
    c = patch(c, "if (this._vcBusy || typeof fetch === 'undefined') return;", "if (this._vcBusy || typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;")
    # Tests-menu analyses appear in the console, the Output view and the session .do / .R file; clicking the
    # entry reopens the analysis page.
    c = c.replace("if (d.t === 'asx') return dial === 'stata' ? d.stata : d.r; if (d.t === 'ts') return (d.short", "if (d.t === 'ts') return (d.short")  # build .33 form
    c = patch(c, "if (d.t === 'ts') return (d.short", "if (d.t === 'asx') return /^survey_/.test(d.id) ? (dial === 'stata' ? d.stata : d.r) : (dial === 'stata' && d.stataIfDone ? d.stata : this.withIf(dial === 'stata' ? d.stata : d.r, d.sg, dial)); if (d.t === 'ts') return (d.short")
    c = patch(c, "if (d.t === 'ts' || d.t === 'tsvars' || d.t === 'gen01') return dial === 'stata' ? d.stata : d.r;", "if (d.t === 'ts' || d.t === 'tsvars' || d.t === 'gen01' || d.t === 'asx') return dial === 'stata' ? d.stata : d.r;")
    c = patch(c, "if (d.t === 'ts') { this.setState(Object.assign({ tab: 'ts' }, d.setup || {})); return; }", "if (d.t === 'asx') { this.asOpen(d.id); return; }\n    if (d.t === 'ts') { this.setState(Object.assign({ tab: 'ts' }, d.setup || {})); return; }")
    c = patch(c, "if (d.t === 'ts') return d.tbl || d.res || '';", "if (d.t === 'ts' || d.t === 'asx') return d.tbl || d.res || '';")
    c = patch(c, "if (d.t === 'ts') return d.res || '';", "if (d.t === 'ts' || d.t === 'asx') return d.res || '';")
    c = patch(c, "if (d.t === 'ts') return 'Time series with explicit calendar preparation: ' + (d.res || '');", "if (d.t === 'asx') return d.res || d.title || 'Analysis';\n    if (d.t === 'ts') return 'Time series with explicit calendar preparation: ' + (d.res || '');")
    # The IF subgroup ("applies to every tab") also applies to Tests-menu analyses (survey methods use it as the
    # estimation domain); before, analysis pages silently used all rows.
    c = patch(c, "sgTab(tab) { tab = tab || this.state.tab; return ['ttest', 'one', 'two', 'reg', 'plots', 'browse', 'sem', 'text', 'ts'].includes(tab) ? tab : null; }",
              "sgTab(tab) { tab = tab || this.state.tab; return ['ttest', 'one', 'two', 'reg', 'plots', 'browse', 'sem', 'text', 'ts', 'analysis'].includes(tab) && !(tab === 'analysis' && (this.state.analysisId === '__directory' || (this.asCatalog?.().find(q => q.id === this.state.analysisId) || {}).group === 'Data management')) ? tab : null; }")
    # Session .do / .R files declare the missing-value codes the app applied (Settings codes and auto-detected
    # codes such as 999), so the exported commands reproduce the app's results.
    c = patch(c, "(isDta ? 'library(haven); df <- read_dta(\"' + S.fileName + '\")' : 'df <- read.csv(\"' + S.fileName + '\")'), ''];",
              "(isDta ? 'library(haven); df <- read_dta(\"' + S.fileName + '\")' : 'df <- read.csv(\"' + S.fileName + '\", na.strings = c(\"\", \"NA\"))'), ...this.missingDecodeLines(dial), ''];")
    # Paired t-test shows its effect size (d = mean difference / SD of differences, as in the APA line).
    c = patch(c, "cell(pct + '% CI OF DIFF.', '[' + this.fmt(r2.mean - cr * se) + ', ' + this.fmt(r2.mean + cr * se) + ']')];",
              "cell(pct + '% CI OF DIFF.', '[' + this.fmt(r2.mean - cr * se) + ', ' + this.fmt(r2.mean + cr * se) + ']'), cell(\"COHEN'S D\", this.fmt(dd, 2))];")
    # Descriptive statistics in the console as Stata and R print them (summarize / tabulate in Stata layout and value
    # order; summary(…, quantile.type = 2) — the page's quartiles — table(), and weighted R equivalents).
    c = patch(c, "if (d.t === 'sum') return 'summary(df$' + d.x + ')';", "if (d.t === 'sum') return d.w ? 'weighted.mean(df$' + d.x + ', df$' + d.w + ', na.rm = TRUE)' : 'summary(df$' + d.x + ', quantile.type = 2)';")
    c = patch(c, "if (d.t === 'tab1') return 'table(df$' + d.x + ')';", "if (d.t === 'tab1') return d.w ? 'prop.table(xtabs(' + d.w + ' ~ ' + d.x + ', data = df)) * 100' : 'table(df$' + d.x + ')';")
    a = c.index("    if (d.t === 'sum') {\n      const s = M['desc|' + d.x]; if (!s || !s.n) return '';\n      return '    Variable |") if "    if (d.t === 'sum') {\n      const s = M['desc|' + d.x]; if (!s || !s.n) return '';\n      return '    Variable |" in c else -1
    if a >= 0:
        b = c.index("    if (d.t === 'corr') {", a)
        c = c[:a] + "    if (d.t === 'sum' || d.t === 'tab1') return this.descStataText(d);\n" + c[b:]
    c = patch(c, "return { conLog: [...base, this.tagSg({ ...d, res, tbl })].slice(-60) };", "return { conLog: [...base, this.tagSg({ ...d, res, tbl, tblR: (d.t === 'sum' || d.t === 'tab1') ? this.descRText(d) : d.tblR })].slice(-60) };")
    c = patch(c, "upd.conLog = [...this.state.conLog, this.tagSg({ ...d, res, tbl })].slice(-60);", "upd.conLog = [...this.state.conLog, this.tagSg({ ...d, res, tbl, tblR: (d.t === 'sum' || d.t === 'tab1') ? this.descRText(d) : d.tblR })].slice(-60);")
    c = patch(c, "const tbx = d.t === 'ttestx' ? ((S.dialect === 'r' ? d.tblR : d.tblStata) || d.tbl) : d.tbl;", "const tbx = ((S.dialect === 'r' ? d.tblR : d.tblStata) || d.tbl);")
    # Time series (build .39): result tables keep their own Stata / R printouts in the console log.
    c = patch(c, "res: out.tsPrepared, tbl: 'Term\\tEstimate\\tSE\\tt\\tp\\n' + out.tsRows.map(r => [r.term,r.b,r.se,r.t,r.p].join('\\t')).join('\\n') };",
              "res: out.tsPrepared, tbl: 'Term\\tEstimate\\tSE\\tt\\tp\\n' + out.tsRows.map(r => [r.term,r.b,r.se,r.t,r.p].join('\\t')).join('\\n'), tblStata: this.tsStataText(res, scripts), tblR: this.tsRText(res, scripts) };")
    # Period words: "per year", not "per yearly"; "per period" for integer periods.
    c = patch(c, "tname: setup.effective }));", "tname: ({ yearly: 'year', quarterly: 'quarter', monthly: 'month', weekly: 'week', daily: 'day', trading: 'trading day' })[setup.effective] || 'period' }));")
    c = c.replace("' per ' + setup.effective + (sg(", "' per ' + (({ yearly: 'year', quarterly: 'quarter', monthly: 'month', weekly: 'week', daily: 'day', trading: 'trading day' })[setup.effective] || 'period') + (sg(")
    c = patch(c, "xlab: setup.effective + ' period',", "xlab: ({ yearly: 'Year', quarterly: 'Quarter', monthly: 'Month', weekly: 'Week', daily: 'Day', trading: 'Trading day' })[setup.effective] || 'Period',")
    # Diagnostics wording: Durbin–Watson reports the implied first-order correlation; Ljung–Box states what it tests.
    c = patch(c, "dw < 1.5 ? 'strong autocorrelation — try AR1' : dw > 2.5 ? 'negative autocorrelation' : 'about 2 = little autocorrelation' }];",
              "dw < 1.5 ? 'positive autocorrelation (\\u03c1 \\u2248 ' + this.fmt(1 - dw / 2, 2) + ') — try AR1' : dw > 2.5 ? 'negative autocorrelation (\\u03c1 \\u2248 ' + this.fmt(1 - dw / 2, 2) + ')' : 'about 2 = little first-order autocorrelation' }];")
    c = patch(c, "(res.lb.p < a ? ' — autocorrelation left in residuals' : ' — residuals look like noise') });",
              "(res.lb.p < a ? ' — autocorrelation left in residuals' : ' — no significant autocorrelation up to lag ' + res.lb.h) });")
    c = patch(c, "if (dw < 1.5 && !S.tsAr1) txt += 'The Durbin\\u2013Watson of ' + this.fmt(dw, 2) + ' shows strong autocorrelation — consider switching on AR1.';",
              "if (dw < 1.5 && !S.tsAr1) txt += 'The Durbin\\u2013Watson of ' + this.fmt(dw, 2) + ' points to positive autocorrelation (\\u03c1 \\u2248 ' + this.fmt(1 - dw / 2, 2) + ') — consider switching on AR1. ';\n          if (res.pooled && res.nUnits < 30) txt += 'Only ' + res.nUnits + ' units: standard errors are clustered by unit, and with fewer than about 30 clusters cluster-robust standard errors tend to be too small and p-values too optimistic (p-values here use t with ' + (res.nUnits - 1) + ' df). Treat significance as approximate, or check each unit separately or with a wild cluster bootstrap. ';")
    # Time series (build .40): time step (Stata's delta) and values the user chooses for missing periods.
    c = patch(c, "const prepKey = JSON.stringify([S.tsRows, S.tsStat, S.tsW, S.tsId, S.dver,", "const prepKey = JSON.stringify([S.tsStep, (S.tsFill || {})[this.tsFillSig()], S.tsRows, S.tsStat, S.tsW, S.tsId, S.dver,")
    c = patch(c, "start: t0, end: t1, average: avg }))", "start: t0, end: t1, average: avg, step: S.tsStep, fills: this.tsFillMap() }))")
    c = patch(c, "E.tsAnalyze({ t: prep.t, y: prep.y, unit: okU ? prep.unit : null, sel: null,", "E.tsAnalyze({ t: prep.t, y: prep.y, unit: okU ? prep.unit : null, sel: null, step: prep.step || 1,")
    c = patch(c, "if (prep.collapse) out.tsPrepared = this.tsCollapseText(prep, setup); /* GM26 ts collapse v1 */",
              "if (prep.collapse) out.tsPrepared = this.tsCollapseText(prep, setup); /* GM26 ts collapse v1 */\n        if (prep.step > 1) out.tsPrepared += ' Time step: every ' + prep.step + ' periods (observed periods ' + prep.step + ' apart are consecutive).';\n        if (prep.filled) out.tsPrepared += ' ' + prep.filled + ' missing period(s) filled with values you entered (assumptions, not data; written into the scripts).';\n        out.tsGapEl = this.tsGapPanel(prep, setup);")
    # Console keep if / drop if accumulate as in Stata: each new condition is added to the earlier ones (kept in
    # flt.more), instead of silently replacing them. Editing the filter under Edit data still replaces it.
    c = patch(c, "if (S.flt && S.flt.on) out.push({ v: S.flt.v, t: 'op', op: S.flt.op, val: S.flt.val, cat: S.flt.cat });",
              "if (S.flt && S.flt.on) out.push({ v: S.flt.v, t: 'op', op: S.flt.op, val: S.flt.val, cat: S.flt.cat }, ...(S.flt.more || []));")
    c = patch(c, "this.setState({ flt: { v, op: S.fltOp, val, on: true, cat: isCat }, fltErr: '' });", "this.setState({ flt: { v, op: S.fltOp, val, on: true, cat: isCat, more: S.fltCarry || [] }, fltErr: '', fltCarry: null });")
    c = patch(c, "if (r.conds.length > 1) return fail(m[1] + ' if takes one condition here — for several, use the Subgroup bar (or  if a & b  after any analysis command).');",
              "if (r.conds.length > 1) return fail(m[1] + ' if takes one condition at a time — run them one after another (each keep / drop adds to the earlier ones), or use the Subgroup bar.');")
    c = patch(c, "this.setState({ fltV: c.v, fltOp: op, fltVal: c.val, fltErr: '' }, () => { this.doFilter(); setTimeout(() => { if (this.state.fltErr) fail(this.state.fltErr); else ok(s + '   (rows are filtered, not deleted — clear the filter under Edit data)'); }, 60); }); return true;",
              "const prior = S.flt && S.flt.on ? [{ v: S.flt.v, t: 'op', op: S.flt.op, val: S.flt.val, cat: S.flt.cat }, ...(S.flt.more || [])] : [];\n      this.setState({ fltV: c.v, fltOp: op, fltVal: c.val, fltErr: '', fltCarry: prior }, () => { this.doFilter(); setTimeout(() => { if (this.state.fltErr) fail(this.state.fltErr); else ok(s + '   (rows are filtered, not deleted' + (prior.length ? '; earlier keep / drop conditions still apply' : '') + ' — clear the filter under Edit data)'); }, 60); }); return true;")
    c = c.replace("S.flt.v + ' ' + S.flt.op + ' ' + S.flt.val", "this.fltText(S.flt)")
    c = patch(c, "  clearFilter() {", "  fltText(f) { return [f, ...(f.more || [])].map(x => x.v + ' ' + x.op + ' ' + x.val).join(' & '); }\n  clearFilter() {")
    # Exported keep if: quotes only for text variables (a 0/1 numeric variable shown as categorical is still stored
    # as numbers in Stata), and rows with a missing value are excluded explicitly — Stata treats missing as larger
    # than any number (so "keep if x != 0" or "x > 5" would keep them), while the app and R's subset() drop them.
    c = patch(c, "if (d.t === 'filter') { const q = d.cat ? '\"' + d.val + '\"' : d.val; return dial === 'stata' ? 'keep if ' + d.v + ' ' + d.op + ' ' + q : 'df <- subset(df, ' + d.v + ' ' + d.op + ' ' + q + ')'; }",
              "if (d.t === 'filter') { const numStore = (this.effMeta(d.v) || {}).type === 'numeric' && d.val !== '' && isFinite(Number(d.val)), q = d.cat && !numStore ? '\"' + d.val + '\"' : d.val, miss = d.val !== '.' && (d.op === '!=' || (numStore && (d.op === '>' || d.op === '>='))) ? ' & !missing(' + d.v + ')' : ''; return dial === 'stata' ? 'keep if ' + d.v + ' ' + d.op + ' ' + q + miss : 'df <- subset(df, ' + d.v + ' ' + d.op + ' ' + q + ')'; }")
    # Session .R files read blank text cells as missing, as the app does (read.csv would make "" a category).
    c = patch(c, "'df <- read.csv(\"' + S.fileName + '\")'), ...this.missingDecodeLines(dial)", "'df <- read.csv(\"' + S.fileName + '\", na.strings = c(\"\", \"NA\"))'), ...this.missingDecodeLines(dial)")
    # Correlation in the console: Stata's pwcorr …, sig obs layout and R's cor.test() printout.
    c = c.replace("this.descRText(d) : d.tblR })", "this.descRText(d) : d.t === 'corr' ? this.corrRText(d) : d.tblR })")
    a = c.index("    if (d.t === 'corr') {\n      const c = M['corr|' + d.x + '|' + d.y]; if (!c || c.error) return '';\n      return R('', 13)") if "    if (d.t === 'corr') {\n      const c = M['corr|' + d.x + '|' + d.y]; if (!c || c.error) return '';\n      return R('', 13)" in c else -1
    if a >= 0:
        b = c.index("    if (d.t === 'ttest' || d.t === 'anova') {", a)
        c = c[:a] + "    if (d.t === 'corr') return this.corrStataText(d);\n" + c[b:]
    # Compare means (two-variable tab) in the console: Stata ttest / oneway and R t.test / summary(aov) printouts.
    c = c.replace("d.t === 'corr' ? this.corrRText(d) : d.tblR })", "d.t === 'corr' ? this.corrRText(d) : (d.t === 'ttest' || d.t === 'anova') ? this.meansRText(d) : d.tblR })")
    a = c.find("    if (d.t === 'ttest' || d.t === 'anova') {\n      const G = M['grp|' + d.g + '|' + d.y]; if (!G) return '';")
    if a >= 0:
        b = c.index("\n    }\n", a) + len("\n    }\n")
        c = c[:a] + "    if (d.t === 'ttest' || d.t === 'anova') return this.meansStataText(d);\n" + c[b:]
    # Regression in the console as Stata and R print it, with commands Stata and R can run.
    c = c.replace("(d.t === 'ttest' || d.t === 'anova') ? this.meansRText(d) : d.tblR })", "(d.t === 'ttest' || d.t === 'anova') ? this.meansRText(d) : d.t === 'reg' ? this.regRText(d) : d.tblR })")
    c = patch(c, "return d.t === 'reg' && d.vce ? this.vceCmd(s, d, dial) : s; }", "return this.regFix(d.t === 'reg' && d.vce ? this.vceCmd(s, d, dial) : s, d, dial); }")
    c = patch(c, "    if (d.t === 'reg') {\n      const key = d.m === 'ols' ? 'reg|ols|' : d.m === 'logistic' ? 'reg|logit|' : d.m === 'ologit' ? 'reg|olog|' : 'reg|pois|';\n      const Mo = M[", "    if (d.t === 'reg') {\n      const stx = this.regStataText(d); if (stx) return stx;\n      const key = d.m === 'ols' ? 'reg|ols|' : d.m === 'logistic' ? 'reg|logit|' : d.m === 'ologit' ? 'reg|olog|' : 'reg|pois|';\n      const Mo = M[")
    # Margins R code: the model line is the command's "m <- …" line (robust, clustered and coeftest commands are
    # several lines); before, multi-line commands produced "m <- library(sandwich)…".
    c = patch(c, "const mline = regLine.replace(/^summary\\(([\\s\\S]*)\\)\\s*$/, '$1');\n              out.mgCmd = 'library(ggeffects)\\nm <- ' + mline + '\\nplot(",
              "const rl = regLine.split('\\n'), mi = rl.findIndex(l => /^m <- /.test(l)), mline = mi >= 0 ? rl.slice(0, mi + 1).join('\\n') : 'm <- ' + regLine.replace(/^summary\\(([\\s\\S]*)\\)\\s*$/, '$1');\n              out.mgCmd = 'library(ggeffects)\\n' + mline + '\\nplot(")
    # Console: regression tables appear under their command (they were logged before the model was fitted).
    c = patch(c, "const tbx = ((S.dialect === 'r' ? d.tblR : d.tblStata) || d.tbl);", "const tbx = this.conTable(d, S.dialect);")
    # Timeline commands reproduce the chart (yearly means, band, gaps), instead of drawing the raw rows.
    c = patch(c, "        if (dial !== 'stata' && yl.length > 1) return 'library(ggplot2); long <- tidyr::pivot_longer(", "        if (true) { const rng0 = (d.t0 || d.t1) ? [d.t0 ? d.x + ' >= ' + d.t0 : '', d.t1 ? d.x + ' <= ' + d.t1 : ''].filter(Boolean) : []; return this.lineCmd(d, dial, yl, inL, rng0); }\n        if (dial !== 'stata' && yl.length > 1) return 'library(ggplot2); long <- tidyr::pivot_longer(")
    # Clustered SEs with few clusters are flagged where the results are shown (they tend to be too small).
    c = patch(c, "cluster: 'SEs CLUSTERED BY ' + String(S.regCl).toUpperCase() + ' (' + M.vce.G + ' CLUSTERS)',", "cluster: 'SEs CLUSTERED BY ' + String(S.regCl).toUpperCase() + ' (' + M.vce.G + ' CLUSTERS' + (M.vce.G < 30 ? ' — FEWER THAN ~30 CLUSTERS: THESE SEs CAN BE TOO SMALL AND p-VALUES TOO OPTIMISTIC; TREAT SIGNIFICANCE AS APPROXIMATE' : '') + ')',")
    return c


PZ_BOTH = 'function pzBoth(x) {\n  const DBL_EPS = 2.220446049250313e-16;\n  const a = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582, 18154.981253343561249, 0.065682337918207449113];\n  const b = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205, 45507.789335026729956];\n  const c = [0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979, 597.27027639480026226, 2494.5375852903726711, 6848.1904505362823326, 11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8];\n  const d = [22.266688044328115691, 235.38790178262499861, 1519.377599407554805, 6485.558298266760755, 18615.571640885098091, 34900.952721145977266, 38912.003286093271411, 19685.429676859990727];\n  const p = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807, 0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];\n  const q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515, 0.00378239633202758244, 7.29751555083966205e-5];\n  const SQRT32 = 5.656854249492380195206754896838, M_1_SQRT_2PI = 0.398942280401432677939946059934;\n  let cum, ccum; const y = Math.abs(x);\n  if (Number.isNaN(x)) return [NaN, NaN];\n  if (y <= 0.67448975) {\n    let xnum, xden; if (y > DBL_EPS * 0.5) { const xsq = x * x; xnum = a[4] * xsq; xden = xsq; for (let i = 0; i < 3; i++) { xnum = (xnum + a[i]) * xsq; xden = (xden + b[i]) * xsq; } } else { xnum = xden = 0; }\n    const temp = x * (xnum + a[3]) / (xden + b[3]); cum = 0.5 + temp; ccum = 0.5 - temp;\n  } else if (y <= SQRT32) {\n    let xnum = c[8] * y, xden = y; for (let i = 0; i < 7; i++) { xnum = (xnum + c[i]) * y; xden = (xden + d[i]) * y; }\n    let temp = (xnum + c[7]) / (xden + d[7]);\n    const xsq = Math.trunc(y * 16) / 16, del = (y - xsq) * (y + xsq);\n    cum = Math.exp(-xsq * xsq * 0.5) * Math.exp(-del * 0.5) * temp; ccum = 1 - cum;\n    if (x > 0) { temp = cum; cum = ccum; ccum = temp; }\n  } else if (y < 1e170) {\n    const xsq0 = 1 / (x * x); let xnum = p[5] * xsq0, xden = xsq0; for (let i = 0; i < 4; i++) { xnum = (xnum + p[i]) * xsq0; xden = (xden + q[i]) * xsq0; }\n    let temp = xsq0 * (xnum + p[4]) / (xden + q[4]); temp = (M_1_SQRT_2PI - temp) / y;\n    const xsq = Math.trunc(x * 16) / 16, del = (x - xsq) * (x + xsq);\n    cum = Math.exp(-xsq * xsq * 0.5) * Math.exp(-del * 0.5) * temp; ccum = 1 - cum;\n    if (x > 0) { temp = cum; cum = ccum; ccum = temp; }\n  } else { if (x > 0) { cum = 1; ccum = 0; } else { cum = 0; ccum = 1; } }\n  return [cum, ccum];\n}\n'


def integrate_engine(e):
    # Stata 7–8 files (.dta formats 110–112, still written by R's foreign::write.dta): letter type codes in 110,
    # 12-byte formats and single missing values at the type maxima, otherwise the same layout as 113.
    e = patch(e, "  if (ver !== 113 && ver !== 114 && ver !== 115) throw new Error('unsupported .dta version (' + ver + '). Export as CSV or Stata 13+ instead.');",
              "  if (ver < 110 || ver > 115) throw new Error('unsupported .dta version (' + ver + '). Export as CSV or from Stata 7 or later instead.');\n  const old = ver < 113;")
    e = patch(e, "  const types = []; for (let i = 0; i < K; i++) types.push(u8[p + i]); p += K;\n  const rdA",
              "  const types = []; for (let i = 0; i < K; i++) types.push(u8[p + i]); p += K;\n  if (ver === 110) for (let i = 0; i < K; i++) { const t = types[i]; types[i] = { 98: 251, 105: 252, 108: 253, 102: 254, 100: 255 }[t] || (t >= 128 ? t - 127 : t); }\n  const rdA")
    e = patch(e, "  p += (ver === 113 ? 12 : 49) * K;", "  p += (ver <= 113 ? 12 : 49) * K;")
    e = patch(e, "        else if (t === 253) { const v = dv.getInt32(q, le); cols[c].a[r] = v > 2147483620 ? NaN : v; }\n        else if (t === 252) { const v = dv.getInt16(q, le); cols[c].a[r] = v > 32740 ? NaN : v; }\n        else if (t === 251) { const v = dv.getInt8(q); cols[c].a[r] = v > 100 ? NaN : v; }",
              "        else if (t === 253) { const v = dv.getInt32(q, le); cols[c].a[r] = v > (old ? 2147483646 : 2147483620) ? NaN : v; }\n        else if (t === 252) { const v = dv.getInt16(q, le); cols[c].a[r] = v > (old ? 32766 : 32740) ? NaN : v; }\n        else if (t === 251) { const v = dv.getInt8(q); cols[c].a[r] = v > (old ? 126 : 100) ? NaN : v; }")
    # summarize [aw=]: weighted SD with Stata's analytic-weight formula (weights normalised to the number of
    # observations), so it equals the command shown; unweighted SD is unchanged.
    e = patch(e, "sd: sw > 1 ? Math.sqrt(ss / (sw - 1)) : NaN,", "sd: n > 1 ? Math.sqrt(ss / sw * n / (n - 1)) : NaN,")
    # Time series (build .39): units are ordered as Stata's egen group() / R's factor() number them, so the constant
    # and unit indicators match the exported regress / lm commands; the covariance matrix is kept for the F test.
    e = patch(e, "  let series = [...G.entries()].map(([u, m]) => ({ u, pts: [...m.entries()].map(([t, c]) => ({ t, y: c[0] / c[1] })).sort((a, b) => a.t - b.t) }));",
              "  let series = [...G.entries()].map(([u, m]) => ({ u, pts: [...m.entries()].map(([t, c]) => ({ t, y: c[0] / c[1] })).sort((a, b) => a.t - b.t) }));\n  { const numU = !uA || Array.prototype.every.call(uA, v => v == null || v === '' || typeof v === 'number'); series.sort((a, b) => numU ? Number(a.u) - Number(b.u) : (a.u < b.u ? -1 : a.u > b.u ? 1 : 0)); }")
    e = patch(e, "  return { coefs, n, P, r2: sst ? 1 - sse / sst : NaN,", "  return { coefs, V: Vc, sse, df, units: series.map(s => s.u), n, P, r2: sst ? 1 - sse / sst : NaN,")
    # Time-series chart: round tick values placed where their labels say (labels were rounded but drawn at
    # fractional periods, e.g. "1996" at 1995.8); monthly and quarterly axes tick at the start of a year.
    e = patch(e, "  for (let k = 0; k <= 4; k++) { const v = y0 + (y1 - y0) * k / 4; kids.push(",
              "  for (const [k, v] of csPretty(y0, y1, 4).entries()) { kids.push(")
    e = patch(e, "  for (let k = 0; k <= 5; k++) { const v = t0 + (t1 - t0) * k / 5; kids.push(R.createElement('text', { key: 'xt' + k,",
              "  const tu = o.frequency === 'monthly' ? 12 : o.frequency === 'quarterly' ? 4 : 1, xTicks = (t1 - t0) / tu >= 2 ? csPretty(t0 / tu, t1 / tu, 5, true).map(v => v * tu) : csPretty(t0, t1, 5, true);\n  for (const [k, v] of xTicks.entries()) { kids.push(R.createElement('text', { key: 'xt' + k,")
    # Time series (build .40): consecutive observations are one time step apart (delta), not always one period.
    e = e.replace("p.t - s.pts[i-1].t !== 1", "p.t - s.pts[i-1].t !== (o.step || 1)")
    # Normal and chi-square tails used by the classic tabs (regression, crosstab…): R's pnorm (Cody's algorithm) and the
    # upper incomplete gamma computed directly, so very small p-values have full relative precision (the console
    # printouts match R digit for digit; the old approximation was off by ~1e-7 absolute).
    e = patch(e, """export function pZ(z) {
  if (!isFinite(z)) return NaN;
  const x = Math.abs(z) / Math.SQRT2;""", PZ_BOTH + """export function pZ(z) {
  if (!isFinite(z)) return NaN;
  return Math.max(0, Math.min(1, 2 * pzBoth(-Math.abs(z))[0]));
  const x = Math.abs(z) / Math.SQRT2;""")
    e = patch(e, "export function pChi2(x, k) { if (!isFinite(x) || x < 0 || k < 1) return NaN; return Math.max(0, Math.min(1, 1 - gammp(k / 2, x / 2))); }",
              "export function pChi2(x, k) { if (!isFinite(x) || x < 0 || k < 1) return NaN; const a = k / 2, y = x / 2; if (y < a + 1) return Math.max(0, Math.min(1, 1 - gammp(a, y))); let b = y + 1 - a, c = 1e30, d = 1 / b, h = d; for (let i = 1; i < 300; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; } return Math.max(0, Math.min(1, Math.exp(-y + a * Math.log(y) - gammln(a)) * h)); }")
    # Timeline chart: lines and bands break where a period has no data (as the panel timelines), instead of joining
    # the observed periods on either side.
    e = patch(e, "    s.pts.forEach((p, i) => { if (isFinite(p.lo) && isFinite(p.hi)) run.push(p); else flush(i); });",
              "    const allT = ser.flatMap(q => q.pts.map(p => p.t)), segStart = new Set(csSegments(s.pts.map(p => ({ x: p.t })), allT).slice(1).map(sg => sg[0].x));\n    s.pts.forEach((p, i) => { if (segStart.has(p.t)) flush(i); if (isFinite(p.lo) && isFinite(p.hi)) run.push(p); else flush(i); });")
    e = patch(e, "    s.pts.forEach((p, i) => { d += (i ? 'L' : 'M') + sx(p.t).toFixed(1) + ',' + sy(p.y).toFixed(1); });",
              "    { const allT = ser.flatMap(q => q.pts.map(p => p.t)); csSegments(s.pts.map(p => ({ x: p.t, p })), allT).forEach(sg => sg.forEach((q, i) => { d += (i ? 'L' : 'M') + sx(q.p.t).toFixed(1) + ',' + sy(q.p.y).toFixed(1); })); }")
    return e


def integrate_template(t):
    # Time series (build .40): the time-step and missing-period panel sits under the preparation summary.
    return patch(t, '<div class="ts-setup-warning" data-testid="time-series-validation">{{ tsValidation }}</div></sc-if>',
                 '<div class="ts-setup-warning" data-testid="time-series-validation">{{ tsValidation }}</div>{{ tsGapEl }}</sc-if>')
