# Regression family — validation notes

Ids: `probit` (done earlier), `multinomial`, `negbin`, `hurdle`, `zeroinfl`, `robustreg`, `quantile`, `spline`, `gam`.
Code: `src/engine/methods/regression.mjs` plus helpers `src/engine/lib/regression-{optim,count,rq,spline,gam}.mjs`.
Cases: `tools/engine/cases/regression.mjs` (49 cases, all pass against R 4.3.3; `regression_core.mjs` keeps the probit cases).

## What is ported (and how exactly)

| id | R | port | agreement on the test cases |
|---|---|---|---|
| multinomial | `nnet::multinom(maxit = 1000, Hess = TRUE)` | the nnet softmax objective/gradient and R's BFGS `vmmin` (exact port, same start = 0, same mask, abstol 1e-4, reltol 1e-8), `multinomHess`, `vcov` = MASS-style `ginv` | ≤ 4e-9 relative |
| negbin | `MASS::glm.nb` | `theta.ml`, `negative.binomial(theta)` family on the shared `glm()`, the alternation loop, logLik/AIC as MASS (`2·rank + 2`) | ≤ 5e-11 (theta → ∞ case), else ≤ 2e-14 |
| hurdle | `pscl::hurdle(dist, separate = TRUE)` | count/zero log-likelihoods and analytic gradients, starting values (Poisson / binomial `glm.fit`), `optim(BFGS, fnscale = -1, reltol = eps^(1/1.6))`, `optimhess` (ndeps 1e-3), `-solve(hessian)` | Poisson count part ≤ 2e-12; truncated-NB count part ≤ 7e-7 (see below) |
| zeroinfl | `pscl::zeroinfl(dist, EM = FALSE)` | joint log-likelihood/gradient, the truncated-count pre-fit (used only as a convergence check, as in pscl), glm starting values, optim + optimhess | ≤ 1.3e-11 |
| robustreg | `MASS::rlm(maxit = 200)` | Huber IWLS (k = 1.345, MAD scale, LS start, `irls.delta` ≤ 1e-4), `summary.rlm` (XtX method), `logLik.lm`; fitout with qnorm intervals and no ANOVA | ≤ 2e-14 |
| quantile | `quantreg::rq(method = 'br')` + `summary(se = 'nid')` | line-by-line port of `rqbr.f` (Barrodale–Roberts simplex, single-quantile path), Hall–Sheather bandwidth, `rq` at tau ± h, `2·(1 − pt(|t|))` p-values; `logLik.rq`, AIC.rq, BIC = NA (as R) | ≤ 1.3e-14 |
| spline | `lm(y ~ splines::ns(v, df = k))` | `splineDesign` (spline_basis C code incl. derivatives) and `ns()` (quantile knots, knot shoving, `qr(t(const))`), R column names `splines::ns(v2, df = 4)1…` and one ANOVA row per ns() term | ≤ 2e-12 |
| gam | `mgcv::gam(s(v, k = min(k, unique − 1)), method = 'REML')` | see below | gaussian/binomial/poisson/negbin ≤ 1.3e-9 relative (default 1e-6 tolerance everywhere) |

### gam
- Basis: exact port of mgcv's `tprs_setup` for d = 1, m = 2: knots = sorted unique covariate values (or 2000 knots
  sampled with `set.seed(1)` when there are more, as `smooth.construct.tp`), η(r) = r³/12, `Rlanczos` (same start
  vector, re-orthogonalisation, convergence test and output order), `QT`/`HQmult` Householder null-space constraint,
  rms column scaling, `smoothCon` penalty scaling and the `qr(t(colSums(X)))` sum-to-zero absorption. The model
  matrix equals mgcv's to ~1e-14 up to column signs, which do not affect any output (testStat's sign convention
  depends only on the direction of each smooth's first column).
- Criterion: mgcv's REML/Laplace score (gaussian with log φ as an extra parameter; binomial/poisson; nb() with
  log θ, observed-information weights in log|H|). Verified to reproduce `m$gcv.ubre` at R's estimates to 1e-13.
- Optimiser: port of mgcv's `newton()` (uconv set, eigen-fixed Hessian, maxNstep 5, step halving, steepest-descent
  switch, convergence rule) started from `initial.spg`/`initial.sp`, `log(null.scale/10)` and log θ = 0. The REML
  gradient is analytic; the Hessian is analytic for gaussian and a central difference of the analytic gradient
  (h = 1e-5) otherwise. Because the iterates follow R's, even smooths heading to λ → ∞ (edf ≈ 1.0001) match.
- Post-processing: Vp, edf, edf1, edf2 (Vc = Vb + J V_ρ J' + Vb.corr with `dchol`), `scale.est = RSS/(n − tr F)`;
  for nb() Vp/edf use the Fisher weights mgcv stores in `object$weights`. `summary.gam`: p.table, s.table through
  `testStat` (type 0) with a port of mgcv's Davies (1980) `psum.chisq`. `logLik.gam` (df from edf2, + θ for nb),
  AIC, BIC. predict(newdata = NULL) fails in R after the warning "not all required variables have been supplied in
  newdata!"; the engine emits the same warning and no prediction table.

## Tolerances and deviations
- `hurdle_nb`, `hurdle_offset`: compare tolerance 1e-5. The truncated negative-binomial count part is maximised by
  BFGS that stops when the relative change of the log-likelihood is below eps^(1/1.6) ≈ 1.6e-10; last-bit
  differences in the objective (R evaluates pnbinom through toms708 `bratio`) can make the stopping test fire one
  step apart, moving estimates by ~1e-8 relative and p-values by up to 7e-7 relative. All other cases use the
  default 1e-6.
- Diagnostics text (not compared) is an approximation of R's printed summaries. For `quantile` the Diagnostics show
  the nid summary (R prints `summary.rq` with its default rank-inversion intervals there); for `gam` the k.check
  lines give k', edf and the k-index but not the randomisation p-value.
- `hurdle`/`zeroinfl` with `countFamily = 'geometric'` (not offered by the UI) is rejected with R's match.arg message.
- gam: thin-plate smooths are implemented for one covariate each (all the R block creates); an unknown `family`
  option gives "family not recognized".

## Speed (Node 22, 3000 rows, 3 predictors + 4-level factor)
multinomial 0.14 s, negbin 0.2 s, hurdle 0.26 s, zeroinfl 0.43 s, robustreg 0.08 s, quantile 0.3 s, spline 0.12 s,
gam 1.6 s (gaussian, k = 10, 2000 knots) to 3 s (negbin).

## Shared-library issues found (worked around locally, not changed)
- `models.mjs` `glm()`: with an offset and an intercept, `nullDeviance()` calls `glm()` on the intercept-only model,
  which again has an intercept + offset and recurses until the stack overflows (caught, NaN) — ~8 s per call.
  `regression-count.mjs` hides the intercept name from `glm()` when an offset is present.
- `models.mjs` `fitout()` (at the time of writing) added the predict.lm "_future_ responses" warning, which R does
  not emit for `newdata = NULL` (the warning needs a missing newdata) — reported; since fixed upstream.
- `dist.mjs` `digamma`/`trigamma` start the asymptotic series at x ≥ 6 (≈1e-11 relative error); the regression
  helpers use local versions started at x ≥ 12.
