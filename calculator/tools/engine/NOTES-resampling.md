# Resampling family (bootstrap, permutation, impute) — notes

Cases: `tools/engine/cases/resampling.mjs` (51 cases: 22 bootstrap, 16 permutation, 13 impute); all match R
4.3.3 (boot 1.3-30, coin 1.4-3, mice 3.16.0, nnet 7.3-19) at the default tolerance (rel 1e-6), including the
Monte-Carlo quantities. No case uses `compare` overrides.

## Exact replication of R's random draws
- **bootstrap** (`boot::boot`): `ordinary.array` draws `sample.int(n, n*R, TRUE)` into an R x n matrix by column;
  the JS streams the same draws column by column (`lib/resampling-rng.mjs`, a fast copy of R's Mersenne-Twister
  and `R_unif_index`) and accumulates each replicate's statistic without storing n*R indices. The median replays
  the stream twice (rank buckets, then the values of the bucket holding the median). `boot.ci` percentile and BCa
  use `norm.inter` exactly; the BCa acceleration uses `empinf.reg` (regression of t on the frequency array
  regenerated from the saved seed, as `boot.array` does), including R's errors when R < n
  ("estimated adjustment 'a' is NA"), when `w` is infinite, and `boot.ci` returning NULL for constant replicates
  (R then fails with "arguments imply differing number of rows: 1, 0").
- **tsboot fixed blocks**: `ts.array` start matrix `sample.int(n, ceiling(n/l)*R, TRUE)` by column, block wrap-around
  (endcorr = TRUE), data ordered by `order(time)`.
- **permutation** (`coin::independence_test(..., approximate(nresample))`): coin 1.4 delegates the Monte-Carlo
  null to libcoin's C code (`R_PermutedLinearStatistic` → `C_doPermuteBlock`: `j = n * unif_rand()` swaps within
  each block, blocks in level order). This is fully deterministic given R's RNG, so the JS reproduces the
  permuted linear statistics and the p-value exactly (validated: identical P in all cases, incl. 3000 rows /
  4 strata / 20000 resamples). Statistic: standardized linear statistic with the Strasser–Weber conditional
  expectation/variance summed over blocks (signed for one component, max |z| for a factor response with > 2
  levels); p = mean(max|z*| >= |z| - sqrt(eps)) as coin's `%GE%`.

## impute (mice)
All randomness in mice goes through R's RNG (`sample`, `rchisq`, `rnorm`, `runif`, and `matchindex()` calls
`base::sample`), so the chained-equations sampler is ported draw-for-draw: `make.method` defaults, `edit.setup`
(constant / collinear removal with loggedEvents), `initialize.imp`, `sampler`/`sampler.univ`, `remove.lindep`,
`mice.impute.pmm` (`.norm.draw`, `estimice` with lm.fit, matchtype 1, `matchindex` with donors = 5),
`augment()`, `mice.impute.logreg` (glm.fit IRLS, quasibinomial = binomial coefficients) and
`mice.impute.polyreg` (`nnet::multinom` from zero start weights reproduced with nnet's softmax/entropy objective
and R's `vmmin` BFGS, ported from src/appl/optim.c). Then glm per completed data set and `pool()` /
`summary(conf.int = TRUE)` (Rubin's rules, Barnard–Rubin df with dfcom = df.residual). Imputations, pooled
estimates, SEs, df and CIs match R to ~1e-12 in all cases (pmm, logreg, polyreg, mixed, binomial/poisson analysis
models, factor outcome, constant and collinear columns).

## Deviations
- **BCa diagnostics for large n**: when the exact `empinf.reg` regression would be too costly in the browser
  (R*n > 1.5e7 or 0.2*n^2*R > 1e9; R itself needs a dense R x n QR there), the acceleration `a` uses jackknife
  influence values (boot's `usual.jack`) instead. This only changes the BCa line in the Diagnostics text; the
  table (percentile interval) is unaffected, and the "a is NA" error for R < n is kept.
- Floating-point summation order (long double in R's `mean`) gives differences ~1e-15 in replicate statistics.
- Diagnostics text (print.bootci, loggedEvents) is R-like but not byte-identical; the convergence plot is a
  JS line chart of chain means (mice's lattice plot has a different layout).
- Speed: on this (slow, shared) machine the worst case, median bootstrap with n = 3000 and R = 50000, takes ~10 s
  (two replays of 1.5e8 draws); mean/sd ~3.5 s; permutation 3000 rows x 100000 resamples ~4 s; impute
  n = 2000 ~2 s.

## Shared-library issues found (worked around locally)
- `ctx.num` formats bounds with `rnum`, so `max = 100000` prints "100000" where R's message says "1e+05"
  (as.character uses scientific notation when shorter). Rewritten in the permutation handler.
- `RRNG.genrand` allocates `mag01 = [0, MATRIX_A]` on every call and works on a Uint32Array (doubles in V8), so
  it is slow for 1e8 draws; `lib/resampling-rng.mjs` is a bit-identical fast copy that continues its state.
- `linalg.solve(A)` requires a right-hand side (use `inv`); not a bug, noted for others.
