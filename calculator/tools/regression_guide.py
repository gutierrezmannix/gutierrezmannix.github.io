"""Tests ▾ → Regression as eight steps (build .65).

  component  src/regression-guide.js  → the block marked "GM26 regression guide" in src/app/component.js
  template   src/regression-guide.css → the block marked "GM26 regression guide" in template.html, just before the
             Regression tab; the tab itself shows {{ rgEl }} and gates its own panels by step (rgSetup, rgFit, rgPub,
             rgClassic), edited directly in src/app/template.html

Called by tools/build.py. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
C_BEGIN, C_END = '  // GM26 regression guide begin', '  // GM26 regression guide end'
T_BEGIN, T_END = '<!-- GM26 regression guide begin -->', '<!-- GM26 regression guide end -->'
ANCHOR = '<sc-if value="{{ isReg }}" hint-placeholder-val="{{ false }}">'


def integrate_component(c):
    methods = (ROOT / 'src' / 'regression-guide.js').read_text().rstrip()
    if C_BEGIN in c:
        a = c.index(C_BEGIN)
        b = c.index(C_END, a) + len(C_END)
        return c[:a] + methods + c[b:]
    i = c.index('  descFor() {')
    return c[:i] + methods + '\n' + c[i:]


def integrate_template(t):
    css = ' '.join(l.strip() for l in (ROOT / 'src' / 'regression-guide.css').read_text().splitlines() if l.strip() and not l.strip().startswith('/*'))
    css = css.replace('}}', '} }').replace('{{', '{ {')  # never a template binding
    block = T_BEGIN + '<style>' + css + '</style>' + T_END
    if T_BEGIN in t:
        a = t.index(T_BEGIN)
        b = t.index(T_END, a) + len(T_END)
        return t[:a] + block + t[b:]
    i = t.index(ANCHOR)
    return t[:i] + block + '\n          ' + t[i:]
