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
