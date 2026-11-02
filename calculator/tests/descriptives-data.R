# Data for tests/descriptives.test.mjs (build .66): Rscript calculator/tests/descriptives-data.R  → tests/data/descriptives.csv
# A normal variable with missing values, incomes in pesos (strong skew), a rate near 1e-6, values near 1e9 with an SD
# of 1, a 1–5 scale, counts, a weight, three regions and a missing-data code (99).
set.seed(20261102); n <- 300
d <- data.frame(
  x = round(rnorm(n, 50, 10), 2),
  skew = round(rlnorm(n, log(80000), 0.8), 2),
  tiny = signif(runif(n, 0, 2e-6), 6),
  big = round(1e9 + rnorm(n), 4),
  likert = sample(1:5, n, TRUE, prob = c(.10, .15, .20, .35, .20)),
  hijos = rpois(n, 1.6),
  w = round(runif(n, 0.5, 3), 3),
  grp = sample(c("norte", "centro", "sur"), n, TRUE, prob = c(.5, .3, .2)))
d$x[sample(n, 12)] <- NA; d$likert[sample(n, 7)] <- NA
d$codes <- d$hijos; d$codes[sample(n, 9)] <- 99
out <- file.path(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))), "data", "descriptives.csv")
write.csv(d, out, row.names = FALSE, na = "")
