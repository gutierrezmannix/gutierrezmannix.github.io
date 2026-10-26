# Survey family (survey_desc, survey_test) — notes

Cases: `tools/engine/cases/survey.mjs` (25 cases); all match R 4.3.3 / survey 4.2.1 at the default tolerance
with no `compare` overrides.

Ported pieces: `svydesign(ids = ~psu or ~1, strata, weights, nest = TRUE)` (PSUs relabelled within strata,
nPSU per stratum from the full sample), `subset(des, .domain & .complete)` (rows dropped but nPSU kept), `svymean`
and `svytotal` with `svyrecvar`/`onestage` (PSU totals of influence values, zero rows for sampled PSUs absent from
the domain, centring over nPSU, scale nPSU/(nPSU-1); lonely PSU → "Stratum (x) has only one PSU at stage 1" with
lonely.psu = "fail"), `degf` on the domain, `confint(df = degf)`, `svychisq(statistic = 'F')` (Rao–Scott
second-order: X^2 of svytable(Ntotal = N)/tr(Delta), ndf = d0, ddf = d0*nu), and the svyglm t-test (sandwich
variance of the 0/1 contrast, df = degf - 1; the estimate is named "Difference..contrast" as R's
c(Difference = b) with b named ".contrast"). Factor variables in svymean keep every level of the full data
(zero-estimate rows for levels absent from the domain), as model.matrix on the subset does.

No intentional deviations. Warnings: chisq.test's "Chi-squared approximation may be incorrect" is reported when
an expected count is below 5 (R reports it through the engine's calling handler).
