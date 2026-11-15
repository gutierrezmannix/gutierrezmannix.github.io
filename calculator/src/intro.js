  // ---- GM26 intro page: the data box (Browse files, drag and drop, Create your own dataset) and the unsaved work
  // as "Continue where you left off" cards, which replace the old banners (same autoRestore / autoDiscard actions).
  introVals(out) {
    const S = this.state;
    out.introPick = () => { if (this._file) this._file.click(); };
    out.introDrop = e => out.onDrop(e);
    const list = !out.showWork && !S.parsing && S.screen !== 'work' ? (S.asList || []).slice(0, 4) : [];
    out.introRecent = list.map(r => {
      const sm = this.asSummary(r.sum);
      return { name: r.fileName, sub: [sm, this.asWhen(r.at)].filter(Boolean).join(' · ') + (r.hasFull ? '' : ' · open the file again to restore it'), canRestore: !!r.hasFull, restore: () => this.autoRestore(r.sig), discard: () => this.autoDiscard(r.sig) };
    });
    out.hasIntroRecent = out.introRecent.length > 0;
    out.dlProgram = () => this.dlProgram();
    out.showDl = this.dlOnSite(); out.hasDlMsg = !!S.dlMsg; out.dlMsg = S.dlMsg || '';
  }
  // ---- download the program: the page itself, one file named by its build (GM26-calculator-<build>.html).
  // On the website the link saves index.html; on a downloaded copy (file://) the browser cannot read its own file, so the
  // entry-page line is hidden and File → opens the website; the new-version notice downloads the newer build from the site.
  dlOnSite() { return typeof location !== 'undefined' && /^https?:$/.test(location.protocol); }
  dlSay(msg) { this.setState({ dlMsg: msg }); this.flash(msg); clearTimeout(this._dlT); this._dlT = setTimeout(() => this.setState({ dlMsg: '' }), 9000); }
  async dlProgram(build) {
    const site = 'https://gutierrezmannix.github.io/calculator/';
    if (!build && !this.dlOnSite()) { window.open(site, '_blank'); return; }
    const url = build ? site + 'index.html' : (/\/$/.test(location.pathname) ? location.pathname + 'index.html' : location.pathname), name = 'GM26-calculator-' + (build || '2026-11-15.99') + '.html';
    try {
      const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const blob = await r.blob(); if (blob.size < 100000) throw new Error('short');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.dlSay('Saved ' + name + ' · double-click it to open the calculator; it works without internet and installs nothing. If Edge says the file "isn\'t commonly downloaded", choose Keep.');
    } catch (e) { this.dlSay(build ? 'Could not download build ' + build + ' from here — open the website and use "Download the program".' : 'Could not save the program from here — use your browser\'s Save page as… (Ctrl/\u2318+S), "Webpage, HTML only".'); }
  }
