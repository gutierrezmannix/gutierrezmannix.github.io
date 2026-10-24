"""Observed scatter extents with explicit endpoint labels and manual overrides."""
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def integrate_engine(e):
    begin,end='// GM26 observed scatter ranges begin','// GM26 observed scatter ranges end'
    module=(ROOT/'src/scatter-chart.mjs').read_text().rstrip()
    if begin in e:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:module,e,flags=re.S)
    a=e.index('export function scatterChart(');b=e.index('export function timeSeries(',a)
    return e[:a]+module+'\n\n'+e[b:]

def integrate_component(c):
    begin,end='  // GM26 scatter range controls begin','  // GM26 scatter range controls end'
    module=(ROOT/'src/scatter-ranges.js').read_text().rstrip()
    if begin in c:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:module,c,flags=re.S)
    c=c.replace('  axGet(k)',module+'\n  axGet(k)',1)
    for old,new in [
        ("ax: this.axUI('plot', ['scatter', S.pX, S.pY], { x: true, y: true, zero: 'y', xName: S.pX, yName: S.pY })", "...this.scatterOptions('plot', S.pX, S.pY)"),
        ("ax: this.axUI('scatter', [xm.name, ym.name], { x: true, y: true, zero: 'y', xName: xm.name, yName: ym.name })", "...this.scatterOptions('scatter', xm.name, ym.name)")]:
        if c.count(old)!=1:raise RuntimeError('Scatter axis integration anchor missing')
        c=c.replace(old,new,1)
    return c

def integrate_template(t):
    if '<!-- GM26 observed scatter range hints -->' in t:return t
    for slot in ['Scatter','Plot']:
        start=t.index('<sc-if value="{{ ax'+slot+'.show }}"')
        depth=0
        for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>',t[start:]):
            depth+=-1 if m[0].startswith('</') else 1
            if depth==0:
                end=start+m.end();break
        hint='<sc-if value="{{ ax'+slot+'.hasDataRange }}" hint-placeholder-val="{{ false }}"><p class="mf-scatter-range" role="status">{{ ax'+slot+'.rangeHint }}</p></sc-if>'
        t=t[:end]+hint+t[end:]
    css='<style>.mf-scatter-range{margin:5px 0 8px;font-size:12px;line-height:1.5;color:var(--c5D5648,#5D5648);overflow-wrap:anywhere}</style>'
    return '<!-- GM26 observed scatter range hints -->'+css+t
