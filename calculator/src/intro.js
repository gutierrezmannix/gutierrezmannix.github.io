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
  }
