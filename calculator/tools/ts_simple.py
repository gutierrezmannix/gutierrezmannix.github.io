"""Stata-style setup for every Tests → Time series page (tsset first, then the model).

src/ts-dates.mjs is added to the engine (text dates, frequencies, series building) and src/ts-simple.js
to the component (setup form, packet, result labels). Re-running replaces the previous copy.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
C_BEGIN, C_END = '  // GM26 time-series setup begin', '  // GM26 time-series setup end'
E_BEGIN, E_END = '// GM26 time-series dates begin', '// GM26 time-series dates end'
T_MARK = '<!-- GM26 time-series setup css -->'


TAB_MARK = '/* GM26 ts collapse v1 */'


def replace(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError(f'ts_simple: expected one anchor, found {text.count(before)}: {before[:90]}')
    return text.replace(before, after)


def integrate_tab(c):
    # Time series tab: survey records collapse to one value per unit and period
    if TAB_MARK in c:
        return c
    c = replace(c, "const prepKey = JSON.stringify([setup.mode, ", "const prepKey = JSON.stringify([" + "S.tsRows, S.tsStat, S.tsW, S.tsId, S.dver, setup.mode, ")
    c = replace(c, " interior gaps. Unweighted estimation; survey weights do not apply here.';",
                " interior gaps. Unweighted estimation; survey weights do not apply here.';\n        if (prep.collapse) out.tsPrepared = this.tsCollapseText(prep, setup); " + TAB_MARK)
    c = replace(c, "out.tsValidation = res.error || 'Validated: one observation per unit and original period; no automatic duplicate averaging. Calendar gaps remain missing.';",
                "out.tsValidation = res.error || (prep.collapse ? 'Collapsed: one value per unit and period from the records. Calendar gaps remain missing, never filled.' : 'Validated: one observation per unit and original period; no automatic duplicate averaging. Calendar gaps remain missing.');")
    return c


TAB2_MARK = 'short: scripts.short'


def integrate_tab2(c):
    # Console entry carries the short command; the collapse note is not shown as a warning
    if TAB2_MARK in c:
        return c
    c = replace(c, "this._tsLast = { t: 'ts', r: rCode, stata, sg: []", "this._tsLast = { t: 'ts', r: rCode, stata, " + TAB2_MARK + ", sg: []")
    c = replace(c, "(prep.collapse ? 'Collapsed: one value per unit and period from the records. Calendar gaps remain missing, never filled.' : ",
                "(prep.collapse ? '' : ")
    return c


RUN_C_MARK = 'this.tsRunNow()'


def integrate_tab3(c):
    # Run button: results appear after the first Run; the status line says what is missing
    if RUN_C_MARK in c:
        return c
    c = replace(c, "out.tsHasErr = false; out.tsHasRes = false; out.tsEmpty = true;",
                "out.tsHasErr = false; out.tsHasRes = false; out.tsEmpty = true; out.tsRun = () => this.tsRunNow(); this._tsWhy = ''; out.tsRunStatus = /^Not run/.test(S.tsRunMsg || '') ? S.tsRunMsg : 'Choose the time variable and outcome, then press Run.';")
    c = replace(c, "if (res.error) { out.tsHasErr = true; out.tsErr = res.error; }",
                "if (res.error) { out.tsHasErr = true; out.tsErr = res.error; this._tsWhy = res.error; out.tsRunStatus = 'Fix the message below, then press Run.'; }")
    c = replace(c, "out.tsEmpty = false; out.tsHasRes = true;",
                "out.tsEmpty = false; out.tsHasRes = !!S.tsRan; out.tsRunStatus = S.tsRan ? (/^Not run/.test(S.tsRunMsg || '') ? '' : S.tsRunMsg || '') : 'Ready — press Run to fit the model.';")
    return c


def integrate_component(c):
    methods = (ROOT / 'src/ts-simple.js').read_text().rstrip()
    if C_BEGIN in c:
        c = re.sub(re.escape(C_BEGIN) + '.*?' + re.escape(C_END), lambda _: methods, c, flags=re.S)
    else:
        c = c.replace('  descFor() {', methods + '\n  descFor() {', 1)
    return integrate_tab3(integrate_tab2(integrate_tab(c)))


def integrate_engine(e):
    e = re.sub(r'\n*' + re.escape(E_BEGIN) + '.*?' + re.escape(E_END) + r'\n?', '\n', e, flags=re.S).rstrip()
    return e + '\n\n' + E_BEGIN + '\n' + (ROOT / 'src/ts-dates.mjs').read_text() + '\n' + E_END + '\n'


LAYOUT_MARK = '<!-- GM26 ts layout v1 -->'
LABEL = "<div style=\"display: flex; flex-direction: column; gap: 4px;\"><div style=\"font-family: var(--fMono, 'Space Mono', monospace); font-size: 10.5px; letter-spacing: 0.12em; color: var(--c5D5648, #5D5648);\">"


def element_end(s, start, tag):
    """Index just past the element that opens at s[start] (matching <tag ...> / </tag>)."""
    depth = 0
    for m in re.finditer(r'<' + tag + r'\b|</' + tag + r'>', s[start:]):
        depth += -1 if m.group(0).startswith('</') else 1
        if depth == 0:
            return start + m.end()
    raise RuntimeError('ts_simple: unbalanced <' + tag + '>')


def cut(s, start_text, after=0, tag='div'):
    a = s.index(start_text, after)
    b = element_end(s, a, tag)
    return s[:a] + s[b:], s[a:b]


def integrate_layout(t):
    """Time series tab in Stata order: variables first; diagnostics, script and dataset tools folded away."""
    if LAYOUT_MARK in t:
        return t
    a = t.index('<sc-if value="{{ isTs }}"')
    b = element_end(t, a, 'sc-if')
    blk = t[a:b]
    # 1 · the time / unit / outcome row comes before the calendar controls; analyse + period range live in the controls file
    row_at = blk.index('<div style="display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap;">', blk.index('<!-- GM26 setup controls end -->'))
    blk, row = cut(blk, '<div style="display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap;">', row_at - 1)
    row, _ = cut(row, LABEL + 'ANALYSE</div>')
    row, _ = cut(row, LABEL + 'PERIOD RANGE</div>')
    blk = blk.replace('<!-- GM26 setup controls begin -->', row + '\n' + '<!-- GM26 setup controls begin -->', 1)
    # 2 · event: date, what changes and AR(1) in view; name and per-unit event dates under More event options
    ev_at = blk.index('2 · THE EVENT (SHOCK / INTERVENTION)')
    blk, name = cut(blk, LABEL + 'EVENT NAME</div>', ev_at)
    blk, enc = cut(blk, LABEL + 'OR EACH UNIT’S ENCODED EVENT PERIOD</div>', ev_at)
    over_at = blk.index('<sc-if value="{{ tsHasOverrides }}"', ev_at)
    more_ev = ('<details class="ts-setup-more ts-ev-more"><summary>More event options — name the event, or give each unit its own event date</summary>'
               '<div class="ts-setup-more-body" style="flex-direction: row; flex-wrap: wrap; gap: 16px;">' + name + enc + '</div></details>\n')
    blk = blk[:over_at] + more_ev + blk[over_at:]
    # 3 · results: table → model chart → before/after → interpretation; diagnostics, script and add-variables folded
    res_at = blk.index('<sc-if value="{{ tsHasRes }}"')
    diag_start = blk.index('<div style="margin-top: 12px; border-top: 1px solid var(--cE5DBCB, #E5DBCB); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">', res_at)
    blk, diag = cut(blk, blk[diag_start:diag_start + 60], diag_start)
    d_title = re.search(r'\s*<div style="font-family: var\(--fMono, \'Space Mono\', monospace\); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: var\(--c194F39, #194F39\);[^"]*">D · INTERRUPTED TIME SERIES MODEL[^<]*</div>', diag)
    if not d_title:
        raise RuntimeError('ts_simple: D title not found')
    diag = diag[:d_title.start()] + diag[d_title.end():]
    chart_at = blk.index('<div role="img" aria-label="{{ alt_tsChartEl.label }}">{{ tsChartEl }}</div>', res_at)
    blk = blk[:chart_at] + '<div style="margin-top: 14px;">' + d_title.group(0).strip() + '</div>\n' + blk[chart_at:]
    pre_at = blk.index('<pre style="margin: 12px 0 0;', res_at)
    pre_end = element_end(blk, pre_at, 'pre')
    pre = blk[pre_at:pre_end]
    folded = ('<details class="ts-fold"><summary>Diagnostics — describe the series, stationarity (ADF), autocorrelation (ACF / PACF)</summary>' + diag + '</details>\n'
              '<details class="ts-fold"><summary>Stata / R script for this analysis</summary>' + pre + '</details>\n')
    blk = blk[:pre_at] + folded + blk[pre_end:]
    add_at = blk.index('4 · ADD THE EVENT VARIABLES', res_at)
    card_at = blk.rindex('<div style="background: var(--cFFFFFF, #FFFFFF); border: 1px solid var(--cE3DCCE, #E3DCCE); border-radius: 9px;', 0, add_at)
    blk, card = cut(blk, blk[card_at:card_at + 80], card_at)
    blk, interp = cut(blk, '<sc-if value="{{ interpOn }}"', res_at, 'sc-if')
    end_res = element_end(blk, res_at, 'sc-if') - len('</sc-if>')
    blk = blk[:end_res] + interp + '\n<details class="ts-fold ts-fold-card"><summary>Add the event variables to the dataset (to use them in Regression and other tabs)</summary>' + card + '</details>\n' + blk[end_res:]
    return t[:a] + LAYOUT_MARK + blk + t[b:]


def integrate_template(t):
    css = '<style>' + (ROOT / 'src/ts-simple.css').read_text().strip() + '</style>'
    if T_MARK in t:
        t = re.sub(re.escape(T_MARK) + r'<style>.*?</style>', lambda _: T_MARK + css, t, count=1, flags=re.S)
    else:
        t = T_MARK + css + t
    return integrate_runbar(integrate_layout(t))


RUN_MARK = '<!-- GM26 ts run v1 -->'


def integrate_runbar(t):
    # Run button at the end of the event card; results appear after the first Run
    if RUN_MARK in t:
        return t
    anchor = '{{ tsTypeHint }}</div>\n              </div>\n              <sc-if value="{{ tsHasErr }}"'
    t = replace(t, anchor, '{{ tsTypeHint }}</div>\n' + RUN_MARK + '<div class="ts-runbar"><button type="button" class="ts-run" data-testid="time-series-run" sc-camel-on-click="{{ tsRun }}">Run</button><span class="ts-run-status" role="status" data-testid="time-series-run-status">{{ tsRunStatus }}</span></div>\n              </div>\n              <div id="ts-results-anchor"></div>\n              <sc-if value="{{ tsHasErr }}"')
    return t
