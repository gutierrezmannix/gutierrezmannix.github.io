# Unified t-tests — 2026-10-23.16

Tests has one t-tests entry. A dedicated workspace contains independent groups (Welch), paired measurements, and one sample versus a reference value. These designs answer distinct questions; all three remain available. The old t-test card is removed from Univariate Descriptive Analysis. Outcome selection, subgroup/filter rules, confidence level, result copying, console logging, session state, and R/Stata command routing use the shared workspace.

Validation used R 4.3.3 `stats::t.test`: 90 synthetic reference cases covering all three designs, unequal sample sizes and variances, missing observations, two-observation samples, and 95%, 99%, and 99.99% confidence intervals. Estimates, t statistics, degrees of freedom, two-sided p-values, and confidence limits agree within 1e-8 relative/absolute tolerance. Component tests also cover group order, complete-pair exclusion, filters, malformed inputs, zero variance, weighting guards, export sample preparation, menu routing, and command syntax. The existing network and calendar/time-series tests pass.

```sh
Rscript calculator/tests/ttests-reference.R /tmp/gm26-ttests
GM26_TTEST_R_DIR=/tmp/gm26-ttests node calculator/tests/ttests.test.mjs
```

The workspace reports classical **unweighted, two-sided** inference. A selected weight variable blocks these tests rather than silently producing an inappropriate standard error. Missing paired measurements are removed together. R/Stata exports contain the prepared samples, preserve the displayed group order and confidence level, and do not depend on original column-name syntax. For paired data, rows must represent matched cases. Independent groups use Welch inference; pooled equal-variance tests and independent samples in separate columns are not accepted by this workspace's R command parser. Unsupported requests receive a clear error instead of being treated as a different test.

Definitions: [R stats::t.test documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/t.test.html).
