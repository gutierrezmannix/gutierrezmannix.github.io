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
              "(isDta ? 'library(haven); df <- read_dta(\"' + S.fileName + '\")' : 'df <- read.csv(\"' + S.fileName + '\")'), ...this.missingDecodeLines(dial), ''];")
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
    return c


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
    return e


def integrate_template(t):
    # Time series (build .40): the time-step and missing-period panel sits under the preparation summary.
    return patch(t, '<div class="ts-setup-warning" data-testid="time-series-validation">{{ tsValidation }}</div></sc-if>',
                 '<div class="ts-setup-warning" data-testid="time-series-validation">{{ tsValidation }}</div>{{ tsGapEl }}</sc-if>')
