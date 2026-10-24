  // GM26 regression sample reporting begin
  regressionSampleVals(out, model) {
    const total = this._raw.n, within = this.keptN(), used = model.n;
    const outside = total - within, excluded = within - used;
    out.regSampleText = 'Estimation sample: ' + this.fmtN(used) + ' observations used by this regression. '
      + this.fmtN(total) + ' rows in the dataset'
      + (outside ? '; ' + this.fmtN(outside) + ' excluded by the active filter/subgroup' : '')
      + (excluded ? '; ' + this.fmtN(excluded) + ' additional rows excluded by the model’s variable, weight or design requirements' : '') + '.';
    out.regSampleUsed = used; out.regSampleDataset = total;
    out.regSampleOutside = outside; out.regSampleExcluded = excluded;
    out.sumCells = out.sumCells.map(cell => ({ ...cell,
      k: cell.k === 'N' ? 'N USED' : cell.k,
      tip: cell.k === 'N' ? 'Number of observations actually used to estimate this model, after its exclusions.'
        : cell.k === 'F' ? 'Joint test of all slope coefficients being zero. F can exceed 99,999; compare models using the same estimation sample and standard-error method.'
        : cell.k === 'DF' ? 'Numerator and denominator degrees of freedom for the model test.' : ''
    }));
    // The global subgroup count describes the candidate rows, not complete cases.
    out.sgN = this.fmtN(used) + ' USED IN REGRESSION · ' + this.fmtN(within) + ' ROWS IN SCOPE';
  }
  // GM26 regression sample reporting end
