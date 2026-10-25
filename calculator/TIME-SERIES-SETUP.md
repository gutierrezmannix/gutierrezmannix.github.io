# Time series setup, console output and the Output view — build 2026-10-25.30

## Build .30 — one time-series method, survey collapse, simpler layout

**One method.** Time series now offers only **Trends and interrupted time series** (Tests ▾ → Time series), the
design most used in political science for policy and event effects. The 13 R time-series pages (STL, naïve,
drift, ETS, ARIMA, SARIMA, regression with ARIMA errors, ARDL, VAR, VECM, breaks, counts…) are removed from the
menus and the model guide; their code remains.

**Survey records.** Under *Each row is*, choose **One person / record (survey) → collapse**:

- **Observation ID** (optional) — pick a respondent key or press **+ Create ID** (`generate long obs_id = _n`);
  the summary reports whether every ID is unique within each unit and period.
- **Weight** (optional) — applies to Mean (weighted mean), Median (weighted median) and Sum (weighted total).
  Records with a missing or non-positive weight are left out.
- **Collapse each period with** Mean (share for 0/1), Median, Sum, Minimum, Maximum or Range (max − min).

Records are collapsed to one value per period (and per unit when a unit variable is set), like Stata's
`collapse (stat) y [pw=w], by(unit time)`; the model is fitted to those values. Repeated periods without this
choice still stop the run. The Stata / R script includes the collapse step.

**Layout (Stata order).** 1 · Time, unit and outcome → Each row is (collapse options) → time information →
*More data preparation* (analyse level/change, period range, source filter, frequency, rates) → units.
2 · Event date and what changes after it; the event name and per-unit event periods are under *More event options*.
3 · Results table → chart → before/after → *What this means*; diagnostics (ADF, ACF/PACF), the full script and
"Add the event variables" are folded.

**Console.** A time-series entry shows the key commands (collapse, xtset/tsset, regress/newey, or lm/coeftest);
the full script is in the session .do / .R download and under "Stata / R script".

## Tests → Time series pages (build .28; retired from the menus in .30)

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

## Toolbar menus (build .29)

The Tests ▾ and Charts ▾ dropdowns scroll as one list (the inner category list no longer scrolls separately), and an open menu is sized to end above the bottom of the window, accounting for the text-size zoom.
