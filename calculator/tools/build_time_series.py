#!/usr/bin/env python3
"""Update the self-contained calculator bundle from its time-series sources.

Run from any directory: python calculator/tools/build_time_series.py
The original asset bundle is retained. Only the engine, calendar controls and
time-series integration are changed. Re-running is deterministic.
"""
import base64
import gzip
import json
import re
from pathlib import Path
from commandbar import integrate_component as integrate_commandbar_component, integrate_template as integrate_commandbar_template
from network import integrate_engine as integrate_network_engine, integrate_component as integrate_network_component, integrate_template as integrate_network_template
from tests_menu import integrate_component as integrate_tests_menu
from ttests import integrate_component as integrate_ttests_component, integrate_template as integrate_ttests_template, integrate_engine as integrate_ttests_engine
from jade_shell import integrate_template as integrate_jade_shell
from audit_fixes import integrate_component as repair_component, integrate_template as repair_template, integrate_engine as repair_engine
from scatter_ranges import integrate_component as range_component, integrate_template as range_template, integrate_engine as range_engine
from model_guide import integrate_component as guide_component, integrate_template as guide_template

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'index.html'
ENGINE = '7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'
BUILD = '2026-10-23.19'


def replace(text, before, after, count=1):
    actual = text.count(before)
    if actual != count:
        raise RuntimeError(f'Expected {count} integration anchor(s), found {actual}: {before[:100]}')
    return text.replace(before, after)


def integrate_component(c):
    if '// GM26 calendar setup v4' in c:
        return c
    if '// GM26 calendar setup v3' in c:
        c = replace(c, '// GM26 calendar setup v3', '// GM26 calendar setup v4')
        c = replace(c, "numeric: S.cols.filter(c => c.type === 'numeric').map(c => c.name), missing, common", "numeric: S.cols.filter(c => c.type === 'numeric').map(c => c.name), valueLabels: Object.fromEntries(Object.entries(this._raw.vlabs || {}).map(([k,v]) => [k, v instanceof Map ? [...v.entries()] : Array.isArray(v) ? v : []])), missing, common")
        c = replace(c, "'tsEvVar','tsType','tsAr1'].forEach", "'tsEvVar','tsType','tsAr1','subg','flt','missingCodes','autoScreen'].forEach")
        return c
    if '// GM26 calendar setup v2' in c:
        c = replace(c, '// GM26 calendar setup v2', '// GM26 calendar setup v3')
        a = c.index('    if (out.isTs) {'); b = c.index('    {\n      const xn = S.exploreVar',a)
        ts = c[a:b].replace('e2.target.value.replace(/[^0-9.\\-]/g', 'e2.target.value.replace(/[^0-9.Qq\\-]/g')
        ts = replace(ts, '        if (evv && okU) {', '        let eventConflict = false;\n        if (evv && okU) {')
        ts = replace(ts, 'if (u != null && isFinite(ea[i]) && events[String(u)] == null) events[String(u)] = ea[i];', 'if (u != null && isFinite(setup.fullTime[i]) && isFinite(ea[i])) { if (events[String(u)] != null && events[String(u)] !== ea[i]) eventConflict = true; events[String(u)] = ea[i]; }')
        ts = replace(ts, "        const invalid = badDate ?", "        const eventError = eventConflict ? 'The event variable changes within a unit. Supply one consistent encoded intervention date per unit.' : avg && evv ? 'For an average series, enter its common intervention date directly rather than selecting a unit event variable.' : evv && (!okU || prep.unit.some(u => !isFinite(events[String(u)]))) ? 'Each selected unit needs an observed encoded event date. Missing dates are not interpreted as untreated controls.' : '';\n        const invalid = eventError || (badDate ?")
        ts = replace(ts, ": prep.error;\n        const res = invalid", ": prep.error);\n        const res = invalid")
        c = c[:a]+ts+c[b:]
        return integrate_component(c)
    if '// GM26 calendar setup v1' in c:
        c = replace(c, '// GM26 calendar setup v1', '// GM26 calendar setup v2')
        c = replace(c, "const lv = this.nvLevels(uv), q =", "const lv = setup.levels, q =")
        a = c.index("        if (evv && okU)"); b = c.index("        const t0 = E.tsPeriod", a)
        c = c[:a] + '''        if (evv && okU) {
          const ea = this.numVals(evv).a;
          for (let i = 0; i < ea.length; i++) { const u = setup.config.unit[i]; if (u != null && isFinite(ea[i]) && events[String(u)] == null) events[String(u)] = ea[i]; }
        }
        const uLab = setup.config.unit;
''' + c[b:]
        c = replace(c, "const uA = okU ? (c2 => c2.kind === 'num' ? Array.from(c2.a, v => isFinite(v) ? E.numLab(v) : null) : c2.a)(this.valsCore(uv)) : null;", "const uA = okU ? setup.config.unit : null;")
        return integrate_component(c)
    c = replace(c, 'class Component extends DCLogic {', '// GM26 calendar setup v1\nclass Component extends DCLogic {')
    c = replace(c, "    tsT: null,", "    tsInputMode: '', tsFreq: '', tsPart: '', tsTarget: 'same', tsAggregate: 'none', tsSource: '', tsSourceValue: '', tsCount: '', tsPop: '', tsScale: '100000',\n    tsT: null,")
    extra = '"tsInputMode","tsFreq","tsPart","tsTarget","tsAggregate","tsSource","tsSourceValue","tsCount","tsPop","tsScale",'
    c = replace(c, '["treat","ax","semMethod"', '[' + extra + '"treat","ax","semMethod"', 2)
    # A new dataset starts with a fresh calendar configuration; saved sessions override it.
    c = replace(c, "        parsing: false, screen: 'work', tab: 'one',", "        tsT: null, tsU: null, tsY: '', tsInputMode: '', tsFreq: '', tsPart: '', tsTarget: 'same', tsAggregate: 'none', tsSource: '', tsSourceValue: '', tsCount: '', tsPop: '', tsScale: '100000', tsEv: '', tsEvU: {}, tsEvVar: '', tsSel: [], tsAll: false, tsAvg: false, tsT0: '', tsT1: '',\n        parsing: false, screen: 'work', tab: 'one',")
    c = replace(c, "    if (S.tab === 'plots' && S.pX", "    if (S.tab === 'ts') return this._tsLast || null;\n    if (S.tab === 'plots' && S.pX")
    c = replace(c, '  cmdText(d, dial) { const s =', "  cmdText(d, dial) { if (d.t === 'ts') return dial === 'stata' ? d.stata : d.r; const s =")
    c = replace(c, "    if (d.t === 'tsvars' || d.t === 'gen01')", "    if (d.t === 'ts' || d.t === 'tsvars' || d.t === 'gen01')")
    c = replace(c, "  tableFor(d) {", "  tableFor(d) {\n    if (d.t === 'ts') return d.tbl || d.res || '';")
    c = replace(c, "  resFor(d) {", "  resFor(d) {\n    if (d.t === 'ts') return d.res || '';")
    c = replace(c, "  explFor(d) {", "  explFor(d) {\n    if (d.t === 'ts') return 'Time series with explicit calendar preparation: ' + (d.res || '');")
    c = replace(c, "    if (d.t === 'tsvars') { this.setState({ tab: 'ts' }); return; }", "    if (d.t === 'ts') { this.setState(Object.assign({ tab: 'ts' }, d.setup || {})); return; }\n    if (d.t === 'tsvars') { this.setState({ tab: 'ts' }); return; }")
    # tsset configures a series. It does not run a model and must not export an invalid if qualifier.
    c = replace(c, "const patch = b ? { tsU: a, tsT: b } : { tsT: a, tsU: '' }; this.stataLog(s);", "const patch = Object.assign({ tsInputMode: 'existing', tsFreq: 'generic', tsTarget: 'same', tsAggregate: 'none' }, b ? { tsU: a, tsT: b } : { tsT: a, tsU: '' });")
    start = c.index('      const findC = names =>', c.index('    if (out.isTs) {'))
    end = c.index("      const tr = S.tsTr || 'level';", start)
    c = c[:start] + '''      this._tsLast = null;
      const setup = E.tsSetupControls(this, out, mkPicker, chipS);
      const { tv, uv, yv, okT, okU, okY } = setup;
''' + c[end:]
    # Dates entered by users are interpreted at the analysis frequency.
    c = replace(c, "      const tm = okT ? this.effMeta(tv) : null; out.tsT0Ph = tm ? E.numLab(tm.mn) : 'start'; out.tsT1Ph = tm ? E.numLab(tm.mx) : 'end';", "      out.tsT0Ph = out.tsPeriodFormat; out.tsT1Ph = out.tsPeriodFormat;")
    c = replace(c, "const x2 = parseFloat(v); if (isFinite(x2) && sel.includes(u))", "const x2 = E.tsPeriod(v, setup.effective); if (isFinite(x2) && sel.includes(u))")
    c = replace(c, 'const common = parseFloat(S.tsEv), events = {};', 'const common = E.tsPeriod(S.tsEv, setup.effective), events = {};')
    c = replace(c, "        const t0 = parseFloat(S.tsT0), t1 = parseFloat(S.tsT1);", "        const t0 = E.tsPeriod(S.tsT0, setup.effective), t1 = E.tsPeriod(S.tsT1, setup.effective);")
    a = c.index("        const res = this.memo('ts|", c.index('    if (out.isTs) {'))
    b = c.index('        if (res.error)', a)
    c = c[:a] + '''        const prepKey = JSON.stringify([setup.mode, setup.frequency, setup.part, setup.source, S.tsSourceValue, setup.effective, S.tsAggregate, S.tsCount, S.tsPop, S.tsScale, tv, uv, yv, all, sel, avg, t0, t1]);
        const prep = this.memo('tsprep|' + prepKey, () => E.tsPrepare(Object.assign({}, setup.config, { selected: okU && !all ? new Set(sel) : null, start: t0, end: t1, average: avg })));
        out.tsHasPreparation = true;
        const sourceText = setup.source ? setup.source + ' = ' + this.vlabel(setup.source, S.tsSourceValue) : 'all sources';
        const ruleText = ({ none: 'observations retained', sum: 'sum of original counts', mean: 'mean of original values (original measure units retained)', rate: 'sum of counts / one period-level population × ' + (S.tsScale || 100000) })[S.tsAggregate || 'none'];
        out.tsPrepared = prep.inputRows + ' source rows → ' + (prep.valid || 0) + ' valid ' + setup.effective + ' unit–periods. ' + sourceText + '. ' + ruleText + '. ' + (prep.nUnits || 0) + ' units. ' + prep.incomplete + ' incomplete/missing periods; ' + prep.gaps + ' interior gaps. Unweighted estimation; survey weights do not apply here.';
        const badDate = (S.tsEv && !isFinite(common)) || (S.tsT0 && !isFinite(t0)) || (S.tsT1 && !isFinite(t1)) || Object.entries(ovr).some(([u,v]) => v && sel.includes(u) && !isFinite(E.tsPeriod(v, setup.effective)));
        const eventsVary = (avg || prep.nUnits > 1) && new Set(Object.values(events).filter(isFinite)).size > 1;
        const invalid = badDate ? 'Enter dates as ' + out.tsPeriodFormat + '.' : (isFinite(t0) && isFinite(t1) && t0 > t1) ? 'The start period must not be after the end period.' : eventsVary ? 'Different intervention dates need a dedicated staggered-intervention design. Select one common-date set of units or estimate units separately.' : prep.error;
        const res = invalid ? { error: invalid } : this.memo('ts|' + prepKey + JSON.stringify([tr,common,events,ty,!!S.tsAr1]), () => E.tsAnalyze({ t: prep.t, y: prep.y, unit: okU ? prep.unit : null, sel: null, events, common: evv ? NaN : common, type: ty, ar1: !!S.tsAr1, transform: tr, avg, t0, t1, tname: setup.effective }));
        out.tsValidation = res.error || 'Validated: one observation per unit and original period; no automatic duplicate averaging. Calendar gaps remain missing.';
''' + c[b:]
    c = replace(c, "          const ylab = (tr === 'diff'", "          const preparedName = S.tsAggregate === 'rate' ? (S.tsCount + ' per ' + (S.tsScale || 100000) + ' population (' + setup.effective + ')') : S.tsAggregate === 'mean' ? 'mean of ' + yv + ' (' + setup.effective + ' periods)' : S.tsAggregate === 'sum' ? 'sum of ' + yv + ' (' + setup.effective + ')' : yv;\n          const ylab = (tr === 'diff'")
    c = replace(c, "tr === 'pct' ? '% change in ' : '') + yv;", "tr === 'pct' ? '% change in ' : '') + preparedName;")
    c = replace(c, "xlab: tv, ylab, evlab: evl", "xlab: setup.effective + ' period', frequency: setup.effective, ylab, evlab: evl")
    c = replace(c, "'event ' + E.numLab(s2.E)", "'event ' + E.tsDateLabel(s2.E, setup.effective)")
    c = replace(c, "E.numLab(s2.t0) + '–' + E.numLab(s2.t1)", "E.tsDateLabel(s2.t0, setup.effective) + '–' + E.tsDateLabel(s2.t1, setup.effective)")
    c = replace(c, "v: st ? 'STATIONARY' : 'UNIT ROOT (NON-STATIONARY)'", "v: st ? 'REJECT UNIT ROOT' : 'UNIT ROOT NOT REJECTED'")
    a = c.index('          out.tsAdfNote ='); b = c.index('\n',a)
    c = c[:a] + "          out.tsAdfNote = 'ADF tests a unit-root null; failure to reject is not proof of a unit root. Structural breaks, seasonality and sample size affect this test. Passing ADF does not validate an intervention model, and differencing changes the effect being estimated. Assess the specified trend and residual dependence.';" + c[b:]
    c = c.replace("' per ' + tv", "' per ' + setup.effective")
    c = c.replace("', so check the result with ANALYSE \\u2192 CHANGE FROM LAST PERIOD. '", "'. Evaluate trend specification and residual dependence before choosing a transformation. '")
    c = c.replace("' stationary, so a spurious trend is unlikely. '", "' inconsistent with a unit root under this test specification; this alone does not validate the model. '")
    a = c.index('          const q2 = s2 =>', c.index('    if (out.isTs) {')); b = c.index('          const pfx =',a)
    c = c[:a] + '''          const missing = {};
          for (const col of S.cols.filter(c => c.type === 'numeric')) {
            const codes = [...this.toks().nums, ...(S.autoScreen ? (col.autoCodes || []) : [])].filter(Number.isFinite);
            if (codes.length) missing[col.name] = [...new Set(codes)];
          }
          const scripts = E.tsScripts({ setup, state: S, conditions: this.conds(), names: this._raw.names, numeric: S.cols.filter(c => c.type === 'numeric').map(c => c.name), missing, common, events, summary: out.tsPrepared }, prep, res);
          const stata = scripts.stata, rCode = scripts.r;
          out.tsCmd = S.dialect === 'r' ? rCode : stata;
''' + c[b:]
    c = replace(c, "            const raw = this._raw, n = raw.n, tA = this.valsCore(tv).a,", "            if (setup.effective !== setup.frequency || S.tsAggregate === 'rate') { this.setState({ tsMsg: 'The analysis uses prepared periods. Export its complete preparation script to create variables at that level; aggregate-period lags are not written onto the original rows.' }); return; }\n            const raw = this._raw, n = raw.n, tA = setup.fullTime,")
    c = replace(c, "if (tA[i] === tA[j]) continue;", "if (tA[i] - tA[j] !== 1) continue;")
    c = replace(c, "          this._tsLast = { t: 'ts', r: rCode, stata };", "          const replay = {}; [...setup.fields, 'tsT','tsU','tsY','tsSel','tsAll','tsAvg','tsTr','tsT0','tsT1','tsEv','tsEvU','tsEvVar','tsType','tsAr1'].forEach(k => { if (S[k] !== undefined) replay[k] = S[k]; });\n          this._tsLast = { t: 'ts', r: rCode, stata, sg: [], setup: replay, res: out.tsPrepared, tbl: 'Term\\tEstimate\\tSE\\tt\\tp\\n' + out.tsRows.map(r => [r.term,r.b,r.se,r.t,r.p].join('\\t')).join('\\n') };")
    return integrate_component(c)


def integrate_engine(e):
    if '// GM26 calendar validation v2' in e:
        return e
    if '// GM26 calendar validation v1' in e:
        e = replace(e, '// GM26 calendar validation v1', '// GM26 calendar validation v2')
        e = replace(e, "  series = series.filter(s => s.pts.length >= (o.ar1 ? 2 : 1));", "  if (series.some(s => s.pts.some((p,i) => i > 0 && p.t - s.pts[i-1].t !== 1))) return { error: 'The transformation creates interior missing periods (for example, percentage changes after zero). Select a suitable contiguous range or a different transformation.' };\n  series = series.filter(s => s.pts.length >= (o.ar1 ? 2 : 1));")
        e = replace(e, "  if (n < P + 3) return { error:", "  if (n < P + 3 + (fe ? series.length : 0)) return { error:")
        return e
    e = replace(e, 'export function tsAnalyze(o) {', '''// GM26 calendar validation v1
export function tsAnalyze(o) {
  const seen = new Set();
  for (let i = 0; i < o.t.length; i++) {
    const t = o.t[i], u = o.unit ? o.unit[i] : 'all';
    if (!Number.isFinite(t) || u == null || (o.sel && o.sel.size && !o.sel.has(String(u))) || (isFinite(o.t0) && t < o.t0) || (isFinite(o.t1) && t > o.t1)) continue;
    const key = JSON.stringify([String(u),t]);
    if (seen.has(key)) return { error: 'Repeated unit–period records: validate the calendar setup and resolve measurements before estimation.' };
    seen.add(key);
  }''')
    e = replace(e, "  if (!series.length) return { error: 'no rows with both a time value and an outcome value' };", "  if (!series.length) return { error: 'no rows with both a time value and an outcome value' };\n  if (series.some(s => s.pts.some((p,i) => i > 0 && p.t - s.pts[i-1].t !== 1))) return { error: 'Missing calendar periods: this estimator requires a contiguous observed range. Gaps are never treated as adjacent periods.' };")
    # Full fixed-effect rank is needed in the finite-sample covariance correction.
    e = replace(e, '((n - 1) / (n - P))', '((n - 1) / (n - P - (fe ? series.length : 0)))')
    start = e.index('export function tsChart('); end = e.index('export function acfChart(',start)
    chart = e[start:end].replace('numLab(Math.round(v))', 'tsDateLabel(v, o.frequency)').replace('numLab(E)', 'tsDateLabel(E, o.frequency)')
    e = e[:start] + chart + e[end:]
    return integrate_engine(e)


def integrate_navigation(c):
    """Keep all analysis tools in Tests across rebuilds."""
    if '// GM26 tests navigation v2' in c:
        return c
    if '// GM26 tests navigation v1' in c:
        c = replace(c, '// GM26 tests navigation v1', '// GM26 tests navigation v2')
        c = replace(c, "['Regression', goT({ tab: 'reg' })]", "['Regression', goT({ tab: 'reg' })],\n        ['Time series', goT({ tab: 'ts' })],\n        ['Text analysis', goT({ tab: 'text' })],\n        ['Networks', goT({ tab: 'ergm' })],\n        ['SEM', goT({ tab: 'sem' })]")
        a = c.index('      const tightNav = !!S.mfNavTight, MENU_ONLY =')
        b = c.index('      const NAVG =', a)
        c = c[:a] + "      const MENU_ONLY = ['tests', 'datam'];\n      const NAV_TESTS = ['two', 'reg', 'ts', 'text', 'ergm', 'sem'], NAV_DATA = ['overview', 'browse', 'data'];\n      const navName = { overview: 'Overview', browse: 'Browse', data: 'Edit data' };\n" + c[b:]
        c = replace(c, "].concat(tightNav ? [] : [['sem', 'SEM', null, 'Structural equation models and confirmatory factor analysis']]).concat([", "].concat([")
        c = ''.join(line for line in c.splitlines(keepends=True) if not line.lstrip().startswith("['more', NAV_MORE.includes(S.tab)"))
        c = replace(c, "id === 'tests' ? ['two', 'reg'].includes(S.tab) : id === 'more' ? NAV_MORE.includes(S.tab)", "id === 'tests' ? NAV_TESTS.includes(S.tab)")
        c = replace(c, 'Pick a test \\u2014 t-tests, ANOVA, chi-square, correlation, regression \\u2014 and go straight to it', 'Choose an analysis: t-tests, ANOVA, chi-square, correlation, regression, time series, text analysis, networks or SEM')
        return c
    c = replace(c, 'class Component extends DCLogic {', '// GM26 tests navigation v1\nclass Component extends DCLogic {')
    c = c.replace('Two variables', 'Correlation')
    lines = c.splitlines(keepends=True)
    c = ''.join(line for line in lines if not line.lstrip().startswith(("['two', 'Correlation', null,", "['reg', 'Regression', [[")))
    c = replace(c, "['Correlation test: Pearson and Spearman',", "['Correlation',")
    c = replace(c, "['Regression: OLS, logit, ordered logit, Poisson',", "['Regression',")
    c = replace(c, "const on = id === 'more' ? NAV_MORE.includes(S.tab)", "const on = id === 'tests' ? ['two', 'reg'].includes(S.tab) : id === 'more' ? NAV_MORE.includes(S.tab)")
    return integrate_navigation(c)


def main():
    h = PAGE.read_text()
    ms = re.search(r'<script type="__bundler/manifest">(.*?)</script>', h, re.S)
    ts = re.search(r'<script type="__bundler/template">(.*?)</script>', h, re.S)
    manifest, template = json.loads(ms[1]), json.loads(ts[1])
    match = re.search(r'(<script type="text/x-dc"[^>]*>)(.*?)(</script>)',template,re.S)
    component = integrate_ttests_component(integrate_tests_menu(integrate_network_component(integrate_commandbar_component(integrate_navigation(integrate_component(match[2]))))))
    template = template[:match.start(2)] + component + template[match.end(2):]
    controls = (ROOT/'src/time-series-controls.html').read_text()
    begin, end = '<!-- GM26 setup controls begin -->', '<!-- GM26 setup controls end -->'
    if begin in template:
        template = re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:begin+controls+end,template,flags=re.S)
    else:
        anchor = '                <div style="display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap;">'
        loc = template.index(anchor,template.index('TIME SERIES — 1 · SET UP THE DATA'))
        template = template[:loc] + begin + controls + end + '\n' + template[loc:]
        a = template.index('TIME SERIES — 1 · SET UP THE DATA'); b = template.index('3 · RESULTS',a)
        part = template[a:b].replace('>TIME VARIABLE</div>', '>{{ tsTimeLabel }}</div>').replace('>YEARS</div>', '>PERIOD RANGE</div>').replace('>EVENT YEAR</div>', '>EVENT DATE / PERIOD</div>').replace('OR EACH UNIT’S YEAR FROM A VARIABLE', 'OR EACH UNIT’S ENCODED EVENT PERIOD').replace('leave the year blank to fit a simple trend', 'leave the event blank to fit a simple trend').replace('placeholder="e.g. 2000"', 'placeholder="{{ tsPeriodFormat }}"').replace('width: 90px; font-weight: 700;', 'width: 190px; font-weight: 700;')
        part = part.replace('like Stata tsset / xtset: which variable is time, and (for panels) which is the unit', 'Define the calendar, unit and measurement source before estimation. Keep the original frequency by default.')
        marker = '              <div style="background: var(--cFFFFFF, #FFFFFF); border: 1px solid var(--cE3DCCE, #E3DCCE); border-radius: 9px; box-shadow: 0 1px 3px rgba(43,39,30,0.06); padding: 10px 14px;">'
        eventcard = part.index(marker,part.index('WHICH UNITS?'))
        summary = '<sc-if value="{{ tsHasPreparation }}" hint-placeholder-val="{{ false }}"><div class="ts-setup-summary" role="status" data-testid="time-series-preparation-summary">{{ tsPrepared }}</div><div class="ts-setup-warning" data-testid="time-series-validation">{{ tsValidation }}</div></sc-if>\n'
        part = part[:eventcard] + summary + part[eventcard:]
        template = template[:a] + part + template[b:]
    template = integrate_ttests_template(integrate_network_template(integrate_jade_shell(integrate_commandbar_template(template))))
    match = re.search(r'(<script type="text/x-dc"[^>]*>)(.*?)(</script>)', template, re.S)
    template = template[:match.start(2)] + guide_component(range_component(repair_component(match[2]))) + template[match.end(2):]
    template = guide_template(range_template(repair_template(template)))
    asset = manifest[ENGINE]
    e = gzip.decompress(base64.b64decode(asset['data'])).decode()
    mod_begin, mod_end = '// GM26 time-series module begin', '// GM26 time-series module end'
    e = re.sub(re.escape(mod_begin)+'.*?'+re.escape(mod_end),'',e,flags=re.S).rstrip()
    e = range_engine(repair_engine(integrate_ttests_engine(integrate_network_engine(integrate_engine(e))))).rstrip()
    e += '\n\n'+mod_begin+'\n'+(ROOT/'src/time-series-setup.mjs').read_text()+'\n'+mod_end+'\n'
    asset['data'] = base64.b64encode(gzip.compress(e.encode(),mtime=0)).decode()
    manifest_json = json.dumps(manifest,separators=(',',':'))
    template = template.replace('Two variables', 'Correlation')
    template = template.replace('.mf-navwrap:has(> .mf-nav[data-nav="datam"]) { margin-left: auto;', '.mf-navwrap:has(> .mf-nav[data-nav="datam"]) { margin-left: 4px;')
    template = re.sub(r'2026-10-23\.\d+', BUILD, template)
    for a,b,new in sorted([(ms.start(1),ms.end(1), '\n'+manifest_json+'\n  '),(ts.start(1),ts.end(1),json.dumps(template,ensure_ascii=False).replace('</','<\\/'))],reverse=True):
        h = h[:a] + new + h[b:]
    PAGE.write_text(h)
    (ROOT/'version.json').write_text(json.dumps({'build':BUILD})+'\n')
    print('Built explicit time-series setup:',BUILD)


if __name__ == '__main__':
    main()
