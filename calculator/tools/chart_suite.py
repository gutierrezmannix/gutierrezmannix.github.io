"""Dedicated chart workspaces; all existing chart implementations remain available."""
import re
from pathlib import Path
from stata_output import Nodes
ROOT=Path(__file__).resolve().parents[1]
def integrate_component(c):
    begin,end='  // GM26 chart suite begin','  // GM26 chart suite end'
    methods=(ROOT/'src/chart-suite.js').read_text().rstrip()
    if begin in c:c=re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:methods,c,flags=re.S)
    else:c=c.replace('  descFor() {',methods+'\n  descFor() {',1)
    c=c.replace('    if (out.isPlots) {','    if (out.isPlots && this._E.csInfo(S.plotKind)?.legacy) {')
    if '    this.chartSuiteVals(out);' not in c:
        a=c.rindex('    return out;');c=c[:a]+'    this.chartSuiteVals(out);\n'+c[a:]
    c=c.replace("if (S.tab === 'plots' && S.pX && S.plotKind !== 'matrix')","if (S.tab === 'plots' && this._E.csInfo(S.plotKind)?.legacy && S.pX && S.plotKind !== 'matrix')")
    # Session and autosave preserve per-page selections and boundaries.
    c=c.replace('"plotKind","pX"','"plotKind","csPages","pX"')
    c=c.replace("plotKind: 'hist',", "plotKind: '__directory', csPages: {},")
    # Capture a successful current model and computed predictions without refitting.
    if 'this._csModel = ' not in c:
        c=c.replace('          const cur = this.pubModel(M, mdl, oneLabel), saved = S.regTab || [];',"          this._csModel = {model:M,spec:this.regSpec(),dver:S.dver||0,data:this.dataSig()};\n          const cur = this.pubModel(M, mdl, oneLabel), saved = S.regTab || [];")
        c=c.replace('          if (!mg.error && !out.mgBusy && mg.series) {',"          if (!mg.error && !out.mgBusy && mg.series) {\n            this._csMargins = {result:mg,spec:this.regSpec(),dver:S.dver||0,data:this.dataSig(),by:byName};")
        c=c.replace('stats: { N: M.n,','df: M.dfR || M.n-1, stats: { N: M.n,')
    return c

def integrate_template(t):
    marker='<!-- GM26 chart directory -->'
    css='<style>'+(ROOT/'src/chart-suite.css').read_text()+'</style>'
    if marker in t:
        return re.sub(re.escape(marker)+r'<style>.*?</style>',lambda _:marker+css,t,count=1,flags=re.S)
    p=Nodes(t);n=p.at('{{ plotKindBtns }}','sc-for');n=n['parent'];t=t[:n['start']]+t[n['end']:]
    t=t.replace('<sc-if value="{{ isPlots }}" hint-placeholder-val="{{ false }}">','<sc-if value="{{ isChartSuite }}" hint-placeholder-val="{{ false }}">{{ chartSuiteEl }}</sc-if>\n          <sc-if value="{{ isPlotsLegacy }}" hint-placeholder-val="{{ false }}">{{ chartPageHeader }}',1)
    t=t.replace('<div class="mf-menu">\n                        <sc-for list="{{ t.items }}"','<div class="mf-menu">{{ t.content }}\n                        <sc-for list="{{ t.items }}"',1)
    return marker+css+t

def integrate_engine(e):
    begin,end='// GM26 chart engine begin','// GM26 chart engine end'
    e=re.sub(re.escape(begin)+'.*?'+re.escape(end),'',e,flags=re.S).rstrip()
    return e+'\n'+begin+'\n'+(ROOT/'src/chart-suite.mjs').read_text()+'\n'+end+'\n'
