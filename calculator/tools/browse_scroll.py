"""Native two-axis scrolling with bounded DOM size and a fluid workspace."""
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def integrate_component(c):
    begin, end = '  // GM26 scrolling browser begin', '  // GM26 scrolling browser end'
    methods = (ROOT/'src/browse-scroll.js').read_text().rstrip()
    if begin in c:
        c = re.sub(re.escape(begin)+'.*?'+re.escape(end), lambda _: methods, c, flags=re.S)
    else:
        c = c.replace('  descFor() {', methods+'\n  descFor() {', 1)
        a = c.index('      const CPG = 14, RPG = 100;', c.index('    if (out.isBrowse) {'))
        b = c.index("      out.isDataView = S.browseMode", a)
        c = c[:a]+'      this.browseScrollVals(out, visAll);\n'+c[b:]
        c = c.replace('    this.syncStick();\n    if (this._focusNext', '    this.syncStick();\n    this.browseAfterUpdate();\n    if (this._focusNext', 1)
    c = c.replace("const dockOn = narrow ? S.mfMobile === 'dock' : (S.mfDock", "const dockOn = narrow ? S.mfMobile === 'dock' : S.tab === 'browse' ? !!S.mfBrowseDock : (S.mfDock")
    c = c.replace("mfPane: k, mfDock: true, mfMobile: 'dock'", "mfPane: k, mfDock: true, mfBrowseDock: S.tab === 'browse' ? true : S.mfBrowseDock, mfMobile: 'dock'")
    c = c.replace("out.mfDockClose = () => this.setState({ mfDock: false, mfDl: false });", "out.mfDockClose = () => this.setState(S.tab === 'browse' ? { mfBrowseDock: false, mfDl: false } : { mfDock: false, mfDl: false });")
    # Help and the keyboard command shortcut also open a collapsed Browse dock.
    c = c.replace("mfPane:'help',mfDock:true,mfMobile:", "mfPane:'help',mfDock:true,mfBrowseDock:this.state.tab==='browse'?true:this.state.mfBrowseDock,mfMobile:")
    c = c.replace("mfPane: 'output', mfDock: true, mfMobile:", "mfPane: 'output', mfDock: true, mfBrowseDock: this.state.tab === 'browse' ? true : this.state.mfBrowseDock, mfMobile:")
    c = c.replace("{ mfPane: 'help', mfDock: true, mfMobile:", "{ mfPane: 'help', mfDock: true, mfBrowseDock: this.state.tab === 'browse' ? true : this.state.mfBrowseDock, mfMobile:")
    return c

def integrate_template(t):
    begin, end = '<!-- GM26 scrolling browser begin -->', '<!-- GM26 scrolling browser end -->'
    if begin not in t:
        a = t.index('              <div style="overflow-x: auto; max-height: 62vh; overflow-y: auto;">', t.index('data-screen-label="Data browser"'))
        b = t.index('              <sc-if value="{{ isVarView }}"', a)
        t = t[:a]+begin+'{{ browseGridEl }}'+end+'\n              </sc-if>\n'+t[b:]
        a = t.index('                <sc-if value="{{ isDataView }}"', t.index('{{ browseNote }}'))
        b = t.index('                </sc-if>', a)+len('                </sc-if>')
        t = t[:a]+t[b:]
    css_begin, css_end = '<!-- GM26 fluid workspace begin -->', '<!-- GM26 fluid workspace end -->'
    css = css_begin+'<style>'+(ROOT/'src/browse-scroll.css').read_text()+'</style>'+css_end
    t = re.sub(re.escape(css_begin)+'.*?'+re.escape(css_end)+r'\n?', '', t, flags=re.S)
    anchor = '<nav class="site-back" aria-label="Site">'
    return t.replace(anchor, css+'\n'+anchor, 1)
