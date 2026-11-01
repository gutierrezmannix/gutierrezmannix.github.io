"""Intro page (Design B, build .59): "What would you like to do today?" — task cards that open the file picker and go
to the chosen tool once the file has loaded, one drop zone for any file, and the unsaved work as "Continue" cards.

  template   src/intro.html replaces the "Load bay" section (between GM26 intro markers); src/intro.css
  component  src/intro.js (introVals, introApply); the old "Unsaved work" banners on the intro page are replaced by
             the Continue cards (the same autoRestore / autoDiscard actions)

Called by tools/build.py after the other integrators. Idempotent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TB, TE = '<!-- GM26 intro begin -->', '<!-- GM26 intro end -->'
CB, CE = '  // GM26 intro page begin', '  // GM26 intro page end'


def _once(text, old, new, what):
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError(f'intro_page: expected 1 anchor for {what}, found {text.count(old)}')
    return text.replace(old, new)


def integrate_template(t):
    body = TB + '\n' + (ROOT / 'src' / 'intro.html').read_text().strip() + '\n    ' + TE
    if TB in t:
        a = t.index(TB)
        b = t.index(TE, a) + len(TE)
        t = t[:a] + body + t[b:]
    else:
        a = t.index('<section data-screen-label="Load bay"')
        b = t.index('</section>', a) + len('</section>')
        t = t[:a] + body + t[b:]
    css_b, css_e = '<!-- GM26 intro css begin -->', '<!-- GM26 intro css end -->'
    block = css_b + '<style>' + (ROOT / 'src' / 'intro.css').read_text() + '</style>' + css_e
    if css_b in t:
        a = t.index(css_b)
        b = t.index(css_e, a) + len(css_e)
        return t[:a] + block + t[b:]
    i = t.index('<!-- GM26 chart directory -->')
    return t[:i] + block + t[i:]


def integrate_component(c):
    methods = CB + '\n' + (ROOT / 'src' / 'intro.js').read_text().rstrip() + '\n' + CE
    if CB in c:
        a = c.index(CB)
        b = c.index(CE, a) + len(CE)
        c = c[:a] + methods + c[b:]
    else:
        i = c.index('  descFor() {')
        c = c[:i] + methods + '\n' + c[i:]
    c = _once(c, '    if (!out.showWork) return out;', '    this.introVals(out);\n    if (!out.showWork) return out;', 'intro values')
    c = _once(c, '  renderVals() {\n    const S = this.state, E = this._E;', "  renderVals() {\n    const S = this.state, E = this._E;\n    if (this._introGoal && S.screen === 'work' && !S.parsing && this._raw) setTimeout(() => this.introApply(), 0);", 'go to the task after loading')
    c = _once(c, "if (!out.showWork && !S.parsing && S.screen !== 'work') (S.asList || []).slice(0, 3).forEach(r => {",
              "if (!out.showWork && !S.parsing && S.screen !== 'work' && !this.introVals) (S.asList || []).slice(0, 3).forEach(r => {", 'recent work banners')
    return c
