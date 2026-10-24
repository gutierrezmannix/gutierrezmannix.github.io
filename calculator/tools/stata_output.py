"""Present existing results in Stata order without changing model calculations."""
import re
from html.parser import HTMLParser
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}

class Nodes(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text=text; self.lines=[0]+[m.end() for m in re.finditer('\n',text)]
        self.nodes=[]; self.stack=[]; self.feed(text)
    def position(self):
        line,col=self.getpos(); return self.lines[line-1]+col
    def handle_starttag(self, tag, attrs):
        start=self.position(); node={'tag':tag,'attrs':dict(attrs),'start':start,'openEnd':start+len(self.get_starttag_text()),'end':None,'parent':self.stack[-1] if self.stack else None,'children':[]}
        if self.stack:self.stack[-1]['children'].append(node)
        self.nodes.append(node)
        if tag in VOID:node['end']=node['openEnd']
        else:self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:self.stack.pop()['end']=self.position()+len(self.get_starttag_text())
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag:
                self.stack[i]['closeStart']=self.position();self.stack[i]['end']=self.position()+len(tag)+3
                self.stack=self.stack[:i];break
    def at(self, needle, tag=None):
        at=self.text.index(needle)
        found=[n for n in self.nodes if n['end'] and n['start']<=at<n['end'] and (not tag or n['tag']==tag)]
        if not found:raise RuntimeError('Missing output node: '+needle)
        return max(found,key=lambda n:n['start'])
    def raw(self,node):return self.text[node['start']:node['end']]

def integrate_component(c):
    begin,end='  // GM26 Stata output order begin','  // GM26 Stata output order end'
    module=(ROOT/'src/stata-output.js').read_text().rstrip()
    if begin in c:c=re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:module,c,flags=re.S)
    else:
        c=c.replace('  descFor() {',module+'\n  descFor() {',1)
        a=c.rindex('    return out;');c=c[:a]+'    this.stataOutputVals(out);\n'+c[a:]
    c=c.replace('          this.regressionSampleVals(out, M);\n', '          this.regressionSampleVals(out, M);\n          this.stataRegressionVals(out, M, mdl);\n') if 'this.stataRegressionVals(out, M, mdl);' not in c else c
    # The t-test builder refreshes its source methods on every build.
    anchor='    const report=this._ttLast;out.ttLog=()=>this.pushLog({...report});'
    if 'this.stataTtestSummary(out, options, r);' not in c:
        if c.count(anchor)!=1:raise RuntimeError('Missing t-test reporting anchor')
        c=c.replace(anchor,anchor+'\n    this.stataTtestSummary(out, options, r);',1)
    c=c.replace('out.coefRows = M.coefs.map(', 'out.coefRows = this.stataTerms(M.coefs).map(')
    c=c.replace("+ M.coefs.map(c => [this.termLab", "+ this.stataTerms(M.coefs).map(c => [this.termLab")
    c=c.replace('[...Mo.coefs, ...(Mo.cuts || [])].forEach', 'this.stataTerms([...Mo.coefs, ...(Mo.cuts || [])]).forEach')
    c=c.replace("rows: [...(Mo.coefs || []), ...(Mo.cuts || [])].map", "rows: this.stataTerms([...(Mo.coefs || []), ...(Mo.cuts || [])]).map")
    c=c.replace('out.tsRows = res.coefs.filter(', 'out.tsRows = this.stataTerms(res.coefs).filter(')
    c=c.replace("this.ttRecord(out,{mode:'groups',x:xa,y:xb});", "this.ttRecord(out,{mode:'groups',x:xa,y:xb,labels:[nA,nB]});")
    c=c.replace("+ rows.map(r => r.isHead ? r.term", "+ out.semRows.map(r => r.isHead ? r.term")
    return c

def reorder(t,needle,order,first_child=False):
    p=Nodes(t);n=p.at(needle,'sc-if')
    if first_child:n=n['children'][0]
    nodes=n['children']
    if len(nodes)!=len(order):raise RuntimeError('Unexpected output blocks for '+needle+': '+str(len(nodes)))
    return t[:n['openEnd']]+'\n'+''.join(p.raw(nodes[i])+'\n' for i in order)+t[n['closeStart']:]

def move_interpretation(t,field,target):
    p=Nodes(t);n=p.at('{{ '+field+'.text }}')
    while n and not(n['tag']=='sc-if' and n['attrs'].get('value')=='{{ interpOn }}'):n=n['parent']
    if not n:raise RuntimeError('Missing interpretation '+field)
    block=p.raw(n);t=t[:n['start']]+t[n['end']:]
    p=Nodes(t);dest=p.at(target,'sc-if')
    return t[:dest['closeStart']]+block+'\n'+t[dest['closeStart']:]

def integrate_template(t):
    marker='<!-- GM26 Stata presentation order -->'
    css='<style>'+(ROOT/'src/stata-output.css').read_text()+'</style>'
    if marker in t:
        a=t.index(marker)+len(marker);b=t.index('</style>',a)+len('</style>')
        return t[:a]+css+t[b:]
    # Put the statistical table before the corresponding visualization.
    for flag in ['isNumNum','isCatNum','isCatCat']:
        t=reorder(t,'value="{{ '+flag+' }}"',[1,0],True)
    t=reorder(t,'value="{{ semHasFit }}"',[2,0,1])
    t=reorder(t,'value="{{ ngHasFit }}"',[0,2,1])
    t=reorder(t,'value="{{ ngHasPlot }}"',[4,5,6,0,1,2,3],True)
    # Time-series setup stays in place. Results: sample/fit, coefficients,
    # descriptives and diagnostics, chart, extra event summaries, explanation.
    t=reorder(t,'value="{{ tsHasRes }}"',[0,6,7,5,1,2,3,4,8,9,10],True)
    p=Nodes(t);n=p.at('>WORD CLOUD<','div')['parent']['parent']['parent'];children=n['children']
    if len(children)!=2:raise RuntimeError('Unexpected word frequency/plot layout')
    t=t[:n['openEnd']]+p.raw(children[1])+p.raw(children[0])+t[n['closeStart']:]
    # Keep interpretation after all primary output, in DOM and reading order.
    for field,target in [('iOne','exIsNum'),('iCorr','isNumNum'),('iTest','isCatNum'),('iCt','isCatCat'),('iSem','semHasFit'),('iErgm','ngHasFit'),('iTs','tsHasRes'),('iReg','hasModel')]:
        t=move_interpretation(t,field,'value="{{ '+target+' }}"')
    # Confidence intervals precede supplementary beta/odds-ratio columns.
    p=Nodes(t);edits=[]
    for left,right in [('{{ lastHead }}','[95% CI]'),('{{ c.beta }}','{{ c.ci }}')]:
        a=p.at(left,'div');b=p.at(right,'div')
        edits.extend([(a['start'],a['end'],p.raw(b)),(b['start'],b['end'],p.raw(a))])
    for a,b,new in sorted(edits,reverse=True):t=t[:a]+new+t[b:]
    t=t.replace('0.7fr 0.7fr 0.9fr 1.5fr','0.7fr 0.7fr 1.5fr 0.9fr')
    # Add a Stata ANOVA source table using the already-computed OLS sums of squares.
    p=Nodes(t);fit=p.at('data-screen-label="Regression results"','div')['parent']['parent']
    grid=next(n for n in fit['children'] if '{{ sumCells }}' in p.raw(n))
    table='''<sc-if value="{{ stataHasAnova }}" hint-placeholder-val="{{ false }}"><div class="stata-result-scroll">{{ stataAnovaEl }}</div></sc-if>'''
    summary=p.raw(grid).replace('minmax(82px, 1fr)','minmax(150px, 1fr)').replace('<div style=', '<div class="stata-fit-cells" style=',1)
    t=t[:grid['start']]+'<div class="stata-fit-layout">'+table+summary+'</div>'+t[grid['end']:]
    p=Nodes(t);fit=p.at('data-screen-label="Regression results"','div')['parent']['parent']
    t=t[:fit['closeStart']]+'<p class="stata-fit-extra">{{ stataFitExtra }}</p>'+t[fit['closeStart']:]
    # T-test sample summary matches Stata's Obs / Mean / SE / SD / CI sequence.
    p=Nodes(t);tt=p.at('value="{{ ttHasRes }}"','sc-if')
    table='''<p class="stata-tt-title">{{ stataTtTitle }}</p><div class="stata-result-scroll">{{ stataTtEl }}</div>'''
    t=t[:tt['openEnd']]+table+t[tt['openEnd']:]
    # SEM reports its sample at the top; its goodness-of-fit diagnostics follow estimates.
    p=Nodes(t);sem=p.at('value="{{ semHasFit }}"','sc-if')
    t=t[:sem['openEnd']]+'<p class="stata-fit-extra">{{ stataSemSample }}</p>'+t[sem['openEnd']:]
    # The existing quick interpretation card becomes the final summary, not a preface.
    p=Nodes(t);key=p.at('value="{{ hasKeyLine }}"','sc-if');block=p.raw(key)
    t=t[:key['start']]+t[key['end']:];p=Nodes(t);main=p.at('class="mf-main"','main')
    t=t[:main['closeStart']]+block+t[main['closeStart']:]
    t=marker+css+t
    return t
