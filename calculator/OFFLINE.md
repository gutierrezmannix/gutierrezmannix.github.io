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

## Build .38 — spot check (Slope chart)

Re-tested offline with state turnout data in two columns (2016, 2020): by region, by 40 states, weighted by
population, and with a missing value in each column. Category means and weighted means equal R's `aggregate()` /
`weighted.mean()` on complete pairs; rows missing either value are excluded and counted. Fixed:
- **Lines were unlabelled.** Each region's line had its own colour, but nothing said which colour was which region
  (the legend only explained the endpoint dots). Each line is now labelled at its second value. Labels are spaced so
  they do not overlap; with many categories, only labels that fit are drawn and the note says how many (every
  category stays in the data table and in each point's tooltip).
- **The x axis showed a meaningless 0–1 scale** (`0 0.2 0.4 …`). It now names the two columns
  (`turnout2016`, `turnout2020`). Same fix for the paired before-and-after plot.
- **Axis titles were wrong**: the slope chart's x title was the category variable and its y title only the
  second column. It now reads "Mean value". The dumbbell chart had its titles swapped; the paired plot's y title is "Value".
- Legends on the dumbbell and paired charts name the two columns instead of "First value / Second value".
- First and last points are no longer cut in half at the plot edge (slope and dumbbell charts).
- Chart data tables show 7 significant digits, as R prints (`63.45`, not `63.449999999999996`); **Copy chart data**
  keeps full precision.

## Build .39 — spot check (Time series / interrupted time series)

The Time series tab was re-tested offline: a single series (Newey–West), AR(1), level shift, trend change and
one-period spike, change and % change, a date window, pooled units, the average of all units, 10 units with fixed
effects, monthly dates, survey microdata collapsed by state and year with weights, and series with gaps. Every
coefficient, standard error, t, p, R², Durbin–Watson and Ljung–Box statistic equals R (`lm` + `sandwich::NeweyWest`
/ `vcovCL`, `lmtest::coeftest`, `Box.test`) to 10+ digits, and the exported Stata and R scripts run the same models.
Gaps and averaging over units with different periods are refused with clear messages. Fixed:
- **Few clusters are now flagged.** With 3 units the app reported "a significant level shift (p = .034)" from
  cluster-robust standard errors, which are unreliable with few clusters (they tend to be too small). With fewer than
  about 30 units the explanation now says so, gives the degrees of freedom used, and suggests checking each unit
  separately or a wild cluster bootstrap.
- **Console output as Stata and R print it.** The console showed the app's own table under a `newey` / `coeftest`
  command. It now shows Stata's `newey` (or `regress …, vce(cluster)`) output, with the Newey–West F test, and R's
  `coeftest()` printout. Both use the script's variable names (`gmts_trend`, `gmts_post`, …). The R text was
  checked character for character against real R.
- **Pooled units are numbered as Stata's `egen group()` and R's `factor()` number them**, so the constant and unit
  indicators match the exported commands whatever the row order of the data.
- **Wording:** "per year" / "per month" instead of "per yearly"; "per period" instead of "per generic".
- **Diagnostics wording:** Durbin–Watson below 1.5 now reads "positive autocorrelation (ρ ≈ 0.32)" instead of "strong
  autocorrelation"; Ljung–Box says "no significant autocorrelation up to lag 6" instead of "residuals look like
  noise" (the two messages had seemed to contradict each other).
- **Chart axes:** round ticks (`0 10 20 30`, `1990 1995 2000 …`). Year labels had been rounded but drawn at
  fractional positions ("1996" at 1995.8). Monthly and quarterly axes tick at the start of each year.
- Stata `%9.0g` numbers in the console now follow Stata's width rule (`.0223787`, not `.02237866`); this also
  corrects `summarize` output.

## Build .40 — time step and missing periods (Time series)

A biennial survey (2014, 2016, …, 2022) collapsed by state was refused with "128 missing period(s) inside the
analysis range": every odd year counted as missing (32 states × 4 years).
- **Time step (Stata's `delta`).** The tab detects data observed every k periods (the greatest common divisor of the
  observed spacings) and treats them as a regular series, like `tsset year, delta(2)`. Trends stay per year. A
  TIME STEP row shows the detected step and lets you choose another. Scripts write `xtset …, delta(2)`.
  Biennial estimates equal R's `lm` + `NeweyWest` on the same years.
- **Missing periods panel.** For genuine gaps, the panel lists each missing unit-period inside the observed range.
  **◀ Previous / Next ▶** move from one missing period to the next, and **Next unfilled ▶▶** skips ones already
  filled. Each shows the observed values before and after. You type a value, or use the straight line between the
  neighbours as a suggestion. **Use value & go to next** saves it and moves on. You can also use one value for all
  unfilled periods, clear one value, or clear all.
- Filled values are assumptions, not data. The summary counts them, and the exported Stata / R scripts add those
  rows (`set obs` / `replace … in l`; `d[nrow(d)+1, …] <-`), so the scripts reproduce the app's estimates (checked
  in R). Fills are kept per outcome and preparation, so they never carry over to another variable.

## Build .41 — three spot checks (exact McNemar, lasso, Cox)

Fresh data were run through real R and the built-in engine: a debate panel (vote intention before/after),
turnout with numeric and party predictors with missing values (Gaussian and logit lasso, other seed / folds /
split), and cabinet survival in whole months (heavy ties, factor predictors, 90% level). Every table, note and
error message matches R (11 new cases; 495 in total). Fixed:
- **Exact McNemar results say what they are.** The page showed R's raw `binom.test` labels: "DF 32" (really the
  number of discordant pairs) and "probability of success". It now shows discordant pairs, changes 0→1 and 1→0,
  the exact p-value, and the effect size: the share of changes going 0→1 and the conditional odds ratio with exact
  intervals (as Stata `mcc` reports). This was changed in the R specification as well and re-validated.
- **Console commands.** Exact McNemar: `mcc after before` / `mcci a b c d` and `binom.test(...)` (it had none).
  McNemar: `mcc`, with a note that Stata reports chi² without the continuity correction R applies. Cox: `stcox …,
  efron` (Stata's default Breslow ties differ from R's Efron) with `i.` factor variables, encoding text variables
  first. Lasso / ridge / elastic net: `lasso logit|linear … , selection(cv, folds(k) serule)` on a training split.
  The runnable R `cv.glmnet` script reproduces the app exactly, which was checked in R.
- **Variable names instead of internal aliases.** Factor terms of coded variables showed as `v31` (majority = 1)
  on result pages, and as `v5left` / `v6minority` in the console. They now read `majority1`, `partyleft`.
- **Session .R files read blank text cells as missing** (`read.csv(…, na.strings = c("", "NA"))`), as the app
  does. R had treated them as a category, so models in exported scripts could differ.
- **Console `keep if` / `drop if` accumulate as in Stata.** A second condition used to replace the first silently.
  Now all apply, the filter label lists them, and Edit data → Clear removes them. Exported `keep if` lines quote only
  text values. They add `& !missing(x)` where Stata would otherwise keep missing values, because Stata treats
  missing as larger than any number.

## Build .42 — three spot checks (dynamic panel GMM, hurdle model, paired chart)

Fresh data were run through real R and the built-in engine: a democracy panel (45 countries × 14 years, a lagged
dependent variable, GDP growth and a conflict indicator, a missing year, 2 and 4 instrument lags), and
protest-event counts with many zeros (negative-binomial and Poisson hurdles, factor predictors, a population
exposure, 90% level). All tables, notes and errors match R. Fixed:
- **Dynamic panel GMM failed with any categorical predictor.** A 0/1 indicator such as conflict, which the app
  reads as categorical, made the model stop with "Singular matrix" (R's specification failed too). Factor
  predictors are now treatment-coded with the first level as base, as in every other model. This was changed in the
  R specification and re-validated (12 cases).
- **Arellano–Bond tests.** Diagnostics now report the AR(1) and AR(2) tests of the differenced residuals and the
  Wald test, exactly as plm's `summary(pgmm, robust = TRUE)` (Windmeijer covariance), checked against R in every
  case. The Sargan p-value no longer shows "NA". When the model is exactly identified (the default 2 lags), a note
  explains that Sargan cannot test instrument validity and suggests more lags.
- **Commands.** Dynamic panel: `xtabond2 y L.y x, gmm(L.y, laglimits(1 k) collapse) iv(x) noleveleq twostep robust`
  (user-written; text panel identifiers are encoded) and a runnable `plm::pgmm` script. Hurdle: the R command now
  includes the exposure offset and `factor()` for coded categories. Both R commands reproduce the app in R.
- **Paired before-and-after plot.** Lines are coloured by direction (increase / decrease / no change) instead of
  cycling colours by row. A bold line joins the two means, and the note gives the means, the mean change and the
  counts. With more than 2,000 pairs the note states how many lines are actually drawn (it said "2,000" even when
  only about half were).
