"""Built-in statistical engine: embeds src/engine/engine.bundle.js in the page's engine module.

The Tests-menu analyses run in JavaScript (validated against R) instead of downloading R (webR) from the
internet. The bundle is regenerated with Node (tools/engine/bundle.mjs) whenever src/engine/**/*.mjs changed.
"""
import hashlib
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src/engine'
BUNDLE = SRC / 'engine.bundle.js'
BEGIN, END = '// GM26 analysis engine begin', '// GM26 analysis engine end'


def source_hash():
    h = hashlib.sha256()

    def walk(d):
        for f in sorted(os.listdir(d)):
            p = d / f
            if p.is_dir():
                walk(p)
            elif f.endswith('.mjs'):
                h.update(str(p.relative_to(SRC)).replace(os.sep, '/').encode())
                h.update(p.read_bytes())
    walk(SRC)
    return h.hexdigest()[:16]


def bundle_text():
    want = source_hash()
    current = BUNDLE.read_text() if BUNDLE.exists() else ''
    if '(source hash ' + want + ')' not in current[:200]:
        subprocess.run(['node', str(ROOT / 'tools/engine/bundle.mjs')], check=True)
        current = BUNDLE.read_text()
        if '(source hash ' + want + ')' not in current[:200]:
            raise RuntimeError('analysis_engine: engine.bundle.js is out of date after bundling')
    return current


def integrate_engine(e):
    e = re.sub(r'\n*' + re.escape(BEGIN) + '.*?' + re.escape(END) + r'\n?', '\n', e, flags=re.S).rstrip()
    block = '\n'.join([
        BEGIN,
        bundle_text().rstrip(),
        'const GMEngine = GMEngineFactory();',
        'export function gmRun(packet) { return GMEngine.gmRun(packet); }',
        'export const GM_ENGINE_VERSION = GMEngine.ENGINE_VERSION;',
        '// Source for a Web Worker running the same engine (keeps the page responsive; Cancel terminates it).',
        "export function gmEngineSource() { return 'const GMWorker = (' + GMEngineFactory.toString() + ')();\\n' +",
        "  'onmessage = e => { let result; try { result = GMWorker.gmRun(e.data.packet); } catch (err) { result = { id: e.data.packet && e.data.packet.id, error: String(err && err.message || err), tables: [], plots: [], notes: [], warnings: [], diagnostics: [] }; } postMessage({ token: e.data.token, result }); };'; }",
        END,
    ])
    return e + '\n\n' + block + '\n'
