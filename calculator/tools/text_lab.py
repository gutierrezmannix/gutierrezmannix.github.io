"""Text analysis redesign (Design A) and the Excel (.xlsx) reader.

Integrates into calculator/index.html, idempotently:
  engine     src/text-lab-data.mjs, src/text-lab-stem.mjs, src/text-lab-engine.mjs, src/xlsx-reader.mjs
  component  src/text-lab.js, text-lab-ui.js, text-lab-explore.js, text-lab-measure.js, text-lab-save.js
  template   the Text analysis tab (src/text-lab.css), Excel in the file prompts, sheet picker
  assets     src/lemmas/*_lemma_lookup.json.gz (lazy, decompressed on demand)

Run:  python3 calculator/tools/build.py   (this module is one step of the build)
Test: node --test calculator/tests/text-lab.test.mjs calculator/tests/xlsx.test.mjs
"""
import sys
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import breakdown  # noqa: E402  univariate tab: break down by groups
import net_lab  # noqa: E402  networks analysis (Design A)
import data_edit  # noqa: E402  edit data (Design A)
import chart_builder  # noqa: E402  chart builder (Design A)
PAGE = ROOT / 'index.html'
ENGINE = '7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'
BUILD = '2026-11-01.54'
LANGS = ['es', 'en', 'pt', 'fr']


def one(text, old, new, what):
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'text_lab: expected one anchor for {what}, found {n}: {old[:90]}')
    return text.replace(old, new)


def between(text, begin, end, body, anchor=None, before=True):
    """Replace the block between markers, or insert it at the anchor the first time."""
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    if anchor is None:
        return text.rstrip() + '\n\n' + body + '\n'
    i = text.index(anchor)
    return text[:i] + body + '\n' + text[i:] if before else text[:i + len(anchor)] + body + text[i + len(anchor):]


def sc_end(t, start):
    level = 0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>', t[start:]):
        level += -1 if m[0].startswith('</') else 1
        if level == 0:
            return start + m.end()
    raise RuntimeError('text_lab: unbalanced sc-if')


def integrate_engine(e):
    begin, end = '// GM26 text lab module begin', '// GM26 text lab module end'
    src = '\n'.join((ROOT / 'src' / f).read_text() for f in ['text-lab-data.mjs', 'text-lab-stem.mjs', 'text-lab-engine.mjs', 'xlsx-reader.mjs'])
    return between(e, begin, end, begin + '\n' + src.rstrip() + '\n' + end)


def integrate_component(c):
    # 1. the tab renders the new text lab instead of the old blocks
    if '// GM26 text lab render' not in c:
        a = c.index("    out.isText = S.tab === 'text';")
        b = c.index('    if (out.isSem) {', a)
        c = c[:a] + "    out.isText = S.tab === 'text';\n    // GM26 text lab render\n    if (out.isText) out.tlEl = this.tlRender();\n" + c[b:]
    # 2. methods
    methods = ''.join((ROOT / 'src' / f).read_text() for f in ['text-lab.js', 'text-lab-ui.js', 'text-lab-explore.js', 'text-lab-measure.js', 'text-lab-save.js'])
    c = between(c, '  // GM26 text lab begin', '  // GM26 text lab end', methods.rstrip(), anchor='  descFor() {')
    # 3. sessions keep the text lab settings
    if '"guideOn","tl"' not in c:
        if c.count('"ttY2","guideOn"]') != 2:
            raise RuntimeError('text_lab: session key lists changed')
        c = c.replace('"ttY2","guideOn"]', '"ttY2","guideOn","tl"]')
    # 4. Excel files load through the workbook reader (re-applied on every run, so edits here take effect)
    original = '      data = isDta ? await E.parseDTA(buf, prog) : kind === \'sav\' ? (this.setState({ parseStage: \'reading the SPSS file\' }), await E.parseSAV(buf, prog)) : await E.parseCSV(buf, prog);'
    if '// GM26 xlsx ingest' in c:
        a = c.index('      // GM26 xlsx ingest\n')
        b = c.index('      else ' + original.strip(), a) + len('      else ' + original.strip())
        c = c[:a] + original + c[b:]
    c = one(c, original,
                '      // GM26 xlsx ingest\n'
                '      const isZip = u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 3 && u8[3] === 4, isOle = u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;\n'
                '      this._xlsx = null;\n'
                '      if (isZip || isOle || /\\.(xlsx|xlsm|xltx|xltm|xls)$/i.test(name)) { this.setState({ parseStage: \'reading the Excel workbook\' }); data = await E.parseXLSX(buf, prog, { sheet: extra && extra.xlSheetPick != null ? extra.xlSheetPick : undefined }); if (data.xlsx && data.xlsx.sheets.length > 1) { this._xlsx = { buf, name, sheets: data.xlsx.sheets, sheet: data.xlsx.sheet }; setTimeout(() => this.flash(\'This workbook has \' + data.xlsx.sheets.length + \' sheets — showing “\' + data.xlsx.sheet + \'”. Pick another under Data information.\'), 900); } }\n'
                '      else data = isDta ? await E.parseDTA(buf, prog) : kind === \'sav\' ? (this.setState({ parseStage: \'reading the SPSS file\' }), await E.parseSAV(buf, prog)) : await E.parseCSV(buf, prog);',
                'xlsx ingest')
    if '// GM26 xlsx sheet picker' not in c:
        c = one(c, "    out.dimsText = this.fmtN(S.nRows) + ' ROWS × ' + S.cols.length + ' VARS';",
                "    out.dimsText = this.fmtN(S.nRows) + ' ROWS × ' + S.cols.length + ' VARS';\n"
                "    // GM26 xlsx sheet picker\n"
                "    out.xlHasSheets = !!(this._xlsx && this._xlsx.name === S.fileName);\n"
                "    out.xlSheetEl = out.xlHasSheets ? React.createElement('select', { className: 'tl-select', 'aria-label': 'Excel sheet', value: this._xlsx.sheet, onChange: e => { const X = this._xlsx; this.ingest(X.buf, X.name, { xlSheetPick: e.target.value }); } }, this._xlsx.sheets.map(s => React.createElement('option', { key: s.name, value: s.name }, s.name + (s.hidden ? ' (hidden)' : '')))) : null;",
                'sheet picker')
    # 5. the plot history names the text-lab charts
    c = c.replace("const TL = { ttest: 't-tests', one:", "const TL = { ttest: 't-tests', one:")
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 text lab begin -->', '<!-- GM26 text lab end -->'
    css = (ROOT / 'src' / 'text-lab.css').read_text()
    block = begin + '<style>' + css + '</style><sc-if value="{{ isText }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Text analysis">{{ tlEl }}</div></sc-if>' + end
    if begin in t:
        a = t.index(begin)
        b = t.index(end, a) + len(end)
        t = t[:a] + block + t[b:]
    else:
        a = t.index('<sc-if value="{{ isText }}"')
        b = sc_end(t, a)
        t = t[:a] + block + t[b:]
    if '{{ xlSheetEl }}' not in t:
        t = one(t, '<div><dt>Dimensions</dt><dd>{{ dimsText }}</dd></div>',
                '<div><dt>Dimensions</dt><dd>{{ dimsText }}</dd></div><sc-if value="{{ xlHasSheets }}" hint-placeholder-val="{{ false }}"><div><dt>Excel sheet</dt><dd>{{ xlSheetEl }}</dd></div></sc-if>',
                'sheet row')
    t = t.replace('<span>CSV / TSV / STATA DTA / SAVED SESSIONS</span>', '<span>CSV / TSV / EXCEL XLSX / STATA DTA / SAVED SESSIONS</span>')
    if 'class="tl-formats"' not in t:
        t = re.sub(r'(>Drag a data file here</div>)', r'\1<div class="tl-formats">CSV · TSV · Excel (.xlsx) · Stata (.dta) · saved session</div>', t, count=1)
    return re.sub(r'2026-1[0-2]-\d{2}\.\d+', BUILD, t)


def main():
    """The page is built by tools/build.py (which runs this module's integrators with all the others)."""
    import build
    return build.main([])


if __name__ == '__main__':
    main()
