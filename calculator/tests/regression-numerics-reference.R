# Reference values for tests/regression-numerics.test.mjs, from base R 4.3.3 and MASS (polr), on
# tests/data/regression-numerics.csv:
#   Rscript calculator/tests/regression-numerics-reference.R
# Robust and clustered variances are written out with Stata's formulas (HC1 for regress; n/(n-1) or G/(G-1) for logit
# and poisson), so no extra package is needed. polr is fitted on centred, rescaled predictors and transformed back.
suppressMessages(library(MASS))
here <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))))
d <- read.csv(file.path(here, "data", "regression-numerics.csv"), na.strings = c("", "NA"), encoding = "UTF-8")
d$grupo <- factor(d$grupo); d$sexo <- factor(d$sexo)
out <- list()
put <- function(k, v) out[[k]] <<- as.numeric(v)
sand <- function(X, u, B, f) B %*% crossprod(u) %*% B * f
# linear: estimates, SEs, R2, root MSE; the same in thousands; a near-collinear pair (rounded) that R keeps
m <- lm(y ~ inc + x2, d); s <- summary(m)
put("ols_b", coef(m)); put("ols_se", s$coef[, 2]); put("ols_r2", s$r.squared); put("ols_rmse", s$sigma)
m <- lm(y ~ inc + inc_r + x2, d); s <- summary(m); put("near_b", coef(m)); put("near_se", s$coef[, 2]); put("near_r2", s$r.squared)
# which second predictor R drops as collinear (aliased)
for (v in c("inc_k", "inc_m", "inc3", "inc10", "stamp")) put(paste0("alias_", v), as.numeric(is.na(coef(lm(as.formula(paste("y ~ inc +", v, "+ x2")), d))[3])))
# weighted, Stata [pw=] (HC1 with weights) and [aw=] (classical)
m <- lm(y ~ x2 + inc_k, d, weights = w); X <- model.matrix(m); n <- nrow(X); k <- ncol(X); B <- solve(crossprod(X, d$w * X))
put("pw_b", coef(m)); put("pw_se", sqrt(diag(sand(X, X * (d$w * resid(m)), B, n / (n - k))))); put("aw_se", summary(m)$coef[, 2])
# clustered (Stata regress, vce(cluster cl)): G/(G-1) (n-1)/(n-k)
m <- lm(y ~ x2 + grupo, d); X <- model.matrix(m); B <- solve(crossprod(X)); U <- rowsum(X * resid(m), d$cl); G <- nrow(U)
put("cl_se", sqrt(diag(B %*% crossprod(U) %*% B * G / (G - 1) * (n - 1) / (n - ncol(X)))))
# robust model for the margins check: y ~ x2 + grupo, HC1; b and the full V (row-major), and the group shares
Vr <- sand(X, X * resid(m), B, n / (n - ncol(X))); put("mg_b", coef(m)); put("mg_V", t(Vr)); put("mg_cls", B * summary(m)$sigma^2); put("mg_share", colMeans(X)[3:4])
# logit and poisson with an income in pesos and a variable of about 1e-6; ML robust SEs use n/(n-1)
for (f in c("logit", "poisson")) {
  m <- if (f == "logit") glm(e ~ inc + x2 + tiny, binomial, d, control = glm.control(epsilon = 1e-14, maxit = 100)) else glm(cnt ~ inc + x2 + tiny, poisson, d, control = glm.control(epsilon = 1e-14, maxit = 100))
  X <- model.matrix(m); B <- summary(m)$cov.unscaled
  put(paste0(f, "_b"), coef(m)); put(paste0(f, "_se"), sqrt(diag(B))); put(paste0(f, "_rse"), sqrt(diag(sand(X, X * (m$y - fitted(m)), B, n / (n - 1)))))
}
# the same yes-no outcome coded 1/2 and "no"/"sí", modeled as the page's exported R code does
put("e12_b", coef(glm(I(e12 == 2) ~ inc + x2 + tiny, binomial, d, control = glm.control(epsilon = 1e-14, maxit = 100))))
put("esi_b", coef(glm(I(esi == "s\u00ed") ~ inc + x2 + tiny, binomial, d, control = glm.control(epsilon = 1e-14, maxit = 100))))
# ordered logit: o ~ v + x2 for v in pesos, x3, x10 and a timestamp; o ~ rate + x2 + grupo
olr <- function(f, v, c0, s0) { dd <- d; dd$v <- (d[[v]] - c0) / s0; m <- polr(as.formula(f), data = transform(dd, o = factor(o, ordered = TRUE)), Hess = TRUE, control = list(reltol = 1e-15, maxit = 2000))
  V <- vcov(m); b <- coef(m); z <- m$zeta; p <- length(b); J <- length(z)
  A <- diag(p + J); A[1, ] <- 0; A[1, 1] <- 1 / s0                       # b_v = gamma / s0
  for (j in 1:J) A[p + j, 1] <- c0 / s0                                     # theta_j = theta'_j + gamma c0 / s0
  th <- A %*% c(b, z); VV <- A %*% V %*% t(A); list(b = th, se = sqrt(diag(VV))) }
for (v in c("inc", "inc3", "inc10", "stamp")) { c0 <- if (v == "stamp") 1.6e9 else 0; r <- olr("o ~ v + x2", v, c0, 10^round(log10(sd(d[[v]])))); put(paste0("ol_", v, "_b"), r$b); put(paste0("ol_", v, "_se"), r$se) }
r <- olr("o ~ v + x2 + grupo", "rate", 0, 1e-3); put("ol_rate_b", r$b); put("ol_rate_se", r$se)
# weighted correlations (analytic weights): Pearson of the values and Spearman of the ranks, pair (y, inc) and (y, x2)
for (v in c("inc", "x2")) { ok <- complete.cases(d$y, d[[v]], d$w)
  put(paste0("wcor_", v), cov.wt(cbind(d$y[ok], d[[v]][ok]), wt = d$w[ok], cor = TRUE)$cor[1, 2])
  put(paste0("wsp_", v), cov.wt(cbind(rank(d$y[ok]), rank(d[[v]][ok])), wt = d$w[ok], cor = TRUE)$cor[1, 2]) }
# Welch t-test of y by sexo, one-sided: R's order is Hombre minus Mujer
t1 <- t.test(y ~ sexo, d, alternative = "less"); put("tt_less_p", t1$p.value); put("tt_t", t1$statistic)
js <- paste0("{\n", paste(sprintf('  "%s": [%s]', names(out), sapply(out, function(v) paste(sprintf("%.17g", v), collapse = ", "))), collapse = ",\n"), "\n}\n")
writeLines(js, file.path(here, "data", "regression-numerics-reference.json"), sep = "")
cat("wrote", length(out), "reference vectors\n")
