# Chart directory and dedicated workspaces

Build 2026-10-24.24 adds eight chart families and 37 individual chart pages.
The Charts button opens the directory; its caret opens category disclosures. Each
leaf opens a page without the previous chart-type switching strip. Native buttons,
details disclosures, labels, focus outlines and an accessible SVG description support
keyboard, touch and screen-reader navigation. Existing histogram, box/bar/scatter,
grouped box, percentage stack, timeline, scatter matrix and world-map renderers remain.

New renderers cover grouped/count stacks, Likert responses, pies/donuts, density and
violin plots, plain/smoothed scatters, hexbins, correlation/general heatmaps, group mean
and proportion intervals, dumbbell/slope/paired changes, multi-series/panel timelines,
model estimates and survival curves. Options include small multiples with shared or
independent scales, labels, titles, font size, filled-mark patterns, automatic/manual
axis ranges, PNG/SVG downloads, full chart-table copy and existing plot history/report
exports. Per-page configuration, including uploaded boundaries, is saved in sessions.

## Calculation scope

- Filters and missing-code rules use the calculator's existing aligned data arrays.
  Complete rows and exclusions are reported. Positive finite weights are used for
  descriptive counts, means and densities. Mean/proportion confidence intervals,
  paired plots and survival curves explicitly require unweighted data.
- Mean intervals use Student t; proportion intervals use Wilson score. The confidence
  level comes from Settings. Weight normalization does not change pie percentages.
- Pie percentages exclude missing categories unless explicitly included; optional
  Other combines slices below a percentage threshold. Response-stack percentages use
  the total within each X category. Likert response order is explicit and validated;
  an optional neutral category is centered on zero.
- Density uses a Gaussian kernel and bandwidth 1.06 × SD × effective N^(-1/5).
  Over 20,000 rows per group use a 2,048-bin weighted approximation. Density display
  ends at the observed limits; the Gaussian tails beyond those limits are not shown.
- Scatter points are capped at 4,000 per group, violin points at 400 per group and
  paired lines at 2,000. Ranges and summaries still use all complete observations.
  The smoother joins weighted means in equal-width X bins, explicitly not LOESS.
- Timeline values are group/time means. Connecting observed times is a visual guide,
  not an estimate of values in missing periods. Additional outcomes retain separate
  denominators; included observation-series pairs are labeled accordingly.
- Kaplan–Meier supports right censoring and entry at time zero. At tied times, events
  use the full pre-event risk set before censoring. Censor ticks are drawn. The table
  includes pointwise 95% Greenwood normal intervals, clipped to [0,1]. It does not
  support delayed entry, competing risks, survey weights or a log-rank test.
- Coefficients can reuse the current fitted regression; predictions/interactions can
  reuse its last generated margins, checked against current data and specification.
  Model comparisons use models added to the regression table, from one model family.
  All model-result pages also accept estimate/lower/upper columns, with optional
  groups. Event-study, marginal-effect and conjoint pages display supplied results;
  they do not add new causal/conjoint estimators. Imported confidence levels/units
  must be compatible. These pages never infer uncertainty from the spread of estimates.
- Subnational maps require user-supplied GeoJSON Polygon/MultiPolygon boundaries and
  a unique identifier property. Matched means, unmatched areas and unmatched dataset
  identifiers are reported. Rendering is planar, without automatic reprojection or
  remote boundary downloads. The existing world-country map remains available.
- Category and facet limits fail explicitly rather than silently drop groups.
  Table previews show 500 rows; Copy includes all table rows.

## Sources

- https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
- https://stat.ethz.ch/R-manual/R-patched/library/stats/html/bandwidth.html
- https://www.stata.com/manuals14/st.pdf
- https://www.stata.com/features/overview/margins-plots/

## Build and validation

```
PYTHONDONTWRITEBYTECODE=1 python calculator/tools/build_time_series.py
node calculator/tests/chart-suite.test.mjs
```

The deterministic builder embeds the engine, component and CSS sources into the same
self-contained HTML. Tests cover all dedicated pages, numeric interval references,
tied censor/event handling, denominators, filters, complete pairs, invalid bounds,
GeoJSON joins, 200,000-row hexbin/manual ranges, safe SVG labels and chart navigation.
The previous regression, t-test, network, time-series, browse, Help and output-order
checks remain part of validation.
