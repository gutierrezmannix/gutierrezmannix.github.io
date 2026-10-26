# Predictive family (kmeans, hierarchical, ridge, lasso, elastic, tree) — validation notes

Validated against R 4.3.3 with glmnet 4.1-8 and rpart 4.1.23: `tools/engine/cases/predictive.mjs` has 71 cases,
and all 71 pass `compare.mjs` at the default tolerance (rel 1e-6). 70 of the 71 also pass at rel 1e-11.

## What is ported (and from where)
- `lib/predictive-cluster.mjs`: this is `kmns.f` (AS 136 Hartigan–Wong) line for line, including the REAL
  constant `BIG = 1.E30`, the Quick-TRANSfer step limit and R's `kmeans()` wrapper: `unique(x)` rows,
  `sample.int` starts for nstart = 25, keeping the first best start, and the warnings. It also ports
  `hclust.f` with `hcass2` for all 8 methods and `pmatch` method names, the `cutree` C code, `dist()` and
  `scale()`.
- `lib/predictive-glmnet.mjs`: this follows the glmnetpp C++ code that glmnet 4.1-8 actually runs. It covers the
  gaussian covariance path solver (warm partial passes, the active-set covariance cache) and the two-class
  logistic IRLS path (strong rules plus KKT checks). It also has the lambda sequence (`lambda.min.ratio`
  rules, first-lambda `fix.lam`), the stopping rules (`fdev = 1e-5`, `devmax = 0.999`, `mnlam = 5`) and
  `lambda.interp`. For `cv.glmnet` it ports fold ids from `sample(rep(seq(nfolds), length = N))`,
  `buildPredmat` with lambda alignment, `cvcompute`/`cvstats` (including the grouped=FALSE fallback and its
  warning) and `getOptcv`.
- `lib/predictive-rpart.mjs`: this ports `rpart.c`/`partition.c`/`bsplit.c`, the `anova` and `gini` splitting
  functions, `mysort` (its unstable quicksort, so tie order is the same as R), `graycode`, `insert_split`
  (the order of competitors and surrogates), `surrogate`/`choose_surg`, `nodesplit`, `make_cp_list`,
  `make_cp_table`, the cross-validation loop (`xval`, `rundown`, `branch`, `fix_cp`, with groups from
  `sample(rep(1:xval, length.out = n), n)`), and `pred_rpart` for holdout predictions (surrogates, then the
  child with more observations; a tie stays at the internal node).

## Deviations
- **The glmnet coordinate descent is not bit-identical.** The C++ uses Eigen vectorised dot products, which add
  the terms in a different order from the sequential loops here. Both solvers stop at the same convergence
  thresholds, so the results agree to ≈1e-14 in almost every case. The largest difference seen is 1.5e-9
  relative, in `ridge_binomial_small_folds` (logistic IRLS with 3 observations per fold). This is within the
  1e-5 target, and no case needed a loosened tolerance.
- **R's long-double sums are emulated with an exactly rounded sum** (`fsum`). This is used for `colMeans`,
  `sum()` in `scale()`, k-means `totss`, and the per-start `sum(wss)` comparison. It keeps the choice of the
  best start (and therefore the cluster numbering) the same as R's even when two starts reach the same partition
  with the labels permuted. A double-rounding difference from x87 long double is theoretically possible, but none
  was seen.
- **Some output is not compared.** Plots (`Dendrogram`, `Training cross-validation`, `Decision tree`) are compared
  by title only and are drawn natively, so they are not R's base graphics. The tree diagnostics are a
  `print.rpart`-style listing, not R's exact formatting.
- **Some paths are not ported.** glmnet families other than gaussian/binomial: the R engine passes `family`
  through, but only these two exist in the UI. Factor-coded outcomes for ridge/lasso/elastic/tree are also not
  ported (numeric 0/1 is expected).

## Speed (Node, typical laptop)
2,000–3,000 rows: elastic net 60 ms, 10-fold binomial lasso 0.5 s, tree 80 ms, k-means (25 starts) 0.2 s, and
hclust on 3,000 rows 0.4 s.
