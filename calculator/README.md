# Explicit time-series setup

The calculator remains a self-contained HTML file. The time-series preparation
module is maintained in `src/time-series-setup.mjs`, and its setup controls in
`src/time-series-controls.html`. Both are embedded in `index.html` by:

```sh
python calculator/tools/build_time_series.py
node calculator/tests/time-series.test.mjs
```

The builder also applies versioned integration patches to the existing component
and statistical engine. It rejects unexpected source anchors instead of silently
patching a different release. Rebuilding a current bundle is deterministic.

An optional local integration test uses a supplied Stata fixture without adding
the dataset to this repository:

```sh
GM26_TEST_DTA=/absolute/path/to/incidencia_1997_2025.dta \
  node calculator/tests/time-series.test.mjs
```

## Behavior

- Existing numeric calendar dates or year + month/quarter columns; declared
  annual, quarterly, monthly, weekly, daily, or integer-period frequencies.
- Original frequency retained by default. Coarser periods require an explicit
  sum, mean, or population-rate rule.
- A measurement/source filter selects one version using stored codes while
  displaying value labels. Alternative measurements are never automatically
  merged, averaged, or deleted.
- Unit–period uniqueness is checked before aggregation, including records with
  missing outcomes. Invalid dates and missing unit identifiers require correction
  or an explicit filter.
- Calendar aggregations require complete observed periods. Incomplete periods
  remain missing; population rates require a positive period-level denominator
  that is constant across contributing subperiods.
- Gaps are preserved. The current time-series estimator requires a contiguous
  observed range; it blocks unsupported gaps instead of treating separated rows
  as adjacent periods. No implicit interpolation or zero filling occurs.
- Monthly/quarterly/daily interventions and period limits accept calendar dates.
  Differing intervention dates across pooled units require a separate design;
  the tool directs users to a common-date subset or separate estimates.
- Preparation, filters, transformations, centered time, intervention terms and
  model specifications are included in logged/exported Stata and R scripts.
  Each analysis preserves/restores the original data in Stata and uses a local
  copy in R. Source data are not changed by preparing the series.
- Existing linear segmented models remain unweighted. The summary makes this
  explicit. Adding count-family estimators or automatic seasonality selection is
  outside this setup change.

The tests cover calendar encoding, duplicate measurements, structural missingness,
incomplete periods, sums/means/rates, denominator validation, gap rejection,
segmented-model coefficients, generated scripts and bundled component syntax.
