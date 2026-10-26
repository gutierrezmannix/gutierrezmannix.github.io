# ANOVA family — notes on the built-in engine port

Module: `src/engine/methods/anova.mjs` (+ `src/engine/lib/anova-mvt.mjs`). Cases: `tools/engine/cases/anova.mjs`
(75 cases, all passing `node tools/engine/compare.mjs anova-` against R 4.3.3 / car 3.1.2 / multcomp 1.4.25 / mvtnorm 1.2.4).

## How each method is reproduced

- **factorial / ancova** — `lm` via the shared `design`/`lm`/`fitout`; sum contrasts (`v31`, `v32`, …) on every factor
  term when `ss = 'III'`. `car::Anova`: type III is the Wald test of each term's coefficients (intercept included);
  type II is SS(term | every term that does not contain it), computed by model comparison. That equals car's
  conjugate-complement `linearHypothesis` exactly (the Wald SS of the term + its relatives splits additively into the
  relatives' SS and the conjugate-complement SS), so car's marginality rules for interactions are followed. `ss`
  is matched like `match.arg(c('II','III','2','3'))` (numeric 2/3 accepted, as in car; other values give car's
  error after the model output has been built, as in R).
- **repeated** — `lm(mat ~ 1)` + `car::Anova(idata, idesign = ~condition, type = 'III')` reduced to closed forms:
  SSP = n·(P'm)(P'm)', SSPE = P'EP, Sum Sq = tr(SSP (P'P)⁻¹), Error SS = tr(SSPE (P'P)⁻¹); GG ε =
  tr(A)²/(p·tr(A²)) with A = SSPE (P'P)⁻¹ (same as car's eigenvalue form), HF ε with car's formula, Mauchly's test
  with car's formula (including its `3 * p` term with p = number of conditions). The singular-SSPE rule
  (eigenvalues < √eps) and car's two warnings are reproduced. Only the Design table, the note and N are compared;
  the Diagnostics text follows `print.summary.Anova.mlm` closely but is not byte-identical.
- **welch_anova** — `oneway.test(var.equal = FALSE)` formula; zero-variance groups give NaN like R.
- **tukey** — `TukeyHSD` (lower-triangle order `b-a, c-a, …, c-b`), ptukey/qtukey from `lib/dist.mjs`.
- **gameshowell** — the formula in the R engine.
- **contrasts** — `glht(lm(y ~ 0 + g), linfct = C)`; multcomp's p.adjust-type `adjusted()` uses
  `2 * (1 - pt(|t|, df))` (not `lower.tail = FALSE`) then `p.adjust`; reproduced literally. Parsing reproduces
  `strsplit` (trailing separators/newlines ignored, blank lines rejected), `rbind` recycling of short rows (with its
  warning) and the R error for an empty matrix.
- **pairwise** — `pairwise.t.test(pool.sd = FALSE)` (Welch t, “data are essentially constant” check) and
  `pairwise.wilcox.test(exact = FALSE)` (normal approximation with continuity and tie correction; all-tied pairs
  give NA, which `p.adjust` excludes from n). `match.arg` errors use R's UTF-8 fancy quotes.
- **dunnett** — see below. A numeric `reference` behaves as in R's `relevel` (taken as a level index, with R's
  `ref = … must be in 1L:k` error).

## Deviation: Dunnett critical values (documented tolerance)

multcomp's `confint(glht)` gets the two-sided critical value from `mvtnorm::qmvt`, which searches with
`ptol = 0.001` on probabilities computed by randomized Genz–Bretz quasi-Monte-Carlo (`abseps = 0.001`). R's value
therefore depends on the RNG stream and is off by up to ~1e-3 in coverage. The engine computes the many-to-one
(product correlation ρᵢⱼ = λᵢλⱼ, λᵢ = √(nᵢ/(nᵢ+n₀))) multivariate t probability by deterministic quadrature
(Gauss–Legendre over log s for the χ scale and over the shared normal factor, `lib/anova-mvt.mjs`) and solves for the
quantile with `uniroot` (tol 1e-11), so it returns the exact critical value. With two groups R uses `qt` and so does the
engine (exact match).

Validation (R high-precision `pmvt`, GenzBretz maxpts 2e6, abseps 1e-7):

| case | level | R crit | P(R crit) | engine crit | P(engine crit) |
|---|---|---|---|---|---|
| dunnett | 0.95 | 2.413888 | 0.950034 | 2.413608 | 0.9500001 |
| dunnett_ref | 0.90 | 2.085656 | 0.900046 | 2.085446 | 0.9000000 |
| dunnett_six | 0.95 | 2.579280 | 0.950061 | 2.578816 | 0.9499997 |
| dunnett_small_df | 0.95 | 2.691094 | 0.950326 | 2.687419 | 0.9499997 |
| dunnett_three | 0.95 | 2.251844 | 0.950007 | 2.251788 | 0.9500000 |

The quadrature itself agrees with mvtnorm's exact bivariate algorithm to 12 digits and with high-precision QMC in
3–5 dimensions within the QMC error (1e-7–1e-6); against a 16× finer rule its error is ≤ 1e-9 for ν ≥ 3 and
≤ 6e-8 in extreme cases (ν = 1, λ ≈ 0.98). Dunnett cases therefore compare interval ends with
`{ tol: 3e-3, abs: 5e-3 }` (Estimate is exact). The single-step p-values in the Diagnostics text are
1 − P(max|T| ≤ |t|) from the same integral (R's are QMC estimates).

## Not reproduced

- `contrasts` with `adjust = 'single-step' | 'Shaffer' | 'Westfall' | 'free'` (multcomp's multivariate-t
  adjustments for an arbitrary contrast matrix) gives an explicit engine message instead; the page only offers
  holm, bonferroni, BH, BY, hochberg, hommel and none.

## Shared-library issues found (worked around locally, not changed)

1. `ctx.group` (lib/frame.mjs) converts numeric values to text before building the Factor, so numeric groups sort as
   text (`1, 10, 2`) instead of numerically as R's `factor()` does. anova.mjs uses its own `group()`
   (`new Factor(values)` sorts numbers numerically). Cases `*_numeric_groups`, `factorial_3way_*`, `dunnett_numeric_ref`.
2. `ctx.numbers` uses `String.split`, which keeps a trailing empty piece (`'1,2,'`, a trailing `\r` or newline),
   so it errors where R's `strsplit` drops it. anova.mjs parses contrast rows with an R-compatible `rsplit`.
3. `fitout` (lib/models.mjs) always adds the warning “predictions on current data refer to _future_ responses”,
   but the R engine calls `predict(m, newdata = NULL, …)`, which does not warn; R references have no warning (soft
   difference on every lm case).
