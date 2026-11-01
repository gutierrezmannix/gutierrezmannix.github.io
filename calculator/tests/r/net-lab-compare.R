# Independent check of the calculator's Networks results with R (sna, network, igraph) and an R simulation of the ERGM.
# Usage: Rscript net-lab-compare.R <dir from net-lab-export.mjs> <tag> <raw edges> <raw nodes> <encoding UTF-8|CP1252> <directed 1|0> <attr> <sims per model> [steps between sims]
suppressPackageStartupMessages({ library(sna); library(network); library(igraph) })
a <- commandArgs(trailingOnly = TRUE)
dir <- a[1]; tag <- a[2]; ef <- a[3]; nf <- a[4]; enc <- a[5]; directed <- a[6] == "1"; attr <- a[7]; nsim <- as.integer(a[8])
set.seed(26)
out <- character(); say <- function(...) { s <- paste0(...); cat(s, "\n"); out <<- c(out, s) }
chk <- function(label, r, calc, tol = 1e-6) { invisible(chk0(label, r, calc, tol)) }
chk0 <- function(label, r, calc, tol = 1e-6) { d <- max(abs(r - calc), na.rm = TRUE); ok <- is.finite(d) && d <= tol * max(1, max(abs(r), na.rm = TRUE)); say(sprintf("%-34s R %-14s calc %-14s max diff %-10s %s", label, format(signif(if (length(r) == 1) r else mean(r, na.rm = TRUE), 6)), format(signif(if (length(calc) == 1) calc else mean(calc, na.rm = TRUE), 6)), format(signif(d, 3)), if (ok) "OK" else "DIFF")); ok }

# ---------- 1. build the network from the raw files, independently of the calculator
rd <- function(f) { b <- readBin(f, "raw", file.info(f)$size); if (length(b) >= 3 && all(b[1:3] == as.raw(c(0xEF, 0xBB, 0xBF)))) b <- b[-(1:3)]; txt <- rawToChar(b); txt <- if (enc == "UTF-8") iconv(txt, "UTF-8", "UTF-8", sub = "?") else iconv(txt, from = enc, to = "UTF-8", sub = "?"); read.csv(text = txt, check.names = FALSE, stringsAsFactors = FALSE, quote = "\"", comment.char = "") }
e <- rd(ef)
v <- rd(nf)
e <- e[e[["Vertex 1"]] != "" & e[["Vertex 2"]] != "" & e[["Vertex 1"]] != e[["Vertex 2"]], ]
tw <- tapply(seq_len(nrow(e)), e$Relationship, function(ix) { s <- paste(e[ix, "Vertex 1"], e[ix, "Vertex 2"]); mean(paste(e[ix, "Vertex 2"], e[ix, "Vertex 1"]) %in% s) })
two <- names(tw)[tw >= 0.95]
if (directed && length(two)) { m <- e[e$Relationship %in% two, ]; m[, c("Vertex 1", "Vertex 2")] <- m[, c("Vertex 2", "Vertex 1")]; m[["Edge Weight"]] <- NA; e <- rbind(e, m) }
key <- if (directed) paste(e[["Vertex 1"]], e[["Vertex 2"]], sep = "\r") else apply(e[, c("Vertex 1", "Vertex 2")], 1, function(x) paste(sort(x), collapse = "\r"))
w <- suppressWarnings(as.numeric(e[["Edge Weight"]]))
agg <- tapply(w, key, function(x) if (all(is.na(x))) 1 else sum(x, na.rm = TRUE))
ids <- as.character(v$Vertex); n <- length(ids)
pr <- do.call(rbind, strsplit(names(agg), "\r", fixed = TRUE))
el <- data.frame(from = pr[, 1], to = pr[, 2], weight = as.numeric(agg), stringsAsFactors = FALSE)
ce <- read.csv(file.path(dir, paste0(tag, "-edges.csv")), stringsAsFactors = FALSE)
same <- function(df) if (directed) sort(paste(df$from, df$to, df$weight)) else sort(apply(df, 1, function(x) paste(c(sort(x[1:2]), as.numeric(x[3])), collapse = " ")))
say(tag, ": ", n, " nodes; R builds ", nrow(el), " ties from the raw files, the calculator ", nrow(ce), if (identical(same(el), same(ce))) " — identical tie lists and strengths" else " — TIE LISTS DIFFER")

# ---------- 2. whole network and people: sna / igraph vs calculator
idx <- function(x) match(x, ids)
Y <- matrix(0, n, n); Y[cbind(idx(el$from), idx(el$to))] <- 1; if (!directed) Y[cbind(idx(el$to), idx(el$from))] <- 1
Wm <- matrix(0, n, n); Wm[cbind(idx(el$from), idx(el$to))] <- el$weight; if (!directed) Wm[cbind(idx(el$to), idx(el$from))] <- el$weight
net <- network(Y, directed = directed); g <- graph_from_adjacency_matrix(Wm, mode = if (directed) "directed" else "undirected", weighted = TRUE)
gu <- as.undirected(g, mode = "collapse", edge.attr.comb = list(weight = "sum"))
S <- read.csv(file.path(dir, paste0(tag, "-summary.csv")), stringsAsFactors = FALSE); sv <- setNames(suppressWarnings(as.numeric(S$value)), S$metric)
N <- read.csv(file.path(dir, paste0(tag, "-nodes.csv")), stringsAsFactors = FALSE); N <- N[match(ids, N$id), ]
A <- read.csv(file.path(dir, paste0(tag, "-attrs.csv")), stringsAsFactors = FALSE, colClasses = "character"); A <- A[match(ids, A$id), ]
gm <- if (directed) "digraph" else "graph"
say("-- whole network")
chk("density (gden)", gden(net, mode = gm), sv["density"])
if (directed) chk("reciprocity (grecip edgewise)", grecip(net, measure = "edgewise"), sv["reciprocity"])
chk("clustering (igraph global, undirected)", transitivity(gu, type = "global"), sv["transitivity"])
comp <- components(g, mode = "weak")
chk("pieces with ties", sum(comp$csize > 1), sv["components"]); chk("isolates", sum(comp$csize == 1), sv["isolates"])
chk("average distance (reachable pairs)", mean_distance(g, directed = directed, unconnected = TRUE, weights = NA), sv["avgDist"])
chk("diameter", diameter(g, directed = directed, unconnected = TRUE, weights = NA), sv["diameter"])
chk("centralization (in-degree, sna)", sna::centralization(net, sna::degree, mode = gm, cmode = if (directed) "indegree" else "freeman"), sv["centralization"])
if (directed) { tc <- sna::triad.census(net); chk("triad census (16 types)", as.numeric(tc), as.numeric(sv[paste0("triad_", colnames(tc))])) }
memb <- N$louvain + 1
chk("modularity of the calculator's groups", modularity(gu, memb, weights = E(gu)$weight), sv["louvainQ"])
ql <- max(sapply(1:20, function(k) { set.seed(k); modularity(cluster_louvain(gu, weights = E(gu)$weight)) }))
say(sprintf("%-34s R best of 20 Louvain runs Q = %.4f · calculator Q = %.4f %s", "Louvain modularity", ql, sv["louvainQ"], if (sv["louvainQ"] >= ql - 0.01) "OK" else "LOWER"))
at <- A[[attr]]; ok <- !is.na(at) & at != "NA"
chk(paste0("assortativity (", attr, ")"), assortativity_nominal(induced_subgraph(g, which(ok)), as.integer(factor(at[ok])), directed = directed), sv[paste0("assort_", attr)])
ys <- if (directed) Y else Y; arcs <- which(Y == 1, arr.ind = TRUE); if (!directed) arcs <- arcs[arcs[, 1] < arcs[, 2], , drop = FALSE]
okA <- ok[arcs[, 1]] & ok[arcs[, 2]]; chk(paste0("share of ties within ", attr), mean(at[arcs[okA, 1]] == at[arcs[okA, 2]]), sv[paste0("within_", attr)])
cg <- if (directed) graph_from_adjacency_matrix(Y * t(Y), mode = "undirected") else gu
mc <- max_cliques(cg, min = 3); chk("cliques of 3+ (maximal)", length(mc), sv["cliques3"]); chk("largest clique", max(c(0, lengths(mc))), sv["maxClique"])
say("-- people")
if (directed) { chk("in-degree (sna)", sna::degree(net, cmode = "indegree"), N$indegree); chk("out-degree (sna)", sna::degree(net, cmode = "outdegree"), N$outdegree) } else chk("degree (sna)", sna::degree(net, gmode = "graph") / 2, N$degree)
chk("betweenness (sna)", sna::betweenness(net, gmode = gm), N$betweenness, 1e-6)
chk("closeness (sna)", sna::closeness(net, gmode = gm), N$closeness, 1e-6)
chk("harmonic closeness (igraph)", harmonic_centrality(g, mode = "out", weights = NA, normalized = TRUE), N$harmonic, 1e-6)
ev <- abs(sna::evcent(net, gmode = gm)); chk("eigenvector (sna, max = 1)", ev / max(ev), N$eigenvector, 1e-4)
chk("PageRank (igraph)", page_rank(g, damping = 0.85, directed = directed, weights = NA)$vector, N$pagerank, 1e-4)
chk("Burt constraint (igraph, weighted)", constraint(g, weights = E(g)$weight), N$constraint, 1e-6)
chk("k-core (igraph)", coreness(gu), N$core)
chk("local clustering (igraph)", transitivity(gu, type = "local", isolates = "NaN"), N$clustering, 1e-9)
es <- sapply(seq_len(n), function(i) { nb <- which(Y[i, ] + Y[, i] > 0); k <- length(nb); if (!k) return(NA); t <- sum((Y + t(Y))[nb, nb] > 0) / 2; k - 2 * t / k })
chk("effective size (Borgatti)", es, N$effsize, 1e-9)
D <- distances(g, mode = "out", weights = 1 / E(g)$weight)
cn <- sapply(seq_len(n), function(t) { d <- D[-t, t]; if (all(is.finite(d))) (n - 1) / sum(d) else sum(1 / d[is.finite(d) & d > 0]) / (n - 1) })
chk("connectedness (Fowler, 1/strength)", cn, N$connectedness, 1e-6)
if (directed) { br <- sna::brokerage(net, as.character(A[[attr]]))$raw.nli; for (r in list(c("w_I", "coordinator"), c("w_O", "consultant"), c("b_IO", "representative"), c("b_OI", "gatekeeper"), c("b_O", "liaison"))) chk(paste0("brokerage ", r[2], " (sna)"), br[, r[1]], N[[paste0("br_", r[2])]]) }

# ---------- 3. network model: observed statistics, MPLE with glm, and an R simulation at the calculator's estimates
M <- read.csv(file.path(dir, paste0(tag, "-ergm.csv")), stringsAsFactors = FALSE)
alpha <- 0.5; ea <- exp(alpha); r <- 1 - exp(-alpha)
num <- function(nm) suppressWarnings(as.numeric(A[[nm]]))
stats_full <- function(y, terms) sapply(terms, function(t) { p <- strsplit(t, ":")[[1]]; ty <- p[1]; nm <- p[2]
  half <- if (directed) 1 else 0.5
  switch(ty, edges = sum(y) * half, mutual = sum(y * t(y)) / 2,
    gwesp = { L <- y %*% y; ix <- which(y == 1); if (!directed) ix <- which(y == 1 & upper.tri(y)); sum(ea * (1 - r^L[ix])) },
    gwideg = ea * sum(1 - r^colSums(y)), gwodeg = ea * sum(1 - r^rowSums(y)), gwdeg = ea * sum(1 - r^rowSums(y)),
    nodematch = { x <- A[[nm]]; sum(y * outer(x, x, "==")) * half },
    nodeocov = sum(rowSums(y) * num(nm)), nodeicov = sum(colSums(y) * num(nm)), nodecov = sum(rowSums(y) * num(nm)),
    absdiff = sum(y * abs(outer(num(nm), num(nm), "-"))) * half) })
prep <- function(terms) lapply(terms, function(t) { p <- strsplit(t, ":")[[1]]; list(ty = p[1], x = if (length(p) > 1) { if (p[1] == "nodematch") A[[p[2]]] else num(p[2]) }) })
change <- function(y, i, j, T) { # change statistics for adding the absent tie i -> j (or i -- j)
  Li <- NULL; vapply(T, function(t) switch(t$ty, edges = 1, mutual = y[j, i],
    gwesp = { if (is.null(Li)) Li <<- as.vector(y[i, ] %*% y)
      if (directed) { Lc <- as.vector(y %*% y[, j]); ea * (1 - r^Li[j]) + sum(r^Li[y[i, ] == 1 & y[j, ] == 1]) + sum(r^Lc[y[, j] == 1 & y[, i] == 1]) }
      else { Lj <- as.vector(y[j, ] %*% y); cm <- y[i, ] == 1 & y[j, ] == 1; ea * (1 - r^Li[j]) + sum(r^Li[cm] + r^Lj[cm]) } },
    gwideg = r^sum(y[, j]), gwodeg = r^sum(y[i, ]), gwdeg = r^sum(y[i, ]) + r^sum(y[j, ]),
    nodematch = as.numeric(t$x[i] == t$x[j]), nodeocov = t$x[i], nodeicov = t$x[j], nodecov = t$x[i] + t$x[j], absdiff = abs(t$x[i] - t$x[j])), 0) }
for (mod in unique(M$model)) {
  mm <- M[M$model == mod, ]; if (mm$term[1] == "ERROR") { say("-- model ", mod, ": calculator error ", mm$rterm[1]); next }
  terms <- mm$rterm; T <- prep(terms); p <- length(terms)
  say("-- network model ", mod, ": ", paste(terms, collapse = " + "))
  gobs <- stats_full(Y, terms); chk("observed statistics", gobs, mm$gobs, 1e-8)
  # MPLE: logistic regression of every pair on its change statistics
  pairs <- if (directed) which(row(Y) != col(Y), arr.ind = TRUE) else which(upper.tri(Y), arr.ind = TRUE)
  X <- t(apply(pairs, 1, function(ij) { i <- ij[1]; j <- ij[2]; y <- Y; y[i, j] <- 0; if (!directed) y[j, i] <- 0; change(y, i, j, T) })); if (p == 1) X <- matrix(X, ncol = 1)
  fit <- suppressWarnings(glm(Y[pairs] ~ X - 1, family = binomial)); bm <- coef(fit)
  chk("MPLE (glm on change statistics)", bm, mm$mple, 1e-4)
  dep <- any(terms %in% c("mutual", "gwesp", "gwideg", "gwodeg", "gwdeg"))
  if (!dep) { se <- sqrt(diag(vcov(fit))); chk("MCMC estimate = exact MLE (glm)", bm, mm$mcmc, 0.02); say(sprintf("%-34s R %s · calc %s", "standard errors", paste(round(se, 3), collapse = " "), paste(round(mm$mcmc_se, 3), collapse = " "))) }
  # R's own tie / no-tie Metropolis–Hastings simulation at the calculator's estimate
  th <- mm$mcmc; y <- Y; g <- gobs; D <- nrow(pairs); E0 <- which(if (directed) y == 1 else (y == 1 & upper.tri(y)))
  pos <- integer(n * n); pos[E0] <- seq_along(E0); ed <- E0; ne <- length(ed)
  interval <- if (length(a) >= 9) as.integer(a[9]) else max(500, round(1.5 * ne)); burn <- 20 * interval; out_s <- matrix(NA_real_, nsim, p)
  step <- function() {
    if (ne > 0 && runif(1) < 0.5) { k <- ed[sample.int(ne, 1)]; i <- (k - 1) %% n + 1; j <- (k - 1) %/% n + 1 } else { k <- sample.int(D, 1); i <- pairs[k, 1]; j <- pairs[k, 2] }
    lin <- (j - 1) * n + i
    if (y[i, j] == 1) { y[i, j] <<- 0; if (!directed) y[j, i] <<- 0; d <- change(y, i, j, T); lr <- -sum(th * d) + log((0.5 / D) / (0.5 / ne + 0.5 / D))
      if (log(runif(1)) < lr) { g <<- g - d; pp <- pos[lin]; last <- ed[ne]; ed[pp] <<- last; pos[last] <<- pp; pos[lin] <<- 0L; ed <<- ed[-ne]; ne <<- ne - 1 } else { y[i, j] <<- 1; if (!directed) y[j, i] <<- 1 } }
    else { d <- change(y, i, j, T); lr <- sum(th * d) + log((0.5 / (ne + 1) + 0.5 / D) / (0.5 / D))
      if (log(runif(1)) < lr) { y[i, j] <<- 1; if (!directed) y[j, i] <<- 1; g <<- g + d; ne <<- ne + 1; ed[ne] <<- lin; pos[lin] <<- ne } } }
  t0 <- Sys.time(); for (s in seq_len(burn)) step()
  for (k in seq_len(nsim)) { for (s in seq_len(interval)) step(); out_s[k, ] <- g }
  if (!isTRUE(all.equal(as.numeric(g), as.numeric(stats_full(y, terms))))) say("   R sampler bookkeeping check FAILED")
  mu <- colMeans(out_s); sdv <- apply(out_s, 2, sd); tr <- (mu - gobs) / sdv
  bm2 <- sapply(seq_len(p), function(c) { b <- split(out_s[, c], ceiling(seq_len(nsim) / (nsim / 20))); sd(sapply(b, mean)) / sqrt(20) })
  se_r <- tryCatch(sqrt(diag(solve(cov(out_s)))), error = function(e) rep(NA, p))
  say(sprintf("   R simulation at the calculator's estimate: %d networks, %d steps apart (%.0f s)", nsim, interval, as.numeric(difftime(Sys.time(), t0, units = "secs"))))
  for (c in seq_len(p)) say(sprintf("   %-40s observed %10.3f  R mean %10.3f  t = %6.3f  (MC error %.3f sd)  SE calc %.4f  R %.4f %s", terms[c], gobs[c], mu[c], tr[c], bm2[c] / sdv[c], mm$mcmc_se[c], se_r[c], if (abs(tr[c]) <= max(0.15, 2.5 * bm2[c] / sdv[c])) "OK" else "CHECK"))
}
writeLines(out, file.path(dir, paste0(tag, "-R-report.txt")))
