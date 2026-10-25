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


def integrate_component(c):
    methods = (ROOT / 'src/ts-simple.js').read_text().rstrip()
    if C_BEGIN in c:
        return re.sub(re.escape(C_BEGIN) + '.*?' + re.escape(C_END), lambda _: methods, c, flags=re.S)
    return c.replace('  descFor() {', methods + '\n  descFor() {', 1)


def integrate_engine(e):
    e = re.sub(r'\n*' + re.escape(E_BEGIN) + '.*?' + re.escape(E_END) + r'\n?', '\n', e, flags=re.S).rstrip()
    return e + '\n\n' + E_BEGIN + '\n' + (ROOT / 'src/ts-dates.mjs').read_text() + '\n' + E_END + '\n'


def integrate_template(t):
    css = '<style>' + (ROOT / 'src/ts-simple.css').read_text().strip() + '</style>'
    if T_MARK in t:
        return re.sub(re.escape(T_MARK) + r'<style>.*?</style>', lambda _: T_MARK + css, t, count=1, flags=re.S)
    return T_MARK + css + t
