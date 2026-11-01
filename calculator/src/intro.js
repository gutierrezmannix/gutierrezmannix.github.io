  // ---- GM26 intro page (Design B): start from a task. A task card opens the file picker and remembers where to go
  // once the file has loaded (Charts, Map, Text analysis, Networks); unsaved work is listed under "Continue".
  introVals(out) {
    const S = this.state;
    const open = goal => () => { this._introGoal = goal ? Object.assign({ at: Date.now() }, goal) : null; if (this._file) this._file.click(); };
    out.introPick = () => { this._introGoal = null; if (this._file) this._file.click(); };
    out.introDrop = e => { this._introGoal = null; out.onDrop(e); };
    out.introOpenExplore = open(null);
    out.introOpenCharts = open({ tab: 'plots', plotKind: '__gallery' });
    out.introOpenMap = open({ tab: 'plots', plotKind: 'map' });
    out.introOpenText = open({ tab: 'text' });
    out.introOpenNet = open({ tab: 'ergm' });
    const list = !out.showWork && !S.parsing && S.screen !== 'work' ? (S.asList || []).slice(0, 4) : [];
    out.introRecent = list.map(r => {
      const sm = this.asSummary(r.sum);
      return { name: r.fileName, sub: [sm, this.asWhen(r.at)].filter(Boolean).join(' · ') + (r.hasFull ? '' : ' · open the file again to restore it'), canRestore: !!r.hasFull, restore: () => this.autoRestore(r.sig), discard: () => this.autoDiscard(r.sig) };
    });
    out.hasIntroRecent = out.introRecent.length > 0;
  }
  // after the file has loaded, go to the task's tab (only for a goal set in the last 15 minutes)
  introApply() {
    const g = this._introGoal; this._introGoal = null; if (!g || Date.now() - g.at > 15 * 60 * 1000) return;
    if (g.tab === 'plots' && g.plotKind) this.csOpen(g.plotKind); else this.setState({ tab: g.tab, mfNav: '', mfFile: false, mfMobile: 'analysis' });
    // Networks: the file just opened is the list of ties
    if (g.tab === 'ergm' && typeof this.nlUseCurrent === 'function') setTimeout(() => { try { this.nlUseCurrent('e'); } catch (e) {} }, 0);
  }
