# Stata-style result order

Build 2026-10-24.23 keeps the existing colors, typography, cards, controls and calculations. Reordering occurs in the document structure as well as the rendered reading order.

- OLS: Source / SS / df / MS table for classical fits; observations used, F and its df, probability, R-squared, adjusted R-squared and Root MSE; coefficient table with the constant last. Robust/design fits omit the classical source table.
- Logit, ordered logit and Poisson: observations, classical likelihood-ratio test where applicable, pseudo R-squared and log likelihood; estimates then notes and diagnostics. Robust/design summaries do not substitute an LR test for a Wald/design test.
- Coefficient columns: estimate, SE, t/z, p, confidence interval, then supplementary beta/odds-ratio fields. Original engine parameter order remains intact for prediction and covariance calculations.
- Descriptives: observations, mean, SD, minimum and maximum before additional statistics.
- T-tests: sample/group rows with Obs, Mean, Std. err., Std. dev. and CI; difference row for paired/group designs; test statistics; chart and interpretation. Paired descriptives use only complete pairs. Welch estimation remains Welch, not Stata's default equal-variance test.
- Correlation, ANOVA/group comparisons and crosstabs: statistical tables before their charts.
- Time series: sample/model information and coefficient estimates before exploratory diagnostics and charts.
- SEM: sample/method, estimates, goodness-of-fit diagnostics, path diagram and interpretation.
- Networks: network counts, model estimates and centrality tables before the network plot.
- Text: counts and frequency table before the word cloud. Methods without a direct Stata equivalent retain their own result labels.
- Quick interpretation cards follow primary results. Copy/export and publication-table ordering preserve the same coefficient sequence; full-precision t-test metadata remains available in copied output.

Validation:
`node calculator/tests/stata-output.test.mjs`
`PYTHONDONTWRITEBYTECODE=1 python3 calculator/tests/stata-template.test.py`

Primary references: Stata manuals for [regress](https://www.stata.com/manuals/rregress.pdf), [logit](https://www.stata.com/manuals/rlogit.pdf), [ttest](https://www.stata.com/manuals/rttest.pdf), [summarize](https://www.stata.com/manuals/rsummarize.pdf), [correlate](https://www.stata.com/manuals/rcorrelate.pdf) and [SEM](https://www.stata.com/manuals/sem.pdf).

## Compact console and Result | Stata | R tabs — build .87

**Console pane** (right-hand panel). Same features, less space:
- one command line (prompt `.` or `>`), with **Commands ▾** opening the list of commands (each with a short description);
  picking one shows the usual fill-in-the-blanks row (Run ▶ · + Do-file · Cancel);
- the Stata / R switch and three small icons at the top: copy the session log, download the .do / .R file, and clear the
  screen (like Stata's `cls`: the download and the report still keep every command);
- ↑ / ↓ in the command line bring back earlier commands;
- the "Command & results" header and the long instruction line are gone; the same command run again right after itself
  shows once with ×2; each table takes the font size (8–10.5 px) that fits its longest line in the pane, so tabulate,
  ttest and pwcorr no longer scroll sideways (very wide ones such as `summarize, detail` still scroll).

**Result | Stata | R tabs** replace the “Stata output” box under Compare means (t-tests) and the Correlation matrix. The
result card opens on **Result** as before; **Stata** and **R** show the command and the same numbers as each program prints
them, with Copy. The empty “|” lines Stata prints between variables in pwcorr / correlate are left out.

