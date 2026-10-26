# Scales family (pca, efa) — notes

Implementation: `src/engine/methods/scales.mjs` + `src/engine/lib/scales-lbfgsb.mjs`. Validated against
R 4.3.3 / psych 2.4.1 / GPArotation 2024.2-1 with `cases/scales.mjs` (32 cases). All pass at rel 1e-6;
observed maximum relative differences ≤ 5e-9.

Sign convention: every case compares 'Component loadings', 'Component scores', 'Factor loadings' and
'Factor scores' with `signFree` (per-column reflection). Eigenvector signs from prcomp/LAPACK are arbitrary;
psych normalises factor signs by column sums, which JS reproduces, so for EFA signFree is a safeguard only.

Ports:
- prcomp: centre (and scale with sd, n − 1), thin SVD; sdev = d/sqrt(n − 1). Score row names are the
  original data row numbers kept by clean(), as R's row names.
- psych::fa/fac: smc (1 − 1/diag(R⁻¹), clamped to [0, 1]); minres/uls (fit.residuals + FAgr.minres; uls uses
  the full squared residual matrix) and ml (FAfn/FAgr, FAout) fitted by `optim(method = 'L-BFGS-B', lower =
  .005, upper = max(smc, 1), parscale = .01)`; principal axis iteration (min.err .001, max.iter 50); sign by
  column sums; 1e-15 for exact zeros; rotations stats::varimax (normalize, eps 1e-5), psych::kaiser +
  Promax(m = 4) for 'promax', GPArotation::GPFoblq/vgQ.oblimin (gam 0, eps 1e-5) for 'oblimin'/'quartimin';
  re-signing, ordering by (Phi·)L'L variance with original column names kept (e.g. MR2 MR1 MR3);
  communality = diag(LL') of the unrotated solution; regression (Thurstone) scores scale(x) %*% solve(R, LΦ);
  no score table when n = p (psych treats the data as a correlation matrix). The ultra-Heywood warning,
  "Specified rotation not found" and the minres fallback for an unknown factor method are reproduced.
- L-BFGS-B: psych stops at optim's default factr = 1e7, which is ~5e-5 (relative) away from the exact
  optimum, so `lib/scales-lbfgsb.mjs` is a line-by-line port of R's lbfgsb.c (cauchy, subsm, formk, formt,
  bmv, matupd, dcsrch/dcstep line search, LINPACK dpofa/dtrsl) and of the optim driver (maxit 100,
  parscale/fnscale). With it the iterates match R to ~1e-9.
- Principal-axis solutions with imaginary eigenvalues (NaN loadings) fail as R does: "infinite or missing
  values in 'x'" when a varimax/promax/oblimin rotation follows, otherwise "subscript out of bounds".

Deviations:
- Factor methods wls, gls, alpha, minchi, minrank, ols, old.min are not implemented (the app offers minres,
  ml, pa); they return the error 'Factor method "…" is not available in the built-in engine…', where R
  would fit them. Rotations other than none/varimax/promax/oblimin/quartimin (e.g. geominQ, quartimax) are
  treated as 'none' with the "Specified rotation not found" diagnostic; R would apply them.
- Eigen-decompositions use the shared Jacobi eigenSym/svd instead of LAPACK (differences ~1e-15).
- Diagnostics (fa summary, KMO, Bartlett) are R-like text but abbreviated: fit indices beyond RMSR (chi
  square, TLI, RMSEA, BIC, score adequacy) are not printed.
