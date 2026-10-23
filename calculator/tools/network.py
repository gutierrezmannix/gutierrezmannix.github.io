"""Integrate tested network routines into the self-contained application."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]

def integrate_engine(e):
    begin,end='// GM26 network engine begin','// GM26 network engine end'
    module=(ROOT/'src/network-analysis.mjs').read_text()
    if begin in e:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:begin+'\n'+module+'\n'+end,e,flags=re.S)
    a=e.index('export function ergmFit('); b=e.index('export function netLayout(',a)
    e=e[:a]+e[b:]
    a=e.index('export function netCentrality('); b=e.index('\n}',a)+2
    e=e[:a]+begin+'\n'+module+'\n'+end+'\n\n'+e[b:]
    # Directed arrows end outside the node radius; reciprocal edges have opposing curves.
    a=e.index("  let d = '';",e.index('export function netPlot(')); b=e.index('  if (o.labels)',a)
    e=e[:a]+'''  let d = '';
  if (net.directed) {
    kids.push(R.createElement('defs', { key:'arrowdefs' }, R.createElement('marker', { id:'gm-net-arrow', viewBox:'0 0 6 6', refX:5, refY:3, markerWidth:5, markerHeight:5, orient:'auto', markerUnits:'userSpaceOnUse' }, R.createElement('path', { d:'M0,0L6,3L0,6Z',fill:'#7E7563' }))));
    const arrowMax = o.size ? Math.max(1,...o.size.filter(isFinite)) : 1;
    for (let i = 0; i < n; i++) for (const j of net.out[i]) {
      const x=sx(lay.X[i]), y=sy(lay.Y[i]), tx=sx(lay.X[j]), ty=sy(lay.Y[j]);
      const dx=tx-x, dy=ty-y, dist=Math.hypot(dx,dy); if (dist < 1) continue;
      const val=o.size && isFinite(o.size[j]) ? o.size[j] : 0;
      const radius=o.uniform ? 4.5 : 2.5+7*Math.sqrt(Math.max(0,val)/arrowMax);
      const bend=net.out[j].has(i)?5:0, ex=tx-dx/dist*(radius+3)-dy/dist*bend, ey=ty-dy/dist*(radius+3)+dx/dist*bend;
      d+='M'+x+','+y+'Q'+((x+tx)/2-dy/dist*bend*2)+','+((y+ty)/2+dx/dist*bend*2)+' '+ex+','+ey;
    }
  } else for (let i = 0; i < n; i++) for (const j of net.und[i]) if (j > i) d += 'M' + sx(lay.X[i]) + ',' + sy(lay.Y[i]) + 'L' + sx(lay.X[j]) + ',' + sy(lay.Y[j]);
  if (d) kids.push(R.createElement('path', { key: 'e', d, stroke: '#7E7563', strokeOpacity: n > 150 ? 0.25 : 0.45, strokeWidth: 0.8, fill: 'none', markerEnd:net.directed?'url(#gm-net-arrow)':undefined }));
''' + e[b:]
    e=e.replace('Math.max(0, sz[i]) / maxDeg','Math.max(0, isFinite(sz[i]) ? sz[i] : 0) / maxDeg')
    return e

def integrate_component(c):
    begin,end='  // GM26 network component begin','  // GM26 network component end'
    methods=(ROOT/'src/network-component.js').read_text().rstrip()
    if c.index('  netGuess(') < c.index('  async loadNetFile('):
        a=c.index('  netGuess('); b=c.index('  async loadNetFile(',a); c=c[:a]+c[b:]
    c=c.replace('ne.names.slice(0, 40)', 'ne.names').replace('nn.names.slice(0, 40)', 'nn.names')
    c=c.replace('const ne = S.ngE, nn = S.ngN, dir = S.ngDir !== false;', 'const ne = S.ngE && this._netE ? this.netMeta(this._netE,S.ngE.name) : S.ngE, nn = S.ngN && this._netN ? this.netMeta(this._netN,S.ngN.name) : S.ngN, dir = S.ngDir !== false;')
    if begin in c:
        c=re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:methods,c,flags=re.S)
        x=c.index('          out.ngAddCent = () => {') if '          out.ngAddCent = () => {' in c else -1
        if x >= 0:
            y=c.index('          out.dlNet =',x); c=c[:x]+"          out.ngAddCent = () => this.addNetCentralities(colsC,NET,CE);\n"+c[y:]
        return c
    a=c.index('  ergmR(terms) {'); b=c.index('  mkInterp(',a)
    c=c[:a]+methods+'\n'+c[b:]
    c=c.replace("typeof v === 'number' ? (isFinite(v) ? this._E.numLab(v) : '') : String(v).trim()", "typeof v === 'number' ? (isFinite(v) ? String(v) : '') : String(v).trim()")
    a=c.index('    if (out.isErgm) {');b=c.index('\n    }',c.index('        out.iErgm =',a))+6
    part=c[a:b]
    for key in ['ngFrom','ngTo','ngDir','ngId','ngMutual','ngTri']:
        part=part.replace('this.setState({ '+key+':','this.setState({ ngFit:null, ngErr:\'\', '+key+':')
    part=part.replace('return { ngAttr: Object.assign','return { ngFit:null, ngErr:\'\', ngAttr: Object.assign')
    part=part.replace("' ids not found in the nodes file'", "' edge rows with IDs absent from the nodes file excluded'")
    part=part.replace("'ties per person'", "fit.directed ? 'incoming + outgoing ties per node' : 'ties per node'")
    part=part.replace("'friends of friends who are friends'", "'closed triples in the undirected projection'")
    part=part.replace("out.ngNote = 'Estimated", "out.ngNote = fit.modelError ? 'Model unavailable: ' + fit.modelError : 'Estimated")
    part=part.replace('so the standard errors are too small — treat p-values as rough.', 'so these naive conditional standard errors do not account for network dependence; treat p-values as provisional.')
    part=part.replace("'number of people tied to (in or out)'", "'total incident ties: incoming + outgoing in a directed network'")
    part=part.replace("['closeness', 'CLOSENESS', 'how few steps it takes to reach everyone else']", "['closeness', 'CLOSENESS', 'Freeman (n−1)/sum of outgoing distances; 0 if any node is unreachable'], ['harmonic', 'HARMONIC', 'mean reciprocal outgoing distance; unreachable nodes contribute 0']")
    part=part.replace("'tied to others who are themselves well connected'", "'outgoing adjacency eigenvector (sna convention), maximum 1; unavailable if iteration fails'")
    part=part.replace("const fC = (k2, v) =>", "const fC = (k2, v) => !isFinite(v) ? 'n/a' :")
    part=part.replace("'node\\t'", "'node\\t'") # export keeps full precision, unavailable numeric values remain NaN
    part=part.replace("out.ngSizeSub = szK === 'none' ? 'all dots the same size' : 'dot size = ' + (MEAS.find(m2 => m2[0] === szK) || MEAS[0])[1].toLowerCase();", "out.ngSizeSub = (szK === 'none' ? 'all dots the same size' : 'dot size = ' + (MEAS.find(m2 => m2[0] === szK) || MEAS[0])[1].toLowerCase()) + (NET.directed ? ' · arrows show direction' : '') + (CE.eigenvectorConverged ? '' : ' · eigenvector unavailable: no stable solution');")
    x=part.index('          out.ngAddCent = () => {'); y=part.index('          out.dlNet =',x)
    part=part[:x]+"          out.ngAddCent = () => this.addNetCentralities(colsC,NET,CE);\n"+part[y:]
    part=part.replace("out.ngFitSub =", "if (fit.nodes > 400) notes.push('plot and centrality calculations are limited to 400 nodes');\n        out.ngFitSub =")
    part=part.replace("const nSig = fit.coefs.slice(1).filter(c => isFinite(c.p) && c.p < a).length;", "const nSig = fit.coefs.slice(1).filter(c => isFinite(c.p) && c.p < a).length;\n        if (fit.modelError) bits.splice(0,bits.length,'Network descriptives are available. Model unavailable: '+fit.modelError);")
    part=part.replace("v: nSig + ' OF ' + (fit.coefs.length - 1) + ' EFFECTS SIGNIFICANT'", "v: fit.modelError ? 'DESCRIPTIVES ONLY' : nSig + ' OF ' + (fit.coefs.length - 1) + ' EFFECTS SIGNIFICANT'")
    part=part.replace("bits.push('The baseline chance of a tie between two random people is low (density '", "bits.push('The observed share of possible ties is '").replace("this.fmt(fit.density, 3) + ').'", "this.fmt(fit.density, 3) + '.'")
    return c[:a]+part+c[b:]

def integrate_template(t):
    if '<!-- GM26 network template v1 -->' in t: return t
    a=t.index('NETWORK MODEL (ERGM)'); b=t.index('{{ ngCmdPreview }}',a)
    # A full standalone R snapshot should not push results below pages of code.
    x=t.rfind('<pre ',a,b); y=t.index('</pre>',b)+len('</pre>')
    t=t[:x]+'<!-- GM26 network template v1 --><details style="max-width:100%; overflow-wrap:anywhere;"><summary style="cursor:pointer;">Reproducible R code (prepared graph snapshot)</summary>'+t[x:y]+'</details>'+t[y:]
    t=t.replace('a <b>node list</b>', 'a <b>node list</b>')
    t=t.replace('gender or age) is optional but lets you test whether similar people connect.</div>', 'gender or age) is optional but lets you test whether similar people connect. Binary, loop-free ties: duplicate ties are merged, self-ties removed, and edge weights ignored. Listed isolated nodes are retained. Dataset filters and survey weights do not apply.</div>')
    return t
