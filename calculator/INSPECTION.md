# Inspection fixes — build 2026-11-01.55

An end-to-end inspection (every test suite, the page in a browser, results checked against SciPy / statsmodels,
a 300-row survey file and a V-Dem Stata file with 1,908 variables) found the statistics correct and the problems
below. All are fixed in this build.

## Console: commands do what Stata does

- **An `if` applies to that command only.** `summarize edad if sexo == "Mujer"` used to leave the condition on
  for every later command, so a following `regress ingreso edad` ran on women only (143 rows instead of 288) and
  `count if ingreso > 20000` returned 5 instead of 14. A typed `if` now shows on the page while that command runs
  and the next command puts back the Subgroup bar the user had. Conditions add up (`if x >= 2 & x <= 5` keeps
  both), and they combine with a Subgroup set with the mouse. The command line says "the if applies to this
  command only". Clicking an earlier line in the log restores that line's subgroup the same way.
- **Every variable and option is kept** (`src/console-stata.js`, printed in Stata's layout):
  - `summarize a b c` (all variables; with no varlist, every numeric variable), `summarize x, detail`
    (percentiles by Stata's rule, 4 smallest and largest, variance, skewness, kurtosis), `[aw=]` and `[fw=]`;
  - `mean` (standard errors and t intervals; `[pw=]`, `[fw=]`), `tabstat …, statistics(…)`;
  - `correlate` (rows complete on every variable, `(obs=N)`) and `pwcorr …, sig obs star()` with any number of
    variables (3+ variables used to open the scatter matrix and print nothing);
  - `tabulate y x` prints frequencies, as Stata does, and the options `row`, `column`, `cell`, `chi2`, `V`,
    `nofreq` (with Stata's key); it warns when expected counts are below 5. `tab1` and `tab2` take several
    variables. Repeating a command prints it again.
- **`ttest y, by(g)` is the pooled (equal-variance) test**, Stata's default, with the Combined row;
  `, unequal` gives Welch's test as before. R's `t.test(y ~ g, var.equal = TRUE)` runs too.
- **Numeric predictors typed without `i.` are continuous**, as in Stata and R. A value-labelled 0–4 scale used to
  be dummy-coded silently (`regress v2x_libdem v2elfrfair_ord`: 4 dummies, R² 0.63, instead of one slope, R² 0.56).
- **Factor variables use the first level as the base**: the lowest code (or the first name alphabetically for
  text, as `encode` numbers them), with levels in code order. The base used to be the most frequent category, so
  the exported `i.` commands gave different coefficients in Stata.

## Data

- **Missing-value codes**: auto-screen no longer treats a code-like value as missing when that would leave a
  single value. V-Dem's `v2ddspmpl` (plebiscite supermajority: 0 or 66) lost its 66.
- **`destring` follows Stata**: it refuses to turn text into missing values unless `force` is given (it used to
  wipe a column of `49,53` values), and supports `dpcomma`, `ignore("chars")` and `generate()`. Exported scripts
  use the same rules (`sub(",", ".", …)`, `gsub(…)`).
- **Semicolon files with decimal commas** (Excel in Spain, Brazil, Argentina, Colombia, Chile…) are read as numbers.
  `summarize` on a text column of numbers with commas says which `destring` reads it.
- **Scripts read the file the way the page did**: `import delimited …, delimiters(";") decimalseparator(,)` /
  `read.csv2`, `read.delim` for tab-separated files, `import excel …, firstrow` / `readxl::read_excel` for Excel.

## Results text

- Regression: "Significant predictors, largest standardized effect first" shows β next to b (the order was already
  by β; with only b shown, Year with b = 0.001 seemed to be ranked above b = −0.148).
- Publication tables keep two significant digits for small coefficients (`0.00078***` instead of `0.00***`).
- Charts under a regression say how many rows the model used ("All 562 rows · 515 used in the model").
- A variable with a single value is described as such, not as "a typical value … pulled by extreme values".

## Page

- **Half the size**: 4.3 MB instead of 9.2 MB. The Spanish, Portuguese, French and English lemma tables are
  embedded in a compact form (6.5 → 1.7 MB) and decode to exactly the same lookup
  (`tests/lemma-tables.test.mjs`); 8 duplicate font files are gone. Everything still works offline.
- Wide console output shows a shadow at the edge that scrolls (a table could look cut mid-number: 40 read as "4").
- Accessibility (axe, WCAG A/AA: no violations on the pages checked): page language, readable inactive Undo
  button, predictor chips with separate buttons, labelled table title, keyboard-focusable scrolling output,
  charts with interactive points marked as figures.

## Tests

`tests/console-stata.test.mjs` (reference values from SciPy / pandas), `tests/lemma-tables.test.mjs`,
`tests/build.test.mjs`; `tests/ttests.test.mjs` now expects `var.equal = TRUE` to run the pooled test.
