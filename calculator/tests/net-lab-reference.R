# Compare the calculator's network model with R's ergm() on your own files.
# Usage: Rscript calculator/tests/net-lab-reference.R edges.csv nodes.csv [attribute]
# Prints MPLE and MCMC estimates for: edges + mutual + nodematch(attribute) and with gwesp(0.5, fixed = TRUE).
suppressPackageStartupMessages({ library(network); library(ergm) })
a <- commandArgs(trailingOnly = TRUE)
e <- read.csv(a[1], check.names = FALSE, fileEncoding = "UTF-8")
v <- read.csv(a[2], check.names = FALSE, fileEncoding = "UTF-8")
attr <- if (length(a) >= 3) a[3] else "democrat"
from <- if ("Vertex 1" %in% names(e)) "Vertex 1" else names(e)[1]
to <- if ("Vertex 2" %in% names(e)) "Vertex 2" else names(e)[2]
e <- e[e[[from]] != e[[to]], ]                                      # self-ties removed, as in the calculator
el <- unique(e[, c(from, to)])
names(v)[1] <- "vertex.names"
net <- network(el, vertices = v, directed = TRUE, matrix.type = "edgelist")
cat("nodes", network.size(net), "ties", network.edgecount(net), "\n")
f1 <- as.formula(paste0('net ~ edges + mutual + nodematch("', attr, '")'))
f2 <- as.formula(paste0('net ~ edges + mutual + gwesp(0.5, fixed = TRUE) + nodematch("', attr, '")'))
for (f in list(f1, f2)) {
  print(f)
  print(round(coef(ergm(f, estimate = "MPLE")), 3))
  fit <- ergm(f, control = control.ergm(seed = 26))
  print(summary(fit)$coefficients[, 1:2])
}
