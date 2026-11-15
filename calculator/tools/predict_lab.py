"""Predict (machine learning) tab, build .99.

  engine     src/predict-engine.mjs (design, splits, logit, lasso, tree, forest, boosting, knn, metrics, importance, pdp)
  component  src/predict-lab.js (the six steps; prRun in the worker)
  template   src/predict-lab.css and the tab block
Called from tools/build.py. Test: node --test calculator/tests/predict.test.mjs calculator/tests/predict-component.test.mjs
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _between(text, begin, end, body, anchor, after=False):
    if begin in text:
        a = text.index(begin)
        b = text.index(end, a) + len(end)
        return text[:a] + body + text[b:]
    i = text.index(anchor)
    if after:
        i += len(anchor)
        return text[:i] + '\n' + body + text[i:]
    return text[:i] + body + '\n' + text[i:]


def _one(text, old, new, what, count=1):
    if new in text:
        return text
    n = text.count(old)
    if n != count:
        raise RuntimeError(f'predict_lab: expected {count} anchor(s) for {what}, found {n}')
    return text.replace(old, new)


def integrate_engine(e):
    begin, end = '// GM26 predict lab engine begin', '// GM26 predict lab engine end'
    src = (ROOT / 'src' / 'predict-engine.mjs').read_text()
    return _between(e, begin, end, begin + '\n' + src.rstrip() + '\n' + end, '// GM26 chart builder end', after=True)


def integrate_component(c):
    methods = (ROOT / 'src' / 'predict-lab.js').read_text()
    c = _between(c, '  // GM26 predict lab begin', '  // GM26 predict lab end', methods.rstrip(), '  descFor() {')
    c = _one(c, "    out.isText = S.tab === 'text';", "    out.isText = S.tab === 'text';\n    out.isPredict = S.tab === 'predict'; if (out.isPredict) out.prEl = this.prRender();", 'render hook')
    c = _one(c, '"corSel","guideOn"', '"corSel","pr","guideOn"', 'session keys', 2)   # before guideOn: text_lab, breakdown and net_lab each look for guideOn,tl,ob,nl] contiguous
    c = _one(c, "text: 'Text analysis', ts:", "text: 'Text analysis', predict: 'Predict', ts:", 'tab titles', 2)
    return c


def integrate_template(t):
    begin, end = '<!-- GM26 predict lab begin -->', '<!-- GM26 predict lab end -->'
    block = begin + '<style>' + (ROOT / 'src' / 'predict-lab.css').read_text() + '</style><sc-if value="{{ isPredict }}" hint-placeholder-val="{{ false }}"><div data-screen-label="Predict">{{ prEl }}</div></sc-if>' + end
    return _between(t, begin, end, block, '<!-- GM26 text lab end -->', after=True)
