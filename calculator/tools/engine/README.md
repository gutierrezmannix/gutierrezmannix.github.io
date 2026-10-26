# Built-in statistical engine — developer notes

The Tests-menu analyses used to run in R inside the browser (webR), which downloads R and its packages from the
internet on first use. The built-in engine (`calculator/src/engine/`) reproduces the same results in JavaScript so
everything works offline and from a downloaded HTML file. **The R engine is the specification**:
`calculator/src/analysis-methods.R` (`gm_run(packet)`) defines, for every method id, the computations, the
validation messages, the tables (titles, column names, row order), notes, plots and the order of output. The JS
engine must return the same result object for the same packet.

## Layout

- `src/engine/index.mjs` — `gmRun(packet)`: builds the context, seeds R's RNG (`set.seed(seed)` as the R engine
  does at the top of `run()`), dispatches by id, catches errors (any thrown `GMError`/`Error` message becomes
  `result.error`; tables/plots/outputData are cleared on error exactly as in R), sorts tables (`Model summary`
  first, titles matching `Coefficients|coefficients` last, others in insertion order) and assembles the result.
- `src/engine/registry.mjs` — `register(ids, handler)`.
- `src/engine/lib/` — shared, validated library. **Do not change existing functions' behaviour**; add new files
  for new helpers. If you find a bug in a shared function, work around it in your module and report it.
  - `dist.mjs` — pnorm/qnorm, pt/qt, pchisq/qchisq, pf/qf, pbeta/qbeta, pgamma/qgamma, dbinom/pbinom, dhyper,
    dpois/ppois, dnbinomMu, pnt/qnt (noncentral t), pnbeta/pnf/pnchisq, ptukey/qtukey, lgamma/digamma/trigamma,
    `uniroot` (exact port of R's zeroin, default tol = eps^0.25), `padjust`, plogis/qlogis, pweibull. Checked
    against R to ~1e-12 (`node tools/engine/dist_check.mjs`).
  - `rng.mjs` — `RRNG`: R's Mersenne-Twister + set.seed scrambling + Rejection sampling + Inversion normals:
    `setSeed, unif, unifIndex, sampleInt(n,size,replace), sample(v,size,replace), sampleProb, norm, rnorm, runif,
    exp, gamma(shape,scale), chisq`. Bit-identical to R (`set.seed(1729); sample.int(10)` etc.).
  - `linalg.mjs` — row-array matrices: mul, t, crossprod, chol/cholSolve/cholInv, lu/solve/inv/det/logdet,
    ginvSym, `qrR` (port of R's LINPACK dqrdc2: same pivoting/aliasing as lm), qrQty/qrQy, `lsfit` (lm.fit-like,
    NaN for aliased coefficients), covUnscaled, chol2inv, backsolve, eigenSym (Jacobi, decreasing), svd.
  - `frame.mjs` — `Factor` (R levels: C-locale sort for text, numeric sort for numbers; codes 0-based, null = NA),
    `Frame` (columns by alias v1…), `context(packet)` with the R helper closures: `opt, num, need, fields, value,
    clean, group, numbers, countTable, rhs, note, warn, diag`, `modelMatrix`/`expandTerms` (treatment or sum
    contrasts, R column names such as `v3b`, `v2:v3b`, `v31`), `rNumber` (as.numeric), `rnum`/`fmtR` (R's
    15-significant-digit as.character).
  - `models.mjs` — `families` (gaussian, binomial(logit|probit), poisson; same linkinv clamps as R), `design`,
    `lm` (lm.fit + summary.lm + logLik/AIC/BIC), `anovaLm`, `glm` (glm.fit IRLS with step-halving and R's
    warnings), `predictLmInterval`, `bptest`, `vifText`, and **`fitout(ctx, model)`** — the R engine's `fitout()`
    (Coefficients with CI, Model summary, ANOVA + residual plots + diagnostics for lm, separation check for binomial
    glm, predictions table). A model passed to `fitout` provides: `kind` ('lm'|'glm'|other), `n`/`nobs`,
    `coefTable {rownames, columns, rows}` or null, `crit` ('t'|'z'), `dfResidual`, `converged`, `logLik`, `AIC`,
    `BIC`, optional `summaryText()` (array of lines for Diagnostics), optional `predictions(level)` → `{columns,
    rows, warning?}`, optional `mixedHook(ctx)`.
  - `stats.mjs` — rank (average ties), tieCounts, quantile7 (R type 7), median, `test(ctx, h)` (the R engine's
    `test()` for htest objects: Test / Estimates / Confidence interval tables + alternative note), `htestPrint`.
  - `plot.mjs` — `svgPlot({xlab, ylab, main, xlim, ylim, layers, legend})` (layers: points, line, step, polygon,
    hline, vline, abline, rect, segments, text), `pretty` (R's pretty), `histBreaks`/`histCounts` (hist()
    defaults), `qqData`.
  - `print.mjs` — fmtSig, fmtP, printCoefmat, htestText, printTable (R-like text for Diagnostics).
- `src/engine/methods/<family>.mjs` — method implementations. `basic.mjs` (done, 50/50 cases match R) is the
  reference example; `regression.mjs` has `probit` done.

## Context (ctx) inside a handler

`ctx.d` (Frame, decoded like R's `decode()`), `ctx.y, ctx.x, ctx.g, ctx.subject, ctx.time, ctx.variables`
(alias arrays), `ctx.opt(k, def)`, `ctx.num(k, def, {min,max,integer})` (same messages as R), `ctx.need(ok, msg)`,
`ctx.clean(vars?)`, `ctx.group(values, k?)`, `ctx.value(role)`, `ctx.fields(role)`, `ctx.alpha`, `ctx.level`,
`ctx.accent`, `ctx.rng` (already seeded with `num('seed',1729)`; call `ctx.rng.setSeed(seed)` wherever the R code
calls `set.seed` again), `ctx.used` (assign like R's `used<<-`), `ctx.table(title, columns, rows, totalRows?)`,
`ctx.plot(title, svg)`, `ctx.note(s)`, `ctx.warn(s)`, `ctx.diag(lines)`, `ctx.outputData = {names, rows}`.
Numbers that are NA/NaN/Inf become `null` in tables (as jsonlite does). `add(z, title, rn=TRUE)` in R becomes a
table whose first column is `Term` with the row names.

## Validation workflow (real R 4.3.3 and all packages are installed locally)

1. Write cases in `tools/engine/cases/<family>.mjs` exporting `cases()` → `[{ name, packet, compare? }]`, using
   `tools/engine/casekit.mjs` (`rng, packet, num, cat, normals, pick, withMissing, bern, poisson, round`).
   Cover normal use, options, edge cases and every validation message (error paths are compared too).
2. `node tools/engine/make_cases.mjs <family>` → writes `tests/engine/cases/<family>-<name>.packet.json`.
3. `LC_ALL=C.UTF-8 Rscript tools/engine/ref.R tests/engine/cases <family>-<name> …` → R reference outputs
   (`.expected.json`) from the real R engine. (No names = all cases; pass names to save time.)
4. `node tools/engine/compare.mjs <family>-` → table-by-table comparison (titles, columns, every cell with
   rel tol 1e-6 by default, row counts, notes, plots titles, analysis N, errors). Per-case `compare` options:
   `{ tol, abs, skipTables, skipRows, signFree, unordered, softNotes, skipCounts }` — use them only with a
   documented reason (e.g. sign of eigenvectors, Monte-Carlo p-values, optimizer tolerance).
5. Read R package sources when needed: `Rscript -e 'print(pkg::fun)'`, `Rscript -e 'print(getAnywhere("x"))'`,
   or `/usr/lib/R/site-library/<pkg>` and `/usr/lib/R/library/<pkg>`.

Record intentional deviations (anything that cannot match R exactly, e.g. Monte-Carlo procedures) in
`tools/engine/NOTES-<family>.md` with the reason and how it was validated.
