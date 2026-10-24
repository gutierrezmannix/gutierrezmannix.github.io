"""Integrate the dedicated analysis suite without replacing existing methods."""
import re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def integrate_component(c):
    begin,end='  // GM26 analysis suite begin','  // GM26 analysis suite end'
    methods=(ROOT/'src/analysis-suite.js').read_text().rstrip().replace('__ANALYSIS_CATALOG__',(ROOT/'src/analysis-catalog.json').read_text().strip()).replace('__ANALYSIS_SOURCE__',json.dumps((ROOT/'src/analysis-methods.R').read_text()))
    if begin in c:c=re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:methods,c,flags=re.S)
    else:c=c.replace('  descFor() {',methods+'\n  descFor() {',1)
    if '    this.analysisSuiteVals(out);' not in c:
        a=c.rindex('    return out;');c=c[:a]+'    this.analysisSuiteVals(out);\n'+c[a:]
    c=c.replace('"csPages","pX"','"csPages","analysisId","analysisSub","analysisPages","pX"')
    c=c.replace("csPages: {}, pX:","csPages: {}, analysisId: '__directory', analysisSub:'Setup', analysisPages: {}, pX:")
    if 'out.analysisStart = () =>' not in c:c=c.replace('    if (!out.showWork) return out;', '    out.analysisStart = () => this.asStart();\n    if (!out.showWork) return out;',1)
    return c

def integrate_template(t):
    marker='<!-- GM26 analysis directory -->'
    css='<style>'+(ROOT/'src/analysis-suite.css').read_text()+'</style>'
    if marker in t:t=re.sub(re.escape(marker)+r'<style>.*?</style>',lambda _:marker+css,t,count=1,flags=re.S)
    else:t=marker+css+t
    if '{{ analysisEl }}' not in t:t=t.replace('<sc-if value="{{ isChartSuite }}"', '<sc-if value="{{ isAnalysis }}" hint-placeholder-val="{{ false }}">{{ analysisEl }}</sc-if>\n          <sc-if value="{{ isChartSuite }}"',1)
    if '{{ analysisStart }}' not in t:t=t.replace('Create your own dataset</a>', 'Create your own dataset</a><p><button onClick="{{ analysisStart }}" style="border:1.5px solid #698477;border-radius:7px;background:#FFFEFA;color:#194F39;padding:12px 18px;cursor:pointer;font:inherit;">Use summary statistics or plan a study</button></p>',1)
    return t
