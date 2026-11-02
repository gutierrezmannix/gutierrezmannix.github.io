# T-tests (Compare means) and the correlation matrix — build .62

Tests ▾ → **One-sample, independent and paired t-tests** and Tests ▾ → **Correlation matrix (Pearson and
Spearman)** are two redesigned pages. Code: `src/compare-means.js`, `src/correlation-matrix.js`,
`src/compare-means.css`, integrated by `tools/compare_means.py`.

## T-tests: Compare means

- **One sentence sets up the test**: *Compare the mean of [outcome] [between two groups of / with a second
  measurement / with a fixed value / using summary numbers] [group variable]*. With more than two groups, a
  second line asks *[first group] minus [second group]*. With two groups, the order follows the codes (as Stata
  and R) and **⇄ swap** reverses it.
- **Settings in one row**: Variances (Welch / Student), CI (90 / 95 / 99%, the same setting as Settings →
  confidence level) and Test (two-sided, first > second, first < second). One-sided tests halve the p in the
  stated direction and give a one-sided interval (one limit is ∞).
- **The answer comes first**: a significance pill, the test and the cases used, one plain sentence, and four tiles
  (difference with its CI, t and df, p, Cohen's d, or d_z for paired data). Then two charts: every case with
  each mean and its CI, and the difference against zero with the negligible band |d| < 0.2.
- **Checks**: group sizes (30 or more each), the ratio of the SDs, skew with the medians (and a link to
  Mann–Whitney or Wilcoxon signed-rank), and independence of the rows.
- **From summary numbers**: type the means, SDs and n, with no data needed (Stata `ttesti`, R `BSDA::tsum.test`).
- **Exports**: Copy APA; **Word table (.docx)**, an APA table with n, M, SD and the CI of each group, the
  difference and a note with t, df, p and d; **Copy table for Word**, the same table as HTML for pasting; Pin to
  report; Add to console. The Stata and R commands and output are under *Stata output*.
- A weight variable blocks the test (classical t-tests are unweighted). The IF subgroup and missing-value codes
  apply.

## Correlation matrix

- **Any number of numeric variables**: chips with ✕, *+ add a variable*, *all numeric* (up to 30) and *clear*.
  The page starts from the pair on the Correlation page, or from the first five numeric variables.
- **Method**: Pearson r or Spearman ρ. **Rows**: Pairwise (each pair on its complete rows, as Stata `pwcorr`)
  or Complete on all (as `correlate`). **Show** in each cell: stars, p, n, the CI.
- **The heat-table**: the lower triangle, coloured by sign and size (text contrast at least 4.5:1). A headline
  names the clearest relationships. Click a cell for the **selected pair**: the scatter with the fitted line, r
  with its CI, the other coefficient, n and the rows left out, the slope (row variable per unit of the column
  variable), a plain sentence and the APA line, with links to Regression and the two-variable page.
- **Exports**:
  - **Copy matrix (numbers)**: the full square matrix, tab-separated with the names, ready to paste into Excel
    or Sheets. r is given to 4 decimals.
  - **Download CSV (r, p, n)**: the `correlation-matrix.csv` file, with three square blocks: r, p and n. p
    keeps 4 significant digits, so very small values read as e.g. 1.2e-8.
  - **Word table (.docx)** and **Copy table for Word**: the APA table, with M, SD and the lower triangle with
    stars (and the CIs when shown), plus a note giving n or the n range.
- The console logs `pwcorr …, sig obs`, `correlate …` or `spearman …, stats(rho p obs)` with Stata's printout
  and the R command.

Confidence intervals use Fisher's z (Bonett–Wright standard error for Spearman) at the confidence level in
Settings.

## Validation

- `tests/compare-means.test.mjs` runs the page code on `tests/data/compare-means-reference.json`, which
  `python3 calculator/tests/compare-means-reference.py` computes with SciPy.
  - **Correlation**: 60 matrices with 2–6 variables, n from 6 to 150, missing values and ties. It covers Pearson
    and Spearman, pairwise and complete rows, and 90/95/99%. r, p, n and both CI limits agree within 10⁻⁷ for
    more than 300 pairs.
  - **T-tests**: 90 tests: groups (Welch and Student), paired and one sample; two-sided, greater and less;
    90/95/99%; from the data and from summaries. t, df, p and the limits agree within 10⁻⁷.
  - It also checks the page: group order and swap, the settings, the summary mode, the weight guard, the
    exports and the console commands.
- `tests/compare-means-e2e.cjs` clicks both pages in Chromium, offline (`NODE_PATH=$(npm root -g) node
  calculator/tests/compare-means-e2e.cjs`; `GM26_SHOTS=dir` saves screenshots). It covers every design,
  swap, Student, 99%, one-sided, four groups, paired, one value and summary numbers. On the matrix it covers
  5 variables, clicking a cell, Spearman, complete rows and the CIs. It downloads the .docx and CSV files,
  checks the clipboard copies and the console lines, and checks that a phone-width screen has no sideways
  scroll and that the console has no errors.

## Build .64

- A one-sided test after ⇄ swap now exports R's alternative in R's own order.
- Weighted correlation: the R code computes the weighted correlation (`cov.wt`, on values or on ranks). For Spearman,
  the Stata code ranks with `egen` and runs `pwcorr … [aw=]`, because `spearman` takes no weights.
- Default variables: whole-number identifiers are left out, and continuous measures whose values never repeat are
  kept.
- "SPEARMAN RHO" in the tiles, because ρ in capitals reads as P.
- Stars follow Settings → Stars (`* .05 ** .01 *** .001` by default).

See `REGRESSION.md`.
