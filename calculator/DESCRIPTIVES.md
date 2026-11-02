# Descriptive statistics (Tests ▾ → Descriptive statistics) — build .66

The univariate tab: the descriptives tiles, histogram and box plot for numbers; the frequency table and bar chart
for categories; the cross-tab; and *Break down by groups*. Code: `src/app/component.js` (the tab, commands and
key result), `src/app/engine.mjs` (`descNum`, `wQuantile`, `freqOf`, `histChart`, `boxChart`, `fmtTick`),
`src/breakdown.js` (the group table), `src/analysis-suite.js` (the Stata and R printouts in the console).

## What the numbers follow

| Shown | Rule | Stata / R |
| --- | --- | --- |
| Mean, SD | weighted mean; SD = √(Σw(x−m)²/Σw · n/(n−1)) | `summarize [aw=]` |
| Median, quartiles, percentiles | the first value whose cumulative weight reaches p·W, averaged with the next when it lands exactly on p·W (unweighted: R type 2) | `summarize, detail` |
| Skewness, kurtosis | m₃/m₂^1.5 and m₄/m₂², m_r = Σw(x−m)^r/Σw (normal = 3) | `summarize, detail` |
| 95% CI, no weight | mean ± t(n−1)·SD/√n | `ci means x` |
| 95% CI, weighted | sampling weights: SE = √(n/(n−1)·Σ(w(x−m))²)/Σw, t with n−1 df | `mean x [pw=w]` |
| Group table | the same rules per cell; running (Welford) sums, exact for values near 1e9 | `table` / `tabstat` |
| Frequencies | categories in value order (codes, then labels A–Z); N = observations, % and CUM weighted | `tab x [aw=]` |
| Cross-tab χ² | weights rescaled to the number of observations | `tab y x [aw=], chi2` |

## Changes in build .66 (from the audit)

1. **Group table SD.** The SD used Σx² − n·mean², which loses every digit for values near 1e9 (SD 1.07 showed as
   0.00, 16.08 or 27.76). It now keeps running sums; R agrees to 10 digits.
2. **Frequency order.** Categories were sorted by count, so CUM added up a scale out of order. They now follow
   the codes as Stata's `tab` does (Muy malo → Muy bueno), with **By value / By frequency** buttons. The bar chart,
   the copied table and the report follow the same order.
3. **Box plot outliers.** Above 4,000 rows only every n/4000-th row was checked and at most 250 dots were drawn,
   so the extremes could vanish (n = 20,000: maximum 656 drawn at 114). All outliers are drawn; past 2,000 the
   200 most extreme on each side are kept and the rest thinned evenly. Dots at the ends are no longer cut in half.
4. **Display.** One format per variable: the Settings decimals, or more when the spread is small (the SD keeps 2
   significant digits, so 1e9 ± 1 shows 999,999,999.95 – 1,000,000,000.19), whole numbers when values and spread
   are large (116,645, 83,180, 6,785), scientific notation below 0.001 (9.92e−7), thousands separators on all
   values once one reaches 10,000. Long numbers take two tile widths on one line. Chart ticks are labelled by
   their step (999,999,998; 1.0e−6; years without separators) and fewer when the labels are long.
5. **Weighted counts.** The COUNT column showed weighted sums. With a weight it now shows N (observations) with
   weighted PCT and CUM, and says so.
6. **Weighted CI.** Now Stata's `mean x [pw=w]` (it was the analytic-weight interval; on the test data the SE
   goes from 0.611 to 0.667, about 9% wider);
   a note under the tiles says which rule each number follows.
7. **Group-table medians** use the weights, as the tiles and `tabstat [aw=]` do (they were unweighted).
8. **Skewness and kurtosis tiles.** The text now flags skew from the skewness (|g₁| > 1 strong, > 0.5 moderate);
   the old (mean − median)/SD > 0.25 rule missed incomes with skewness 7.56.
9. **Commands.** Stata: `summarize x, detail` plus `ci means x` (weighted: `summarize x [aw=w], detail` and
   `mean x [pw=w]`), with matching console printouts. R: `summary()`, SD / skewness / kurtosis and
   `t.test()$conf.int`; weighted, base-R code for the same numbers (weighted percentiles as Stata, the `[pw=]` SE).
   The cross-tab R code uses the weights and adds `chisq.test(…, correct = FALSE)`. The group table's `tabstat`
   asks for the statistic on screen; means, SDs and medians use `[aw=]`, totals and shares `[pw=]`.
10. **Levels of tiny values.** Level keys kept 4 decimals, so 300 values near 1e-6 counted as 1 level; values
    below 0.001 now keep 4 significant digits (292 levels).
11. **Histogram y title**: *Frequency*, or *Frequency (weighted by w)*.

## Tests

`tests/descriptives.test.mjs` (9 tests) on `tests/data/descriptives.csv` (`tests/descriptives-data.R`) against
`tests/data/descriptives-reference.json` (`tests/descriptives-reference.R`, Stata's rules in base R): every tile
with and without a weight, percentiles 1–99, group SDs near 1e9 and weighted medians, χ² weighted and not, the
display of 1e-6 / 1e9 / incomes, frequency order and weighted N, the commands and printouts, all box-plot
outliers, distinct ticks and the histogram title. The logged R code was also run in R 4.3.3 and prints the same
numbers as the console.
`tests/descriptives-e2e.cjs` checks the same cases in a real browser, offline: the 1e9 CI and tiles that fit, 9.92e−7,
incomes in one format with the skew remark, value order and the By frequency switch, distinct ticks.
