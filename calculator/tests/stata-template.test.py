"""Check semantic result order in the shipped template, not CSS visual order."""
import json,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from stata_output import Nodes
page=(Path(__file__).resolve().parents[1]/'index.html').read_text()
t=json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>',page,re.S)[1])
p=Nodes(t)
def within(flag):return p.raw(p.at('value="{{ '+flag+' }}"','sc-if'))
def ordered(s,*items):
    offsets=[s.index(x) for x in items];assert offsets==sorted(offsets),items
ordered(within('isNumNum'),'{{ corrRows }}','{{ scatterChartEl }}','{{ iCorr.text }}')
ordered(within('isCatNum'),'{{ groupRows }}','{{ gboxChartEl }}','{{ iTest.text }}')
ordered(within('isCatCat'),'{{ ctRows }}','{{ stackChartEl }}','{{ iCt.text }}')
ordered(within('semHasFit'),'{{ stataSemSample }}','{{ semRows }}','{{ semFitCells }}','{{ semDiagramEl }}','{{ iSem.text }}')
ordered(within('ngHasFit'),'{{ ngNetCells }}','{{ ngRows }}','{{ ngCentRows }}','{{ ngPlotEl }}','{{ iErgm.text }}')
ordered(within('tsHasRes'),'{{ tsCells }}','{{ tsRows }}','{{ tsChartEl }}','{{ iTs.text }}')
ordered(within('hasModel'),'{{ sumCells }}','{{ coefRows }}','{{ iReg.text }}')
ordered(within('hasModel'),'{{ zHead }}','[95% CI]','{{ lastHead }}')
ordered(within('ttHasRes'),'{{ stataTtEl }}','{{ ttCells }}','{{ ttChartEl }}')
main=p.raw(p.at('class="mf-main"','main'));assert main.rindex('{{ keyLine }}')>main.rindex('value="{{ isReg }}"')
assert t.index('>WORD COUNTS<')<t.index('>WORD CLOUD<')
assert t.count('{{ stataTtEl }}')==1
assert all(n['end'] for n in p.nodes if n['tag'] in {'sc-if','sc-for','table','tbody','tr'})
print('Shipped DOM and screen-reader order passed for all result workspaces; table semantics and optional result blocks remain balanced.')
