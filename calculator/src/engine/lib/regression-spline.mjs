// splines::splineDesign and splines::ns (natural cubic spline basis) ported from R's splines package
// (spline_basis in splines.c; ns() knots at quantiles, boundary second-derivative constraints via qr()).
import * as L from './linalg.mjs';
import { quantile7 } from './stats.mjs';

// B-spline basis values (or derivatives) at x; returns rows of length nk - ord
export function splineDesign(knots, xs, ord = 4, derivs = [0]) {
  const nk = knots.length, ordm1 = ord - 1, ncoef = nk - ord, out = [];
  xs.forEach((x, i) => {
    // set_cursor
    let curs = -1, boundary = false;
    for (let k = 0; k < nk; k++) { if (knots[k] >= x) curs = k; if (knots[k] > x) break; }
    if (curs > nk - ord) { const last = nk - ord; if (x === knots[last]) { boundary = true; curs = last; } }
    const row = new Array(ncoef).fill(0), der = derivs[i % derivs.length];
    if (curs < ord || curs > nk - ord) { row.fill(NaN); out.push(row); return; }
    const rdel = new Array(ordm1), ldel = new Array(ordm1);
    const diffTable = (x0, ndiff) => { for (let k = 0; k < ndiff; k++) { rdel[k] = knots[curs + k] - x0; ldel[k] = x0 - knots[curs - (k + 1)]; } };
    const vals = new Array(ord).fill(0);
    if (der > 0) {
      for (let ii = 0; ii < ord; ii++) {
        const a = new Array(ord).fill(0); a[ii] = 1;
        if (der >= ord) { vals[ii] = 0; continue; }
        // evaluate()
        let outer = ordm1, nder = der; const ti = curs;
        if (boundary && nder === ordm1) { vals[ii] = 0; continue; }
        while (nder--) { for (let inner = outer, ap = 0, lp = ti - outer; inner--; ap++, lp++) a[ap] = outer * (a[ap + 1] - a[ap]) / (knots[lp + outer] - knots[lp]); outer--; }
        diffTable(x, outer);
        while (outer--) for (let ap = 0, lp = outer, rp = 0, inner = outer + 1; inner--; lp--, rp++, ap++) a[ap] = (a[ap + 1] * ldel[lp] + a[ap] * rdel[rp]) / (rdel[rp] + ldel[lp]);
        vals[ii] = a[0];
      }
    } else {
      diffTable(x, ordm1); vals[0] = 1;
      for (let j = 1; j <= ordm1; j++) {
        let saved = 0;
        for (let r = 0; r < j; r++) { const den = rdel[r] + ldel[j - 1 - r]; if (den !== 0) { const term = vals[r] / den; vals[r] = saved + rdel[r] * term; saved = ldel[j - 1 - r] * term; } else { if (r !== 0 || rdel[r] !== 0) vals[r] = saved; saved = 0; } }
        vals[j] = saved;
      }
    }
    const off = curs - ord; for (let j = 0; j < ord; j++) if (off + j >= 0 && off + j < ncoef) row[off + j] = vals[j];
    out.push(row);
  });
  return out;
}
// ns(x, df) without intercept: n × df basis
export function ns(x, df, warnings = []) {
  const nIknots = df - 1, lo = Math.min(...x), hi = Math.max(...x), bk = [lo, hi];
  let knots = [];
  if (nIknots > 0) { const by = 1 / (nIknots + 1), probs = Array.from({ length: nIknots }, (_, i) => (i + 1) * by); knots = quantile7(x, probs); }
  if (knots.length && (knots.includes(lo) || knots.includes(hi))) {
    const kmin = Math.min(...knots), kmax = Math.max(...knots);
    if (kmin === lo) { if (knots.every(k => k === lo)) throw new Error('all interior knots match left boundary knot'); const nxt = Math.min(...knots.filter(k => k > lo)); knots = knots.map(k => k === lo ? k + (nxt - lo) / 8 : k); }
    if (kmax === hi) { if (knots.every(k => k === hi)) throw new Error('all interior knots match right boundary knot'); const prv = Math.max(...knots.filter(k => k < hi)); knots = knots.map(k => k === hi ? k - (hi - prv) / 8 : k); }
    warnings.push("shoving 'interior' knots matching boundary knots to inside");
  }
  const Aknots = [lo, lo, lo, lo, ...knots, hi, hi, hi, hi].sort((a, b) => a - b);
  const basis = splineDesign(Aknots, x, 4).map(r => r.slice(1)), cons = splineDesign(Aknots, bk, 4, [2, 2]).map(r => r.slice(1));
  // qr(t(const)) then t(qr.qty(qr.const, t(basis)))[, -(1:2)]
  const Q = L.qrR(L.t(cons));
  return { basis: basis.map(r => Array.from(L.qrQty(Q, r)).slice(2)), knots, boundary: bk };
}
