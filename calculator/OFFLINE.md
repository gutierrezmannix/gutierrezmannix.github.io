# Working offline — build 2026-10-25.32

GM26.1 now runs every function without an internet connection, including from a downloaded copy of
`index.html` opened from disk (`file://`). Nothing is fetched at run time.

## What changed

**Tests ▾ analyses no longer download R.** The 65 advanced analyses (proportions and categorical tests,
nonparametric tests, ANOVA/ANCOVA and multiple comparisons, regression models, multilevel and panel models,
survival analysis, PCA/factor analysis, resampling and power, survey inference and imputation, predictive models,
data management) used to run in R inside the browser (webR), which downloaded R and its packages from
`webr.r-wasm.org` on first use. They now run in a built-in statistical engine (`src/engine/`, JavaScript),
embedded in the page and started in a Web Worker (the page stays responsive and **Cancel** stops a run).

**The engine reproduces R.** The R code that used to run (`src/analysis-methods.R`) is the specification. For
every method, test packets are run through the original R engine with real R 4.3.3 and its packages (car,
multcomp, MASS, pscl, quantreg, mgcv, nnet, lme4, plm, survival, psych, boot, coin, survey, mice, glmnet, rpart,
pwr) and through the built-in engine, and every table cell, note, error message and plot title is compared
(`node --test calculator/tests/engine.test.mjs`: 467 cases across all 65 methods, all matching; relative tolerance 1e-6 unless documented — e.g. mixed models with random slopes, where R's optimizer stops slightly short of the optimum, agree to 1e-4). Random procedures
(bootstrap, permutation, train/holdout splits, cross-validation folds, k-means starts, multiple imputation) use an
exact port of R's random-number generator, so with the same seed they give the same draws as R.
Method-by-method notes and the few documented deviations are in `tools/engine/NOTES-*.md`.

**"Download reproducible R analysis"** still exports an R script that re-runs the same analysis in R.

## Audit of the rest of the program (all offline)

- Every tab: descriptive statistics, t-tests, contingency tables, means, correlation, regression (linear, logit,
  ordered logit, Poisson), text analysis, network models (ERGM), SEM, scale reliability, time series, browse,
  overview, data tools — checked with all network requests blocked, from the site and from `file://`.
- Every chart type (37) including maps (bundled world map), model-estimate charts and GeoJSON maps.
- Console commands (describe, codebook, summarize, tabulate, crosstab, correlate, pwcorr, ttest, oneway,
  regress, logit, poisson, generate, replace, recode, rename, label, count, display, sort, histogram, scatter,
  mean, keep, drop, destring, help).
- Files: CSV, TSV, Stata .dta, saved sessions (save and reopen); exports: .do and .R scripts, Word and HTML
  reports, PNG/SVG plots, ZIP of plots, CSV.
- Fonts, map boundaries, React and every script are embedded; the only optional request is the "new version
  available" check, which is skipped while offline.

## Fixes found in the audit

- Stata 7 files (.dta format 110–112, still written by R's `foreign::write.dta`) now open; previously only
  Stata 8+ was accepted.
- Fisher's exact test on large r × c tables: where R stops with an FEXACT workspace error, the p-value is now
  estimated from 100,000 random tables with the same margins (identical to R's
  `fisher.test(simulate.p.value = TRUE, B = 1e5)` with the same seed).
- 2 × 2 tables typed on one line as `a, b, c, d` (as the label asks) are read as a 2 × 2 table for Fisher and
  McNemar (R stopped with "A 2×2 paired count table is required").
- The cached weight array now follows the chosen weight variable (a weight set by `svyset` or a restored session
  could otherwise reuse the previous weight in some charts).
- Time series: a **Run** button (build .31).

## Developer notes

- Engine sources: `src/engine/**/*.mjs`; `tools/engine/bundle.mjs` packs them into `src/engine/engine.bundle.js`
  (run automatically by `tools/build_time_series.py` when sources change; requires Node).
- Validation: `tools/engine/README.md` (workflow), `tools/engine/cases/*.mjs` (case generators),
  `tests/engine/cases/` (packets and R reference outputs), `tools/engine/ref.R` (R runner),
  `tools/engine/compare.mjs` (comparison), `tools/engine/dist_check.mjs` (distribution functions vs R).

## Build .33 — spot check (Kruskal–Wallis)

A randomly chosen capability was re-tested end to end (offline, from `file://`): statistics, df and p-values
match R's `kruskal.test` to ~13 digits on two datasets, with subgroups, missing data and every error message.
Fixed from that check:
- **Analyses now appear in the console, the Output view and the session .do / .R file** (all 65 Tests ▾
  methods): the equivalent Stata and R commands by variable name (e.g. `kwallis life_expectancy, by(region)`,
  `kruskal.test(life_expectancy ~ region, data = df)`; a comment where there is no single equivalent command)
  and the result tables. Clicking the entry reopens the analysis.
- Kruskal–Wallis adds a **Group summaries** table (N, median, mean rank, rank sum — as Stata's `kwallis`
  reports), also added to the R specification and validated against R.
- Kruskal–Wallis and Friedman Diagnostics name the variables (`data: life_expectancy by region`).

## Build .34 — spot check (Bootstrap)

Re-tested end to end offline: estimates, bootstrap SE, bias and percentile intervals equal R's `boot` exactly
(same random draws) for mean / median / sd, other seeds, 90% level, 50,000 replicates, subgroups and the moving-
block bootstrap; BCa (Diagnostics) equals `boot.ci`; validation messages, Cancel and re-run work. Fixed:
- **The IF subgroup now applies to Tests ▾ analyses** (the bar says "applies to every tab", but analysis pages
  silently used every row); the bar is shown there, survey methods use it as the estimation domain, and the
  console commands carry the condition (`… if region == "North"`, `sub <- subset(df, …)`).
- **Session .do / .R files declare missing-value codes** the app applied (Settings codes and auto-detected codes
  such as 999: `mvdecode x, mv(999)` / `df$x[df$x %in% c(999)] <- NA`), so exported commands reproduce results.
- Bootstrap console commands: runnable R `boot`/`tsboot` code (verified to reproduce the app in R); Stata
  `bootstrap … : summarize y [if …]` + `estat bootstrap, percentile`; no misleading Stata command for the
  moving-block bootstrap (Stata has no built-in equivalent).
- The results note states the interval: "Lower and Upper: 95% percentile bootstrap interval; the bias-corrected
  (BCa) interval is under Diagnostics" (added to the R specification and validated).

## Build .35 — spot check (t-test tab)

One-sample, Welch two-sample (all groups and two chosen groups), paired, 90% level, subgroup and weights were
re-tested offline: t, df, p, CIs and means equal R's `t.test`; weights are refused with a clear message;
console commands and session scripts are correct (`ttest y if …, by(g) unequal`, `t.test(…, data = sub)`).
Fixed:
- The R-style console printout now matches R's `print.htest` character for character (df to 5 significant
  digits, `1.319e-08` exponents, common decimals for the confidence interval and estimates, column alignment);
  checked by diffing against real R output for every mode.
- Console summary lines show whole degrees of freedom as `t(419)` instead of `t(419.00)`.
- The paired t-test shows Cohen's d (mean difference / SD of differences), like the other designs.

## Build .36 — spot check (Descriptive statistics)

N, mean, SD, min/max, missing counts, CI, auto-detected missing codes and weighted percentages were re-checked
against R. Quartiles use Stata's definition (`summarize, detail`; R type 2). Fixed:
- Console `summarize` output now has Stata's layout and `%9.0g` numbers (`74.06833  2.766519  64.8  81.5`;
  with weights, Stata's Obs/Weight columns); `tabulate` lists categories in value order as Stata does (labels of
  coded variables in code order).
- The R console shows what R prints: `summary(df$x, quantile.type = 2)` (the page's quartiles; R's default type 7
  would differ), `table()` (codes for value-labelled numerics), and for weighted data `weighted.mean(...)` and
  `prop.table(xtabs(w ~ x, data = df)) * 100` instead of unweighted commands. All checked against real R.
- Weighted SD uses Stata's analytic-weight formula (weights normalised to N), matching `summarize [aw=]`.

## Build .37 — spot check (Panel timelines)

Panel and multiple-series timelines were re-tested offline with a balanced panel, a panel with missing years and a
missing value, and survey microdata collapsed by state and year (weighted and unweighted). The plotted means equal
R's `aggregate()` / `weighted.mean()` for every unit and year. Fixed:
- **Lines no longer bridge missing periods.** A unit observed in 2003 and again in 2006 was drawn as one continuous
  line, as if 2004–05 had been observed. Lines now break where a series has no observation for a period that other
  series have, or for a step of a regular (e.g. annual) time grid; the note says so.
- **Year axes read as years:** `2000 2002 2004 …` instead of `2,000  2,001.8  2,003.6 …` (thousands separators and
  fractional years).
- **Round tick values on every chart** (as R's `pretty()`): `10 15 20 25 …` instead of five equal splits such as
  `10 15.8 21.6 …`.
- **Legend colour keys were invisible** on every chart with a group legend (the plot-area clip hid them); they now
  show.
- Timelines leave a small margin (4%, as R's default axes) so the first and last markers are not cut at the edge.
