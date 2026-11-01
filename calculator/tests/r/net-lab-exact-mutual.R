# Exact maximum likelihood for a directed model with edges + mutual + nodematch(...) terms only.
# Such a model is dyad-independent (each pair has 4 states), so the MLE is computable without simulation;
# the calculator's MCMC estimate must agree with it.
# Usage: Rscript net-lab-exact-mutual.R <dir from net-lab-export.mjs> <tag> <model id>
a <- commandArgs(TRUE); d <- a[1]; tag <- a[2]; mod <- a[3]
A <- read.csv(file.path(d, paste0(tag, "-attrs.csv")), colClasses = "character"); E <- read.csv(file.path(d, paste0(tag, "-edges.csv")), stringsAsFactors = FALSE)
M <- read.csv(file.path(d, paste0(tag, "-ergm.csv")), stringsAsFactors = FALSE); M <- M[M$model == mod, ]
stopifnot(M$rterm[1] == "edges", M$rterm[2] == "mutual", all(grepl("^nodematch:", M$rterm[-(1:2)])))
ids <- A$id; n <- length(ids); Y <- matrix(0, n, n); Y[cbind(match(E$from, ids), match(E$to, ids))] <- 1; diag(Y) <- 0
P <- which(upper.tri(Y), arr.ind = TRUE); i <- P[, 1]; j <- P[, 2]
X <- sapply(sub("^nodematch:", "", M$rterm[-(1:2)]), function(v) { x <- A[[v]]; as.numeric(!is.na(x[i]) & x[i] != "" & x[i] == x[j]) }); X <- matrix(X, ncol = nrow(M) - 2)
k <- Y[cbind(i, j)] + Y[cbind(j, i)]; gobs <- c(sum(k), sum(k == 2), colSums(k * X))
lin <- function(t) t[1] + drop(X %*% t[-(1:2)])
nll <- function(t) { a <- lin(t); -(sum(t * gobs) - sum(log1p(2 * exp(a) + exp(2 * a + t[2])))) }
gr <- function(t) { a <- lin(t); e1 <- 2 * exp(a); e2 <- exp(2 * a + t[2]); Z <- 1 + e1 + e2; Ek <- (e1 + 2 * e2) / Z; -(gobs - c(sum(Ek), sum(e2 / Z), colSums(Ek * X))) }
f <- optim(M$mple, nll, gr, method = "BFGS", control = list(maxit = 5000, reltol = 1e-15), hessian = TRUE); se <- sqrt(diag(solve(f$hessian)))
cat(sprintf("%s %s: observed statistics %s (calculator %s)\n", tag, mod, paste(gobs, collapse = " "), paste(round(M$gobs, 3), collapse = " ")))
out <- data.frame(term = M$rterm, exact_MLE = f$par, exact_SE = se, calc_MCMC = M$mcmc, calc_SE = M$mcmc_se, diff_in_SE = (M$mcmc - f$par) / se)
print(format(out, digits = 5), row.names = FALSE)
cat(if (all(abs(out$diff_in_SE) < 0.1)) "OK: calculator = exact MLE (within 0.1 SE)\n" else "CHECK: calculator differs from the exact MLE\n")
