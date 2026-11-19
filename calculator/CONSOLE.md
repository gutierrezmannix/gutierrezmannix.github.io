# Console — builds 2026-11-18.103–.104

The console has its own page, laid out like Stata's main window.

| Part | What it does |
|---|---|
| **Console** button (top bar, after Data) · Ctrl+K | opens the page; Esc or **← Back to …** returns to the page underneath, which stays as it was |
| Review (left) | every command so far, numbered; click puts it back in the command line, double-click runs it again. Blue lines came from buttons on the page, red ones were errors |
| Results (middle) | oldest first, the whole session, as in Stata. Typed commands echo exactly as typed (`. tab sexo`), followed by Stata's output; errors in red under the command. Tables longer than 400 lines are cut on screen only |
| Variables (right) | filter, click a name to type it at the cursor |
| Command line (bottom) | Enter runs, ↑ ↓ earlier commands, Tab completes a variable or command name; **Commands ▾** fills in a template; **Do-file** runs several lines in order (`*` and `//` comments, `///` continues a line) |
| Header | Stata / R, **Record what I run** (default) or **Also what I open**, Copy, Save log (.log), Save do-file (.do), Clear (like `cls`) |

**Printing rules.** The console records actions, not views. A typed command prints once. A button that runs
something (the regression's Run, Tests ▾ Run, a data edit, Time series, SEM …) prints its command once, marked
`* from the page`. Looking at a variable or switching tabs prints nothing; **› Print in console** above each page
prints what is on screen, once. **Also what I open** brings back the old behaviour of printing every view.

**As in Stata (build .103).**
- `summarize v` prints the one-line table (`, detail` the long one); `tabulate v` prints in the console; `, missing` adds the `.` row.
- A weight typed on a command (`[aw=w]`) applies to that command only, like `if`.
- `describe v1 v2` lists only those variables, in Stata 17's layout (storage type, display format, value label).
- `tostring x, gen(x_s)` makes a new text variable and keeps `x`.
- Conditions understand `missing(x)`, `!missing(x)`, `inlist(x, 1, 2)` and `inrange(x, a, b)`; `generate … if !missing(x)` too.

The side pane keeps Plots, Report and Help. Source: `src/console-page.js`, `src/console-page.css`,
`tools/console_page.py`; tests in `tests/console-stata.test.mjs`.

## Page functions print their Stata command (build .104)

| Page | Prints | When |
|---|---|---|
| Charts (chart builder) | `graph hbar` / `graph dot` / `graph pie` / `histogram` / `kdensity` / `graph box` / `twoway` / `graph matrix`; timelines as `preserve` · `collapse` · `twoway line` / `xtline` · `restore`; means and proportions as `regress` · `margins` · `marginsplot`; survival as `stset` · `sts graph`. Charts without an official command name the user-written one (`hexplot`, `heatplot`, `vioplot`, `coefplot`, `spmap`) | **› Print in console** under the chart, next to the download buttons |
| Break down by groups | its `table …, statistic()` / `tabstat` command and the table | **› Print in console** next to Copy table |
| Predict | `splitsample`, `logit`, `lasso logit`, `rforest`, `predict`, `roctab` (R: rsample, glmnet, ranger …) | when a run finishes |
| Compare means, regression plots | their command and table | **› Print in console** (was "Add to console") |
| Settings | a comment when the page weight changes, `svyset`, `mvdecode _all, mv(…)`, `set level` | once, when changed (not when a typed command changed it) |
| Univariate, Bivariate, Correlation, t-tests, legacy plots | the page's command and output | **› Print in console** above the page |
| Regression, Tests ▾, Time series, SEM, data edits | as before | Run / Fit / Apply |

Text analysis and network models have no Stata equivalent; they keep their R code.

## Typed commands that run on the Tests engine (build .105)

These commands fill their Tests ▾ page and run it on the built-in engine (validated against R). The console prints the
result once, under the Stata command that reproduces it; where the engine always uses an option (Efron ties,
clustered panel errors, the Laplace approximation), that option is in the printed command and a `note:` says so.

| Typed | Runs | Notes |
|---|---|---|
| `ranksum y, by(g)` · `kwallis y, by(g)` · `signrank a = b` | Mann–Whitney · Kruskal–Wallis · signed-rank | |
| `prtest y == p` · `prtest y, by(g)` · `prtesti` · `bitest y == p` · `bitesti` | one / two proportions, exact binomial | `prtesti` takes proportions or `, count` |
| `tab a b, exact` · `mcc case control` | Fisher's exact · exact McNemar | |
| `anova y a b` · `anova y a##b` · `anova y g c.x` | factorial ANOVA · ANCOVA | partial (type III) sums of squares, as Stata |
| `pwmean y, over(g) mcompare(tukey\|dunnett\|bonferroni\|noadjust)` | pairwise comparisons | |
| `mlogit` · `probit` · `nbreg` · `qreg …, quantile(.25)` | the models (`i.x`, `c.x` work) | |
| `mixed y x \|\| id: [z]` · `melogit` · `mepoisson` · `menbreg` | multilevel models | `mixed` is ML unless `, reml`; slopes use `covariance(unstructured)` |
| `xtset id t` then `xtreg y x, fe` / `re` | panel models | errors clustered by id |
| `stset t, failure(d)` then `sts list` · `sts graph, by(g)` · `sts test g` · `stcox` · `streg …, distribution()` | survival | `stset` prints Stata's summary; the event must be 0/1 |
| `pca` · `factor …, factors(k) [ml\|ipf]` · `rotate, varimax\|promax\|oblimin oblique` | PCA, factor analysis | |
| `misstable summarize` · `duplicates report` · `cluster kmeans …, k(3)` | missing values, duplicates (Stata's table), k-means | |
| `lasso linear\|logit` · `elasticnet …, alpha()` | penalized regression | 80/20 split, shown in the command |
| `bootstrap r(mean), reps(#) seed(#): summarize y` | bootstrap | `r(p50)` needs `, detail` |
| `svyset …` then `svy: mean` · `svy: total` · `svy: proportion` · `svy: tabulate a b` | design-based estimates, Rao–Scott F | |

An `if` on these commands applies to that command only. Weights are refused except under `svy:`; after `svyset`, the
other commands run unweighted, as in Stata, with a note.

## Macros, loops, prefixes and more commands (build .106)

**Programming.** `local`, `global` and `scalar` (with `=` they evaluate); `` `name' `` and `$name` expand in any later
command; `macro list`, `scalar list`, `… drop`. `display` takes text, expressions, `%9.2f`-style formats, `_n`,
`_col()`, `r()` after `summarize` (and `ci`, `spearman`, `sdtest`, `swilk`), `_rc`, `_N`, and Stata's functions
`normal()`, `invnormal()`, `ttail()`, `invttail()`, `chi2tail()`, `Ftail()`, `round()`, `max()`, `ln()` … `return list`
prints the stored results.

**Loops.** `foreach v of varlist|local|global|numlist …`, `foreach x in …` and `forvalues i = 1/5` (or `1(2)9`), typed
line by line (the prompt counts the lines, as Stata's `2.`, and the command line says it is inside a loop) or in the
do-file box; nested loops work; 600 commands at most. Esc cancels an open loop (build .107); a do-file that ends before
the loop's `}` reports it instead of waiting.

**Prefixes.** `quietly` (no output; errors still show), `capture` (no output, no error; sets `_rc`), `noisily`,
`by` / `bysort varlist:` (the command once per group, under `-> g = value`; with `egen` it becomes `, by()`).
Inline comments (`//`, `/* */`) are dropped. `set more off`, `version`, `log using` and similar are accepted and change
nothing; `clear` is refused (it would remove the data).

| Typed | Prints |
|---|---|
| `lookfor word` · `ds [, has(type string)]` · `levelsof x [, local(name)]` · `isid id` · `label list [x]` | as Stata (levelsof stores the local) |
| `table a` · `table a b` | Stata 17's frequency table with totals |
| `proportion x` | proportions, SEs and the logit interval with t(n − 1), as Stata |
| `ci means x` · `ci proportions x [, wald wilson agresti jeffreys]` · `cii means` / `cii proportions` | exact (Clopper–Pearson) by default, as Stata |
| `spearman a b` · `sdtest y, by(g)` / `sdtest y == #` / `sdtest a == b` · `swilk x` | rho and its t test; the variance-ratio F (or chi2) test; Shapiro–Wilk W, V, z (Royston) |
| `egen new = fcn(), by()` | mean sd sum total min max median count pctile iqr std rank group tag rowmean rowtotal rowmin rowmax rowmiss rownonmiss rowsd |
| `encode s, gen(n)` · `decode n, gen(s)` · `xtile q = x, nq(4)` | new variables (encode labels its codes; xtile uses Stata's percentile definition) |
| `preserve` · `restore` | undo keep / drop / the subgroup since `preserve` (the data are filtered, never deleted) |
| `kdensity x` · `graph pie, over(x)` | the chart, logged once |

`sort`, `gsort`, `order`, `format` and `compress` are accepted with a note (they change no result here). `collapse`,
`reshape`, `merge` and `append` point to the pages that do them. Values were checked against R (`cor.test`,
`var.test`, `shapiro.test`, `binom.test`, `prop.test`, `t.test`) in `tests/console-more.test.mjs`.

## Fixes (build .109)

- `generate x = ""` (and `generate str10 x = ""`) creates an empty text variable, as in Stata; before, it was refused
  with "type the starting text" and nothing was created.
- A dataset with no visible variables shows its Data Editor message on its own (it was drawn over twenty blank rows and
  half hidden under the row numbers), with the two commands that make a variable. The build now refreshes the Data
  Editor block from `src/browse-scroll.js`.

## Observations as in Stata (build .110)

- **A new dataset has 0 observations**, as `clear` leaves Stata. `generate` works on it (empty variables), and commands
  that need data answer `no observations` (Stata's r(2000)) instead of printing empty tables.
- **`set obs N`** adds observations (missing values, empty text) and prints `Number of observations (_N) was 0, now N.`;
  it cannot reduce the count (as in Stata — use `keep if`). Limit: 4 million cells in the browser.
- **The Data Editor shows one row after the last observation**, as Stata's Data Editor: a value typed there adds exactly
  one observation, and Enter / Tab move on to the next new row. It replaces the old behaviour of adding ten blank rows
  whenever the last row was edited (those blank rows counted as observations). The new row is not shown while a
  subgroup or filter narrows the rows.
- Creating a new dataset closes the console page, so its first step (Make a new variable) is on screen.

## Audit fixes (build .111)

A final audit ran about 140 commands from every family through the console (each printed once, no
`undefined`/`NaN` leaks, an R version for each, no page errors), saved the session as a do-file and ran it again on a
fresh page. It found and fixed:

- **Save do-file and Review hold what you typed**, as Stata's. Before, they held what each command ran: `regress y x i.g`
  was saved as `encode g, generate(g_c)` + `regress y x i.g_c` (which failed when run again), engine commands repeated
  their `xtset` / `stset` / `svyset` lines, `lasso` expanded into setup lines that create variables, and
  `keep if y > 0` became a two-condition line. A loop is saved as typed (not with the `2.` line numbers), and the
  commands a loop or `by` ran are shown in Results but are not in Review or the do-file (re-running would repeat them).
  Results still print the command that reproduces each result. A command that opens a page (`regress`) is waited for
  before the next do-file line runs.
- **`ranksum`, `signrank`, `kwallis`, `prtest` and `bitest` are computed and printed as Stata does.** They went to the
  Tests engine, which follows R: its Wilcoxon tests carry a continuity correction, so p-values differed slightly from
  Stata's. Checked against Stata's manual examples (fuel data: `signrank` z = −1.973, p = .0485; `ranksum` z = −1.279,
  p = .2010) and against R (`wilcox.test(correct = FALSE)`, `kruskal.test`, `prop.test(correct = FALSE)`, `binom.test`).
- **A weight from a typed `svyset` applies to `svy:` commands only**, as in Stata; `summarize`, `regress`, `ttest`, R
  calls … run unweighted after it (they were weighted, and `ttest` refused). A weight chosen in Settings still applies
  to every analysis and shows in the printed command (`[aw=w]`).
- `count` prints the number as Stata does (and stores `r(N)`); `preserve`, `restore`, `sort`, `order`, `format`,
  `compress` and `notes` printed their command twice; `cii` and `return list` had no R line.
- **Post-estimation works on the last model**, as in Stata: after `regress y x [pw=w]` or `regress y x if …`, the
  weight and `if` stay in force for `estat`, `margins`, `predict`, `test` … (before, `estat vif` answered "Run a
  regression first"). `estat vif` prints Stata's VIF table and `margins` prints Stata's "Predictive margins" table
  (delta-method standard errors; `_at` rows for a continuous variable) once the Regression page has computed it.
- Engine tables print long numbers to 6 significant digits (the `svy: tabulate` degrees of freedom showed 15 digits).

Kept on purpose: value labels you define are remembered by variable name and come back when a file with that variable
is opened (a calculator convenience Stata does not have).

## Graphs open ready, and building data from scratch (build .112)

- **A typed graph command takes you to the drawn graph**, as Stata opens its Graph window: `histogram`, `kdensity`,
  `graph box`, `graph bar` / `hbar`, `graph pie`, `scatter`, `twoway`, `line` … close the console page and show the
  chart with its variables already chosen (before, the Charts page opened asking for them). The command and its
  Stata line stay in the console; **Ctrl+K** (or Console) returns to it. A do-file shows its last graph when it
  finishes; other commands stay in the console. "View the graph →" in the console opens the chart the same way.
- A graph of variables with no values answers `no observations`, as Stata (it drew an empty chart).
- `set obs N` notes that the new observations are missing on every variable.
- `generate` / `replace` understand `_n` (observation number), `_N`, `in 1/100` (also `in f/l`, `in -10/l`), and
  Stata's random-number functions `runiform()`, `runiform(a, b)`, `rnormal()`, `rnormal(m, s)`, `runiformint(a, b)`,
  `rbinomial(n, p)`, `rpoisson(m)`, `rexponential(b)`, `rchi2(df)`, `rt(df)`; `set seed` makes them repeatable (the
  draws are not Stata's — its generator differs — but their distribution is).

Tested on the ENVIPE 2011–2026 sample (14,035 adults × 904 variables): every graph type opens drawn, and the
session's tables, models, `margins`, survey estimates and data steps print in the console.

## Audit on the ENVIPE 2011–2026 sample (build .113)

92 commands from every family ran on the ENVIPE sample (14,035 adults × 904 variables): each printed once, every
entry has its R line, no page errors; results appear 35–150 ms after Enter. 44 numbers were checked against R on the
same file (summarize, weighted summarize and mean, tab, chi2, t test, regress, logit, ranksum, correlation,
`svy: mean` with the PSU design, proportion, oneway, exact CI, kwallis, spearman, egen, count) — all match. The saved
do-file, run again on a fresh page, reproduced every output. Every graph type opened drawn. Fixed:

- **Graph options reach the chart**: `histogram …, bin(#) percent` (or `frequency`), `graph bar|hbar (mean|sum|count|percent) y, over(g)`
  (Stata's default with a variable is the mean, without one the percentage). The Results line names the chart as
  drawn (`histogram edad, frequency` — the chart shows counts; Stata's default is density, same shape); a repeated
  graph command with different options redraws. `histogram …, by()` notes that separate panels are not drawn.
- **Stata's extended missing values** (`.a` … `.z`, e.g. ENVIPE's `.d` "No sabe / no responde", `.r` "No responde")
  get their own rows in `tab …, missing`, with their labels, as Stata lists them; `codebook` and `label list` show them
  as `.d` / `.r` instead of the long integer they are stored under.
