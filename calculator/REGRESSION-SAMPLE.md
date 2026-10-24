# Regression sample reporting

Build 2026-10-24.22 labels the regression's sample size as **N USED** and adds a sample summary below Model fit. It distinguishes rows in the dataset, rows outside the active filter/subgroup, and rows within scope that the estimator excluded. The subgroup banner shows both the fitted model N and the candidate rows while a regression is displayed. The F and DF cells have explanatory tooltips.

No OLS coefficients, F formula, or complete-case selection calculations were changed. The previous N field already used the estimator's complete-case count. A one-predictor classical OLS F can exceed 99,999 and should equal the slope t statistic squared. Stata's printed `> 99999.00` is an inequality; its actual statistic is available as `e(F)`.

The supplied screenshots use different sample sizes: 1,025,586 in the calculator and 512,799 in Stata. The Stata sums of squares imply F approximately 1,189,429. Their exact sample difference cannot be resolved from screenshots alone and requires the source dataset/settings. We do not halve the sample or cap F to force agreement.

Validation: `node calculator/tests/regression-sample.test.mjs`. Checked-in references use independent NumPy least squares, direct residual sums of squares and SciPy F tails. They cover multiple predictors, missingness, classical and HC1 standard errors. A large synthetic case with 1,025,720 input rows uses exactly 512,799 complete observations and verifies F = t². UI checks cover dataset counts, active subgroups, unrelated missing columns and model exclusions.

Logit additionally rejects detected complete/quasi-complete separation and nonconverged fits. Previously the program warned about nonconvergence but still showed the last iteration's coefficients and inference. The new guard checks pure categorical levels, single-predictor separating thresholds, and whether a fitted predictor combination is a separating direction. It also suppresses inference whenever IRLS does not converge. It does not claim to implement an exhaustive linear-programming test for all possible multivariable quasi-separation patterns.

The previous `abs(coefficient) > 15` separation heuristic is removed because coefficient magnitude depends on predictor units. A valid rescaled model with a coefficient above 15 must remain valid. Ordinary logistic coefficients, SEs and likelihoods are checked against independent SciPy optimization, including rescaling.

For the second supplied comparison, Stata explicitly omitted a perfect predictor and excluded 43,159 observations, leaving an intercept-only model with N = 469,640. The calculator now explains why the originally requested model has no finite maximum-likelihood estimate. It does not silently change that model or remove perfectly predicted cases to force a finite answer. Such an alternative fit requires an explicit change to the sample/specification.

Regenerate the reference values when needed with `python3 calculator/tests/regression-reference.py` (NumPy/SciPy required).

Primary references:
- https://www.stata.com/manuals/rregress.pdf
- https://www.stata.com/links/stata-basics/simple-linear-regression/
- https://www.stata.com/support/faqs/statistics/estimation-commands-and-omitted-variables/
- https://www.stata.com/manuals/rlogit.pdf
