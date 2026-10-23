  // GM26 button repairs v1
  numberText(v) { return Number.isFinite(v) ? (Object.is(v, -0) ? '-0' : String(v)) : ''; }
  semFitKey() {
    const S = this.state;
    return JSON.stringify([S.semF, S.semP, S.semZero, S.semMethod || 'ml',
      this.dataSig(), S.dver || 0, S.treat, S.missingCodes, S.autoScreen, S.flt, S.subg]);
  }
  editSem(patch, done) {
    this._semRunId = (this._semRunId || 0) + 1;
    this.setState(s => Object.assign({}, typeof patch === 'function' ? patch(s) : patch, {
      semFit: null, semBusy: false,
      semErr: s.semFit || s.semBusy ? 'Model changed. Run SEM again to update the results.' : ''
    }), done);
  }
