"""Show estimation counts separately from dataset and subgroup counts."""
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def integrate_engine(e):
    begin, end = '// GM26 logistic validation begin', '// GM26 logistic validation end'
    module = (ROOT/'src/logit-validation.mjs').read_text().rstrip()
    if begin in e:
        e = re.sub(re.escape(begin)+'.*?'+re.escape(end), lambda _: module, e, flags=re.S)
    else:
        e = e.replace('export function glm(ya, preds, w, family, vce) {', module+'\nexport function glm(ya, preds, w, family, vce) {', 1)
    a = e.index('export function glm(')
    check = "  if (family === 'logistic') { const separation = logitPredictionCheck(X, yr, ri, preds, terms); if (separation) return logitPredictionError(separation, n, N - n); }\n"
    if check not in e: e = e[:a]+e[a:].replace('  const fit = irls(X, yr, wr, p, family);',check+'  const fit = irls(X, yr, wr, p, family);',1)
    start = e.index('  const fit = irls(X, yr, wr, p, family);', a)
    end_fit = e.index('  const fit0 = irls(', start)
    guard = """  const fit = irls(X, yr, wr, p, family);
  if (fit.error) return fit;
  if (family === 'logistic' && logitDirectionSeparates(X, yr, fit.b)) return logitPredictionError({ term: 'predictor combination', count: n, description: 'a linear combination of the predictors separates all complete observations' }, n, N - n);
  if (family === 'logistic' && !fit.converged) return { error: 'Logistic regression did not converge. Coefficients, p-values, confidence intervals and predictions are not reported. Check for separation, collinear predictors and poorly scaled variables before refitting.', errorCode: 'logit_nonconvergence', completeN: n, dropped: N - n };
"""
    e = e[:start]+guard+e[end_fit:]
    e = e.replace('converged: fit.converged && !sep, iters: fit.iters, refs, family', 'converged: fit.converged, iters: fit.iters, refs, family')
    return e

def integrate_component(c):
    begin, end = '  // GM26 regression sample reporting begin', '  // GM26 regression sample reporting end'
    methods = (ROOT/'src/regression-sample.js').read_text().rstrip()
    if begin in c:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end), lambda _: methods, c, flags=re.S)
    c = c.replace('  descFor() {', methods+'\n  descFor() {', 1)
    anchor = "          const mapNote = mdl === 'logistic'"
    if c.count(anchor) != 1: raise RuntimeError('Missing regression sample integration anchor')
    return c.replace(anchor, '          this.regressionSampleVals(out, M);\n'+anchor, 1)

def integrate_template(t):
    if '<!-- GM26 regression sample summary -->' in t: return t
    a = t.index('data-screen-label="Regression results"')
    b = t.index('<sc-for list="{{ sumCells }}"', a)
    e = t.index('</sc-for>', b)
    block = t[b:e].replace('style="background: var(--cFFFFFF, #FFFFFF); border:', 'title="{{ s.tip }}" style="background: var(--cFFFFFF, #FFFFFF); border:', 1)
    t = t[:b]+block+t[e:]
    end = t.index('</sc-for>', b)+len('</sc-for>')
    end = t.index('</div>', end)+len('</div>')
    summary = '\n<!-- GM26 regression sample summary --><p data-testid="regression-estimation-sample" role="status" style="margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: var(--c6B6455, #536159);">{{ regSampleText }}</p>'
    return t[:end]+summary+t[end:]
