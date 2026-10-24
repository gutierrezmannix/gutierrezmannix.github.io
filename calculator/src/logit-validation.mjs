// GM26 logistic validation begin
function logitPredictionCheck(X, y, ri, preds, terms) {
  const n = X.length;
  // A pure categorical level allows its log-odds coefficient to diverge.
  // Count only complete estimation candidates, never unrelated dataset rows.
  for (const pr of preds) if (pr.kind === 'cat') {
    const groups = new Map();
    for (let k = 0; k < n; k++) {
      const key = pr.a[ri[k]], g = groups.get(key) || { bits: 0, count: 0 };
      g.bits |= y[k] ? 2 : 1; g.count++; groups.set(key, g);
    }
    if (groups.size < 2) continue;
    for (const [level, g] of groups) if (g.bits !== 3) return {
      term: pr.name, level: String(level), count: g.count, outcome: g.bits === 2 ? 1 : 0,
      description: pr.name + ' = ' + String(level) + ' occurs in ' + g.count.toLocaleString('en-US') + ' complete rows, all with outcome ' + (g.bits === 2 ? '1' : '0')
    };
  }
  // Includes binary numeric predictors and one-variable threshold separation.
  // This is an algebraic separation condition, independent of coefficient units.
  for (let j = 1; j < terms.length; j++) {
    let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const v = X[k][j];
      if (y[k]) { lo1 = Math.min(lo1, v); hi1 = Math.max(hi1, v); }
      else { lo0 = Math.min(lo0, v); hi0 = Math.max(hi0, v); }
    }
    if (Math.max(hi0, hi1) > Math.min(lo0, lo1) && (hi0 <= lo1 || hi1 <= lo0)) return {
      term: terms[j].label, count: n,
      description: terms[j].label + ' completely or quasi-completely separates the two outcomes'
    };
  }
  return null;
}
function logitPredictionError(details, n, dropped) {
  return {
    error: 'Perfect prediction (complete or quasi-complete separation): ' + details.description + '. The requested logistic model has no finite maximum-likelihood estimate. Coefficients, p-values, confidence intervals and predictions are not reported. Stata may omit the perfectly predicted rows and the predictor, then fit a reduced model; that is a different estimation sample and specification.',
    errorCode: 'logit_separation', separation: details, completeN: n, dropped
  };
}
function logitDirectionSeparates(X, y, direction) {
  let strict = false;
  for (let i = 0; i < X.length; i++) {
    let eta = 0; for (let j = 0; j < direction.length; j++) eta += X[i][j] * direction[j];
    const margin = (y[i] ? 1 : -1) * eta;
    if (!Number.isFinite(margin) || margin < 0) return false;
    if (margin > 1e-8) strict = true;
  }
  return strict;
}
// GM26 logistic validation end
