// Exact ports of R's BFGS minimiser vmmin (src/appl/optim.c, used by optim(method = 'BFGS') and nnet) and of
// optimhess (the finite-difference Hessian optim(hessian = TRUE) returns), so iterative fits stop at R's iterate.

// fn(b) → value, gr(b) → gradient (full length); mask: which parameters vary (default all).
export function vmmin(b0, fn, gr, { maxit = 100, abstol = -Infinity, reltol = 1.490116119384765625e-8, mask = null } = {}) {
  const stepredn = 0.2, acctol = 0.0001, reltest = 10.0, n0 = b0.length, b = b0.slice();
  if (maxit <= 0) return { par: b, value: fn(b), fail: 0, fncount: 0, grcount: 0 };
  const l = []; for (let i = 0; i < n0; i++) if (!mask || mask[i]) l.push(i);
  const n = l.length, t = new Float64Array(n), X = new Float64Array(n), c = new Float64Array(n), B = Array.from({ length: n }, (_, i) => new Float64Array(i + 1));
  let f = fn(b); if (!Number.isFinite(f)) throw new Error("initial value in 'vmmin' is not finite");
  let Fmin = f, funcount = 1, gradcount = 1, g = gr(b), iter = 1, ilast = gradcount, count = 0;
  do {
    if (ilast === gradcount) for (let i = 0; i < n; i++) { for (let j = 0; j < i; j++) B[i][j] = 0; B[i][i] = 1; }
    for (let i = 0; i < n; i++) { X[i] = b[l[i]]; c[i] = g[l[i]]; }
    let gradproj = 0;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s -= B[i][j] * g[l[j]]; for (let j = i + 1; j < n; j++) s -= B[j][i] * g[l[j]]; t[i] = s; gradproj += s * g[l[i]]; }
    if (gradproj < 0) {
      let steplength = 1.0, accpoint = false;
      do {
        count = 0;
        for (let i = 0; i < n; i++) { b[l[i]] = X[i] + steplength * t[i]; if (reltest + X[i] === reltest + b[l[i]]) count++; }
        if (count < n) { f = fn(b); funcount++; accpoint = Number.isFinite(f) && f <= Fmin + gradproj * steplength * acctol; if (!accpoint) steplength *= stepredn; }
      } while (!(count === n || accpoint));
      const enough = f > abstol && Math.abs(f - Fmin) > reltol * (Math.abs(Fmin) + reltol);
      if (!enough) { count = n; Fmin = f; }
      if (count < n) {
        Fmin = f; g = gr(b); gradcount++; iter++;
        let D1 = 0; for (let i = 0; i < n; i++) { t[i] = steplength * t[i]; c[i] = g[l[i]] - c[i]; D1 += t[i] * c[i]; }
        if (D1 > 0) {
          let D2 = 0; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= i; j++) s += B[i][j] * c[j]; for (let j = i + 1; j < n; j++) s += B[j][i] * c[j]; X[i] = s; D2 += s * c[i]; }
          D2 = 1.0 + D2 / D1;
          for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) B[i][j] += (D2 * t[i] * t[j] - X[i] * t[j] - t[i] * X[j]) / D1;
        } else ilast = gradcount;
      } else if (ilast < gradcount) { count = 0; ilast = gradcount; }
    } else { count = 0; if (ilast === gradcount) count = n; else ilast = gradcount; }
    if (iter >= maxit) break;
    if (gradcount - ilast > 2 * n) ilast = gradcount;
  } while (count !== n || ilast !== gradcount);
  return { par: b, value: Fmin, fail: iter < maxit ? 0 : 1, fncount: funcount, grcount: gradcount };
}

// optim(par, fn, gr, method = 'BFGS', control = list(fnscale, reltol, maxit), hessian) — fnscale = -1 maximises.
export function optimBFGS(par, fn, gr, { fnscale = 1, reltol = 1.490116119384765625e-8, abstol = -Infinity, maxit = 100, hessian = false, ndeps = 1e-3 } = {}) {
  const f = p => fn(p) / fnscale, g = p => gr(p).map(v => v / fnscale);
  const r = vmmin(par, f, g, { maxit, abstol, reltol });
  const out = { par: r.par, value: r.value * fnscale, convergence: r.fail, counts: [r.fncount, r.grcount] };
  if (hessian) out.hessian = optimHess(r.par, gr, { fnscale, ndeps });
  return out;
}
export function optimHess(par, gr, { fnscale = 1, ndeps = 1e-3 } = {}) {
  const n = par.length, H = Array.from({ length: n }, () => new Array(n).fill(0)), d = par.slice();
  const g = p => gr(p).map(v => v / fnscale);
  for (let i = 0; i < n; i++) {
    const eps = ndeps; d[i] = d[i] + eps; const df1 = g(d); d[i] = d[i] - 2 * eps; const df2 = g(d);
    for (let j = 0; j < n; j++) H[i][j] = fnscale * (df1[j] - df2[j]) / (2 * eps);
    d[i] = d[i] + eps;
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { const v = 0.5 * (H[i][j] + H[j][i]); H[i][j] = H[j][i] = v; }
  return H;
}
