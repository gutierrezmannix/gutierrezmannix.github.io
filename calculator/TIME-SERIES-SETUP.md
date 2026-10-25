# Time series setup, console output and the Output view — build 2026-10-25.28

## Tests → Time series pages (STL, naïve, drift, ETS, ARIMA, SARIMA, regression, ARDL, VAR, VECM, breaks, counts)

Each page now starts like Stata's `tsset`, then asks only for the model:

1. **Time variable** — numbers (years, integer periods, or Stata date codes when "Read time as" says so) or
   text dates: `2014-01-01`, `2014-01`, `2014m1`, `2014q3`, `Nov 1, 2011`, `01nov2011`, `11/01/2011`
   (month/day or day/month; ambiguous orders are reported and can be set) and Spanish month names. Dates on the
   first or last day of each month/quarter/year are read as monthly/quarterly/annual periods; weekday-only daily
   data are read as trading days. A tsset-style summary shows the range, delta and panel.
2. **Panel variable (optional)** — when periods repeat, the page names the column that identifies the units
   (e.g. `ent`, 32 units). With a panel, choose one unit or combine all units (average or sum per period).
   Repeats without a panel stop the run until a panel variable or an explicit average/sum is chosen. Combining
   skips missing values (like `collapse`); a period is missing only when all its rows are.
3. **Model** — plain controls. ARIMA: "Choose automatically (lowest AICc)" or "Set the order myself" (p, d, q,
   and P, D, Q on the seasonal page). Regression with ARIMA errors takes future predictor values in a table
   labelled by period.
4. **Forecast** — periods ahead in the series' units; the rolling accuracy check, its first window and the
   seasonal cycle are under "More options".

The series is built and checked in the browser before R starts (repeats, gaps, missing values, unreadable
dates), and R receives one regular row per period: decimal years for months/quarters, years for annual data,
positions otherwise. Forecast and decomposition tables come back labelled as dates (2024m1, 2011q3, 3 Nov 2011).
Gaps are never filled and repeats are never combined without an explicit choice.

## Time series tab (trends / interrupted time series)

The time variable may be text dates (read into the same Stata period codes); the frequency is detected when not
chosen; when no unit variable is found by name and periods repeat, the identifying column is used as the unit.
Source filter, frequency conversion and population rates are under "More data preparation".

## Console and Output

- t-tests log the command by name (`ttest y, by(g) unequal`, `t.test(y ~ g, data = df, var.equal = FALSE)`),
  with the subgroup `if`, and print Stata's or R's output for the selected syntax. The data are not embedded.
- `summarize` / `tabulate` open the univariate descriptive page.
- The Tests and Charts directory pages are replaced by **Output**: every command, its printed result and every
  chart from the session, in order, with a command line. The Tests ▾ and Charts ▾ menus list every method.

## Analysis pages

Run status, Cancel and errors appear under the Run button. Summary-statistics inputs have plain labels and are
checked before R starts; R's numeric option checks name the setting instead of `stopifnot` text. A failed R
download says that the first run needs internet.

## Validation

`node --test calculator/tests/*.test.mjs` includes `ts-dates.test.mjs` (date formats, frequencies, repeats,
panels, gaps, missing values, trading days, panel suggestions).
