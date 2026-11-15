# Reference for tests/predict.test.mjs (build .99): LC_ALL=C.UTF-8 R_LIBS=... Rscript calculator/tests/predict-reference.R
# Writes tests/data/predict-sim.csv (a survey-like sample: a yes/no outcome, a number outcome, weights, a coded question
# with No sabe, a number with missing values, a year) and tests/data/predict-reference.json with what R gives on the
# SAME design matrix the page builds (dummies against the most frequent level, medians for missing numbers):
#   glmnet   binomial and gaussian, weights, standardize = TRUE: coefficients at fixed lambdas, lambda path (first value)
#   glm      weighted logit coefficients
#   rpart    CART with cp = 0, no surrogates, maxdepth 3, minbucket 10: the predicted probabilities
#   class    knn(k = 15), unweighted: the predicted probabilities on a test set
#   ranger   500 trees, case.weights, seed: AUC on the test set (a tolerance check: forests are random)
#   pROC     weighted AUC is checked against a direct computation (pROC is unweighted, so on weights = 1)
suppressMessages({ library(glmnet); library(rpart); library(ranger); library(class); library(pROC); library(jsonlite) })
set.seed(99)
N <- 1200
sexo <- sample(1:2, N, TRUE); edad <- round(runif(N, 18, 85)); edad[sample(N, 40)] <- NA
conf <- sample(c(1:4, 9), N, TRUE, prob = c(.3, .3, .2, .15, .05)); ent <- sample(1:6, N, TRUE); year <- sample(2019:2024, N, TRUE)
w <- round(runif(N, 20, 400), 1)
lin <- -1.2 + 0.9 * (sexo == 2) - 0.025 * (ifelse(is.na(edad), 50, edad) - 50) + 0.5 * (conf %in% 3:4) + 0.3 * (ent == 3) + 0.15 * (year - 2021)
y <- rbinom(N, 1, plogis(lin)); ynum <- 50 + 8 * (sexo == 2) - 0.3 * (ifelse(is.na(edad), 50, edad) - 50) + 4 * (conf %in% 3:4) + rnorm(N, 0, 6)
d <- data.frame(sexo, edad, conf, ent, year, w, y, ynum)
write.csv(d, "calculator/tests/data/predict-sim.csv", row.names = FALSE, na = "")
# the page's design: most frequent level is the reference; missing edad -> median of the rows used; "9" is a level
lev <- function(x) { t <- sort(table(x), decreasing = TRUE); names(t) }
dummies <- function(x, levels) { m <- sapply(levels[-1], function(l) as.numeric(x == as.numeric(l))); colnames(m) <- paste0(deparse(substitute(x)), "=", levels[-1]); m }
design <- function(rows) { e <- edad[rows]; e[is.na(e)] <- median(edad[rows], na.rm = TRUE)
  cbind(sexo = dummies(sexo[rows], lev(sexo)), edad = e, conf = dummies(conf[rows], lev(conf)), ent = dummies(ent[rows], lev(ent)), year = year[rows]) }
all <- seq_len(N); X <- design(all)
out <- list(levels = list(sexo = lev(sexo), conf = lev(conf), ent = lev(ent)), colnames = colnames(X))
# glm (weighted logit)
# glm diverges with the raw weights (their sum is ~250,000); the same weights divided by their mean give the same MLE
wm <- w / mean(w)
g <- glm(y ~ X, family = quasibinomial, weights = wm, control = glm.control(maxit = 100, epsilon = 1e-12)); out$glm <- list(coef = unname(coef(g)), converged = g$converged)
stopifnot(g$converged)
gl <- lm(ynum ~ X, weights = wm); out$lm <- list(coef = unname(coef(gl)))
# glmnet at fixed lambdas on the same standardised path
wn <- w / sum(w)
fb <- glmnet(X, y, family = "binomial", weights = wn, alpha = 1, standardize = TRUE, thresh = 1e-12)
ix <- unique(pmin(c(1, 10, 25, 50), length(fb$lambda))); lams <- fb$lambda[ix]
out$glmnet_binomial <- list(lambda_max = fb$lambda[1], lambdas = lams, coef = lapply(lams, function(l) unname(as.vector(coef(fb, s = l)))))
fg <- glmnet(X, ynum, family = "gaussian", weights = wn, alpha = 1, standardize = TRUE, thresh = 1e-12)
ixg <- unique(pmin(c(1, 10, 25, 50), length(fg$lambda))); lg <- fg$lambda[ixg]
out$glmnet_gaussian <- list(lambda_max = fg$lambda[1], lambdas = lg, coef = lapply(lg, function(l) unname(as.vector(coef(fg, s = l)))))
# rpart: CART, no pruning, depth 3, minbucket 10, weighted gini; predictions on all rows
dd <- data.frame(y = factor(y), X); names(dd) <- make.names(names(dd))
tr <- rpart(y ~ ., data = dd, weights = w, method = "class", control = rpart.control(cp = -1, maxdepth = 3, minsplit = 20, minbucket = 10, xval = 0, maxcompete = 0, maxsurrogate = 0, usesurrogate = 0), parms = list(split = "gini"))   # cp = -1: no risk-based pruning, so every Gini split stays (cp = 0 drops splits that do not change the predicted class)
out$rpart <- list(prob = unname(predict(tr, dd, type = "prob")[, 2]), nsplit = nrow(tr$frame[tr$frame$var != "<leaf>", ]))
ddn <- data.frame(ynum = ynum, X); names(ddn) <- make.names(names(ddn))
trn <- rpart(ynum ~ ., data = ddn, weights = w, method = "anova", control = rpart.control(cp = 0, maxdepth = 3, minsplit = 20, minbucket = 10, xval = 0, maxcompete = 0, maxsurrogate = 0, usesurrogate = 0))
out$rpart_anova <- list(pred = unname(predict(trn, ddn)))
# knn (unweighted), standardised columns with training mean / sd (unweighted), train = first 900 rows
tri <- 1:900; tei <- 901:N; Z <- scale(X, center = colMeans(X[tri, ]), scale = apply(X[tri, ], 2, sd)); Z[, apply(X[tri, ], 2, sd) == 0] <- 0
kn <- knn(Z[tri, ], Z[tei, ], factor(y[tri]), k = 15, prob = TRUE)
pk <- attr(kn, "prob"); pk <- ifelse(kn == "1", pk, 1 - pk)
out$knn <- list(train = tri, test = tei, prob = unname(pk))
# ranger with case weights: AUC on the test set (tolerance)
rf <- ranger(y = factor(y[tri]), x = X[tri, ], num.trees = 500, mtry = 3, min.node.size = 5, case.weights = w[tri], probability = TRUE, seed = 7)
prf <- predict(rf, X[tei, ])$predictions[, 2]
out$ranger <- list(auc = as.numeric(auc(roc(y[tei], prf, quiet = TRUE))), auc_w = NA)
# weighted AUC by hand (Mann–Whitney with weights) for the glm fitted values, and pROC on weights = 1
pg <- fitted(g); pos <- which(y == 1); neg <- which(y == 0)
num <- 0; for (i in pos) num <- num + sum(w[i] * w[neg] * ((pg[i] > pg[neg]) + 0.5 * (pg[i] == pg[neg])))
out$auc <- list(prob = unname(pg), weighted = num / (sum(w[pos]) * sum(w[neg])), unweighted = as.numeric(auc(roc(y, pg, quiet = TRUE))))
writeLines(toJSON(out, digits = 15, auto_unbox = TRUE, na = "null"), "calculator/tests/data/predict-reference.json")
cat("ok\n")
