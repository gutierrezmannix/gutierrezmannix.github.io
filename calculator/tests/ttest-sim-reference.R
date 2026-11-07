# Simulated t-test cases for tests/ttest-sim.test.mjs (build .88): data + settings, and the answers from R's
# stats::t.test, effectsize::cohens_d and BSDA::tsum.test. 400 cases: two groups (Welch and Student; numeric codes and
# text names that sort differently in R and Stata: b/B, Ángela/Zoe, mujer/Hombre; 2 to 5 groups), paired, one value
# (some typed with a decimal comma) and summary numbers; normal, skewed, heavy-tailed, Likert and income-like data;
# n from 2 to 2,000; missing values; two-sided and one-sided; 90, 95 and 99%.
#   Rscript calculator/tests/ttest-sim-reference.R calculator/tests/data/ttest-sim-reference.json
suppressMessages({ library(jsonlite); library(effectsize); library(BSDA) })
set.seed(20261107); K <- 400
draw <- function(n, kind, m, s) switch(kind,
  normal = rnorm(n, m, s), skew = m + s * (rlnorm(n, 0, 0.9) - exp(0.405)), heavy = m + s * rt(n, 3) / sqrt(3),
  likert = pmin(5, pmax(1, round(rnorm(n, m / 20 + 2.5, 1.1)))), money = round(exp(rnorm(n, log(abs(m) + 10) + 6, 1))))
namesets <- list(c("0", "1"), c("1", "2"), c("Hombre", "Mujer"), c("mujer", "Hombre"), c("Sí", "No"), c("b", "B"), c("Ángela", "Zoe"),
                 c("10", "9"), c("PRI", "PAN", "Morena", "MC"), c("1", "2", "3", "4", "5"))
cases <- vector("list", K)
for (k in 1:K) { cases[[k]] <- tryCatch({
  mode <- sample(c("groups", "groups", "paired", "value", "summary"), 1)
  kind <- sample(c("normal", "normal", "skew", "heavy", "likert", "money"), 1)
  alt <- sample(c("two", "two", "gt", "lt"), 1); level <- sample(c(90, 95, 95, 99), 1); equal <- runif(1) < 0.35
  nn <- function() sample(c(2, 3, 5, 8, 15, 30, 60, 200, 2000), 1, prob = c(1, 1, 2, 2, 3, 3, 3, 2, 1))
  m <- sample(c(0, 5, 50, 1e4, -3), 1); s <- sample(c(0.01, 1, 10, 3000), 1)
  C <- list(k = k, mode = mode, kind = kind, alt = alt, level = level, equal = equal)
  if (mode == "groups") {
    labs <- namesets[[sample(length(namesets), 1)]]; L <- length(labs)
    ns <- sapply(1:L, function(i) nn()); ys <- lapply(1:L, function(i) draw(ns[i], kind, m + i * s * runif(1, -0.5, 0.8), s * runif(1, 0.3, 3)))
    g <- rep(labs, ns); y <- unlist(ys); o <- sample(length(y)); g <- g[o]; y <- y[o]
    y[runif(length(y)) < 0.05] <- NA
    num <- all(grepl("^[0-9]+$", labs)); if (num) g <- as.numeric(g)
    if (L == 2) { swap <- runif(1) < 0.5; ord <- sort(unique(g)); if (!num) ord <- sort(unique(g), method = "radix"); A <- if (swap) ord[2] else ord[1]; B <- if (swap) ord[1] else ord[2] }
    else { pk <- sample(labs, 2); A <- pk[1]; B <- pk[2]; swap <- FALSE }
    if (sum(!is.na(y[g == A])) < 2 || sum(!is.na(y[g == B])) < 2) { y[which(g == A)[1:2]] <- c(1, 2); y[which(g == B)[1:2]] <- c(3, 5) }
    C$csv <- paste(c("y,g", paste(ifelse(is.na(y), "", format(y, digits = 15, trim = TRUE)), (if (num) g else paste0('"', g, '"')), sep = ",")), collapse = "\n")
    C$A <- as.character(A); C$B <- as.character(B); C$swap <- swap; C$nlev <- L; C$num <- num
    xa <- y[g == A]; xb <- y[g == B]
    tt <- t.test(xa, xb, var.equal = equal, alternative = c(two = "two.sided", gt = "greater", lt = "less")[alt], conf.level = level / 100)
    C$d <- tryCatch(cohens_d(xa, xb, pooled_sd = TRUE, ci = level / 100)$Cohens_d, error = function(e) NA)
  } else if (mode == "paired") {
    n <- nn(); x <- draw(n, kind, m, s); y2 <- x + draw(n, "normal", s * runif(1, -1, 1), s * runif(1, 0.1, 2)); if (kind == "likert") y2 <- round(y2)
    x[runif(n) < 0.05] <- NA; y2[runif(n) < 0.05] <- NA
    ok <- !is.na(x) & !is.na(y2); if (sum(ok) < 3) { x[1:3] <- c(1, 2, 4); y2[1:3] <- c(2, 2, 7) }
    C$csv <- paste(c("y,y2", paste(ifelse(is.na(x), "", format(x, digits = 15, trim = TRUE)), ifelse(is.na(y2), "", format(y2, digits = 15, trim = TRUE)), sep = ",")), collapse = "\n")
    tt <- t.test(x, y2, paired = TRUE, alternative = c(two = "two.sided", gt = "greater", lt = "less")[alt], conf.level = level / 100)
    ok <- !is.na(x) & !is.na(y2); C$d <- mean(x[ok] - y2[ok]) / sd(x[ok] - y2[ok])
    C$d_eff <- tryCatch(cohens_d(x[ok], y2[ok], paired = TRUE)$Cohens_d, error = function(e) NA)
  } else if (mode == "value") {
    n <- nn(); x <- draw(n, kind, m, s); x[runif(n) < 0.05] <- NA; if (sum(!is.na(x)) < 2) x[1:2] <- c(1, 3)
    mu <- signif(mean(x, na.rm = TRUE) + sample(c(-1, 0.3, 0, 2), 1) * sd(x, na.rm = TRUE) / 3, 4); C$mu <- mu
    C$muTxt <- if (runif(1) < 0.3) sub(".", ",", as.character(mu), fixed = TRUE) else as.character(mu)
    C$csv <- paste(c("y", ifelse(is.na(x), "", format(x, digits = 15, trim = TRUE))), collapse = "\n")
    tt <- t.test(x, mu = mu, alternative = c(two = "two.sided", gt = "greater", lt = "less")[alt], conf.level = level / 100)
    C$d <- tryCatch(cohens_d(x, mu = mu, ci = level / 100)$Cohens_d, error = function(e) NA)
  } else {
    sk <- sample(c("two", "one", "paired"), 1); C$sk <- sk
    m1 <- signif(runif(1, -50, 200), 4); s1 <- signif(runif(1, 0.5, 40), 3); n1 <- nn(); m2 <- signif(m1 + runif(1, -20, 20), 4); s2 <- signif(runif(1, 0.5, 40), 3); n2 <- nn(); mu <- signif(m1 + runif(1, -10, 10), 3)
    C[c("m1", "s1", "n1", "m2", "s2", "n2", "mu")] <- list(m1, s1, n1, m2, s2, n2, mu)
    a <- c(two = "two.sided", gt = "greater", lt = "less")[alt]
    tt <- if (sk == "two") tsum.test(m1, s1, n1, m2, s2, n2, var.equal = equal, alternative = a, conf.level = level / 100)
          else tsum.test(m1, s1, n1, mu = if (sk == "one") mu else 0, alternative = a, conf.level = level / 100)
    C$d <- if (sk == "two") (m1 - m2) / sqrt(((n1 - 1) * s1^2 + (n2 - 1) * s2^2) / (n1 + n2 - 2)) else (m1 - if (sk == "one") mu else 0) / s1
  }
  C$t <- unname(tt$statistic); C$df <- unname(tt$parameter); C$p <- tt$p.value; C$lo <- tt$conf.int[1]; C$hi <- tt$conf.int[2]
  C }, error = function(e) { C$rerr <- conditionMessage(e); C })
}
out <- commandArgs(TRUE)[1]; if (is.na(out)) out <- "ttest-sim-reference.json"
# kept: cases R can test (not constant data), with data under 3,000 characters so the file stays small
keep <- Filter(function(C) is.null(C$rerr) && !is.null(C$t) && (is.null(C$csv) || nchar(C$csv) < 3000), cases)
write_json(keep, out, auto_unbox = TRUE, digits = NA, null = "null", na = "null")
cat("cases:", K, " by mode:", paste(names(table(sapply(cases, `[[`, "mode"))), table(sapply(cases, `[[`, "mode")), collapse = " "), "\n")
