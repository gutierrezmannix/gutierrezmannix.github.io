"""Replace the Help pane with a searchable, implementation-aware model guide."""
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def integrate_component(c):
    a=c.index("      ['Learn', null,");b=c.index("      ['View', null,",a)
    c=c[:a]+"      ['Learn', null, 'Definitions and uses of the included analyses', [['Model guide', () => this.openModelGuide()], ['Keyboard shortcuts', () => this.setState({kbHelp:true,menu:''})]]],\n"+c[b:]
    begin,end='  // GM26 model guide methods begin','  // GM26 model guide methods end'
    data=json.loads((ROOT/'src/model-guide.json').read_text())
    methods=(ROOT/'src/model-guide.js').read_text().rstrip().replace('__MODEL_GUIDE_DATA__',json.dumps(data,ensure_ascii=False,separators=(',',':')))
    if begin in c:return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:methods,c,flags=re.S)
    c=c.replace('  descFor() {',methods+'\n  descFor() {',1)
    c=c.replace("out.mfHelp = () => openPane('help');",'out.mfHelp = () => this.openModelGuide();',1)
    c=c.replace("out.mfWhich = () => this.setState({ dhOpen: true, dhQ1: '', dhQ2: '', mfPane: 'help', mfDock: true, mfMobile: 'dock', mfFile: false, mfNav: '' });",'out.mfWhich = () => this.openModelGuide();',1)
    a=c.rindex('    return out;')
    return c[:a]+'    this.modelGuideVals(out);\n'+c[a:]

def sc_end(t,start):
    depth=0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>',t[start:]):
        depth+=-1 if m[0].startswith('</') else 1
        if depth==0:return start+m.end()
    raise RuntimeError('Unbalanced Help pane')

def integrate_template(t):
    t=t.replace('Guide to the current tab, which test do I need, practice exercises, keyboard shortcuts','Definitions, uses, data requirements and examples for every included analysis')
    begin,end='<!-- GM26 model guide begin -->','<!-- GM26 model guide end -->'
    block=begin+'<style>'+(ROOT/'src/model-guide.css').read_text()+'</style>'+(ROOT/'src/model-guide.html').read_text()+end
    if begin in t:return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:block,t,flags=re.S)
    a=t.index('<sc-if value="{{ mfPaneHelp }}"');b=sc_end(t,a)
    return t[:a]+block+t[b:]
