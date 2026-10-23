"""Consolidate the existing three t-test designs into one tested workspace."""
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def integrate_engine(e):
    begin,end='// GM26 t-test engine begin','// GM26 t-test engine end'
    module=(ROOT/'src/ttest-core.mjs').read_text()
    if begin in e:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:begin+'\n'+module+'\n'+end,e,flags=re.S)
    a=e.index('export function oneSampleT(');b=e.index('// ---------- correlation / scatter matrix',a)
    e=e[:a]+e[b:]
    return e.rstrip()+'\n\n'+begin+'\n'+module+'\n'+end

def integrate_component(c):
    if '// GM26 t-test R semantics' not in c:
        a=c.index("      else if (fn === 't.test') {"); b=c.index('\n',a)
        c=c[:a]+(ROOT/'src/ttest-r-route.js').read_text().rstrip()+c[b:]
    else:
        a=c.index('      // GM26 t-test R semantics'); b=c.index("      else if (fn === 'aov')",a)
        c=c[:a]+(ROOT/'src/ttest-r-route.js').read_text()+c[b:]
    if "if (opts.ttAlpha !== undefined) patch.alphaSel" not in c:
        c=c.replace('    if (opts.w) { patch.weightVar', "    if (opts.ttAlpha !== undefined) patch.alphaSel = String(opts.ttAlpha);\n    if (opts.w) { patch.weightVar",1)
    a=c.index('      out.ttShow ='); b=c.index("    out.isText = S.tab === 'text';",a)
    c=c[:a]+c[a:b].replace('E.critInv(', 'E.ttCritical(')+c[b:]
    c=c.replace("TL = { one:","TL = { ttest: 't-tests', one:")
    c=c.replace("const TABN2 = { overview:","const TABN2 = { ttest: 't-tests', overview:")
    if "ttest: 'Choose the t-test design" not in c:
        c=c.replace('const GUIDE = {', "const GUIDE = {\n      ttest: 'Choose the t-test design, select a numeric outcome, then supply a group variable, second paired measurement, or reference value. The independent test uses Welch inference. Classical tests are unweighted and two-sided.',",1)
    begin,end='  // GM26 t-test methods begin','  // GM26 t-test methods end'
    methods=(ROOT/'src/ttest-component.js').read_text().rstrip()
    if begin in c:
        return re.sub(re.escape(begin)+'.*?'+re.escape(end),lambda _:methods,c,flags=re.S)
    c=c.replace('  descFor() {',methods+'\n  descFor() {',1)
    c=c.replace("ttMode: 'value', ttMu: ''", "ttMode: 'groups', ttMu: ''",1)
    c=c.replace("const NAV_TESTS = ['one',", "const NAV_TESTS = ['ttest', 'one',")
    c=c.replace("return ['one', 'two', 'reg', 'plots', 'browse', 'sem', 'text', 'ts'].includes(tab)","return ['ttest', 'one', 'two', 'reg', 'plots', 'browse', 'sem', 'text', 'ts'].includes(tab)")
    c=c.replace("    if (S.tab === 'one' && S.exploreVar) {", "    if (S.tab === 'ttest') return this._ttLast || null;\n    if (S.tab === 'one' && S.exploreVar) {",1)
    c=c.replace("  cmdText(d, dial) {", "  cmdText(d, dial) { if (d.t === 'ttestx') return dial === 'r' ? d.r : d.stata;",1)
    for fn,ret in [('tableFor','d.tbl'),('resFor','d.res'),('explFor','d.res')]:
        c=c.replace('  '+fn+'(d) {','  '+fn+"(d) {\n    if (d.t === 'ttestx') return "+ret+" || '';",1)
    c=c.replace('  rerunCore(d) {',"  rerunCore(d) {\n    if (d.t === 'ttestx') { this.setState(Object.assign({tab:'ttest'},d.setup || {})); return; }",1)
    c=c.replace("const sel = S.exploreVar === m.name && S.tab === 'one';", "const sel = S.exploreVar === m.name && ['one','ttest'].includes(S.tab);")
    c=c.replace("click: () => this.setState({ tab: 'one', exploreVar: m.name, mfMobile: 'analysis' })", "click: () => this.setState({ tab: S.tab === 'ttest' ? 'ttest' : 'one', exploreVar: m.name, mfMobile: 'analysis' })")
    c=c.replace('    out.isOverview =', "    out.isTtest = S.tab === 'ttest';\n    out.isOverview =",1)
    old="      out.ttShow = !!(S.tab === 'one' && xm && xm.type === 'numeric' && this.numVals(xn));"
    setup='''      this._ttLast = null;
      const mode = S.ttMode || 'groups';
      out.ttModeBtns = [['groups','TWO INDEPENDENT GROUPS','Different people or cases in each group; Welch test without equal-variance assumptions.'],['paired','PAIRED MEASUREMENTS','Two measurements of the same cases, aligned on each row.'],['value','ONE SAMPLE VS A VALUE','Compare one outcome mean with a specified reference value.']].map(([k,label,tip])=>({label,tip,style:chipS(mode===k),click:()=>this.setState({ttMode:k})}));
      out.ttDesignHint = mode === 'groups' ? 'Different cases in two groups. Uses Welch’s independent-samples t-test.' : mode === 'paired' ? 'Two measurements on the same cases, such as before and after. Rows missing either value are excluded as pairs.' : 'One sample compared with a reference value, such as a target or scale midpoint.';
      out.ttOutcomePk = mkPicker('ttoutcome',xn,n=>this.setState({exploreVar:n}),col=>col.type==='numeric');
      const validOutcome=!!(xm && xm.type==='numeric' && this.numVals(xn));
      out.ttNeedOutcome = out.isTtest && !validOutcome;
      out.ttWeightBlock = out.isTtest && !!S.weightVar;
      out.ttShow = out.isTtest && validOutcome && !S.weightVar;'''
    if old not in c:raise RuntimeError('Missing t-test setup anchor')
    c=c.replace(old,setup,1)
    c=c.replace("        const mode = S.ttMode || 'value';\n",'',1)
    a=c.index("        out.ttModeBtns = [['value',");b=c.index('\n',a);c=c[:a]+c[b+1:]
    c=c.replace('const mu = parseFloat(S.ttMu);',"const mu = String(S.ttMu ?? '').trim() === '' ? NaN : Number(S.ttMu);",1)
    # Keep the existing result cards/charts, and record exact prepared samples for export.
    for anchor,record in [("            out.ttCmd = S.dialect === 'r' ? 't.test(df$' + xn + ', mu = '","            this.ttRecord(out,{mode:'value',x:X,mu});"),("              out.ttCmd = S.dialect === 'r' ? 't.test(' + xn + ' ~ '","              this.ttRecord(out,{mode:'groups',x:xa,y:xb});"),("            out.ttCmd = S.dialect === 'r' ? 't.test(df$' + xn + ', df$'", "            this.ttRecord(out,{mode:'paired',x:X,y:this.numVals(y2).a});")]:
        a=c.index(anchor);b=c.index('\n',a);c=c[:b+1]+record+'\n'+c[b+1:]
    c=c.replace('"ttMode","ttMu","ttG","ttY2"','"ttMode","ttMu","ttG","ttA","ttB","ttY2"')
    c=c.replace("if (d.t === 'gen01') { this.setState({ tab: 'one', ttMode: 'groups'", "if (d.t === 'gen01') { this.setState({ tab: 'ttest', ttMode: 'groups'")
    c=c.replace("    else if (d.t === 'ttest' || d.t === 'anova') this.setState({ tab: 'two', twoMode: 'means', xVar: d.g, yVar: d.y });", "    else if (d.t === 'ttest') this.setState({tab:'ttest',ttMode:'groups',ttG:d.g,exploreVar:d.y});\n    else if (d.t === 'anova') this.setState({ tab: 'two', twoMode: 'means', xVar: d.g, yVar: d.y });")
    c=c.replace("    else if (v === 'ttest' || v === 'oneway')", "    else if (v === 'ttest') this.setState({tab:'ttest',ttMode:'groups',ttG:vals[1],exploreVar:vals[0]});\n    else if (v === 'oneway')")
    c=c.replace("    if (verb === 'ttest' || verb === 'oneway')", "    if (verb === 'ttest') return done(label, Object.assign(patch,{tab:'ttest',ttMode:'groups',ttG:vars[1],exploreVar:vars[0]}));\n    if (verb === 'oneway')")
    c=c.replace("{ tab: 'one', exploreVar: vars[0], ttMode:","{ tab: 'ttest', exploreVar: vars[0], ttMode:")
    c=c.replace("ttMu: String(opts.mu) }), clickBtn(/^compute/i))", "ttMu: String(opts.mu) }))")
    c=c.replace("ttY2: vars[1] }), clickBtn(/^compute/i))", "ttY2: vars[1] }))")
    return c

def sc_end(t,start):
    level=0
    for m in re.finditer(r'<sc-if\b[^>]*>|</sc-if>',t[start:]):
        level+=-1 if m[0].startswith('</') else 1
        if level==0:return start+m.end()
    raise RuntimeError('Unbalanced t-test card')

def integrate_template(t):
    begin,end='<!-- GM26 unified t-tests begin -->','<!-- GM26 unified t-tests end -->'
    if begin in t:
        a=t.index(begin);b=t.index(end,a)+len(end);old=t[a:b]
        x=old.index('<sc-if value="{{ ttShow }}"');y=sc_end(old,x);card=old[x:y]
    else:
        a=t.index('<sc-if value="{{ ttShow }}"');b=sc_end(t,a);card=t[a:b]
        t=t[:a]+t[b:];a=t.index('<sc-if value="{{ isTwo }}"');b=a
        modes='<div style="display: flex; gap: 4px; flex-wrap: wrap;"><sc-for list="{{ ttModeBtns }}" as="b" hint-placeholder-count="2"><button sc-camel-on-click="{{ b.click }}" style="{{ b.style }}">{{ b.label }}</button></sc-for></div>'
        if modes not in card:raise RuntimeError('Missing old t-test mode bar')
        card=card.replace(modes,'')
        card=card.replace('T-TEST — IS THE AVERAGE OF {{ ttX }} DIFFERENT?', 'T-TEST RESULTS · {{ ttX }}')
        mark='<pre style="margin: 0; font-family:';x=card.index(mark,card.index('{{ ttApa }}'));y=card.index('</pre>',x)+len('</pre>')
        card=card[:x]+'<div class="tt-result-actions"><button class="mf-btn" sc-camel-on-click="{{ ttCopy }}">{{ ttCopyLabel }}</button><button class="mf-btn" sc-camel-on-click="{{ ttLog }}">Add results to console</button></div><details><summary>Reproducible R / Stata code</summary>'+card[x:y]+'</details>'+card[y:]
        card=card.replace('placeholder="e.g. 0.5"','aria-label="Reference value" placeholder="e.g. 50"')
        card=card.replace('placeholder="e.g. region or democracy"','aria-label="T-test group variable" placeholder="e.g. treatment group"')
        card=card.replace('placeholder="e.g. score after"','aria-label="Second paired measurement" placeholder="e.g. score after"')
    setup=(ROOT/'src/ttest-setup.html').read_text().replace('{{CARD}}',card)
    css='''<style>.tt-workspace{display:flex;flex-direction:column;gap:12px}.tt-card{padding:14px;background:var(--cFFFFFF,#FFFFFF);border:1px solid var(--c626D63,#626D63);border-radius:10px}.tt-card h2{font:700 14px var(--fMono,monospace);margin:0 0 8px}.tt-card p{font-size:13px;line-height:1.5;margin:8px 0}.tt-modes,.tt-result-actions{display:flex;gap:7px;flex-wrap:wrap}.tt-modes button{min-height:38px}.tt-outcome-label{display:block;font:700 11px var(--fMono,monospace);margin:14px 0 6px}.tt-workspace summary{cursor:pointer;font-size:12px;margin-top:8px}.tt-workspace pre{max-height:260px;overflow:auto;overflow-wrap:anywhere}.tt-workspace input{box-sizing:border-box;max-width:100%}</style>'''
    weight='<sc-if value="{{ ttWeightBlock }}" hint-placeholder-val="{{ false }}"><p role="alert">Classical t-tests require unweighted observations. Clear weights in Settings, or use Regression with an appropriate survey design.</p></sc-if>'
    setup=setup.replace('</section>',weight+'</section>')
    return t[:a]+begin+css+'<sc-if value="{{ isTtest }}" hint-placeholder-val="{{ false }}">'+setup+'</sc-if>'+end+t[b:]
