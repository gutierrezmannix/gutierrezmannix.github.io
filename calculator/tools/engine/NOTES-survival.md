# Survival family (km, cox, survreg) — notes

Implementation: `src/engine/methods/survival.mjs`. Validated against R 4.3.3 / survival 3.5-8 with
`cases/survival.mjs` (43 cases: normal use, options, alpha = 0.10, ties, missing data, n > 200, zero times,
separation, collinearity, every validation message). All pass at the default tolerance (rel 1e-6); observed
maximum relative differences are ~1e-14 for km/cox and ≤ 4e-8 for survreg.

Ports (from the survival sources): `aeqSurv` (timefix), survfitKM (Greenwood se of log S, log CI capped at 1,
NA when S = 0), summary.survfit event rows, survdiff2 (rho = 0; chi-square on groups with expected > 0),
coxfit6 (Efron, centring + mean-absolute-deviation scaling, cholesky2/chsolve2/chinv2 with toler.chol =
eps^0.75, step halving, eps = 1e-9, iter.max = 20, the "Ran out of iterations" and "Loglik converged before
variable … coefficient may be infinite" warnings, NA for singular columns → the fitout() error), zph1
(cox.zph with transform 'km', per-term and GLOBAL score tests), survreg distributions (extreme, logistic,
gaussian, weibull, exponential, rayleigh, loggaussian, lognormal, loglogistic, t with df = 4) with
match.arg partial matching and R's exact error text.

Behaviour that follows R rather than the brief's wording:
- cox and survreg produce no "Predictions" table and survreg produces no "Coefficients" table, because in R
  `predict(m, newdata = NULL, type = 'response')` errors for both and `coef(summary(survreg))` is not a matrix.
  The survreg coefficient table (incl. Log(scale)) is in the Diagnostics text (summary.survreg layout).
- BIC for coxph uses log(number of events) (nobs.coxph); "Number of observations" uses m$n.

Deviations (documented, not compared by compare.mjs):
- survreg: the MLE is found by damped Newton–Raphson iterated to full convergence instead of survreg6's
  exact iteration sequence; R stops at rel. loglik change 1e-9, so R's values carry ~1e-8 optimizer error
  (largest seen 4e-8 on near-zero quantiles). Tolerance default 1e-6 is never exceeded.
- Plots: KM curves (with log CI for a single curve, "+" censor marks) and Schoenfeld residual panels (scaled
  residuals as cox.zph's $y, one panel per term stacked vertically, with a local-linear smoother instead of
  plot.cox.zph's natural-spline fit ± 2 se). Hence R's soft warning "shoving 'interior' knots matching boundary
  knots to inside" (from ns() in plot.cox.zph) is not reproduced.
- Diagnostics text approximates print.survfit / print.survdiff / summary.coxph (concordance omitted) /
  summary.survreg.
