"""Output view: the main area shows every command, result and chart in order (like Stata's Results window)
in place of the Tests and Charts directory pages. Console entries are time-stamped so they interleave
with charts."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BEGIN, END = '  // GM26 output view begin', '  // GM26 output view end'
T_MARK = '<!-- GM26 output view css -->'


def integrate_component(c):
    methods = (ROOT / 'src/output-view.js').read_text().rstrip()
    if BEGIN in c:
        c = re.sub(re.escape(BEGIN) + '.*?' + re.escape(END), lambda _: methods, c, flags=re.S)
    else:
        c = c.replace('  descFor() {', methods + '\n  descFor() {', 1)
    return c


def integrate_template(t):
    css = '<style>' + (ROOT / 'src/output-view.css').read_text().strip() + '</style>'
    if T_MARK in t:
        return re.sub(re.escape(T_MARK) + r'<style>.*?</style>', lambda _: T_MARK + css, t, count=1, flags=re.S)
    return T_MARK + css + t
