"""Console shows each analysis as Stata or R would: the command by variable name and the printed result.

The t-test workspace logs `ttest y, by(g) unequal` / `t.test(y ~ g, ...)` instead of a script that
embeds every observation, applies the active subgroup like every other command, and prints the
fixed-width Stata or R output for the selected syntax.
"""

MARK = '/* GM26 console output v1 */'
MARK2 = '/* GM26 console output v2 */'
MARK3 = '/* GM26 console output v3 */'


def replace(text, before, after, count=1):
    actual = text.count(before)
    if actual != count:
        raise RuntimeError(f'console_output: expected {count} anchor(s), found {actual}: {before[:90]}')
    return text.replace(before, after)


def integrate_component(c):
    if MARK3 in c:
        return c
    if MARK2 not in c:
        if MARK not in c:
            c = integrate_v1(c)
        c = integrate_v2(c).replace(MARK, MARK2, 1)
    return integrate_v3(c).replace(MARK2, MARK3, 1)


def integrate_v1(c):
    c = replace(c, "  cmdText(d, dial) { if (d.t === 'ttestx') return dial === 'r' ? d.r : d.stata;",
                "  cmdText(d, dial) { " + MARK + " if (d.t === 'ttestx') return this.withIf(dial === 'r' ? d.r : d.stata, d.sg, dial);")
    c = replace(c, "    if (d.t === 'ttestx') return d.tbl || '';",
                "    if (d.t === 'ttestx') return d.tblStata || d.tbl || '';")
    c = replace(c, "      if (d.tbl) lines.push({ text: d.tbl, title: this.explFor(d), style: tblStyle, click: rerun(d) });",
                "      const tbx = d.t === 'ttestx' ? ((S.dialect === 'r' ? d.tblR : d.tblStata) || d.tbl) : d.tbl;\n"
                "      if (tbx) lines.push({ text: tbx, title: this.explFor(d), style: tblStyle, click: rerun(d) });")
    return c


def integrate_v2(c):
    # summarize / tabulate open the univariate descriptive page (they had been routed to the one-sample t-test)
    c = replace(c, "    if (verb === 'summarize' || verb === 'tabulate') return done(label, Object.assign(patch, { tab: 'ttest', exploreVar: vars[0], ttMode: 'value' }));",
                "    if (verb === 'summarize' || verb === 'tabulate') return done(label, Object.assign(patch, { tab: 'one', exploreVar: vars[0] }));")
    # every console entry records when it was made, so the Output view can interleave results and charts
    c = replace(c, "  tagSg(entry) { if (entry.sg !== undefined) return entry;",
                "  tagSg(entry) { if (!entry.at) entry = { ...entry, at: Date.now() }; if (entry.sg !== undefined) return entry;")
    return c


def integrate_v3(c):
    # time series: the console shows the key commands; the session .do / .R file keeps the full script
    c = replace(c, "if (d.t === 'ts') return dial === 'stata' ? d.stata : d.r; const s = this.withIf(",
                "if (d.t === 'ts') return (d.short && (dial === 'stata' ? d.short.stata : d.short.r)) || (dial === 'stata' ? d.stata : d.r); const s = this.withIf(")
    c = replace(c, "const body = S.conLog.map(d => { let s = ''; try { s = this.cmdText(d, dial); }",
                "const body = S.conLog.map(d => { let s = ''; try { s = d.t === 'ts' ? (dial === 'stata' ? d.stata : d.r) : this.cmdText(d, dial); }")
    return c
