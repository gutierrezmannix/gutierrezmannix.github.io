# Reference for tests/timeline-coded.test.mjs (build .95): LC_ALL=C.UTF-8 Rscript calculator/tests/timeline-coded-reference.R
# Writes tests/data/timeline-coded.dta (a labelled survey over 7 years, 2019 not asked) and the survey estimates R gives
# for it in tests/data/timeline-coded-reference.json: svymean of each answer, of one answer by sex, of the reversed score,
# pooled 3-year windows (by position among the years in the data), with their standard errors and t(n-1) intervals.
suppressMessages({ library(haven); library(survey); library(jsonlite) })
set.seed(2611)
yrs <- c(2015, 2016, 2017, 2018, 2020, 2021, 2022); N <- 1400
anio <- sample(yrs, N, replace = TRUE); sexo <- sample(1:2, N, replace = TRUE)
peso <- round(runif(N, 50, 900), 1)
p_si <- 0.2 + 0.03 * (anio - 2015) / 7 + 0.08 * (sexo == 2)
taxi <- ifelse(runif(N) < 0.25, 3, ifelse(runif(N) < p_si, 1, 2)); taxi[sample(N, 9)] <- 9
conf <- pmin(4, pmax(1, round(1.8 + 0.12 * (anio - 2015) + rnorm(N, 0, 0.9)))); conf[sample(N, 25)] <- 5; conf[sample(N, 20)] <- 9
ingreso <- round(exp(rnorm(N, 9 + 0.03 * (anio - 2015), 0.6)))
df <- data.frame(anio, sexo = labelled(sexo, c(Hombre = 1, Mujer = 2)), peso,
  taxi = labelled(taxi, c("Sí" = 1, "No" = 2, "No aplica" = 3, "No sabe / no responde" = 9)),
  conf = labelled(conf, c(Mucha = 1, Alguna = 2, Poca = 3, Nada = 4, "No aplica" = 5, "No sabe / no responde" = 9)), ingreso)
attr(df$taxi, "label") <- "Dejar de tomar taxi"; attr(df$conf, "label") <- "Confianza en vecinos"
write_dta(df, "calculator/tests/data/timeline-coded.dta", version = 15)
est <- function(y, w, keep) { d <- data.frame(y = y[keep], w = w[keep]); n <- nrow(d); des <- svydesign(ids = ~1, weights = ~w, data = d); m <- svymean(~y, des)
  se <- as.numeric(SE(m)); mu <- as.numeric(coef(m)); h <- qt(0.975, n - 1) * se; list(y = mu, se = se, lo = mu - h, hi = mu + h, n = n) }
win <- function(i, k) { h <- (k - 1) / 2; yrs[max(1, i - h):min(length(yrs), i + h)] }
t <- as.numeric(df$taxi); cf <- as.numeric(df$conf); out <- list()
for (i in seq_along(yrs)) { Y <- yrs[i]; W3 <- win(i, 3)
  r <- list(year = Y)
  for (a in c(1, 2, 3, 9)) r[[paste0("each", a)]] <- est(100 * (t == a), peso, anio == Y)
  r$each_dropped <- est(100 * (t == 1), peso, anio == Y & t %in% c(1, 2, 3))                       # No sabe left out
  r$one_m <- est(100 * (t == 1), peso, anio == Y & t %in% 1:2 & sexo == 2)                        # Sí among taxi users, Mujer
  r$one3 <- est(100 * (t == 1), peso, anio %in% W3 & t %in% 1:2); r$one3$win <- length(W3)        # pooled 3-year
  r$score <- est(5 - cf, peso, anio == Y & cf %in% 1:4)                                            # reversed: Mucha = 4
  r$score3 <- est(5 - cf, peso, anio %in% W3 & cf %in% 1:4)
  r$strip5 <- est(100 * (cf == 5), peso, anio == Y)
  r$ingreso <- est(ingreso, peso, anio == Y); r$ingreso_u <- est(ingreso, rep(1, N), anio == Y)
  r$count1 <- sum(peso[anio == Y & t == 1])
  out[[i]] <- r }
writeLines(toJSON(out, digits = 15, auto_unbox = TRUE), "calculator/tests/data/timeline-coded-reference.json")
