"""Chart builder (Design A): one look and one Customize panel for every chart in the Charts tab.

  engine     src/chart-builder.mjs (drawing), src/chart-builder-data.mjs (models; reuses the chart suite's statistics)
  component  src/chart-builder.js (data sentence, live chart, Customize: Labels · Values · Colors · Axes & size; gallery)
  template   src/chart-builder.css
Maps keep their current pages for now. Called from tools/text_lab.py.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _between(text, begin, end, body, anchor, after=False):
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    i = text.index(anchor)
    if after:
        i += len(anchor)
        return text[:i] + '\n' + body + text[i:]
    return text[:i] + body + '\n' + text[i:]


def _one(text, old, new, what, count=1):
    if new in text:
        return text
    n = text.count(old)
    if n != count:
        raise RuntimeError(f'chart_builder: expected {count} anchor(s) for {what}, found {n}')
    return text.replace(old, new)


def integrate_engine(e):
    begin, end = '// GM26 chart builder begin', '// GM26 chart builder end'
    src = (ROOT / 'src' / 'chart-builder.mjs').read_text() + '\n' + (ROOT / 'src' / 'chart-builder-data.mjs').read_text()
    return _between(e, begin, end, begin + '\n' + src.rstrip() + '\n' + end, '// GM26 chart engine end', after=True)


def integrate_component(c):
    methods = (ROOT / 'src' / 'chart-builder.js').read_text()
    c = _between(c, '  // GM26 chart builder begin', '  // GM26 chart builder end', '  // GM26 chart builder begin\n' + methods.rstrip() + '\n  // GM26 chart builder end', '  descFor() {')
    c = _one(c, '    this.chartSuiteVals(out);', '    this.chartSuiteVals(out);\n    this.cbVals(out);', 'render hook')
    c = _one(c, 't.content=this.csMenu(R)', 't.content=this.cbMenu(R)', 'Charts menu')
    c = _one(c, '    if (out.isPlots && this._E.csInfo(S.plotKind)?.legacy) {', '    if (out.isPlots && this._E.csInfo(S.plotKind)?.legacy && !this.cbHandles(S.plotKind)) {', 'legacy charts')
    # live redraw: one Plots-pane entry per chart page, updated in place
    c = _one(c, 'if (prev && prev.key === key && prev.name === name && now - prev.at < 2500)', 'if (prev && prev.key === key && (/^cb-/.test(key) || (prev.name === name && now - prev.at < 2500)))', 'plot history')
    c = _one(c, '"plotKind","csPages"', '"plotKind","csPages","cbNames","cbColors"', 'session keys', 2)
    c = _one(c, "plotKind: '__directory', csPages: {},", "plotKind: '__gallery', csPages: {},", 'start page', 2)
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 chart builder begin -->', '<!-- GM26 chart builder end -->'
    block = begin + '<style>' + (ROOT / 'src' / 'chart-builder.css').read_text() + '</style>' + end
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        return t[:a] + block + t[b:]
    i = t.index('<!-- GM26 chart directory -->')
    return t[:i] + block + t[i:]
