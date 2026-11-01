"""Tests ▾ → T-tests (Compare means) and Tests ▾ → Correlation (the correlation matrix), build .62.

  component  src/compare-means.js       → the block marked "GM26 compare means" in src/app/component.js
             src/correlation-matrix.js  → the block marked "GM26 correlation matrix"
  template   src/compare-means.css and the two pages → the block marked "GM26 compare means" in template.html
             (the first run replaces the earlier "GM26 unified t-tests" block)

Called by tools/build.py. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULES = [
    ('compare-means.js', '  // GM26 compare means begin', '  // GM26 compare means end'),
    ('correlation-matrix.js', '  // GM26 correlation matrix begin', '  // GM26 correlation matrix end'),
]
T_BEGIN, T_END = '<!-- GM26 compare means begin -->', '<!-- GM26 compare means end -->'
OLD_BEGIN, OLD_END = '<!-- GM26 unified t-tests begin -->', '<!-- GM26 unified t-tests end -->'


def integrate_component(c):
    for name, begin, end in MODULES:
        methods = (ROOT / 'src' / name).read_text().rstrip()
        if begin in c:
            a = c.index(begin)
            b = c.index(end, a) + len(end)
            c = c[:a] + methods + c[b:]
        else:
            i = c.index('  descFor() {')
            c = c[:i] + methods + '\n' + c[i:]
    return c


def template_block():
    css = ' '.join(l.strip() for l in (ROOT / 'src' / 'compare-means.css').read_text().splitlines() if l.strip() and not l.strip().startswith('/*'))
    css = css.replace('}}', '} }').replace('{{', '{ {')  # never a template binding
    return (T_BEGIN + '<style>' + css + '</style>'
            '<sc-if value="{{ isTtest }}" hint-placeholder-val="{{ false }}"><div data-screen-label="t-tests">{{ cmEl }}</div></sc-if>'
            '<sc-if value="{{ isCorr }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Correlation matrix">{{ corEl }}</div></sc-if>'
            + T_END)


def integrate_template(t):
    for begin, end in ((T_BEGIN, T_END), (OLD_BEGIN, OLD_END)):
        if begin in t:
            a = t.index(begin)
            b = t.index(end, a) + len(end)
            return t[:a] + template_block() + t[b:]
    raise RuntimeError('compare_means: no t-tests block in the template')
