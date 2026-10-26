# Multilevel and panel methods — validation notes

Ids: `mixed`, `glmm`, `panel_fe`, `panel_re`, `panel_dynamic` (`src/engine/methods/multilevel.mjs`, helpers in
`src/engine/lib/multilevel-mixed.mjs` and `src/engine/lib/multilevel-panel.mjs`). Cases: `tools/engine/cases/multilevel.mjs`
(compared with R 4.3.3, lme4 1.1-35.1, plm 2.6-3, lmtest 0.9-40, sandwich 3.1-0).

## What is reproduced exactly

- **plm within / random** (`panel_fe`, `panel_re`, all three `effects`, balanced and unbalanced, numeric or text ids
  and periods): plm.fit, ercomp `swar` (balanced `dfcor = 2` and unbalanced `dfcor = 3` moment matrices; the
  Wansbeek–Kapteyn GLS plm uses for unbalanced two-way random effects), plm's dropping of constant columns,
  `vcovHC(type = "HC1", cluster = "group")`, `coeftest(df = #panels − 1)`. `fitout()` on a plm object gives
  `Model summary` = (N, NA, NA, NA) (no logLik method) and predictions `predict.plm()` = `fitted_exp`: y minus the
  within residuals for FE, `X β` (pooled X) for RE, in pdata.frame order (rows sorted by panel, then period).
  Matches R at the default 1e-6 tolerance.
- **pgmm** (`panel_dynamic`): difference GMM, two steps, `collapse = TRUE`, instruments `lag(y, 2:L)` plus the
  differenced regressors, first-step H matrix, generalized inverses (with plm's warnings) when a weighting matrix is
  singular, Windmeijer-corrected `vcovHC.pgmm`, `nobs` = number of non-zero residuals, unbalanced panels filled to
  the full id × period grid. Matches at 1e-6. R's error for too few periods (`mtest(order = 1)` in `summary()`) is
  reproduced. Lags are taken by position in the sorted period levels (plm's `lag(shift = "time")` gives the same
  result whenever the periods are consecutive; a gap in the *overall* set of periods would differ).
- **glmer** (`glmm`, binomial / poisson): the deviance function is lme4's, bit for bit in structure: the coarse joint
  PIRLS at θ = 1 from `mustart`, the nAGQ = 0 stage over θ, and the Laplace stage over (θ, β) whose PIRLS restarts
  from the stage-1 linear predictor every evaluation, with lme4's convergence rule (|Δpdev/pdev| < 1e-7) and with
  `ldL2` taken from the Cholesky factor of the last iteration's (pre-update) weights. lme4's own `Nelder_Mead`
  (C++ `NelderMead` class) is ported move for move, with `optwrap`'s adjusted `xst`/`xt`, followed by
  `check.boundary`, `deriv12` (central differences, δ = 1e-4), `checkConv` and the Hessian-based `vcov.merMod`
  (RX-based fallback with lme4's warning). Stage 1 (minqa `bobyqa` in R) is solved to full precision instead; R's
  stage-1 θ agrees to ~5e-10, so the Nelder–Mead path is the same and estimates agree to ~1e-9.
- **lmer** (`mixed`): profiled REML/ML deviance (lme4's formulas: `ldL2 + ldRX2 + (n−p)(1 + log 2π pwrss/(n−p))`),
  σ², RX-based `vcov`, `VarCorr` data frame (variances, then covariances/correlations in `lower.tri` order, then
  `Residual`), ICC, singular note (`isSingular`, tol 1e-4), `checkConv` on the θ Hessian, lme4's input checks
  (grouping levels < n, observations > random effects, `response must be numeric`, rank-deficient X columns dropped
  by the LINPACK pivot as `chkRank.drop.cols`), `checkScaleX` warning.

## Deviations (loosened tolerances, per case)

| Cases | Tolerance | Reason |
|---|---|---|
| `mixed_reml`, `mixed_ml`, `mixed_alpha10`, `mixed_missing_numid`, `mixed_singular`, `mixed_rank_deficient` | rel 1e-6, abs 1e-7 | lmer optimizes θ with nloptr BOBYQA (`ftol_abs = xtol_abs = 1e-8`), which stops ~1e-7 (relative) short of the optimum. The JS engine minimizes the same deviance to full precision (projected BFGS + Newton polishing); its deviance is never larger than R's. The abs floor covers predictions near 0. |
| `mixed_slope`, `mixed_slope_ml`, `mixed_slope_z` | rel 1e-4, abs 1e-5 | Same, with 3 θ parameters: R's BOBYQA leaves ~1e-5 relative error in the covariance parameters (checked by refitting in R with `xtol_abs = ftol_abs = 1e-14`, which moves R's own answer by the same amount towards the JS one). Porting nlopt's BOBYQA bit-for-bit was not attempted. |
| `mixed_large_slope` (3000 rows, 300 groups) | rel 1e-4, abs 1e-4 | As above; the random-effect correlation (≈ −0.04) differs by 2e-5 absolute. JS logLik is higher than R's by 6e-11. |
| `mixed_slope_factor` (random slope on a 3-level factor, singular fit) | rel 1e-3, abs 1e-4 | Singular (boundary) fit with a flat likelihood: R's BOBYQA stops ~2e-4 (relative) away in the variance components; JS logLik is higher than R's by 2e-7. |
| `glmm_binomial`, `glmm_poisson`, `glmm_*_factor*`, `glmm_binomial_flat` | rel 1e-5, abs 1e-6 | Estimates agree to ~1e-9; standard errors come from a finite-difference Hessian (δ = 1e-4) of a deviance that agrees with R's to ~1e-13, so rounding differences are amplified by 1/δ² to ~1e-6 relative in the SEs. |
| `glmm_binomial_slope`, `glmm_poisson_alpha10_slope`, `glmm_large_binomial` | rel 1e-4, abs 1e-5 / 1e-4 | As above; with more parameters the Nelder–Mead path can drift slightly (start differs from R's bobyqa result by ~1e-9); a z value of a near-zero coefficient differs by 2e-5 absolute in the large case. |
| `glmm_negbin`, `glmm_large_negbin` | rel 1e-4, abs 1e-5 / 1e-4 | glmer.nb: theta.ml on the Poisson GLMM, `glmer(negative.binomial(θ))`, then `optimize()` (R's Brent `fmin`, ported, including its final re-evaluation) over log θ with each `refit()` restarting PIRLS from the previous fit's random effects only (as `refit.merMod` does) and Nelder–Mead with default steps. The Nelder–Mead stops within `xt` (1e-5) of the optimum, and tiny start differences move the stopping point inside that box, so results agree to ~1e-5. |

Soft differences (not compared): Diagnostics text is an abbreviated R-like summary (call/formula, random effects,
fixed effects, convergence messages; plm/pgmm coefficient tables and the Sargan test), not a verbatim
`print(summary(m))`. lme4's informational `message()`s (singular fit, dropped columns) are messages in R, not
warnings, so they are not reported.

## Not covered / known limits

- `glmer` convergence failures that depend on R's optimizer path (e.g. R reporting a max|grad| failure that the
  exact optimum would not have) cannot be reproduced; the JS checks run lme4's `checkConv` rules on its own optimum.
- PIRLS failures (`pwrssUpdate did not converge`, step-halving failures) use lme4's messages but only arise in
  degenerate data.
- An exposure (`offset`) field is validated (`Exposure must be positive.`) but, exactly as in the R engine, not used
  by these models (the mixed formulas are rebuilt without it; plm ignores `offset()` terms).

## Performance (node 22, one core)

mixed 3000 rows / 300 groups with random slope ≈ 0.4 s; glmm binomial same size ≈ 1 s; glmer.nb same size ≈ 4–7 s
(about 15 complete refits, each a full Nelder–Mead run, as R does); panel models with 3000 rows < 0.1 s.
