# Simulated variables for tests/descriptives-sim.test.mjs (build .91), with the answers from R packages:
#   moments (skewness, kurtosis), stats (quantile type 2 = Stata's unweighted percentiles, t.test CI),
#   survey (svymean / svyvar / confint with sampling weights = Stata's mean [pw=]), and Stata's weighted percentile rule
suppressMessages({ library(jsonlite); library(moments); library(survey) })
set.seed(20261108); K <- 300; P <- c(1, 5, 10, 25, 50, 75, 90, 95, 99)
# Stata [R] summarize, Methods and formulas: weighted percentile = first x(i) with W(i) > pW; if W(i) = pW, average with x(i+1)
stataP <- function(x, w, p) { o <- order(x); x <- x[o]; w <- w[o]; W <- cumsum(w); T <- sum(w) * p / 100
  i <- which(W >= T - 1e-12 * sum(w))[1]; if (abs(W[i] - T) <= 1e-12 * sum(w) && i < length(x)) (x[i] + x[i + 1]) / 2 else x[i] }
draw <- function(n, k) switch(k, normal = rnorm(n, 50, 10), skew = rlnorm(n, 10, 1.2), heavy = rt(n, 2), likert = sample(1:5, n, TRUE, c(.1, .2, .3, .25, .15)),
  binary = rbinom(n, 1, .3), tiny = rnorm(n, 1e-6, 2e-7), big = 1e9 + rnorm(n), negative = -rexp(n, 0.01), ties = round(rnorm(n, 3, 1)), year = sample(1990:2024, n, TRUE),
  pct = runif(n, 0, 100), bimodal = c(rnorm(n %/% 2, 0), rnorm(n - n %/% 2, 8)))
cases <- vector("list", K)
for (k in 1:K) cases[[k]] <- tryCatch({
  kind <- sample(c("normal", "skew", "heavy", "likert", "binary", "tiny", "big", "negative", "ties", "year", "pct", "bimodal"), 1)
  n <- sample(c(1, 2, 3, 5, 10, 25, 100, 500, 5000), 1, prob = c(.3, .5, .5, 1, 2, 2, 3, 2, 1))
  x <- draw(n, kind); if (n > 3) x[runif(n) < 0.06] <- NA
  wt <- runif(1) < 0.45; w <- if (wt) round(runif(n, 0.2, 5), 3) else rep(1, n)
  if (wt && n > 3) w[runif(n) < 0.03] <- NA
  ok <- !is.na(x) & !is.na(w); xs <- x[ok]; ws <- w[ok]; m <- length(xs)
  C <- list(k = k, kind = kind, n = n, weighted = wt, csv = paste(c("x,w", paste(ifelse(is.na(x), "", format(x, digits = 17, trim = TRUE)), ifelse(is.na(w), "", format(w, trim = TRUE)), sep = ",")), collapse = "\n"), N = m)
  if (m >= 1) {
    C$mean <- weighted.mean(xs, ws); C$min <- min(xs); C$max <- max(xs)
    C$pctl <- as.list(setNames(sapply(P, function(p) if (wt) stataP(xs, ws, p) else unname(quantile(xs, p / 100, type = 2))), paste0("p", P)))
    if (m >= 2) {
      if (wt) { D <- svydesign(ids = ~1, weights = ~w, data = data.frame(x = xs, w = ws)); C$sd <- sqrt(as.numeric(svyvar(~x, D))); s <- svymean(~x, D); C$se <- as.numeric(SE(s)); ci <- confint(s, df = degf(D)); C$lo <- as.numeric(ci[1]); C$hi <- as.numeric(ci[2])
        y <- xs - xs[1]; my <- sum(ws * y) / sum(ws); my <- my + sum(ws * (y - my)) / sum(ws); mm <- function(r) sum(ws * (y - my)^r) / sum(ws); C$sk <- mm(3) / mm(2)^1.5; C$ku <- mm(4) / mm(2)^2 }  # deviations from the first value: exact near 1e9
      else { C$sd <- sd(xs); C$se <- sd(xs) / sqrt(m); C$skMoments <- moments::skewness(xs); C$kuMoments <- moments::kurtosis(xs)  # the moments package (plain mean)
        y <- xs - xs[1]; my <- mean(y); my <- my + mean(y - my); C$sk <- mean((y - my)^3) / mean((y - my)^2)^1.5; C$ku <- mean((y - my)^4) / mean((y - my)^2)^2  # the same, exact near 1e9
        if (sd(xs) > 0) { tt <- t.test(xs); C$lo <- tt$conf.int[1]; C$hi <- tt$conf.int[2] } }
    }
  }
  C }, error = function(e) list(k = k, err = conditionMessage(e)))
out <- commandArgs(TRUE)[1]; if (!is.na(commandArgs(TRUE)[2])) cases <- Filter(function(C) C$n <= as.numeric(commandArgs(TRUE)[2]), cases)  # optional: keep the smaller cases
write_json(cases, out, auto_unbox = TRUE, digits = NA, null = "null", na = "null")
cat("cases", K, "errors", sum(sapply(cases, function(C) !is.null(C$err))), " weighted", sum(sapply(cases, function(C) isTRUE(C$weighted))), " n=1:", sum(sapply(cases, function(C) identical(C$n, 1))), "\n")
