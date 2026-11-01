"""Console commands as Stata prints them (build .55).

  component  src/console-stata.js → the block marked "GM26 console commands" in src/app/component.js

Called by tools/build.py. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BEGIN, END = '  // GM26 console commands begin', '  // GM26 console commands end'


def integrate_component(c):
    methods = (ROOT / 'src' / 'console-stata.js').read_text().rstrip()
    if BEGIN in c:
        a = c.index(BEGIN)
        b = c.index(END, a) + len(END)
        return c[:a] + methods + c[b:]
    i = c.index('  descFor() {')
    return c[:i] + methods + '\n' + c[i:]
