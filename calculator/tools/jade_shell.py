"""Apply the Jade shell using CSS and display markup only; never edit app logic."""
import re
from pathlib import Path


def icon(path):
    return '<svg class="mf-control-icon" width="15" height="15" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'


def integrate_template(t):
    css = (Path(__file__).resolve().parents[1] / 'src/shell-jade.css').read_text()
    start, end = '<!-- GM26 Jade shell begin -->', '<!-- GM26 Jade shell end -->'
    style = start + '<style>' + css + '</style>' + end
    t = re.sub(re.escape(start) + '.*?' + re.escape(end), '', t, flags=re.S)
    # Place the overrides after the original shell styles, rather than before them.
    anchor = '<nav class="site-back" aria-label="Site">'
    t = t.replace(anchor, style + '\n' + anchor, 1)
    if '<!-- GM26 Jade display markup -->' in t:
        return t
    marker = '<!-- GM26 Jade display markup -->'
    leaf = '<svg class="mf-ginkgo" width="35" height="24" sc-camel-view-box="0 0 60 42" aria-hidden="true" fill="currentColor"><path d="M29 35C23 30 8 32 2 24C4 11 14 3 23 3C27 3 29 9 30 11C32 7 33 3 37 3C47 3 57 13 58 24C52 31 39 30 31 35L31 41H28Z"></path><path d="M30 34L11 15M30 34L20 8M30 34L30 14M30 34L40 8M30 34L50 15" fill="none" stroke="#1C4A3D" stroke-width=".8" opacity=".55"></path></svg>'
    t = t.replace('<nav class="site-back" aria-label="Site">', '<nav class="site-back" aria-label="Site">' + marker + leaf, 1)
    icons = {
        'File ▾': icon('<path d="M3 7h6l2-3h5a2 2 0 0 1 2 2v3"></path><path d="M3 7v13h16l3-11H8l-3 8"></path>'),
        'Save session': icon('<path d="M4 3h13l4 4v14H3V3Z"></path><path d="M7 3v6h10V3M7 21v-8h10v8"></path>'),
        'Settings': icon('<path d="M4 6h16M4 12h16M4 18h16"></path><circle cx="9" cy="6" r="2" fill="var(--cFFFFFF, #FFFEFA)"></circle><circle cx="15" cy="12" r="2" fill="var(--cFFFFFF, #FFFEFA)"></circle><circle cx="8" cy="18" r="2" fill="var(--cFFFFFF, #FFFEFA)"></circle>'),
        'Help': icon('<circle cx="12" cy="12" r="9"></circle><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"></path>'),
    }
    a = t.index('class="mf-chooser mf-commandbar"')
    b = t.index('    <sc-if value="{{ mfSettingsOpen }}"', a)
    toolbar = t[a:b]
    for label, svg in icons.items():
        toolbar = toolbar.replace('>' + label + '</button>', '>' + svg + '<span>' + label + '</span></button>', 1)
    t = t[:a] + toolbar + t[b:]
    # Reuse existing render values. No data transformations, new state or controls.
    info = '''<section class="mf-data-information" aria-label="Data information">
          <h2 class="mf-section-heading">Data information</h2>
          <dl><div><dt>Dataset</dt><dd>{{ fileName }}</dd></div>
          <div><dt>Dimensions</dt><dd>{{ dimsText }}</dd></div>
          <div class="mf-data-state"><dd>{{ sbWeight }}</dd><dd>{{ sbFilter }}</dd></div></dl>
        </section>'''
    a = t.index('<div class="mf-col-data"')
    b = t.index('        </aside>', a) + len('        </aside>')
    t = t[:b] + '\n' + info + t[b:]
    # Group the existing plot toolbar under a heading; keep every event binding.
    a = t.index('<div class="mf-pane" data-screen-label="Plots pane">')
    b = t.index('<sc-if value="{{ mfPaneOutput }}"', a)
    pane = t[a:b]
    pane = pane.replace('<div class="mf-pane-bar">', '<div class="mf-plot-tools"><h3 class="mf-section-heading">Plot options</h3><div class="mf-pane-bar">', 1)
    pane = pane.replace('                    <sc-if value="{{ plotOne }}"', '                    </div>\n                    <sc-if value="{{ plotOne }}"', 1)
    pane = pane.replace('<div class="mf-plot-title">', '<h3 class="mf-section-heading mf-plot-preview-label">Plot preview</h3><div class="mf-plot-title">', 1)
    t = t[:a] + pane + t[b:]
    return t
