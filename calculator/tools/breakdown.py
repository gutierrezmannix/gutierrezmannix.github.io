"""Univariate tab: "Break down by groups" (tab / sum of a variable by one or two variables,
like Stata table, tabstat and tab ... if ...). Called from tools/text_lab.py."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _sc_end(t, start):
    level = 0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>', t[start:]):
        level += -1 if m[0].startswith('</') else 1
        if level == 0:
            return start + m.end()
    raise RuntimeError('breakdown: unbalanced sc-if')


def integrate_component(c):
    begin, end = '  // GM26 breakdown begin', '  // GM26 breakdown end'
    body = (ROOT / 'src' / 'breakdown.js').read_text().rstrip()
    if begin in c:
        a = c.index(begin); b = c.index(end, a) + len(end)
        c = c[:a] + body + c[b:]
    else:
        i = c.index('  descFor() {')
        c = c[:i] + body + '\n' + c[i:]
    if '// GM26 breakdown render' not in c:
        anchor = '    // ---------- CORRELATION ----------'
        if c.count(anchor) != 1:
            raise RuntimeError('breakdown: render anchor')
        c = c.replace(anchor, "    // GM26 breakdown render\n    out.obShow = !!(out.isOne && S.exploreVar && this.effMeta(S.exploreVar)); out.obEl = out.obShow ? this.obRender() : null;\n" + anchor)
    if '"guideOn","tl","ob"' not in c:
        if c.count('"guideOn","tl"]') != 2:
            raise RuntimeError('breakdown: session key lists changed')
        c = c.replace('"guideOn","tl"]', '"guideOn","tl","ob"]')
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 breakdown begin -->', '<!-- GM26 breakdown end -->'
    css = ('.ob-grid td.n{padding:2px 4px}.ob-none{display:block;text-align:right;padding:3px 6px;color:#AB9F8A;font-family:var(--fMono,monospace)}.mf-work button.ob-cell,button.ob-cell{border:1px solid transparent!important;background:none!important;box-shadow:none!important;min-height:0!important;margin:0!important}.mf-work button.ob-cell:hover,button.ob-cell:hover,.mf-work button.ob-cell.on,button.ob-cell.on{background:var(--cEDF5F0,#EDF5F0)!important}.mf-work button.ob-cell.on,button.ob-cell.on{border-color:var(--c2E7D58,#2E7D58)!important}.ob-cell{font:inherit;font-family:var(--fMono,monospace);font-size:11.5px;width:100%;text-align:right;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-end;gap:1px;color:var(--c1A1711,#1A1711)}'
           '.ob-cell:hover:not([disabled]){background:var(--cEDF5F0,#EDF5F0)}.ob-cell.on{border-color:var(--c2E7D58,#2E7D58);background:var(--cEDF5F0,#EDF5F0)}.ob-cell[disabled]{cursor:default;color:#AB9F8A}'
           '.ob-cell small{font-size:9.5px;color:var(--c6B6455,#6B6455)}.ob-tot td{font-weight:700;border-top:2px solid var(--c194F39,#194F39)}.ob-empty td{color:#AB9F8A}.ob-n{color:var(--c6B6455,#6B6455)}'
           '.ob-blk{text-align:center!important;border-left:1px solid var(--cE3DCCE,#E3DCCE)}.ob-detail{border:1px solid var(--cAFD2BF,#AFD2BF);border-radius:8px;padding:8px 10px;background:var(--cFAF7F1,#FAF7F1)}'
           '.ob-cmd{font-family:var(--fMono,monospace);font-size:12px;color:var(--c194F39,#194F39)}.tl-panel.ob{margin-top:8px}')
    block = begin + '<style>' + css + '</style><sc-if value="{{ obShow }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Break down by groups">{{ obEl }}</div></sc-if>' + end
    if begin in t:
        a = t.index(begin); b = t.index(end, a) + len(end)
        return t[:a] + block + t[b:]
    a = t.index('<sc-if value="{{ oxShow }}"')
    b = _sc_end(t, a)
    return t[:b] + block + t[b:]
