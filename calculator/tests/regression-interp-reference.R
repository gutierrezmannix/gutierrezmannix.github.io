# References for tests/regression-interp.test.mjs (build .74): Rscript regression-interp-reference.R
# Writes data/regression-interp.csv and data/regression-interp-reference.json. Base R + MASS (polr) only.
set.seed(2611)
n <- 900
x <- round(rnorm(n, 5, 2), 2)
g <- sample(c("a", "b", "c"), n, replace = TRUE)
s <- sample(c(0, 50, 100), n, replace = TRUE)            # a 0 / 50 / 100 scale
inc <- round(runif(n, 2000, 60000))                      # income in pesos: tiny coefficient per peso
cl <- sample(1:40, n, replace = TRUE)
eta <- -1 + 0.35 * x + 0.6 * (g == "b") - 0.8 * (g == "c") + 0.012 * s + 0.00002 * inc
y <- round(20 + 2.5 * x + 3 * (g == "b") - 4 * (g == "c") + 0.08 * s + 0.0003 * inc + rnorm(n, 0, 6), 2)
yb <- rbinom(n, 1, plogis(eta - 2))
lat <- eta + rlogis(n); yo <- cut(lat, c(-Inf, quantile(lat, c(.25, .5, .75)), Inf), labels = FALSE)
yc <- rpois(n, exp(0.2 + 0.1 * x + 0.3 * (g == "b") - 0.4 * (g == "c") + 0.004 * s))
d <- data.frame(y, yb, yo, yc, x, g, s, inc, cl)
write.csv(d, "data/regression-interp.csv", row.names = FALSE)
d$g <- factor(d$g, levels = c("a", "b", "c"))
cf <- function(m) { co <- coef(m); setNames(as.list(unname(co)), names(co)) }
ols <- lm(y ~ x + g + s + inc, d)
lg <- glm(yb ~ x + g + s + inc, binomial, d)
po <- glm(yc ~ x + g + s, poisson, d)
d$inc_k <- d$inc / 1000; ol <- MASS::polr(factor(yo) ~ x + g + s + inc_k, d, Hess = TRUE) # pesos in thousands for polr; converted back below
# clustered Wald chi2 for the logit, as Stata's logit, vce(cluster cl): V = G/(G-1) * B M B
X <- model.matrix(lg); mu <- fitted(lg); B <- solve(t(X) %*% (X * (mu * (1 - mu)))); U <- X * (d$yb - mu)
Ug <- rowsum(U, d$cl); G <- nrow(Ug); V <- G / (G - 1) * B %*% crossprod(Ug) %*% B
b <- coef(lg)[-1]; W <- as.numeric(t(b) %*% solve(V[-1, -1]) %*% b)
ref <- list(ols = cf(ols), ols_p = summary(ols)$coefficients[, 4], logit = cf(lg), logit_p = summary(lg)$coefficients[, 4],
  poisson = cf(po), poisson_p = summary(po)$coefficients[, 4], ologit = { o <- as.list(coef(ol)); names(o)[names(o) == "inc_k"] <- "inc"; o$inc <- o$inc / 1000; o },
  ologit_p = { q <- as.list(2 * pnorm(-abs(coef(summary(ol))[names(coef(ol)), "t value"]))); names(q)[names(q) == "inc_k"] <- "inc"; q },
  logit_cluster_wald = list(chi2 = W, df = length(b), p = pchisq(W, length(b), lower.tail = FALSE)), r2 = summary(ols)$r.squared)
ref$ols_p <- as.list(ref$ols_p); ref$logit_p <- as.list(ref$logit_p); ref$poisson_p <- as.list(ref$poisson_p)
writeLines(paste0("{", paste(sapply(names(ref), function(k) { v <- ref[[k]]; if (is.list(v)) paste0('"', k, '":{', paste(sprintf('"%s":%.12g', names(v), unlist(v)), collapse = ","), "}") else sprintf('"%s":%.12g', k, v) }), collapse = ","), "}"), "data/regression-interp-reference.json")
cat("written; OLS R2", summary(ols)$r.squared, " logit cluster Wald", W, "\n")
print(round(coef(ols), 5)); print(round(exp(coef(lg)), 4)); print(round(exp(coef(po)), 4)); print(round(exp(coef(ol)), 4))
