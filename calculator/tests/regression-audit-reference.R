# R references for tests/regression-audit.test.mjs (build .76). Base R + MASS.
# Data: tests/data/regression-audit.csv (the test generates the same rows with the same seed).
# Rscript calculator/tests/regression-audit-reference.R
suppressMessages(library(MASS)); options(digits = 10)
d <- read.csv(file.path(dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE))), "data", "regression-audit.csv"))
d$g <- factor(d$g); d$h <- factor(d$h)
se <- function(m) sqrt(diag(vcov(m)))
# 1. weights as given ([iw=]): log likelihood = sum of wt * log-likelihood of each row
m <- suppressWarnings(glm(bin ~ x1 + g, binomial, d, weights = wt)); mu <- fitted(m)
print(cbind(b = coef(m), se = se(m))); cat("logit ll", sum(d$wt * (d$bin * log(mu) + (1 - d$bin) * log(1 - mu))), "\n")
m0 <- suppressWarnings(glm(bin ~ 1, binomial, d, weights = wt)); mu0 <- fitted(m0); cat("logit null ll", sum(d$wt * (d$bin * log(mu0) + (1 - d$bin) * log(1 - mu0))), "\n")
m <- glm(ord ~ x1 + g, poisson, d, weights = wt); mu <- fitted(m)
print(cbind(b = coef(m), se = se(m))); cat("poisson ll", sum(d$wt * (d$ord * log(mu) - mu - lgamma(d$ord + 1))), "\n")
m <- polr(factor(ord) ~ x1 + g, d, weights = wt, Hess = TRUE, control = list(reltol = 1e-14))
print(cbind(b = coef(m), se = sqrt(diag(solve(m$Hessian)))[names(coef(m))])); cat("cuts", m$zeta, " ll", -m$deviance / 2, "\n")
# 2. left-out terms: R's NA coefficients are Stata's "0 (omitted)" / "0 (empty)"
m <- lm(y ~ x1 + x2 + k + g, d); print(cbind(b = coef(m))); print(se(m)); print(summary(m)$fstatistic)
m <- glm(bin ~ x1 + x2 + k + g, binomial, d); print(coef(m)); print(se(m))
m <- polr(factor(ord) ~ x1 + g, d, Hess = TRUE, control = list(reltol = 1e-14)); print(coef(m)); print(sqrt(diag(solve(m$Hessian)))); print(m$zeta)
m <- lm(y ~ x1 + g + h + g:h, d); print(coef(m)); print(se(m))
m <- lm(y ~ x1 + g, d); X <- model.matrix(m); e <- resid(m); n <- nrow(X); p <- ncol(X); B <- solve(crossprod(X))
print(sqrt(diag(B %*% crossprod(X * e) %*% B * n / (n - p))))   # HC1, as vce(robust)
# 3. one level in the rows used (R refuses factor(g) there; Stata and the calculator leave g out)
m <- lm(y ~ x1, d, subset = g == "a"); print(coef(m)); print(se(m)); print(nobs(m))
