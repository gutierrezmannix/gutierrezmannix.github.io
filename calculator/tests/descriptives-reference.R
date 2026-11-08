# R references for tests/descriptives.test.mjs (build .66): Rscript calculator/tests/descriptives-reference.R
# Stata's rules, written out in base R: summarize, detail (weighted percentiles: the first value whose cumulative weight
# reaches p·W, averaged with the next when it lands on p·W; moments m_r = Σw(x−m)^r/Σw), [aw=] SD, mean [pw=] SE
# (linearized), ci means, tab / tab, chi2 with weights rescaled to the observations.
here <- dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)))
d <- read.csv(file.path(here, "data", "descriptives.csv"))
wq <- function(x, w, p) { o <- order(x); cw <- cumsum(w[o]) / sum(w); i <- which(cw >= p - 1e-12)[1]; if (abs(cw[i] - p) < 1e-12) mean(x[o][i + 0:1]) else x[o][i] }
st <- function(x, w) {
  ok <- !is.na(x) & !is.na(w); x <- x[ok]; w <- w[ok]; n <- length(x)
  # build .91: deviations measured from the first value (exact for values near 1e9), the mean corrected once
  y <- x - x[1]; my <- sum(w * y) / sum(w); my <- my + sum(w * (y - my)) / sum(w); m <- x[1] + my; e <- y - my; m2 <- sum(w * e^2) / sum(w)
  sd <- sqrt(m2 * n / (n - 1)); se <- if (length(unique(w)) == 1) sd / sqrt(n) else sqrt(n / (n - 1) * sum((w * e)^2)) / sum(w)
  h <- qt(0.975, n - 1) * se
  c(n = n, mean = m, sd = sd, min = min(x), max = max(x), sk = sum(w * e^3) / sum(w) / m2^1.5, ku = sum(w * e^4) / sum(w) / m2^2,
    se = se, lo = m - h, hi = m + h, sapply(c(p1 = .01, p5 = .05, p10 = .1, p25 = .25, p50 = .5, p75 = .75, p90 = .9, p95 = .95, p99 = .99), function(p) wq(x, w, p)))
}
num <- function(v) paste0("{", paste0('"', names(v), '":', sprintf("%.17g", v), collapse = ","), "}")
L <- c()
for (v in c("x", "skew", "tiny", "big")) for (wt in c("none", "w")) {
  w <- if (wt == "w") d$w else rep(1, nrow(d)); L <- c(L, sprintf('"%s|%s":%s', v, wt, num(st(d[[v]], w))))
  for (g in sort(unique(d$grp))) { s <- d[d$grp == g, ]; ww <- if (wt == "w") s$w else rep(1, nrow(s)); r <- st(s[[v]], ww)
    L <- c(L, sprintf('"%s|%s|%s":%s', v, wt, g, num(c(sd = r[["sd"]], median = r[["p50"]], mean = r[["mean"]])))) }
}
k <- !is.na(d$likert); tb <- table(d$likert); L <- c(L, sprintf('"likert|counts":%s', num(setNames(as.numeric(tb), names(tb)))))
tw <- xtabs(w ~ likert, data = d); L <- c(L, sprintf('"likert|wpct":%s', num(setNames(as.numeric(100 * tw / sum(tw)), names(tw)))))
c1 <- suppressWarnings(chisq.test(table(d$likert, d$grp), correct = FALSE))
tw2 <- xtabs(w ~ likert + grp, data = d); c2 <- suppressWarnings(chisq.test(tw2 * sum(complete.cases(d[c("likert", "grp", "w")])) / sum(tw2), correct = FALSE))
L <- c(L, sprintf('"chi2|none":%s', num(c(stat = unname(c1$statistic), p = c1$p.value))), sprintf('"chi2|w":%s', num(c(stat = unname(c2$statistic), p = c2$p.value))))
writeLines(paste0("{\n", paste(L, collapse = ",\n"), "\n}"), file.path(here, "data", "descriptives-reference.json"))
cat("wrote", length(L), "references\n")
