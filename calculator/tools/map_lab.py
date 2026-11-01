"""Map page (Charts → Map): a country's states or municipalities, the world, or the user's own boundary file.

  engine     src/map-lab.mjs (geometry, projections, insets, color classes, matching) — added by tools/chart_builder.py
  component  src/map-lab.js (the page: where, which column says the place, matching table, what to show, Customize)
  template   src/map-lab.css
  data       src/maps/*.json.gz (built-in maps, see tools/maps/README.md), embedded by tools/build.py

Replaces the two older map pages ('map' world map, 'geomap' uploaded boundaries); both ids open this page.
Called by tools/build.py. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BEGIN, END = '  // GM26 map lab begin', '  // GM26 map lab end'


def _one(text, old, new, what):
    if new in text:
        return text
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'map_lab: expected 1 anchor for {what}, found {n}')
    return text.replace(old, new)


def integrate_component(c):
    methods = BEGIN + '\n' + (ROOT / 'src' / 'map-lab.js').read_text().rstrip() + '\n' + END
    if BEGIN in c:
        a = c.index(BEGIN)
        b = c.index(END, a) + len(END)
        c = c[:a] + methods + c[b:]
    else:
        i = c.index('  descFor() {')
        c = c[:i] + methods + '\n' + c[i:]
    c = _one(c, '    this.cbVals(out);\n', '    this.cbVals(out);\n    this.mlVals(out);\n', 'render hook')
    # the legacy-renderer condition is owned by tools/chart_builder.py (it also skips the Map page)
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 map lab begin -->', '<!-- GM26 map lab end -->'
    block = begin + '<style>' + (ROOT / 'src' / 'map-lab.css').read_text() + '</style>' + end
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        return t[:a] + block + t[b:]
    i = t.index('<!-- GM26 chart directory -->')
    return t[:i] + block + t[i:]
