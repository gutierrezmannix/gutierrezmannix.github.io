# Univariate · Break down by groups — build 2026-10-31.49

Tests → Univariate descriptive analysis now has a **Break down by groups** panel under the
frequency table. It answers questions like Stata's

```stata
tab ss_dir if sexo == 2 & year == 2018
sum ss_dir if sexo == 1 & year == 2018
```

for every combination at once: pick **Rows** (e.g. `year`) and, optionally, **Columns** (e.g. `sexo`).

| Option | What each cell shows | Stata equivalent |
|---|---|---|
| % where v = … | share of the rows with the chosen category (e.g. ss_dir = Sí) | `table year sexo, statistic(mean _is)` |
| Count where v = … | how many (weighted total when a weight is set) | `statistic(total _is)` |
| Full tabulation | every category of v as row percentages, with N | `table year ss_dir sexo, statistic(percent, across(ss_dir))` |
| Mean · Sum · Std. dev. · Median · Min · Max | for numeric variables (a 0/1 variable's mean is its share) | `tabstat v, by(year)` / `table …, statistic(mean v)` |
| N (observations) · Population (weighted) | counts | `statistic(count v)` / `statistic(frequency)` |

- **Every value in the range** shows every year from the lowest to the highest (2000–2024) even when
  a year has no data (shown as —); the chart's lines run through those years.
- **Click any cell** for its full `tab v if year == 2018 & sexo == 2` table (Freq., Percent, Cum.)
  and the `summarize` line.
- **Weights** (Data → weight): % and means are weighted, counts and sums are weighted totals on the
  weight's own scale (population estimates with an expansion factor), N is always the number of
  observations; min, max and median are unweighted.
- The IF subgroup applies, rows with a missing value are left out and counted in the note, and the
  table copies to Excel; the chart downloads as PNG (150/300/600 dpi) or SVG; Stata and R code
  reproduce the table.

Source: `src/breakdown.js`, integrated by `tools/breakdown.py` (run through `tools/text_lab.py`).
Test: `node --test calculator/tests/breakdown.test.mjs`.
