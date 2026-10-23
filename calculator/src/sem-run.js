  runSem() {
    const S = this.state, E = this._E, spec = this.semSpec(S.semF || [], S.semP || []);
    const runId = this._semRunId = (this._semRunId || 0) + 1;
    const fail = semErr => this.setState({ semFit: null, semBusy: false, semErr });
    if (spec.err) return fail(spec.err);
    const names = spec.factors.flatMap(f => f.items), cols = [];
    for (const v of names) {
      const cv = this.numVals(v);
      if (!cv) return fail('"' + v + '" is not numeric — SEM items must be numbers (e.g. a 0–10 scale)');
      cols.push(cv.a);
    }
    let k = 0;
    const fs = spec.factors.map(f => ({ name: f.name, items: f.items.map(() => k++), marker: f.marker }));
    const method = S.semMethod || 'ml', key = this.semFitKey(), raw = this._raw;
    this.setState({ semBusy: true, semFit: null, semErr: '' });
    setTimeout(() => {
      if (this._semRunId !== runId) return;
      if (this._raw !== raw || this.semFitKey() !== key) return fail('Data or model changed. Run SEM again to update the results.');
      let fit;
      try { fit = E.semFit(cols, names, { factors: fs, paths: spec.paths, zero: spec.zero, method }); }
      catch (e) { fit = { error: String(e && e.message || e) }; }
      this._semFitKey = fit.error ? null : key;
      this.setState({ semBusy: false, semFit: fit.error ? null : fit, semErr: fit.error || '' });
      if (!fit.error) this.pushLog({ t: 'sem', r: spec.r, stata: spec.stata, res: 'N = ' + this.fmtN(fit.N) + ' · CFI ' + this.fmt(fit.cfi, 3) + ' · RMSEA ' + this.fmt(fit.rmsea, 3) + ' · SRMR ' + this.fmt(fit.srmr, 3) });
    }, 30);
  }
