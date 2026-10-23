"""Repairs for the October button audit; keep bundle rebuilds deterministic."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def once(text, old, new, count=1):
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f'Button repair anchor expected {count}, found {actual}: {old[:90]}')
    return text.replace(old, new)


def integrate_component(c):
    if '// GM26 button repairs v1' in c:
        a = c.index('  // GM26 button repairs v1'); b = c.index('  netKey(', a)
        return c[:a] + (ROOT/'src/button-repairs.js').read_text() + '\n' + (ROOT/'src/sem-run.js').read_text() + '\n' + c[b:]
    c = once(c, '  runSem() {', (ROOT/'src/button-repairs.js').read_text() + '\n  runSem() {')
    # Stored and exported numbers must not go through a display formatter.
    c = once(c, "Array.from(col.a, v => isFinite(v) ? this._E.numLab(v) : '')",
             "Array.from(col.a, v => this.numberText(v))", 2)
    c = once(c, "c.k === 'n' ? (isFinite(v) ? this._E.numLab(v) : '') : q(String(v == null ? '' : v))",
             "c.k === 'n' ? this.numberText(v) : q(String(v == null ? '' : v))")
    c = once(c, '/[",\\n]/.test(s)', '/[",\\r\\n]/.test(s)')
    # The report must be populated before the workbench-only early return.
    a = c.index('    if (out.showReport) {')
    b = c.index('\n    out.copyLogLabel', a)
    report = c[a:b].replace('out.conPrompt + this.cmdText', "(S.dialect === 'stata' ? '. ' : '> ') + this.cmdText")
    report = report.replace('S.conLog.map', '(S.conLog || []).map').replace('!S.conLog.length', '!(S.conLog || []).length')
    c = c[:a] + c[b:]
    c = once(c, '    if (!out.showWork) return out;', report + '\n    if (!out.showWork) return out;')
    # Do not let the plot-history dock overwrite main-chart validation.
    c = once(c, 'out.plotHas = nP > 0; out.plotEmpty = !nP;', 'out.plotHas = nP > 0; out.plotHistoryEmpty = !nP;')
    c = once(c, '    // ---- errors that offer the fix', '    out.plotReady = !!out.plotChartEl && !out.plotEmpty;\n\n    // ---- errors that offer the fix')
    for start, end in [('const sc = E.scatterChart(R, c, { key: \'psc|', 'const sc = E.scatterChart(R, c, { color: cSel, key: \'psc|'),
                       ('E.gboxChart(R, L, { key: \'pgb|', 'E.gboxChart(R, L, { color: cSel, key: \'pgb|'),
                       ('E.stackChart(R, ct, { key: \'pst|', 'E.stackChart(R, ct, { color: cSel, key: \'pst|')]:
        c = once(c, start, end)
    # Blob downloads survive the asynchronous rasterization step in Chrome.
    c = once(c, "const a = document.createElement('a'); a.href = url; a.download = p.name + '.png'; a.click();",
             "this.dlBlob(new Blob([this.b64bytes(url)], { type: 'image/png' }), p.name + '.png');")
    a = c.index('  dlSvg(key, name) {'); b = c.index('  // ---- SVG files', a)
    c = c[:a] + '''  dlSvg(key, name) {
    if (key === 'net') return this.downloadNetworkPng(name);
    const svg = this._svgs[key];
    if (!svg || !svg.isConnected) { this.flash('Nothing to save yet — run the analysis first'); return; }
    const vb = svg.viewBox.baseVal;
    return this.dlPlotAs({xml:this.svgExport(svg),w:vb.width,h:vb.height,name}, 'png');
  }

''' + c[b:]
    # Every model-edit callback clears its result immediately. The signature
    # guard also catches filters, missing-value rules and edits from other tabs.
    c = once(c, "const setF = (i, patch) => this.setState(s => ({ semF:", "const setF = (i, patch) => this.editSem(s => ({ semF:")
    c = once(c, "remove: () => this.setState(s => ({ semLink:", "remove: () => this.editSem(s => ({ semLink:")
    c = once(c, "out.semAddFactor = () => this.setState({ semF:", "out.semAddFactor = () => this.editSem({ semF:")
    c = once(c, 'this.setState({ semLink: cur, semP: paths, semZero: zero, semFit: null });', 'this.editSem({ semLink: cur, semP: paths, semZero: zero });')
    c = once(c, "click: () => this.setState({ semMethod: k }, () => { if (this.state.semFit) this.runSem(); })",
             "click: () => { const rerun = !!this.state.semFit; this.editSem({ semMethod: k }, () => { if (rerun) this.runSem(); }); }")
    a = c.index('  runSem() {'); b = c.index('  netKey(', a)
    c = c[:a] + (ROOT/'src/sem-run.js').read_text() + '\n' + c[b:]
    c = once(c, '      const fit = S.semFit;', "      const stale = !!S.semFit && this._semFitKey !== this.semFitKey();\n      const fit = stale ? null : S.semFit;\n      if (stale) { out.hasSemErr = true; out.semErr = 'Data or model changed. Run SEM again to update the results.'; }")
    return c


def integrate_engine(e):
    if '// GM26 chart color repairs v1' in e:
        return e
    a = e.index('export function scatterChart('); b = e.index('export function timeSeries(', a)
    section = once(e[a:b], 'stroke: PAL.blue, strokeOpacity:', 'stroke: o.color || PAL.blue, strokeOpacity:')
    e = e[:a] + section + e[b:]
    a = e.index('export function gboxChart('); b = e.index('// ---------- demo dataset', a)
    section = e[a:b].replace('PAL.cat[gi % PAL.cat.length]', 'plotColors(o.color)[gi % plotColors(o.color).length]')
    section = section.replace('PAL.cat[yi % PAL.cat.length]', 'plotColors(o.color)[yi % plotColors(o.color).length]')
    e = e[:a] + section + e[b:]
    return e + "\n// GM26 chart color repairs v1\nfunction plotColors(color) { return color ? [color, ...PAL.cat.filter(c => c.toLowerCase() !== color.toLowerCase())] : PAL.cat; }\n"


def integrate_template(t):
    if '<!-- GM26 button template repairs v1 -->' in t:
        return t
    t = once(t, '<sc-if value="{{ plotEmpty }}" hint-placeholder-val="{{ true }}">', '<sc-if value="{{ plotHistoryEmpty }}" hint-placeholder-val="{{ true }}">')
    a = t.index('<button sc-camel-on-click="{{ dlPlot }}"'); b = t.index('</button>', t.index('{{ dlPlot.svg }}', a)) + len('</button>')
    t = t[:a] + '<sc-if value="{{ plotReady }}" hint-placeholder-val="{{ false }}">' + t[a:b] + '</sc-if>' + t[b:]
    return '<!-- GM26 button template repairs v1 -->\n' + t
