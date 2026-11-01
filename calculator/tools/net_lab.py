"""Networks analysis (Design A): eight guided steps, readable maps and an MCMC ERGM like R's ergm().
Replaces the old "Network model (ERGM)" tab. Called from tools/text_lab.py.

  engine     src/net-lab-engine.mjs, src/net-lab-layout.mjs, src/net-lab-ergm.mjs
  component  src/net-lab.js, src/net-lab-steps.js, src/net-lab-model.js
  template   src/net-lab.css and the tab block
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_FILES = ['net-lab-engine.mjs', 'net-lab-layout.mjs', 'net-lab-ergm.mjs']
COMPONENT_FILES = ['net-lab.js', 'net-lab-steps.js', 'net-lab-model.js']


def _sc_end(t, start):
    level = 0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>', t[start:]):
        level += -1 if m[0].startswith('</') else 1
        if level == 0:
            return start + m.end()
    raise RuntimeError('net_lab: unbalanced sc-if')


def _between(text, begin, end, body, anchor):
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    i = text.index(anchor)
    return text[:i] + body + '\n' + text[i:]


def integrate_engine(e):
    begin, end = '// GM26 net lab module begin', '// GM26 net lab module end'
    src = '\n'.join((ROOT / 'src' / f).read_text() for f in ENGINE_FILES)
    body = begin + '\n' + src.rstrip() + '\n' + end
    # CSV files saved by Excel on Windows (cp1252) are read correctly instead of showing replacement characters
    e = e.replace("const text = new TextDecoder('utf-8').decode(buf).replace(/^\\uFEFF/, '');", "const text = nlDecodeText(buf).replace(/^\\uFEFF/, ''); // GM26 text encoding")
    if begin in e:
        a = e.index(begin)
        b = e.index(end, a) + len(end)
        return e[:a] + body + e[b:]
    return e.rstrip() + '\n\n' + body + '\n'


def integrate_component(c):
    methods = ''.join((ROOT / 'src' / f).read_text() for f in COMPONENT_FILES if (ROOT / 'src' / f).exists())
    c = _between(c, '  // GM26 net lab begin', '  // GM26 net lab end', methods.rstrip(), '  descFor() {')
    if '// GM26 net lab render' not in c:
        old = "out.isSem = S.tab === 'sem'; out.isErgm = S.tab === 'ergm';"
        if c.count(old) != 1:
            raise RuntimeError('net_lab: render anchor')
        c = c.replace(old, old + "\n    // GM26 net lab render\n    if (out.isErgm) out.nlEl = this.nlRender();")
    if '"ob","nl"]' not in c:
        if c.count('"guideOn","tl","ob"]') != 2:
            raise RuntimeError('net_lab: session key lists changed')
        c = c.replace('"guideOn","tl","ob"]', '"guideOn","tl","ob","nl"]')
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 net lab begin -->', '<!-- GM26 net lab end -->'
    css = (ROOT / 'src' / 'net-lab.css').read_text()
    block = begin + '<style>' + css + '</style><sc-if value="{{ isErgm }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Networks analysis">{{ nlEl }}</div></sc-if>' + end
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        return t[:a] + block + t[b:]
    a = t.index('<sc-if value="{{ isErgm }}"')
    b = _sc_end(t, a)
    return t[:a] + block + t[b:]
