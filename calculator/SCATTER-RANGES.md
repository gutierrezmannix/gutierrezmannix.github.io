# Scatter ranges — build 2026-10-23.18

Scatterplots in Correlation and Charts use each selected variable's finite minimum and maximum in the active data. Active subgroup/filter and missing-value rules apply. Values are not forced to zero or expanded to rounded tick boundaries. A variable's valid endpoint remains in its axis range even if that row is missing the other variable, while points and the fitted model still use complete x/y pairs.

Both axis endpoints are labeled. The controls also show the full-precision observed ranges, with an explanation that blank limits use those ranges. Min/max fields, the include-zero button, and per-variable manual axis settings remain available. Reset clears overrides and returns to the current observed ranges. Existing saved manual ranges remain intentional overrides.

The fitted line is clipped to the plot rectangle using its true coordinates. Narrowing the Y range no longer clamps its endpoints and visually changes its slope. PNG/SVG exports and plot history capture the displayed axes.

Validation: `node calculator/tests/scatter-ranges.test.mjs` exercises both workspaces, independently missing x/y endpoints, positive/negative/small ranges, endpoint ticks, filters, manual limits, include-zero, Reset, and fit-line clipping. The button, network, time-series and 90-case R-reference t-test suites also pass. A second rebuild is byte-identical.
