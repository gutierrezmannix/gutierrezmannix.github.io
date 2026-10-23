# Button audit repairs — build 2026-10-23.17

Numeric-to-text conversion and CSV saving now serialize full-precision values, including negative zero. Entering text into a numeric column also preserves the other cells' precision. CSV quoting includes carriage returns. Missing numeric values remain empty cells.

SEM clears fitted results after marker, indicator, factor, path, and method edits. A signature guard hides results after data, treatment, missing-value, or filter changes. A pending fit cannot overwrite a newer model. Display-only standardization does not require refitting.

The printable session log initializes before leaving the workbench render path, restoring dataset details, command/results rows, Print, and Back. Current-chart validation no longer shares state with plot history; current chart downloads appear only when a chart exists.

Scatter, grouped box plots, and stacked plots now receive the selected color. Multicategory plots retain distinct category colors while using the selected color first. One-sample and paired t-tests now show an estimate with its confidence interval and the tested reference value; the independent-groups chart remains available. All three designs connect to the chart export controls.

Individual PNG downloads use Blob URLs after rasterization, matching the working bulk download approach. Missing charts and PNG conversion failures report an error.

## Validation

```sh
python3 calculator/tools/build_time_series.py
node calculator/tests/buttons.test.mjs
node calculator/tests/network.test.mjs
node calculator/tests/time-series.test.mjs
GM26_TTEST_R_DIR=/path/to/generated-reference node calculator/tests/ttests.test.mjs
```

The button suite exercises the shipped component and engine: full-precision numeric round trips and CSV reopening; CSV quoting/missingness; lab-report content, dialect, Print, and Back; chart validation with existing history; selected colors in scatter/grouped/stacked plots; export-connected charts in each t-test design; stale SEM results after marker/data/missing changes; cancellation of obsolete pending fits; and Blob PNG downloads/error feedback. The existing 90 R-reference t-tests, network suite, and calendar/time-series suite pass. Rebuilding twice is deterministic.
