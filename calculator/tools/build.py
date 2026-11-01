#!/usr/bin/env python3
"""Build calculator/index.html from its sources.

    python3 calculator/tools/build.py            build index.html and version.json
    python3 calculator/tools/build.py --check    exit 1 if index.html or src/app/* are out of date
    python3 calculator/tools/build.py --extract  recreate src/app/ from the current index.html (recovery only)

index.html is a build output: a single self-contained page (it works offline and from a downloaded copy).
Everything in it comes from files in this repository:

  src/app/page.html        the outer page and its unpacking loader
  src/app/template.html    the page template (the component is inserted at @@COMPONENT@@)
  src/app/component.js     the page logic (one React class component)
  src/app/engine.mjs       the statistics engine: parsing, statistics, charts
  src/app/assets.json      the order and type of every embedded asset
  src/app/embedded/        fonts, React, the design-system runtime, the world map (stored exactly as embedded)
  src/app/ext_resources.json
  src/engine/**/*.mjs     the analysis engine of the Tests menu (validated against R; bundled with Node)
  src/*.js, *.mjs, *.css   feature modules; the tools/*.py integrators copy them into the blocks marked
                           "GM26 … begin" / "GM26 … end" in component.js, template.html and engine.mjs
  src/lemmas/*.json.gz     lemma tables (embedded as they are, decompressed in the page only when used)

The build runs every integrator, writes the result back to src/app/ (so src/app always shows exactly what the
page runs) and packs index.html. Edit code outside the marked blocks in src/app/*; edit code inside a block in
the module it names (src/…), because the next build copies the module over the block.
"""
import base64
import gzip
import json
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
ROOT = TOOLS.parent
APP = ROOT / 'src' / 'app'
PAGE = ROOT / 'index.html'
ENGINE = '7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'
BUILD = '2026-11-01.54'
LANGS = ['es', 'en', 'pt', 'fr']
SCRIPT = r'<script type="__bundler/{}">(.*?)</script>'
COMPONENT = re.compile(r'(<script type="text/x-dc"[^>]*>)(.*?)(</script>)', re.S)


# ---------- reading and writing the packed page ----------
def unpack(h):
    """index.html → its parts (the shell keeps placeholders where the packed scripts were)."""
    parts = {}
    for key in ('manifest', 'template', 'ext_resources'):
        m = re.search(SCRIPT.format(key), h, re.S)
        parts[key] = m
    manifest = json.loads(parts['manifest'][1])
    template = json.loads(parts['template'][1])
    ext = json.loads(parts['ext_resources'][1])
    shell = h
    for key, ph in sorted([('manifest', '@@MANIFEST@@'), ('template', '@@TEMPLATE@@'), ('ext_resources', '@@EXT@@')], key=lambda kv: -parts[kv[0]].start(1)):
        m = parts[key]
        shell = shell[:m.start(1)] + ph + shell[m.end(1):]
    return shell, manifest, template, ext


def pack(shell, manifest, template, ext):
    h = shell
    h = h.replace('@@MANIFEST@@', '\n' + json.dumps(manifest, separators=(',', ':')) + '\n  ', 1)
    h = h.replace('@@EXT@@', '\n' + json.dumps(ext, separators=(',', ':')) + '\n  ', 1)
    h = h.replace('@@TEMPLATE@@', json.dumps(template, ensure_ascii=False).replace('</', '<\\/'), 1)
    return h


def split_component(template):
    m = COMPONENT.search(template)
    return template[:m.start(2)] + '@@COMPONENT@@' + template[m.end(2):], m[2]


def join_component(template, component):
    if template.count('@@COMPONENT@@') != 1:
        raise RuntimeError('build: src/app/template.html must contain @@COMPONENT@@ once')
    return template.replace('@@COMPONENT@@', component)


# ---------- src/app ----------
def extract(h=None):
    """Write src/app/ from a packed index.html."""
    h = h if h is not None else PAGE.read_text()
    shell, manifest, template, ext = unpack(h)
    template, component = split_component(template)
    (APP / 'embedded').mkdir(parents=True, exist_ok=True)
    assets = []
    for uid, a in manifest.items():
        if uid == ENGINE:
            assets.append({'uuid': uid, 'source': 'engine', 'mime': a['mime']})
            (APP / 'engine.mjs').write_text(gzip.decompress(base64.b64decode(a['data'])).decode())
            continue
        lang = next((x['id'][6:] for x in ext if x.get('uuid') == uid and str(x.get('id', '')).startswith('lemma_')), None)
        if lang:
            assets.append({'uuid': uid, 'source': 'lemma', 'lang': lang, 'mime': a['mime']})
            continue
        ext_name = {'font/woff2': '.woff2', 'application/javascript': '.js.gz', 'text/javascript': '.js.gz'}.get(a['mime'], '.bin')
        if not a.get('compressed'):
            ext_name = {'font/woff2': '.woff2'}.get(a['mime'], '.bin')
        f = 'embedded/' + uid + ext_name
        (APP / f).write_bytes(base64.b64decode(a['data']))
        assets.append({'uuid': uid, 'source': 'file', 'file': f, 'mime': a['mime'], 'compressed': a.get('compressed', False)})
    (APP / 'page.html').write_text(shell)
    (APP / 'template.html').write_text(template)
    (APP / 'component.js').write_text(component)
    (APP / 'assets.json').write_text(json.dumps(assets, indent=1) + '\n')
    (APP / 'ext_resources.json').write_text(json.dumps(ext, indent=1) + '\n')


def load_app():
    shell = (APP / 'page.html').read_text()
    template = (APP / 'template.html').read_text()
    component = (APP / 'component.js').read_text()
    engine = (APP / 'engine.mjs').read_text()
    assets = json.loads((APP / 'assets.json').read_text())
    ext = json.loads((APP / 'ext_resources.json').read_text())
    return shell, template, component, engine, assets, ext


# ---------- the build ----------
def integrate(template, component, engine):
    """Every integrator, in order. Each one is idempotent: re-running it on its own output changes nothing."""
    import text_lab, breakdown, net_lab, data_edit, chart_builder, analysis_suite
    text_lab.BUILD = BUILD
    full = join_component(template, component)
    m = COMPONENT.search(full)
    c = m[2]
    c = text_lab.integrate_component(c)
    c = breakdown.integrate_component(c)
    c = net_lab.integrate_component(c)
    c = data_edit.integrate_component(c)
    c = chart_builder.integrate_component(c)
    c = analysis_suite.integrate_component(c)
    full = full[:m.start(2)] + c + full[m.end(2):]
    t = text_lab.integrate_template(full)
    t = breakdown.integrate_template(t)
    t = net_lab.integrate_template(t)
    t = data_edit.integrate_template(t)
    t = chart_builder.integrate_template(t)
    t = analysis_suite.integrate_template(t)
    t = re.sub(r'2026-1[0-2]-\d{2}\.\d+', BUILD, t)
    e = text_lab.integrate_engine(engine)
    e = net_lab.integrate_engine(e)
    e = chart_builder.integrate_engine(e)
    e = sync_analysis_engine(e)
    template, component = split_component(t)
    return template, component, e


def sync_analysis_engine(e):
    """The R-validated analysis engine (src/engine/**/*.mjs, bundled by tools/engine/bundle.mjs) replaces its block in place."""
    import analysis_engine
    a = e.index(analysis_engine.BEGIN)
    b = e.index(analysis_engine.END, a) + len(analysis_engine.END)
    return e[:a] + analysis_engine.integrate_engine('').strip() + e[b:]


def build():
    shell, template, component, engine, assets, ext = load_app()
    template, component, engine = integrate(template, component, engine)
    manifest = {}
    for a in assets:
        uid = a['uuid']
        if a['source'] == 'engine':
            manifest[uid] = {'mime': a['mime'], 'compressed': True, 'data': base64.b64encode(gzip.compress(engine.encode(), mtime=0)).decode()}
        elif a['source'] == 'lemma':
            data = (ROOT / 'src' / 'lemmas' / f"{a['lang']}_lemma_lookup.json.gz").read_bytes()
            manifest[uid] = {'mime': a['mime'], 'compressed': False, 'data': base64.b64encode(data).decode()}
        else:
            entry = {'mime': a['mime'], 'compressed': a['compressed'], 'data': base64.b64encode((APP / a['file']).read_bytes()).decode()}
            manifest[uid] = entry
    h = pack(shell, manifest, join_component(template, component), ext)
    h = re.sub(r'2026-1[0-2]-\d{2}\.\d+', BUILD, h)
    return h, template, component, engine


def outputs():
    h, template, component, engine = build()
    return {
        PAGE: h,
        ROOT / 'version.json': json.dumps({'build': BUILD}) + '\n',
        APP / 'template.html': template,
        APP / 'component.js': component,
        APP / 'engine.mjs': engine,
    }


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if '--extract' in argv:
        extract()
        print('Extracted src/app/ from index.html')
        return 0
    out = outputs()
    if '--check' in argv:
        stale = [str(p.relative_to(ROOT)) for p, text in out.items() if not p.exists() or p.read_text() != text]
        if stale:
            print('Out of date (run python3 calculator/tools/build.py):', ', '.join(stale))
            return 1
        print('index.html and src/app are up to date with the sources')
        return 0
    for p, text in out.items():
        if not p.exists() or p.read_text() != text:
            p.write_text(text)
    h = out[PAGE]
    print('Built GM26.1', BUILD, f'({len(h.encode()) / 1048576:.1f} MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
