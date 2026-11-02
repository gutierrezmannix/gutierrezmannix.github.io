# Output first, compact as in Stata; interpretations checked against R — build 2026-11-02.74

**Layout, the same for all 13 models.** Step 5 shows the output first, then "What the results say" (the verdict, the
sentence, the categories note, Keep in mind, APA), then the key result.
- Linear, logit, ordered logit and Poisson: the ANOVA table with Stata's fit list beside it ("Number of obs =",
  "F(3, 12,570) =", "Prob > F", "R-squared", "Adj R-squared", "Root MSE"; for the others "LR chi2(k)" or "Wald
  chi2(k)", "Pseudo R2", "Log likelihood"). Coefficient rows are tighter.
- The coefficient table, the sentences, the reference note and the coefficient plot use variable names, as Stata
  does. The Labels button switches them to labels.
- The other nine models: their summary prints as "Number of obs = …" and their coefficients as Coef. / Std. err. / z /
  P>|z| / [95% conf. interval], with `_cons` last. Their notes come after the tables.

**Interpretation fixes** (`tests/regression-interp.test.mjs`, 7 tests). Every number in the sentences is checked
against R (lm, glm, MASS::polr) on `tests/data/regression-interp.csv`, made by `tests/regression-interp-reference.R`.
- More than four significant predictors: the sentence ends "; and N more (see the table)". It used to list four as if
  they were all.
- A numeric predictor coded in even steps (0 / 50 / 100; a 1–7 scale as 0–100) is also read per step: "idio2 (+, b =
  0.127, i.e. 6.372 per +50)", and "OR 1.97 per +50" for the ratio models.
- A tiny per-unit effect is read per +10, +100 …, never beyond the variable's range: age gives "OR 0.96 per +10", not
  "per +100".
- "Keep in mind" follows the model. A linear model whose F test had no p-value used to get the odds-ratio note.
- An F of exactly 0 now has p = 1 (`pF`); it had no p-value, which read as "could easily be chance".
- Robust, clustered or survey standard errors with logit, ordered logit or Poisson: a joint Wald test, as Stata
  reports — chi2(k), or the adjusted F(k, d − k + 1) with a survey design. It appears in the fit list and decides the
  verdict, instead of the LR test, which is not valid with sampling weights or clusters. Clustered logit Wald chi2(5)
  = 112.28, as in R.

# Scales read as categories — build 2026-11-02.73

A numeric variable whose every code has a value label (0 = Peor, 50 = Igual, 100 = Mejor; 0 = Ninguno … 3 = Superior)
is read as categories, so a regression gives one row per level, compared with the first level, as Stata's `i.var`.
The results step now says so ("idio2 and educ_nivel are read as categories …") and has a button for each such
predictor, "Use idio2 as a number", which switches it to one slope and runs the model again. The note does not show
when the C badge was chosen on purpose. Checked on MexicoLapop_Class1.dta: `pn4` on `idio2`, `q2` and `educ_nivel`
as numbers gives 0.127, 0.030 and −2.659, N = 12,574, as in R. Test: `tests/labelled-codes.test.mjs`.

# Labelled numbers, missing values and factor levels as in Stata — build 2026-11-02.71

These problems came up while running two class activities on the merged AmericasBarometer (LAPOP) file: 326,433 rows,
29 countries, with value-labelled questions (m1: 1 = Very good … 5 = Very bad).

| Where | Before | Now |
| --- | --- | --- |
| Formulas (`generate`, `replace`, Data → Calculation) | a labelled numeric variable was "text": `generate approve = (5 - m1)/4*100` was refused | formulas use the codes, as Stata does (`numCore`) |
| Conditions | `if soct2 < .` matched no row | missing is larger than any number: `x < .` = not missing, `x >= .` = missing (`condMask`) |
| `generate x = … if …` | when the formula failed, an all-missing `x` was still created and logged | the formula and the conditions are checked first; a failure leaves nothing behind |
| Categorical predictors (`i.year`, or the N/C badge) | levels came from the whole file: years without the outcome became empty dummies ("year = 2021 … are combinations of the other predictors") | levels and the base come from the rows the model uses, as Stata's `i.` does; with no rows at all, the rows-that-do-not-overlap note explains why |
| Results line with a subgroup | "13,193 rows used of 326,433" (the whole file) | "13,193 rows used of 18,116 in the subgroup" |

Checked against base R on the Mexico rows (18,116), for the console path on the raw file and for the Correlation and
Regression pages on a recoded file. Every r, b and N matches, for example:
- `regress approve econ_worse`: b = −17.333, N = 13,193;
- the same with `i.year`: b = −11.656, base 2006.

Tests: `tests/labelled-codes.test.mjs` (4 tests, all failing on build .70).

# Model names as in Stata, and rows that do not overlap — build 2026-11-02.70

**Names.** Tests ▾ → Regression lists the 13 models by their usual names, grouped by outcome as in Stata's
*Statistics* menu, each with its command:

| Group | Models (command) |
| --- | --- |
| Linear models | Linear regression (OLS) `regress` · Robust regression `rreg` · Quantile regression `qreg` · Linear regression with splines `mkspline + regress` · Generalized additive model (GAM) `R: mgcv::gam` |
| Binary outcomes | Logistic regression (logit) `logit` · Probit regression `probit` |
| Ordinal outcomes | Ordered logistic regression `ologit` |
| Categorical outcomes | Multinomial logistic regression `mlogit` |
| Count outcomes | Poisson regression `poisson` · Negative binomial regression `nbreg` · Zero-inflated Poisson / negative binomial `zip / zinb` · Hurdle model `logit + tnbreg` |

Clicking a model opens step 1 with that model chosen. The steps are now *Model & outcome · Options · Predictors ·
Weights · SEs · Results · Checks · Predictions · Export*. Step 1 has a search box for the outcome (name or label)
and the same model list; the group that fits the outcome is marked **FITS**. A model that does not suit the outcome
gets a note with a button for the one that does. A model picked first is kept when the outcome is chosen
(`rgModelPicked`). Step 2 holds the model's options.

**Search boxes.** The outcome, predictors, weight, cluster, strata, PSU and margins boxes all search names and labels.
Accents are ignored. An exact name is listed first, so Enter picks the top row. A variable with data in fewer than 90%
of the rows shows how many ("edad · Edad · 203 rows").

**Rows that do not overlap** (`rgCoverage` in `src/regression-guide.js`). LAPOP's `edad` is only in 2025, while `ed`
and `q1` are only in 2004–2019. A model with both used to stop with "the outcome has a single value — nothing to
model". The engine now says there are no complete rows. The page explains why, on the Predictors step and in place of
the error. It finds the years from a `year` / `anio` / `wave` … variable:

> No row has data on all of m1, q1, edad, ed and wt. edad is only in year 2025 (203 rows); ed is in year 2004–2019
> (2,438 rows); q1 is in year 2004–2019 (2,491 rows). Remove one of them, or use a variable asked in the same years.

When fewer than half the rows are used it says so ("Only 203 of the 3,304 rows with m1 …"). It says nothing when no
variable drops rows. Real errors (perfect prediction, collinearity) are shown as before.

Checked on LAPOP in the browser: ordered logit of m1 on q1, q2 and ed weighted by wt, N = 2,403. In the node harness
the same model gives N = 2,403 with classical, robust, clustered (upm) and survey (strata · upm) standard errors.

# Regression — build 2026-11-02.64

This build fixes the problems found by an audit of Tests ▾ → Regression (linear, logistic, ordinal logistic and
Poisson). It also fixes the problems found in the build .63 review of the t-tests, the correlation matrix and multiple
imputation.

## What was wrong, and what changed

### Numbers

- **Collinear predictors.** The same variable in other units (pesos and thousands, monthly and yearly, an affine
  timestamp) is now an error that names the variable:

  > predictors are collinear: "inc_k" is a combination of the other predictors …

  Before, it was caught or missed depending on the units. When missed, the page showed impossible or believable but
  wrong results: R² = −21.9 or 1.000, a negative F, or "significant" coefficients. A predictor that does not vary, or a
  category with no rows in the sample, is also named.
- **Linear regression** is now solved by Householder QR, the method R's `lm` uses (`lsqQR` in `src/app/engine.mjs`).
  - Before, it built X′X from raw sums and inverted it with an absolute tolerance.
  - Rows are folded into a small triangle block by block, so memory stays small for very large files.
  - Collinearity uses R's unit-free rule: a column with less than 10⁻⁷ of its length left, after the columns before
    it, is dropped.
  - The residual sum of squares comes from the residuals themselves, and the total sum of squares from centered
    values, so R² stays between 0 and 1.
  - NIST StRD accuracy:
    - Longley: coefficients to 14–15 digits, standard errors to 12.7 (before: 4 digits; 84.893 shown for 84.915).
    - Wampler 1 and 2: 10–14 digits.
- **Logistic and Poisson** (IRLS) solve each step with the same QR, and convergence no longer depends on units. With
  income in pesos and a variable of about 10⁻⁶, they match R's `glm` to 8 digits, classical and robust.
- **Ordinal logit** now:
  - fits on centered, standardized predictors and transforms the estimates and their covariance back exactly;
  - uses exact (analytic) second derivatives instead of numerical ones;
  - flags separation by the size of a coefficient's effect over the predictor's range, not by the raw coefficient
    (which depends on units).

  Before:
  - income ≈ 300,000 or 1,000,000 did not converge, and every coefficient was 0;
  - timestamps gave the wrong sign;
  - income ≈ 100,000 had standard errors 5–10% off;
  - a rate ≈ 0.001 raised a false "did not converge / perfect separation" warning.

  All of these now match R's `MASS::polr`.
- **Model F** (robust, clustered or survey) is computed on the correlation scale, so tiny coefficients no longer make
  it "—".
- **Margins** (predicted values) use the model's own variance: robust, clustered or survey. Before, they always used
  the classical one, so the bands were too narrow.

### Code and Stata behaviour

- **Yes/no outcomes.**
  - The value modeled as 1 is now 1 for 0/1 data, otherwise the higher code (2 for 1/2) or the second value in
    sorted order ("sí" for "no"/"sí"). That is what R's `factor()` and a Stata recode give. Before, it was whichever
    value was rarer.
  - The exported code recodes first:
    - Stata: `generate byte esi_1 = (esi == "sí") if !missing(esi)`, then `logit esi_1 …`.
    - R: `glm(I(esi == "sí") ~ …, family = binomial)`.
  - Before, both failed: R said "y values must be 0 <= y <= 1", and Stata's logit needs 0/1.
- **Weights** follow Stata.
  - In the console:
    - `[pw=]` (or `[pweight=]`) means robust standard errors, as in Stata, so the page matches Stata (before, it was
      12% smaller).
    - `[aw=]` / `[aweight=]` gives ordinary standard errors in `regress`.
    - `[iw=]` does the same in `logit`, `poisson` and `ologit`.
    - Weight types Stata would refuse are refused, with the reason: `[aw=]` with logit, `[fw=]`, and `[iw=]` with
      regress.
  - On the page, the logged command names the weight type that matches what was computed: `[aw=]` / `[iw=]` with
    ordinary SEs, and `[pw=]` with robust, clustered or survey SEs. A note under the variance choice says so.
- **Robust R code** for logit, Poisson and ordinal logit uses `vcovCL(m, type = "HC0")`, which is Stata's n/(n−1).
  Linear regression keeps `vcovHC(m, type = "HC1")`.

### Display and wording

- Small coefficients keep three significant digits: 0.0000396 (0.00000291) instead of 0.000 (0.000). Odds and rate
  ratios near 1 keep their digits: 1.0000108.
- The interpretation describes a tiny +1 step per a meaningful one: *inc (OR 1.26 per +10,000 — each +10,000
  multiplies the odds by 1.26×)*.
- **Categories** are compared with the reference category: *grupo = C (OR 9.55 — the odds are 9.55× those of
  grupo = A)*. Before, it said "each +1 multiplies…".
- **Interactions.**
  - A main effect is described as holding where the other variable is at its reference (*x2 … when sexo = Hombre*).
  - The interaction term is how much that effect changes (*how much the effect of x2 changes when sexo = Mujer*).
  - Standardized β is not used to rank terms there.
- **Stars**: one convention on every page, set in Settings → Stars.
  - The default is `* p < .05, ** p < .01, *** p < .001`, so a star always means significant at the usual .05.
  - The other choice is `* p < .10, ** p < .05, *** p < .01`.
  - Before, regression used .10/.05/.01 and the correlation matrix used .05/.01/.001.

### From the build .63 review

- **t-tests.**
  - After ⇄ swap, or with groups picked from higher code to lower, a one-sided test now exports the R alternative in
    R's own order: "first > second" on the page is `alternative = "less"` in R.
  - The console refuses unknown ttest options, as Stata does (`ttest y, by(g) foo(3)`).
- **Correlation matrix.**
  - With a weight, the R code computes the weighted correlation (`cov.wt`, on the values or on the ranks).
  - Stata's `spearman`, which takes no weights, is replaced by the equivalent ranks plus `pwcorr … [aw=]`.
  - The default variables keep continuous measures whose values never repeat (height, income); only whole-number
    identifiers are left out.
  - In capitals, "SPEARMAN ρ" read as "SPEARMAN P"; it is now "SPEARMAN RHO".
- **Plots panel.** When a plot's picture stays the same but the command changes (the selected pair stays while the
  matrix's variables change), the plot card now shows the current command.
- **Multiple imputation, Stata code.**
  - A two-category variable that is not 0/1 (text, or 1/2) becomes 0/1 before `(logit)` and `logit`.
  - `encode` now has its comma: `encode x, generate(x_c)`. Without it, Stata would refuse the command. This also
    applies to the other Tests ▾ analyses.
- **Means near 10⁹** are refined with a second pass, so a t-test or summary of values like 1,000,000,000.37 is exact
  to the last digit.

## Tests

`tests/regression-numerics.test.mjs` runs with every `node --test` and needs neither R nor Python. It checks:

- the NIST StRD values (Longley, Wampler 1 and 2);
- agreement with R on `tests/data/regression-numerics.csv`. The references are in
  `tests/data/regression-numerics-reference.json`, regenerated with:

  ```sh
  python3 calculator/tests/regression-numerics-data.py
  Rscript calculator/tests/regression-numerics-reference.R
  ```

  Robust and clustered variances in the R script are written out with Stata's formulas, so no extra package is
  needed. It covers:
  - OLS, linear in pesos and in thousands, collinear pairs, and a nearly collinear pair;
  - `[pw=]`, `[aw=]` and clustered SEs;
  - logit and Poisson, classical and robust;
  - ordinal logit in pesos, ×3, ×10, timestamps and a rate;
  - margins with robust and classical variance;
  - weighted Pearson and Spearman;
  - the one-sided Welch test;
- the page's wording, display, stars, exported Stata and R code, and console weight rules.

The exported R code was also run in R 4.3.3. The yes/no recodes give the 0/1 coefficients, and the weighted
correlation code gives the page's r and ρ.

# Regression as eight steps, and margins with chosen values — build 2026-11-02.65

Tests ▾ → Regression is now **one entry**. Five chips under it (*A number · Yes / No · Ordered levels · Categories ·
A count*) open the page with that kind of outcome already chosen. All 13 models live on one page, which works in steps
like Networks and Text analysis. The nine models that used to have their own menu entries and Setup / Results form
(robust, quantile, spline, GAM, probit, multinomial, negative binomial, zero-inflated, hurdle) are picked in step 2.
They run in the Tests engine and show their tables in the same steps.

| Step | What it does |
|---|---|
| 1 Outcome | Pick the variable. The page detects its kind (two values → yes / no; whole numbers from 0 → a count; few labelled codes → ordered levels; text → categories; otherwise a number) and says why. Click another card to override it. For yes / no, it shows the shares and which value is predicted, with a button to predict the other one (`binOne`, used by the fit and by the exported code). |
| 2 Model | The recommended model for that kind of outcome, its alternatives, and each model's options (percentile, flexibility, family, count part). Three quick questions: rows that repeat (→ clustered standard errors, or a multilevel model); prediction rather than explanation (→ lasso, ridge, tree); and one checked from the data (rare events, many zeros or overdispersion, skew). The full list of 13 models is grouped by kind of outcome. |
| 3 Predictors | The page's own picker, numeric / categorical switch and interactions. Below it, the predictions to show: the X axis and the lines. |
| 4 Weights · SEs | Weight, classical / robust / clustered / survey standard errors, strata and PSU. Detects survey data from the column names (`factor`, `upm`, `est_dis` …) and offers the design. |
| 5 Results | The verdict, the plain sentence, notes, keep-in-mind and APA line first. For logit and Poisson, **average marginal effects** (Stata `margins, dydx(*)`): percentage points or expected counts, with a chart and table. Then the model fit, coefficient table and coefficient plot. |
| 6 Checks | Enough cases (events per term for logit), redundancy (VIF), survey data, rows that repeat, a changing spread or skewed residuals (linear), overdispersion and extra zeros (Poisson), and curvature (a squared term tested for each numeric predictor). Each has a one-click fix: robust standard errors, clustering, the survey design, negative binomial, zero-inflated, spline or GAM, or quantile regression. The VIF table and residual plots follow. |
| 7 Predictions | Stata's `margins` and `marginsplot`, at the values you choose (below). |
| 8 Export | The publication table (add models to compare them side by side), the APA line, and the Stata and R commands. |

The console still works as before. `regress …`, `logit …` and the rest open step 5 with the results.

## Margins and marginsplot

- **What to predict:**
  - the expected value (linear);
  - the expected count (Poisson);
  - the chance of the modeled value (logit);
  - the chance of one chosen category (ordinal).
- **X axis, numeric variable:**
  - *from … to … every …* (Stata's `at(edad=(20(5)80))`, R's `seq(20, 80, by = 5)`);
  - quick choices: every 1, 2, 5 or 10; min to max; the 10/25/50/75/90th percentiles;
  - or values you type (`at(edad=(20 35 50))`).
- **X axis, categorical variable:** the categories you tick.
- **Lines:** one for each category you tick, or for each value of a numeric variable (the 10th, 50th and 90th percentiles by default, or values you type).
- **Other predictors:** *as observed* (Stata's default, the average over the rows) or *at their means* (`atmeans`).
- **Variance:** the model's own: classical, robust, clustered or survey.
- **Standard errors:** delta method, with t and the model's degrees of freedom after linear regression (as Stata's `margins` after `regress`), and z otherwise.
- **Averaging:** over every row, unless the number of rows times the number of points exceeds 30 million; then it uses a sample and says so.
- **The plot (marginsplot options):**
  - confidence as a shaded band, error bars or none;
  - lines and points, lines, or points;
  - Y axis from / to / ticks every;
  - X axis labels every;
  - title and axis titles;
  - legend top right, bottom, right or none;
  - colours: Sendero, grey or colour-blind safe;
  - size in pixels.
- **Exports:** PNG / SVG download, pin to report, add to console.
- **The margins table:** margin, standard error, t or z, p, CI. Copy it or download it as CSV.
- **Commands:**
  - Stata, rewritten as you change the boxes: `margins sexo_c, at(x2=(-2(1)2))` followed by `marginsplot, recastci(rarea) ciopts(fcolor(%25)) ylabel(0(.2)1) xlabel(-2(1)2) title("…") legend(position(1) ring(0))`.
  - R: `marginaleffects::avg_predictions(m, variables = list(x2 = seq(-2, 2, by = 1), sexo = c("Hombre", "Mujer")))` with the matching ggplot.

### Validation

`tests/regression-numerics.test.mjs` compares the page with the delta method written out in R (`tests/regression-numerics-reference.R`). The cases:

| Case | Agreement |
|---|---|
| Logit margins at 5 values × 2 lines | 10⁻⁸ |
| Average marginal effects (numeric derivatives and discrete changes) | 10⁻⁶ |
| `atmeans` | 10⁻⁸ |
| Lines at values of a numeric predictor | 10⁻⁸ |
| Poisson average marginal effect | 10⁻⁶ |
| Linear-regression margins, with t intervals on the residual degrees of freedom | 10⁻⁸ |
| Ordinal Pr(y = 4) | 10⁻⁶ (polr's numerical Hessian) |

The file also checks:

- the step page: outcome detection, model choice, which panels appear in which step, and the margins commands;
- the console opening step 5.

`tests/regression-e2e.cjs` walks through the steps in Chromium, offline:

- the menu chips;
- detecting a count;
- choosing negative binomial, clearing the weight it cannot use, and running it in the steps;
- step 7 with x2 = −2(0.5)2 by group (27 rows, t statistics, one line per group, error bars instead of bands).
