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

# ---- margins (Stata: margins, at()) and average marginal effects (margins, dydx(*)), delta method, as observed
ctl <- glm.control(epsilon = 1e-14, maxit = 100)
m <- glm(e ~ x2 + grupo + inc_k + sexo, binomial, d, control = ctl); X <- model.matrix(m); b <- coef(m); V <- vcov(m)
avgp <- function(Xm) { p <- plogis(drop(Xm %*% b)); g <- colMeans(p * (1 - p) * Xm); c(mean(p), sqrt(drop(t(g) %*% V %*% g))) }
mg <- NULL; for (s in c("Hombre", "Mujer")) for (g in -2:2) { Xm <- X; Xm[, "x2"] <- g; Xm[, "sexoMujer"] <- as.numeric(s == "Mujer"); mg <- rbind(mg, avgp(Xm)) }
put("mgl_y", mg[, 1]); put("mgl_se", mg[, 2])
p <- plogis(drop(X %*% b)); bx <- b["x2"]; ex <- as.numeric(colnames(X) == "x2")
g <- colMeans(p * (1 - p) * (1 - 2 * p) * bx * X) + mean(p * (1 - p)) * ex
ame <- c(mean(p * (1 - p)) * bx); ase <- c(sqrt(drop(t(g) %*% V %*% g)))
dc <- function(set1, set0) { X1 <- X; X0 <- X; X1 <- set1(X1); X0 <- set0(X0); p1 <- plogis(drop(X1 %*% b)); p0 <- plogis(drop(X0 %*% b)); g <- colMeans(p1 * (1 - p1) * X1 - p0 * (1 - p0) * X0); c(mean(p1 - p0), sqrt(drop(t(g) %*% V %*% g))) }
for (L in c("B", "C")) { r <- dc(function(M) { M[, "grupoB"] <- as.numeric(L == "B"); M[, "grupoC"] <- as.numeric(L == "C"); M }, function(M) { M[, "grupoB"] <- 0; M[, "grupoC"] <- 0; M }); ame <- c(ame, r[1]); ase <- c(ase, r[2]) }
bi <- b["inc_k"]; ei <- as.numeric(colnames(X) == "inc_k"); g <- colMeans(p * (1 - p) * (1 - 2 * p) * bi * X) + mean(p * (1 - p)) * ei
ame <- c(ame, mean(p * (1 - p)) * bi); ase <- c(ase, sqrt(drop(t(g) %*% V %*% g)))
r <- dc(function(M) { M[, "sexoMujer"] <- 1; M }, function(M) { M[, "sexoMujer"] <- 0; M }); ame <- c(ame, r[1]); ase <- c(ase, r[2])
put("amel", ame); put("amel_se", ase)
# at the means (atmeans): one row of means
xm <- colMeans(X); mm <- NULL; for (g in -2:2) { z <- xm; z["x2"] <- g; pp <- plogis(sum(z * b)); gg <- pp * (1 - pp) * z; mm <- rbind(mm, c(pp, sqrt(drop(t(gg) %*% V %*% gg)))) }
put("mgm_y", mm[, 1]); put("mgm_se", mm[, 2])
# lines at values of a numeric predictor: inc_k = 50 and 120, x2 = -1, 0, 1
m2 <- glm(e ~ x2 + inc_k, binomial, d, control = ctl); X2 <- model.matrix(m2); b2 <- coef(m2); V2 <- vcov(m2); mn <- NULL
for (k in c(50, 120)) for (g in -1:1) { Xm <- X2; Xm[, "x2"] <- g; Xm[, "inc_k"] <- k; pp <- plogis(drop(Xm %*% b2)); gg <- colMeans(pp * (1 - pp) * Xm); mn <- rbind(mn, c(mean(pp), sqrt(drop(t(gg) %*% V2 %*% gg)))) }
put("mgn_y", mn[, 1]); put("mgn_se", mn[, 2])
# Poisson: average marginal effect of x2 (expected count per +1)
m3 <- glm(cnt ~ x2 + inc_k, poisson, d, control = ctl); X3 <- model.matrix(m3); b3 <- coef(m3); V3 <- vcov(m3); mu <- exp(drop(X3 %*% b3))
g <- colMeans(mu * b3["x2"] * X3) + mean(mu) * as.numeric(colnames(X3) == "x2"); put("amep", c(mean(mu) * b3["x2"], sqrt(drop(t(g) %*% V3 %*% g))))
# linear regression: margins use t with the residual degrees of freedom (Stata after regress)
m4 <- lm(y ~ x2 + grupo, d); X4 <- model.matrix(m4); V4 <- vcov(m4); b4 <- coef(m4); ml <- NULL
for (g in c(-2, 0, 2)) { z <- colMeans(X4); z["x2"] <- g; est <- sum(z * b4); se <- sqrt(drop(t(z) %*% V4 %*% z)); ml <- rbind(ml, c(est, se, est - qt(.975, m4$df.residual) * se, est + qt(.975, m4$df.residual) * se)) }
put("mgo", t(ml))
# ordered logit: Pr(o = 4) across x2 = -2, 0, 2 (polr's own covariance)
mo <- polr(factor(o, ordered = TRUE) ~ x2 + inc_k, d, Hess = TRUE, control = list(reltol = 1e-15, maxit = 2000)); Xo <- model.matrix(~ x2 + inc_k, d)[, -1]; Vo <- vcov(mo); bo <- coef(mo); z3 <- mo$zeta[3]; mo4 <- NULL
for (g in c(-2, 0, 2)) { Xm <- Xo; Xm[, "x2"] <- g; eta <- drop(Xm %*% bo); F <- plogis(z3 - eta); p4 <- 1 - F; f <- F * (1 - F); gb <- colMeans(f * Xm); gz <- c(0, 0, -mean(f)); gg <- c(gb, gz); mo4 <- rbind(mo4, c(mean(p4), sqrt(drop(t(gg) %*% Vo %*% gg)))) }
put("mgo4_y", mo4[, 1]); put("mgo4_se", mo4[, 2])
js <- paste0("{\n", paste(sprintf('  "%s": [%s]', names(out), sapply(out, function(v) paste(sprintf("%.17g", v), collapse = ", "))), collapse = ",\n"), "\n}\n")
writeLines(js, file.path(here, "data", "regression-numerics-reference.json"), sep = "")
cat("wrote", length(out), "reference vectors\n")
