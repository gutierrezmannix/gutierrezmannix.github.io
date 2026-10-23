"""Integrate the calculator's shared workbench toolbar into the bundled source."""

LABEL = 'Univariate Descriptive Analysis'


def replace(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError(f'Expected one toolbar anchor: {before[:100]}')
    return text.replace(before, after)


def integrate_component(c):
    if '// GM26 shared commandbar v1' in c:
        return c
    c = replace(c, 'class Component extends DCLogic {', '// GM26 shared commandbar v1\nclass Component extends DCLogic {')
    c = c.replace('One variable', LABEL).replace('ONE VARIABLE', LABEL.upper())
    c = ''.join(line for line in c.splitlines(keepends=True)
                if not line.lstrip().startswith("['one', '" + LABEL + "', null,"))
    c = replace(c, '      const TESTS = [', "      const TESTS = [\n        ['" + LABEL + "', goT({ tab: 'one' })],")
    c = replace(c, "const NAV_TESTS = ['two',", "const NAV_TESTS = ['one', 'two',")
    c = replace(c, 'Choose an analysis: t-tests,', 'Choose an analysis: univariate descriptives, t-tests,')
    # The toolbar now spans the workbench, rather than the middle analysis column.
    a = c.index('  // ---- the menu stays on one row:')
    b = c.index('  newDataset() {', a)
    c = c[:a] + '''  // The shared toolbar wraps at small widths without hiding controls.
  navFit() {}
''' + c[b:]
    c = c.replace("'main, .mf-dock, .mf-banners, .mf-top'", "'main, .mf-dock, .mf-banners, .mf-top, .mf-chooser, .mf-settings'")
    c = c.replace("'main, .mf-dock, .mf-banners, .mf-top, .mf-col-data'", "'main, .mf-dock, .mf-banners, .mf-top, .mf-col-data, .mf-chooser, .mf-settings'")
    c = replace(c, "const openPane = k => this.setState({ mfPane: k, mfDock: true, mfMobile: 'dock', mfDl: false, mfFile: false, mfNav: '' });", "const openPane = k => this.setState({ mfPane: k, mfDock: true, mfMobile: 'dock', mfDl: false, mfFile: false, mfNav: '', mfSettings: false, ntOpen: false });")
    # Only one floating menu is open at a time.
    c = replace(c, "out.mfSettingsToggle = () => this.setState({ mfSettings: !S.mfSettings, mfFile: false, mfNav: '', pk: null });", "out.mfSettingsToggle = () => this.setState({ mfSettings: !S.mfSettings, mfFile: false, mfNav: '', ntOpen: false, pk: null });")
    c = replace(c, "out.mfFileToggle = () => this.setState({ mfFile: !S.mfFile, mfSettings: false, mfNav: '' });", "out.mfFileToggle = () => this.setState({ mfFile: !S.mfFile, mfSettings: false, mfNav: '', ntOpen: false });")
    c = replace(c, "const closeAll = { mfFile: false, mfNav: '', menu: '', mfDl: false };", "const closeAll = { mfFile: false, mfNav: '', menu: '', mfDl: false, ntOpen: false, mfSettings: false };")
    c = c.replace("{ mfNav: open ? '' : id, mfFile: false, mfDl: false }", "{ mfNav: open ? '' : id, mfFile: false, mfDl: false, ntOpen: false, mfSettings: false }")
    c = replace(c, "out.ntToggle = () => this.setState({ ntOpen: !this.state.ntOpen, ntUnseen: 0, mfFile: false, mfNav: '', mfDl: false });", "out.ntToggle = () => this.setState({ ntOpen: !this.state.ntOpen, ntUnseen: 0, mfFile: false, mfNav: '', mfDl: false, mfSettings: false });")
    return c


def integrate_template(t):
    if '<!-- GM26 shared commandbar v1 -->' in t:
        return t
    # Extract existing controls to retain their handlers, menus and accessible labels.
    hs = t.index('  <header class="mf-top"')
    he = t.index('  </header>', hs) + len('  </header>')
    header = t[hs:he]
    settings_start = header.index('    <sc-if value="{{ mfSettingsOpen }}"')
    settings = header[settings_start:header.rindex('  </header>')]
    chips_start = header.index('        <div class="mf-chips">')
    bell_start = header.index('        <div class="mf-menuwrap mf-bellwrap">')
    status_start = header.index('        <sc-if value="{{ hasUndoMsg }}"')
    save_start = header.index('        <button class="mf-btn" sc-camel-on-click="{{ doSaveSession }}"')
    file_start = header.index('        <div class="mf-menuwrap">', save_start)
    settings_button_start = header.index('        <button class="mf-btn" sc-camel-on-click="{{ mfSettingsToggle }}"', file_start)
    buttons_end = header.index('      </sc-if>', settings_button_start)
    bell = header[bell_start:status_start]
    undo_start = header.index('        <button class="mf-btn" sc-camel-on-click="{{ doUndo }}"', status_start)
    status_undo = header[undo_start:save_start] + header[status_start:undo_start]
    save = header[save_start:file_start]
    file = header[file_start:settings_button_start].replace('mf-menu mf-menu-right', 'mf-menu')
    settings_help = header[settings_button_start:buttons_end].replace('>⚙ Settings</button>', '>Settings</button>').replace('>? Help</button>', '>Help</button>')
    chips_end = header.index('        <div style="flex: 1;"></div>', chips_start)
    chips = header[chips_start:chips_end]
    # Weight is configured in the existing Settings panel, together with survey design.
    settings = settings.replace('        <div class="mf-settings-grid">', chips + '        <div class="mf-settings-grid">')
    new_header = header[:chips_start] + '      </sc-if>\n    </div>\n  </header>'
    t = t[:hs] + new_header + t[he:]

    a = t.index('          <div ref="{{ stickTabsRef }}" class="mf-chooser"')
    b = t.index('          <sc-if value="{{ sgShow }}"', a)
    chooser = t[a:b]
    nav_start = chooser.index('                <sc-for list="{{ g.items }}"')
    nav_end = chooser.index('              </div>\n            </sc-for>', nav_start)
    nav = chooser[nav_start:nav_end]
    export_start = chooser.index('            <sc-if value="{{ exportInBar }}"')
    export_end = chooser.index('            </sc-if>', export_start) + len('            </sc-if>')
    export = '<div class="mf-exportbar">' + chooser[export_start:export_end] + '</div>\n'
    t = t[:a] + export + t[b:]
    controls = file + save + '<sc-for list="{{ mfNavGroups }}" as="g" hint-placeholder-count="1">' + nav + '</sc-for>' + settings_help + bell + status_undo
    toolbar = '''<!-- GM26 shared commandbar v1 -->
      <div ref="{{ stickTabsRef }}" class="mf-chooser mf-commandbar" data-screen-label="Main toolbar" role="toolbar" aria-label="Main toolbar">
        <div class="mf-navgroup mf-commandgroup">
''' + controls + '''
        </div>
      </div>
''' + settings
    work = '    <section data-screen-label="Mainframe" class="mf-work">'
    t = replace(t, work, work + '\n' + toolbar)
    # Existing toolbar menu items are wider than a phone; wrap labels within the viewport.
    css = '''
    /* GM26 shared commandbar */
    .mf-commandbar { z-index: 85; padding-bottom: 6px; }
    .mf-commandgroup { flex: 1 1 auto; gap: 4px; align-items: center; padding: 5px; }
    .mf-commandgroup .mf-btn, .mf-commandgroup .mf-nav { font-size: 12px; padding: 7px 10px; }
    .mf-commandbar .mf-menu { box-sizing: border-box; min-width: min(240px, calc(100vw - 32px)); max-width: calc(100vw - 32px); max-height: min(70vh, 600px); overflow-y: auto; }
    .mf-commandbar .mf-menu-item { white-space: normal; overflow-wrap: anywhere; }
    .mf-exportbar { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
    .mf-exportbar:empty { display: none; }
    .mf-work > .mf-settings { border: 1px solid var(--cE3DCCE, #E3DCCE); border-radius: 9px; }
    .mf-work > .mf-settings .mf-chips { display: flex; padding: 12px 18px 0; }
    @media (max-width: 600px) {
      .mf-commandgroup { gap: 2px; }
      .mf-commandgroup .mf-btn, .mf-commandgroup .mf-nav { padding: 7px 8px; }
      .mf-commandbar .mf-menu { position: fixed; top: auto; left: 12px !important; right: 12px !important; max-width: calc(100vw - 24px); }
    }
'''
    t = replace(t, '    /* ---- one menu row */', css + '    /* ---- one menu row */')
    return t.replace('One variable', LABEL)
